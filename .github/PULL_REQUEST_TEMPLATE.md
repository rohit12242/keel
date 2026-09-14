<!--
  Keel PR template. Keep it honest — this repository is public.
  See docs/contributing.md and docs/definition-of-done.md.
-->

## Story

<!-- The sprint id this PR closes or advances, e.g. W3-05. Required. -->

Story: W3-

## What this changes

<!-- One or two sentences. Why, not just what. -->

## Review gate

<!-- Tick what applies. Not every PR touches code. -->

- [ ] The named output exists and can be pointed at.
- [ ] It can be explained unprompted, including one thing worth changing.
- [ ] Anything revealed is written where it would be looked for — ADR, gap list, ERD or contract.

If it touched code:

- [ ] The pipeline is green — on the pipeline, not on a laptop.
- [ ] No NFR was quietly broken (did this store an aggregate, or a date that could move?).
- [ ] The failure path exists, not just the happy one.
- [ ] The API contract changed in the same commit as the endpoint, if an endpoint changed.
