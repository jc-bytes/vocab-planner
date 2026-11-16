# Remaining review findings: resolution

Date: 2026-11-16  
Authorization: Continue until all remaining design-review findings are handled.  
Classification: PROPOSE FIX for R3, R4 and R5.  
Status: All three resolved in design. Implementation acceptance remains pending.  
Method: The same agent applied the EGM resolution process directly, without subagents, isolated reviewers or an independent Goldfish review.

## R3

The shared Crossword grid could allow an untimed correction to supply a letter to an unscored crossing word. Section 3 of the [design](activity-results.md) now specifies original-answer and correction phases. Untimed corrections begin only after all original word checks are locked. Edits made before then are timed. Explicit reveals save assistance for affected unscored crossings before displaying letters. Original letter snapshots, partial credit and combo outcomes remain immutable. Correction completion checks the final shared grid and can become unfinished if another correction breaks a required word.

The first checked CAT answer CXT keeps 2/3 credit. Fixing the crossing while still answering BAT consumes scored time; an explicit reveal instead makes BAT assisted. Untimed correction after both originals cannot improve either score or add a combo. Recovery preserves phase, originals, pending corrections and recorded time. No accuracy allocation or half-credit rule changes.

Acceptance remains pending through the real Crossword adapter and SQL validator. Exercise actual shared-cell edits, failed early-correction transitions, reveals, incomplete/duplicate checks, pause/crash/resume and broken crossing corrections. Assert immutable snapshots, correct assistance/combo and one puzzle timer.

## R4

The baseline assigned layout generation to a browser module without defining how a validated task reached publication. Section 1 now selects the authorized teacher browser as the generator, the existing revision-checked teacher-settings operation as publisher and SQL as independent validator. Authoring-mode reads provide the authoritative content/settings snapshot. Student preparation reads published tasks and returns TASK_NOT_PUBLISHED when a validated task is missing.

Candidate fields, source-version checks, seeds, generator version, dimensions, placements, candidate/request limits and all-word coverage are explicit. Publication atomically stores 1–4 complete validated variants. Task identity includes their complete geometry. Attempts deterministically select a registered variant using task/attempt IDs, retain it on resume and validate it at claim. Offline starts never create an unpublished layout. No new runtime service is introduced.

Acceptance remains pending through teacher generation/publication and both student puzzle paths, including offline reload and synchronization. Reject bad geometry, incomplete coverage, duplicate IDs, stale content/settings, malformed seeds, unauthorized publication and altered variant selection. Measure generation/request/state bounds and preserve the full selected set.

## R5

A score-only board revision could leave a tie cursor unchanged after a directory rename. Section 6 now binds paging to that revision and a digest of the full currently eligible projection, including current display/sort names. Reads compute eligibility, names, digest, token comparison, ranks, page and own entry in one SQL statement/snapshot. Changed inputs return BOARD_CHANGED before any continuation page is emitted; the UI refreshes all accumulated pages using current names. Current eligible-membership changes are included. No directory trigger or snapshot storage is required.

Acceptance remains pending against the actual SQL query/repository/view. Rename a student already shown past the cursor, rename an unseen student before it, change only display case and remove eligible membership. Check refresh behavior, focus, unchanged shared ranks and one appearance per student in uninterrupted traversal. Include full-projection digest computation in the existing 5,000-entry capacity gate.

## Checks and boundaries

A standalone Python model verified timed versus assisted CAT/BAT crossing outcomes, immutable original fractions/combo/time and rejection of early untimed corrections. A minimal geometry example checked complete CAT/BAT coverage and rejected missing words or inconsistent shared letters. A 101-entry tie model showed that renames in either direction, case-only changes and eligible removal change the digest, while unchanged paging preserves 101 unique students at rank 1. These small models illustrate the specified invariants. They do not implement the full generator, browser lifecycle, SQL validator, reward system or authenticated board.

Documentation checks cover synchronized final/draft copies, local references and anchors, Markdown structure, contract/manifest/verification agreement and current resolution status for all five findings. The original review digest and evidence remain in the [review report](review_report.md). Earlier R1/R2 records and audit entries preserve their historical status at the time they were written.

All five findings are now resolved in design. App implementation, real SQL/browser tests, concurrency/capacity measurements, authenticated staging, deployment and classroom acceptance remain pending. No application source or migration changed in these resolutions.
