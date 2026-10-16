---
name: piyaz
description: >
  Use when the user wants to plan, decompose, track, or resume a multi-task
  project in Piyaz: scoping a new idea, onboarding an existing workspace,
  asking what to work on / what's next / what's blocked / where they left off,
  reporting task completion, dispatching work in parallel, or planning a draft
  task. Also when the user mentions Piyaz by name or references a task by its
  ref (e.g. WYN-9, KRN-153, PXD-31). Works for any project domain (code or
  data). Do not invoke for one-off coding questions, single-file edits,
  debugging a specific error, generic todos, or scheduling.
---

# Piyaz: Agentic Project Management for Software Projects

Piyaz tracks tasks, dependencies, decisions, and implementation records across
sessions and across team members so coding agents and engineers can hand work
to each other without dropping context. The Piyaz Cline plugin exposes the
Piyaz MCP server as Cline tools; you provide the judgment.

**Read `references/conventions.md` once at session start, and refresh it
mid-session whenever you drift or are about to write a task / edge.** Four
reference files sit in `references/` next to this SKILL.md:

| File | Read when | Covers |
|------|-----------|--------|
| `references/conventions.md` | Session start; whenever you sense drift | Grounding Iron Law, task refs, asking the user |
| `references/artifacts.md` | About to write or refine any task/edge | Titles, descriptions, ACs, edges, categories, tone |
| `references/lifecycle.md` | Before any status transition | Status lifecycle, completion protocol |
| `references/resilience.md` | Session start (resume); after compaction | Activity-based resume, idempotent re-runs |

## The tools

All calls go to the Piyaz MCP server through the Cline plugin; authenticate
with `cline plugin install` or pass an access token in the plugin config.

- `piyaz_workspace action='whoami'` / `'teams'` / `'projects'` / `'members'`
  — session start: who you are, your teams, your projects.
- `piyaz_search` — universal task finder. Cross-project by default; pass
  `project`, `query`, `status`, `priority`, `assignee`, `category`, `tags`.
  Returns a paginated page; use `cursor` for the next page.
- `piyaz_get task='WYN-42'` or `project='WYN'` — read one task (lens:
  summary/working/agent/planning/review/record) or one project (view:
  meta/overview). Pass `fields=[...]` for a slim raw read that returns
  `updatedAt` for compare-and-swap edits.
- `piyaz_map view='ready'|'blocked'|'plannable'|'critical_path'` (project
  scoped) or `view='downstream'|'neighbors'` (task scoped, hops=1|2).
- `piyaz_create project='WYN' items=[...] edges=[...]` — idempotent batch
  task creation keyed by `key` so restarted runs never duplicate tasks.
- `piyaz_edit task='WYN-42' ifUpdatedAt='...' operations=[...]` — atomic
  ordered edits; use `ifUpdatedAt` from a prior `piyaz_get fields=...`.
- `piyaz_link action='create'|'update'|'remove' source=... target=...` —
  depends_on / relates_to edges with a substantive note.
- `piyaz_activity project=...|task=...|note=... since='2026-...Z'` — what
  changed; the resume-after-compaction tool.
- `piyaz_note action='create'|'read'|'update'|'search'` — notes and folders.

## Standard workflows

### Session start / orientation
1. `piyaz_workspace action='projects'` (progress per project).
2. Ask the user which project, or pick the one they named.
3. `piyaz_map view='critical_path' project='...'` — the bottleneck. Then
   `view='ready'` (can start now) and `view='blocked'` (stuck and why).

### "What should I work on next"
1. `piyaz_map view='ready' project='...'`.
2. If nothing, `view='plannable'` (drafts ready to plan).
3. Pick the top item, `piyaz_get task='...' lens='working'`, then do the work.

### Report completion
1. `piyaz_edit task='...' operations=[{ set status 'done' }]` (with
   ifUpdatedAt), linking the PR URL where relevant.
2. `piyaz_link action='create' type='depends_on'` for any newly unblocked
   dependents, then `piyaz_map view='ready'` to show what's next.

### Continue / resume
1. `piyaz_activity project='...' since='<last known instant>'` — newest first.
2. Follow the refs that moved; re-read with `piyaz_get`.

## Rules

- **Iron Law of grounding:** never invent a ref, id, or status. Resolve refs
  via `piyaz_search` or `piyaz_workspace` before writing.
- **One scope per call:** `piyaz_activity` takes exactly one of
  project/task/note. `piyaz_get` takes exactly one of task/project.
- **Writes need fresh reads:** always pass `ifUpdatedAt` from the most recent
  `piyaz_get fields=...` on edits.
- **Edges need substance:** `note` on `piyaz_link` / `piyaz_create` edges
  must explain *why* the dependency exists; no placeholders.
- **Create is idempotent:** reuse the same `key` per item across retries.

## Tone

Engineering writing, not AI filler: subject-verb-object, active voice, no
em dashes, no hedging openers, no marketing words, one idea per sentence.
See `references/artifacts.md` §6.
