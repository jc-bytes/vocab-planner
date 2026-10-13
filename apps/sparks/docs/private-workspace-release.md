# Private workspace release handoff

The local privacy implementation is complete for the supported workflows below. Hosted access is restored. Production release still requires the concrete migration mapping and rehearsal, Firefox verification and signed-in hosted acceptance. No hosted migration or deployment has been performed.

## Teacher and student workflow

1. A teacher signs in and opens **Classes**. Create the subjects they teach, then create each class under its subject/year.
2. Create reusable vocabulary or Sparks in the teacher's own content library. Save before publishing.
3. Select **Open class**. Invite one student by email, or paste a list of student emails. Pending invitations can be cancelled. Students sign in with the matching verified email and select **Join class**. No invitation email is sent by this implementation.
4. Select a saved material, choose one or several owned classes, and set availability and optional due/close dates. Dates use the device timezone. Publication saves a snapshot; editing the reusable material later does not change that assignment.
5. Students open **My classes** and see released work for their active enrollments. Vocabulary opens the existing activity engines. Sparks support reading-only work, teacher-reviewed writing, and privately checked multiple choice.
6. Teachers read Spark responses and vocabulary results under their own class assignments. Results export as CSV. A shared student never exposes the other teacher's work or the student's global wallet.
7. Removing a student blocks further access; withdrawing an assignment blocks student access. Archived classes retain read-only history for existing members and their owner. Close dates block writes while preserving readable history.

## Restricted legacy features

Global teacher coin grants, global Arcade score exports, ordinary-teacher account creation/password resets, shared settings writes, grade-based activity authorization and old classroom activity/submission APIs are closed. The older classroom activity tables and non-Word-Hunt file buckets remain restricted history. No classroom-activity migration is inferred from those legacy tables.

Spark checks preserve published answer checking and response history. They do not award new Spark XP or make a Spark a prerequisite for unrelated teachers' activities. School-wide account administration requires the trusted school-admin role; assigning that role is outside ordinary teacher self-service.

## Existing-data mapping

Ownership confirmed by the user on 9 September 2026: all existing teaching materials belong to the sole current teacher account. This decision is approved; do not ask for per-material ownership approval again.

Resolve that owner from the hosted teacher account before preparing the concrete backfill. Verify that the hosted inventory has exactly one current teacher, then pin its user ID and the inventoried material IDs in the migration mapping. If the inventory contradicts the user's description, resolve that discrepancy before changing rows. Do not use the local audit teacher as the production owner or apply an unrestricted rule to materials added by future teachers.

After the user renewed the CLI login on 9 September, hosted read-only access succeeded. The sole hosted teacher is `pjrios@aid.edu.pa`, user ID `8bcab255-f64c-4b74-9e32-21fb8629ea86`. This is the confirmed destination owner for existing teaching materials. No ownership rows have been changed.

The hosted database has 236 students with existing grade/section records: 6A 23, 6B 23, 6C 22, 7A 29, 7B 29, 8A 27, 8B 28, 9A 28 and 9B 27. The user explicitly requested reuse of the site's existing students/classes; use this verified legacy grouping to prepare the one-teacher migration roster, rather than asking for duplicate student lists. This is a bounded legacy conversion, not grade/section-based authorization for future teachers.

The initial hosted material counts are 241 vocabularies, including 226 without an owner, and 169 Sparks, all without an owner. These supersede local inventory numbers for production planning. Further inventory, backup and mapping rehearsal are still required before applying a cutover.

Run `npm run preflight:workspaces` from `apps/sparks` for a **read-only local** inventory. Its default file is `/tmp/sparks-private-workspace-preflight.json`, readable only by the current user. The optional `--owner-email` proposes an existing local teacher; it does not assign rows or approve the proposal.

Apply the confirmed ownership decision to the verified hosted snapshot and retain each material's subject. For each class, supply its subject/year and student emails. A grade and section alone are insufficient evidence. Historical progress requires an explicit original material/class attribution. Keep ambiguous history restricted and retain original reward receipts and balances.

The final local inventory contained 270 materials, 265 unowned and zero invalid known owners. Added audit fixtures account for the difference from the initial 269-record inventory. These numbers do not describe hosted data. Earlier hosted inventory attempts returned HTTP 403; the renewed-login verification above supersedes that access blocker.

## Verification commands

From `apps/sparks`, against an already migrated local database:

```sh
npm test
npm run test:acceptance:supabase
SPARKS_TEST_FUNCTION_GATEWAY=1 npm run test:private-classrooms
npm run test:ui:auth-smoke
npm run test:ui:cross-browser
npm run test:ui:responsive:local
npm run test:ui:smoke:dist
supabase db lint --local --fail-on error
supabase db advisors --local --level warn --fail-on error --type all
npm run desktop:build:web
```

The acceptance seeds are local-only and no longer apply migrations as a side effect. Run suites that use the fixed audit teacher/student **sequentially**: seeding resets those disposable passwords and invalidates concurrent sessions. Private-classroom acceptance uses independently named accounts and cleans them up.

The production build is `dist-desktop`. The GitHub Pages workflow uploads that build. Do not deploy the source tree or publish the source vocabulary directory. CI includes both database acceptance suites.

For Colima, the local Functions main entrypoint must be in a mounted path:

```sh
mkdir -p "$HOME/.cache/sparks-supabase-tmp"
TMPDIR="$HOME/.cache/sparks-supabase-tmp" supabase functions serve --no-verify-jwt
```

This local serving flag does not grant administrator access: both handlers authenticate the bearer token themselves and require trusted app metadata. Do not copy local JWT settings into a production deployment without reviewing the actual gateway configuration.

## Cutover and rollback

Back up the hosted database and private files before applying the approved mapping. Rehearse the exact migration chain and data mapping on an isolated copy. Record owner counts, memberships, assignments, history, global balances and reward-receipt counts before and after.

Deploy restrictive database policies, compatible account Functions and the authenticated built client in a controlled window. Verify no old endpoint, public asset or stale-client fallback restores broad access. Run signed-in Teacher A / Teacher B / shared student / unenrolled student acceptance against the deployed release.

Rollback must retain restrictive access. If acceptance fails, keep affected features closed while restoring a compatible private data/client version. Never reinstate broad teacher RLS as a rollback shortcut.

## Final local verification record

- Fourteen private classroom acceptance tests passed, including the real local Functions gateway. The final nine migrations also applied from scratch to a separate database and all fourteen tests passed there. The disposable stack was then stopped; its volume remains available for inspection.
- Eleven existing database/repository/reward/Realtime tests passed with class-based fixtures. The final complete `npm test` run and focused repository/navigation/style checks passed after the last source and layout edits.
- Chromium authenticated accessibility, seven-width responsive checks including teacher/student Classes, nine-width student shell checks, built-client smoke, and thirteen sandboxed games passed.
- WebKit passed teacher/student sign-in, assignment activity routing, IndexedDB and sandbox checks. Firefox failed to launch with a macOS sandbox/framebuffer error before loading the application; its gate has not been waived.
- Dependency audit: zero vulnerabilities. Database lint: no errors, two existing unused-variable/parameter warnings. Advisor: one allowlist policy performance warning.
- Final build: 13.2 MB total; student entry about 203.4 KiB gzip; teacher entry about 179.9 KiB gzip. Existing limits were retained. Both entry bundles still have little spare budget.
- Sparks-scoped whitespace/diff checks passed. Unrelated planning files and pre-existing code edits remain in the worktree. No commit, push, hosted migration, ownership backfill or deployment was performed.
