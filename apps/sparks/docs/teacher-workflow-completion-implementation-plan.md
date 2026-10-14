# Sparks teacher workflow implementation plan

Status: implementation authorized, layout foundation locally verified. Updated 13 October 2026, America/Panama.

Make a teacher able to open a class, choose a vocabulary assignment, see who has finished it, and inspect one student's remaining work and answers. Build the remaining reports, review tools, accommodations, and Arcade policy around the same assignment-specific evidence.

This plan covers the fourteen functional gaps from the teacher audit and a fifteenth work item for teacher layout and information organization. The teacher authorized implementation on 13 October, beginning with layout and then progressing one item at a time. This document does not record deployment approval for the new changes. The audited teacher code and migrations match deployed main commit `781faa870bb8c946ef17ea7ad5a389db8dbe40c5`. The read-only audit found 236 class memberships, 1,023 assignments, no assignment due dates, and 243 released vocabulary assignments requiring individual content reads in the existing roster calculation. Those counts are the audit snapshot, not permanent configuration.

Existing student profiles, attempt inspection, published material snapshots, scoped teacher notes, CSV/PDF exports, and server-verified activity completion remain the foundation. Extend these owners incrementally. Preserve unrelated changes in the original checkout and start implementation from a clean current-main worktree. Do not repeat the previous school cutover or infer ownership for the eleven preserved ambiguous historical unit records.

## Implementation record

### Layout foundation, 13 October 2026

Implemented on `codex/sparks-teacher-layout` from deployed main `781faa870bb8c946ef17ea7ad5a389db8dbe40c5`.

- Removed the decorative teacher page wrapper and duplicate workspace title band.
- Replaced oversized class cards with a responsive grid, following the teacher's request for three classes per line. Assignments and class students use compact rows with actions beside their target.
- Aligned assignment filters, styled shared tabs, and moved subject identifiers into optional details.
- Split school administration into Members, Invitations, Academic years, History, and Platform administration. Members open in individual disclosure editors. Existing permission and mutation handlers remain in place.
- Local verification passed 878 unit tests, the full scripted checks, and the production build. A populated four-screen fixture covers seven widths, long titles, hidden controls, member disclosures, and keyboard navigation. After the three-column adjustment, its focused layout check passed again.
- The teacher preferred the flatter direction and requested more use of width. The revised three-column layout has a local screenshot; final teacher acceptance, hosted verification, and physical-device acceptance remain pending.
- No database migration or production data change is included. Linux CI and publication remain pending.

The remaining functional items are planned. Next is the shared completion contract and the single-vocabulary report, with server aggregation to avoid one published-content request per assignment. Layout patterns continue through every later screen; this first change does not mark all of item 15 complete.

## Completion contract shared by every screen

Implement this before adding more dashboards. The server supplies the effective published requirements and authoritative evidence; a small shared presentation model supplies labels and counts to the existing teacher views. Do not introduce a second client-side completion authority or a generic reporting framework.

For one student and one assignment, distinguish:

- Assignment lifecycle: scheduled, available, closed, withdrawn, or historical.
- Learning progress: not started, in progress, requirements complete, or unavailable.
- Teacher review: not required, awaiting review, accepted, or revision requested.
- Deadline condition: not due, past due and unfinished, submitted after the deadline, or exempt under an explicit exception.
- Activity timer condition: within limit, exceeded limit, or time-limit excuse.
- Reward state: not eligible, pending, awarded, or limited by a cap.

Vocabulary requirements come from the immutable published version, adjusted by an explicit student exception if one exists. Include every required activity even when no progress row exists. Optional activities appear separately and do not inflate required completion. Unknown requirements remain unavailable; they must not become zero required work or complete work. A unit with no required tasks displays that condition explicitly.

Use server-verified completion consistently. A game score, coin balance, finished run, and answer accuracy are separate measures. Completing work does not automatically mean mastering its words. Written or image tasks require teacher acceptance only when the assignment's policy explicitly requires it. Reading checks use the same progress and review dimensions while retaining their own answer evaluation.

For an active student with three required activities and only Matching finished, every report must show one of three complete, two not started, and the vocabulary in progress. Preserve former-member evidence as history, but exclude former members from the active-roster denominator. Evaluate school dates in the school's timezone.

## Delivery sequence

| Release | Work included | Required outcome |
| --- | --- | --- |
| 0 | Item 15 layout foundation and representative screen designs | An organized teacher shell, readable controls, and consistent list, report, detail, and settings patterns |
| 1 | Shared completion contract, item 14, item 1, item 15 report layout | A fast, accurate report for one vocabulary and all enrolled students |
| 2 | Items 2, 3, 5 | Connected class, vocabulary, and student workflows with a usable completion board |
| 3 | Items 6, 10, 4 | Deadlines, individual exceptions, and an actionable review queue |
| 4 | Items 8, 9 | Durable teacher decisions and a student revision loop, including Word Hunt |
| 5 | Items 12, 13 | Word-based Arcade rewards and an explanation of each award |
| 6 | Item 7 | Readable answer evidence and word-level teaching insights |
| 7 | Item 11 | Class and period reports suitable for review and export |

Correct the existing single-assignment CSV/PDF semantics as part of release 1. Item 11 adds the broader class/period export after its source reports are stable. Arcade can ship after its completion, exception, and review dependencies without waiting for word-mastery analysis or the final reporting release.

Each item below is a bounded implementation task. A release can contain several separately reviewed commits or pull requests. Finish and verify one task before broadening its scope.

Establish item 15's layout patterns before adding new report screens. Apply and verify them as each functional release ships, including the existing administration, Library, and settings screens. Server work can proceed independently of the visual foundation. Layout is a completion requirement for every release, not a cosmetic cleanup postponed until all functionality exists.

## 1 Vocabulary completion report

**Implement:** Extend the existing assignment results RPC and `teacherAssignmentsWorkspace.js` to return one summary per active enrolled student plus the full required-activity checklist. Load the assignment's published requirements, not the current Library draft. Retain students with no evidence and preserve zero scores without inventing missing scores. Add completion counts, status filters, and access to activity details. Keep available historical records visibly separate.

**Teacher result:** Open an assignment and see each student's vocabulary status, required activities completed/required, remaining activity names, last relevant work time, and teacher-review state. Show class counts for complete, in progress, not started, and awaiting review with an explicit denominator. Display score and accuracy only with their named meaning.

**Acceptance:** Matching complete with Flashcards and Quiz untouched shows 1/3 everywhere. Optional-only work does not complete the unit. Zero is retained; missing is blank or unavailable. Withdrawn work, unknown requirements, former enrollment, and revised evidence remain distinguishable. Class totals equal the displayed active-roster rows. The CSV/PDF matches the screen.

**Dependencies:** Shared contract and item 14's server summary. Reuse `teacherAssignmentResults.js`, `classroomRepository.js`, and the student insight presentation model.

## 2 Student navigation

**Implement:** Add a View progress action to class roster rows and student links in assignment results. Carry class, assignment, activity, and return context through the existing teacher hash routes. Open the selected assignment in the student's Assigned work view and provide Back to vocabulary or Back to class.

**Acceptance:** A teacher can move Class → vocabulary → student → attempt and back without losing filters or selection. Direct links survive reload, and unavailable or unauthorized assignments show a clear scoped error. Another school's or teacher's identity never loads during account or school switches.

**Dependencies:** Item 1 for assignment-focused navigation. Extend `teacherClassWorkspace.js`, `teacherWorkspaceFeature.js`, `teacherRouting.js`, and `teacherStudentInsightView.js`.

## 3 Class completion board

**Implement:** Add a class-scoped students-by-assignment matrix using the same summaries as item 1. Support a school-year/period filter, vocabulary/reading kind, assignment search, and explicit status labels. Clicking a cell opens that student's work for that assignment. Paginate assignment columns and student rows as needed; do not download every attempt to draw the board.

**Acceptance:** All active students appear, including students with no attempts. Scheduled, withdrawn, archived, and unavailable work are distinguishable and excluded from current-work totals according to the shared contract. Vocabulary and reading requirements use the same denominator rules. Matrix cells and student profiles agree.

**Dependencies:** Items 1, 2, and 14. Keep the class as the report boundary; grade or section labels do not authorize access.

## 4 Teacher review queue

**Implement:** Add an actionable queue for awaiting review, revision resubmitted, past-due unfinished work, and work with explicit attention flags. Show counts on assignment cards and the Home view. Include class, assignment, student, submission revision, and review reason. Open the exact submitted revision. Keep teacher-owned actions distinct from students' unfinished tasks.

**Acceptance:** Accepted current submissions leave the queue; a later submission revision returns when review is needed. Required untouched work stays visible without a fake submission. Optional activities and pending teacher review do not create misleading student-overdue counts. Account/school changes cannot show or act on stale queue rows.

**Dependencies:** Items 1, 6, 8, 10, and 14. The completion-contract work can first support a read-only queue; revision actions ship after item 8.

## 5 Assignment finding

**Implement:** Extend Assignments and Review with title search, class, school year/period, material kind, release/due date range, and lifecycle filters. Add completion and review counts to cards or compact rows. Preserve filters in the URL and use paginated server queries. Link Library materials to their published class assignments without merging those assignments' results.

**Acceptance:** A teacher can locate one vocabulary within the current 1,023-assignment dataset without rendering the whole collection. Search and sorting have stable pagination with no duplicate/missing rows. Two publications of the same material remain separate and retain their class/date context.

**Dependencies:** Items 1 and 14. Reuse the existing assignment workspace and repository.

## 6 Deadlines and assignment lifecycle controls

**Implement:** Add due-date and response-close controls to publication and post-publication date changes, with a reason, revision guard, and history. Allow an authorized teacher to extend dates or reopen the same assignment without republishing its content or discarding attempts. Use school timezone for editing, display, and evaluation. Display calendar deadline status separately from an activity's active-time limit.

**Existing data:** Preserve null due dates. Present those assignments as No deadline, not overdue or on time. Provide a previewable, explicit bulk date-setting operation only if requested; never infer deadlines from old release dates or assign them retroactively during a migration.

**Acceptance:** Panama midnight boundaries, future release, exact due/close boundaries, reopening, concurrent edits, withdrawn assignments, and late offline synchronization behave consistently. Reopening does not create new completion or reward eligibility. Time-limit excuses do not modify calendar deadlines.

**Dependencies:** Shared contract. Build on `teacherAssignmentPublisher.js`, existing assignment date columns, and scoped repository writes. Add new SQL through the Supabase migration workflow during implementation.

## 7 Word-level understanding and answer evidence

**Implement:** Define a compact versioned answer-evidence format using stable word/question IDs from the published assignment. Add readable renderers for the activity types currently exposing only raw evidence. Keep raw evidence as an optional diagnostic detail. Build a class report for frequently missed words/questions and drill down to student attempts. Distinguish tested words from words with no evidence.

**Metric choice:** Default to the latest completed verified comparable attempt per student/activity, and show that choice. Offer first-attempt or best-attempt views only when explicitly selected. Do not silently average incompatible activity metrics or treat repeated attempts as more students.

**Acceptance:** Edited Library content cannot relabel old answers. Reordered questions, subset activities, retries, partial captures, historical missing evidence, and different activity metrics remain accurate. Every mastery percentage includes its denominator. A finished activity with low accuracy can remain requirements-complete while showing a learning concern.

**Dependencies:** Items 1, 2, and 14. Extend `capturedAnswerRows` and the existing attempt store rather than inventing a second attempt history.

## 8 Feedback and revision workflow

**Implement:** Extend existing assignment feedback with a distinct student-visible response and private teacher notes. Add teacher review decisions to vocabulary activities where the published policy requires review. Bind decisions to the exact submission/attempt revision, retain authors and history, and guard concurrent saves. Show accepted, revision requested, and awaiting review to the student in the app. Explain the task that needs revision and preserve earlier evidence.

**Acceptance:** A student's new submission does not inherit acceptance of an older revision. A co-teacher's concurrent save produces a conflict instead of overwriting notes. Private notes never reach student APIs. Student-visible feedback is restricted to the relevant student and assignment. Requesting revision does not erase completed evidence or automatically confiscate an existing reward.

**Dependencies:** Shared contract and item 2. Feed review state into items 1, 3, and 4. Extend the current feedback editor, repository, and history tables. Email notifications remain deferred.

## 9 Word Hunt review

**Implement:** Replace device-only review decisions with the durable review workflow from item 8. Pass assignment and student context into Word Hunt review; default to the selected work instead of all assignments. Preserve authorized image access and show per-word evidence, review decision, author, and submission revision. Keep optional all-work browsing as an explicit teacher choice.

**Historical local notes:** Offer a previewable, teacher-confirmed import when a local note can be attributed to one permitted assignment/student/revision. Ambiguous notes remain local history. Do not silently promote them into authoritative acceptance.

**Acceptance:** Review survives device changes, co-teachers see current authorized decisions, superseded images retain history, and cross-class image access is denied. No unscoped local note marks a student's required task accepted or grants Arcade time.

**Dependencies:** Items 2 and 8. Reuse Word Hunt's existing storage paths and revision controls.

## 10 Individual accommodations and exceptions

**Implement:** Add audited assignment/student exceptions for due/close dates, activity time limits, required activities, and a permitted reduced word subset. Calculate effective requirements on the server and display an Adjusted requirements label. Keep the original published content/version intact. Require a reason and authorized teacher identity; expose only the accommodation details the student needs.

**Acceptance:** An exception changes only its target student and assignment. Unit totals, the class board, review queue, exports, and reward preview use the effective requirements. Exempt work is explicit and is not represented as earned completion. Changing or removing an exception preserves previous attempts and does not repeat awards. Confidential reasons remain teacher-only.

**Dependencies:** Shared contract and item 6. Implement narrow overrides rather than cloning an entire class assignment per student.

## 11 Completion reports and exports

**Implement:** Extend the current CSV/PDF exporter with a vocabulary summary export and a class/period completion matrix. Include selected scope, published assignment/version, effective requirements, complete/required counts, progress/review/deadline state, evidence availability, and report generation time. Keep activity detail as a separate selectable export. Use the same server summaries as the screen.

**Acceptance:** Exported totals equal the report. Missing scores remain missing, true zero scores remain zero, exemptions are explicit, and unavailable evidence is labeled. Formula injection remains neutralized. Pagination exports the entire selected scope rather than only the visible page. School/teacher authorization applies independently of the filter UI. PDF layout remains readable at realistic class sizes.

**Dependencies:** Items 1, 3, 6, 10, and 14. The single-assignment correctness fix ships with item 1; the class/period product ships here.

## 12 Arcade reward controls

**Proposed policy:** Two minutes per assigned word, standard workload factor 1, and a maximum of fifteen minutes per vocabulary. These are the current selected planning settings, not production configuration. A light workload factor of 0.5 and an extended factor of 1.5 are draft choices to review before activating them.

Calculate the vocabulary budget from effective published requirements:

```text
vocabulary budget = min(vocabulary cap, assigned word count × minutes per word × workload factor)
```

Count the words actually required by the assignment. Freeze the required subset and policy on publication, and resolve explicit student adjustments under item 10. Do not use a subsequently edited Library word count or a student's client-supplied count.

**Award timing:** The initial implementation awards the vocabulary budget once all effective required work is complete and any required teacher acceptance is current. Optional activities and retries do not award another full vocabulary budget. Partial activity payouts are deferred; if introduced later, they must divide the same total budget rather than multiply it.

**Implement in three small steps:**

1. Add versioned policy settings, permitted teacher overrides, and a publication preview showing word count, workload factor, required work, and maximum award. School administrators control rate ranges and ceilings; teachers stay within those limits.
2. Add a server-owned award entitlement keyed uniquely by student, assignment, and policy version. Completion, exceptions, and accepted revision determine eligibility. Persist pending or failed credits for idempotent retry so a reward failure never discards valid learning completion.
3. Activate the policy for new explicitly opted-in assignments after rehearsal. Bypass the legacy per-activity ten-minute refill for those assignments. Keep legacy assignments, balances, receipts, and award history under their existing policy. Changing policy or reopening work never creates a second entitlement.

**Separate limits:** The selected fifteen-minute limit is per vocabulary. An available-wallet ceiling and a daily earning ceiling are separate proposed controls; do not assume the selected value approved either one. Before activation, choose whether earned time banks up to a wallet ceiling or refills an allowance, whether daily earning is limited, and what happens to earned entitlement when a cap prevents immediate credit. The UI and ledger must explain the chosen outcome. Preserve existing balances above a newly introduced ceiling.

**Privacy:** Keep the existing shared-wallet boundary until a separately reviewed change is justified. Ordinary teachers see awards attributable to their own assignments, not another teacher's or school's ledger. School policy must not reveal unrelated global wallet activity or allow an ordinary teacher to change a platform-wide limit. Student and authorized administrator allowance views follow explicit permissions.

**Acceptance:** Five standard words at two minutes give ten minutes; ten standard words give fifteen after the cap; ten light words give ten. Replayed events, concurrent completion, offline retries, re-review, date extensions, changed Library content, and policy edits cannot duplicate credit. Unit and activity views show the same eligibility. Pending-credit retries recover after a simulated failure. Existing receipts and balances remain intact.

**Dependencies:** Items 1, 8, and 10. Verify how the existing Arcade entrance prerequisites interact with once-per-vocabulary earning before activation. Do not grant broader account/coin administration as part of this task.

## 13 Arcade reward transparency

**Implement:** Show students their available allowance, attributable awards, costs, and pending/capped outcomes in clear minutes. Add a teacher view of credits from their assignments with the policy calculation and event history. An authorized administrator may correct time under an explicit narrow permission, with a reason and immutable adjustment entry. Keep coins and Arcade time separate in the UI and ledger.

**Acceptance:** A student can explain why an assignment earned its displayed amount and why a cap changed credited time. Ordinary teachers cannot read other classes' reward details or perform global balance adjustments. Failed corrections cannot show success. Concurrent play and reward credit keep the wallet and ledger consistent. Changes do not accidentally alter the separate coins-per-minute cost.

**Dependencies:** Item 12 and existing Arcade ledger/spend functions. Resolve shared-wallet permissions and cap semantics before exposing balances to teachers.

## 14 Loading and report reliability at scale

**Implement:** Replace the roster's per-assignment content-read loop with a scoped server summary over class membership, published requirements, effective exceptions, and normalized evidence. Page students/assignments and return stable total counts. Keep attempt evidence and full content behind drill-down requests. Cache by account, school, class, period, and filters; refresh or invalidate after relevant review, requirement, roster, or date changes.

**Acceptance:** Opening the first roster/report page performs a bounded number of requests independent of the school's historical assignment count; target no more than three report-data requests after session setup. Test with the current audit size and larger synthetic rosters/assignment sets. One assignment with unavailable requirements becomes an explicit unavailable row, not an error that hides all students. Verify correct counts with server row limits and pagination. Profile completion and aggregates agree, with no stale results across accounts or schools.

**Performance:** Measure query plans and request timing before and after the change. Add indexes justified by measured joins and filters. Set latency targets from that baseline rather than inventing an unmeasured promise. Preserve the existing production bundle budgets and lazy loading.

**Dependencies:** Shared contract; this is part of release 1 and supplies items 1, 3, 4, 5, and 11.

## 15 Teacher layout and information organization

**Evidence:** The user's 13 October screenshots show a large bordered/gradient page container enclosing further bordered cards, oversized single-column class rows, full-width stacked assignment filters, repeated headings/status text, inconsistent light native-looking tabs on dark pages, and a raw subject identifier in the normal settings row. School administration starts with a large create-school form while routine member management is much farther down. These are problems with hierarchy, density, control styling, and task organization.

**Implement in three steps:**

1. Define the teacher shell and a small set of screen patterns using existing shared styling: page header, compact toolbar, collection list/table, report, detail view, and settings form. Give headings, actions, scope selectors, and status a clear hierarchy. Use a flat content surface with spacing and separators for related rows; reserve bounded panels for genuinely distinct content. Remove decorative container nesting and repeated page titles. Keep navigation readable and separate school/platform administration from daily class work according to role.
2. Prepare representative Classes, Assignments/Review, Settings, and Schools layouts before broad CSS changes. Show realistic populated, empty, loading, and failure states and one narrow-screen version. Review these layouts with the teacher. Treat readable density, finding work, and action placement as the design goals; do not change workflows simply to fit a visual style.
3. Apply the agreed patterns screen by screen, then use them for the completion board, student details, review queue, evidence viewer, exports, and Arcade controls. Fix stylesheet ownership or missing control classes where they cause default-looking tabs/buttons. Avoid global resets or unrelated student/Arcade restyling. Preserve lazy loading and production bundle budgets.

**Screen organization:**

| Screen | Planned layout |
| --- | --- |
| Teacher shell and Home | One page title with relevant school/class context and actions. Show useful next actions and workload before secondary information. Keep sidebar labels, selected states, and collapse behavior consistent. Avoid an extra bordered page-sized wrapper and repeated workspace/title bands. |
| Classes | Three classes per row on wide screens, two on medium screens, and one on phones, with subject, year, relevant counts, and an adjacent Open class action. Opening a class reveals its students, work, and progress as clear local sections. Do not spend a full-width tall card on a class name and one button. |
| Assignments | A compact search/filter toolbar above a readable table or list with title, class, lifecycle, dates, completion counts, and actions. Group related metadata, use clear date wording, and keep destructive actions secondary. Item 5 supplies finding and filtering behavior. |
| Review | A task-focused queue with review state, student/class context, counts, and an Open work action. Keep detailed evidence in a separate review/detail view. Put cross-assignment Word Hunt browsing in a secondary action rather than above every assignment. Scheduled material should not dominate the default current-work view once item 4 is implemented. |
| Library | Consistent Vocabulary/Quizzes/Sparks tabs, visible location breadcrumbs, and one coherent toolbar for creation, import, assignment, and display mode. Use compact subject/grade/period navigation and show the material list promptly. Avoid a large empty panel surrounding one subject card. |
| Settings | Readable themed tabs and grouped forms with aligned labels and nearby save controls. Use compact subject rows with clear name, color, order, and active fields. Keep internal identifiers in optional diagnostic detail. Distinguish unsaved edits and saved status. |
| Schools and administration | Default to the selected school's overview and routine Members, Classes/Years, Invitations, Settings, and History sections. Put create-school and platform-access operations in separate explicit administrative flows, preserving role checks. Use searchable member rows and a selected-member editor instead of repeated large forms. Render history with readable actions, people, and dates; retain raw IDs in expandable diagnostics. |
| Vocabulary/student reports | Put completion summary, filters, and student rows together; open the selected student's requirements and attempts in a focused detail view with a clear return path. Use consistent status labels, table alignment, and optional evidence sections. Keep long raw JSON behind diagnostic disclosure. |

**Interaction and responsive rules:** Keep controls beside the data they affect and use one clear primary action per task. Align related filters on wider screens and stack them logically on narrow screens. Use consistent button, input, tab, date, and status treatments with readable contrast. Avoid arbitrary minimum page heights and empty space caused by oversized wrappers. Use normal page scrolling; contain horizontal scrolling only within genuinely wide reports with labeled columns and a usable narrow-screen alternative. Preserve keyboard focus, accessible names, selected states, and visible loading/error/retry feedback.

**Acceptance:** In the first useful viewport, a teacher can identify the page, current scope, primary action, and actual data or an honest loading/empty state. Classes, Assignments, Review, Library, Settings, Schools, and student reports share the agreed hierarchy without repeated card-within-card framing. All selected tabs and input labels remain legible in supported themes. Routine management is accessible without scrolling past unrelated creation forms. Actions remain associated with their target row or form. No raw UUID is required to understand or perform an ordinary teacher task. At 320, 360, 390, 430, 768, 1024, and 1280px, controls and essential data neither overlap nor clip; dense report overflow stays within its own container. Browser zoom, long names/titles, large datasets, keyboard navigation, and dialog focus also work.

**Verification:** Capture before/after screenshots for representative populated, empty, loading, and error states. Add focused visual/layout and accessibility checks alongside actual teacher workflows, including theme and narrow-screen coverage. A test that only finds a button or confirms zero horizontal overflow does not establish good hierarchy. Obtain teacher acceptance of the representative layouts and the integrated Class → vocabulary → student review flow before calling the layout work complete.

**Dependencies:** Start before visible report implementation and continue through every release. Extend the existing teacher shell/templates, `teacherClassWorkspace.js`, `teacherAssignmentsWorkspace.js`, Library/settings/administration renderers, and their owning stylesheets. Preserve the fourteen functional work items and existing authorization boundaries; reorganizing administration must not change permissions.

## Verification and release requirements

For every task, record implementation, local verification, deployed verification, and real teacher acceptance separately. Do not mark a task complete because its code or an isolated mock test exists.

- Use meaningful fixtures with two schools, different teacher permissions, active/former students, untouched and partial work, required/optional activities, unavailable historical evidence, and multiple publications of the same material.
- Cover the entire Class → vocabulary → student → attempt → back workflow, CSV/PDF parity, account/school switching, conflict handling, and recoverable loading failures.
- Use real authenticated local REST/RPC/Storage acceptance for authorization changes. Never substitute a service-role result for an ordinary teacher/student authorization test.
- Run focused tests and required regressions, authenticated browser workflows, responsive checks, production dependency/build/bundle gates, and Linux Firefox/WebKit CI when affected.
- Discover migration commands from the installed Supabase CLI. Create migrations through its migration workflow, inspect RLS/grants, and rehearse schema/data changes in an owned disposable stack. Preserve backups and reward/evidence fingerprints for any backfill.
- Backfill only with a concrete reviewed preview. Do not invent historical word-level answers, due dates, teacher approvals, exemptions, or rewards.
- Add compatible endpoints/schema before switching clients. Prefer additive changes and per-assignment policy activation. Rehearse rollback; disable a new feature/policy if necessary without erasing valid work or earned credit.
- Before production writes, refresh the main/deployment and live data inventories. Coordinate with concurrent releases. Verify deployed assets against the validated artifact and run scoped hosted acceptance with explicit cleanup.
- Obtain a teacher walkthrough on the first completion/navigation release and on the new reward policy. Physical-device acceptance remains distinct from automated responsive checks.
- Every visible feature must pass item 15's layout criteria. Verify information hierarchy and realistic screenshots as well as browser behavior and containment; avoid rebuilding the current nested-panel pattern in new screens.

## Decisions before reward activation

The plan can proceed through reporting and navigation without these decisions. Resolve them before enabling new reward earning:

1. Confirm the two-minute rate and fifteen-minute vocabulary cap, including allowed teacher overrides.
2. Confirm the workload factors and how adjusted requirements affect reward calculation.
3. Choose banked credit or refill allowance, available-wallet ceiling, daily ceiling if any, and capped-entitlement behavior.
4. Confirm teacher and administrator visibility/adjustment permissions for the shared wallet.

Public signup, SMTP, invitation emails, and email-based account recovery remain deferred under the existing decision. Existing-account class invitations and school access remain supported. This plan does not widen school membership or account administration permissions.

## Evidence and comparison references

The source audit exercised the class-review model against the student insight model and reproduced the missing untouched-activity rows. Thirty-one focused assignment-result, student-insight, roster-progress, and Arcade tests passed. The live reward function uses a fixed 600-second allowance refill and excludes Flashcards.

Relevant owners in the deployed release are `teacherAssignmentResults.js`, `teacherAssignmentsWorkspace.js`, `teacherClassWorkspace.js`, `teacherRouting.js`, `teacherStudentInsightModel.js`, `teacherStudentInsightView.js`, `teacherStudentProgress/teacherRosterProgressMethods.js`, `teacherStudentFeedbackEditor.js`, `teacherAssignmentExport.js`, `teacherGamificationSettingsMethods.js`, `gamificationConfig.js`, `services/classroomRepository.js`, and the existing school/classroom and reward migrations.

- [Quizlet Class Progress](https://help.quizlet.com/hc/en-us/articles/360030512432-Using-Class-Progress/) supports vocabulary-set activity status and frequently missed terms.
- [Wayground reports](https://help.wayground.com/support/solutions/articles/158000404058-reports-on-wayground) provide participant, question, and overview reporting.
- [Google Classroom student work](https://support.google.com/edu/classroom/answer/9157286?hl=en) connects assignment queues and individual student work lists.
- [Moodle activity completion reports](https://docs.moodle.org/501/en/Activity_completion_report) distinguish completion/passing conditions and teacher overrides.

These documented workflows guide the plan's product behavior. They do not determine Sparks' authorization model, reward policy, or implementation readiness.
