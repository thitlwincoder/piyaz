# Resilience / resume (Piyaz Cline plugin)

## Resume after compaction
When resuming a session, run `piyaz_activity project='...'
since='<last known instant>'` and follow the refs that moved. Then re-orient
with `piyaz_map view='critical_path' project='...'`.

## Idempotent re-runs
`piyaz_create` is keyed by `item.key`. On restart, reuse the same keys so the
batch surfaces `deduped` items instead of duplicating tasks. Never re-create
a task whose title already exists; search first with `piyaz_search`.

## Error handling
Translate `piyaz` errors to the user plainly: stale-write → re-read and
retry with fresh `ifUpdatedAt`; ref not found → search or ask; ambiguous ref
→ list candidates and let the user pick. Never silently skip a failed write.
