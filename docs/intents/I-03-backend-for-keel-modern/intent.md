# I-03 — Fit the backend to the Keel Modern design

**Author:** Rohit · **Status:** Accepted · **Raised:** 2026-10-20 · **Accepted:** 2026-10-20

## Intent description

The approved design in `docs/design/` asks for things the backend does not do yet,
and in places for rules that differ from the ones it enforces.
`docs/design/contract-gaps.md` lists where. This intent closes those gaps before the
screens are built, so that no screen has to work around the API or fake what it
cannot get.

## Proposed outcome

Every screen in `docs/design/` can be built against the API as designed: notes on
objectives and on parked ideas, the Approved step in the parking lot, drifted
deviations without a reasoning, review answers in the shape the design asks for,
minutes over plan, and the time a draft was last saved.

## How we know it worked

Each gap in `contract-gaps.md` is either closed — in the contract and in the code —
or kept as it is, with the reason written down. No screen intent has to say "the API
cannot do this yet".

## Out of scope

The screens themselves. Branding Cognito's managed login. Field names that only need
mapping in the UI, and the design's shorter field limits, which the UI enforces.
