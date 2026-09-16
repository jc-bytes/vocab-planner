# Weekly vocabulary implementation

Implemented and tested locally; production deployment is pending access to the signed-in Supabase SQL editor. Chrome stopped exposing its accessibility tree before the live preflight query could run. No live database changes were made.

The clean release checkout is `/tmp/sparks-weekly-pools-release`, based on published commit `408e132257f8aac7684802a7bcc626333c6f2303`. It contains 33 five-word weekly pools and retains 83 future class sets as archived records. The eight Week 1 files remain byte-for-byte unchanged. Teaching pools require Flashcards, Matching and Fill in Blank once across the week; review pools have no new requirement. Both project weeks, October 12–23, have no vocabulary assignments or vocabulary backlog gate. Group-specific lessons use section and date checks on the client and server.

New Word Search rounds accept short terms and use a smaller grid where suitable. Multiword rounds require four eligible terms. Unsuitable activities are hidden. Old unit routes retain saved evidence and exports; no old score is copied into a five-word pool.

The migration aligns 59 optional Spark readings with the weekly examples and archives 24 obsolete project, closure or group-specific readings. The older Spark scheduler cannot target sections, so group-specific readings are not scheduled for the whole grade. Week 1 Sparks and all student progress remain untouched.

## Completed checks

Full `npm test` passed. Catalog validation and the frozen Week 1 tests passed. New browser checks for all four grades placed five Word Search words, showed the correct required path and hid unsuitable activities. Additional browser checks passed for review access, group release dates, old routes, retained evidence, fresh new-pool progress and project-week backlog exclusion. Routing regression tests passed after the archive-route change.

The migration and group/date/retirement/minimum-word/required-review scenarios passed in a local transaction that was rolled back. The production web build passed its asset and size checks.

Updated 48 local Word files, 16 monthly Markdown mirrors and four weekly vocabulary guides. Word package audits and rendering passed. The initial 186 pages were inspected as contact sheets; 19 final corrections were rerendered into 45 pages. Native Word opening and live authenticated acceptance remain pending computer access. Classroom timing has not been observed.

The Word edits remain in the planning workspace. Those files also contain earlier unrelated changes, so they are not copied wholesale into the clean release. App edits were merged back while retaining the unfinished private-classroom work. Deploy only the clean release. No Classroom posts, Drive copies or student results were changed.

## Resume release

Restore Chrome access to Supabase project `ifofhiypzffruzhiukst`. Verify eight Week 1 and 83 future part records, then apply the transactional migration `apps/sparks/supabase/migrations/20260916180000_weekly_vocabulary_pools.sql`. It checks unchanged Week 1 rows, exactly 33 five-word pools and no project-week pools. Verify retired-unit and Spark counts. Never run the local fixture acceptance SQL against production.

Publish the clean release with the existing GitHub Pages workflow, wait for success, then compare the published manifest and all T3 files. Check signed-in group visibility and old evidence routes without changing a real student's scores. Keep future release dates intact.
