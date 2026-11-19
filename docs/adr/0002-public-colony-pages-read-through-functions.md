---
status: accepted
---

# Public colony pages read through dedicated functions, not opened tables

A player can make a colony public, so anyone can open a read-only page of it from the live
colonies page. That page reads its data only through dedicated database functions that take the
colony's opaque public key and return just the public fields. Every table stays readable by its
owner alone, as before.

## Why

A colony's rows sit next to things that must never be public: the token inside the adapter links
and mod address, which lets anyone send data to the colony, and the adapter names, which describe
how the player built their base. Opening the tables to everyone for public colonies would put
those one policy mistake or one new column away from leaking. A function hands out a fixed list
of fields, so adding a column to a table cannot expose it by accident.

## Considered

- **Row-level policies that let anyone read rows of public colonies.** Less to write, and the
  public page could reuse the owner's queries unchanged. Rejected for the reason above.

## Consequences

- Each thing the public page shows needs its own function, or a field added to one, and a
  migration. The public page cannot simply reuse the owner page's data hooks.
- The public page never learns a colony's real id, only its public key, handle and name.
- The public view shows durations in game days and no real clock times, so the functions leave
  timestamps out except "last heard from".
