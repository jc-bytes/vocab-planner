# Section loading recovery

Student Today, Units and Sparks and teacher Home, vocabulary/Spark libraries, Classes, Assignments, Review and school administration distinguish a failed read from a confirmed empty result. Failed sections offer **Try again** without reloading or signing out. Settings retry only the failed settings read, preserving other fields.

Student class data commits as a complete snapshot. A failed refresh preserves the previous snapshot; switching classes cancels the previous read. Account, school and navigation guards prevent stale reads and retry buttons from affecting newer views. Permission failures clear stale content instead of presenting it as current.

Read-only repository requests have a 10-second deadline and propagate cancellation to the transport. This deadline is never applied to uncertain writes. Existing server-state queries may retry a failed read once; section recovery does not add background retry loops.

Recovery code is warmed while connected and included in the full student offline graph. This lets an offline failure render the recovery control. This change does not alter save queues or save-status wording.

Run `npm run test:ui:section-recovery` against local Supabase fixtures. After a production build, run `SECTION_RECOVERY_DIST=1 npm run test:ui:section-recovery`. The test injects section failures, an offline interruption and a stalled read, then checks in-place recovery, retained content, accessible controls and phone containment. Both run in the Pages release workflow.
