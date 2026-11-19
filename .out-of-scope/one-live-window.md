# One shared "live" window

This project does not unify how recently a colony must have sent a signal to count as live.

## Why this is out of scope

"Live" is judged in three places, each with its own window:

- 5 minutes on a tracker card
- 10 minutes on the colony header and the dashboard
- 1 hour on the public list of live colonies

The windows differ because the places answer different questions: whether one tracker's number is
current, whether a colony is being played right now, and whether a colony was played recently
enough to list publicly. Players read each one in its own place and don't compare them, so a
single shared window, or a separate word for each, would add a rule to maintain without changing
anything a player notices.

`GLOSSARY.md` records the three windows under "Live", so the difference is documented rather
than accidental.

## Prior requests

- #16: "Live" means three different time windows
