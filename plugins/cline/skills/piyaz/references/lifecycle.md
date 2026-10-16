# Status lifecycle (Piyaz Cline plugin)

Task statuses: draft → planned → in_progress → in_review → done, with
cancelled as a terminal off-ramp.

Agents take work to `in_review`; they never self-promote to `done`. A human
on the loop (or the user) flips `in_review → done` after reviewing the PR or
output.

Before any transition: `piyaz_get task='...' lens='working'` for the fresh
`updatedAt`, then `piyaz_edit task='...' ifUpdatedAt='...'
operations=[{ set status '<next>' }]`. Report what changed and what's next.

Blocked work stays blocked until its unsatisfied prerequisites finish; do not
manually unblock a task whose dependencies are incomplete.
