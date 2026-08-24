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
| 4. Migrate activities one at a time | DONE | Activity registry, progress flow, launcher, focused tests | All focused suites, the complete test suite, registry browser smoke, production build, and independent review pass | All 12 activities own eligibility, preparation, and construction through the registry. The legacy launch and eligibility switches are gone. Illustration keeps a narrow feature context and protected draft-reset policy. |
| 5. Consolidate duplicated configuration | DONE | Activity/flow policy, catalog tooling, economy and duration config, shared progress/config values | Complete suite, focused config suites, UI/regression smoke, production builds, independent review | Genuine client authorities are centralized; server security remains independent with parity contracts. Unproven product destinations and later-phase navigation/auth policy are documented rather than guessed. |
| 6. Remove confirmed dead code | DONE | XP mirror; save stubs; orphan assets; unused utilities/barrel exports; dead student/teacher CSS | Complete suite, focused ownership suites, UI/regression smoke, production builds, independent review | Removed only code with complete caller/import evidence; preserved uncertain data-driven and source assets. |
| 7. Investigate legacy quiz implementation | DONE | Import ownership; legacy module/modal/listeners/proxies/state/styles | Complete suite, focused quiz/vocabulary/architecture/accessibility tests, source and built UI smoke, production build, independent review | Retired unreachable preview; preserved routed/lazy Quiz Maker and independently registered student Quiz. |
| 8. Introduce semantic design tokens | DONE | Central theme authority, scoped student variant, compatibility aliases, entry loading contract | Complete suite, token/design-system contracts, 9-width student regression, three-page UI smoke, production build, independent review | Existing values remain visually equivalent; app theme authority is centralized without coupling isolated games or lazy feature styles. |
| 9. Migrate shared UI families | DONE | Buttons; inputs/form controls; cards; dialogs; navigation; feedback; containers; typography ownership | Complete suite, UI-family contracts, style comparisons, 9-width regression, source/built UI smoke, production builds, independent review | Repeated shared UI foundations are centralized while page-responsive and feature-owned behavior remains local. Existing typography authority now exclusively owns font delivery. |
| 10. Reduce literal brand colors | DONE | Theme status roles; migrated shared styles; app-shell identity effects; known UI fallbacks; contract test | Complete suite, focused theme/UI contracts, 9-width regression, source/built smoke, production build, independent computed/pixel review | Canonical identity/status hues in migrated areas now derive from semantic tokens. Contextual game and feature palettes remain owned locally. |
| 11. Reduce unnecessary `!important` | IN PROGRESS | Quiz print reset; specificity guard | Focused specificity/build checks; production build; built smoke | Shared foundations require none. Quiz print reset now uses normal cascade; inline-dependent and responsive-shell declarations remain under review. |
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

### Task 4i, migrate Fill in Blank

- Added Fill in Blank's nonblank word-and-example eligibility, prioritized limiting, and standard construction to its descriptor. Removed only its launcher and progress-flow switch cases.
- Removed the launcher's redundant example filter. The shared playable-word input has already applied the same complete descriptor predicate before prioritization, so selected words and coverage remain unchanged.
- Preserved the `fillInBlank` teacher limit, least-practiced selection, constructor state, internal shuffle, clue rotation, retry behavior, score evidence, server verification, and post-construction coverage.
- Recorded separate latent reliability debt for focused tests: restored shuffled words and counters are weakly validated, regex metacharacters in a word are not escaped when building the blank, and local persistence uses inconsistent trailing-space keys. The checked catalog currently has valid examples containing their words and no regex-metacharacter terms, so this migration does not change product behavior.
- Verification: registry browser smoke, 135 student activity tests, 72 progress tests, 14 security tests, 8 build-efficiency tests, and the production build passed. Fill in Blank remains a dynamic chunk, deployment remains 15.1 MB, and the student entry is 257.41 kB raw, 66.32 kB gzip.

### Task 4 coverage selector contract

- Added one optional lifecycle hook for activities whose constructor filters the prepared input: `selectCoverageWords({ instance, prepared })`. Ordinary activities keep the existing `prepared.words` default.
- Registry validation rejects malformed selectors, selectors without a registered lifecycle, and selectors on activities that disable coverage.
- Runtime validation requires the selector to return an array. Contract failure destroys the just-created instance, records no coverage, preserves saved state through the existing non-recoverable descriptor error path, and never starts the activity timer.
- Added contracts for the unchanged default, constructor-selected coverage, invalid selector cleanup, and registry definition failures.
- Verification: 95 focused registry/runtime tests, registry browser smoke, 137 student activity tests, 8 build-efficiency tests, and the production build passed. Deployment remains 15.1 MB and activity modules remain lazy chunks.

### Task 4j, migrate Word Search

- Added Word Search eligibility, filtered prioritized restoration, special constructor mapping, and constructor-selected coverage to its descriptor. Removed only its launcher and progress-flow switch cases.
- Passed two narrow host inputs through the registered lifecycle: the stable vocabulary persistence ID and a guarded new-round callback. The descriptor maps them to Word Search's existing constructor without receiving a manager, repository, route object, or persistence service.
- Preserved the `wordSearch` limit, least-practiced selection, saved word order, grid persistence, current-launch guard, explicit state reset before a new puzzle, lazy loading, and post-construction coverage of only words actually placed in the grid.
- Unified fallback selection and saved-state restoration on the descriptor's trimmed four-character eligibility predicate, preventing stale whitespace-padded terms from bypassing the availability rule.
- Verification: registry browser smoke, 6 Word Search ownership/behavior tests, 138 student activity tests, 72 progress tests, 14 routing tests, 8 build-efficiency tests, and the production build passed. Word Search remains a dynamic chunk, deployment remains 15.1 MB, and the student entry is 257.80 kB raw, 66.43 kB gzip.

### Task 4k, migrate Crossword

- Added Crossword's ASCII-letter word-and-definition eligibility, prioritized limiting, standard construction, and placed-word coverage to its descriptor. Removed only its launcher and progress-flow switch cases.
- Preserved the `crossword` teacher limit, least-practiced selection, internal grid placement, constructor-owned state restoration, hint and score evidence, cleanup, and coverage of only the subset placed in the grid.
- Reused the standard constructor factory and prioritized preparation because Crossword's only special host behavior is its post-construction coverage source. The proven optional selector owns that difference without a Crossword-specific launcher branch.
- Recorded separate persistence debt: Crossword's local key uses only the selected word count while generic reset uses the full vocabulary count, so limited or filtered units can retain fallback state and equal-sized units can collide. This migration keeps the existing cloud/local behavior unchanged.
- Verification: registry browser smoke, 138 student activity tests including 11 Crossword behavior tests, 72 progress tests, 8 build-efficiency tests, and the production build passed. Crossword remains a dynamic chunk, deployment remains 15.1 MB, and the student entry is 257.55 kB raw, 66.33 kB gzip.

### Task 4l, migrate Illustration and close activity migration

- Added Illustration's nonblank eligibility, exact three-mode Word Hunt selection policy, special constructor mapping, and protected startup-reset policy to its descriptor.
- The launcher now builds one explicit Word Hunt feature context containing only source data and required callbacks. The registry receives no manager, repository, raw database client, or route implementation.
- Preserved raw-word selection before eligibility filtering, required-unit selection, custom flags including the legacy key, fallback limiting, owner-scoped draft state, image upload/load, PDF export, research context, and deep-link word changes.
- Replaced the hardcoded Illustration recovery exception with `allowStartupStateReset: false`. Flashcards remains non-replayable but retains ordinary stale-state recovery, so the two policies are not conflated.
- Removed the obsolete launch switch, eligibility switch, and `getWordHuntWords` forwarding path. Production registry contracts now require every activity to own eligibility, preparation, and construction.
- Independent review found that the generic validator still permitted descriptors without the now-mandatory lifecycle. Tightened registration to require `isPlayable`, `prepare`, and `create`, so incomplete descriptors fail before reaching a student session.
- Recorded separate reliability debt: Illustration starts its asynchronous `init()` from the constructor without awaiting or retaining the promise. Startup timing and error semantics are unchanged during this architecture migration.
- Verification: 18 registry contracts plus the 12-module browser smoke, 139 student activity tests, 9 Illustration tests, 14 routing tests, 5 report tests, 3 student API tests, 8 build-efficiency tests, the complete `npm test` suite, and the production build passed. Illustration remains a dynamic chunk, deployment remains 15.1 MB, and the student entry is 257.14 kB raw, 66.21 kB gzip.

## Remaining work

Task 4 is complete. Task 5 will verify and consolidate only duplicated configuration that still has more than one genuine authority.

### Task 5a, consume activity descriptor policies

- Removed hardcoded Flashcards/Illustration replay and coverage lists from autosave and the activity menu.
- Coverage aggregation now derives participating activity IDs from descriptors, and activity headers use descriptor titles instead of a second 12-item label map.
- Added an ownership contract preventing the known policy lists and title map from returning outside the catalog.
- Verification: 19 registry/parity contracts plus all 12 browser loaders, 139 student activity tests, 72 student progress tests, and 8 build-efficiency tests passed.

Task 5 remains in progress. The next verified duplicate is the activity-flow policy copied across student, teacher, and catalog tooling.

### Task 5b, centralize activity-flow and catalog policy

- Added a narrow shared activity-flow policy for purpose defaults, the ten-step practice rotation, replacement order, and stable rotation indexing.
- Student and teacher flow owners retain their existing public methods but delegate policy calculation to the shared pure functions; the duplicated arrays and algorithms were removed.
- Catalog tooling now derives IDs and word eligibility from the authoritative activity registry instead of maintaining a second 12-item list and eligibility switch.
- Server access remains independently authoritative. A parity contract now also compares the active SQL summative fallback and practice rotation with the shared client policy.
- Verification: all 146 vocabulary units and catalog SQL generation, 3 teacher flow tests, 20 registry/server parity contracts plus all 12 browser loaders, 139 student activity tests, 8 build-efficiency tests, and the production build passed. Activity modules remain lazy chunks; deployment is 15.1 MB and the student entry is 255.78 kB raw, 65.78 kB gzip.

Task 5 remains in progress. Next is the verified arcade/gamification configuration split, including removal of controls that currently save values no runtime uses.

### Task 5c, separate Arcade economy from activity rewards

- Added a focused gamification configuration module owning client setting keys, the Arcade exchange-rate default/range, and activity reward fallbacks.
- Student and teacher Arcade settings now normalize the displayed price to the server's `1..10000` range. SQL remains independently authoritative, with a parity contract for its fallback and clamp.
- Removed the global completion/progress controls because their saved values were never used by activity rewards. Per-vocabulary and per-activity reward controls remain unchanged and now share one resolver with autosave.
- Removed the vocabulary editor's second exchange-rate control because it wrote `activitySettings.exchangeRate`, which no runtime consumed.
- Verification: 15 student game tests, 73 student progress/security tests, 139 student activity tests, 11 teacher data tests, 4 teacher activity-flow tests, three-page UI smoke, 8 build-efficiency tests, and the production build passed. Deployment remains 15.1 MB and the student entry is 255.52 kB raw, 65.74 kB gzip.

Task 5 remains in progress. Next are smaller verified shared-data and environment authorities; installer destination remains deferred because the repository does not prove the release URL.

### Task 5d, centralize the student coin-data default

- Moved the initial coin-wallet shape to one neutral progress defaults module used by Supabase mapping, authentication fallback records, and student progress initialization.
- Kept synchronization timing constants in the student progress feature; they are behavior owned by that feature, not shared data shape.
- Verification: 12 repository tests, 73 student progress tests, 7 student authentication tests, and 8 build-efficiency tests passed.

Task 5 remains in progress. Next is Supabase build/runtime configuration authority, followed by remaining proven UI metadata and Arcade-duration copies.

### Task 5e, share Supabase build/runtime validation

- Extracted a pure Supabase configuration validator and reused it in runtime checks and Vite's build gate. The production project URL now has one client/build authority.
- Added contract coverage for missing values, placeholders, publishable and legacy anonymous keys, browser overrides, and refusal to use production from development without the explicit override.
- Replaced live-looking values in `.env.example` with onboarding placeholders. CI secrets and ignored local environment files remain deployment authorities.
- Kept service-role secrets, local Supabase CLI identity, and server security enforcement separate as required boundaries.
- Verification: 10 student authentication/config tests, 14 security-hardening tests, and the production build passed. Deployment remains 15.1 MB and the student entry is 255.46 kB raw, 65.73 kB gzip.

Task 5 remains in progress. Next is the student Arcade-duration policy and stale static game metadata.

### Task 5f, centralize Arcade duration policy

- Added one student Arcade policy for the billed minute, formative-pass window, and maximum queued session.
- Replaced duration literals in local storage, session clamping, game lifecycle, listeners, autosave feedback, and dynamically rendered Arcade copy. Static HTML now shows a neutral loading message until runtime policy is available.
- Kept the server allowance independently authoritative and extended its parity test to the shared client duration.
- Verification: 15 student game tests, 74 student progress/security tests, 139 student activity tests, 5 listener tests, three-page UI smoke, 8 build-efficiency tests, and the production build passed. Games remain lazy in `studentGames`; deployment remains 15.1 MB and the student entry is 242.48 kB raw, 62.17 kB gzip.

Task 5 remains in progress. Next is removal of stale static game metadata that the registry already replaces at runtime.

### Task 5g, remove stale static game metadata

- Replaced the hardcoded `22` game count and first-game leaderboard name in the student HTML shell with neutral loading text. Runtime already fills both from the game registry.
- Added an ownership contract preventing numeric game counts and the first registered game name from returning to the static shell.
- Verification: 21 activity/game registry contracts plus all 12 activity loaders, 15 student game tests, three-page UI smoke, and 8 build-efficiency tests passed.

The installer URL is intentionally deferred because changing a product download destination requires evidence the repository does not contain. Account-policy duplication is deferred to the authentication/data-boundary phase; navigation duplication belongs to the page-registry phase.

### Task 5 checkpoint review

- The complete test suite passed, including the 9-width student shell regression, three-page UI smoke, and all 13 sandboxed HTML games.
- Independent review found two misses before closure: remaining Arcade minute literals and an active production-development override in `.env.example`. Both were removed, ownership/config tests were added, and the focused game, progress, registry, and auth/config suites passed again.
- Task 5 is complete. Contextual report labels remain intentionally separate, SQL security/reward authorities remain independent, and no giant global constants module was introduced.

### Task 6a, remove the dead client XP reward mirror

- Removed `ACTIVITY_XP` and `getActivityXp`. Runtime completion displays the server-returned XP delta, the activity registry forbids client XP, and the only caller was a package test written solely for the unused map.
- Kept level thresholds and offline total-XP fallback behavior in `studentExperience`; those remain live through student progress rendering.
- Verification: package refactor checks, 75 student progress tests, 139 student activity tests, and 8 build-efficiency tests passed.

Task 6 remains in progress while independent traces check the audit's no-op store, save-system, utility, CSS, and asset candidates for actual reachability.

### Task 6b, remove obsolete client save stubs

- Deleted the unreferenced ZIP `SaveSystem`. It had no imports, script tags, tests, or build entry and depended on an undeclared `JSZip` global plus an obsolete image-store API.
- Removed `main.js`'s exported no-op `store`. No caller read it, and its TODO save/load methods explicitly deferred to the real backend and browser-storage owners.
- Added a focused ownership guard so the deleted `store` export form and `js/saveSystem.js` path do not quietly return.
- Kept active ZIP/PDF export code and browser activity persistence unchanged; this deletion removes no live persistence path.
- Verification: 9 build-efficiency tests, package refactor checks, 139 student activity tests, 5 report tests, three-page UI smoke, and the production build passed. Deployment remains 15.1 MB and the student entry remains 242.48 kB raw, 62.17 kB gzip.

Task 6 remains in progress. Independent traces have identified additional isolated CSS/build-asset candidates; each will be verified and removed as a separate coherent group.

### Task 6c, remove orphan delivery and generated artifacts

- Removed the unreferenced 1.51 MB PNG duplicate of the live continuation artwork. Student CSS uses the 29 kB WebP twin, now protected by a build-efficiency ownership test.
- Removed an unimported duplicate Inter stylesheet. The landing and application typography owners already bundle the same local font faces, and an existing contract prevents the old icon-loader dependency from returning.
- Removed two tracked Python bytecode artifacts with no source, import, script, or build role. No source scripts or runtime assets were removed.
- Verification: exact reference tracing, 10 build-efficiency tests, three-page UI smoke, and the production build passed. Deployment fell from 15.1 MB to 13.6 MB while entry chunks and the 18-file student offline shell remained unchanged.

Task 6 remains in progress. The remaining high-confidence candidates are isolated unused helpers and narrowly unreferenced CSS selectors; uncertain database-driven images and intentional game source artwork remain untouched.

### Task 6d, remove dead shared utility exports

- Removed `main.js`'s unused JSON cache/fetch helper and safe-async/error wrapper. Repository-wide tracing found no importer, caller, HTML handler, or global exposure; the error helper was referenced only by the dead wrapper.
- Kept the active notification service, modal helpers, password controls, and Lucide refresh behavior unchanged.
- These exports were already absent from production output through tree shaking, so this change reduces the source interface without changing delivered code.
- Verification: package refactor checks, 10 build-efficiency tests, three-page UI smoke, and the production build passed. Deployment remains 13.6 MB and the student entry remains 242.48 kB raw, 62.17 kB gzip.

Task 6 remains in progress. Next is the independently confirmed group of four isolated unused declarations; their owning modules and active siblings will remain intact.

### Task 6e, remove isolated unused declarations

- Removed four exports that occurred only at their definitions: the unused request abort classifier, local coin-authority duration, structured-writing alias, and stylesheet-ready marker.
- Preserved the request timeout implementation, three live progress timing constants, native writing checker, and the stylesheet side-effect module. The three lazy feature imports still load the shared CSS without exposing a false readiness API.
- Verification: package refactor checks, 75 student progress tests, 139 student activity tests, 10 build-efficiency tests, and the production build passed. Deployment remains 13.6 MB; the student entry decreased from 242.48/62.17 kB to 242.36/62.12 kB raw/gzip, and the empty stylesheet marker chunk disappeared.

Task 6 remains in progress. Remaining decisions are the tested-but-runtime-unused vocabulary compatibility exports and isolated CSS selectors; both require their own ownership checks before removal.

### Task 6f, narrow the vocabulary compatibility barrel

- Removed four vocabulary-loader exports with no production caller: two cache invalidators, the manifest-list convenience wrapper, and a cloud-list wrapper that duplicated repository access.
- Removed the cloud repository and subject-slug imports that existed only for the dead wrapper. The live manifest, file-loading, preload, caching, timeout, normalization, and repository paths remain unchanged.
- Updated the compatibility-barrel contract to describe the smaller real interface instead of preserving unused methods solely because a test listed them.
- Verification: 5 vocabulary API contracts, package refactor checks, 75 student progress tests, 139 student activity tests, 10 build-efficiency tests, and the production build passed. Deployment and entry sizes remain unchanged.

Task 6 remains in progress. Only CSS selectors with exact DOM/reference evidence remain before the full Task 6 checkpoint.

### Task 6g, remove obsolete Flashcards meter styles

- Removed four Flashcards study-meter selector families that no current or dynamically constructed activity DOM emits. Kept all live Flashcards panel/control styles and the matching, Crossword, and Scramble arms of grouped progress rules.
- Verification: exact JS/HTML selector tracing, 10 Flashcards behavior tests, package refactor checks, three-page UI smoke, and the production build passed. Shared feature CSS decreased by 0.41 kB raw and student CSS by 0.05 kB raw; deployment remains 13.6 MB.

Task 6 remains in progress. The final deletion group is three isolated teacher component selectors with no HTML, JavaScript, template, or runtime-ID owner.

### Task 6h, remove orphan teacher component styles

- Removed `.glass-panel`, `.back-link`, and `.runtime-pill` style families after exact source/template tracing found no element or dynamic class owner. Kept similarly named student theme variables and all live teacher status indicators.
- Verification: 11 teacher data tests, 8 teacher progress composition tests, 10 build-efficiency tests, three-page UI smoke, and the production build passed. Teacher CSS decreased from 149.89/24.40 kB to 149.14/24.27 kB raw/gzip.
- The optional local responsive harness remains unavailable because `supabase start` exits 1 in this environment, matching the recorded baseline Docker limitation; it is reported as unknown, not passed.

### Task 6 checkpoint review

- The complete `npm test` suite passed, including 9 viewport widths, all three page smokes, and 13 sandboxed HTML games. The production build passed with 2,323 modules, a 13.6 MB deployment, the 18-file student offline shell, and a 242.36/62.12 kB raw/gzip student entry.
- Independent review found no unsafe deletion, missed live caller, broken published interface, new coupling, or runtime regression. It confirmed that `package.json` is private, removed selectors have no dynamic owners, and live WebP/font/lazy-feature assets remain delivered.
- Database-driven vocabulary images, intentional game source/reference artwork, and intertwined responsive selectors were explicitly retained because repository evidence does not prove they are obsolete.

Task 6 is complete. Task 7 will trace legacy quiz reachability separately before any removal.

### Task 7a, remove the vocabulary import dependency on legacy quiz code

- Three independent traces and a real browser run confirmed two separate systems: the active routed/lazy Quiz Maker and a permanently hidden legacy preview modal. The student Quiz activity is a third independent system and remains out of scope.
- A valid vocabulary JSON import updated editor state and then called `manager.downloadForRepository`, a method trapped inside the lazy legacy feature context with no manager proxy. The call always threw and falsely displayed `Error parsing JSON file`.
- Removed only the orphan post-import call and its unnecessary async wrappers. Explicit JSON export and cloud publishing remain the owned vocabulary workflows; importing no longer triggers an unrelated repository-download prompt.
- Added an ownership contract preventing eager JSON import from depending on the lazy quiz feature.
- Verification: 7 teacher vocabulary-library tests, package refactor checks, three-page UI smoke, and the production build passed. Deployment remains 13.6 MB; teacher entry is 163.06/44.66 kB raw/gzip.

Task 7 remains in progress. Next, the unreachable modal, methods, listeners, proxies, state, and exclusively owned styles will be removed together while retaining the modern Quiz Maker and student Quiz contracts.

### Task 7b, retire the unreachable teacher quiz preview

- Source, build, and browser traces proved the old `#quiz-modal` started hidden and had no opener. Overview navigation and Create Quiz reached the routed, lazy `#quiz-maker-view`; the legacy opener existed only as a comment.
- Deleted the 468-line legacy method installer, hidden modal, duplicate/no-op listeners, modal setup, `currentQuiz` state, and `handleGenerateQuiz`/manager `printQuiz` lazy proxies.
- Removed only styles and print exclusions owned by the retired preview, including stale landing/student copies. Preserved `teacherQuizCoreMethods`, `teacherQuizBrowserMethods`, all `quizMaker*` modules, `teacherQuiz.css`, quiz routes/templates, and the student Quiz descriptor/activity/server contracts.
- Added a retirement contract that checks the active quiz owners and prevents the removed module, modal, state, proxies, and selectors from returning beside them. Independent post-diff review broadened this guard to scan the active quiz core, browser, and stylesheet owners.
- Verification: the complete `npm test` suite passed, including 146 catalog units, 139 activity tests, 21 registry/parity tests, 9 viewport widths, three-page UI smoke, and 13 sandboxed games. Focused teacher accessibility, source UI smoke, built UI smoke, package, and architecture suites passed; PostCSS parsing and independent review found no regression.
- Production build passed with 2,322 modules and the same 13.6 MB deployment. The active lazy teacher Quiz chunk decreased from 31.36/8.56 kB to 16.75/4.49 kB raw/gzip; teacher HTML decreased from 111.27/15.62 kB to 109.91/15.38 kB. The student Quiz remains a separate lazy 8.27/3.10 kB chunk.
- The local cross-browser harness remains unavailable because `supabase start` exits 1 without the baseline Docker service. Direct unauthenticated browser inspection reached the expected login boundary; no authenticated post-change session was available, so that specific path is recorded as unknown rather than passed.

Task 7 is complete. Task 8 will introduce a semantic token layer without changing the established visual identity.

### Task 8, introduce the semantic theme authority

- Added `css/theme.css` as the single application color-theme authority. It defines brand, on-brand, information, background, surface, raised surface, text, muted text, border, success, warning, danger, focus, and interactive-state contracts.
- Preserved the established landing/teacher palette as the shared default and the established Celestial student palette as a scoped `.student-site` variant. A recursive independent comparison confirmed every moved legacy palette and glow property resolves to its previous value.
- Moved legacy color aliases out of the three entry stylesheets and mapped them to semantic tokens in the central file. These aliases are intentionally temporary migration bridges for Tasks 9 and 10, not a second theme authority.
- Each Vite application entry now loads the theme once before page-owned styles. Embedded games and join redirects remain isolated; lazy student feature and teacher Quiz styles inherit the tokens without importing the theme or becoming eager.
- Added `test:theme` to the complete suite. Its ownership contract requires the semantic surface, scoped student variant, entry ordering, compatibility mappings, and removal of entry-owned palette aliases.
- Verification: the complete `npm test` suite passed, including 9 viewport widths, three-page UI smoke, and 13 sandboxed games. The student design-system audit, focused architecture/accessibility checks, and independent diff review passed.
- Production build passed with 2,323 modules and a 13.6 MB deployment. Student feature CSS and teacher Quiz CSS remain separate lazy assets; the generated student service worker precaches the themed student entry CSS. No native `color-scheme` behavior was introduced.

Task 8 is complete. Task 9 will migrate shared UI families one at a time, beginning with buttons, while preserving the compatibility aliases until their consumers are retired.

### Task 9a, migrate the shared button family

- Added `css/buttons.css` as the single structural owner for `.btn`, disabled behavior, primary/secondary/accent/danger/text variants, icon sizing, focus rings, and button SVG geometry. Student and teacher load it after the theme and before page-owned refinements; landing does not load unused button CSS.
- Removed the exact duplicated core from `student.css` and `teacher.css`. Preserved the later Celestial student overrides, typography/design-system sizing, responsive rules, teacher/Quiz Maker layout refinements, async `disabled`/`aria-busy` behavior, and every existing class name.
- Migrated shared button colors and the student primary/accent refinements to semantic tokens. The focus token now resolves to the exact pre-migration ring color, and the new accent foreground token preserves both shared white and student dark text.
- Kept non-button `.btn` consumers (`label` and `summary`) working. Did not absorb landing cards, password/close controls, activity-internal layout, `.btn-icon-only`, Quiz document controls, or embedded game buttons into the primitive.
- Added `test:buttons` to the complete suite. It guards stylesheet order, one structural authority, every live variant, semantic-token consumption, student overrides, and the absence of `!important` in the shared core.
- Verification: the complete `npm test` suite passed. The theme and student design-system audits, 9-width/6-view student regression, source and built three-page UI smoke, production build, and independent review passed.
- Independent headless-Chromium comparison found identical computed styles before and after for teacher and student variants, disabled primary, hover, focus, icon/SVG, `label`/`summary` consumers, and lazy Quiz Maker context.
- Production build remains 13.6 MB. The 1.47/0.63 kB raw/gzip shared button asset replaces duplicated entry CSS; teacher entry CSS decreased by 1.33 kB raw and student entry CSS by 1.32 kB raw. Lazy feature CSS remains separate.

Task 9 remains in progress. Task 9b will investigate and migrate shared input/form-control styling without changing feature-owned field layouts.

### Task 9b, migrate the shared form-control family

- Added `css/forms.css` as the structural owner for student and teacher form rows, broad controls, labels, placeholders, focus/readonly states, teacher select presentation, and the shared password field/toggle.
- Preserved student and teacher surfaces through low-specificity page scopes. The later Celestial refinements, typography/design-system sizing, responsive subject selector, Quiz Maker document controls, activity inputs, calendar/roster selection controls, and all validation/listener behavior remain with their current owners.
- Kept the existing broad native `input` behavior unchanged. Checkbox/radio/file/color separation is a demonstrated pre-existing risk, but changing native appearance requires a separate visual/behavior task and was not mixed into this architectural extraction.
- Migrated shared text, muted text, and password focus colors to semantic tokens where they resolve exactly. No `!important`, new validation state, DOM abstraction, or compatibility adapter was introduced.
- Added `test:forms` to the complete suite. It guards entry order, one family owner, page refinements, lazy feature exceptions, semantic color use, and all six password toggles' accessible runtime wiring.
- Verification: the complete `npm test` suite passed. Focused form/button/theme/design-system, auth, and accessibility tests; 9-width/6-view student regression; source and built three-page UI smoke; production build; and independent review passed.
- Independent headless-Chromium comparison against a clean `HEAD` archive found zero computed-style differences across student and teacher text controls, placeholders, focus, readonly, textarea, disabled select, password controls, checkbox/radio/file/color inputs, lazy activities, and lazy Quiz Maker document controls.
- Production deployment remains 13.6 MB. Shared foundation CSS is 5.33/1.38 kB raw/gzip; duplicated teacher entry CSS decreased by another 2.27 kB raw and student entry CSS by 1.73 kB raw. Lazy feature CSS remains separate.

Task 9 remains in progress. Task 9c will investigate the shared card family and keep activity/game-specific surfaces local.

### Task 9c, migrate the shared card family

- Added `css/cards.css` as the single structural owner for the generic `.card` surface and the reusable `.option-card` subtype used by landing choices and student vocabulary choices. All three app entries load it after theme foundations and before page-owned refinements.
- Removed the duplicated card, option-card, content geometry, hover, and focus rules from landing, student, and teacher entry styles. The shared owner consumes semantic surface, raised-surface, border, text, and focus tokens; no new compatibility alias or `!important` was introduced.
- Kept activity, menu, game, vocabulary, Spark, matching, Flashcards, Quiz Maker, responsive, and Celestial card behavior with the feature or page that owns it. Lazy student and Quiz Maker styles remain separate build assets.
- Added `test:cards` to the complete suite and updated the landing ownership check. The contracts guard entry order, one shared owner, semantic-token use, student refinements, and feature-owned Quiz cards.
- Verification: the complete `npm test` suite passed after the final semantic-token change. Focused card, landing, theme, and student design-system checks; 9-width/6-view student regression; source and built three-page smoke; production builds; and independent review passed.
- Independent headless-Chromium comparison against `68a1a91a` found zero settled computed-style differences and pixel-identical screenshots at desktop and mobile widths for landing cards, student login/vocabulary/current-game cards, teacher login/group cards, tabindex focus/hover states, and lazy Quiz Maker question cards.
- Production deployment remains 13.6 MB. Teacher entry CSS is 141.81/22.75 kB raw/gzip and student entry CSS is 221.69/33.78 kB; the 49.98/9.91 kB student feature CSS and 12.48/3.10 kB Quiz Maker CSS remain lazy.

Task 9 remains in progress. Task 9d will investigate shared dialogs and modals without merging activity-internal overlays or the Quiz Maker document surface.

### Task 9d, migrate the shared dialog family

- Added `css/dialogs.css` as the structural owner for the student and teacher app-shell backdrop, panel, header, footer, close control, hidden state, and close-control focus ring. Student and teacher load it after the other shared UI foundations and before page-owned refinements; landing does not load unused dialog CSS.
- Removed the exact duplicated desktop dialog core from student and teacher entry styles. Shared close-control text and focus colors now consume semantic tokens with values identical to the previous aliases/literal.
- Preserved student and teacher mobile differences, Student Detail and activity-preview sizing, typography roles, FIB and Spark Reading modifiers, completion overlays, and the lazy Quiz Maker rubric dialog. Existing responsive `!important` rules remain until their inline-width dependencies are addressed in Tasks 11 and 12.
- Added `test:dialogs` to the complete suite. It guards stylesheet order, one structural owner, semantic-token use, seven static dialogs' ARIA contract, the shared focus lifecycle owner, and feature-owned activity/Quiz dialog variants.
- Verification: the complete `npm test` suite passed, including 139 student activity tests, 6 Teacher Sparks tests, 9 viewport widths, three-page UI smoke, and 13 sandboxed games. Focused design-system and shared UI contracts, source and built UI smoke, production builds, and independent source/cascade review passed.
- Production deployment remains 13.6 MB. The shared foundation CSS grew from 5.33/1.38 to 6.33/1.60 kB raw/gzip while teacher entry CSS decreased to 140.87/22.57 kB and student entry CSS to 220.75/33.60 kB. Lazy student feature and Quiz Maker CSS remain separate and unchanged.
- Independent review found declaration-for-declaration equivalence and unchanged later precedence. Its browser runtime was unavailable, so authenticated modal screenshots and live computed-style inspection are recorded as unknown rather than passed. Source/built smoke and responsive shell checks passed.
- Investigation found a separate pre-existing bug: the lazy Teacher Spark editor's X and Cancel controls mount after the old generic click binding and are inert, although backdrop and Escape closing work. This will be repaired as a separate behavior task so the CSS extraction stays independently verifiable.

Task 9 remains in progress. Next is the focused lazy Spark dialog lifecycle repair, followed by the navigation family.

### Task 9e, repair the lazy Spark dialog close lifecycle

- Confirmed that the Spark editor template mounts only when the Teacher Sparks feature loads, after the eager generic close-button scan has already run. The editor's X and Cancel controls therefore had no click handler; backdrop and Escape closing still worked through `setupModal`.
- Bound exactly the two `#spark-modal .close-modal` controls during the feature's existing one-time lazy initialization. Both now call the established shared `closeModal` lifecycle rather than mutating classes or duplicating cleanup logic.
- Preserved save behavior: successful persistence still closes through the same lifecycle; validation and repository failures keep the editor open. The registered `onClose` continues to clear the editing ID, restore create mode, clear status, and return focus when an opener remains connected.
- Added a focused runtime test that mounts a modal lifecycle, proves both lazy controls receive click handlers, closes through the shared API, and verifies editor state reset. Independent review confirmed the feature initializer cannot duplicate listeners across repeated navigation.
- Verification: 7 Teacher Sparks tests, 11 lazy/build-efficiency tests, the dialog contract, the complete `npm test` suite, source and built three-page UI smoke, production builds, and independent review passed. Deployment remains 13.6 MB and the Teacher Sparks feature remains lazy.

Task 9 remains in progress. Task 9f will investigate the shared navigation family.

### Task 9f, migrate the shared navigation family

- Added `css/navigation.css` as the structural owner for the shared top-level tab shell, mobile menu control, tab list/items, and vocabulary-library breadcrumbs. Student and teacher load it after the other shared foundations and before page-owned styles; landing does not load unused navigation CSS.
- Removed the duplicated base declarations from `student.css` and `teacher.css` while preserving every responsive rail/sidebar rule, the student 1120/1121 transition, teacher 1180 compact behavior, collapsed states, feature tabs, segmented controls, and all route/listener code.
- Added a semantic `--color-link` role because student breadcrumbs intentionally use the Celestial secondary color while teacher breadcrumbs use the information color. Shared navigation otherwise consumes semantic text, muted text, border, and focus tokens; contextual translucent active/surface colors retain their exact existing values.
- Kept the existing teacher-named classes as the live student/teacher DOM contract and retained transitional breadcrumb selectors for the student and lazy Quiz renderers. No generic router, markup migration, compatibility adapter, or `!important` was introduced.
- Added `test:navigation` to the complete suite. It guards stylesheet order, one structural owner, semantic-token use, retained responsive ownership, top-level tab counts, tab semantics, and mobile `aria-expanded`/`aria-controls` wiring. The theme contract now includes the link role.
- Verification: the complete `npm test` suite passed, including the 1120/1121 student shell transition, three-page source smoke, and 13 sandboxed games. Focused navigation, theme, and student-shell contracts, built three-page smoke, production builds, scoped diff checks, and independent source/cascade review passed. The independent computed-style run found only font-dependent width differences because its baseline archive initially lacked Inter; the identical-font rerun was interrupted, so exact pixel equivalence is recorded as incomplete rather than passed.
- Production deployment remains 13.6 MB with 2,328 transformed modules. Teacher entry CSS is 138.66/22.30 kB raw/gzip and student entry CSS is 218.42/33.31 kB; lazy student feature and Quiz Maker CSS remain separate.

Task 9 remains in progress. Next is an architecture review of the recent shared-UI changes, followed by status/feedback styling.

### Architecture review after Tasks 9c-9f

- Independent review of commits `b03ff894`, `28829e0f`, `91158a6c`, and `62c7ff2f` found no blocker, high-confidence regression, new eager dependency, circular dependency, or unnecessary abstraction.
- Confirmed the shared card, dialog, and navigation owners remain narrow while page-responsive and lazy feature refinements retain later precedence. The Spark repair continues through the existing lazy initializer and shared dialog lifecycle.
- Confirmed the teacher/student breadcrumb compatibility selectors are still required by live renderers. They should be removed only when both emit the canonical typography classes, not replaced with another alias now.
- Optional test hardening remains: authenticated modal screenshots, an identical-font navigation pixel rerun, and a repeated Spark-view close-listener assertion. These are evidence gaps or defense-in-depth, not demonstrated product regressions.

No corrective task was added. Task 9 continues with the status/feedback family.

### Task 9g, migrate shared status and completion feedback styles

- Added `css/feedback.css` as the structural owner for cloud status dots and activity completion screens/overlays. Student and teacher load it after navigation and before page-owned styles; landing does not load unused feedback CSS.
- Removed the exact duplicated status and completion declarations from student and teacher entry styles and the duplicated completion sizing from lazy student features. Preserved the later Celestial synced glow, XP reward visuals, activity/game feedback, empty/loading states, inline form statuses, and both existing toast systems for Tasks 12-14.
- Migrated text, surface, border, success, and danger colors to semantic tokens without changing resolved values. The student completion surface is explicitly scoped to the raised surface, while teacher uses the base surface. The pending indicator remains `#fbbf24` because the current student warning token is `#ffc800`; changing it here would alter the established visual state.
- Kept `fadeIn` and `scaleIn` keyframes teacher-owned. Both entries already referenced those names, but only teacher defined them, so moving the keyframes into shared CSS would newly animate student completions. This asymmetric animation behavior is intentional preservation debt for a later product-level decision.
- Added `test:feedback` to the complete suite. It guards stylesheet order, one structural owner, semantic-token use, student and teacher refinements, status-state accessibility wiring, and representative completion producers without introducing a shared behavior abstraction.
- Verification: the complete `npm test` suite passed, including 139 activity tests, 9 responsive widths, three-page source smoke, and 13 sandboxed games. Focused feedback, theme, activity, and build-efficiency checks, built three-page smoke, production build, scoped diff checks, and independent review passed.
- Independent Chromium comparison against `c71cab13` at 390x844 and 1280x900 found zero computed-property differences and pixel-identical screenshots for student and teacher status states and completion overlays, including the real lazy student feature CSS path.
- Production deployment remains 13.6 MB with 2,329 transformed modules. Shared foundation CSS is 9.94/2.25 kB raw/gzip; teacher entry CSS decreased to 137.49/22.04 kB, student entry CSS to 217.39/33.10 kB, and lazy student feature CSS to 49.84/9.88 kB. Quiz Maker remains a separate lazy 12.48/3.10 kB CSS asset.

Task 9 remains in progress. Next is the shared container family, followed by the existing typography authority review.

### Task 9h, migrate shared container styles

- Added `css/containers.css` as the bounded owner for the landing/app shell bases, main surface, decorative shell layer, app header base, and shared vocabulary/activity collection grids. All three entries load it before their page stylesheet.
- Removed only declaration-identical bases from landing, student, and teacher CSS. Preserved login layouts, page panels, activity/game layouts, lazy feature grids, the student 1120/1121 rail, teacher sidebar geometry, all media queries, and feature-specific headers.
- Kept contextual translucent shell colors local to the container family instead of falsely mapping them to stronger surface/border tokens. Existing spacing and radius variables continue to resolve through each entry's intended scale.
- Added `test:containers` to the complete suite. It guards one shared owner and load order, excludes responsive/sidebar/auth concerns from that owner, verifies page refinements remain, and traces live collection producers across student, teacher vocabulary, lazy Quiz, and Word Hunt views.
- Verification: the complete `npm test` suite passed, including 9 responsive widths, three-page source smoke, and 13 sandboxed games. Focused container, landing, student-shell, and build-efficiency suites, built three-page smoke, production build, scoped diff checks, and independent source/cascade review passed.
- The independent before/after browser comparison was invalid because its baseline archive was empty after a path-prefix error; those results were discarded. Current Chromium rendered all three entries at mobile, 1120px, and 1121px, but exact visual parity is recorded as unproven rather than passed.
- Production deployment remains 13.6 MB with 2,330 transformed modules. Shared foundation CSS is 5.91/1.71 kB raw/gzip, teacher entry CSS is 135.99/21.81 kB, student entry CSS is 215.89/32.87 kB, and lazy student/Quiz CSS remains separate at 49.84/9.88 and 12.48/3.10 kB.

Task 9 remains in progress. The typography audit found the current shared authority sufficient; only duplicate font ownership will be removed next.

### Task 9i, consolidate typography ownership

- Kept the existing `css/typography.css` as the single shared typography authority instead of introducing another type system or mechanically moving 1,261 feature-specific declarations. Its semantic text roles and four Inter font faces remain the application contract.
- Removed the duplicate four-face Inter delivery from `landing.css` and the redundant base `body` font-family declarations from landing, student, and teacher styles. All three entries already load `typography.css` after their page stylesheet, so resolved typography remains unchanged.
- Preserved `student-design-system.css` as an intentional scoped Celestial refinement. The new contract distinguishes that page-owned override from shared font delivery and requires every entry to load the shared authority last.
- Strengthened the build-efficiency font check and added `test:typography` to the complete suite. The contracts require exactly one font owner, all four delivered weights, semantic typography roles, entry cascade order, and removal of duplicate landing font faces.
- Verification: the complete `npm test` suite passed, including 9 responsive widths, three-page source smoke, and 13 sandboxed games. Focused typography, build-efficiency, landing-responsive, and design-system checks, built three-page smoke, production build, scoped diff checks, and independent review passed.
- Independent Chromium comparison against `6141063f` found identical computed body/tab typography and byte-identical full-page screenshots for landing at 1440x900 and 390x844. The scoped student override remained effective.
- Production deployment remains 13.6 MB with 2,330 transformed modules. Landing CSS is 23.82/4.07 kB raw/gzip, teacher entry CSS is 135.96/21.78 kB, student entry CSS is 215.86/32.84 kB, lazy student CSS is 49.84/9.88 kB, and Quiz Maker CSS remains lazy at 12.48/3.10 kB. The build emits each Inter WOFF2 asset once; the service worker precaches 20 files totaling 1,029,760 bytes.

Task 9 is complete. Task 10 will replace only duplicated visual-identity literals in migrated/shared areas with semantic tokens and add a narrow regression guard.

### Architecture review after Tasks 9g-9i

- Independent review found no runtime blocker, eager dependency, cascade regression, or unnecessary abstraction. Task 9 remains correctly marked complete.
- Confirmed the four Inter faces have one owner, responsive/sidebar/auth layout remains page-owned, and lazy student/Quiz CSS stays in separate build assets.
- Found one real hidden style dependency: shared completion rules reference animation names whose keyframes are teacher-owned. Student animations are intentionally inert today. A focused behavior-preserving correction will move the animation declarations beside the teacher keyframes after Task 10 instead of making the keyframes global.
- Task 9h exact pixel parity remains unproven and is still documented as an evidence gap, not a passing result.

### Task 10, reduce literal brand colors

- Replaced canonical brand, information, accent, danger, and status hue literals in the migrated button, form, navigation, feedback, and landing foundations with semantic tokens plus `color-mix()` opacity. Cards, dialogs, containers, and typography contained no canonical identity duplicates.
- Added explicit shared status-color roles where the glow or pending color intentionally differs from the generic theme status token. This preserves the teacher success glow and keeps pending `#fbbf24` independent from the student warning color `#ffc800`.
- Migrated landing/teacher background identity gradients, shared brand-mark glows, both activity-summary meters, teacher export controls, and known generated authentication/data-viewer UI fallbacks. The inline layout styles remain for Task 12; only their duplicate color authority changed.
- Kept contextual game, activity, chart, subject, illustration, Celestial glass, and lazy Quiz palettes feature-owned. This is a narrow identity-color contract, not a global ban on CSS literals.
- Added `test:brand-colors` to the complete suite. It derives configured identity channels from `theme.css`, rejects direct duplicates in migrated foundations, requires the shared status roles, checks app-shell consumers, and prevents known application UI producers from recreating the default brand fallback.
- Independent Chromium review found student desktop and mobile screenshots pixel-identical against `e1edb2ef`. Teacher computed values differed only in equivalent browser serialization (`rgba(...)` versus `color(srgb ... / alpha)`), with identical channels and alpha; student overrides and both activity meter colors remained unchanged.
- Landing and teacher screenshot comparisons in the temporary baseline were invalidated by different font delivery, so exact pixel parity for those pages is recorded as unproven. Focused computed-color checks, the 9-width regression, and source/built route smoke passed.
- Verification: the final complete `npm test` suite, focused theme/brand/shared-UI/auth/data checks, student design audit, production build, and built three-page smoke passed. The build remains 13.6 MB with 2,330 transformed modules; student feature and Quiz Maker CSS remain lazy, and the service worker precaches 20 files totaling 1,030,502 bytes.

Task 10 is complete. Next is the focused completion-animation ownership correction found by the architecture review, followed by Task 11's evidence-based `!important` audit.

### Post-Task 9 review correction, localize completion animations

- Removed `fadeIn` and `scaleIn` declarations from the shared feedback foundation and placed them beside their teacher-owned keyframes. The student entry continues to have no completion animation, preserving the established behavior in both shells.
- Strengthened the feedback contract so shared CSS cannot depend on consumer-owned keyframes and teacher CSS must own both the declarations and definitions.
- Verification: the feedback contract, 9-width/6-view student shell regression, source and built three-page smoke, and production build passed. Deployment remains 13.6 MB with lazy student and Quiz Maker CSS separate.

The architecture-review correction is complete. Task 11 will now inspect `!important` declarations one component/viewport family at a time and remove only those proven unnecessary.

### Task 11a, remove redundant Quiz print specificity

- Inventoried 1,035 application `!important` declarations: 961 are concentrated in the layered student responsive shell, while the remaining declarations are split across teacher, lazy activity, Quiz, landing, and Arcade styles. This concentration makes a global removal unsafe.
- Removed the duplicate Quiz print `transform: none` declaration because the same selector already owns that value. Removed `!important` from the later same-specificity print `zoom: 1` reset; no runtime code assigns transform/zoom to live `.document-page` elements.
- Retained the four Quiz layout declarations that currently override inline gap, sidebar width, canvas padding, and canvas background in `teacher.html`. Task 12 can remove those after moving the owned inline layout styles.
- Added `test:specificity` to the complete suite. It keeps all shared UI foundations free of `!important`, proves the Quiz print reset uses normal cascade, and bounds the four known inline-dependent Quiz exceptions.
- Verification: focused specificity and build-efficiency checks, production build, and built three-page smoke passed. The lazy Quiz CSS decreased from 12.48/3.10 to 12.44/3.09 kB raw/gzip; deployment remains 13.6 MB and the Quiz bundle stays lazy.

Task 11 remains in progress while the smaller teacher-entry candidates are verified independently. The student shell's layered responsive overrides will not be changed without exact viewport evidence.

### Task 11b, simplify teacher dashboard and Word Hunt specificity

- Removed unnecessary importance from dashboard summary alignment and icon spacing. The owned `.data-summary-stat .teacher-stat-icon` selector already outranks the generic icon rule.
- Scoped the Word Hunt separator color to `.word-hunt-review-breadcrumb .word-hunt-review-separator`, matching the generic breadcrumb-span selector's specificity so normal source order applies.
- Extended the specificity contract to require these owned selectors and reject `!important` in their blocks.
- Verification: focused specificity, teacher data, and Teacher Word Hunt suites plus source UI smoke passed. Independent Chromium comparison against `9adb6c48` at 1280x720 and 390x720 found identical computed values and byte-identical screenshots for both affected surfaces.

Task 11 remains in progress. Next is the isolated lazy student activity subset; inline-dependent teacher dialog/login rules remain separate.
