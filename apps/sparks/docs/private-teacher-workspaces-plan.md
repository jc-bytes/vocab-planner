# Private teacher workspaces and class assignments

Status: locally implemented; hosted cutover pending. Updated 8 September 2026 (Panama). Production ownership, migration parity, Functions and deployed clients remain unverified. No hosted rows have been reassigned and no deployment has been performed.

## Hosted access update, 9 September 2026

The user's renewed CLI login restored read-only hosted access. Confirmed sole teacher: `pjrios@aid.edu.pa`, ID `8bcab255-f64c-4b74-9e32-21fb8629ea86`. Confirmed 236 students grouped into nine existing grade/section classes. The user has authorized ownership by this teacher and reuse of the site's existing students/classes. Duplicate roster collection is unnecessary; prepare the explicit migration roster from these verified legacy records. Initial hosted inventory: 241 vocabulary records, 226 unowned; 169 Sparks, all unowned. No hosted writes or deployment have occurred. Earlier 403 and unknown-owner statements below describe the previous checkpoint; this update supersedes them.

## Implementation checkpoint

Implemented locally:

- Private teacher-owned subjects, reusable materials, settings and classes. Teachers can own several subjects/classes, including names that another teacher also uses. Ordinary clients cannot transfer ownership.
- Verified-email invitations, bulk email paste, pending invitation review/cancellation, student acceptance, scoped rosters, membership removal and class archive/reopen. Invitations appear in the student's account; the app does not send invitation emails.
- Atomic publication to several classes, immutable vocabulary/Spark versions, scheduled release, due/close dates and withdrawal. Published answers remain in a private schema.
- Authenticated students open released assignments through enrollment. Vocabulary activity attempts, normalized progress, offline work and verified rewards use `assignment:<uuid>` identity. The same reusable material can have independent work in different classes.
- Written Spark responses and server-checked multiple-choice answers, revisions and retries. Checks use the published private answer key; short answers are explicitly marked for teacher review. Reading-only Sparks do not ask for a response. These checks do not introduce Spark XP rewards or class-specific Arcade prerequisites.
- Assignment results and CSV export; teacher rosters, summaries, dashboards, batch reports and Word Hunt review restricted to the teacher's own classes/work. Teacher reports omit the student's global wallet and unrelated XP.
- Private Word Hunt uploads under assignment/student paths. Existing broad storage policies and legacy classroom activity APIs are closed; old records remain restricted history.
- Account-scoped teacher library, calendar and review notes. Assigned games restore normalized assignment state rather than legacy same-name game caches. Authenticated clients have no public-manifest or local-teacher-draft fallback.
- Public build excludes vocabulary files; service-worker generation excludes that catalog and removes obsolete vocabulary caches. This does not erase files delivered or published before this cutover.
- Student account creation/password reset require trusted `app_metadata.school_admin`. Forged user metadata does not grant this role. Ordinary teacher global coin grants, global score export and platform settings mutation are closed.
- Student My classes is the signed-in entry point; old Sparks navigation leads to the class workflow. Teacher content editors remain reusable-library tools.

Verification so far:

- All 14 private classroom acceptance tests pass against real local Auth, REST, RPC and Storage, including Chromium invitation/publication, written responses, Spark answer checking and vocabulary activity launch.
- The same suite passes against a disposable database created from the migration chain. That rehearsal caught and fixed missing explicit service-role grants. The original development database was not reset.
- The 11 existing authenticated repository/reward/Realtime acceptance tests pass after conversion to owned subjects, class enrollment and assignment progress. They retain reward uniqueness, prerequisite, retry, ownership and Realtime lifecycle checks.
- The complete `npm test` regression chain passed again after the final source and layout edits. Student shell checks passed across nine widths and six views; authenticated Chromium accessibility, seven-width responsive audit (including Classes), built-client smoke and the 13-game sandbox suite pass.
- Production build and delivery budgets pass; no budget was raised. Student bundle is about 203.4 KiB gzip; teacher bundle is about 179.9 KiB gzip under its 180 KiB limit.
- Local Functions runtime was restored using a temporary directory under the home folder, which Colima can mount. Both administrator restrictions passed through the actual local Functions gateway.
- Database lint has two existing unused-variable/parameter warnings. The advisor reports one allowlist-policy performance warning; no privacy authorization finding was reported.
- Firefox could not launch on this Mac because its sandbox/framebuffer startup failed. WebKit passed sign-in, assignment activity routing, IndexedDB and sandbox isolation. The responsive audit passed at 320, 360, 390, 430, 768, 1024 and 1280px. Firefox remains an unmet environment-dependent release gate.

## Remaining release gates

1. Obtain an authorized hosted inventory and resolve the sole current teacher account. On 9 September, the user confirmed that all existing materials belong to that account; ownership approval is complete, but the hosted account ID remains unverified. A previous read-only CLI request returned HTTP 403. The local preflight found 265 unowned materials; this is not a production count.
2. Prepare the concrete material-owner mapping using that confirmed decision, and obtain explicit class-roster mappings. Grade/section never imply enrollment. Unattributable historical progress/files stay restricted; never duplicate old completion/reward receipts into several assignments.
3. Back up hosted data and rehearse the approved mapping, including history and balance preservation. The clean schema rehearsal is complete; the historical-data backfill rehearsal requires the mapping.
4. Finish final regression, responsive and available-browser gates on the final source, then commit only the intended changes from this heavily modified checkout. CI and `test:release` now include private classroom acceptance as well as the existing database suite.
5. Deploy migrations, compatible administrator Functions and the built client as one controlled cutover; verify hosted parity, public asset delivery, private Storage, old-client denial and two-teacher signed-in acceptance before onboarding additional teachers.

Implementation uses nine migrations from `20260908204538_private_teacher_classes_and_enrollment.sql` through `20260909042339_assignment_spark_checks.sql`. They are applied locally; the original development database's new migration history has not been repaired. Do not run an automatic migration replay against that database. Use the disposable rehearsal or verify/repair history explicitly first.

Operational details and the supported teacher/student workflow are in [private-workspace-release.md](private-workspace-release.md).

## Intended behavior

Each teacher owns a private workspace containing their subjects, classes, material library, assignments, and reviews. A teacher may teach multiple subjects to multiple classes. Each student uses one account and belongs to any number of classes, including classes owned by different teachers.

A student sees released assignments for classes where they have active membership. Grade, section, subject name, and possession of a URL do not grant access. Teacher A cannot read Teacher B's material, class lists, settings, or student work, even when both teach the same student.

Example: Teacher A creates Technology and Robotics, teaches Technology to 6A and 6B, and Robotics to a mixed-grade club. Teacher B teaches Science to 6A. A student enrolled in Technology 6A and Science 6A sees those two classes. They do not see Technology 6B, Robotics, either teacher's unpublished library, or another student's submissions.

## Original audit baseline (before this implementation)

The table below records the starting point of the audit. Its broad-access descriptions are historical; the implementation checkpoint above describes the local replacement. Hosted parity remains unverified.

| Area | Current implementation | Required change |
| --- | --- | --- |
| Teacher material ownership | `vocabularies`, `weekly_sparks`, and `classroom_activities` have nullable `owner_id`; policies generally authorize any teacher | Enforce ownership on all reads and writes, with no owner reassignment through ordinary edits |
| Subjects | `subjectsRepository.js` uses globally unique `slug` and shared subject rows | Teacher-owned subject IDs; names/slugs may repeat between teachers |
| Classes | Profiles have grade and section; inspected schema has no teaching-class membership model | Explicit teacher-owned classes and student memberships |
| Vocabulary delivery | `studentActivityVocabularyDataMethods.js` merges the public manifest and `teacher_vocab_library`, then filters by grade and subject | Authenticated assignment feed; no discovery of private local drafts or public-file fallback |
| Spark delivery | `sparksRepository.listScheduledForStudent` filters by subject, date, and grade | Membership and assignment release determine access |
| Activity authorization | `private.assert_student_activity_access` checks catalog unit identity, grade, date, and prerequisites | Check assignment, active membership, release, content version, and prerequisites on every start/save/complete |
| Progress | Unit/activity progress keys use student plus unit key; Spark responses use student plus Spark ID | Assignment-specific results so reuse does not merge unrelated class work |
| Teacher reads | Identity roster, summaries, dashboard, review, and batch export functions broadly authorize teachers | Limit identities to own roster and results to own assignments |
| Settings | `app_settings` rows are shared by key | Separate platform settings, teacher defaults, and class/assignment settings |
| Files | Word Hunt and classroom-scene Storage policies include broad teacher access | File access follows the corresponding assignment/submission |
| Account management | `reset-student-password` checks teacher role and target student role | Keep global account recovery outside ordinary teacher permissions |
| Browser persistence | Query cache is account-scoped, but local vocabulary and Word Hunt review use shared keys | Scope drafts/reviews by account and assignment; isolate demo mode |

Key evidence files:

- `supabase/migrations/20260524052937_student_registration_schema.sql`
- `supabase/migrations/20260530154535_add_subjects.sql`
- `supabase/migrations/20260530205654_add_classroom_activities.sql`
- `supabase/migrations/20260604182324_add_weekly_sparks.sql`
- `supabase/migrations/20260816054503_direct_normalized_student_progress_operations.sql`
- `supabase/migrations/20260816182203_add_paginated_teacher_summaries_and_batch_exports.sql`
- `supabase/migrations/20260819202003_add_teacher_identity_roster.sql`
- `supabase/migrations/20260819202524_batch_vocabulary_placement_updates.sql`
- `js/services/{subjectsRepository,settingsRepository,vocabularyRepository,sparksRepository}.js`
- `js/student/{studentActivityVocabularyDataMethods,studentActivityAttemptService,studentActivityHomeSpark}.js`
- `js/{teacherVocabularyStorage,supabaseStorageMethods}.js`
- `supabase/functions/{create-student-account,reset-student-password}/index.ts`

The prior audit's 30 passing focused tests establish some role verification, stale-request cleanup, and pairing-rule protections. They do not test teacher-to-teacher privacy. No new runtime acceptance tests were executed for this planning document.

## Recommended data model

Use the teacher user ID as the workspace owner for this scope. A separate organization system and co-teacher roles are unnecessary for the requested first release.

| Record | Responsibility and constraints |
| --- | --- |
| Teacher subjects | Stable UUID, owner teacher ID, name, optional slug, color, archive state. Slug uniqueness is per owner, not global. |
| Classes | Stable UUID, owner teacher ID, subject ID, display name, school year, optional grade/section, archive state. A class is one subject offering, such as Technology · 6A · 2026. Its subject must belong to the same teacher. |
| Class memberships | Class ID, student ID, active/removed status and dates; unique class/student pair. Membership changes require ownership of the class. Student identity is shared; membership is private to its teacher and student. |
| Existing material tables | Retain the existing vocabulary, Spark, and classroom-activity formats; require owner and teacher subject IDs. Remove schedule/grade fields as access authorities after migration. |
| Material versions | Immutable, typed publication snapshots of the content needed to run and assess an assignment. Separate student-readable content from teacher-only notes or server-only assessment data. |
| Assignments | Stable UUID, owner, class, typed material-version reference, title, release time, optional due/close time, state and activity settings. Enforce same ownership across class, material and assignment. |
| Assignment results | Assignment ID plus student ID and activity type where relevant; attempts, responses, work time, review and files reference this context. |
| Teacher/class settings | Owner-specific defaults and class overrides. Copy effective activity settings into assignments so later default changes do not alter existing work. |

One assignment belongs to one class. Selecting several classes in the UI creates one assignment per class atomically. They can share the same immutable material version. This avoids a second layer of assignment-target tables and gives each class its own schedule and results.

Use actual foreign keys for each supported content type and a constraint allowing exactly one typed reference. Do not introduce an unchecked `type + arbitrary ID` relationship. Composite constraints or equivalent validated transaction logic must prevent linking another teacher's material or subject.

Library edits affect future assignments. Updating a released assignment requires an explicit new version; existing attempts retain the version they used. Due date marks lateness; an explicit close action/time controls whether submissions stop. Store timestamps consistently and display them in the configured school timezone.

Quizzes currently center on a local builder draft and document generation. Scope existing quizzes and their drafts now; do not bundle a new online quiz product into this privacy change. Online quiz assignments can follow through the same typed assignment model when supported.

## Access rules

| Resource | Owning teacher | Other teacher | Enrolled student | Unenrolled student |
| --- | --- | --- | --- | --- |
| Private library and drafts | Manage | No access | No direct library access | No access |
| Class and subject | Manage | No access | Minimal details for own classes | No access |
| Class roster | Own class only | No access | Own membership only | No access |
| Released assignment | Manage | No access | Read assigned student content | No access |
| Submission and files | Read/review own assignment | No access, even for shared student | Own work only | No access |
| Teacher notes/settings/export logs | Own only | No access | No access | No access |
| Account-wide wallet/history | No general access | No access | Own only | Own only |

Teachers see roster identity fields needed for instruction. They do not receive a student's other classes, other teachers, global progress blob, or unrelated files. Cross-class totals in teacher dashboards are calculated only over that teacher's assignments. Shared-student membership alone must never authorize all of that student's progress or images.

Implement reusable private authorization helpers for owned classes/materials and accessible assignments. Derive the caller from verified auth identity; never trust caller-supplied owner IDs or editable profile metadata. Enforce grants and RLS on tables, and independently enforce context in privileged RPCs and Edge Functions. Replace old permissive policies; adding a restrictive-looking policy alongside an existing permissive policy does not close the old access path.

Audit all effective SQL functions, views, Storage policies and service-role functions before cutover, including older classroom features even if hidden in the UI. Normal teacher clients must not use service-role keys. Supabase's [RLS guide](https://supabase.com/docs/guides/database/postgres/row-level-security) and [Storage access guide](https://supabase.com/docs/guides/storage/security/access-control) describe the underlying enforcement mechanisms.

## Teacher and student flows

Teacher setup: create a subject, create one or more classes under it, then enroll students. Class pages show Students, Assignments, and Results. The library supports All subjects or one subject, always within the current teacher's ownership.

Assignment flow: choose a library item, select classes, set availability and activities, preview the student view, then assign. Review and export start from a class or assignment and include only that scope. Removing a student removes class membership; it never deletes their shared account or another teacher's records.

Student entry: My classes shows subject, class and teacher so identically named subjects are distinguishable. Opening a class shows its released assignments. An optional All my work feed combines authorized assignments. Empty membership produces a clear no-classes state, never a fallback to all grade material.

Recommended enrollment for the first release: teachers invite exact email addresses or import a class CSV; an existing signed-in student accepts an invitation. Do not expose a global student search. Match accounts on the server and use generic invitation responses to avoid revealing unrelated accounts. New-account provisioning must establish the intended membership with retry-safe behavior. Defer join codes unless needed; codes alone should not bypass enrollment approval.

One student account serves all teachers. Ordinary teachers must not receive a replacement password for that shared account, since it would allow them to sign in and see other classes. Use student recovery or a separate authorized school administrator for account recovery. Provisioning newly created school accounts needs a controlled initial-credential handoff, not password access for subsequent teachers.

## Progress, files and browser behavior

- Carry assignment ID through launch, unit key generation, attempt start, checkpoint, completion, reports and offline queue. Add explicit assignment foreign keys rather than relying only on encoded strings.
- Change Spark response uniqueness to student plus assignment. Reusing the same reading must not overwrite a response from another class or term.
- Keep server-authoritative scoring and replay idempotency. Reward receipts must include the assignment context. Preserve the student's global wallet, while teachers see only grants/results attributable to their own classes. Keep global economy configuration administrator-controlled; any teacher grant requires own active roster membership and a bounded policy.
- Replace grade-wide teacher/student leaderboard reads with class-authorized results or disable them until class scoping exists. Account-wide arcade scores must not become a way to enumerate unrelated students.
- Store private files in private buckets with assignment/submission mappings. Validate that the object belongs to the referenced submission; an owner-prefixed filename alone is insufficient for teacher access. Use authenticated downloads; account for signed-link expiry if links are introduced.
- Namespace local drafts, review notes, query keys, cached assignment data and offline writes by account and applicable assignment/class. Preserve stale-result guards and cleanup already present.
- Remove the authenticated student's read of `teacher_vocab_library`. Existing unowned local drafts require an explicit local import into the verified teacher's workspace; never assign them silently to the next person signing in.
- On membership removal, assignment withdrawal or logout, discard cached access data and reject queued writes when replayed. The server must recheck access even for previously valid attempts. First release should require an online authorization check to open private assignments; preserve recoverable unsynced work without promising offline access after removal.
- Revocation stops future access. It cannot retrieve screenshots, downloads or data already delivered to a device.
- Stop shipping private vocabulary JSON in public web assets or service-worker precaches. Existing public copies cannot be made historically secret. Deliberately public starter templates may remain only as an explicit separate source, copied into a teacher's private library before assignment. Do not silently merge them into student work.

## Migration and implementation sequence

### 1. Inventory and migration rehearsal

Read hosted policies, grants, functions, table shapes, row counts and owner coverage. Enumerate all current teacher-capable RPCs and Storage paths. Identify public/bundled catalog material, ownerless rows, duplicate IDs, local drafts, and historical progress mappings. Compare hosted state to migrations before creating a backfill.

Produce a proposed mapping from existing material to verified teacher owners and from existing grade/section groups to teaching classes. Treat those fields as migration inputs only. Do not assign all ownerless material to an arbitrary teacher. Quarantine unresolved ownership and ambiguous history for review. Rehearse on a disposable copy and record counts, unmapped rows and checksums where useful.

Exit: every record is mapped or explicitly unresolved; no silent data loss or duplicate rewards. Production ownership decisions require a reviewed mapping before execution.

### 2. Private subjects, classes and enrollment

Add owned subjects, classes, memberships and invitations, with constraints, indexes, RLS and database allow/deny tests. Add narrow `classroomRepository` operations for create/list/enroll/remove, while retaining existing domain repositories. Update subject selection to stable IDs.

Build teacher setup and student My classes against local test data. Keep the feature unavailable to additional production teachers while legacy shared access remains.

Exit: teachers with identically named subjects/classes remain separate; one student can join both teachers without account duplication or directory disclosure.

### 3. Complete one vocabulary assignment path

Add versions and class assignments; implement teacher publish, student feed/detail, assignment-aware attempts/progress, and scoped review/export. Keep existing activity engines by adapting assignment content into their expected vocabulary shape. Extend their context where progress identity is needed. Assignment creation and multi-class publication must be transactional and safe to retry.

Exit: two teachers, two classes and one overlapping student can complete real vocabulary work with separate results, denied direct-ID access and correct rewards.

### 4. Cover the rest of the application

Apply assignment scoping to Sparks, Word Hunt files/review, classroom activities/submissions, dashboards, filters, batch exports, pairing restrictions, settings, rewards, leaderboards, notifications, deep links and account functions. Audit every feature against the access matrix. Keep unsupported features disabled rather than exposing legacy unrestricted routes.

Exit: no ordinary teacher path returns another teacher's content or another class's work; no global student password reset remains in the teacher flow.

### 5. Backfill and controlled cutover

Back up and rehearse first. Retain material IDs through an explicit mapping, while creating assignment IDs and version snapshots. Map old progress only when teacher/class/content attribution is unambiguous; retain ambiguous records as restricted legacy history. Never duplicate a historical completion into several assignments as if each was completed separately. Preserve global balances and existing reward receipts.

Use a bounded maintenance window for the final data mapping and replacement of broad policies/functions. Deploy compatible Functions, authenticated clients and private asset delivery as one coordinated release. Block obsolete clients from legacy assignment operations and invalidate outdated service-worker caches. A UI flag alone is not an access control.

Rollback must retain the restrictive access rules. If acceptance fails, keep affected features closed and repair or restore through a rehearsed compatible data path. Never reopen broad teacher policies to make the old UI work.

Exit: hosted migration/function parity, deployed asset verification and two-teacher signed-in acceptance pass before onboarding more teachers.

### 6. Remove transitional paths

After verified migration, remove grade-based authorization, global subject selection, legacy shared draft reads and obsolete APIs. Preserve required historical records under restricted access. Update architecture docs and teacher onboarding instructions to reflect the final model.

## Acceptance cases required before release

Use Teacher A, Teacher B, Student A-only, Student B-only, Student Both and Student Neither, with multiple subjects/classes and repeated names. Exercise normal browser flows and direct authenticated REST/RPC/Storage requests, not only mocked repositories.

1. A cannot list, fetch by known ID, edit, delete, export, reassign or attach B's material/classes/assignments.
2. Both sees released assignments from both enrolled classes; each teacher sees only their own submissions from Both.
3. A-only and Neither cannot obtain B's content, images, response data or class membership through guessed IDs, aggregates or deep links.
4. Draft/future/withdrawn assignments are inaccessible; release uses server time and configured timezone consistently.
5. Removing membership blocks reads and replayed writes; a removed student cannot reuse a cached attempt token to submit.
6. The same material assigned to different classes or terms has independent responses and progress; duplicate retries do not double rewards.
7. Editing a library item does not alter an existing submitted attempt's content or scoring version.
8. Subjects, calendar changes, activity settings, pairing rules and review notes affect only their intended owner/class.
9. Account switching with requests in flight, unsynced work and local drafts reveals no prior user's material. Student mode cannot read teacher drafts.
10. Privileged functions, exports, Storage and obsolete endpoints enforce the same rules as the UI. Test forged owner/class/material links and membership self-enrollment attempts.
11. Existing history and balances survive the migration; unmapped records remain restricted and reported.
12. Private content is absent from public manifests/build assets and unauthenticated downloads. No global password-reset capability or unrestricted leaderboard restores indirect access.

Run relevant repository/activity/session tests, local authenticated Supabase acceptance, database lint/advisors, production build and signed-in hosted checks. Existing broad-role acceptance tests must be revised to the new contract rather than preserved as expected behavior.

## Product defaults to confirm before implementation

This plan assumes private teacher-owned classes, one subject per teaching class, invitation-based enrollment, no co-teaching or cross-teacher sharing in the first release, and school-admin/student-controlled recovery. Direct individual assignments and shared school templates are later extensions. They are not needed to satisfy the requested class-based access model.

Archived classes retain read-only history for the owning teacher and existing members; withdrawal/removal blocks new access to the affected assignment/class. Retention and account deletion need a separate school policy before destructive cleanup is implemented.

The first implementation deliverable should be the ownership inventory, migration mapping and locally tested class/membership model. The first usable teaching deliverable is the complete vocabulary assignment path in phase 3. Neither is sufficient alone to declare the whole app private; that requires phases 4 and 5.
