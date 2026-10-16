# Conventions (Piyaz Cline plugin)

## §1 Iron Law of grounding
Never invent a task ref, project id, user id, status, or edge. Every id you
write must come from a prior read: `piyaz_search`, `piyaz_workspace
action='projects'`, `piyaz_get`, or `piyaz_map`. When a ref is ambiguous or
missing, ask the user rather than guessing.

## §2 Task refs
Tasks are addressed by ref (`WYN-42`) or UUID. Project-scoped tools take a
project identifier (`WYN`) or UUID. `piyaz_activity` note scope accepts a
slug (`WYN-N12`) but only together with `project`.

## §3 Exactly-one-scope rules
- `piyaz_get`: pass exactly one of `task` or `project`.
- `piyaz_activity`: pass exactly one of `project`, `task`, or `note`
  (project may accompany a slug-form note).
- `piyaz_map`: `ready`/`blocked`/`plannable`/`critical_path` require
  `project`; `downstream`/`neighbors` require `task`.

## §4 Writes need fresh reads
`piyaz_edit` and note updates require `ifUpdatedAt` (the `updatedAt` from a
prior `piyaz_get fields=[...]`). Re-read before retrying on a stale-write
error.

## §5 Ask the user
When intent is unclear (which project, what priority, whether to mark done),
ask one focused question. Do not interpret hedging as approval.
