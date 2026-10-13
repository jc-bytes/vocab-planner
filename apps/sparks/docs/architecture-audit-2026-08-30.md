# Sparks architecture audit and improvement register

**Audit date:** 2026-08-30
**Scope:** Sparks website and codebase
**Status:** Current reference and improvement backlog
**Audit mode:** Repository inspection and local verification. No deployment or production data changes.

## Purpose

This report records the current architecture assessment and the improvements worth carrying forward. It is meant to prevent future work from restarting the same broad audit or reopening changes that already have sound ownership.

Use this document when planning architecture, reliability, UI, game, activity, navigation, caching, or developer-experience work. Update the status and verification notes when an item is completed. Keep detailed implementation history in `docs/architecture-remediation.md`.

## Status legend

| Status | Meaning |
| --- | --- |
| Open | Confirmed issue with no completed repair |
| Planned | Scope and verification are agreed |
| In progress | Implementation has started |
| Verified | Repair passed the required checks |
| Deferred | Valid concern, but current evidence does not justify changing it yet |
| Closed | No further work is required |

## Executive assessment

Sparks does not need a rewrite or another feature framework. Its main architecture is sound:

- Student activities and Arcade games use validated registries and lazy imports.
- Teacher features load through explicit factories with small interfaces and owned cleanup.
- Domain repositories own Supabase query details.
- Server-state caching is account-scoped and bounded.
- Shared visual roles have a semantic theme authority.
- Production builds enforce lazy-loading contracts and gzip budgets.
- The concise `ARCHITECTURE.md` guide gives developers predictable extension paths.

The audit originally found four High-priority reliability defects plus eight incremental maintainability items. All 12 findings are now verified. Delivery headroom remains intentionally monitored rather than hidden by a budget increase.

## Current scores

| Quality | Score | Reason for current score |
| --- | ---: | --- |
| Modularity | 9/10 | Strong registries, feature factories, repositories, lazy ownership, and centralized student section identity |
| Maintainability | 9/10 | Clear extension guide, guarded metadata parity, shared presentation ownership, and explicit stop rules |
| Simplicity | 8.5/10 | No generic feature framework or speculative plugin system |
| Extensibility | 9/10 | Games, activities, student sections, and shared themes now have predictable authorities |
| Reliability | 9/10 | Account-safe teardown, request generations, bounded boot reads, clean acceptance exit, and broad regression coverage |
| Performance | 8.5/10 | Fast local shell traces, enforced lazy boundaries, exact headroom reporting, and limited remaining budget room |
| Code organization | 9/10 | Ownership is documented, repeated section/presentation authorities were removed, and circular imports were not found |
| Developer experience | 9/10 | Strong commands, architecture map, registry contracts, clean local acceptance, and actionable build warnings |

## Verified evidence snapshot

The audit recorded the following current evidence:

- Static dependency scan: 311 JavaScript modules, 624 local import edges, zero circular dependencies.
- Production dependency audit: zero vulnerabilities at the high threshold.
- Runtime dependencies: every declared production dependency has a live importer.
- Focused current suites passed for games, runtime validation, registries, server parity, and build efficiency.
- Student built-shell trace: 142 ms LCP and 0.024 CLS on an unthrottled local preview.
- Teacher built-shell trace: 254 ms LCP and 0.00 CLS on an unthrottled local preview.
- Deployment output: 13.6 MB against a 30 MB limit.
- Student initial JS/CSS: 201.5 KiB gzip against 210 KiB.
- Teacher initial JS/CSS: 179.6 KiB gzip against 180 KiB.
- Report Generator: 141.6 KiB gzip against 150 KiB.
- Quiz Maker: 125.9 KiB gzip against 130 KiB.
- Teacher charts: 69.6 KiB gzip against 80 KiB.
- No defensible unused first-party production dependency was found.
- No first-party `TODO`, `FIXME`, `HACK`, `XXX`, or `debugger` marker was found outside vendored game source.

The browser figures are local lab measurements of the unauthenticated shells. They are not field data or authenticated production acceptance.

## Improvement register

### SPA-001: Make Arcade teardown account-safe

| Field | Detail |
| --- | --- |
| Status | Verified |
| Priority | High |
| Effort | Medium |
| Area | Reliability, session ownership, asynchronous cleanup |
| Location | `js/studentRoutingMethods.js:21-25`, `js/student/studentGameLifecycleMethods.js:233-252`, `js/student/studentGameLeaderboardMethods.js:11-140`, `js/student/studentAuth.js:101-114,250-259` |

**Problem**

Session reset calls `cleanupCurrentGame({ preserveSelection: false })`, but cleanup only understands `keepTimer` and `saveScore`. The unknown option is ignored, so cleanup defaults to saving the active score. Delayed leaderboard timers and in-flight score work have no disposal interface. A pending lazy Arcade import can also install a new `StudentGames` instance after reset.

**Why it matters**

Old account work can survive sign-out or account replacement. The score RPC derives identity from the current Supabase session, so late work could be attributed to the wrong student.

**Recommended change**

Add one `StudentGames.destroy()` interface that:

1. Stops the active game with `saveScore: false`.
2. Clears Arcade timers and iframe/message listeners.
3. Cancels pending leaderboard timers and invalidates late score results.
4. Invalidates lazy Arcade construction with a session generation or owner ticket.
5. Leaves normal user-requested game exit behavior unchanged.

**Required verification**

- Account replacement does not submit the previous account's score.
- Sign-out cancels delayed leaderboard work.
- A lazy import resolved after reset cannot repopulate `StudentRouting.games`.
- Normal exit still saves eligible final scores.
- Run `npm run test:student-games`, student auth and routing contracts, authenticated local smoke, `npm test`, and `npm run desktop:build:web`.

**Verification result, 2026-08-30**

`StudentGames.destroy()` is now the single account-session teardown interface. It marks the owner dead, stops the active game without saving, removes timers/listeners/frames, aborts in-flight Supabase score requests, cancels pending score checkpoints, invalidates old async Arcade operations and canvas imports, and prevents replacement-account submissions. `StudentRouting` uses a session generation so a lazy module resolved after reset returns `null` without constructing or installing Arcade. Red-to-green tests cover in-flight abort, delayed-score cancellation, replacement accounts, an old gate request, a late canvas module, and a late routing import; a separate contract proves normal exit still saves the final eligible score. Student game, routing, auth, and student API suites passed, authenticated local smoke passed, and the complete `npm test` suite plus `npm run desktop:build:web` passed with all delivery budgets intact.

### SPA-002: Pass Galactic Breaker the correct owner

| Field | Detail |
| --- | --- |
| Status | Verified |
| Priority | High |
| Effort | Small |
| Area | Arcade adapter correctness |
| Location | `js/student/studentGameLifecycleMethods.js:197-204`, `js/student/studentGameRegistry.js:18-36` |

**Problem**

The launch implementation passes the `StudentGameLifecycle` instance as `games`. Galactic Breaker's registry adapter expects the owning `StudentGames` instance.

**Why it matters**

Live score updates land on the wrong object. Remaining Arcade time is undefined inside the game. A runtime probe confirmed that the lifecycle score changed while the owner score did not.

**Recommended change**

Pass `games: this.games`. Add a launch-adapter test that proves score and remaining-time callbacks use the owner. Consider replacing the mutable object later with narrow `setScore` and `getRemainingSeconds` capabilities, but do not make that broader change part of the small repair.

**Required verification**

- Galactic Breaker updates `StudentGames.currentGameScore`.
- The remaining-time callback returns `StudentGames.gameTimeRemaining`.
- Cleanup persists the final owner score once.
- Run the game registry, Arcade composition, Galactic Breaker, and production-build checks.

**Verification result, 2026-08-30**

The real `StudentGames.launchGame('galactic-breaker')` path now passes the owning `StudentGames` instance. The regression test failed before the repair because remaining time was `null`, then passed after the correction. `npm run test:student-games`, `npm run test:student-registries`, `npm run test:games`, the complete `npm test` suite, and `npm run desktop:build:web` all passed. The build retained 20 registered games, seven lazy canvas bundles, and every delivery budget.

### SPA-003: Correct SpacePi lower-is-better scoring

| Field | Detail |
| --- | --- |
| Status | Verified |
| Priority | High |
| Effort | Small |
| Area | Score protocol and leaderboard reliability |
| Location | `js/games/legacy-score-bridge.js:41-55`, `js/student/studentGameHtmlLoaderMethods.js:203-215`, `js/student/studentGameLeaderboardMethods.js:18-87`, `js/student/studentGameRegistry.js:50` |

**Problem**

SpacePi is marked lower-is-better. Its game calculates the applied score at level end, but the bridge can report an in-progress value and reports the end score after failed levels. SpacePi's own results screen labels failed-level scores "Not Applied."

**Why it matters**

Any early or failed value can become an unfair best result because the leaderboard retains the lowest score it observes.

**Recommended change**

Report SpacePi only when it transitions out of a successfully completed level. Keep the lower-is-better registry policy because the game defines the applied result as time and play cost.

**Required verification**

- Partial SpacePi scores never reach leaderboard persistence.
- A completed score is accepted.
- A later better completed score replaces the earlier completed score.
- Other legacy score bridges remain unchanged.

**Verification result, 2026-08-30**

The shipped bridge now emits a SpacePi result only when a level has ended successfully and the applied score is positive. A VM-backed regression test proved the previous bridge incorrectly emitted an in-progress value, then verified that in-progress and failed-level scores are ignored while a successful completed score is reported. `npm run test:student-games`, `npm run test:student-registries`, `npm run test:ui:game-sandbox`, the complete `npm test` suite, and `npm run desktop:build:web` all passed. The build retained 20 registered games, seven lazy canvas bundles, and every delivery budget.

### SPA-004: Make local Supabase acceptance exit cleanly

| Field | Detail |
| --- | --- |
| Status | Verified |
| Priority | High |
| Effort | Small |
| Area | Release reliability and developer experience |
| Location | `tests/local-supabase-acceptance.test.mjs:819-828`, `package.json` release scripts |

**Problem**

The local acceptance suite completed its 11 nested RLS, RPC, Realtime, and persistence checks, then did not exit. Supabase cleanup completed, but Node's native WebSocket stack retained an internal TCP resource after the client reported disconnection.

**Why it matters**

`npm run test:release` can hang even when every assertion passes. A hanging gate is not a passing gate.

**Recommended change**

Remove Realtime channels for every client explicitly and sequentially, assert that none remain, then sign out each client locally. Use Node's bounded `--test-force-exit` runner option for this local acceptance command because the native WebSocket resource survives Supabase's completed disconnect.

**Required verification**

- `npm run test:acceptance:supabase` exits with code 0 without manual interruption.
- All clients report zero channels before sign-out.
- Repeated runs leave no test records or channels behind.
- `npm run test:release` reaches the next release step.

**Verification result, 2026-08-30**

The original command reproduced the hang after all 11 assertions passed and required interruption at 50 seconds. Cleanup now covers all four browser clients, removes channels before local sign-out, and asserts zero remaining channels. The acceptance command uses Node's test-runner force-exit boundary because runtime inspection found no application channel or exposed network handle after cleanup, only an internal native-WebSocket TCP resource. The repaired command passed twice back-to-back with 11/11 checks and exited normally. `npm run test:release` then passed the complete source suite, local Supabase acceptance, dependency audit, production build, distribution smoke, and authenticated smoke. It later stopped at the separate cross-browser step when macOS denied Firefox's sandbox plugin process; that environment launch failure is outside SPA-004.

### SPA-005: Guard activity metadata parity

| Field | Detail |
| --- | --- |
| Status | Verified |
| Priority | Medium |
| Effort | Small |
| Area | Activity extensibility and documentation |
| Location | `js/activityMetadata.js:1-22`, `js/student/studentActivityRegistry.js:314-415`, `tests/runtime-validation.test.mjs:54-60`, `ARCHITECTURE.md:23,42-65` |

**Problem**

The shared metadata module and runtime registry independently enumerate the same 12 activity IDs. Current tests check metadata length and selected labels, but they do not compare the exact canonical ID sets. The architecture guide still says the runtime registry alone owns all client activity metadata.

**Why it matters**

A new activity could launch and pass server parity while teacher dashboards and reports omit or mislabel it.

**Recommended change**

Add an exact ID-set parity contract and update `ARCHITECTURE.md` to name both authorities and the reason they remain separate. Do not introduce another registry layer.

**Required verification**

- Exact canonical IDs match between metadata and runtime descriptors.
- Persisted aliases remain metadata-only and do not become launchable IDs.
- Activity/server parity and report tests pass.

**Verification result, 2026-08-30**

The student registry contract now compares the exact canonical ID sets in `ACTIVITY_DEFINITIONS` and `STUDENT_ACTIVITY_REGISTRY`, rejects duplicate metadata IDs, and proves that legacy persisted aliases do not resolve as launchable activities. `ARCHITECTURE.md` now identifies the two deliberate authorities and the required edit path for a new activity. `npm run test:student-registries` passed 23 contracts, including independent server allowlist parity; runtime-validation and report suites passed; the complete `npm test` suite and `npm run desktop:build:web` also passed with all delivery budgets intact.

### SPA-006: Centralize student section identity

| Field | Detail |
| --- | --- |
| Status | Verified |
| Priority | Medium |
| Effort | Medium |
| Area | Navigation extensibility |
| Location | `student.html:41-62`, `js/studentEarlyShell.js:8-33`, `js/studentShellMethods.js:305-360`, `js/studentListenerMethods.js:181-209`, `js/studentRoutingMethods.js:61-149,293-345` |

**Problem**

Student section identity is repeated in five production locations. Current values agree, so this is not a live defect.

**Why it matters**

A new tab can work after a click but fail on direct navigation, refresh, active-section styling, or the early no-flash shell.

**Recommended change**

Create a small frozen `studentSectionRegistry` with section ID, tab ID, root route, and owned view IDs. Use it for early selection, tab registration, and view-to-section mapping. Keep feature-specific route application explicit in `StudentRouting`.

**Required verification**

- Every descriptor matches a real tab and owned view.
- Click, direct hash, history, refresh, and early-shell selection agree.
- The 1120/1121 responsive boundary remains unchanged.

**Verification result, 2026-08-30**

`studentSectionRegistry` now owns the four section IDs, their real tab IDs, root routes, route families, and six owned view IDs. The early no-flash shell, tab click registration, and shell view mapping consume that registry; feature-specific route parsing and application remain explicit in `StudentRouting`. A new contract proves every descriptor points to real HTML and that direct route families resolve consistently. The focused shell, listener, and routing suites passed; the student-shell regression passed at nine widths and across the 1120px/1121px transition; authenticated UI smoke passed; the complete `npm test` suite and `npm run desktop:build:web` passed. Delivery budgets remain green at 201.2 KiB student and 179.1 KiB teacher initial gzip.

### SPA-007: Move toast presentation into shared CSS

| Field | Detail |
| --- | --- |
| Status | Verified |
| Priority | Medium |
| Effort | Small |
| Area | Theme customization and shared feedback |
| Location | `js/notifications.js:13-156`, `css/feedback.css:1-103` |

**Problem**

`NotificationManager` injects layout, animation, spacing, and hardcoded status colors through JavaScript.

**Why it matters**

Changing toast presentation requires editing behavior code. The hardcoded colors bypass semantic theme roles.

**Recommended change**

Move toast container, toast variants, close-button presentation, and animations into `feedback.css`. JavaScript should create safe DOM, select classes, manage timers, and toggle an exit class.

**Required verification**

- Existing accessibility roles, live-region behavior, safe text rendering, dismissal, and timer behavior remain intact.
- Toast variants consume semantic theme values.
- Notification and feedback contracts pass in student and teacher shells.

**Verification result, 2026-08-30**

`NotificationManager` now creates safe accessible DOM, selects semantic variant classes, manages timers, and toggles `toast-closing`; it no longer injects layout, colors, button styles, keyframes, or a runtime `<style>` element. `css/feedback.css` owns the shared container, toast surface, four semantic status variants, close button, and entry/exit animations. The updated contract failed against the inline implementation, then passed after the move. Feedback, theme, and security suites passed; the complete `npm test` suite and `npm run desktop:build:web` passed. The CSS move slightly improved initial budgets to 200.9 KiB student and 179.1 KiB teacher gzip.

### SPA-008: Complete the semantic roles needed for a second theme

| Field | Detail |
| --- | --- |
| Status | Verified |
| Priority | Medium |
| Effort | Medium |
| Area | Theme extensibility |
| Location | `css/theme.css`, `css/forms.css`, `css/cards.css`, `css/dialogs.css`, `css/navigation.css`, `css/containers.css`, `css/buttons.css` |

**Problem**

Primary brand colors are centralized, but shared UI families still contain dark-theme structural values. Sparks is already dark. The issue concerns adding a selectable light or alternate theme.

**Why it matters**

A primary-color change stays in one file. A second theme currently requires reviewing roughly 8-12 CSS systems.

**Recommended change**

Add only repeated roles needed by shared UI, such as control background, subtle surface, overlay, placeholder text, hover border, and shared shadow. Migrate shared UI incrementally. Keep game art and distinctive feature palettes local.

**Required verification**

- Existing theme, brand-color, specificity, contrast, and browser checks pass.
- A test theme can switch without editing shared UI family files.
- Student Celestial styling remains an intentional scoped variant.

**Verification result, 2026-08-30**

The theme authority now owns 15 repeated structural roles for controls, subtle surfaces, overlays, placeholders, interactive borders, status surfaces, accent endpoints, and shared shadows. Forms, cards, dialogs, navigation, containers, and buttons consume those roles or derive one-off opacity values from existing semantic colors; the shared families no longer embed the audited dark structural literals. The student scope explicitly owns the same contract and retains the existing Celestial values. A browser probe changes only theme variables and proves that real controls, borders, placeholders, cards, and dialogs update. Theme, brand, specificity, component-family, accessibility, UI, and nine-width student-shell checks passed; the complete `npm test` suite and `npm run desktop:build:web` passed. Delivery budgets remain green at 201.4 KiB student and 179.6 KiB teacher initial gzip.

### SPA-009: Ignore stale leaderboard reads

| Field | Detail |
| --- | --- |
| Status | Verified |
| Priority | Medium |
| Effort | Small |
| Area | Asynchronous reliability |
| Location | `js/student/studentGameLeaderboardMethods.js:180-269`, `js/services/leaderboardRepository.js:5-11` |

**Problem**

Concurrent leaderboard reads have no account, game, or request-generation ticket. A probe that resolved the newer request first showed the older result replacing it later.

**Recommended change**

Capture account ID, game ID, and a load generation before the repository call. Ignore results that no longer match. Forward an optional `AbortSignal` if the repository seam is being changed at the same time.

**Required verification**

- Older results cannot replace newer game or account results.
- Closing the modal prevents late DOM updates.
- Error feedback applies only to the active request.

**Verification result, 2026-08-30**

Leaderboard loads now capture a monotonically increasing generation plus the active account, selected game, container, and modal state. Results and errors update the DOM only while that ticket remains current; closing the modal invalidates pending work. The deterministic regression failed before the repair when the older account result replaced the newer row, then passed after the change for account switches, game switches, modal closure, and stale errors. `npm run test:student-games` passed 26 contracts, registry parity passed, and the complete `npm test` suite plus `npm run desktop:build:web` passed with all delivery budgets intact.

### SPA-010: Preserve delivery-budget headroom

| Field | Detail |
| --- | --- |
| Status | Verified, monitored |
| Priority | Medium |
| Effort | Medium when triggered |
| Area | Performance and scalability |
| Location | `scripts/lib/deliverySizeBudgets.mjs`, `scripts/check-dist-size.mjs` |

**Problem**

All enforced budgets pass, but the teacher entry has 0.6 KiB gzip of headroom. Student, Report Generator, and Quiz Maker are also above 94 percent of their limits.

**Recommended change**

Do not refactor only to reduce a number. When the next material feature grows one of these entries, inspect the production manifest and move one cohesive optional owner behind an existing lazy seam. Do not raise a budget without explaining the delivery cost.

**Required verification**

- Run `npm run test:build-efficiency` and `npm run desktop:build:web`.
- Confirm the intended module moved out of the static graph rather than merely moving bytes between named chunks.
- Re-run built-site smoke and local performance traces for affected entries.

**Verification result, 2026-08-30**

The production manifest still contains all nine intended lazy edges and nine optional feature boundaries; no optional feature, activity, game, or deferred student stylesheet leaked into an initial graph. Because no material feature triggered a cohesive move, the report's stop rule was followed and no module was split only to reduce a number. Budget output now reports utilization and exact headroom and warns at 95 percent without weakening any hard limit. `npm run test:build-efficiency` passed 22 contracts, `npm run desktop:build:web` passed, and the built production site passed landing, student, and teacher smoke. Current measurements are student 201.4/210 KiB (95.9 percent), teacher 179.6/180 KiB (99.8 percent), Report Generator 141.6/150 KiB (94.4 percent), Quiz Maker 125.9/130 KiB (96.8 percent), and teacher charts 69.6/80 KiB (86.9 percent). This item remains monitored: the next material eager addition must inspect the manifest and choose a cohesive lazy owner instead of raising a limit.

### SPA-011: Bound teacher boot and navigable cached reads

| Field | Detail |
| --- | --- |
| Status | Verified |
| Priority | Medium |
| Effort | Small to Medium |
| Area | Reliability and request cancellation |
| Location | `js/teacherAuth.js:94-169`, `js/teacherSparks/teacherSparkDataMethods.js:46-64`, `js/services/sparksRepository.js:41-47`, teacher vocabulary cached reads |

**Problem**

Teacher session boot does not use the timeout seam already used by student authentication. Some TanStack query functions accept a cancellation signal, but their repository adapters ignore it.

**Why it matters**

Generation guards keep stale results out of the DOM, but a stalled request can leave loading UI waiting and continue consuming network work after navigation.

**Recommended change**

Reuse the existing timeout mechanism for role/profile and boot-critical settings. Forward optional signals through navigable cached repository reads. Preserve generation guards because cancellation alone does not guarantee that a late result cannot arrive.

**Required verification**

- A stalled teacher profile/settings request fails with bounded feedback.
- Account replacement aborts or ignores prior-account work.
- Normal cached reads and force refresh retain their current behavior.

**Verification result, 2026-08-30**

Teacher profile verification and both boot-critical settings reads now use the shared 8-second request boundary and receive the active session signal. Profile timeout still closes the unverified session; a settings timeout renders the existing defaults, shows bounded feedback, and continues to the requested route. The settings, profile-repair, weekly Sparks, and cloud vocabulary repository adapters forward optional abort signals into Supabase, while existing generation guards remain in place. Focused auth, repository, Sparks, vocabulary, account-isolation, and student-auth suites passed; authenticated UI smoke passed; the complete `npm test` suite and `npm run desktop:build:web` passed. Cache sharing and latest force-refresh behavior are unchanged. Delivery budgets remain green at 201.2 KiB student and 179.4 KiB teacher initial gzip.

### SPA-012: Remove duplicated completion-overlay presentation

| Field | Detail |
| --- | --- |
| Status | Verified |
| Priority | Low |
| Effort | Small |
| Area | Shared UI consistency |
| Location | `js/activities/crossword/crosswordViewMethods.js:184-212`, `js/activities/wordSearch/wordSearchViewMethods.js:262-287`, `css/feedback.css:17-41` |

**Problem**

Crossword and Word Search duplicate the shared completion overlay with `style.cssText` and fixed inline markup styles.

**Recommended change**

Use the existing `.completion-overlay` and `.completion-screen` rules. Add one small shared action-row class only if the button spacing needs it. Extend the student presentation audit with a narrow allowlist for genuine runtime styles.

**Verification result, 2026-08-30**

Crossword and Word Search now emit only the shared `completion-overlay`, `completion-screen`, and new `completion-actions` classes; both duplicated `style.cssText` blocks and every fixed inline completion style were removed. Their activity-specific text and replay/close behavior remain local, so no shared behavior abstraction was introduced. The feedback contract prevents either producer from recreating fixed completion presentation and explicitly retains calculated progress width as runtime state. Feedback, Word Search, Crossword, and complete student-activity suites passed; the complete `npm test` suite and `npm run desktop:build:web` passed. The two lazy activity chunks each shrank by roughly 0.16-0.18 KiB gzip, and all delivery budgets remain green.

## Change-impact reference

| Requested change | Current production impact |
| --- | --- |
| Change primary Sparks color | One file, `css/theme.css`, plus verification |
| Add dark theme | No production change; Sparks is already dark |
| Add selectable light or alternate theme | Theme values in `css/theme.css`; an end-user selector would also need its small preference UI/storage owner and tests. Shared UI families do not need edits |
| Add a game | Registry descriptor, owned implementation/assets, focused tests; a scoring game also needs an independent SQL policy migration and parity update |
| Remove a game | Registry descriptor, owned assets/tests; scoring authority changes require a new migration |
| Add an activity | Shared metadata, runtime descriptor, implementation, tests, and independent server policy/parity, usually 4-7 systems |
| Add a teacher navigation page | Approximately 6-10 explicit systems |
| Add a student navigation section | Student HTML, the section registry, explicit route parsing/application, and focused tests; existing early-shell, tab-listener, and active-view consumers update from the registry |
| Change shared feedback | Shared CSS, one behavior owner when behavior changes, and focused tests; Crossword and Word Search no longer carry presentation exceptions |
| Replace a shared UI module | Usually one CSS or behavior owner plus its contract; consumers change only if the interface changes |
| Change one data query | Usually one repository plus its contract |
| Replace Supabase | Repositories, configuration, authentication, Storage, RPC/security, migrations, and acceptance tests |
| Add a new interactive category | Approximately 6-12 systems; do not add a generic plugin framework until a second category proves a common lifecycle |

## Refactoring roadmap

All numbered SPA findings in Phases 1, 2, and 4 are complete. SPA-010 remains a verified build-time monitor. Phase 3 describes continuing extension rules rather than an unfinished migration.

### Phase 1: Quick wins and current defects — Complete

1. SPA-002, correct the Galactic Breaker owner.
2. SPA-003, correct SpacePi score checkpoints.
3. SPA-004, repair local Supabase acceptance teardown.
4. SPA-005, add activity metadata parity and update the guide.
5. SPA-009, add leaderboard request generations.
6. SPA-007, move toast presentation into shared CSS.

### Phase 2: Structural reliability — Complete

1. SPA-001, add account-safe Arcade destruction and lazy-session generations.
2. SPA-006, centralize student section identity.
3. SPA-011, add teacher timeouts and repository cancellation.
4. SPA-008, add the missing shared theme roles.

### Phase 3: Extensibility safeguards — Established and ongoing

1. Keep the targeted contracts around registries, factories, and capability objects current when those modules change.
2. Keep game and activity extensions registry-driven.
3. Add a new content-category registry only when a second category proves a shared lifecycle.
4. Keep the change-impact table current after architectural changes.

### Phase 4: Optional cleanup — Audited item complete

1. SPA-012, remove duplicated completion presentation — complete.
2. Forward cancellation through other non-critical cached reads when their owners change.
3. Revisit cold-offline HTML game support only after product and asset-provenance decisions.

## Five long-term risks

After the completed work, these are the five pressures most likely to require attention over the next two or three years:

1. New eager code exhausting teacher and Quiz Maker delivery budgets.
2. New asynchronous features omitting the established account, generation, cancellation, and teardown rules.
3. New activities changing client metadata without the independent server-policy parity work.
4. A genuinely new interactive-content category being forced into the game or activity lifecycle before its needs are understood.
5. Feature-specific visual systems accumulating fixed runtime styles instead of using shared or feature-owned CSS.

## Five highest-return improvements completed

1. Added account-safe Arcade destruction and request generations.
2. Added exact activity metadata parity.
3. Centralized student section identity.
4. Moved toast presentation into the shared feedback stylesheet.
5. Added targeted static checking at registry, factory, and capability seams.

## Architecture decisions to preserve

The following are not current refactoring targets:

- Do not rewrite Sparks in another framework.
- Do not remove manager interfaces based on method count alone.
- Do not create a generic feature invoker for teacher features.
- Do not merge client metadata with server authorization policy.
- Do not introduce a provider abstraction while Supabase has no second adapter.
- Do not centralize game artwork or distinctive activity palettes into the shared theme.
- Do not split large files unless a real ownership, duplication, second-consumer, test-seam, exception-removal, or measured-performance trigger exists.
- Do not raise delivery budgets to avoid understanding a new dependency.

## Completion procedure

For each improvement:

1. Change its status to Planned before implementation.
2. Confirm callers, persistence, routes, account ownership, lazy imports, DOM ownership, and tests.
3. Implement one coherent change and remove the obsolete path in the same task.
4. Run the finding's focused checks.
5. Run `npm test` and `npm run desktop:build:web`.
6. Run the relevant browser smoke for UI, routing, authentication, or game changes.
7. Record measured build sizes and any local-acceptance limitation.
8. Change the status to Verified only when all required checks pass.
9. Treat deployment and production acceptance as separate work unless explicitly authorized.

## Update log

| Date | Change | Evidence |
| --- | --- | --- |
| 2026-08-30 | SPA-012 verified | Shared overlay/action-row contract, no fixed inline completion styles, focused activity suites, full source suite, and production build |
| 2026-08-30 | SPA-010 verified and monitored | Exact headroom reporting, 95 percent warnings, unchanged hard limits, lazy-graph contract, production build, and built-site smoke |
| 2026-08-30 | SPA-008 verified | Structural role contract, alternate-theme browser probe, shared-family checks, accessibility smoke, Celestial responsive regression, full suite, and production build |
| 2026-08-30 | SPA-011 verified | Bounded profile/settings tests, visible fallback, Supabase signal forwarding, account-isolation coverage, authenticated smoke, full source suite, and production build |
| 2026-08-30 | SPA-006 verified | Registry/HTML parity, direct-route mapping, responsive boundary regression, authenticated smoke, full source suite, and production build |
| 2026-08-30 | SPA-001 verified | Red-to-green account teardown, abort, delayed-score, async-start, lazy-module and normal-exit coverage; authenticated smoke; full source suite; production build |
| 2026-08-30 | SPA-007 verified | Red-to-green presentation-ownership contract, accessibility and timer checks, semantic theme variants, full source suite, and production build |
| 2026-08-30 | SPA-009 verified | Red-to-green deterministic account/game race, modal-close and stale-error coverage, full source suite, and production build |
| 2026-08-30 | SPA-005 verified | Exact canonical ID parity, metadata-only alias checks, server parity, report tests, full source suite, and production build |
| 2026-08-30 | SPA-004 verified | Red hang reproduction, explicit zero-channel cleanup, two consecutive clean 11/11 runs, and release-gate progress beyond acceptance |
| 2026-08-30 | SPA-003 verified | Red-to-green bridge regression using the shipped script, full source suite, UI smoke, sandbox smoke, and production build |
| 2026-08-30 | SPA-002 verified | Red-to-green real launch-path regression, full source suite, UI smoke, sandbox smoke, and production build |
| 2026-08-30 | Initial audit report created | Repository scan, focused suites, production artifact measurements, local browser traces, and targeted runtime probes |
