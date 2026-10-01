# Review instructions

## Passes
Tag each finding with its pass:
- Bugs: logic errors, edge cases, regressions
- Security: unvalidated input, injection, missing auth, secrets in code or logs
- Spec: change matches the spec and plan linked in the PR; flag anything missing or extra
- Design: follows the design principles in CLAUDE.md; flag layer violations, tight coupling, logic in the wrong place
- Tests: new behavior is tested; no test deleted or weakened

## Severity
Important = breaks behavior, leaks data, misses the spec, or breaks a design principle. Style and naming are nits.
Report at most 5 nits; summarize the rest as a count.

## Skip
Generated files, lockfiles, anything CI already checks.

## Keel rules
<!-- Add one line when a review catches the same mistake twice -->
