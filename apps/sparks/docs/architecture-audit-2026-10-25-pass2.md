# Sparks second architecture pass, 2026-10-25

Scope: local source only. Preserve existing functionality, persisted identifiers, authorization, assessment rules and prior repairs. No deployment or hosted database changes. The first-pass release command passed uninterrupted with 1,165 unit tests; its evidence remains in architecture-audit-2026-10-24.md.

## Final local assessment

All confirmed urgent/high local issues found in this pass are repaired and independently reviewed. The final uninterrupted `npm run test:release` passes with exit 0 on 2026-10-25. These scores are engineering judgments grounded in the local evidence; 10/10 is not established.

| Category | Before this pass | Final local rating | Evidence and remaining limit |
| --- | ---: | ---: | --- |
| Modularity | 8.5 | 9.5 | Private teacher feature, independent class preparation/Units rendering and explicit active-attempt boundary; some legacy facades remain. |
| Maintainability | 8.5 | 9.5 | Ownership map, narrow APIs, immutable receipts, maintained SQL/SDK regressions and actual CI reachability. |
| Simplicity | 8 | 9 | Removed hidden rendering and discarded work; preserved public behavior. Legacy method groups remain a gradual maintenance concern. |
| Efficiency | 8 | 9 | Measured export payload reductions and eliminated repeated SQL work; unchanged budgets pass. Student startup retains only 3.2% budget headroom. |
| Scalability | 8 | 9 | Declared 30-student/teacher read workload passes on fixed caps; larger sustained mixed login/write loads and hosted capacity remain unverified. |
| Reusability | 8.5 | 9 | Shared domain helpers, private feature capabilities, metadata and existing authoritative permission logic; legacy coupling still limits some extensions. |
| Reliability | 8.5 | 9.5 | Receipt durability, queue causality, actor-bound writes, eligibility, timer isolation and real navigation cancellation proved through adversarial controls. Operational/device evidence remains outstanding. |
| Developer experience | 8.5 | 9.5 | Dedicated ports, strict owned servers, current-source artifact identity, documented module ownership and required release/CI gates. |

The route toward 10 is additional startup headroom, gradual removal of remaining legacy coupling as features change, and sustained multi-class/production/device acceptance. None of these is represented as already proved. The photographed hosted failure has no confirmed production root cause or live resolution in this work; no deployment occurred.

## Final integration result

- `npm run test:release`: **exit 0**, full uninterrupted run. Log: `/tmp/sparks-pass2-final-release.log`.
- **1,386 portable tests**, all source checks, database role/SDK/receipt/order rehearsals, source and built acceptance, actual Auth, Firefox/WebKit, worker upgrades, and seven responsive widths pass.
- Dependency audit: **zero vulnerabilities**. SQL lint/advisors: no errors; two existing unused-parameter/variable warnings and seven scalar-Auth policy advisories remain. The measured policy candidate did not demonstrate workload benefit and was not applied.
- Final build: student **203.4/210 KiB gzip**, teacher **164.9/180 KiB**, deployment **15.4/30 MB**. All original budgets remain enforced; student headroom below 5% remains an explicit delivery warning.
- Final 30-student plus teacher read scenario: all declared targets pass, **2,448 requests**, **864 operations**, **24/24 teacher batches**, zero errors/misses/late results, exact data and permissions. Scope and host-contention limits appear below.

Three preliminary release attempts exposed stale browser-test callers after the intentional internal API changes: an unawaited archived-route lookup, an Arcade fixture without confirmed readiness, and class/loading stubs using old cancellation/preparation contracts. The fixtures now use the actual contracts and retain all original functional/security assertions. The complete remaining source tail passed before the final uninterrupted release run. Failed logs are retained separately; no production policy was weakened to make a test pass.

## Starting assessment

Final status is recorded above. The following sections preserve the initial baseline, investigation sequence, rejected claims, intermediate blockers and acceptance evidence; earlier pending/failing checkpoints are historical rather than current release status.

| Category | Previous local rating |
| --- | ---: |
| Modularity | 8.5 |
| Maintainability | 8.5 |
| Simplicity | 8 |
| Efficiency | 8 |
| Scalability | 8 |
| Reusability | 8.5 |
| Reliability | 8.5 |
| Developer experience | 8.5 |

The aim is to remove the remaining demonstrated weaknesses. A 10 cannot be established by adding tests or assigning a higher number. Ratings will follow measurements, independent review and explicit limits. Live classroom behavior, sustained production load and availability remain unverified.

## Work order

1. Reproduce remaining reliability and ownership failures. Repair each confirmed defect and prove normal behavior plus recovery before starting the next repair.
2. Create meaningful initial-delivery headroom through cohesive deferred modules. Keep current budgets and functionality. Measure actual production graphs rather than source-line counts.
3. Optimize current RLS policies only with role/school equivalence and actual query-plan/latency evidence. Exercise a declared concurrent-class workload in an isolated local database.
4. Simplify repeated verification and lifecycle orchestration only where current callers demonstrate a concrete maintenance cost. Keep public feature interfaces small and avoid speculative abstractions.
5. Complete source, built, database, browser, dependency and responsive gates. Reassess all categories against the resulting implementation and list external evidence still missing.

## Initial candidates under investigation

- Sync actions may become permanently inaccessible after five transient failures.
- Mutable account context may redirect an asynchronous admin settings write.
- Initial student and teacher delivery use more than 99% of their budgets.
- Eight existing school-policy warnings suggest repeated per-row Auth evaluation.
- Test definitions are repeated across package scripts, CI and inventory contracts. Local verification also requires manual port selection when a developer server uses port 8000.

These are investigation candidates, not claims of a confirmed production incident. The candidates below were recorded before implementation; current acceptance evidence follows.

## Confirmed findings and repair status

| ID | Priority | Reproduction | Status |
| --- | --- | --- | --- |
| A | High | Transport failure plus IndexedDB quota failure returns null, but the coordinator retires the completion fingerprint. A healthy retry sends nothing. | Accepted. Original and newer receipts survive bounded owner-private recovery; combined production build and portable suite pass. |
| B | High | Five HTTP503 failures make a receipt failed and permanently absent from replay. At queue capacity, later work can delete that unacknowledged receipt. | Accepted. Transient work keeps capped backoff, permanent rejections stay separate, and capacity rejects new work visibly instead of deleting unacknowledged receipts. |
| C | High | Actual SDK late token selection sends an old admin's settings payload under a replacement admin's JWT. UI result guards do not protect dispatch. | Accepted. UI actor capture and owner-bound RPCs verified with actual SDK/PostgREST account-switch controls; applied locally only. |
| D | Delivery | Teacher optional roster/profile bodies have about 10.5 KiB gross gzip attribution; vocabulary editing has another about 10.3 KiB. Student view CSS and presentation/runtime offer smaller distinct opportunities. | Read-only caller mapping complete; net savings require controlled builds. |
| E | Scalability | Seven current policies repeat scalar Auth lookup; one allowlist warning already has an InitPlan with one loop. A synthetic query confirms mechanism, not app throughput. | Isolated policy equivalence and class-sized load benchmark being prepared. Do not alter row-dependent permission helpers. |
| F | Verification | Built checks can deliberately reuse an existing directory without establishing which dirty source produced it. Test definitions and port settings also repeat across callers. | Design investigation; retain all current CI gates. |

Read-only performance measurements are gross attribution, not rebuilt savings. Source, schema and fixture ownership remains explicit. Cold-Arcade confirmation and acceptance are recorded below.

## Review checkpoints

A is accepted after 154 focused controls and independent adversarial review. The review added empty-response, unexpected-rejection, overlapping-joiner and newer-draft-after-failure cases. Raw transport promises no longer escape the coordinator; the original receipt and one newer coalesced snapshot survive until confirmed/durable retirement. Payload snapshots match the JSON wire format and retained lanes remain bounded.

B review extended acknowledgement checks to activity, unit-work and Spark replay. Null/empty responses must not delete mutation receipts; unit validation must precede unit-record retirement. Definite server denials take precedence when the browser goes offline after a response. A further adversarial case showed that a newer, unpersisted unit intent could cause an older durable record to be skipped and deleted. That final retirement distinction remains under repair at this checkpoint.

A fourth high correctness issue is confirmed: cold Arcade entry, game resume and new minute requests can consult an empty required-work source before class data arrives. With delayed or rejected class reads, Arcade/game access can proceed despite unfinished required vocabulary. A synthetic network harness exercises the real controllers without changing database fixtures. Explicit readiness and owner-safe eligibility are required before performance refactoring. Existing receipt reconciliation must stay distinct from authorizing a new purchase.

Correction after independent review: the old isolated study repeated 252 baseline role/read/write outcomes, but its candidate replacement was a no-op because the deparser omitted the Auth schema qualifier. It does not establish equivalence of seven policy optimizations. No RLS repair was applied. A revised benchmark must assert exactly seven real policy changes and actual InitPlans before comparing permissions; the already-optimized allowlist stays unchanged. The larger measured cost is selected-profile export: requesting 30 currently fetches the complete school roster. At 900 students, the original query took about 2,149ms and returned 400,968 bytes. Adding the requested-ID predicate to the same projection produced equivalent selected objects/order in about 7.84ms and 12,415 bytes. These are isolated SQL measurements, not promised end-to-end application latency. All disposable benchmark databases were removed; the filtered endpoint remains a planned, unimplemented change.

Existing build validation correctly accepts the previous artifact's structure even while new source recovery logic is absent from its assets. A separate source/artifact identity check is being considered for deliberate build reuse; this does not invalidate the first pass's fresh-build release evidence.

## Queue repair acceptance and delivery checkpoint

A and B are independently accepted in source. B now distinguishes a newer RAM intent from an acknowledged or durably queued replacement. It retains the old durable record with backoff while newer work is unsaved, rather than deleting it or forcing it over a possible newer server commit. Eleven independent B probes cover null responses, business-denial recovery, owner/revision races, durable replacement, reset and backoff. The session/page-loss and cross-device conflict limits remain explicit.

The first post-queue production compilation passed the game/lazy checks but failed the unchanged student size gate: student210.8/210KiB, teacher179.6/180KiB, total14.4MB. This is an unresolved release blocker, not a successful release. Strictly Arcade/Flashcard-owned styles are being deferred through the existing retained style loader; shared startup geometry remains eager. Source changes for settings actor binding and cold Arcade readiness are still pending at this checkpoint.

## Guarded settings acceptance and next work

C passed independent review: 50 focused/session/readiness controls plus actual SDK/PostgREST actor-switch and delayed-token deadline rehearsals. Settings and school-year writes now bind the captured UI actor before waits and enforce it again in invoker RPCs before private mutations. Calendar save and archive/reopen callers carry their guards/signals; normal same-session Auth events remain valid. The local definitions were applied atomically through a direct query, with no migration-history entry. All seven local readiness probes pass, and normal audit control data was rolled back. Hosted state is unchanged. The new database rehearsal is required in both release and actual CI.

The strict view-owned CSS deferral restored the original delivery gate to student209.4/210KiB, teacher179.6/180KiB, total14.4MB before C. Source and built cold/warm comparisons had zero computed-style differences across eight captures; teacher preview waited for held CSS, and failed CSS blocked initialization. This is gate restoration, not sufficient startup headroom for a top efficiency rating.

The cold Arcade readiness repair is now the active implementation. Separately, the selected Arcade card itself clips text and Play at mobile widths. An isolated CSS prototype eliminated that overflow for all 20 games plus Resume while preserving desktop bounds; it remains a planned separate repair. The serial queue drain's long-stall/fairness limit is also being measured separately.

## Arcade eligibility and receipt acceptance

G is independently accepted. Arcade entry, launch/resume/restart and new minute purchases now await owner/school/class-scoped readiness and confirmed required-work eligibility. All waiters settle on timeout, and navigation or ownership changes invalidate late class results and game imports. Error routes destroy active activity resources and cancel pending launchers.

A pending local purchase is an uncertain intent, not proof of payment. The new `recover_student_arcade_minute_owned_v1` RPC performs receipt lookup under the same event lock without falling through into spending. An existing paid receipt recovers once even when requirements block new purchases; a confirmed missing receipt must pass eligibility before retrying its original stable intent. Unknown, malformed and failed lookups retain the intent and cannot authorize a debit. Disposable READ ONLY transaction controls prove lookup does not modify receipts, wallets or ledgers. Concurrent original commit, late replacement JWT, original pricing and ACL controls pass. The migration must precede frontend publication.

Combined verification at this checkpoint: 1,257 portable tests, 116 focused checks, 14 source plus 14 built eligibility scenarios, source/built navigation and nine workflow contracts pass. Production budgets remain unchanged: student 214,888/215,040 bytes gzip, teacher 184,291/184,320 bytes gzip, total 14.4 MB. This leaves insufficient delivery headroom and is not a final efficiency rating. The eighth function is applied locally and all eight readiness probes pass. Rollback-only controls preserve full wallet/receipt/ledger snapshots; migration history and eight legacy ACLs are unchanged.

H is the next bounded repair: selected Arcade card contents clip at 320–430 px. Only the existing mobile card rules will change; desktop geometry and all game controls require regression proof.

The existing real-backend Arcade fault smoke exposed an integration gap after G: its artificial purchase manager supplies no class-readiness capability, so access correctly stops before creating a pending purchase. Its old replay expectation also counts a second spending endpoint call. This gate is being updated to establish actual required-work readiness and verify the new lookup path; the earlier synthetic G results do not substitute for this gate.

## Remaining bounded repairs and acceptance criteria

- **School snapshot projection:** construct only the four fields already returned, eliminating discarded reward/history construction. Preserve all educational CTEs, authorization, membership overrides, NULL behavior, signature, owner and ACL. Compare both public callers with exact JSON hashes across permitted and denied roles; demonstrate removal of the ledger subplan.
- **Selected-profile export:** a separate owned RPC filters requested IDs before expensive school membership checks and JSON aggregation. Preserve the complete selected set and legacy SQL ordering; no arbitrary cap or batching. Empty selection performs no network request. Capture teacher/school before waits; reject late replacement JWT at the server and prevent dispatch after timeout. Compare 30-of-300, 30-of-900 and whole-roster results and payloads.
- **Initial delivery:** defer cohesive roster/profile and vocabulary presentation behind existing teacher feature lifecycle. Keep session invalidation synchronous and required data interfaces available independently. For students, separate class preparation from hidden Units rendering before moving view/runtime code. Judge net rebuilt delivery and actual cold/held-import behavior, not gross source attribution.
- **Queue responsiveness:** preserve normal request deadlines and durable receipts. Bound work started in a drain cycle, preserve per-unit causality, prioritize independent untouched work over stalled retries, and coalesce same-owner generation changes without overlapping duplicate drains. Test many stalled lanes plus newly queued healthy work and owner replacement.
- **Build reuse:** distinguish artifact structure from freshness. A future identity check must cover dirty source and emitted content, reject changed/deleted inputs and modified outputs, avoid secrets, permit legitimate retained old assets, and not mistake freshness for release approval.
- **Local test ergonomics:** use dedicated default test ports rather than the development server port while preserving explicit external-server validation and refusing to kill or reuse unknown listeners.

Independent H review expands its acceptance matrix to breakpoint/tablet widths and constrained heights. A 761px scrollWidth excess is under investigation: visible text and Play bounds fit, so the metric alone does not establish content clipping. CSS expansion requires an actual visible defect.

## Responsive acceptance

H production CSS is independently accepted: all 20 unique games plus Resume at 320/760/761/768/820/1024/1280px and 480px screen height pass two-dimensional text/art/counter/button containment, document bounds, touch targets and actual text-line/control hit tests after scrolling. Additional 600px-height controls pass. Before/after computed captures show zero desktop or Flashcard changes. The 761/768px scrollWidth excess is confirmed to be padding, not visible clipping, so no tablet CSS expansion is justified. Maintained source/built regression checks are being strengthened with these boundary and ancestor-clipping controls.

The next production repair is the narrow school snapshot projection optimization. The profile endpoint, RLS changes, delivery extraction and queue drain remain separate later repairs.

## Snapshot and local test ergonomics acceptance

The school snapshot projection passed root's independent rehearsal: 143 SQL and 130 actual SDK/PostgREST cases retain exact values, order, NULLs, errors and authorization; function metadata, every other function and ACL remain unchanged. The executed baseline ledger subplan is absent from the candidate. Source and release/CI registration are accepted; local-only definition application is being verified. No latency gain is claimed during concurrent work.

Nine legacy browser checks now default to the dedicated ports already used by CI instead of 8000. Explicit port/base-URL settings and owned-listener checks are unchanged. Eight server-ownership controls pass. Actual default shell and teacher navigation checks pass while an independent listener occupies 8000; its response remains identical afterward. No extra server abstraction or automatic foreign-listener reuse was introduced.

## Integrated real-backend Arcade and responsive gate acceptance

G now passes the existing four real-backend fault cases against both source and production output: lost response/reload, concurrent stop, sign-out during purchase and quota failure. The test uses actual class readiness, required-work completion and server pricing. Paid recovery performs one spend, one replay-only lookup and one debit. A strict known-fixture helper snapshots and restores only the dedicated audit student's normalized progress; balances/receipts and progress restoration readbacks pass. The integration fixture failure was an additional current-month audit assignment created by the class-selector suite, not a completion-policy defect. No production gate was relaxed.

The maintained H source and built checks now cover all 20 unique games plus Resume at 320/360/390/430/760/761/768/820/1024/1280px and 480px height. They verify two-dimensional text/art/counter containment, text-line hit tests through ancestors, document bounds, touch targets and both carousel directions. Original desktop/Flashcard computed parity remains exact. Build remains 214,894/215,040 bytes student, 184,291/184,320 bytes teacher and 14.4 MB overall.

The school snapshot optimization is applied locally after independent acceptance. Exact function body/owner/ACL, all other function definitions and migration history are preserved; rollback-only normal/denied controls pass with no synthetic users remaining. Selected-profile export is the active next production repair.

## Selected-profile export acceptance

Root independently reran the frozen SQL/SDK rehearsal with exit 0: 52 SQL plus 52 actual SDK role/selection cases preserve exact legacy profiles and global ordering. Selected 30-of-300 returns 12,334 bytes instead of 123,728; selected 30-of-900 returns 12,256 instead of 369,760. Full 900 selection remains exact in one request. These are actual JSON payload measurements, not latency promises. A delayed same-user refresh succeeds; a replacement JWT from another authorized teacher in the same school reaches the owned RPC and receives 403/42501. Legacy definitions/owners/ACLs remain unchanged; all disposable resources are removed. The ninth readiness function and required release/CI rehearsal are registered. Local-only application is being verified separately.

## Queue ordering and drain repair

Further actual SDK/PostgREST/IndexedDB reproduction confirms two ordering defects: equal-millisecond enqueue timestamps can reverse receipt order, and coalescing unit A into later unit B retains A's old position ahead of intervening activity C. Replaying B then C rewinds the newer local Flashcards review state; the next normal unit save persists that rewind. Replaying the same immutable receipts C then B preserves the newer state. This is a result-application/next-save defect, not a direct activity RPC overwrite of the state table.

The active repair assigns durable order atomically in the existing enqueue transaction, moves meaningful coalesced replacements to their true position, and keeps immutable retries in place. Legacy ordering receives a stable fallback; historical ties cannot be reconstructed. A small internal scheduler will preserve unit/activity causal heads, bound starts per cycle, give new independent work access without starving old retries, and serialize same-owner generation follow-up. Normal 30-second request deadlines, durable receipt identity, revision checks and earlier A/B guarantees remain acceptance requirements.

## RLS evidence correction

Independent review found identical `policiesBefore` and `policiesAfter` in the old temporary benchmark: it searched for `auth.uid()` while PostgreSQL deparsed the expression as `uid()`. The 252 matching outcomes prove baseline reproducibility only. The earlier candidate-equivalence claim is withdrawn. Existing local policies remain unchanged. The synthetic scalar-UID mechanism result is not application throughput evidence. A revised maintained benchmark must assert the exact expected changed policies, preserve roles/commands/permissiveness/grants/row-dependent helper logic, and demonstrate the intended InitPlan before equivalence or performance claims. The allowlist already has its JWT InitPlan and requires no change.

Selected-profile local application is accepted: exact reviewed definitions and execution metadata, expected local default ACLs, unchanged legacy definitions/history, rollback-only permission/JSON controls and all nine actual local readiness probes pass. No fixture users remain.

## Queue independent-review checkpoint and delivery blocker

Adversarial review extended the queue repair before acceptance. An activity acknowledgement at the cycle boundary must protect both a later durable unit successor and a newer RAM-only draft. Online startup must restore owner-scoped pending educational work before replacing/persisting cloud units; a newer current-session RAM intent remains protected even if concurrent acknowledgement retired its old pending row. Scores, rewards and best-attempt details remain authoritative. Empty state maps deliberately clear state; absent/null state maps make no state intent. Read failures do not acknowledge receipts. Background startup/online/retry failures now have owned exception boundaries; stale reads cannot update a replacement owner's status.

The frozen source passes 134 focused controls plus an actual SQL/SDK rehearsal, including fresh cloud startup/maps reset, a cycle boundary leaving B pending, normal next-save preservation, and RAM transport+quota failure. Final independent reruns are active.

The combined diagnostic build fails the unchanged student delivery gate: 216,644/215,040 bytes gzip. Teacher passes at 184,287/184,320 bytes, total deployment 14.5 MB. This is a release blocker, not release success. Next delivery repair uses real owner-scoped class preparation/Units presentation and active-attempt boundaries; required Auth/QueryCore will not be hidden behind immediate extra requests. Candidate gross body savings are not final build savings.

## Queue source acceptance

Final independent review accepts the queue repair: 137 focused controls and all six adversarial probes pass, including cycle-boundary successor projection, actual online cloud reload, stale-owner status, retired pending work/newer RAM, newer durable precedence and disposed retry-observer containment. Equal or newer committed durable snapshots win over older RAM; strictly newer RAM wins, and a known newer RAM intent remains protected after its prior queued row retires. Historical legacy timestamp ties remain unrecoverable and use stable fallback.

The maintained real SQL/SDK rehearsal preserves the newer review position through actual normal subsequent server save. Queue records, event identity and revision safeguards remain intact. Failed background work is reported; explicit awaited errors remain observable. No new IndexedDB store/schema version or server mutation policy is introduced. Current-source size remains a release blocker; the next authorized repair is only the data-preparation/Units-presentation seam. Active runtime, teacher roster/profile and any RLS production change remain separate later repairs.

## Units boundary acceptance

The Units-only repair is accepted after 1,308 portable tests, 135 focused controls, independent review and source/built browser proof. Auth/init no longer paints hidden Units; data preparation belongs to VocabularyData, and direct non-assignment lookup is asynchronous and independent of rendering. Shared labels/preloading stay available without Browser. Class-data preparation has a settled deadline and exact shared-read cancellation; Units consumes one prepared lease rather than invalidating it by rereading after a slow import. Navigation cancellation cannot rewrite a newer route, previous-account cards clear before any wait, and view toggles enter through the owned boundary. Unused Browser forwards and the presentation-populated lookup cache were removed.

Actual source/built proof covers cold Home/Sparks/Arcade/activity without Browser demand import or hidden Units paint, one retained Units load, warm reuse, held-import cancellation, missing-module recovery and actual teacher iframe Flashcards menu/style behavior. G eligibility/navigation, source/built published-unit Matching flow at seven widths, preview recovery and all six real-local startup faults pass.

Frozen build: student 213,159/215,040 bytes gzip, a real 3,485-byte reduction from the queue baseline; teacher 184,610/184,320 bytes, a 290-byte release blocker from gzip fragmentation after correct deferral. Budgets remain unchanged. Cold demand-import measurements block service workers; full background offline precaching intentionally remains unchanged. See `docs/student-units-loading.md`.

Next authorized production repair is the teacher roster/profile private feature, preserving synchronous reset epochs, headless data/error semantics, class membership/navigation guards and disabled legacy policies. Active student runtime and vocabulary editing remain separate later work.

## Teacher roster/profile feature acceptance

The teacher feature is accepted after 1,321 portable tests, retained roster/profile/export/group proofs, new boundary controls, independent review and actual source/built shell tests. A private context owns roster/profile/page/CSV/coin implementation, listeners, timers, charts and request generations. Its method groups are installed synchronously on the private class; TeacherManager exposes only lazy UI entries, a strict headless data bridge, synchronous reset epochs and read-state accessors. Held imports cannot create an obsolete-owner context; school/account reset works even before the feature was loaded. Export loads return data/errors independently of view navigation. Whole data reads settle on deadline, cancel QueryCore/transport and cannot populate snapshots/cache late. UI promise boundaries contain cancellation/read errors, and static/dynamic retained controls abort with the feature. Legacy Create/Reset policies remain disabled.

Real source authentication and cold enrolled-student profile pass; all 14 private-classroom checks pass against source and built output. Initial bytes are student 213,153/215,040 and teacher 168,878/184,320: a real 15,732-byte teacher reduction from the post-Units graph and 15,442-byte headroom. Both unchanged entry budgets pass; deployment is 14.5 MB.

The expanded built authentication check revealed an older delivery defect: `/vocabularies/manifest.json` was omitted by the asset copier. Profile assertions passed, but strict earlier library navigation correctly failed on 404. Its separately accepted repair follows below.

## Catalog delivery acceptance and quiet diagnostic window

The asset copier now packages exactly the manifest and its 224 validated referenced JSON files, including all 83 deliberately listed retired sets. All 225 output files preserve their original 746,335 bytes; no normalization or unreferenced archive-directory copying occurs. Unsafe/duplicate paths and IDs, manifest self-listing, source/output symbolic links and destination hard links fail before source can be overwritten. The explicit built validator checks completeness, exact bytes and absence of unlisted catalog files.

Independent filesystem probes and 28 independent checks pass; the full portable suite passes 1,343 tests. Actual source/built teacher library and current/retired material loading pass. The formerly failing strict built real authentication/enrolled-profile gate now passes without filtering 404s, and its owned-preview mode is required in both release and actual CI. Current-window temporary class users, allowlist records and schools are cleared; unrelated October 8 fixtures remain untouched.

The accepted build is 15.2/30 MB with student 213,153/215,040 bytes and teacher 168,878/184,320 bytes. Worker policy and budgets remain unchanged. No deployment occurred.

The next production repair separates active student attempt execution from eager result application, durable recovery and reset. During its source-only phase, a quiet diagnostic window is authorized for exactly four isolated stages: one student baseline/candidate, then 30 students with one teacher baseline/candidate. Each stage retains 30-second warmup, 120-second measurement, the previously declared SLO and fixed DB 0.5 CPU/512 MiB plus gateway 0.25 CPU/128 MiB/pool 10. Startup initialization/row-lock work is excluded from pure-read throughput. These constrained local results cannot establish hosted capacity. Other tests/builds/browser runs are suspended during measurement; no 90-client stage or further repetitions are authorized yet.

## Runtime and artifact checkpoint

The active-attempt boundary passes 1,380 portable tests, independent runtime/write/timer/attempt controls, eight source and eight built browser cases, and the unchanged production build gates. Home, Units, Sparks and Arcade do not acquire the engine; actual activity construction waits for it, including teacher preview overrides and synchronous constructor callbacks. Result replay stays eager with its local-state preservation options. A real late-A/current-B reproduction also exposed and repaired a timer race: A's accepted result/receipt remains valid, but cannot finish B's timer or display A's activity XP popup. Positive unchanged-A completion still finishes normally.

Acceptance was then withheld after independent real-router adversarial probes found stale navigation continuations that the earlier held-browser test could hide by waiting for the 10-second deadline. Releasing a held runtime immediately after Home intent can still verify/construct A; releasing held vocabulary can let the parent start A under the newer Home signal; an old Illustration continuation can rewrite Home's URL after its inner launch cancels correctly. These are confirmed high issues under repair. Required proof includes prompt cancellation, immediate release, same-hash round trips, parent continuation ownership and normal Illustration word routes/callbacks.

The combined build is student 208,162/215,040 bytes gzip (4,991 fewer than the accepted catalog baseline), teacher 168,888/184,320 bytes, deployment 15.4 MB. Deferred engine gzip is 7,511 bytes. Cold demand measurements block service workers; the unchanged worker still precaches its complete offline graph. Built real-backend fault controls and independent adversarial review remain underway at this checkpoint.

Artifact freshness passes 20 independent filesystem/Node cases and the actual combined build. The wrapper preserves all original build steps and size gates, verifies stable input/public-configuration digests before/after generation, and records exact emitted hashes. Owned previews and the worker-lifecycle original artifact verify that identity before reuse. Independent actual-build verification covers 1,263 input files and 695 output files. This establishes freshness, not release/deployment/security attestation; see `docs/build-artifact-freshness.md`.

## Constrained workload outcome

Runtime final acceptance supersedes the preceding checkpoint: independent review passes 120 focused controls and all actual-router adversarial chains. The full portable suite passes 1,386 tests. Source/built 11-case runtime checks, real-local six-fault startup, built Units (8), navigation (3) and Arcade eligibility/recovery (14) pass. Illustration canonical word normalization now belongs to its launcher, preserving normal word changes and save callbacks while refusing stale external navigation. Native guide focus, rather than lost persisted data, explained the intermittent new typing control; the maintained test dismisses the actual guide and proves field focus/value before typing. Three consecutive preview/Word Hunt pairs then pass.

The authoritative production graph after navigation repair is student **208,246/215,040** bytes gzip (4,907 fewer than the catalog baseline, 6,794 headroom), teacher **168,888/184,320**, dynamic engine 7,512 bytes, deployment 15.4 MB. Earlier 208,162-byte results are superseded. Build/default-fixture ownership is released; no hosted operation occurred.

All four stages completed with exact result hashes, unchanged fixtures, no HTTP errors and no ownership/content/resource-stop failure. One-student baseline and candidate each completed 80 requests; navigation p95 was 128.5 ms and 95.0 ms respectively. These are paced workloads, not maximum-throughput measurements, and a single pair with background activity cannot establish a speedup.

Both 30-student plus teacher stages failed their predeclared targets. Each completed 2,440 requests over 120 seconds, with four explicitly counted missed teacher refresh slots out of 864 accounted operations (0.463%, above 0.1%). These are backlog failures, not missing telemetry. Baseline student navigation/read p95 was 1,862/792 ms; candidate was 2,879/994 ms, with the candidate exceeding the 2,500 ms navigation target. Completed teacher progress requests in baseline had p50 3,657 ms and p95 5,365 ms; selected-profile requests had p50 41 ms and p95 437 ms. Scheduled teacher p95/p99 includes the missed-slot 10-second failure sentinel and fails both variants.

DB/gateway stayed within their fixed memory limits; DB CPU approached its half-core cap. Seven real scalar-policy changes preserved role behavior but did not demonstrate workload improvement. No policy change is accepted or applied from this comparison. Investigation now targets the observed teacher progress query, rather than treating advisor warnings as throughput evidence. The isolated diagnostic remains separate from login/initialization, mutation, production, network and physical-device capacity.

## Targeted progress-query acceptance

Actual transaction-local function statistics traced the teacher delay to duplicated snapshot construction and repeated authorization, rather than JSON construction. `20261025180705_materialize_school_progress_batch_once.sql` materializes each eligible student's existing snapshot once before output/NULL filtering. Independent normal-local rehearsal passes 234 SQL and 221 actual SDK cases across 13 roles with exact ordering, NULLs, limits, profiles, nested data and errors. Executed snapshots fall from 60 to 30 for 30 selected students. The snapshot body and all other definitions/owners/ACLs remain unchanged.

The separately accepted `20261025182252_deduplicate_school_snapshot_assignment_checks.sql` collects distinct student/assignment keys within one school snapshot call and evaluates the original permission helper once per key. It introduces no application permission cache or inferred membership rule. NULL-safe lookup preserves each original row predicate. Normalized educational projections, joins, order and final clauses are byte-identical. Independent normal-local rehearsal passes 273 SQL and 260 SDK cases across 13 roles, including reachable duplicate/NULL/denied keys and existing trigger/FK enforcement. Executed permission checks fall from 100 to 10 for one student, 115 to 13 for mixed keys and 2,990 to 300 for the rich batch. The accepted wrapper still executes exactly 30 snapshots; the helper, self snapshot and every other function/ACL remain unchanged.

Both definitions are applied locally in separate atomic statements with exact-body/full-function-contract/other-definition/ACL/history assertions and independent readback. Migration history is not rewritten; user data and hosted state are unchanged. Both maintained rehearsals are required in local release and actual CI, with reachability contracts. See `docs/school-progress-batch-evaluation.md` and `docs/school-snapshot-assignment-permissions.md`.

The final timed candidate was rebuilt from a full baseline database clone after preflight detected independently seeded platform-admin/realtime timestamps in the old variants. All 85 table counts/content hashes, policies, privileges and RLS flags now match without exclusions. Exactly the two accepted function bodies differ, with other metadata unchanged. Original evidence remains intact. The final comparison retains the original driver, workload, caps, warmup, measurement, deadlines and SLO; no capacity or latency conclusion is accepted before those results.

## Repeated aggregation and final workload preparation

The next candidate attempt produced no measurement because its gateway started before its database network was attached; the initial TCP connection timed out. Startup ordering now creates the container, attaches both networks, then starts the process. Separate real boots become ready in 328/393 ms under the unchanged 10-second setup limit, with no OOM/restart/data changes. Only that setup line changed in the benchmark driver; the two maintained optional isolated rehearsals use the same ordering. Workload, deadlines and SLO stay unchanged. Old driver/reports remain retained.

The subsequent pair is explicitly contended: unrelated containers consumed substantial CPU in baseline. The two-repair candidate still fails its fixed targets: navigation p95 3,385 ms, reads 1,298 ms, teacher batches 5,815 ms and one missed batch (1/864 operations, 0.1157%). It returns exact data with no HTTP error, late completion or integrity/ownership failure. These results do not establish a clean causal latency comparison and are not relabeled as a pass.

Read-only diagnosis then finds a separate actual query defect: each school snapshot rebuilds its activity/state aggregates once per unit. For 30 students with 10 units and 8 activity rows per unit, attempt JSON construction runs 48,000 times rather than the required 4,800. Migration `20261025190430_materialize_school_snapshot_activity_groups.sql` changes exactly two `AS MATERIALIZED` annotations. Independent normal-local rehearsal passes 273 SQL and 260 SDK cases across 13 roles, exact JSON/NULL/order/errors, full-body normalization, double application and all function/policy/RLS/relation/column privilege guards. Executed aggregate loops fall from 10 to 1 and attempt JSON calls from 1,600 to 160 per student (48,000 to 4,800 per batch). Permission checks remain 300 and batch snapshots remain 30. Its maintained gate is required in release and actual CI.

The third definition is applied locally with atomic exact-previous-body/full-contract/other-function/ACL/history assertions and independent readback. Adjacent account-self startup is checked rather than blindly changed: rollback-only probes in the same fixture show its two aggregates already execute once and its 160 attempt-JSON calls do not improve with materialization. Its required wallet/XP/version fields and definition remain intact. This does not prove self latency at other cardinalities.

The final comparison requires three consecutive external Docker CPU sums below 10%, at least five seconds apart, before each stage. A failed preflight is retained; a later qualifying observation permits the unchanged baseline/candidate workload. This establishes observed preflight conditions, not continuous dedicated-host isolation. Source and test settings remain frozen during measurement.

## Final class service-target result

The last baseline reproduces four missed teacher batches while student targets pass. The final repaired candidate meets every unchanged target:

| Measure | Observed p95 / p99 | Required p95 / p99 |
| --- | ---: | ---: |
| Student navigation | 1,881 / 1,891 ms | 2,500 / 5,000 ms |
| Student reads | 791 / 1,190 ms | 1,000 / 2,500 ms |
| Teacher batch | 2,124 / 2,196 ms | 3,000 / 5,000 ms |

All 864 operations and 2,448 requests are accounted for over the full 120 seconds: 24/24 teacher batches, zero errors, missed slots, late completions or changed results. The paced offered rate is 20.4 requests/second, not maximum throughput. Dataset, roles, caps, workload, deadlines and SLO remain unchanged. DB peak is 275.7/512 MiB; gateway peak is 65.75/128 MiB, with no health stop.

Postflight verifies all 85 table hashes in both variants, every policy/privilege/RLS flag, unchanged baseline definitions and exactly the accepted two differing function bodies in candidate. Guarded cleanup removes the owned DB/gateway containers, two networks and data volume. Independent Docker verification confirms all five resources absent; private gateway credential/env files are removed. Reports, scripts, failed observations and redacted logs remain retained. No other containers are stopped or reconfigured.

The candidate's qualifying external-CPU observations were 1.45%, 4.01% and 2.36%; the driver's later before/after snapshots were 22.35% and 2.56%. Consequently this is an observed service-target pass under the stated local setup, not continuous host isolation, a clean paired latency-effect estimate, a sustained maximum-capacity test, or hosted/device acceptance. All earlier failures and the failed startup remain retained. Authoritative reports are `timed-30-baseline-1792956052983.json` and `timed-30-candidate-1792956278648.json` under `/tmp/sparks-rls-acceptance-20261025/`.
