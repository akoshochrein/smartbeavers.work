using System;
using System.Collections.Generic;
using System.Globalization;
using System.Net;
using System.Net.Http;
using System.Text;
using System.Threading.Tasks;
using Timberborn.SingletonSystem;
using UnityEngine;

namespace Smartbeavers.Companion;

/// <summary>
/// Sends the colony's readings to the site while a paired save is running.
///
/// - Nothing is sent for a save that isn't paired.
/// - A snapshot holds only what changed since the last one that arrived, and goes out at most
///   every 15 seconds. The first one after loading holds everything.
/// - A new day, a new cycle or a change of weather doesn't wait for the 15 seconds: the site
///   counts game days by these changes, and at high game speed a day can pass faster than that.
///   Such a snapshot goes out as soon as 3 seconds after the previous one.
/// - Storage is looked at once a minute. A large colony's goods wobble by a point all the time,
///   and reporting each wobble stored thousands of readings an hour that no chart can show.
/// - With nothing to say, a heartbeat goes out once a minute so the site knows the game is running.
/// - If the site can't be reached, the snapshot is dropped. The next one is worked out from what
///   the site last received, so nothing is lost and nothing queues up.
///
/// Values are read on the main thread and the request runs in the background; its outcome is
/// picked up on the main thread again in the next frame. A failed or slow request never holds
/// the game up.
/// </summary>
public class Reporter(Pairing pairing, GameReader gameReader) : IUpdatableSingleton, IUnloadableSingleton
{
    public const string ModVersion = "0.1.1";
    const int ContractVersion = 1;

    const float CheckEvery = 1f;
    const float SnapshotEvery = 15f;
    const float DateOrWeatherEvery = 3f;
    const float GoodsEvery = 60f;
    const float HeartbeatEvery = 60f;
    const float WaitAfterFailure = 30f;
    const float WaitAfterRefusal = 120f;

    static readonly HttpClient Http = new() { Timeout = TimeSpan.FromSeconds(10) };

    // What the site has: the readings of every snapshot that arrived.
    readonly Dictionary<string, int> _received = new();
    readonly object _outcomeLock = new();
    Outcome? _outcome;
    Dictionary<string, int>? _inFlight;
    bool _inFlightHasGoods;
    float _nextGoods;
    int _pairingVersion = -1;
    float _nextCheck;
    float _nextSend;
    float _notBefore;
    float _lastSend = float.NegativeInfinity;
    float _lastArrived = float.NegativeInfinity;

    /// <summary>When the site last accepted a request, or null if it hasn't yet since loading.</summary>
    public DateTime? LastSentAt { get; private set; }

    /// <summary>What went wrong with the last request, in plain words, or null if it went through.</summary>
    public string? Problem { get; private set; }

    public void UpdateSingleton()
    {
        var now = Time.realtimeSinceStartup;

        if (_pairingVersion != pairing.Version)
        {
            // A different colony, or none: whatever was sent before doesn't count for it.
            _pairingVersion = pairing.Version;
            _received.Clear();
            _nextSend = 0f;
            _notBefore = 0f;
            _nextGoods = 0f;
            _lastArrived = float.NegativeInfinity;
            LastSentAt = null;
            Problem = null;
        }

        if (_inFlight is not null)
        {
            Outcome? outcome;
            lock (_outcomeLock)
            {
                outcome = _outcome;
                _outcome = null;
            }

            if (outcome is null)
            {
                return;
            }

            Finish(outcome, now);
        }

        if (pairing.Address is null || now < _nextCheck || now < _notBefore)
        {
            return;
        }

        _nextCheck = now + CheckEvery;

        // Between regular snapshots the mod still looks, but only acts on the date and the weather.
        var regular = now >= _nextSend;
        var withGoods = regular && now >= _nextGoods;
        var changed = new Dictionary<string, int>();
        foreach (var reading in gameReader.Read(withGoods))
        {
            if (!_received.TryGetValue(reading.Key, out var known) || known != reading.Value)
            {
                changed[reading.Key] = reading.Value;
            }
        }

        var dateOrWeatherChanged = changed.ContainsKey("day") || changed.ContainsKey("cycle") || changed.ContainsKey(GameReader.WeatherName);
        var due = regular
            ? changed.Count > 0 || now - _lastArrived >= HeartbeatEvery
            : dateOrWeatherChanged && now - _lastSend >= DateOrWeatherEvery;
        if (due)
        {
            _inFlightHasGoods = withGoods;
            _lastSend = now;
            Send(pairing.Address, changed, pairing.Version);
        }
    }

    /// <summary>
    /// The save is being unloaded (back to the menu, another save, or quitting): tell the site the
    /// game stopped, so it doesn't show the colony as live for five more minutes. Sent without
    /// waiting for an answer; if it doesn't arrive, the site works it out from the silence.
    /// </summary>
    public void Unload()
    {
        if (pairing.Address is null || LastSentAt is null)
        {
            return;
        }

        var body = new StringContent("{\"v\":" + ContractVersion + ",\"mod\":\"" + ModVersion + "\",\"bye\":true}", Encoding.UTF8, "application/json");
        Http.PostAsync(pairing.Address, body).ContinueWith(task => { _ = task.Exception; }, TaskScheduler.Default);
    }

    void Send(Uri address, Dictionary<string, int> changed, int forPairing)
    {
        _inFlight = changed;
        var body = new StringContent(Body(changed, gameReader.Faction()), Encoding.UTF8, "application/json");

        Http.PostAsync(address, body).ContinueWith(
            task =>
            {
                var outcome = task.Status == TaskStatus.RanToCompletion
                    ? new Outcome(forPairing, task.Result.StatusCode, null)
                    : new Outcome(forPairing, null, task.Exception?.GetBaseException().Message ?? "the request was cancelled");
                if (task.Status == TaskStatus.RanToCompletion)
                {
                    task.Result.Dispose();
                }

                lock (_outcomeLock)
                {
                    _outcome = outcome;
                }
            },
            TaskScheduler.Default);
    }

    void Finish(Outcome outcome, float now)
    {
        var sent = _inFlight!;
        _inFlight = null;

        // The player paired a different colony while this was on its way: it says nothing about the new one.
        if (outcome.ForPairing != pairing.Version)
        {
            return;
        }

        if (outcome.Status is HttpStatusCode.NoContent or HttpStatusCode.OK)
        {
            foreach (var reading in sent)
            {
                _received[reading.Key] = reading.Value;
            }

            // Goods wait a minute from a snapshot that carried them. One that failed doesn't count,
            // so they go out again with the next snapshot that gets through.
            if (_inFlightHasGoods)
            {
                _nextGoods = now + GoodsEvery;
            }

            if (LastSentAt is null)
            {
                Debug.Log("[smartbeavers] Connected: the site accepted the first report.");
            }

            _lastArrived = now;
            _nextSend = now + SnapshotEvery;
            LastSentAt = DateTime.UtcNow;
            SetProblem(null);
            return;
        }

        _notBefore = now + (outcome.Status is null ? WaitAfterFailure : WaitAfterRefusal);
        SetProblem(outcome.Status switch
        {
            null => "The site couldn't be reached. The mod keeps trying.",
            HttpStatusCode.NotFound => "The site doesn't recognise this address. If you made new links for the colony, paste the new mod address.",
            HttpStatusCode.BadRequest => "The site didn't understand what the mod sent. The mod may need an update.",
            _ => $"The site answered with an error ({(int)outcome.Status}). The mod keeps trying.",
        }, outcome.Error);
    }

    void SetProblem(string? problem, string? detail = null)
    {
        if (problem != Problem)
        {
            Debug.Log(problem is null ? "[smartbeavers] Reporting to the site again." : $"[smartbeavers] {problem}{(detail is null ? "" : $" ({detail})")}");
        }

        Problem = problem;
    }

    /// <summary>The request body: see the contract in the site's code (src/shared/mod.ts).</summary>
    static string Body(Dictionary<string, int> changed, string? faction)
    {
        var json = new StringBuilder();
        json.Append("{\"v\":").Append(ContractVersion).Append(",\"mod\":\"").Append(ModVersion).Append('"');
        if (faction is not null)
        {
            json.Append(",\"faction\":\"").Append(faction).Append('"');
        }

        json.Append(",\"readings\":{");
        var first = true;
        var goods = new StringBuilder();
        foreach (var reading in changed)
        {
            if (reading.Key.StartsWith(GameReader.GoodPrefix, StringComparison.Ordinal))
            {
                // Good ids are plain letters, so they need no escaping.
                goods.Append(goods.Length > 0 ? "," : "").Append('"').Append(reading.Key, GameReader.GoodPrefix.Length, reading.Key.Length - GameReader.GoodPrefix.Length)
                    .Append("\":").Append(reading.Value.ToString(CultureInfo.InvariantCulture));
                continue;
            }

            json.Append(first ? "" : ",").Append('"').Append(reading.Key).Append("\":");
            first = false;
            if (reading.Key == GameReader.WeatherName)
            {
                json.Append('"').Append(GameReader.WeatherWord(reading.Value)).Append('"');
            }
            else
            {
                json.Append(reading.Value.ToString(CultureInfo.InvariantCulture));
            }
        }

        if (goods.Length > 0)
        {
            json.Append(first ? "" : ",").Append("\"goods\":{").Append(goods).Append('}');
        }

        return json.Append("}}").ToString();
    }

    sealed class Outcome(int forPairing, HttpStatusCode? status, string? error)
    {
        public int ForPairing { get; } = forPairing;
        public HttpStatusCode? Status { get; } = status;
        public string? Error { get; } = error;
    }
}
