---
status: accepted
---

# Bounded history per colony, to stay on free hosting

smartbeavers is meant to stay free to use, which means it has to fit in a free database (500 MB
at the time of writing). A large colony played with the companion mod stores about 1 MB of
readings per hour of play, so keeping everything would fill the database after roughly 500
hours of play across all players. We decided that every colony gets the same bounded footprint
however much it is played: history is thinned as it ages and deleted after a fixed time.

The defaults:

- Readings are kept in full for 48 hours, then one value per metric per hour until 30 days,
  then one per day until 180 days, then deleted. The value kept is the last of its hour or day.
- Day, cycle and weather changes are never thinned, because the site counts them. Adapter
  signals are sparse and are not thinned either. Both are deleted after 180 days.
- Before day and weather history is deleted it is folded into totals: all-time counts of each
  weather, and an adapter colony's clock moved forward so its game date stays right.
- A colony not heard from for 12 months loses its history, sessions and totals. The colony,
  its trackers, its adapter links and its latest values stay.
- What comes in is capped too: one stored reading per metric per 10 seconds (day, cycle and
  weather exempt) and 6,000 per colony per hour, so one bad day can't fill the database before
  the nightly cleanup runs.

These numbers are one row of settings in the database, read by the cleanup job, the intake and
the privacy page alike, so the page always states what the deployment really does. An empty
setting means no limit: someone running their own copy on a large machine can keep everything.

## Considered options

- **Keep everything.** What the site did until now. Not compatible with free hosting.
- **Delete by age only.** Simple, but a busy colony could still take hundreds of megabytes
  inside the window, so players would not be treated equally.
- **Aggregate old history** (averages, lows and highs per day). More faithful charts for old
  stretches, and three times the rows. Set aside as a distraction for now; charts are too
  coarse beyond 30 days to show the difference.
- **Settings in the Worker's configuration**, next to the other deployment settings. The
  cleanup runs inside the database and could not read them, and the privacy page could drift
  from what actually happens.
- **Delete colonies or accounts that go quiet.** A bigger promise to make to players than
  clearing old history. Not decided here.

## Consequences

- Deleted history cannot be brought back. Loosening the settings later only affects what is
  stored from then on.
- Charts older than 48 hours are coarser than what the game showed at the time, and a short
  dip inside a thinned hour or day is lost.
- The export contains what is currently stored, not everything a colony ever sent.
- Anything new that counts rows of history, rather than reading the latest values, has to
  decide what happens when those rows are deleted, and add to the totals if the count must
  survive.
