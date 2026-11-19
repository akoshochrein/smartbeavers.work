# smartbeavers companion

A Timberborn mod that reports a colony's numbers to [smartbeavers.work](https://smartbeavers.work)
(or your own copy of the site), so you can follow the colony from any device without building
counters, Weather Stations, a Chronometer or HTTP Adapters.

It is early: built for its author's own use first. Expect rough edges, and expect a game update
to break it until it is rebuilt.

## What it sends

Only for a save you have paired, and only while that save is running:

- adults, kits and bots
- free beds
- how full storage is for each good that has storage
- the weather: temperate, drought or badtide
- the cycle and the day
- the save's faction

All of these are totals for the whole settlement. Nothing about districts, nothing from other
saves, nothing about you or your computer beyond what any request to a website carries. Until
a save is paired the mod makes no network requests at all.

It sends what changed at most every 15 seconds, storage at most once a minute, and a short
"still running" message once a minute when nothing did. A new day or a change of weather is
sent straight away, so days aren't missed at high game speed. If the site can't be reached, the game carries on as normal and the
mod tries again later.

## Install

1. Build the mod (below), or unpack a release into `Documents/Timberborn/Mods/smartbeavers.Companion`.
2. Start Timberborn, open **Mods** on the main menu, and tick **smartbeavers companion**.
3. Restart the game if it asks you to.

It needs Timberborn 1.1 and no other mods.

## Pair a save

1. On the site, open the colony and go to its **Signals** tab. Under **Companion mod**, copy the
   address.
2. In the game, load the save and press **Alt+Shift+B**. A small box opens.
3. Paste the address and confirm.
4. Save the game. The address is kept in the save file, so each save reports to its own colony.

Open the box again at any time to see whether the mod is getting through. To stop reporting for
a save, open the box, empty the field and confirm.

The key can be changed in **Settings → Key bindings → smartbeavers**.

**Sharing a save shares its address.** Before you give a save file to someone, make new links
for the colony in its Settings tab on the site, or their game will report to your colony.

## Remove

Untick the mod in the game's **Mods** menu, or delete its folder. Saves made with the mod load
fine without it.

## Build

You need the [.NET SDK](https://dotnet.microsoft.com/download) (8 or newer) and Timberborn
installed. No Unity editor.

```sh
cd mod
dotnet build -c Release
```

This builds against the game's own files and installs the mod into the game's mods folder. It
looks for a Steam install in the usual place on macOS and Windows; if yours is elsewhere, the
comment at the top of `smartbeavers.Companion.csproj` says how to point it at the right folders.

The game's files are only referenced, never copied. They belong to Mechanistry: don't commit
them and don't put them in the mod's folder.

CI does not build the mod, because it has no copy of the game.

## How it is put together

| File                 | What it does                                                                 |
| -------------------- | ---------------------------------------------------------------------------- |
| `src/Configurator.cs` | Registers the parts below with the game, for loaded games only              |
| `src/Pairing.cs`      | The address a save reports to, kept in the save file                        |
| `src/GameReader.cs`   | Reads the values from the game's own services                               |
| `src/Reporter.cs`     | Works out what changed and sends it, in the background                      |
| `src/PairingBox.cs`   | The box: the game's own input box with the mod's text in it                 |

What the mod sends is defined on the site's side, in `src/shared/mod.ts`. The two must agree.

The mod relies on the game's internal classes, which is the only way to mod Timberborn. A game
update can rename or remove any of them.

## Licence

MIT, like the rest of this repository. No code from GPL-licensed mods may be copied in. The mod
contains no game artwork.
