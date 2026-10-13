# Sparks school platform implementation and release

Local implementation, 17 September 2026. Nothing in this change has been deployed to the hosted project. The earlier hosted migration inspection returned HTTP 403, so production schema and data still need verification.

## Implemented behavior

- Multiple platform admins manage schools and school administrators. Platform administration alone grants no educational-record access.
- Each account can join multiple schools and hold multiple school roles. Teachers and students belong to a school before class assignment/enrollment. Grade and section belong to the school membership.
- Schools own subjects, academic years, classes, content libraries, settings, and published history. Classes support multiple assigned teachers. School administrators assign teachers and archive classes.
- School invitations require a verified matching email. Invited users can create an account and use email recovery. The former account-creation and administrator password-reset Functions return HTTP 410 and cannot change accounts.
- Membership removal and school suspension revoke server access during existing sessions. Concurrent administrator removals cannot remove the last administrator.
- School selection scopes repository requests, query caches, drafts, routing, and feature lifecycles. Student lessons load immutable class-assignment snapshots.
- Account-level rewards remain intact. School reports exclude the global wallet. Teacher exports omit account-level game scores because those records have no school provenance.

Invitations appear inside the app when the recipient signs in. This release does not send a separate school-invitation email. The administrator must give the recipient the app URL. Auth verification and recovery emails use the project's configured email service.

## Database changes

Apply after the existing private-classroom migration chain, in timestamp order:

1. `supabase/migrations/20260917131020_school_platform_foundation.sql`
2. `supabase/migrations/20260917131024_school_classroom_ownership.sql`

Legacy rows may temporarily have a null school during the controlled migration. They are inaccessible through the new school policies. Normal client writes require school ownership. Do not release these policies to active users before completing the mapping and publishing the matching client.

The operator-only `private.bootstrap_platform_admin(uuid)` bootstraps an existing account. Subsequent administrator grants use authenticated administrative RPCs. Platform admins can create a school with its first administrator's email through `create_school_with_admin_invitation_v1`. The school remains pending and inactive until that recipient verifies their email and accepts; the creator receives no school role. Do not derive platform authority from a profile role, user metadata, or email domain.

The operator-only `map_legacy_school_v1(uuid,jsonb)` accepts an explicit manifest:

```json
{
  "approved": false,
  "subjects": [],
  "classes": [],
  "vocabularies": [],
  "sparks": [],
  "teachers": [],
  "students": [],
  "group_restrictions": []
}
```

Replace the arrays with exact record IDs from the refreshed inventory and approve the mapping before changing `approved` to true. The function rejects missing/inactive members, foreign-school records, omitted assigned materials, and omitted active class students. It maps class years and the selected classes' version/assignment closure, retaining existing IDs and content. The optional `group_restrictions` array maps exact personal pairing-rule IDs only after validating the teacher and both students in the target school. Unmapped rules remain inaccessible; ambiguous ownership is never guessed. It does not invent classes or enrollments for historical grade-based activity. That older history needs an explicit decision if it is to become new class assignments.

## Hosted rollout procedure

1. Regain read access and inspect the actual hosted migration history. Reconcile all pending private-classroom migrations with `docs/private-workspace-release.md`; do not assume the local schema matches production.
2. Capture a restorable backup and inventory classes, memberships, subjects, content, immutable versions, assignments, submissions, file references, and reward receipts/balances. Preserve the current frontend artifact and Auth configuration.
3. Prepare the initial school name/timezone, verified bootstrap administrator UUID, first school administrator email, and exact mapping manifest. The existing-account UUID creation RPC remains available for a controlled legacy migration. Reuse previously approved ownership decisions after refreshing their record IDs/counts. Resolve ambiguous legacy activity separately.
4. Rehearse the entire proposed hosted migration chain and manifest on a disposable copy of the hosted schema/data. Compare IDs, row counts, published-content hashes, submissions, storage references, and reward balances before/after. The local acceptance below is not a substitute for this hosted rehearsal.
5. During a maintenance window, keep application writes unavailable. Apply the additive migrations, bootstrap the platform administrator through a trusted SQL operator, create the school with its administrator, complete first-admin acceptance if using an email invitation, and apply the approved manifest. Explicitly migrate the intended shared calendar/settings through `set_school_settings_v1`; do not automatically choose one teacher's settings for everyone.
6. Verify no intended active class/material/membership remains unmapped. Create or verify school academic years and co-teacher assignments. Check administrator and student access with real verified test accounts.
7. Deploy the retired create/reset Functions and matching frontend. Configure Auth signup to allow invited registration, require email confirmation, and allow the exact teacher/student page redirect URLs for verification/recovery. The database trigger gates new accounts by an active invitation or trusted provisioning ticket. Verify email delivery with the configured provider.
8. Run authenticated acceptance for two schools, co-teaching, removal, suspension, classroom activity saves, assignment files, reports, account recovery, and a queued offline save after membership revocation. Verify a new frontend/service-worker version loads before reopening writes.

Before reopening writes, rollback can restore the captured database, Auth configuration, Functions, and frontend together. After new school-scoped writes exist, prefer a forward repair; restoring the old database would lose those writes. Do not deploy an old frontend alone against the new permission model.

## Validation and limits

The local work uses disposable schema clones and a separate full Supabase stack under `/tmp`. It does not mutate the stack's normal application database or hosted records.

- `npm run test:school-platform` runs membership/auth/repository/routing tests and browser administration/shell/account-recovery checks. The retired Functions are executed with native Request/Response objects and I/O blocked; this is not a Functions-gateway deployment test.
- `npm run test:school-platform:rest` clones the local schema with its actual owners/grants, applies the school migrations only when absent, starts a temporary PostgREST gateway, and exercises authenticated HTTP requests. It also runs both SQL acceptance files and the foundation concurrency suite before cleaning its database, role, container, and temporary secrets. `SPARKS_VERIFY_APPLIED_SCHEMA=1` additionally checks the already-migrated source path used by CI.
- `npm run test:school-platform:database` requires `SPARKS_SCHOOL_TEST_CONTAINER` and `SPARKS_SCHOOL_TEST_DATABASE` pointing to a disposable initialized school test database. Without them, this standalone command skips the test; the REST harness supplies them automatically.
- `supabase/tests/school_classroom_acceptance.sql` and `school_legacy_mapping_acceptance.sql` cover classroom access and migration preservation. Run only on a disposable initialized school database.
- `npm run desktop:build:web` validates the web build, lazy chunks, service worker, and existing delivery budgets.

The REST rehearsal clones the current local application schema and applies the additive school migrations. It is not a pristine replay of every historical migration and does not exercise production pg_cron, Auth email delivery, or hosted storage infrastructure.

The broader unit run found an existing frozen-content checksum mismatch in both Grade 8 Week 1 parts. This change does not alter those lesson files or bless a new checksum. Full `npm test` remains blocked by that separate curriculum fixture discrepancy.

### Completed local checks

- Focused school suite: 73 unit tests passed, plus administration/year/placement/first-admin onboarding, actual school-switching shell, assignment-snapshot, mocked signup/recovery, and two-school student placement/calendar browser checks.
- Broad unit run: 763 passed, one failed, zero skipped. The only failure is the unchanged Grade 8 Week 1 frozen-content checksum described above.
- Production web build passed. Initial compressed JS/CSS is 208.3 KiB for students and 175.5 KiB for teachers, within the unchanged 210/180 KiB limits.
- Database foundation checks passed, including concurrent administrator and invitation/removal cases. Classroom and explicit legacy mapping checks passed in the disposable schema rehearsal. Actual PostgREST acceptance passed with original database grants preserved.
- A separate disposable Supabase stack replayed the full historical migration chain and configured seeds successfully. No hosted deployment or live-email acceptance is claimed.

## Audit corrections

The follow-up audit identified six gaps. The corrections keep this release local until the hosted rollout checks above pass.

- A removed member's new invitation establishes only its intended roles. Invitations to an already-active member remain additive.
- Temporary school suspension no longer causes unchanged member saves to erase class assignments or enrollment. Actual membership/role removal still revokes access.
- Student account profiles hold identity names; grade and section come from the selected school membership. Students are not asked to change protected global placement fields.
- School selection and assignment links establish the student's school placement and calendar. Delayed responses cannot replace a newer school's state; cached calendars are keyed by account and school.
- PDF exports capture one assignment's data before loading the renderer. Navigation, account replacement, and school changes cancel stale exports, including reports waiting for images.
- A platform administrator can create a school and invite its first administrator by email. Pending onboarding has an explicit inactive state, supports replacing/revoking the initial invitation, and requires verified acceptance before activation.

Targeted regression tests include inactive-role re-invitation, member edits during suspension, first-administrator registration and acceptance, different student placements/calendars in two schools, and delayed report rendering during navigation.

The corrected lifecycle and first-administrator flows passed a fresh disposable PostgREST rehearsal with the original database permissions preserved. The test includes attempts to restore old roles, edit suspended-school members, reuse/revoke onboarding invitations, and submit a stale administrator replacement after activation. Temporary databases, gateway containers, and roles were removed.

## Final audit corrections

- Profile saves capture the initiating account before asynchronous initialization and reject account replacement or sign-out/sign-in races.
- Pairing preferences belong to a school and teacher. Active school teachers can manage their own rules for students in their assigned classes, regardless of legacy global profile role.
- Student calendar requests abort on replacement and time out after eight seconds. Class and assignment navigation continue with calendar defaults; late results cannot overwrite a newer school.
- Publication acquires school locks before class locks and checks teaching authority after waiting. Concurrent teacher reassignment no longer creates the previous lock inversion.
- Class lists expose server-derived `canTeach`; publication targets and withdrawal controls use that capability. School administration by itself does not show teaching actions.
- Administration searches members on the server and displays 25 per page, with a server maximum of 50.
- `npm test` includes the school client suite; CI and `test:release` require the disposable REST/SQL/concurrency suite. Older acceptance fixtures now create school memberships, academic years and school-owned materials.
- Shared random helpers no longer pull student storage into the teacher entry. Legacy image compression loads only when needed. Delivery limits remain unchanged.

The disposable REST checks cover invited teachers with a student global profile, personal pairing-rule isolation across schools, invalid and unassigned student pairs, removed membership, explicit legacy rule mapping, member pagination/search, and teaching capabilities. Deterministic concurrent tests cover publication alongside reassignment and permission removal while publication waits. Both the additive-migration and already-migrated source paths passed, including the SQL classroom/legacy scenarios and foundation concurrency suite.

Built-output browser smoke passed for landing, student and teacher pages, including accessibility and modal focus checks. The account-access heading follows each page heading, and signed-out student startup no longer requests the retired public vocabulary catalog. Student and teacher initial payloads still have less than 5% budget headroom; the limits were not raised.

Full-stack private-classroom acceptance passed 14 tests with no skips, including authenticated teacher/student browser flows, Storage, immutable assignment assessments, activity attempts and cross-school denials. The fixture helper now creates school membership, school years and owned content explicitly; a disposable-workdir override requires an explicit database container to prevent fixture writes reaching a different stack.

The local Supabase repository/RLS/RPC/Realtime suite passed 11 tests with no failures. Authenticated browser smoke passed against the separate stack using real teacher and student accounts in one browser profile, including teacher Sparks and student Classes/private-assignment rendering. Heading structure was corrected in those views without changing teaching permissions. The smoke test substitutes only the isolated loopback API port in its test response; production CSP stays unchanged.

The final build and built-page smoke passed after the last accessibility changes. The separate full rehearsal stack was stopped and its disposable volumes removed; the normal local Supabase database remains running.
