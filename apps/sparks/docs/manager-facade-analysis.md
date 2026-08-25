# Manager and forwarding interface analysis

This is the Task 22 caller and ownership map. It distinguishes real forwarding from implementation methods installed on a composition root. Method count alone is not treated as an architectural defect.

## Summary

| Surface | Forwarded names | Actual role | Decision |
| --- | ---: | --- | --- |
| `StudentManager` | 60 (48 methods and 12 property aliases) | Application composition root used by routing, shell, listeners, auth, subjects, progress, and activities | Preserve the live cross-component bridges. Remove only members proven unused. |
| `StudentActivities` | 141 (140 methods and `schoolCalendar`) | Stable activity boundary over 13 owned collaborators | Preserve high-level runtime, presentation, schedule, vocabulary, progress, and Word Hunt contracts. Do not expose child implementations to outside callers. |
| `StudentGames` | 26 methods | Lazy Arcade boundary over settings, access, leaderboard, HTML loading, and lifecycle owners | Deepen listener-facing Arcade intents incrementally; preserve server time/coin and lifecycle boundaries. |
| `TeacherManager` lazy entries | 7 methods over 5 features | Stable lazy-loading use cases | Preserve. A generic feature invoker would expose loader details to routing. |
| Quiz vocabulary-browser adapter | 28 validated capabilities | Explicit replacement for the former open manager Proxy | Preserve for now. Replace only if a cohesive DOM-free browser model removes the adapter atomically. |

## StudentManager

`StudentManager` owns application composition, not the implementation of every forwarded operation.

| Capability | Current surface | Main callers | Assessment |
| --- | --- | --- | --- |
| Activity session | `currentVocab`, current activity, unit score/image/Word Hunt/state aliases | Routing, shell, listeners, progress, report and activity code | Intentional compatibility boundary. Removing it would spread `activities.session` knowledge. |
| Routing | Route parsing/writing/restoration and lazy `getGames()` | Listeners, subjects, activity browser/launcher/home | Intentional. `getGames()` owns lazy import, request sharing, and session reset. |
| Shell | View, sidebar, scroll, mobile menu, cleanup and toast operations | Routing, listeners, auth, progress | Intentional application-shell interface. |
| Listener ownership | `addListener()` | Game settings | Intentional: it keeps event teardown with `StudentListeners`. |
| Subjects/auth/progress | Subject selection, auth UI/profile, dashboard, coins, cloud sync | Auth, progress, activities, listeners | Live cross-component use cases; do not replace with direct child reach-through. |

The existing ownership tests already reject old owner-only forwarding such as `loadVocabulary`, `startActivity`, `saveHighScore`, raw progress persistence, and registration validation on `StudentManager`. That is the correct boundary.

## StudentActivities

The facade delegates to these owned components:

| Owner | Delegates | Why callers use the parent boundary |
| --- | ---: | --- |
| Calendar | 4 | Calendar loading and current academic period |
| Schedule | 30 | Placement, availability, ordering, date and label policy |
| Vocabulary data | 9 | Manifest/cloud/repository merging and unit loading |
| Progress persistence | 9 | Verified attempts, state, autosave, synchronization and flush |
| Coverage | 4 | Word practice and coverage feedback |
| Progress flow | 23 | Required flow, eligibility, completion, gates and preload policy |
| Word Hunt | 9 | Entry/image persistence, export and Illustration save callbacks |
| Browser | 27 | Vocabulary navigation, cards/rows, labels and controls |
| Home and Sparks | 21 | Dashboard recommendations and current Spark presentation |
| Menu | 2 | Unit activity menu and completion report |
| Module loader | 1 | Registry-backed lazy activity loading |
| Launcher | 2 | Registered activity launch and header behavior |

Only a smaller cross-tree subset is an application API: manifest/calendar initialization, dashboard/home rendering, vocabulary loading, activity launch, pending-work/gate decisions, progress flushing, and reports. Most remaining methods let sibling activity modules collaborate without reaching into another component's implementation object.

A wholesale facade removal is not justified. It would change calls from stable domain names to `.schedule`, `.progressFlow`, `.browser`, or `.wordHunt` implementation paths while preserving the same number of operations. That increases change impact without creating a deeper interface.

## StudentGames and the Arcade seam

`StudentGames` is constructed lazily by `StudentRouting`. Its current groups are settings (5), access (3), leaderboard (5), HTML loading (2), and lifecycle (11).

The demonstrated coupling is in `studentListenerMethods.js`, not the existence of the facade:

- Previous/next controls mutate `currentGameIndex`, then coordinate selection and leaderboard rendering.
- Add-time controls own in-flight flags, cap checks, server minute acquisition, local timer mutation, and two UI refreshes that overlap lifecycle ownership.
- Exit controls compose stop plus selection; the lifecycle repeats the same transition in several result/timeout paths.
- Arcade route entry coordinates multiple low-level refresh operations.

Task 23 should move one complete intent at a time into the existing lifecycle owner. Start with `selectAdjacentGame(offset)`, then independently evaluate `requestAdditionalTime()` and `exitToGameSelection()`. Do not add a generic Arcade service or capability framework.

The following boundaries must remain:

- `StudentRouting.getGames()` owns lazy import, promise coalescing, and reset.
- `StudentGameAccess` owns authenticated server time/coin consumption.
- `StudentGameLifecycle` owns active game, timer, pause, cleanup, and transitions.
- `StudentGameLeaderboard` owns score persistence and leaderboard policy.
- The game registry remains the metadata and lazy loader authority.

## Teacher interfaces

The teacher feature boundary is already narrow:

| Feature | Manager entry | Frozen feature surface |
| --- | --- | --- |
| Groups | `showGroupsView()` | `show`, `destroy` |
| Sparks | `showSparksView()` | `show`, `destroy` |
| Data Management | `showDataManagementView()` | `show`, `destroy` |
| Word Hunt Review | `showWordHuntReviewView()`, `loadWordHuntReview()` | `show`, `load`, `destroy` |
| Quiz | `showQuizzesView()`, `openQuizMaker()` | `show`, `open`, `destroy` |

All seven manager entries are used by shell navigation, routing, or owned Vocabulary workflows. They preserve lazy imports, stale-navigation guards, per-manager feature state, and teardown. Do not replace them with `invokeFeature(name, method)`.

The large eager teacher surface is mostly implementation installed onto the application composition root, not forwarding to parallel owners. Converting eager Student Progress or Vocabulary into factories solely to reduce a method count is not justified.

Data Management receives several explicit capabilities because its private dashboard, export, viewer, and settings workflows are genuinely different. One later small candidate is to retain the array returned by `getStudentRosterData()` inside Data instead of reading the manager roster through a separate `getRoster` capability. This must preserve account cleanup and explicit cross-page selection snapshots.

Quiz's 28 browser capabilities are broad but exact, frozen, tested, and all used. They replaced an unbounded Proxy. A future DOM-free vocabulary-browser model may provide a deeper interface, but nesting or renaming the same 28 methods would be cosmetic. Keep the adapter until a model can replace it in one verified change.

## Task 24 removal candidates

Repository tracing found a small set of facade methods with no production receiver call. Each must be rechecked immediately before removal.

High-confidence first group:

- `StudentActivities`: `getMonthFromTrimesterWeek`, `getFallbackMonthForTrimester`, `getTrimesterKey`, `getCurrentScheduleWindow`, `getDateOnlyStart`, `getMonthKeyFromIndex`, `getSchoolWeekMajorityMonth`, `getVocabCalendarMonthKey`, `getVocabularyWeekStartDate`, `usesTrimesterWeekDate`, `alignDateToLabelMonth`, `advanceToWeekday`, `isWeekday`, `getPracticeRequiredRotationIndex`, `getUnitScores`, and `getNextActivityPreloadType`.
- `StudentGames`: `getScoreMonitoringScript`, `restartCurrentGame`, `clearGameTimer`, and `startGameTimer`.

Secondary candidates requiring broader dynamic/test-contract review include `StudentManager.joinGrade`, `StudentManager.handleStudentRegister`, `StudentManager.resetRouteState`, other uncalled `StudentGames` wrappers, and isolated teacher pass-throughs or constants. They are not deletion-authorized by this document.

## Verification plan for Tasks 23-24

For each bounded change run the relevant direct contract plus:

- `npm run test:student-games`
- `node --test tests/student-listener-composition.test.mjs`
- `npm run test:student-activities`
- `npm run test:student-routing`
- `npm run test:build-efficiency`
- source UI smoke and production build when a lazy or route boundary changes

Update ownership tests in the same change when an intentionally removed method is currently asserted as public. Preserve full-suite and build evidence before completing either task.
