# Sparks architecture remediation

This document tracks the incremental remediation started on 2026-08-24. Each task must leave the project in a tested, known-good state before the next task starts.

## Working rules

- Change one architectural concern at a time.
- Reinspect current callers, persistence, UI, and tests before editing.
- Preserve the existing game registry, lazy loading, repository seams, ownership tests, and security rules.
- Add a test when a change creates a new architectural contract.
- Remove compatibility code when its last caller is migrated.
- Do not reorganize folders unless the files are already changing for a behavioral reason.

## Baseline

| Item | Result |
| --- | --- |
| Date | 2026-08-24 |
| Starting commit | `490b36dc Simplify Sparks module ownership` |
| Remediation branch | `codex/sparks-architecture-remediation` |
| Scoped worktree | Clean before remediation |
| Full suite | `npm test` passed, including student shell, page smoke, and 13 HTML game sandbox checks |
| Student design audit | `npm run test:student-design` passed |
| Production build | `npm run desktop:build:web` passed in 7.83 seconds |
| Built-page smoke | `npm run test:ui:smoke:dist` passed all three routes against a fresh build |
| Dependency audit | `npm audit --audit-level=high` found 0 vulnerabilities |
| Import graph | Independent static check found 0 cycles across 215 first-party modules and 494 imports |
| Deployment size | 15.1 MB, under the 30.0 MB limit |
| Student entry | 263.88 kB raw, 68.28 kB gzip |
| Teacher entry | 165.81 kB raw, 45.35 kB gzip |
| Student CSS | 227.37 kB raw, 35.03 kB gzip |
| Teacher CSS | 149.89 kB raw, 24.40 kB gzip |
| Largest lazy feature | `reportGenerator`, 419.74 kB raw, 135.90 kB gzip |
| Student service worker | 17 files, 1,032,872 bytes precached |

The test suite intentionally exercises handled failure paths that log errors. These logs did not fail the baseline. No baseline failure requires remediation before architectural work begins.

## Task tracker

| Task | Status | Files changed | Verification | Decision or result |
| --- | --- | --- | --- | --- |
| 0. Establish baseline | DONE | `docs/architecture-remediation.md` | Full suite, design audit, production build, built-page smoke, dependency audit, independent review | Source and built application are green. Local Supabase checks remain unknown because Docker is unavailable. |
| 1. Activity catalog foundation | DONE | `js/student/studentActivityRegistry.js`, `js/teacherVocabularyEditorConstants.js`, registry tests | Registry, teacher-flow, 128 activity, build-efficiency tests; UI smoke; production build | Existing registry now owns teacher setting keys, labels, IDs, and order. Rewards stay server-authoritative. |
| 2. Activity catalog validation | DONE | Activity registry, registry contract tests, browser loader smoke, package script | Registry, loader smoke, teacher-flow, 128 activity, routing, build-efficiency tests; production build | Descriptors fail clearly when malformed. Chromium proves all 12 lazy loaders resolve their declared exports. |
| 3. Client/server activity parity | DONE | Migration parity test, registry package script | Registry, browser-loader, 128 activity, and security tests | Client IDs must match effective server access, flow-normalization, and required-activity filtering allowlists. Parsing fails on ambiguity, expressions, overload mismatch, or a later function drop. |
| 4. Migrate activities one at a time | IN PROGRESS | Activity registry, progress flow, launcher, focused tests | Eight activities migrated: full suite at Matching checkpoint; 135 activity, 72 progress, registry, security, routing, teacher-flow, build-efficiency tests; production builds | Matching, Flashcards, Quiz, Synonym & Antonym, Hangman, Scramble, Wordle, and Speed Match own lifecycle hooks. The other 4 activities retain existing launch branches until migrated separately. |
| 5. Consolidate duplicated configuration | TODO | | | |
| 6. Remove confirmed dead code | TODO | | | |
| 7. Investigate legacy quiz implementation | TODO | | | |
| 8. Introduce semantic design tokens | TODO | | | |
| 9. Migrate shared UI families | TODO | | | |
| 10. Reduce literal brand colors | TODO | | | |
| 11. Reduce unnecessary `!important` | TODO | | | |
| 12. Clean up owned inline styles | TODO | | | |
| 13. Create lightweight shared UI modules | TODO | | | |
| 14. Standardize application feedback | TODO | | | |
| 15. Map teacher feature dependencies | TODO | | | |
| 16. Convert one teacher feature | TODO | | | |
| 17. Validate the teacher feature pattern | TODO | | | |
| 18. Migrate remaining teacher features | TODO | | | |
| 19. Create a small page registry | TODO | | | |
| 20. Migrate teacher pages | TODO | | | |
| 21. Remove duplicated navigation wiring | TODO | | | |
| 22. Analyze broad forwarding interfaces | TODO | | | |
| 23. Reduce forwarding where a cohesive use case exists | TODO | | | |
| 24. Remove obsolete facade methods | TODO | | | |
| 25. Move legacy game adapters into descriptors | TODO | | | |
| 26. Define a host/game protocol | TODO | | | |
| 27. Add game registry contract tests | TODO | | | |
| 28. Review Supabase seams | TODO | | | |
| 29. Add interfaces only where justified | TODO | | | |
| 30. Consolidate environment authority | TODO | | | |
| 31. Correct stale documentation | TODO | | | |
| 32. Create `ARCHITECTURE.md` | TODO | | | |
| 33. Organize changed features gradually | TODO | | | |
| 34. Add delivery-size budgets | TODO | | | |
| 35. Preserve lazy loading | TODO | | | |
| 36. Remove code and CSS proven obsolete | TODO | | | |
| 37. Final architecture verification | TODO | | | |

## Change log

### Phase 0, baseline

- Confirmed a clean Sparks-scoped worktree on `main` before creating the remediation branch.
- Ran the complete existing automated suite and the separate student design audit.
- Rebuilt `dist-desktop` and recorded raw, gzip, deployment, and service-worker metrics.
- Ran the built-page smoke test against a fresh production build and found no high-severity dependency advisories.
- An independent import-graph check found no cycles across 215 first-party modules and 494 imports.
- An independent full-suite run saw one Vite development WebSocket refusal during the student-shell test. Its immediate isolated rerun passed. The primary full-suite run also passed. Treat this as a test-runner flake to watch, not an application baseline failure.
- Local Supabase acceptance, lint, and advisor checks remain unknown because Docker is not running. Authenticated production checks also remain outside this credential-free baseline. Existing source-level database, security, and repository tests passed.
- Chose the existing `studentActivityRegistry.js` as the activity-catalog seam. Creating a second catalog would introduce the duplicate authority this remediation is meant to remove.
- Confirmed that all 12 activity modules are dynamic Vite entries. Catalog work must preserve that build property.

### Task 1, activity catalog foundation

- Added each teacher activity setting key to the existing activity registry.
- Derived teacher activity options, IDs, labels, order, and setting-key lookup from that registry. The duplicate 12-entry teacher list is gone.
- Kept launch factories, activity flow defaults, routes, persistence, and SQL unchanged.
- Did not move the unused client XP map into the registry. Supabase calculates rewards and the client displays the returned total delta, so copying the map would create a false reward authority.
- Preserved lazy loading. The production manifest still keeps teacher feature imports separate and the build stays at 15.1 MB.
- Independent review found zero cycles across 288 first-party JavaScript files and 523 resolved imports. The teacher entry kept its five existing lazy features and gained no eager activity implementation imports.

### Task 2, activity catalog validation

- Added a pure registry definition function that clones, defaults, validates, and freezes activity descriptors.
- Rejects duplicate IDs and setting keys, missing copy or icons, invalid loaders and export names, unsupported routing, malformed policy values, and non-function activity lifecycle hooks.
- Rejects client `xp` fields, including `xp: undefined`, because rewards belong to the server.
- Added an explicit persisted ID-to-setting-key compatibility fixture. A derived projection alone would not detect an accidental stored-key rename.
- Added a Chromium smoke test that imports every lazy activity module and verifies its declared constructor. A Node-only test was rejected because real activity imports initialize browser-owned notification code.
- Preserved the 15.1 MB deployment limit and lazy feature build checks.

### Task 3, client/server activity parity

- Added a migration-order parity test for all three server-owned vocabulary activity allowlists.
- Targets the effective `private.assert_student_activity_access(uuid, text, text, text)`, `private.normalize_vocabulary_activity_flow()`, and `private.required_vocabulary_activities(public.vocabularies)` definitions by signature.
- Requires the server access list, server flow list, required-activity filter, and client registry to contain the same 12 IDs.
- Rejects ambiguous arrays, computed SQL expressions, duplicate IDs, overload mismatch, and a later drop of the selected function.
- Keeps classroom activity types and the weekly Spark reading flow out of this contract because they belong to separate systems.
- Does not compare XP. Reward amounts remain a separate server-only policy and the client registry rejects XP fields.
- An architecture review found the initially omitted required-activity filter before Task 4 was committed. Extending the contract prevents a newly registered activity from being silently removed when a teacher configures it as required.

### Task 4a, migrate Matching

- Added Matching eligibility, word preparation, and construction hooks to its catalog descriptor.
- The progress-flow eligibility check and launcher now dispatch to those hooks. Removed only the Matching cases from their legacy switches; all other activities remain unchanged.
- Kept the descriptor isolated from `StudentActivities`, `StudentManager`, persistence, and the activity implementation. The launcher passes narrow callbacks and the already lazy-loaded `ActivityClass`.
- Preserved teacher setting limits, least-practiced selection, saved word order recovery, constructor arguments, stale-state retry, callback guards, and coverage recording after successful construction.
- Added descriptor, hook-sequencing, and failed-constructor retry contracts. Coverage is proven to run exactly once after a successful retry.
- The production manifest still marks `js/activities/matching.js` as a dynamic entry. The student entry decreased from 263.88 kB raw and 68.28 kB gzip at baseline to 258.88 kB raw and 66.58 kB gzip; deployment remains 15.1 MB.
- Verification: the complete suite, 131 focused student activity tests, the 12-module browser loader smoke, production build, and built-page smoke all passed. The full suite includes routing, teacher activity flow, build ownership, 9-width student-shell regression, three-page UI smoke, and 13 sandboxed HTML games.

### Task 4b, migrate Flashcards

- Added Flashcards eligibility, ordered word limiting, and construction to its descriptor. Removed only its eligibility and launcher switch cases.
- Reused the constructor factory shared with Matching because both receive the same five arguments. Preparation remains activity-specific: Flashcards keeps source order and never calls coverage prioritization or host word-key restoration.
- Passed `playableWords` into the narrow preparation context. No descriptor receives a manager, repository, persistence service, or activity implementation import.
- Preserved mastery-v3 state, saved-state retry, first-attempt evidence, teacher-configured limits, `nonReplayable: true`, and `tracksCoverage: false`. A runtime contract proves Flashcards cannot record practice coverage through this path.
- Left the menu and persistence non-replayable lists unchanged for Task 5. Moving those authorities during a launch migration would combine separate concerns.
- Verification: 132 activity tests, 72 progress tests, registry browser smoke, routing, teacher flow, build-efficiency tests, and production build passed. The manifest keeps `js/activities/flashcards.js` as a dynamic entry; deployment remains 15.1 MB and the student entry is 258.81 kB raw, 66.56 kB gzip.

### Task 4c, migrate Quiz

- Added modern student Quiz eligibility, prioritized state-restorable word preparation, and construction to its descriptor. Removed only the Quiz cases from the launcher and progress-flow switches.
- Reused the word-and-definition eligibility predicate, the standard word-list constructor, and a focused restorable-priority preparation hook. This is shared behavior, not a wrapper around Quiz internals.
- Preserved the configured Quiz limit, saved `wordKeys` order, least-practiced fallback, constructor state, post-construction coverage, 80 percent mastery policy, verified attempt flow, and server-owned rewards.
- Confirmed the modern lazy `js/activities/quiz.js` activity is separate from the teacher legacy quiz subsystem. Task 7 must trace CSS and runtime reachability rather than removing files or selectors based only on the word `quiz`.
- Verification: registry and 12-module browser loader, 132 activity, 72 progress, 14 security, and 8 build-efficiency tests passed. Production build passed with Quiz still dynamic, a 15.1 MB deployment, and a 258.65 kB raw, 66.52 kB gzip student entry.

### Task 4 checkpoint correction

- The three-activity architecture review found that saved word restoration scans the full current vocabulary. Matching and Quiz could therefore restore stale words that their descriptors now reject as unplayable.
- Matching and Quiz preparation now supplies the same eligibility predicate to state restoration. Valid saved order is preserved; an invalid saved subset falls back to the normal prioritized playable words.
- Added a clear lifecycle contract error when a descriptor preparation hook does not return `{ words: Array }`. This replaces an incidental constructor or coverage failure with an actionable activity ID and contract message.
- Confirmed the current `prepared.words` coverage default remains correct only for ordinary word-list activities. Word Search and Crossword require an optional coverage selector before their migrations because they record constructor-filtered words.
- Verification: registry browser smoke, 133 activity, 14 routing, package ownership, and 8 build-efficiency tests passed. Production build remains 15.1 MB.

### Task 4d, migrate Synonym & Antonym

- Added Synonym & Antonym eligibility, filtered prioritized restoration, and construction to its descriptor. Removed only its launcher and progress-flow switch cases.
- Preserved the `synonymAntonym` teacher setting, least-practiced selection, saved word order, constructor state, post-construction coverage, multiple-choice evidence, server mastery rules, and report mapping.
- Applied the checkpoint eligibility rule to stale restoration: a saved word must still have a nonblank label and at least one synonym or antonym. Valid saved state is unchanged; invalid state falls back to prioritized eligible words.
- Did not change the existing sparse-data behavior. Vocabulary with too few distinct distractors can still reach the activity's owned “Not enough data” state; changing that would be a product decision rather than an architecture migration.
- Verification: registry browser smoke, 133 activity, 72 progress, 14 security, and 8 build-efficiency tests passed. The activity remains a dynamic chunk, deployment remains 15.1 MB, and the student entry is 258.34 kB raw, 66.47 kB gzip.

### Task 4e, migrate Hangman

- Added Hangman nonblank-word eligibility, prioritized limiting, and standard construction to its descriptor. Removed only its launcher and progress-flow switch cases.
- Preserved source eligibility, the `hangman` setting, least-practiced selection, constructor state, prepared-word coverage, internal shuffle, and Hangman's owned initial/local state restoration.
- Did not route Hangman through host word-key restoration. It intentionally restores its own `shuffledWords`, so adding a second restoration system would change behavior and ownership.
- Recorded an existing reliability edge for later focused work: Hangman's local storage key uses the prepared word count, while reset logic appears to use the full vocabulary count. This migration does not silently alter persisted-state cleanup.
- Verification: registry browser smoke, 133 activity, 72 progress, and 8 build-efficiency tests passed. Production build keeps Hangman dynamic, deployment remains 15.1 MB, and the student entry is 258.22 kB raw, 66.46 kB gzip.

### Task 4f, migrate Word Scramble

- Added Scramble to the shared nonblank-word, prioritized-limit, standard-constructor lifecycle. Removed only its launcher and progress-flow cases.
- Preserved the `scramble` setting, least-practiced selection, prepared-word coverage, constructor state, internal shuffled order, versioned state validation, edit-distance feedback, and server evidence rules.
- Reused the exact Hangman lifecycle hooks because their host behavior is identical. Scramble's game logic and persistence remain owned by `ScrambleActivity`.
- Recorded a parallel existing cleanup edge: Scramble's modern local key includes the first selected word and prepared count, while generic reset logic appears to remove an older count-only key. This requires a separate persistence test and is not silently changed here.
- Verification: registry browser smoke, the Scramble and runtime/security activity tests, 72 progress tests, and 8 build-efficiency tests passed. Production build keeps Scramble dynamic, deployment remains 15.1 MB, and the student entry is 258.09 kB raw, 66.43 kB gzip.

### Task 4g, migrate Wordle

- Added Wordle's alphabetic-label eligibility, filtered prioritized restoration, and standard construction to its descriptor. Removed only its launcher and progress-flow switch cases.
- Preserved spaces and hyphens, the 3-to-10 letter boundary after punctuation removal, the `wordle` teacher limit, least-practiced selection, saved word order, constructor state, and post-construction coverage.
- State restoration now uses the same descriptor eligibility predicate as fallback selection, so stale saved words cannot bypass Wordle's character and length rules.
- Kept Wordle's verified-attempt evidence, mastery rules, clues, keyboard behavior, and persistence implementation unchanged.
- Recorded existing persistence debt for a separate focused task: Wordle's local key uses the selected word count, while generic reset uses the full vocabulary count. Local fallback can also restore counters after incomplete word-key remapping. Neither behavior was silently changed during this architecture migration.
- Verification: registry browser smoke loaded all 12 constructors; 103 focused activity, progress, runtime, and security tests; 8 build-efficiency tests; and the production build passed. Wordle remains a dynamic chunk, deployment remains 15.1 MB, and the student entry is 257.60 kB raw, 66.31 kB gzip.

### Task 4 lifecycle contract hardening

- The second architecture checkpoint found that malformed descriptor output was treated like stale student state. The recovery path would reset saved progress and retry even though clearing state cannot repair a developer contract error.
- Descriptor preparation and factory-output failures now carry an explicit `ACTIVITY_DESCRIPTOR_CONTRACT` code. State recovery rethrows these failures without resetting or retrying, allowing the outer activity error boundary to fail safely while preserving progress.
- Factory hooks must return an activity instance before coverage is recorded or the timer can start. Registry validation also requires `isPlayable` whenever a descriptor owns `prepare` and `create`, preventing a registered lifecycle that the availability gate cannot reach.
- Added contracts proving malformed preparation preserves saved state, null factory output cannot record coverage, and incomplete lifecycle registration fails during definition.
- Verification: 90 focused registry/runtime tests, 135 student activity tests, registry browser smoke for all 12 activity constructors, 8 build-efficiency tests, and the production build passed. Deployment remains 15.1 MB and activity modules remain lazy chunks.

### Task 4h, migrate Speed Match

- Added Speed Match's nonblank word-and-definition eligibility, prioritized limiting, and standard construction to its descriptor. Removed only its launcher and progress-flow switch cases.
- Preserved the `speedMatch` teacher limit, least-practiced selection, constructor state, high-score behavior, verified attempt rules, minimum active-time requirement, post-construction coverage, and lazy module version suffix.
- Reused existing eligibility, preparation, and construction hooks because Speed Match has the same host lifecycle as the ordinary defined-word activities. Its animation loop, scoring, lives, feedback, and cleanup remain activity-owned.
- Recorded separate persistence debt: local high scores use only the selected word count, which can collide across units, and generic reset uses the full vocabulary count, which can miss limited or filtered selections. The existing tie copy can also announce a new high score without a strictly higher score. These product-level reliability fixes are not mixed into the descriptor migration.
- Verification: registry browser smoke, 135 student activity tests, 72 progress tests, 14 routing tests, 8 build-efficiency tests, and the production build passed. Speed Match remains a dynamic chunk, deployment remains 15.1 MB, and the student entry is 257.64 kB raw, 66.37 kB gzip.

## Remaining work

Task 4 continues one descriptor at a time. Eight activities are complete. Word Search is intentionally deferred until the optional instance-based coverage selector is introduced; simpler word-list activities continue first.
