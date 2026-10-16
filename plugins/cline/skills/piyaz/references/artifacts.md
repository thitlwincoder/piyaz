# Artifact rules (Piyaz Cline plugin)

Quality bar for everything written into Piyaz: titles, descriptions,
acceptance criteria, decisions, edges, tags, categories, and markdown tone.

## §1 Task artifact
**Title:** verb + noun, imperative. GOOD: "Implement JWT auth". BAD: "Auth".

**Description:** 2 to 4 sentences (up to 6 to 8 for complex tasks), enough on
its own to start the work. Cover what it does, who it serves, where it lives.
No single-sentence descriptions; no speculation.

**Acceptance criteria:** checkable lines, one per criterion.

## §2 Edge types
- `depends_on`: target must finish before source can start.
- `relates_to`: informal relationship.
Every edge needs a substantive `note` explaining why.

## §3 Categories
Pick from the project's category set (fetch via `piyaz_get project=...`
view='meta' or workspace categories). Forbidden: vague buckets like "misc" or
"other". When in doubt, ask.

## §4 Markdown tone
Engineering writing. Active voice, subject-verb-object, one idea per sentence.
Do not use: em dashes, hedging openers ("I think", "perhaps"), enthusiasm
("Great question"), throat-clearing, marketing words ("comprehensive",
"seamless"), or performative summaries ("I hope this helps!").
