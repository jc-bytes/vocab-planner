# Reuse school snapshot aggregates

Migration `20261025190430_materialize_school_snapshot_activity_groups.sql` adds `MATERIALIZED` to only `activity_groups` and `state_groups` in `private.student_progress_snapshot_school_v2`. The accepted permission cache changed the plan shape: both educational aggregates were being evaluated once for every unit. For a student with ten units and 80 activity rows, the actual plan ran each aggregate ten times and called the two attempt-JSON helpers 1,600 times.

Materializing those aggregate results makes each execute once. The entire function body is otherwise byte-identical to the accepted permission-cache version. JSON projection, predicates, ordering, NULL handling, the original permission helper, batch wrapper, owner, ACL and function properties remain unchanged.

`node scripts/rehearse-school-progress-groups.mjs` creates a disposable clone and compares exact SQL and actual SDK/PostgREST outcomes across 13 role contexts, single/batch reads, ordering/limits, NULLs, missing summaries and the maintained mixed-permission fixtures. It applies the candidate twice and protects every other function definition/owner/ACL plus policies, RLS flags and relation/column privileges. Its executed plans must show activity and state aggregate loops falling from 10 to 1, actual attempt-JSON calls falling from 1,600 to 160 per student and 48,000 to 4,800 per batch, while permission calls remain 10/300 and batch snapshot calls remain 30.

The optional `SPARKS_REHEARSAL_ISOLATED_MANIFEST` uses the existing capped private investigation cluster; both networks are attached before starting its temporary gateway. The source database is untouched and disposable resources are removed in `finally`. Evidence stays under `/tmp/sparks-school-groups-evidence-*`.

This proves equivalent behavior and less repeated query work. It does not establish production capacity or erase the recorded failed, contended workload results. No workload, SLO or deadline changes are part of this repair.
