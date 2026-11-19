using System;
using System.Text.RegularExpressions;
using Timberborn.Persistence;
using Timberborn.SingletonSystem;
using Timberborn.WorldPersistence;

namespace Smartbeavers.Companion;

/// <summary>
/// Which colony on the site this save reports to: the mod address the player pasted, kept in the
/// save file. Later saves of the same settlement carry it along (autosaves, "save as" copies);
/// a new game has none. Without one the mod sends nothing at all.
///
/// The address carries the colony's secret, so a shared save file shares it. The site tells
/// players to make new links before sharing a save.
/// </summary>
public class Pairing(ISingletonLoader singletonLoader) : ISaveableSingleton, ILoadableSingleton
{
    static readonly SingletonKey SaveKey = new("SmartbeaversCompanion");
    static readonly PropertyKey<string> AddressKey = new("Address");

    // https://smartbeavers.work/mod/<48 hex characters>, or the same on someone's own copy of the site.
    static readonly Regex AddressShape = new(@"^https?://[^/\s]+/mod/[0-9a-f]{48}$", RegexOptions.Compiled);

    /// <summary>The address to report to, or null if this save isn't paired.</summary>
    public Uri? Address { get; private set; }

    /// <summary>Goes up whenever the address changes, so the reporter knows to start over.</summary>
    public int Version { get; private set; }

    public void Load()
    {
        if (singletonLoader.TryGetSingleton(SaveKey, out var saved) && saved.Has(AddressKey))
        {
            TryParse(saved.Get(AddressKey), out var address, out _);
            Address = address;
        }
    }

    public void Save(ISingletonSaver singletonSaver)
    {
        if (Address is not null)
        {
            singletonSaver.GetSingleton(SaveKey).Set(AddressKey, Address.ToString());
        }
    }

    public void Set(Uri? address)
    {
        Address = address;
        Version++;
    }

    /// <summary>Checks what the player pasted. On failure, <paramref name="problem"/> says why in plain words.</summary>
    public static bool TryParse(string text, out Uri? address, out string problem)
    {
        address = null;
        problem = "";
        var trimmed = text.Trim().TrimEnd('/');
        if (!AddressShape.IsMatch(trimmed) || !Uri.TryCreate(trimmed, UriKind.Absolute, out var parsed))
        {
            problem = "That doesn't look like a mod address. Copy it from the colony's Signals tab on the site: it starts with https:// and ends with /mod/ and a long code.";
            return false;
        }

        address = parsed;
        return true;
    }
}
