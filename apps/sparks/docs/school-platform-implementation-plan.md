# Sparks school platform implementation plan

Status: local implementation completed on 17 September 2026 following user authorization. Hosted migration and deployment remain pending. See [implementation and release notes](school-platform-release.md) for current validation and rollout requirements. The starting-point findings below describe the pre-implementation audit.

## Outcome

Support multiple platform administrators and schools. Each school has multiple administrators, teachers, students, and classes. Teachers and students are school members before they are assigned or enrolled in that school's classes. A person uses one account across school memberships. School administrators can also teach.

Schools own classes and their assignment history. Teacher assignments determine teaching access. Removing or replacing a teacher must not remove the class, published materials, student submissions, or results.

## Verified starting point and limits

The current working tree already contains private teacher subjects, classes, student enrollments, verified-email invitations, immutable assignment snapshots, student responses, results, exports, and assignment-scoped file access. Classes have a year and archive state. Reuse these workflows and the existing activity engines.

The current authority is teacher ownership. `teaching_classes.owner_id`, owner-matched foreign keys, `private.owns_teaching_class`, assignment ownership checks, and teacher-owned settings enforce that model. `profiles.role` is a global student/teacher choice. There are no school or school-membership tables in the inspected migrations. The existing trusted `school_admin` metadata flag is global.

Principal source references:

- `supabase/migrations/20260908204538_private_teacher_classes_and_enrollment.sql`
- `supabase/migrations/20260908205517_private_class_assignments.sql`
- `supabase/migrations/20260909033621_private_workspace_access_cutover.sql`
- `supabase/migrations/20260909033913_assignment_file_access.sql`
- `supabase/migrations/20260909034306_class_results_and_invitation_management.sql`
- `js/services/classroomRepository.js`, `js/teacherClassWorkspace.js`, `js/teacherAuth.js`
- `supabase/functions/create-student-account/index.ts`, `supabase/functions/reset-student-password/index.ts`
- `tests/private-classrooms-acceptance.test.mjs`

These are local implementation findings, not proof of production behavior. Several classroom files and migrations are untracked. The existing release handoff records a pending hosted cutover. The 17 September read-only hosted migration-list attempt returned HTTP 403. Existing test results in the handoff are historical, not rerun for this plan.

Before implementation, capture the intended Sparks file set and migration state without discarding unrelated changes. Before release, refresh the hosted schema and inventory. Do not infer production state from the local migration directory.

## Proposed product decisions

These defaults make the work concrete. They are proposals, not claims that the user has already selected every detail.

| Topic | Proposed first-release behavior |
| --- | --- |
| Class meaning | A subject class, such as Technology 6A, under a school and academic year. Grade/section are descriptive roster fields, never authorization. |
| School roles | School administrator, teacher, and student. One member may hold more than one role. |
| Multiple schools | Allow multiple memberships from the start. Show a school chooser only when needed. |
| Co-teaching | All active assigned teachers can publish work, manage enrollment, and review the class. School admins assign/remove teachers and archive/reopen classes. Do not add per-action teacher customization in version one. |
| Class creation | School admins and active school teachers may create classes. A teacher creating a class becomes its first assigned teacher. |
| School admin access | Manage school membership, settings, classes, and school educational records. Teaching requires a teacher role and class assignment. |
| Platform admin access | Manage schools and administrator membership. No automatic access to submissions, answer keys, or student files. A separate support-access workflow can be added later. |
| School membership | Invite or provision explicitly. Accepting an invitation may establish membership and class enrollment atomically. Never infer school membership from email domain or matching class name. |
| Teacher departure | Revoke school/class access; keep authorship and published class history. Admin can assign a replacement without transferring a personal account. |
| Student removal | School removal disables that school's enrollments and access. Class removal affects only that class. Retain records for authorized school staff. |
| Account recovery | School admins do not reset a shared global account's password. Use the student's verified recovery flow. Managed student accounts without usable email need a separately specified recovery policy before enabling admin resets. |
| Content | First release uses school-scoped libraries with creator attribution. Migrate current material into the initial school. Defer cross-school sharing and platform libraries. |
| Rewards | Preserve existing account-level wallet/Arcade balances and reward receipts. School reports show only school-attributable learning results. Do not split balances or introduce school coin grants in this change. |
| School lifecycle | Suspend a school to deny school access; retain records. Defer hard deletion and retention automation. |

Use an active-membership check on every authorized request. Do not treat a previous login, a browser's selected school, or a cached role as sufficient access.

## Target data model

Names below are proposed. Final migration names must be generated with the repository's Supabase CLI workflow.

| Record | Purpose and constraints |
| --- | --- |
| Existing `profiles` | Account identity. Retain names/email and existing identifiers. Stop treating its legacy role and grade/section as school authority. |
| `platform_admins` | Multiple trusted platform administrators, with active status and grant/revoke metadata. No client self-grants. |
| `schools` | Stable ID, display name, active/suspended state, timezone, and lifecycle metadata. |
| `school_memberships` | Unique school/user pair; active/inactive status, joining/removal metadata, school-specific student placement. |
| `school_member_roles` | Multiple explicit roles per school membership. Role changes are privileged transactions. |
| School subjects and academic years | School-owned catalog and year records. Map existing `teacher_subjects` and class years; merge equivalent subjects only through an explicit mapping. |
| Existing `teaching_classes` | Add school and academic-year references; use a school subject. Retain original creator attribution. School owns the class. |
| `class_teachers` | Multiple teachers per class, active status and assignment history. Each must be an active teacher in the class's school. |
| Existing `class_memberships` | Keep unique class/student enrollment and removal history. Require active school student membership for new enrollment and work access. |
| Existing materials and versions | Add school ownership and creator attribution. Keep immutable published content and private assessment keys. |
| Existing `class_assignments` | Preserve IDs and schedules. Replace the same-teacher constraint with same-school constraints for class and version. Keep publisher attribution. |
| Existing responses, progress, files | Preserve assignment identity. Derive school access through the assignment, or use constrained school IDs where needed for queries. |
| `school_settings` | School calendar and shared defaults. Keep genuinely personal preferences separate. |
| School invitations | School, intended role, verified recipient, expiry, revocation, acceptance, and inviter. Teacher/admin invitations have stricter grant rules than student invitations. |
| Administrative event log | Append-only actor, school, action, target, time, and safe change summary. Include membership/role changes, teacher assignments, school suspension and invitation administration. Exclude passwords and tokens. |

Use composite foreign keys for same-school links where possible, and transactional validation for active status and roles. A valid UUID alone is not evidence that two records belong to the same school. Do not simply replace `owner_id` with a school ID; user attribution and organizational ownership have different meanings.

## Authorization and module design

Keep the existing repository and vanilla JavaScript composition. Add a school-access module with a small interface for listing accessible schools, selecting school context, and reading effective capabilities. The database remains authoritative; the module supplies UI state, not security decisions.

Database helpers should express school membership, school administration, class teaching, and assignment access. Replace owner checks across every affected policy and RPC, including reports, exports, Word Hunt review, storage, activity attempts, response checking, rewards, and Realtime subscriptions. Search definitions and callers; updating one shared helper will not replace direct `owner_id = auth.uid()` checks elsewhere.

Privileged mutations must validate both caller and target school before service-role operations. The global `app_metadata.school_admin` flag must cease to authorize school administration. Account provisioning must handle an existing account without enumerating it to unauthorized callers. Coordinate account creation and membership with idempotency and recoverable partial-failure handling because Auth and database operations are not one transaction.

Bootstrap the first platform admin through a trusted operator procedure. Later grants require an active platform admin. Protect the last active platform admin and last active administrator of an active school using transactional locking. Ordinary teachers cannot promote themselves, grant admin roles, or assign teachers.

Expose school-scoped reads and actions through repositories. Every school-scoped request carries an explicit school ID that the server verifies. Assignment IDs can establish school context on direct links, but the server still checks access. Return only minimal school metadata through the school chooser.

## Implementation sequence and completion gates

### 0. Establish the baseline and migration manifest

- Inventory the tracked/untracked Sparks changes and retain unrelated work.
- Identify which private-classroom migrations are applied locally and hosted when access returns.
- Refresh material, teacher, roster, class, progress, file, and reward inventories without changing rows.
- Use the existing approved sole-teacher ownership decision and legacy roster reuse recorded in `private-workspace-release.md`; do not request duplicate lists. Treat its September 9 counts as stale until refreshed.
- Create a proposed initial-school mapping. Do not invent enrollments for ambiguous historical work.
- Record the supported content types. The older classroom-activity tables remain restricted history unless a separate mapping is designed.

Gate: a reproducible baseline and explicit migration manifest distinguish existing work, new school changes, and production state. Hosted access blocks production mapping/release, not local design and implementation.

### 1. Add school identity and membership

- Add school, platform-admin, membership, role, invitation, settings, and administrative-event records with restrictive access from creation.
- Implement school/member lifecycle operations, membership reads, and initial-admin bootstrap.
- Introduce scoped capabilities while retaining existing account IDs and role fields only for temporary compatibility.
- Make admin grants and last-admin protection atomic. Suspension and revocation must be honored by current sessions.

Gate: authenticated tests prove School A admins cannot read or manage School B membership, forged metadata grants nothing, multi-role/multi-school membership works, and concurrent last-admin removals cannot orphan a school.

### 2. Convert class and content ownership

- Add school context and co-teacher assignments to the existing classroom model.
- Backfill the initial school's subjects, years, classes, materials, versions, and memberships from the mapping.
- Replace owner-matched constraints and access checks with school/class authorization.
- Preserve all existing assignment IDs, snapshots, answers, submissions, receipts, and file paths that can remain valid.
- Replace teacher-scoped settings reads where settings are school policy; retain personal preferences separately.
- Make teacher departure and replacement preserve access to history for remaining authorized staff.

Gate: two teachers can share one class; teachers without assignment cannot inspect it; removing one teacher blocks that teacher while the other retains class work; foreign-school links fail at the database/server level.

### 3. Complete server and account-administration coverage

- Update report/export/analytics functions, enrollment/invitation functions, storage checks, activity authorization, and Realtime access to use the new rules.
- Replace the global school-admin gate in both account Edge Functions.
- Keep administrative password resets disabled under the proposed shared-account recovery policy.
- Implement school-admin student provisioning or invitation with trusted caller/target checks, retries, and audit events.
- Audit old RPCs, public assets, legacy policies, and stale-client fallback paths for broader access.

Gate: direct REST/RPC/Storage calls and the actual Functions gateway obey the same isolation as the UI. Global wallets and another school's work stay outside school reports. Revoked membership blocks new writes and offline replay.

### 4. Add school context to the existing app

- Add school selection and school-role navigation. An admin-only member can enter administration without being a teacher.
- Extend the teacher classes screen with school subjects/years and permitted class actions. Add school teacher assignment controls.
- Extend student classes/invitations with school context while preserving assignment activity routes.
- Scope school-specific cache keys and drafts by account and school; retain assignment IDs for assignment work.
- On school switch, cancel prior requests, advance the view generation, dispose subscriptions/features, and restore only the destination school's state.
- Carry and verify original scope for offline operations. Never relabel queued work to the newly selected school. Preserve denied work locally as unsent rather than silently losing it.
- Preserve the existing separate teacher/student session behavior on shared devices.

Gate: same-account school switching cannot show stale rosters or save drafts into the wrong school; delayed requests, direct links, refresh, sign-out, and offline reconnection are tested.

### 5. Add administrative work areas

- Platform console: create/suspend schools, assign school admins, manage platform admins, and view administrative events.
- School administration: member invitations, roles, teacher assignment/replacement, class/year management, school settings and scoped records.
- Show only actions the current role can perform, while enforcing every action server-side.
- Load administration features lazily. Retain existing shared controls and delivery budgets.

Gate: real platform-admin, school-admin, teacher, co-teacher, and student workflows pass authenticated browser checks, including errors and empty states. Platform admins do not acquire educational-record access merely by opening the console.

### 6. Rehearse and release

- Rehearse the exact existing migration chain plus additive school migrations and data mapping on an isolated copy. Do not rewrite migrations already applied to any persistent environment.
- If hosted private-classroom cutover is still pending, rehearse it and school conversion as one planned release sequence. Do not ship an unnecessary intermediate migration just to match the local worktree.
- Compare source/destination ownership, memberships, assignments, responses, file associations, and reward counts. Quarantine ambiguously attributed history with a reconciliation report.
- Validate focused checks, full regression, local authenticated database/Functions suites, browser acceptance, database lint/advisors, and production build/delivery budgets.
- Resolve the historical Firefox gate using a working environment/CI. Old recorded test passes are not acceptance for this release.
- Back up hosted data/files, deploy restrictive database rules, compatible Functions and built clients in a controlled window, then verify hosted acceptance before onboarding another school.
- Roll back with a compatible restrictive client/database state or close affected workflows. Never restore broad teacher access as a rollback shortcut.

Gate: hosted two-school acceptance passes; public assets and old clients do not expose private teaching materials; the recovery procedure is documented and rehearsed.

## Expected code impact

| Area | Existing owners to extend |
| --- | --- |
| Schema, authorization, migration | `supabase/migrations/`, classroom access helpers and owner-based RPCs; new additive migrations and mapping tooling |
| Classroom data | `js/services/classroomRepository.js`, material repositories and settings repositories |
| Authentication and context | `js/teacherAuth.js`, `js/services/sessionInitialization.js`, student auth, new school-access module |
| Classes and publication | `js/teacherClassWorkspace.js`, `js/teacherAssignmentsWorkspace.js`, `js/teacherAssignmentPublisher.js`, student classroom views |
| Navigation/admin | `js/teacherPageRegistry.js`, `js/teacherRouting.js`, lazy features, new admin views and platform entry as needed |
| Reporting | Assignment results/export, student progress summaries, report repositories, Word Hunt review |
| State and offline behavior | `js/services/serverStateQuery.js`, student storage/progress queue, subscriptions, service-worker compatibility |
| Privileged accounts | Both student-account Edge Functions and their gateway tests |
| Verification | Extend private-classroom acceptance; add school-platform acceptance and browser tests |

This spans database authority, two account Functions, authentication/context, classroom UI, content/settings, reports/files, and tests. It is several coordinated changes, not a dashboard-only task. A keyword scan identified nine migration files referring to class ownership/assignments and eight JavaScript files using the classroom repository/workspace; these are starting points, not an exhaustive file estimate.

## Minimum acceptance matrix

- Two schools with identical class/subject names remain separate.
- One teacher in both schools sees only the selected school's records and cannot combine their IDs.
- Two teachers share a class and see its work; an unassigned teacher in the same school cannot.
- A school admin manages only their school; a platform admin has only explicitly granted platform operations.
- Admin-plus-teacher membership works without making all school admins teachers.
- Student membership and class enrollment are both required; another school's membership is insufficient.
- Invitation acceptance validates recipient, school, intended role, expiry and revocation, and is retry-safe.
- Concurrent invitation acceptance and membership removal cannot restore revoked access.
- Teacher replacement preserves assignments, private answers, submissions, exports and file access for authorized staff.
- Removing the last active admin is rejected, including concurrent removals.
- School suspension, member removal, class removal, and role revocation take effect during existing sessions and offline replay.
- School switching cannot mix requests, caches, draft saves, or Realtime updates.
- Cross-school reports, exports, files, provisioning and forged metadata requests are denied through direct server calls.
- Migration preserves assignment identities, original reward receipts, account balances and attributable historical work without duplication.

## Implementation status

The local schema, server authorization, administration UI, school-aware repositories, co-teaching, account recovery, and acceptance checks have been implemented. The hosted inventory, approved production mapping, full hosted migration rehearsal, email delivery, and authenticated deployment acceptance remain pending. Do not onboard a second live school before those release gates pass. See [release procedure and validation limits](school-platform-release.md).
