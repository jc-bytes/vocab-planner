# Sparks architecture audit and repair plan

Audit started 2026-10-07. Scope: current local checkout, including existing uncommitted work. No hosted database mutation, commit, push or deployment.

## Architectural assessment

Keep the existing modular JavaScript application. Activity/game registries, lazy teacher feature factories, domain repositories, scoped server-state caching and semantic CSS provide useful boundaries. The demonstrated defects concern persistence ordering, lifecycle ownership, complete collection reads and verification coverage. A framework rewrite or splitting files solely by length would not resolve them.

Specialist reviews covered data/session/offline behavior, frontend lifecycle and delivery. Repairs proceeded one at a time, with focused behavioral verification and independent review before advancing. Existing routes, storage-owner boundaries, server authorization and rewards, and delivery budgets remain constraints.

Static import inspection found 347 JavaScript modules, 697 static edges and no static initialization cycles. Dynamic import edges were excluded from that cycle judgment. These counts describe the system; they are not architecture scores.

## Quality review

| Quality | Current strengths | Changes justified by this audit |
| --- | --- | --- |
| Modularity | Activity/game registries, teacher factories, domain repositories | Keep queue transactions, retry ownership, scoped query lifetimes, and DOM/model lifecycle separate. No new feature framework. |
| Maintainability | Ownership guide, explicit feature cleanup, contract tests | Replace brittle roster source matching with a behavioral failure test; make the current audit the entry point. |
| Simplicity | Vanilla multi-page app and narrow feature APIs | Keep repository array returns and existing routes. Use existing IndexedDB, Query Core and Supabase libraries. |
| Efficiency | Dynamic imports, bounded query caching, build budgets | Coalesce redundant unit snapshots only after checking merge semantics; avoid overlapping drains and repeated unit execution. |
| Scalability | School scope, server authorization and paged student summaries | Page assignment/response collections rather than relying on the API row limit. Full collections remain a future UI paging concern. |
| Reusability | Shared feedback editor, UI primitives, semantic CSS and activity metadata | Repair the shared editor once for both profile and assignment review. Share collection paging within the owning repository. |
| Reliability | Server-authoritative rewards, account guards and revision-aware feedback | Repair offline lost updates, retries, durable-storage errors, stale feedback models, school-cache contamination, obsolete previews and concurrent Arcade starts. |
| Developer experience | Extension map, focused commands and lazy/build validation | Automatically discover portable unit files, explicitly classify database tests, include insight browser/database checks in release validation. |

## First-pass high-priority repair sequence

No critical exploit or confirmed production outage was established. The first pass demonstrated six high-priority findings in code or reproducible local sequences. The second pass below demonstrated four more; all ten were repaired and locally verified. The third pass below adds four more verified repairs.

| ID | Finding and consequence | Repair | Local status |
| --- | --- | --- | --- |
| SA-01 | Older replay could delete, overwrite or resurrect a newer queue record. | Atomic enqueue/deduplication/capacity transaction; persisted revisions; conditional completion/failure; preserve newer Spark answers. | Verified |
| SA-02 | Retry deadlines lacked wakeups; late previous-account work could cancel the current timer. | Queue-owned bounded timer, one drain per owner/generation, teardown cancellation, ownership validation before timer replacement. | Verified |
| SA-03 | Repeated snapshots filled the queue; storage errors could claim saved locally; old queued work could overwrite a newer successful save. | Coalesce complete unit snapshots, preserve immutable attempted payload/receipt and original unit, order direct/replayed writes, retire old persisted snapshots after confirmed success, surface storage failures. | Verified |
| SA-04 | Default/release commands omitted tests; database rehearsal depended on a fixed setup. | Portable discovery, explicit integration gates, preserved script checks, permission-preserving disposable rehearsal, CI insight database gate, authority-aware Spark fixture. | Verified; content baseline blocks whole release |
| SA-05 | Complete collection reads could silently stop at the API row cap. | Stable scoped pagination for assignments, responses, subjects and publication materials; cancellation/error propagation; lazy student assignment repository import. | Verified |
| SA-06 | Filtering detached an in-flight feedback editor, suppressing model reconciliation and leaving stale revisions. | Current-owner reconciliation independent of connection, stable editor identity through filters, preserve newer drafts. | Verified |

### Persistence guarantees and limits

Unit work is a cumulative snapshot. The function `private.upsert_student_unit_work_v3` in `20260816054503_direct_normalized_student_progress_operations.sql` merges ordinary work fields and replaces the complete activity-state map. This supports unit snapshot coalescing; activity completion, rewards and Spark actions keep their separate policies. Legacy revisionless queue records remain readable without a schema upgrade.

New snapshots receive fresh event receipts; retries retain the exact attempted receipt and payload. Capture order prevents enqueue arrival from choosing an older snapshot. Confirmed newer success retires only strictly older snapshots or the same event, preserving ambiguous equal-order peer events. Direct and replayed unit writes share a per-owner/unit lane across account generations; settled lanes are removed.

Independent reproduction with real ImageDB and fake IndexedDB: old A fails and queues, new B succeeds, queued count falls from one to zero, restart retains new B and sends no stale A replay. A previous account's delayed enqueue also leaves the current retry timer unchanged. Unit RPCs reuse the existing 30-second timeout and Supabase abort signal.

Client lanes do not impose server compare-and-set ordering across tabs/devices. HTTP abort does not prove a server transaction did not commit. Distributed ordering requires separate server protocol and compatibility work. See official [abortSignal documentation](https://supabase.com/docs/reference/javascript/using-modifiers-abortsignal).

### Collection guarantees

Callers still receive arrays. Pages retain captured scope, abort signal and stable primary/unique tie-break ordering. An error or cancellation rejects rather than returning a misleading partial collection. Actual received-row offsets plus first-page count handle a server cap lower than the requested page size. Tests cover 1,201 rows at a 123-row cap. This proves a scale-dependent correctness defect, not missing live student work. See official [range documentation](https://supabase.com/docs/reference/javascript/range).

School roster/dashboard and several metadata RPCs return JSON aggregates; their embedded arrays are not truncated by the PostgREST row cap. Other plain-table lists warrant review when actual scale and caller contracts justify it.

## First-pass verification

Baseline direct discovery ran 795 tests with four failures and three skips. Two failures needed a matching local Supabase schema, one was a stale roster source assertion and one was the frozen Week 1 checksum. Matching Playwright Chromium was installed to enable browser verification.

After all six repairs and final refinements:

- Portable discovery: 830 tests, 829 passed, one existing Week 1 checksum failure; no skips.
- Final queue specialist checks: 72 passed. Root storage/write/client subset: 53 passed. Independent reviewer subset: 58 passed, plus both original replay/restart and timer reproductions.
- Repository/lazy-boundary checks: 114 passed, including lower API caps, cancellation and page failure.
- All 21 default script/browser workflows passed again after all repairs, using isolated ports for configurable teacher and student-shell checks. The earlier Spark fixture correction supplies actual school authority; production authorization was unchanged.
- Insight database authorization/revision/history: 2/2 against an older-source clone and 2/2 against an already-applied clone. Rehearsals preserve original owners/grants, seed explicit fixtures and remove disposable databases. No shared database reset.
- Real local PostgREST school authority/invite/concurrency rehearsal passed.
- Assignment, class-workspace and student assignment/context browsers passed. Insight browser passed graphs, notes, revisions, mobile layout and stale-profile checks.
- Student shell passed nine widths and six views on an isolated port. An initial default-port run reused another running server and failed; verification must identify its server.
- Built entry-point smoke passed. Arcade checks passed 52 sprites, Flappy animation/load failures and Whack-a-Mole input at 800/600/400 px.
- Production build passed assets, lazy graph and unchanged size gates: 13.8 MB deployment; student 209.1/210 KiB gzip; teacher 179.4/180 KiB; Quiz Maker 125.9/130 KiB.
- Production dependency audit: zero high/critical findings, one low DOMPurify advisory.

Final SA-06 verification: 29 focused tests passed, including six shared-editor regressions. Assignment review and student insight browsers passed real filter-away/back, detached saves, persisted revision advancement and draft preservation. Editor maps are scoped to the loaded workspace/profile generation; stale owners cannot reconcile. Both saves and explicit note reloads preserve edits typed after the request starts. The final build retains the reported budgets.

Root independently reran the final editor/model subset: 10/10 passed. Final portable discovery runs 830 tests: 829 pass, and the unchanged frozen Week 1 checksum is the sole failure. Final built entry-point smoke, Arcade gameplay and all 21 default script/browser workflows pass after the feedback repair. Whole npm test/test:release remains blocked by the preserved content guard; those commands are not reported as green.

## Release blockers

1. **Frozen Week 1 baseline:** current Grade 8/9 content differs from recorded release hashes. Grade 8 part 1 actual hash is `1f0943bce43dd274ba36c1413484d5790cb5b2e5d39c529d80f8adee47eb5e02`; expected is `163f5df271a548b1a71b132fe452ae19a54a95545d6a58a30e9d56bec35f929d`. Files and fixture hashes remain unchanged by this audit. Determine whether edits were approved before restoring content or changing the baseline.
2. **Default local acceptance schema:** the existing default database lacks schema required by two acceptance suites. Disposable rehearsals passed, but do not make those default suites green. Match the intended integration environment without resetting shared projects.
3. **Production acceptance:** hosted migration parity, authenticated live accounts, physical devices and deployment are unverified. No whole-release success is claimed.

## Medium follow-up plan

- Recover bundle headroom through genuine optional feature boundaries before adding eager features. Keep existing limits.
- Replace permissive browser readiness checks with owned strict-port Vite servers and awaited cleanup across affected callers. Explicit external-server mode must verify identity and reject unrelated 404 listeners. Until then use isolated ports and leave others' servers running.
- Measure large collection rendering and page the UI when needed; repository completeness does not bound memory for arbitrarily large collections.
- Reproduce cross-tab/uncertain-commit unit ordering against the server before proposing a compatible versioned-write protocol.
- Keep the four-version worker browser rehearsal in default and release verification; retain old immutable host assets for the initial repaired-worker rollout.
- Maintain ownership guidance and the verification inventory as features evolve. Avoid base classes, new repositories and generic lifecycles without a shared behavioral responsibility.

## Second audit pass

Requested after the first six repairs. Rechecked current dirty source, portable test discovery and dependency audit, then reviewed school/cache isolation, request ordering and delivery independently. Fresh portable baseline remains 829/830, with only the frozen content guard failing. Production dependencies still have no high/critical advisory.

| ID | Priority | New evidence | Repair plan | Status |
| --- | --- | --- | --- | --- |
| SA-07 | High | A refresh captures school A's cache key, yields during cancellation, then dispatches its dynamically scoped request after switching to B. Real QueryClient reproduction stores B data under A even with school-switch account clearing. | Capture school/account/generation context and cancel obsolete refreshes and deferred/retried query dispatch before they can populate the wrong key. Preserve account-wide clearing and existing query interfaces. | Verified |
| SA-08 | High | Same-class assignment A request finishes after newer B has opened; old preview replaces B and removes its unsaved response. Whole-view generation does not distinguish assignment clicks. | Per-class preview request identity, cancellation and current-preview guards; verify out-of-order reads, drafts, account replacement and teardown. | Verified |
| SA-09 | High | An old Arcade purchase resolves after account replacement and writes its wallet into the replacement account's progress, including local persistence. Actual imported access module reproduced this. | Capture account/progress/session ownership at entry and reject stale results before wallet, time or header mutation, including settings UI continuations. | Verified |
| SA-10 | High | Concurrent Play requests purchase two minutes, overwrite the timer with one minute and launch in response order. Each RPC has a different receipt, so server idempotency cannot collapse them. | Single active start operation, visible pending state and stop/destroy invalidation. Test double clicks, reverse completions and retry after failure. | Verified |

Delivery re-review passed 32 focused inventory/build/lazy/update checks, with all 104 portable and five gated files reachable. Reproduced medium test-server identity issue remains: an unrelated HTTP 404 listener is accepted as ready. At the second-pass checkpoint, service-worker mixed-version behavior had no demonstrated new failure. The third pass below reproduced and repaired that gap.

SA-07 refinement: school dataset reads retain school generation guards. Wallet summary reads explicitly use account scope, so membership bootstrap, reload and selection do not retire their observer. Each query-service instance owns account lifetime tokens. Account/global cleanup invalidates tokens before awaiting library cancellation, preventing old refresh continuations from recreating cleared cache entries. This also handles unknown school context during login. No queue lifecycle restart is used. Specialist checks pass 107/107 and root independently reran 39/39. Production build passes at student 209.4/210 KiB and teacher 179.7/180 KiB.

SA-07 final independent gate: 78 focused checks pass. Separate real QueryClient probes reject the original school race, all four empty/nonempty key and account/global clear races, and old observer dispatch after same-account replacement. Wallet bootstrap, reload and selection continue reading normally.

SA-08 verified: root independently reran the original reproduction, which now retains assignment B and its unsaved answer after A resolves. The actual Vite browser verifies 13 invariants for detail/response races, signal forwarding, obsolete generic/abort errors, stale save success/failure, detached forms, valid structured checks and refresh/account/destroy cancellation. Specialist focused checks pass 108/108; root reran the browser independently. Build remains student 209.4/210 KiB and teacher 179.7/180 KiB.

SA-09 verified: shared captured Arcade session ownership protects access results and settings UI/cache continuations. It checks the existing session owner, progress/cloud identity and generation, auth mode and disposal state before dispatch and mutation. Actual module tests cover wallet/time reads and purchases across five invalidations, valid remote success, deferred demo deduction, both settings UI paths and stale settings success/failure. Specialist checks pass 57/57; root independently ran 46/46 and repeated the original actual-module wallet scenario, now producing zero writes into the replacement account and a discarded result. Build initial budgets remain unchanged; the optional games chunk grows about 0.19 KiB gzip. A dispatched server purchase may still commit to its original owner's wallet; client ownership checks prevent cross-session application, not server cancellation.


SA-10 verified: a private start token serializes gate, settings, purchase and launch work. Duplicate Play returns without dispatch; the current button stays disabled through rerenders. Stop cancels launching while retaining the lock until pending work settles. A confirmed purchase is persisted as resumable time, including when the later UI refresh fails. Destroy and session replacement prevent old credit or button updates. Specialist verification passed 66 focused tests, nine real-browser start invariants and 13 HTML game sandboxes. Independent review passed 41 tests plus separate actual-method duplicate, Stop, resume and failure/retry probes. No remaining high-priority issue was identified in that review.

## Second-pass final verification

The final portable suite runs 849 tests: 848 pass, with zero skips. The only failure remains the unchanged frozen Week 1 checksum described above. Root reran 66 query, game and progress tests independently; all pass. All 21 default script/browser workflows pass after the final repair, including school/account isolation, assignment previews, teacher workflows, nine student-shell widths, 13 HTML game sandboxes and student insight. Catalog validation (222 units), production build, built entry-point smoke and built Arcade gameplay checks also pass. Current initial gzip sizes are student 209.4/210 KiB and teacher 179.7/180 KiB; deployment is 13.8 MB. These supersede the first-pass size figures. Limits were not raised.

The confirmed urgent/high repair queue is complete across both passes. Remaining work is the explicit release blockers and medium follow-up plan; this conclusion applies to the reviewed local source and exercised behavior, not unverified live environments. No commit, push, deployment, vocabulary baseline change or hosted database mutation was performed.


## Third audit pass

Requested after ten completed repairs. Rechecks current source and actual-module behavior, with separate frontend, data/mutation and delivery reviews. Findings are prioritized from reproduced behavior; the existing vocabulary fixture, hosted environment and unrelated dirty work remain unchanged.

| ID | Priority | Evidence | Repair plan | Status |
| --- | --- | --- | --- | --- |
| SA-11 | High | Automatic Arcade extension awaits a purchase; Stop and a newer game replace its owner. The old null result pauses and removes the newer game. Root actual-module reproduction observes both mutations. | Own extension continuations by session and game lifecycle; serialize conflicting purchases; preserve confirmed paid credit after Stop while suppressing obsolete failure/UI work. | Verified |
| SA-12 | High | A subject-save batch awaits its first write, then dispatches another old draft under a replacement account. RLS can permit that account as another school teacher; UI-only completion guards do not prevent the write. | Carry captured operation ownership through import/init and each batch dispatch/result; abort obsolete writes and preserve normal saves. | Verified |
| SA-13 | High | A delayed gift claim overwrites B wallet/XP/cache after A leaves. Deferred backend initialization can also dispatch old gift/Arcade operations as B. | Capture wallet-operation ownership through backend initialization and dispatch, then guard results/errors and stale notification actions. | Verified |
| SA-14 | High | A real two-version generated-worker browser test leaves an old Sparks tab open while a new worker claims it. Its never-visited old classroom chunk now returns 404, while the replacement chunk exports correctly. | Precache the full student code graph; retain each open tab's code version and reclaim unused version caches after tabs close. Preserve safe-menu refresh and current entry-point size limits. | Verified |

Requests already dispatched may still commit to their original server owner; these client repairs prevent later dispatch and cross-session application.


SA-11 verified: automatic and manual extensions capture session, game identity and launch generation. A shared extension token prevents overlapping Play/manual/automatic purchases. Stop invalidates game effects without discarding successful same-session credit. Stale failures, null results and delayed timer feedback cannot stop or overwrite replacement games. Specialist checks pass 76 focused tests, 14 real-browser start/extension invariants, all 13 HTML sandboxes and the production build. Independent review passes 47 tests and separate success/null/failure/overlap probes; root repeated the original failure with zero mutations to the replacement game. Initial size budgets remain unchanged.


SA-12 verified: caller ownership includes teacher identity, auth mode and settings lifetime. Repository ownership adds captured school generation before the lazy write import. Entry, post-import, post-initialization and per-item dispatch/result checks stop obsolete batches; supported requests receive the abort signal. Already-dispatched subjects retain existing partial-success behavior. Specialist and root checks pass 28/28; independent review passes 38 tests and eight real-module adversarial probes. Build passes at student 209.5/210 KiB and teacher 179.9/180 KiB.


SA-13 verified: coin operations capture the current owner, active storage owner, progress/cloud identity, cloud generation and auth mode. Notification panels capture that predicate when rendered. Gift, spend and Arcade purchase adapters also recheck ownership after backend initialization, immediately before RPC dispatch; predicates are not serialized into RPC payloads. This closes both stale-result and deferred-dispatch races. Same-instance progress reuse during normal authentication is covered. Specialist checks pass 109/109, root independently passes 64/64 and all three original gift/Arcade reproductions, and independent review passes 67 tests plus those reproductions. Production build and unchanged byte limits pass: student 214,797/215,040 gzip bytes (243 bytes headroom), teacher 184,291/184,320 bytes (29 bytes headroom). Rounded displays are 209.8/210 KiB and 180.0/180 KiB. Optional feature boundaries need attention before additional eager code.


SA-14 verified: the generated worker precaches the full transitive student JavaScript/CSS graph without executing optional modules or including teacher-only code and large optional media. Each document leases its HTML graph; cleanup retains live graphs and protects in-progress installs. HTML selection, lease creation and eviction share a scoped Web Lock, including both navigation/cleanup orderings. Browsers without Web Locks retain graphs conservatively. The existing native Workbox runtime strategy still caches newly visited nonmanifest scripts; retained graph code survives beyond runtime expiration. Specialist and independent verification each pass 32 focused tests and the actual generated-worker four-version browser rehearsal. The browser covers unsafe drafts, safe-menu save/reload, old code offline, navigation leases, installing caches, closed-tab cleanup, expired runtime dates and unknown-script offline caching. See [worker ownership and rollout details](student-worker-upgrades.md) and the [Web Locks specification](https://w3c.github.io/web-locks/).

The production precache contains 58 files totaling 2,194,045 bytes before compression, an extra 1,139,978 bytes downloaded after page load. Initial execution budgets are unchanged. This transfer cost buys complete offline code for retained releases. Cleanup happens on subsequent worker events; it does not promise background collection after all tabs close. Conservative retention on browsers without Web Locks can grow storage across releases.

**Initial rollout limit:** an already open legacy tab may reference an optional old asset that was never cached. The repaired worker cannot reconstruct that removed host asset. Retain previous immutable assets during the first rollout, or let existing tabs save and reach the safe-menu reload. Full-graph repaired releases protect subsequent upgrades. No rollout or hosting change was performed.


## Third-pass final verification

Fresh production build passes registered assets, lazy graph and unchanged size budgets. Initial gzip totals remain student 214,797/215,040 bytes and teacher 184,291/184,320 bytes; deployment is 13.8 MB. All 22 default script/browser workflows pass after the final changes, using isolated configurable ports and the freshly built worker graph. The legacy 404 in the worker rehearsal is the intentional first-rollout compatibility case, followed by successful repaired-release assertions. Built entry-point smoke, built Arcade gameplay and catalog validation (222 units) pass. Portable discovery runs 875 tests: 874 pass, zero skip, and the sole failure remains the unchanged frozen Week 1 checksum. Fresh production dependency audit reports zero high/critical findings and one low DOMPurify advisory. Scoped tracked diff checks are clean.

The confirmed urgent/high repair queue is complete across all three local passes: SA-01 through SA-14. The existing application boundaries are retained, with explicit ownership for persistence, asynchronous operations, account changes and worker versions. The release blockers, initial worker rollout requirement and medium follow-up plan remain explicit; this is not a claim of production acceptance or a wholly green release command. No commit, push, deployment, hosted database mutation or frozen vocabulary baseline change was performed. Unrelated dirty work remains preserved.
