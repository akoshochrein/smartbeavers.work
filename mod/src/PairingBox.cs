using System;
using Timberborn.CoreUI;
using Timberborn.InputSystem;
using Timberborn.SingletonSystem;
using UnityEngine.UIElements;

namespace Smartbeavers.Companion;

/// <summary>
/// The mod's one window: a small box where the player pastes the colony's mod address, and which
/// says whether the mod is getting through. Opened with a key (Alt+Shift+B unless rebound in
/// Settings > Key bindings > smartbeavers).
///
/// It is the game's own input box (the one used for renaming things) with our text in it, so it
/// looks like the rest of the game without the mod shipping any artwork or layout of its own.
/// </summary>
public class PairingBox(
    VisualElementLoader visualElementLoader,
    PanelStack panelStack,
    InputService inputService,
    Pairing pairing,
    Reporter reporter) : IPanelController, IInputProcessor, IPostLoadableSingleton
{
    const string OpenKey = "Smartbeavers.OpenBox";

    VisualElement? _root;
    Label? _message;
    TextField? _input;
    bool _open;

    public void PostLoad()
    {
        inputService.AddInputProcessor(this);
    }

    public bool ProcessInput()
    {
        if (_open || !inputService.IsKeyDown(OpenKey))
        {
            return false;
        }

        Open();
        return true;
    }

    public VisualElement GetPanel() => _root!;

    public bool OnUIConfirmed()
    {
        Confirm();
        return true;
    }

    public void OnUICancelled()
    {
        Close();
    }

    void Open()
    {
        if (_root is null)
        {
            _root = visualElementLoader.LoadVisualElement("Core/InputBox");
            _message = _root.Q<Label>("Message");
            _input = _root.Q<TextField>("Input");
            _root.Q<Button>("ConfirmButton").clicked += Confirm;
            _root.Q<Button>("CancelButton").clicked += Close;
        }

        _message!.text = Intro + "\n\n" + Status();
        _input!.value = pairing.Address?.ToString() ?? "";
        _open = true;
        panelStack.PushDialog(this);
        _input.Focus();
    }

    void Confirm()
    {
        var text = _input!.value ?? "";
        if (text.Trim().Length == 0)
        {
            if (pairing.Address is not null)
            {
                pairing.Set(null);
            }

            Close();
            return;
        }

        if (!Pairing.TryParse(text, out var address, out var problem))
        {
            _message!.text = Intro + "\n\n" + problem;
            return;
        }

        if (address != pairing.Address)
        {
            pairing.Set(address);
        }

        Close();
    }

    void Close()
    {
        if (!_open)
        {
            return;
        }

        _open = false;
        panelStack.Pop(this);
    }

    const string Intro =
        "smartbeavers companion\n\n" +
        "Paste this colony's mod address from its Signals tab on the site. " +
        "Leave the field empty to stop reporting for this save.";

    string Status()
    {
        if (pairing.Address is null)
        {
            return "This save isn't paired. Nothing is being sent.";
        }

        if (reporter.Problem is not null)
        {
            return reporter.Problem;
        }

        if (reporter.LastSentAt is null)
        {
            return "Paired. Waiting for the first report to go through.";
        }

        var seconds = (int)(DateTime.UtcNow - reporter.LastSentAt.Value).TotalSeconds;
        return seconds < 90 ? "Connected. Last report sent less than a minute ago." : $"Connected. Last report sent {seconds / 60} minutes ago.";
    }
}
