# Activity results implementation record

Updated: 2026-11-16. Work performed without subagents.

The approved scoring system is implemented locally, including student game and reading flows, teacher settings/results, durable offline delivery, server validation, reward protection and school/grade leaderboards. The feature remains disabled by default. Hosted staging acceptance passed on 2026-11-16 against a separate Supabase project using real Auth and PostgREST with fictional accounts. Production deployment is being verified separately. No classroom pilot was performed.

## Delivered behavior

- All eleven vocabulary activities use the approved scoring rules when their assignment has published scoring settings. Their individual game interactions remain available. Unpublished activities and servers without the new RPCs retain the established flow.
- Accuracy contributes up to 950 points and speed up to 50. The result is rounded down. Speed requires the full original set and at least 80% weighted accuracy, independently of a student's passing target. Five stars require exactly 1,000 points.
- Original answers, assistance and scored time are immutable evidence. Corrections preserve the original score and exclude correction time. Crossword locks all original words together before showing corrections. Intersection clues affect every word sharing the revealed cells.
- Matching and Speed Match average scheduled appearances within each word and then weight words equally. Speed Match includes the correct word in every appearance, requires correction after a miss and continues through the complete schedule.
- Reading checks have separate reading, multiple-choice and writing sections. Only the multiple-choice section uses the scored clock. Whole-check submission locks all original choices. Writing is preserved across retries and versioned independently.
- Combos celebrate full-credit unaided original answers, retain the longest run and survive saved-attempt resume. They add no points.
- Hidden activities pause and hide the game. Resume is explicit. The last saved timer value survives reload and replacement-computer recovery, with the speed bonus still available.
- Finished attempts below the passing target can enter the leaderboard after validation. Boards remain within one school, grade, activity and immutable content/settings version. Best points select the entry, with shorter scored time from that same attempt as the secondary value. Equal points share a competition rank. Exact ties use name and stable identity. The top five ranks include ties, with the student's own result shown separately when necessary.
- Teachers can publish shared timing and scheduled appearances, inspect actual timing summaries, set individual whole-number passing targets from 1% to 100%, and inspect saved results, support flags and response/correction evidence.
- Two clearly new failures activate help. Passing clears the flag and resets the counter. Uncertain or old failures cannot reactivate a cleared flag without the required causal evidence.
- Device-created attempt IDs, owner-scoped IndexedDB records, manifest checks and actual cached application assets support previously downloaded offline activities. A replacement computer can sign in normally and recover accepted evidence or start a fresh attempt. History recovery follows pages beyond the first 100 records.
- Delivery serializes predecessor and writing dependencies, validates accepted prefix receipts, retries transient errors and holds rejected chains without discarding saved answers. Pending learning work is discovered by the ordinary student sync queue after sign-in.
- Separate validated result records bridge into existing progress, completion, XP and coin rules. Transaction rollback and replay checks protect rewards and counters. Existing percentages are not converted into competitive historical results.

## Implementation map

| Owner | Files and responsibility |
| --- | --- |
| Shared protocol and scoring | `js/learningResults/contract.js`, `unicodeLowercaseV1.js`, `scoring.js`, `task.js`, `adapters.js` define canonical bytes, frozen normalization, exact arithmetic, schedules and independently verifiable evidence. |
| Durable state and delivery | `scoredTimer.js`, `session.js`, `store.js`, `sync.js`, `delivery.js`, `coordinator.js`, `queue.js`, `runtimeAssets.js` under `js/learningResults/`, plus IndexedDB v7 and the existing student sync queue. |
| Student games | `js/learningResults/vocabularyRuntime.js`, `games/{choice,spelling,matching,speedMatch,puzzles,ui}.js`, `lifecycle.js`, `presenter.js`, `css/learning-results.css`. |
| Production mounting | `js/student/studentLearningResults.js` connects the activity launcher and both current reading routes. Assigned reading uses `studentClassSparks.js`; library reading uses `sparkReading.js` through the student library hook. The generic `classroomView.js` compatibility reader has no current call sites and retains its old behavior. |
| Teacher controls | `js/teacherLearningResultsSettings.js`, `js/teacherLearningResults.js`, assignment Details/Student work and the saved multiple-choice Spark editor. |
| API | `js/services/learningResultsRepository.js`, `learningLeaderboardRepository.js`; public owner-checked RPC wrappers call private helpers. Anonymous execution and direct private helper access are revoked. |
| Database | `supabase/migrations/20261116151834_learning_results_v1.sql` contains additive records, immutable references, publication/preparation, append validation, finalization, writing, progress/reward/help projections, history/recovery, teacher reads and boards. It is a local forward migration. |
| Offline build | `scripts/generate-service-worker.mjs` emits the complete student precache graph and `learning-offline-assets.json`. Downloaded packages/settings remain in owner-scoped IndexedDB. |

The implemented seam uses dedicated learning runtimes behind the existing launchers. It does not require rewriting each legacy game or routing new results through legacy score mutations. The original design's per-file edit list was a proposed integration map; the table above records the final ownership.

## Repeatable local verification

Run these commands from `apps/sparks`:

```sh
npm run test:learning-results
npm test
npm run desktop:build:web
npm run test:learning-results:ui:built
npm run test:learning-results:capacity
SPARKS_LEARNING_ENFORCE_BUDGETS=1 npm run test:learning-results:database
```

`test:learning-results` includes scoring, adapters, sessions, offline storage/delivery, teacher settings and embedded PostgreSQL. The same test files are discovered by the portable unit suite. Source browser checks include `ui-learning-results-local.mjs`; release verification includes the built browser check, capacity runner and native database rehearsal with enforced local latency budgets. In this workspace Docker uses the already-running Colima socket, selected per command with `DOCKER_HOST=unix:///Users/pjriosc/.colima/default/docker.sock`. No global Docker configuration was changed.

The PostgreSQL helper installs all 105 release migrations against actual application tables/functions using PGlite. Managed Auth, Storage, Realtime and cron are explicit fixtures. This verifies PostgreSQL statements and transaction behavior, including permission metadata. The separate native rehearsal installs the 105 release migrations into a randomly named disposable database inside the existing local Supabase PostgreSQL container, then drops it. It runs public wrappers as `authenticated` in independent sessions and checks actual commit-time deferred triggers. Auth, Storage, Realtime and cron remain explicit managed-service fixtures in both runners. Neither runner establishes hosted Auth/PostgREST acceptance. Native `plpgsql_check` passed for learning functions and the progress/reward helpers. The final migration uses conservative STABLE volatility for generic JSON serialization helpers, removes unused legacy reward variables and avoids shadowed loop variables. Hosted lint passed with `--level warning --fail-on warning`, with no exemptions.

Verified cases include owner isolation, exact browser/SQL parity, all twelve adapters, semantic append and recovery, lost acknowledgements, stale prefixes, server evaluation bound to the exact accepted head, premature-review rejection, canonical board-digest bytes with escaped Unicode names, required/optional rewards, terminal replay, rollback after reward insertion, conservative help projection, current-access teacher reads, source publication/changes and an actual two-attempt offline classroom-writing chain.

The browser runner mounts the production coordinator and runtime APIs with real browser IndexedDB. It finishes all eleven vocabulary games and a reading check. Additional cases cover spelling partial credit and corrections, half-credit clues, Crossword intersections, Speed Match correction-before-advance, hidden-page pause/resume, teacher timing/target controls, replacement history beyond 100 results and tied leaderboard paging. The built run registers the real production worker, verifies its complete cache, disables network access and reloads hashed modules through that cache. Only the blank test document is supplied by a fixture. A failed network probe proves the network is unavailable; the connectivity property is explicitly set for the application's offline branch. Saved timer resume, a downloaded offline start and rejection of an unready package are checked. These fixtures do not establish hosted acceptance.

## Measured evidence

- Feature suite: 78 passed, zero failures.
- Release portable unit suite: 1,750 passed, zero failures. The full `npm test` also passed, including catalog validation and all 62 source browser verification stages, before the final SQL performance refinement. The final SQL changes were rechecked separately with the feature, capacity and native suites.
- Built browser: all eleven vocabulary games, reading, failure cases, offline cache/resume, replacement history and teacher controls passed.
- Production build: 110 student precache files, 2,523,362 bytes. Student initial JS/CSS is 191.3 KiB gzip against a 210 KiB limit; teacher initial JS/CSS is 164.0 KiB against 180 KiB.
- Maximum scheduled set: 200 words with 20 appearances each, 4,000 opportunities and 8,001 actual events. The complete attempt delivered through ten actual SQL requests and produced a confirmed 1,000-point result. Framed evidence occupied 1,901,084 bytes; the largest request was 261,979 bytes against a 262,144-byte ceiling.
- Event ceiling: actual PostgreSQL evaluator replay accepted 50,000 minimal events and rejected 50,001. Minimal evidence at that limit occupies 8,088,895 bytes against an 8,388,608-byte ceiling. Full multi-request persistence at 50,000 events was not tested; the transport test used 8,001 events.
- A separate synthetic board contained 5,000 eligible entries, including 1,000 tied at rank five. All top-five ties and the current student were returned over eleven pages; the largest response was 21,855 bytes, below 200 KiB. The rank query used `learning_board_rank`. These cloned result rows test query behavior, not 5,000 real student submissions.
- Native duplicate-delivery rehearsal used 14 concurrent requests, including ten terminal connections for the same attempt. It produced one result, one completed/mastered run, one XP award and two distinct progress/completion coin ledger keys.
- Ten independent native maximum-size attempts each delivered all 4,000 opportunities and 8,001 events through owner-checked public RPC wrappers. The largest request was 262,139 bytes, below 262,144. After the server-evaluation refinement, terminal p95 was 263 milliseconds against 2,000; the native board p95 was 103 milliseconds against 500. Release verification enforces both local budgets with `SPARKS_LEARNING_ENFORCE_BUDGETS=1`. These are local managed-service-fixture measurements, not hosted latency guarantees.
- The embedded maximum-set run completed its transport in 11.3 seconds with a 19-millisecond terminal call. Its 5,000-entry board p95 was 95 milliseconds. The 50,000-event ceiling remains evaluator-only evidence. Embedded and native timings vary with machine load; intended-environment measurement remains a release gate.

## Final server refinements

Every accepted checkpoint replays all persisted evidence and atomically saves a private evaluation bound to its accepted revision, event sequence, prefix hash and state hash. Final submission and the progress bridge reuse only that server-derived evaluation after verifying the exact bindings. Missing/stale metadata and incomplete required review reject submission. Public results omit internal progress counters. This removes repeated maximum-schedule evaluation while preserving score locking, correction requirements and transactional reward authority.

The board query checks current active school/membership/student-role eligibility with set joins. It builds the exact canonical digest directly from concrete typed fields in stable student-ID order. Names use NFC normalization and ASCII case folding for deterministic tie ordering. Canonical escaping remains covered by the SQL/device parity test. All authorization, digest, rank and page values still share one SQL statement snapshot.

The additive migration now keeps records, functions, wrapper grants and final private-helper revocations inside one transaction. Native execution found and fixed commit-time permissions for the deferred attempt-pair integrity trigger. The trigger uses restricted definer authority with an empty search path; private helpers and tables remain inaccessible directly to anonymous and authenticated clients.

## Release gates still open

1. Run authenticated staging acceptance with two schools, grades, teachers and students, shared sections, current-access changes, real RPC grants, replacement-device sign-in and offline reconnect. Exercise concurrent claim/checkpoint/finalization/settings writes and verify transactional rewards in independent sessions.
2. Measure the documented board and maximum-attempt p95 budgets on the intended environment, including ten concurrent finalizations. Local native rehearsal covers concurrency and performance with managed-service fixtures; intended-environment measurements remain required.
3. Deploy the additive migration and compatible client through the normal release process, then explicitly enable a controlled school/grade/content scope. No deployment was performed in this work.
4. Run the teacher-led classroom pilot and physical-device/accessibility acceptance before wider use. No student-use or classroom-pacing evidence is claimed.

The design and its drafting copy remain identical. Historical audit/review files describe the earlier review and are not current implementation status.

## Hosted staging acceptance, 2026-11-16

The independent staging project used no production records. Its schema includes the release migrations and four existing production-only DDL additions retrieved from migration history. Six fictional accounts exercised actual Auth sign-in and public PostgREST RPCs. Eleven checks passed, recorded in `hosted-acceptance-2026-11-16.json`: school and grade isolation, teacher-only settings, shared-section boards, personal passing targets, saved offline outbox delivery, ten concurrent terminal replays, replacement sign-in/recovery, new board versions, failure/help reset, reading/writing retries and current-access removal. Offline browser cache behavior was checked separately by the built runner. A hosted browser disconnection test is not claimed.

The release checkout starts from current `upstream/main` and preserves the deployed section-loading, vocabulary availability and recovery fixes. Three already-deployed replacement-credit migrations are included to make schema replay match production. The original working copy and unrelated edits remain preserved.
