# Glossary

The words this project uses, in the interface, the docs and conversation. Where the code uses a
different name for the same thing, it is listed under "In code" so you can find it; use the
term itself in prose.

## The game and the colony

| Term         | Meaning                                                                              | In code / avoid |
| ------------ | ------------------------------------------------------------------------------------ | --------------- |
| Colony       | One Timberborn save connected to the site                                            | `colonies` |
| Colony page  | The page for one colony, with its Trackers, Signals and Settings tabs                | `ColonyPage`. Avoid "colony dashboard" |
| Dashboard    | The "Your colonies" list a player lands on after signing in                          | `/dashboard` |
| Status band  | The strip at the top of the colony page with the game date, the current weather and whether the game is sending right now | |
| Tile         | A compact view of one tracker on the colony page: its name, value and a small trend line. It opens to show the full chart | Avoid "card" for this |
| Population block | The part of the colony page with the population total and a chart stacked by adults, children and bots | |
| Children     | Young beavers, as the game's counters name them                                      | `kits` in the mod's contract. Avoid "kits" in prose |
| Faction      | Folktails or Iron Teeth. Narrows the goods offered for a colony                      | `folktails`, `iron_teeth` |
| Start API    | The in-game action needed after every save load. Until then adapters send nothing | |
| Operator     | Whoever runs a deployment of the site                                                | `VITE_OPERATOR_*` |

## Signals

| Term          | Meaning                                                                             | In code / avoid |
| ------------- | ----------------------------------------------------------------------------------- | --------------- |
| Adapter       | An in-game HTTP Adapter that calls the site when a building switches on or off      | |
| Adapter links | The colony's two URLs, one for on and one for off, that adapters call               | Avoid "secret link", "webhook" |
| Token         | The 48-character secret inside the adapter links                                    | `webhook_token` |
| Signal        | One adapter call received by the site                                               | `adapter_events`. Avoid "event", "webhook" |
| Adapter state | The latest on/off value for one adapter name                                        | `adapter_states` |

## The companion mod

| Term          | Meaning                                                                             | In code / avoid |
| ------------- | ----------------------------------------------------------------------------------- | --------------- |
| Companion mod | The Timberborn mod that reads a colony's values in the game and reports them to the site, so nothing has to be built in the game | Avoid "plugin" |
| Reading       | One value the companion mod reported for a colony, such as a population of 34. Exact, unlike a number rebuilt from signals | `readings` |
| Pairing       | Pasting a colony's mod address into the companion mod for one save, so that save reports to that colony | |
| Mod address   | The address the companion mod reports to, shown on the colony's Signals tab. It carries the colony's token | `/mod/<token>` |
| Pinned good   | A good whose storage reading the player chose to show as a card on the colony's page | `pinned_metrics` |
| Heartbeat     | A request from the companion mod that carries no readings and only says the game is running | |
| Reporting     | The companion mod has sent something for a colony in the last 5 minutes and hasn't said the save was closed. While it is reporting, its readings are the colony's values; after it stops, adapters take over only once they report something newer | `mod_sessions` |

## Trackers

| Term            | Meaning                                                                           | In code / avoid |
| --------------- | --------------------------------------------------------------------------------- | --------------- |
| Tracker         | Anything that follows a resource or metric from the game. There are three kinds: number trackers, the weather tracker and the game clock | |
| Number tracker  | A tracker that rebuilds a number, such as population, free beds or how full a storage is, from several counters | `ladders`, `ladderId`, `useLadders`. Avoid "ladder" for this |
| Metric          | The start of the adapter names a number tracker follows, such as `Pop`, `FreeBeds` or `Water` | `ladders.metric`. Avoid "prefix" |
| Counter         | An in-game Population Counter or Resource Counter                                 | |
| Step            | One counter's adapter at one number, named `<Metric><n>`, for example `Pop30`     | Avoid "threshold" |
| Weather tracker | A tracker that follows the weather through Weather Stations                       | `weather_trackers` |
| Weather         | Temperate, drought or badtide                                                     | `WeatherTemperate`, `WeatherDrought`, `WeatherBadtide` |
| Hazard          | Drought or badtide                                                                | |
| Game clock      | Day counting driven by a Chronometer and the `GameDay` adapter                    | `game_clocks` |
| Cycle           | A run of game days that starts when temperate weather starts                      | |
| Game date       | The cycle and day, worked out from the game clock and the date the player set     | `game_date()` |

## Keeping history

| Term        | Meaning                                                                                 | In code / avoid |
| ----------- | --------------------------------------------------------------------------------------- | --------------- |
| History     | Everything a colony has received over time: its signals and its readings                | |
| Retention   | How long history is kept before it is deleted                                           | Avoid "pruning" in prose |
| Thinning    | Keeping fewer values from older stretches of history: every value at first, then one per hour, then one per day | Avoid "downsampling", "compaction" |
| Totals      | Counts that are kept when the history behind them is deleted, such as how many times each weather has started | |

## Players and live colonies

| Term           | Meaning                                                                            | In code / avoid |
| -------------- | ---------------------------------------------------------------------------------- | --------------- |
| Profile        | A player's handle, picture and public/private choice                               | `profiles` |
| Handle         | A player's unique public name, 3 to 20 characters                                  | |
| Picture        | A player's profile image                                                           | `avatar`, `avatars` bucket |
| Public profile | A profile the player has chosen to show. Needed to appear among the live colonies            | `is_public` |
| Live colonies  | The public list of recently played colonies whose players have a public profile | `colony_ladder()`. The page is at `/live`. Avoid "ladder" and "leaderboard" in prose |
| Live           | A colony that sent a signal recently. The window differs by place today: 5 minutes on a tracker card, 10 minutes on the colony page's header and on the dashboard, 1 hour for the live colonies list | |
