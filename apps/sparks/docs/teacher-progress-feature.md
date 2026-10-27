# Teacher roster and profile feature

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
