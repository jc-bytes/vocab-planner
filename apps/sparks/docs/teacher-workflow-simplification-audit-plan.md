# Teacher workflow audit and implementation plan

Date: 9 September 2026. Scope: current local source and existing release documentation. This audit does not change application code, publish a release, or change student data. No fresh authenticated browser walkthrough or test run was performed for this document. Hosted readiness must be checked separately.

## Verdict

The simplification is not finished. Private classes have a distinct access model, but the teacher interface still combines the old content workflows with the new class workflows. Teachers can encounter more than one place that appears to assign or review work.

Give each task one clear home. Shortcuts elsewhere should open that same workflow with the class or material already selected. More focused tools do not require more sidebar buttons.

## Findings

| Priority | Current evidence | Teacher impact | Recommended change |
| --- | --- | --- | --- |
| High | `js/classroomView.js` puts subject/class setup, roster, invitations, publication and results in one teacher view. It also contains the student view. | Opening a class exposes several unrelated jobs on a long page. | Separate the teacher class directory and class detail views; show Students and Work as focused tabs. Open review on its own screen. Preserve the student experience. |
| High | `teacher.html` has Assign, Review, Quizzes and Sparks content tabs, while Classes also publishes and shows results. | “Assign” can mean editing reusable content or publishing it to students. | Rename the content destination Library. Provide one publisher and one assignment review destination. |
| High | `teacherVocabularyEditorCoreMethods.js` reads assigned date/month/week; `teacherSparks/teacherSparkEditorMethods.js` reads scheduled date, target grades and scheduled status. Class publication separately supplies release/due/close dates. | Teachers can reasonably expect changing a library date to change an existing assignment. | Treat grade/subject as library metadata; put delivery dates on assignments. Remove or clearly retire legacy scheduling controls only after auditing every reader and import path. Explain that editing a material does not update published work. |
| High | `teacherGroupsLogic.js:getStudentClassKey` derives class identity from profile grade and section. | That grouping cannot represent a student's separate subject classes reliably. This is a workflow mismatch, not proof of an access leak. | Launch Groups from a selected private class and use its enrollment roster and class ID. Keep the existing grouping algorithm and restrictions. |
| Medium | `teacherDataExport.js:getSelectedStudentIds` gets “specific” selection from outside the export view; `teacher.html` says to use filters above. | Teachers cannot reliably see who will be included while exporting. | Choose students inside the export dialog, show the count, and display the selected class/assignment. |
| Medium | Settings contains broad data export options; results have a separate CSV export in `classroomResultsView.js`. Legacy export text still mentions coins/scores. | Export options suggest capabilities beyond private class results. | Put classroom exports beside Review. Remove unsupported options and misleading descriptions. Keep account administration separate from ordinary teacher tasks. Do not activate the inert reset feature. |

The current feature factories and lifecycle protections are useful foundations. This does not justify a rewrite of the teacher shell.

## Recommended structure

| Destination | Its one responsibility | Useful actions |
| --- | --- | --- |
| Library | Create and reuse teaching materials. | Search; filter by subject/type; create; edit; duplicate; archive; Assign shortcut. Vocabulary, Sparks and existing quiz creation remain distinct tools within it. |
| Classes | Manage who belongs to each subject class. | Open class; manage enrollment; invite; make groups. A Work tab links to assignments filtered to that class. |
| Assignments | Decide what students receive and when. | Publish saved material to one or several owned classes; inspect dates/status; withdraw; open results. |
| Review | Read student work and results for assigned work. | Filter by class/assignment; open a student submission; export the visible scope. |
| Settings, secondary | Manage teacher preferences and reusable subject setup. | Preferences; subjects. School-wide administration requires its separate role. |

Home, if retained, should contain useful shortcuts into these destinations. It should not introduce another publisher or review tool. The existing student directory/profile can be reached from Classes and Review without duplicating its implementation.

## Dialogs versus screens

Use dialogs for short, bounded actions: create/rename class, invite students, publish a saved material, export, and confirm withdrawal or removal. Give dialogs a clear title, one primary action, keyboard support, and a safe Cancel path.

Use screens for material editing, class rosters, quiz building and reviewing submissions. Do not hide lengthy editing inside nested dialogs.

The Assign dialog should show the saved material, selected classes, release time and optional due/close times. Show the timezone and explain the published-copy behavior before confirmation. If opened from a class or material, preselect that context. Reuse the same dialog everywhere and retain publication retry protection.

For Export, show class/assignment, students and selected count first. Then show only options relevant to the chosen format. CSV results already exist and can be opened in Excel; call them CSV. A true Excel workbook is additional implementation, not a renamed CSV. Existing PDF report renderers do not establish that a class results PDF is ready. Add a properly scoped PDF adapter before offering it here. Spreadsheet options can cover columns and row detail; PDF options can cover summary/detail and page layout. JSON backup-style export should not clutter ordinary classroom reporting.

## Implementation order and completion checks

### 1. Establish the class context

Split teacher class directory/detail rendering from the student branch in `classroomView.js`. Give class detail a stable class-ID route and focused Students/Work tabs. Move invitations into a dialog. Adapt Groups to class enrollment, including saved restriction scoping where necessary.

Complete when a teacher can open, refresh and return to a class; manage its roster; and generate groups using only that class's active students. Two classes with the same display name must remain distinct. Account switching must clear the previous class and pending results.

### 2. Make publishing a single workflow

Extract one lazy-loaded assignment publisher using the existing repository and publication RPC. Launch it from Library and Classes. Add the assignment list with class/status filters and links to Review. Rename misleading content navigation and preserve useful old links through routing adapters.

Complete when a teacher creates one material, publishes it to two classes, sees both assignments, and can retry a failed request without duplicates. Editing the library copy must leave both published copies unchanged. Do not imply that current quiz exports are automatically online class assignments.

### 3. Separate content settings from delivery settings

Audit legacy date/status readers before removing controls from vocabulary and Spark editors. Keep authoring metadata and activity defaults in Library; put dates in Assignments. Use a small activity preset with advanced configuration available when needed.

The current publication RPC snapshots saved material content. Per-assignment activity overrides are a separate contract change requiring validated server inputs and snapshot tests. Do not add controls that appear to work but are ignored by publication. Retain saved-material defaults in the first simplification pass.

Complete when there is one unambiguous place to set student availability, imported materials still work, and no library control falsely implies an existing assignment changed.

### 4. Consolidate review and export

Create one assignment review route, reusing vocabulary results, Spark responses and applicable existing review components. Preserve return filters and student context. Move export beside the reviewed work and make student selection self-contained. Remove unsupported legacy export copy/options from ordinary teacher Settings.

Complete when a teacher can open one assignment, inspect a student's work, return to the same filtered list and export exactly the selected scope. Verify exported values and file contents, not just download success. Missing results must not silently become zero scores. Keep any device-local review notes explicitly distinguished from saved shared records.

### 5. Verify and release separately

Run relevant existing unit, integration, privacy acceptance, accessibility, responsive and build checks after implementation. Exercise teacher A/teacher B, a student in both teachers' classes, removal, withdrawal, archived history, account switching and direct links. Check delayed responses, cancelled dialogs, save queues and offline replay. Keep new workflows lazy-loaded within existing bundle budgets.

Then perform an authenticated local walkthrough of the complete create → assign → student access → review → export journey. Hosted migration, existing-data conversion and deployed acceptance remain separate release gates described in `private-workspace-release.md`. Reuse the confirmed sole owner and existing student/class records; do not ask the teacher to recreate rosters. Refresh the hosted inventory and rehearse the bounded conversion before applying it.

## Code boundaries

Keep the shell responsible for authentication, navigation and feature lifecycle. Give class management, publication and assignment review their own cohesive lazy features with explicit class/material/assignment IDs. Reuse scoped repositories; do not pass the entire teacher manager into every new tool. Each feature owns and disposes its listeners, pending requests and temporary URLs. Avoid introducing a generic workflow framework or splitting functions into files without reducing coupling.

The first implementation slice should be class navigation and one shared publisher. These remove the largest overlap before spending time on extra formats or cosmetic changes. The plan is complete when the completion checks above pass, not merely when the sidebar labels change.

## Implementation record

Implemented locally on 9 September 2026. The audit above records the starting state.

- Library, Classes, Assignments and Review have distinct navigation. Students and Groups remain available through classroom tasks; existing useful routes are retained. Old export bookmarks open Review.
- `teacherWorkspaceFeature.js` is the shell adapter. Class management, publication and assignment review have independent factory interfaces, injected repositories/callbacks and explicit IDs. Their `hide` and `destroy` methods cancel pending reads and close owned dialogs. They are loaded on demand.
- Classes has directory/detail routes and Students/Work tabs. Invitations and confirmations use dialogs. Groups uses real enrollment and class IDs; existing do-not-pair rules remain private to the teacher and apply across that teacher's classes.
- One publisher serves saved vocabulary, Sparks and classes. It retains an identical request/key for retries and publishes immutable saved-material settings. Per-assignment activity overrides were deliberately not added.
- Vocabulary has two explicit activity presets with advanced settings collapsed. Its settings renderer loads on demand. Manual library placement remains editable; imported dates are retained until explicitly superseded. Spark authoring is a full screen with a type-based library; legacy scheduling controls no longer imply student availability.
- Review supports vocabulary results and Spark responses, scoped student selection, missing-work states without invented scores, and CSV/PDF export. PDF layout options appear only for PDF. CSV opens in Excel; no XLSX format is claimed. Existing Word Hunt evidence is linked with its broader owned-assignment scope and device-local note limitation stated.
- New dialogs support keyboard cancellation, focus restoration and cancellation-safe completion. Desktop/mobile checks corrected native-dialog centering and Spark editor scrolling.

Verification completed: `npm test`; all 14 `test:private-classrooms` acceptance checks, including the updated real teacher/student publication journey; focused publisher/review export tests that inspect actual CSV/PDF content; and the read-only authenticated `test:ui:teacher-workspaces:local` walkthrough with ten accessibility checkpoints. The local walkthrough reuses existing audit fixtures without seeding or changing business records. Screenshots are in `/tmp/sparks-teacher-workspaces-local`. The production build retains the original delivery budgets; the teacher initial bundle has very little remaining headroom.

No hosted schema changes, data conversion or deployment were performed by this implementation. The existing-data conversion and production release gates in `private-workspace-release.md` still apply. Local verification is not evidence that the hosted site has been upgraded.
