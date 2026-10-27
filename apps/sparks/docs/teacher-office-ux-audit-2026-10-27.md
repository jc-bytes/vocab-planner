# Teacher office UX audit and repairs

Date: 27 October 2026. Roles were defined first in `teacher-office-page-roles.md`. Pages were inspected and repaired in this order: Classwork, Students, Home, Library, Review, Settings, School settings, Platform.

This is a local source and browser-fixture audit. It verifies bounded workflows with fictional records, not live-school results or teacher acceptance in a real lesson. It does not assign an unsupported "best UX" score.

## Findings and repairs

| ID | Page | Finding | Repair and local status |
| --- | --- | --- | --- |
| OFFICE-01 | Classwork | Every assignment offered Review, including future work with no student results. | Scheduled work opens Assignment details; released work offers Student work. Fixed. |
| OFFICE-02 | Classwork | The teacher could not inspect the actual published material directly from its list. | View material reads the assignment's saved version through the existing authorized read API. It never fetches the newer Library material. Vocabulary words and Spark reading/questions are read-only. Loading, retry, close, and stale-response handling are covered. Fixed. |
| OFFICE-03 | Classwork | Search, filters, view, sort, and pagination reset after leaving the page. | State is retained separately for each class within the open app, with account/school ownership checks and pagination clamping. Fixed. |
| OFFICE-04 | Classwork | Four always-visible filters displaced the work, especially on phones. | Keep search and Assign material visible; place filters/sort in a disclosure. The Status filter appears only in All work because the other views already define status. Fixed. |
| OFFICE-05 | Classwork | Publication opened a review page immediately, including for future work. | Publication returns to the selected target class in Classwork, choosing Current or Upcoming from the published availability time. It resets stale list filters so the new item is visible. Fixed. |
| OFFICE-06 | Classwork | Narrow screens required horizontal scrolling to reach actions. | Compact mobile columns wrap titles and show dates/actions directly. The redundant trimester column is omitted on narrow screens; trimester filtering remains available. Fixed. |
| OFFICE-07 | Students | The main learning action was hidden in a row menu. | A student's name directly opens their progress record in the selected class. Secondary work/activity/account actions remain in the menu. Fixed. |
| OFFICE-08 | Students | Roster search and page reset on return. | Preserve class-specific search/pagination in memory; clamp the page after enrollment changes. Fixed. |
| OFFICE-09 | Students | The fixed-width roster displaced actions on a phone. | Wrap names/emails and reserve an action column within the narrow viewport. Fixed. |
| OFFICE-10 | Home | Returning discarded class-directory search and filters. Its relationship to Students/Review was unexplained. | Preserve directory state within the open app and explain that opening a class establishes the context for other pages. The searchable active-class directory remains the starting approach. Fixed. |
| OFFICE-11 | Library | The page did not explain the consequence of editing already assigned material. | Vocabulary and Spark browser scope text explains that Library edits do not change assigned copies. Existing prepare/preview/reuse/assign workflows were retained and checked. Fixed. |
| OFFICE-12 | Review | The real sidebar destination also offered publishing and scheduled-assignment management. | The office's Review destination has Needs review, Current work, and History. Publishing and Upcoming stay in Classwork. The underlying reusable assignment component retains its supported generic mode. Fixed. |
| OFFICE-13 | Review | Student work opened from Classwork lost the return destination. | Preserve a validated Classwork return context through the route and detail tabs; offer Back to Classwork. Review list state is separate for each class. Fixed. |
| OFFICE-14 | Settings | School-wide controls could be mistaken for personal settings. Calendar editing was duplicated. | State that learning settings affect all classes in the named school. Hide the duplicate calendar tab and link to School settings / Academic years. Old calendar URLs resolve to that editor. Existing subject/reward controls and authorization remain intact. Fixed. |
| OFFICE-15 | School settings | The relationship between school administration and class learning records was unclear; calendar shortcuts could not open the right section. | Show the affected school, distinguish school administration from Students, and support a bounded Academic years deep link. Fixed. |
| OFFICE-16 | Platform | School status changes and platform-access revocation executed directly from row menus. | Existing dialogs now identify the school/account and action before submitting. Cancellation performs no mutation; existing pending/save/error handling is reused. Fixed. |

## Verification

- `node scripts/ui-teacher-class-workspace-smoke.mjs`: published-copy loading/retry/stale reads, scheduled details, roster progress action, state restoration, paging, menus, enrollment dialogs, and stale accounts.
- `node scripts/ui-teacher-class-home-smoke.mjs`: real sidebar navigation, selected class, per-class list state, Back to Classwork, publication returning to Upcoming, browser history/refresh, shared Library, groups, narrow layouts, and account isolation. Classwork, Students, and Home receive focused accessibility scans.
- `node scripts/ui-teacher-material-actions-smoke.mjs` and `node scripts/ui-teacher-vocabulary-browser-smoke.mjs`: populated Library navigation/actions, saves/copies, role restrictions, late imports, cancellation, and cards/rows behavior.
- `node scripts/ui-teacher-assignments-smoke.mjs`: publication retry protection, actual result/response rendering, saved feedback, review readback, and exact scoped exports.
- `node scripts/ui-teacher-data-management-smoke.mjs`: Settings lazy lifecycle and existing control behavior.
- `node scripts/ui-school-admin-smoke.mjs` and `node scripts/ui-school-shell-smoke.mjs`: school scope, academic calendar operations, actual shell permissions, calendar deep links, Platform action confirmations/cancellation, and stale operations.
- `node scripts/ui-teacher-loading-smoke.mjs`: refresh loading, sidebar/route alignment, narrow screens, reduced motion, and session handoff.
- Portable unit suite: 1,562 tests passed. Web production build and bundle-size checks passed. Final browser evidence is in `/tmp/sparks-class-home`.

## Practical limits

- The published-material dialog lets a teacher inspect saved content. It does not simulate a student's full activity session; Library's existing student preview remains the interactive preview workflow.
- Classwork does not invent class completion totals or infer lesson groups from repeated titles. Aggregate completion and explicit multi-part lesson grouping require a separately defined data contract and acceptance criteria.
- Filter/search/page restoration lasts while navigating in the open app. Reload restores the selected class and route; it does not persist every list filter to device storage.
- Review's Needs review queue covers written Spark work. Word Hunt evidence remains a separate linked workflow with device-local review-note limits stated in the interface.
- Hidden legacy calendar markup remains for compatibility with existing settings modules. The office navigation and old calendar URLs use the School settings editor.
- There were no database changes, school-data conversions, commits, or deployment. Physical-device acceptance, real student/teacher authorization, and hosted revision verification remain separate.
