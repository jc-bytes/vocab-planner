# Sparks architecture audit, 4 November 2026

## Accepted local result

All confirmed urgent/high findings in the audited working tree are resolved.
Repairs were made one concern at a time and checked before proceeding. The final
unchanged application completes `npm run test:release` with exit code 0, including
its source and compiled browser checks, real disposable database rehearsals,
dependency gate, build budgets, cross-browser/responsive checks, and strict local
database lint/advisors. The complete final run is recorded in
`/tmp/sparks-audit-release-final6.log`.

These are engineering scores for the current local architecture and declared
classroom scope, not measurements of hosted availability or production capacity.
Independent frontend, data and delivery reviews found no additional confirmed
urgent/high issue. Remaining medium work and uncertainties are retained below.

| Category | Final score | Basis and practical limit |
| --- | --- | --- |
| Modularity | 9/10 | Explicit feature factories, repositories and registries; lazy boundaries enforced by the production graph. Static scan: 366 first-party modules, 958 edges, zero static import cycles. |
| Maintainability | 9/10 | One owned-mutation executor and optional login-hint policy replace repeated failure-prone behavior. Current ownership map, focused regressions and exact database contracts support local changes. Hybrid internal composition remains medium debt. |
| Simplicity | 9/10 | Narrow capabilities and per-query credentials retain existing authorization instead of introducing a parallel framework or duplicated RPC layer. Students screens request only their own required data. |
| Efficiency | 9/10 | Unchanged startup/lazy/delivery budgets pass. The 30-student × 12-vocabulary fixture produces 360 grades in 380.7 ms including Docker/psql transport. This is one local workload, not a throughput benchmark. |
| Scalability | 9/10 | Class-scoped/indexed reads, bounded batches, scoped exports and set-based progress paths are verified with SQL and actual SDK role matrices. The score describes the intended classroom design; sustained school-wide hosted load is unmeasured. |
| Reusability | 9/10 | Shared actor-bound mutation, storage, loading, UI and registry contracts have real consumers. Features retain independent lifecycle and domain behavior. |
| Reliability | 9/10 | Account/session replacement, storage denial, cancellation, stale results, revisions, immutable publication, replay and offline upgrade controls pass. Earlier intermittent local failures remain recorded; a clean repeat does not establish their precise cause. |
| Developer experience | 9/10 | Source and compiled release paths now exercise the new grading feature; exact RPC readiness and artifact/config identity fail clearly. Stale acceptance fixtures and unbounded assertion diagnostics are repaired. Full release passes, with focused checks available for individual changes. |

### Final verification receipt

- Portable tests: **1,626 passed**, zero failures/skips; **224** vocabulary units validate.
- Full source and compiled acceptance passes, including real-entry progress/grades,
  both private-classroom runs (14 checks each), six activity-recovery scenarios in
  each mode, actual local authentication, and worker lifecycle across four versions.
- Disposable PostgreSQL/PostgREST rehearsals pass actor attribution, authority,
  immutable snapshots, grading arithmetic, revision/concurrency, durable queue
  order, and exact policy/ABI equivalence. The final large matrices include
  273 SQL/260 SDK permission cases, 390 SQL/360 SDK policy cases, and
  328 SQL/123 SDK progress-compatibility cases. Temporary resources are removed.
- Production delivery: **15.5 MB / 30 MB**. Initial JS/CSS gzip:
  **190.5 KiB / 210 KiB** student and **163.1 KiB / 180 KiB** teacher.
  All lazy budgets pass; student worker precaches 104 files.
- Firefox/WebKit focused checks and final responsive widths
  **320, 360, 390, 430, 768, 1024, 1280** pass. Strict local lint and all-type
  advisors both return zero findings. No high/critical dependency advisory.
- After the full command, `verifyBuildArtifact` independently confirms all current
  application inputs, effective public configuration and all **714** output files.
  Input digest: `69f1c0e225ee483a1c3c58415f34e72ff56851b17f669d3edba25faadc995959`;
  configuration digest: `fc3ff71d3e6d171a8732be929283de38218c138f06f8479ea8aca2395245d2ad`.
  This receipt covers the official app output, not later Pages packaging.

No commit, push, hosted migration or deployment was performed. Existing dirty
work was preserved. Only the two already-existing November migrations were
applied to the local stack for acceptance; no real student grades were published.
Hosted Auth/schema parity, physical devices and sustained production load remain
separate acceptance work.

## Scope and acceptance

Audit the current working tree, including its existing uncommitted progress and
vocabulary grading work. Preserve current product behavior, public contracts,
student work, publication history, and school/account isolation. No hosted release
or real grade publication is part of this audit. Existing work is not attributed
to this repair pass. Initial working-tree inventory is saved at
`/tmp/sparks-audit-start-status.txt`.

Scores are engineering judgments, not automated measurements. A 9 requires clear
ownership, small usable interfaces, bounded work, reproducible checks of affected
behavior, and no confirmed unresolved urgent/high findings in that category.
Local acceptance does not establish hosted schema parity or device acceptance.

## Initial findings and sequential plan

| ID | Priority | Evidence and consequence | Repair and acceptance |
| --- | --- | --- | --- |
| A1 | High | `teacherAuth.js` treats an optional browser-storage login hint as required authentication. `teacherVocabularyStorage.js` reads storage outside error handling. Reproduced SecurityError blocks valid teacher access and cloud catalogue loading. | Isolate optional hint and catalogue read failures. Preserve strict draft reads for mutations so a failed read cannot overwrite existing drafts. Test actual installed methods, failed storage getters/operations, and normal save/recovery behavior. |
| A2 | High | `classroomRepository.js` uses unowned mutations for teacher feedback and classroom administration/publication. UI ownership checks after a request cannot prevent an SDK token lookup from dispatching an old action as a replacement account. | Bind classroom writes to initiating identity through transport/database execution, retaining existing authorization/revision rules. Prove switched-account denial and positive mutations with real local SQL/SDK acceptance. Inventory every classroom mutation before closing. |
| A3 | High | New class-progress, gradebook, grading-settings and student-grade browser checks run source modules only. Final production acceptance does not exercise these new lazy modules. | Add compiled-artifact coverage through actual production entry/lazy paths. Register gates in local release and CI; prove the checks fail if the required module/path is absent. |
| A4 | Medium | Students route waits for invitations even when opening progress or grades, coupling independent screens and duplicating gradebook roster reads. | Load only the data each screen needs; preserve roster/invitation behavior on its own screen. Verify unrelated request failures cannot block progress/grades. |
| A5 | High | CI persists local public build configuration, overrides it for the production build step only, then verifies the production artifact under local configuration. Actual configuration fingerprints differ, so owned preview rejects it. | Persist the production public configuration for the final build and every subsequent compiled check. Keep network fixtures local. Test the workflow configuration lifetime and artifact mismatch detection. |
| A6 | Investigation | Baseline grading acceptance exceeded its existing 15-second workload limit: 30 students × 12 vocabularies took 16,651 ms including Docker/psql. | Keep the limit. Separate database execution from transport/host load using a disposable minimal fixture, then repeat the original acceptance before choosing a repair. |
| A7 | Medium | CI deliberately adds sibling Grade 9 sites and retained previous-release assets after application build acceptance. The original application-output stamp does not describe this later package. No current gate consumes that stamp after packaging, so this is a provenance limitation rather than an observed runtime defect. | Keep application freshness checks exact. Document that they cover the official app build. A separate package receipt would be needed to attest the final upload; do not blindly restamp arbitrary post-check changes. |
| A8 | Medium | Hosted compatibility probes cover grading writes but omit the new progress/gradebook/student-grade read signatures. A manually skipped progress migration could still pass that gate. | Add exact anonymous-denial read probes without using signed-in credentials or real school data. Keep missing-signature failure controls. |
| A9 | Medium | The full source suite finds an older Groups lifecycle fixture omitting the Students workspace root required by current composition. The real teacher page supplies it. | Add the real mount to that fixture, preserving all disposal/error assertions. Original fails and a one-mount temporary correction passes. |

A2 also affects school administration, shared vocabulary/Sparks writes, subject
writes and group restrictions. Inventory and repair these together using one
narrow owned-write implementation. A documented per-request Authorization header
can pin the initiating account without changing database authorization or adding
many equivalent RPCs. Verify both session acquisition and the SDK's later token
lookup with actual SDK requests. Existing server-owned mutation wrappers remain.

Implement one finding at a time, run its focused acceptance, and review the result
before starting the next. Additional confirmed high findings join this sequence.
After repairs, repeat independent review and the applicable release checks, inspect
delivery budgets and dependency findings, and record final scores with limitations.

## Baseline checks

- Portable suite: 1,575 tests passed, no failures or skips.
- Production build passed: 15.5 MB delivery; student initial JS/CSS 190.0 KiB gzip
  against 210 KiB; teacher 162.6 against 180 KiB. All lazy/code/asset budgets pass.
- Initial isolated database rehearsal passes authority, revisions, publication,
  isolation and concurrency assertions but fails its final performance limit.
  The disposable database was removed. A6 tracks diagnosis and repeat acceptance.
- Dependency audit reports zero high/critical findings, seven moderate and two low.
  All originate in development-only Workbox dependencies. Worker generation uses
  controlled local inputs, with no demonstrated student-triggerable path. Track
  as medium maintenance debt; do not force the suggested Workbox downgrade.

## Repair evidence

### A1 accepted

One best-effort login-hint helper now isolates denied storage properties and
operations from teacher/student startup and sign-out. Optional catalogue reads
can omit unavailable drafts while preserving healthy cloud/bundled results.
Save, remove and placement recalculation require strict reads; unreadable or
malformed existing libraries cannot be overwritten by a later successful write.
Write errors continue through the existing save coordinator so cloud publishing
can succeed independently.

Seven original regression controls failed before repair and pass afterward.
Expanded acceptance covers actual installed auth/listener/storage methods, a
throwing storage property getter, cloud-first catalogue recovery, strict
read-modify-write preservation and publishing after local failures. All 95
focused Node controls pass. The three-entry source smoke and modal focus
lifecycle pass on an owned server. Evidence is in `/tmp/sparks-a1-*.log`.

### A2 accepted

`ownedMutation.js` captures account incarnation, auth-session ID and school
generation before asynchronous initialization. It validates the resolved session,
pins credentials to the individual PostgREST query, retains timeout/cancellation
and server errors, and rejects stale results. It never changes shared client
headers. Existing server-owned RPCs, RLS, receipts and non-retry behavior remain.
This uses the documented [Supabase per-query header interface](https://supabase.com/docs/reference/javascript/using-modifiers-setheader),
verified against the installed SDK rather than assuming token-lookup order.

The shared implementation covers classroom writes, school administration,
vocabulary/Sparks writes, subject batches, group restrictions, export audit,
late-work review and the remaining wallet mutations. Arguments and batch identity
are captured before waits. UI confirmation guards also capture the original
user/incarnation and selected students before confirmations or prompts.
Custom repository adapters can inject an identity getter or explicit initiating
user; without either their first resolved authenticated session defines the owner.

The full portable suite passes 1,608 tests with zero failures/skips. Three later
focused additions cover same-login refresh/replacement, wallet receipt retention
and interrupted subject batches. The focused expanded group passes 29 tests.
Independent review finds no remaining substantive issue in this repair.

The existing release-owned database rehearsal now exercises ten actual
SQL/PostgREST writes during SDK token replacement by another authorized actor.
It proves original teacher attribution, no replacement-student debit, stopped
second batch writes and independent later requests as the replacement account.
Session replacement during credential acquisition dispatches no school-role
write. Existing owned-RPC denials and positive controls also pass. All disposable
database/gateway/role resources were removed. Evidence:
`/tmp/sparks-owned-unit-final.log`, `/tmp/sparks-owned-extra-tests.log`,
`/tmp/sparks-owned-db.log`, and `/tmp/sparks-a2-independent-owner-review.log`.

A request already dispatched can commit as its initiating account after a switch;
cancellation is not proof of rollback. No database migration, hosted data change
or new automatic retry was introduced. A5 is next, followed by A3 and A4.

### A5 accepted

CI now persists production public build configuration immediately before its final
build. Every subsequent compiled acceptance step inherits the same configuration
that was fingerprinted into the artifact. Earlier local worker-build values are
superseded. Artifact freshness validation remains strict. The previously missing
built loading-first-paint check is also registered in CI.

The new regression executes the workflow's actual persistence shell with distinct
local/production fixture values, applies its environment file and checks that no
later compiled step replaces that configuration. All 28 focused workflow/artifact
identity controls pass, including source/configuration/output mismatch detection.
Independent review passes the eight workflow controls and finds no remaining
issue. This is local verification of the workflow; no GitHub run was triggered.

### A3 accepted

`test:ui:progress-grading` drives the actual teacher/student HTML entries in both
source and owned production-preview modes. Only network responses are fixtures.
It checks progress/gradebook deep links and reloads, independent failed reads and
retries, captured actor/revision on grading saves and publication, student-issued
snapshots, draft disabling versus explicit ungrading, ordinary Library → Create
editor defaults, phone layouts and actual lazy-module requests. No application
module is imported directly by the runner.

Source and compiled runs both pass on the official stable build. The new gate is
registered in default source checks, local compiled release and CI after the final
build. All 12 workflow/inventory contracts pass; independent review accepts the
entry paths and registration. Evidence:
`/tmp/sparks-progress-grading-flow-source-final.log`,
`/tmp/sparks-progress-grading-flow-built-final.log`, and
`/tmp/sparks-audit-build-a3.log`.

The first concurrent build correctly rejected a changed package input before
stamping. A clean build after registration passed all unchanged budgets at
190.5 KiB student, 163.1 KiB teacher startup, and 15.5 MB total delivery.

A bare `/teacher/vocabulary/editor` entry does not initialize all form controls.
Ordinary Create generates an ID and uses its ID-bearing editor route. This is
medium route-consistency debt, not evidence of a broken ordinary editor refresh;
the new gate makes no claim to cover direct bare-editor initialization.

### A9 accepted

The Groups lifecycle fixture now includes the real Students workspace mount that
the production page already supplies. Original and one-mount temporary runs prove
the cause; the registered fixture then passes with every lifecycle, disposal and
error assertion retained. No production null guard masks a required DOM contract.
Evidence: `/tmp/sparks-groups-fixture-original.log`,
`/tmp/sparks-groups-fixture-complete.log`, and
`/tmp/sparks-a9-groups-fixture-green.log`.

### A4 accepted

Student-view tabs mount before their required reads. Grades loads its module,
calendar and gradebook without roster/invitation requests. Progress loads roster
and calendar concurrently, then its summary. Roster retains its roster/invitation
behavior. Existing captured-owner, request and signal checks remain.

The new browser regression fails before the change and passes afterward. It
checks exact request counts, unrelated request failures, accessible loading,
switching tabs during a held initial read, cancellation and obsolete results.
All five surrounding browser gates pass: class workspace, class home, Groups,
trimester progress and gradebook. Evidence:
`/tmp/sparks-a4-workspace-red.log`, `/tmp/sparks-a4-workspace-green.log`.

All confirmed urgent/high findings are implemented with focused acceptance.
A8 read-signature coverage and final release/recovery verification are accepted
below and in the final receipt above.

### A8 accepted

Deployment compatibility now requires all 14 exact RPC signatures, including the
three progress/gradebook/student-grade reads. Only anonymous browser credentials,
zero IDs and valid dummy dates are used. Missing signatures or accidental anonymous
execution fail closed. The public verifier interface remains unchanged.

All 34 focused security/workflow/inventory controls pass. The existing disposable
SQL/PostgREST rehearsal confirms each new read returns its actual function ACL
denial and repeats all ownership controls. Pending feature migrations are applied
only inside the clone, which is removed with its gateway/role. Evidence:
`/tmp/sparks-a8-final.log`, `/tmp/sparks-a8-real-denials.log`.

### Final verification timing control

The first complete release attempt stops at an existing Arcade test using a real
20 ms deadline. Its delayed assertion handler allows host scheduling to reject
the promise before the intended replacement-read setup. The test now attaches its
rejection assertion immediately and advances a controlled clock only after the
replacement read exists. The same 20 ms deadline and all ownership/cancellation
assertions remain. No production timeout or application code changes.
Focused Arcade/class-selection/request-reliability checks pass. The original
failure remains at `/tmp/sparks-audit-release-final.log`; deterministic controls
are at `/tmp/sparks-audit-deterministic-deadline.log`.

### Further full-suite fixture repairs

The next release attempt passes all 1,615 portable controls and stops at the
teacher preview's immediate restored-text read. Eighteen additional real preview
flows do not reproduce saved-entry loss. They do reproduce a separate early-menu
read before cards exist. The fixture now waits for actual menu/activity readiness
and guide completion, asserts the same word's definition in DOM/model/progress/
private storage, and holds the real in-memory image read to control restoration.
The original exact restored-text, privacy, no-backend/no-IndexedDB, quiz and mobile
assertions remain. The enhanced source script and 61 focused Node controls pass.
No production draft-loss fix is claimed. Evidence:
`/tmp/sparks-preview-readiness-green.log`, `/tmp/sparks-preview-draft-cycles.log`,
and `/tmp/sparks-preview-word-hunt-focused.log`.

Continuing remaining source checks also finds stale Students/Classwork/Groups
navigation assumptions in the older page fixture. The fixture now supplies the
separate Students adapter and checks exact canonical route/view/navigation/labels.
Groups keeps its own route/view under Students navigation. History and load-count
assertions remain; an explicit legacy roster-route check proves normalization with
one Students load and zero Classwork loads. The full page smoke and 12 focused
routing/registry/class-selection controls pass. No runtime changes. Evidence:
`/tmp/sparks-pages-fixture-repair.log`, `/tmp/sparks-pages-fixture-node-controls.log`.

A local authenticated check returns 502 because the existing Sparks Auth container
had exited after an earlier database startup connection failure. Restarting only
that local Auth container restores healthy status and authenticated checks resume.
No other project's stack or hosted service was changed. Original failure evidence
is retained in `/tmp/sparks-audit-source-tail2.log`.

### Authenticated acceptance alignment and touch targets

The third complete release attempt passes the entire source suite, local REST,
grading database checks and Supabase acceptance. Its private-classroom browser
then finds more old navigation expectations. The authenticated workflow now uses
the real Students destination, publishes back into selected Classwork, and keeps
Review as its own destination. All 14 private-classroom controls pass, retaining
enrollment, privacy, immutable-copy, response, reload and review assertions.
Evidence: `/tmp/sparks-private-navigation-repair2.log`.

Responsive acceptance now selects a real class and asserts the intended active
view/navigation before measuring it. This exposes actual small touch targets
previously hidden by a redirected Home measurement. The School settings link uses
the existing shared button treatment. Classroom Back/menu controls receive the
existing touch-target minimum width, and class view controls receive its minimum
height. Routes, labels, actions and the 44 px acceptance threshold remain unchanged.
All seven geometry widths pass after these narrowly owned changes. Calendar
acceptance now clicks its real School settings link and verifies the Academic
years owner/table. Actual selected-class views, mobile menu, profile Back,
Sparks/activity checks and all overflow/44 px assertions pass. The existing
private-classroom acceptance passes all 14 checks. Evidence:
`/tmp/sparks-responsive-navigation-repair-final4.log`,
`/tmp/sparks-private-navigation-repair2.log`.

### Current local schema verified

Direct inspection confirms the two November definitions were missing from the
existing local stack. Its older migration ledger has manually applied gaps, so no
bulk replay was performed. After a schema-only backup, only the existing
`20261104043424` and `20261104045454` migrations were applied locally, recorded in
local history, and the local API schema cache reloaded. All 14 exact anonymous
compatibility probes pass on that actual local API. Strict lint and all-type
advisors include the new definitions and return zero findings. No hosted schema
or real grades changed.

All remaining isolated release database rehearsals pass, including 390 SQL/360 SDK
policy cases and 328 SQL/123 SDK progress-compatibility cases. Their temporary
databases, gateways and roles are removed. Evidence:
`/tmp/sparks-audit-database-tail.log`, `/tmp/sparks-audit-local-november-readiness.log`,
`/tmp/sparks-audit-final-local-lint.log`, `/tmp/sparks-audit-final-local-advisors.log`.

### Bounded database rehearsal diagnostics

The fourth release attempt reaches the permission rehearsal. Three large-fixture
HTTP cases return statement-timeout errors under the existing eight-second role
limit. The test then attempts a Node assertion diff of a 309 MB matrix. A debugger
trace identifies `myersDiff → AssertionError → deepStrictEqual`; the runaway test
process is stopped, and its disposable fixture is retained briefly for diagnosis.

Four rich rehearsals now use complete `isDeepStrictEqual` comparisons followed by
bounded first-difference diagnostics only on failure. Every value, type, array
order, role and request remains checked. Fixture queries, timeouts, retries and
performance thresholds are unchanged. All 25 focused controls pass, including
large success-versus-timeout failure cases that retain no huge matrix on the error.

The three affected requests replay twice against the retained fixture with 200
responses, identical 4.744 MB bodies and 2.5–5.9 second durations. An index-removal
experiment is rolled back and shows no improvement. JIT on/off samples have the
same body hash and comparable warm 1.2-second database execution. These results
do not justify an application SQL/index/JIT patch. Transient fixture/host pressure
is plausible but not established as the precise timeout cause.

The complete permission rehearsal then passes again with its original limits:
273 SQL and 260 SDK cases, exact results/permissions/contracts, and expected helper
call counts. The retained and repeat fixtures, gateways, roles and private
environments are removed. Original failures remain recorded. Evidence:
`/tmp/sparks-permissions-js-stack.json`, `/tmp/sparks-permissions-mismatch-summary.json`,
`/tmp/sparks-retained-permissions-profile.log`, `/tmp/sparks-retained-permissions-jit.log`,
`/tmp/sparks-bounded-json-final.log`, `/tmp/sparks-audit-bounded-permissions-repeat.log`.

### A6 investigated, no production change justified

The original baseline remains recorded as a failure. A schema-only disposable
30×12 profiling fixture measures SQL execution separately with EXPLAIN ANALYZE:
685/754 ms with JIT on and 470/391 ms with JIT off. Total Docker/psql times are
909/845 and 635/490 ms respectively. The unchanged full original rehearsal then
passes all four database suites, including grade arithmetic, immutable snapshots,
authority, stale revision and concurrent publication checks. Its original 360-cell
workload takes 574.1 ms including transport and uses an indexed activity lookup.

These measurements are consistent with transient host/container contention;
they do not reproduce a gradebook regression. It does not establish a precise root cause for the first
timing or sustained production capacity. No SQL optimization, JIT setting,
assertion removal, or budget increase was made. Evidence:
`/tmp/sparks-audit-db-baseline.log`, `/tmp/sparks-grade-profile.log`, and
`/tmp/sparks-audit-db-repeat.log`. Both disposable databases were removed.

### Recovery-check login observability

The fifth release attempt stops at the unchanged 30-second
`authInitialized` wait in the second activity-recovery scenario; its first
scenario passes. An immediate instrumented repeat and the registered source and
compiled scripts then pass all six scenarios. No missing listener, failed Auth
transition or reproducible application defect is established by these repeats.
The original failure is retained; its exact cause remains unknown.

The runner now reports at most 40 backend request paths/statuses and boolean
startup states on login failure. It excludes credentials, tokens, request/response
bodies and backend error text. The password submission, authentication assertion,
timeout and six injected recovery cases are unchanged. A controlled token-503
failure also verifies that the bounded diagnostics identify failed Auth without
exposing fixture credentials or JWTs. The final full release subsequently passes
all six scenarios in source and compiled modes. Evidence:
`/tmp/sparks-audit-release-final5.log`, `/tmp/sparks-activity-auth-probe.log`,
`/tmp/sparks-activity-recovery-source-diagnostics.log`, and
`/tmp/sparks-activity-recovery-built-diagnostics.log`,
`/tmp/sparks-activity-login-failure-control.log`, and
`/tmp/sparks-audit-release-final6.log`.

## Remaining medium work and evidence limits

- Pages packaging adds sibling sites and retained old assets after application
  acceptance. A separate complete-package receipt remains useful; the strict app
  identity is not silently relaxed or restamped.
- Direct bare-editor initialization needs route consistency work. Ordinary
  ID-bearing creation/edit routes remain the verified product path.
- Nine development-only dependency advisories remain, all low/moderate through
  Workbox. No high/critical advisory or demonstrated student-triggerable path was
  found. Upgrade deliberately with worker acceptance rather than force-downgrading.
- Hybrid Manager/prototype composition and some duplicate gradebook projections
  remain. Current explicit factories and capabilities keep changes local; a broad
  framework migration is not justified by the measured problems.
- These are local architecture judgments. Hosted migration parity, deployed Auth
  flows, physical-device acceptance and sustained production capacity have no new
  acceptance evidence from this task. Local fixtures are not real student grades.


## Release integration follow-up

The release candidate starts from current production `main` in an isolated
worktree. It preserves the already-published preview CSP/text safety, private
catalogue, section recovery, read deadlines, dashboard acceptance, and CI gates.
The local audit receipt above describes the earlier working tree; release CI
verifies this reconciled candidate independently. Runtime Ember assets now
participate in source freshness fingerprints, with a failing edited-asset control
and 21 passing artifact controls.

Release acceptance exposed two connected grade-panel issues. The fictional
assignment response omitted the real RPC's `class_id`; it now preserves that
field and returns the actual empty issued-grade shape when no grades exist.
A controlled browser read also reproduced a runtime failure: refreshing the same
class while a published-grade response was held left the current assignment's
panel stuck loading. The panel used the selector's transport generation as an
additional owner even though its assignment already supplied a fixed class.

Assignment-pinned grades now retain their owner across independent class reads.
The menu still captures account, school, vocabulary, assignment, cloud, load and
navigation lifetimes, and the actual assignment class must still match. A panel
using only the older selector fallback retains its selector object/generation
guards. Independent review found no cross-account, school, class or navigation
regression.

The original held-request browser control fails before repair and passes after.
The enhanced real-entry flow proves the issued grade renders before the
independent class snapshot returns and survives an actual same-class refresh
during a held grade read. All original publication/retry/mobile assertions remain.
Forty focused tests, the enhanced source flow and the student workspace browser
gate pass. Evidence: `/tmp/sparks-gradeflow-held-refresh-red.log`,
`/tmp/sparks-grade-generation-final.log`, `/tmp/sparks-gradeflow-source-final.log`,
and `/tmp/sparks-grade-fixture-unit-workspace.log`.

The two existing November migrations were applied to the hosted project only
after schema/application-data backups and an exact dry run. All 14 anonymous RPC
readiness probes, real authenticated-role reads/denials, new grants/RLS/index
checks and strict hosted schema lint pass. Counts and metadata digests are
unchanged across eight existing application tables, including progress, published
material versions and reward receipts. No real grade publication was performed.
Hosted advisors report two Auth configuration warnings: leaked-password
protection is disabled and MFA options are insufficient. These migrations do not
change Auth configuration. The operator receipt records deployment and live
verification separately from the historical local audit.
