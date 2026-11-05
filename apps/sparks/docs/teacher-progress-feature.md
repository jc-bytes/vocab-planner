# Teacher roster and profile feature

## Class trimester progress

Students has Roster and Trimester progress views for the selected class. Progress
defaults to the school calendar's current trimester, or the most recent available
trimester during a break. Custom inclusive dates can cross trimester boundaries.
Dates select assignments by release time in the school's timezone; completion is
current, including work finished after the selected dates. This is not a historical
completion snapshot.

The class summary uses `teacher_class_progress_v1` through `classroomRepository`.
Its private implementation checks authenticated school/class teaching authority
before reading active memberships, published version requirements, verified
activity progress, responses and revision-aware teacher feedback. It returns only
per-student required, completed, review and unknown counts. Future, withdrawn,
retired and archived-class work is excluded; closed assignments still count.
Optional vocabulary activities and optional/reading-only checks add no required
tasks. Unknown requirements make the bar unavailable, including when all known
tasks are complete. Empty periods show No required work. No answer or attempt
history is loaded for the class summary.

Bars fill continuously, with red/orange/yellow/yellow-green/green bands at
0/20/40/60/80 percent. Unfinished results are floored below 100%; only exact
completion is labelled Complete. Counts and percentages accompany colors.
The mobile layout shows full-width bars beneath names without horizontal scrolling.

Names open the existing assigned-work view with the same class and date range.
Show all work expands to the selected class's school year. Back navigation, profile
tab changes and previous/next student navigation retain the period. The route
preserves search, sorting, unfinished filter, page and return scroll position.
Changing date ranges cancels obsolete reads, and failed requests show unavailable
progress with retry rather than zero completion.

Apply migration `20261104043424_class_trimester_progress.sql` before publishing the
frontend. No new storage tables or student writes are introduced. Validate with
`npm run test:class-progress`, the existing student insight UI smoke, and
`npm run test:student-insight:database`. The database rehearsal creates a disposable
schema-only clone, installs missing migrations, compares summary counts with the
individual model, checks permissions/date boundaries/review revisions, then removes
the clone. The new checks are included in normal validation and the existing CI
student-insight database gate.

## Feature ownership

The teacher shell retains two asynchronous view commands, a strict roster-data
command, synchronous session reset, and synchronous snapshot readers. It does
not install roster/profile/provisioning methods after a dynamic import.

`teacherStudentProgressFeature` owns a private context. Existing method groups
are installed on that private class at module evaluation. The factory receives
explicit session, navigation, class, query, authentication and view capabilities;
it receives no manager object or open forwarding proxy. Its public facade is
frozen.

View commands use the existing lazy feature lifecycle and await their promises
inside its error boundary. Obsolete/cancelled views settle quietly. The roster
data bridge instead returns the actual array or rejects to its export caller,
independently of same-account view navigation. Its returned array is the same
snapshot exposed by the shell reader.

The eager reset epoch advances even if the feature never loaded. A held import
cannot create an old context after reset/account/school replacement. New private
contexts seed their query session from that epoch. Reset aborts pending data
waiters, disposes the loaded context, clears selection/data, and retains the
existing disabled Create Student and Reset Password policies.

Identity reads retain QueryCore sharing and scope cancellation. A 30-second
operation deadline also covers import and data; its private read composes caller,
query and feature-lifetime cancellation. Ignored late transport/initialization
cannot apply a roster snapshot. Normal read errors remain visible to callers.

Static controls, dynamic row/profile controls, filter timers, profile requests
and charts share private disposal ownership. Leaving a profile cancels its
rendering/chart work without discarding the headless roster or selected IDs.
Class-membership checks still precede profile/identity queries.

Verification combines the existing roster/profile/export/ownership tests with
`teacher-progress-feature-boundary.test.mjs` and the real-shell synthetic-network
`test:ui:teacher-progress-feature` smoke. The built mode is
`UI_TEACHER_PROGRESS_FEATURE_DIST=1`. Fresh contexts block service workers to
measure application demand loading, separately from offline precaching. The
authenticated UI smoke also cold-opens an enrolled student's real local backend
profile without opening the legacy whole-school roster first.
