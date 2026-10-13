# Teacher feature dependency map

This map records the teacher feature architecture, including the September 2026 teacher workspace simplification. It describes the interfaces new work should preserve.

## Loading and ownership model

`TeacherManager` exposes stable lazy entry methods through `teacherLazyFeatures.js`. The first call mounts the feature template, imports the feature module, creates one private feature instance for that manager, and delegates to the feature's public use case. Every lazy feature now uses an explicit factory. The old prototype capture and manager-fallback Proxy have been removed.

The manager remains the application shell. It owns authentication, top-level view activation, routing, shared vocabulary editing, and established repository capabilities. Each feature factory receives only the capabilities it uses. Feature implementation methods and state stay inside the feature instance instead of leaking onto `TeacherManager`.

`disposeLoadedTeacherFeatures()` calls each loaded feature's `destroy()` method on sign-out or teacher-account replacement. A feature must remove its listeners, invalidate pending asynchronous work, and release browser resources there. Feature modules are cached by the JavaScript loader, but manager-specific instances and state are recreated.

`teacherPageRegistry.js` owns the canonical top-level page and view IDs used by shell navigation and routing. Labels, nested modes, route aliases, loaders, and codecs remain with their feature or routing owner because they are not shared page metadata.

## Lazy feature interfaces

| Feature | Manager entries | Factory interface | Private ownership | Important dependencies |
| --- | --- | --- | --- | --- |
| Teacher workspaces | `showClassesView`, `showAssignmentsView`, `openAssignmentPublisher` | Shell adapter delegates to focused class, assignment and publisher factories | Class route, roster, invitations, dialogs and pending requests stay inside their workspace | Account identity, scoped classroom repository, ID-based navigation callbacks |
| Groups | `showGroupsView` | `{ show, destroy }` | Selected class, absences, generated groups, restrictions, seven control listeners | Authentication, view activation, roster loader, session reader, icons, notifications |
| Sparks | `showSparksView` | `{ show, destroy }` | Spark query keys and request generations, active library state, editor state, delegated listeners | Authentication, view activation, session reader, icons, notifications, modal controls |
| Data Management | `showDataManagementView` | `{ show, destroy }` | Active area/tab, viewer file, export preview, asynchronous generations, owned listeners, four chart instances | Authentication, view and route adapters, teacher settings use cases, roster and library readers, analytics query, account identity, notifications, storage |
| Word Hunt Review | `showWordHuntReviewView`, `loadWordHuntReview` | `{ show, load, destroy }` | Review rows and query key, filters, view state, image URLs, content and keyboard listeners | Authentication, workflow activation, subjects reader, icons, notifications |
| Quizzes | `showQuizzesView`, `openQuizMaker` | `{ show, open, destroy }` | Quiz library, drilldown, preferences, account-scoped drafts, builder lifecycle, asynchronous generations | Authentication, Quiz route and view adapters, teacher library, current vocabulary, 10-capability shared vocabulary-browser adapter, session identity, icons, notifications, storage |

## Classes implementation map

`teacherWorkspaceFeature.js` is the shell adapter. `teacherClassWorkspace.js` does not know the teacher manager, route encoding or other screens. Its interface is:

```js
createTeacherClassWorkspace({
    root,
    getUserId,
    repository, // defaults to the scoped classroom repository
    onNavigate, // { classId, tab }; omitted in isolated use to navigate locally
    onPublish,  // { classId }
    onReview,   // { classId, assignmentId }
    onGroups    // { classId }
}); // { show({ classId, tab } = {}), hide(), destroy() }
```

`show()` displays the class directory; `show({ classId, tab: 'students' })` displays enrollment and `show({ classId, tab: 'work' })` displays links to assigned work. An unknown class ID produces an unavailable message rather than falling back to another class. Students loads only roster and invitations. Work loads only class assignments; publishing and review remain separate workflows reached through callbacks. The class ID is the private class identity, never a grade/section label.

The private `teacherClassWorkspaceDialog.js` owns short forms for subject/class setup, invitations and removal/archive confirmation. It handles native modal focus, Escape/cancel, field validation, pending-submit suppression and retry feedback. Opening a new class/tab, hiding or destroying the workspace closes its dialog and invalidates pending loads. Late responses cannot paint a different account's view. A cancelled dialog does not cancel a write already sent to the repository, but its eventual completion cannot reopen or redraw the old view.

`hide()` invalidates requests and removes transient UI while retaining the reusable feature instance. The shell adapter must call it when navigating away. `destroy()` permanently retires the instance on sign-out/account replacement. The student-only `classroomView.js` retains enrollment acceptance and assignment activities without importing teacher management UI.

`node scripts/ui-teacher-class-workspace-smoke.mjs` exercises the real browser interface with an injected repository: directory/setup, focused tabs and request scope, invitation deduplication, navigation callbacks, missing class, cancelled dialog, and stale account results. It does not seed or mutate a live database.

### Authenticated local workspace walkthrough

`node scripts/ui-teacher-workspaces-local.mjs` uses the existing local audit teacher/student fixtures and reads local connection configuration without seeding or resetting accounts. It verifies the integrated sidebar and private class route, roster, Work tab, publisher class preselection/cancel, assignment review/export dialog cancellation, selected-class Groups, and the enrolled student's existing assignments. It records screenshots under `/tmp/sparks-teacher-workspaces-local` and runs scoped axe accessibility checks on ten screens/dialogs. The script checks that its teacher browser made no business-data mutation requests. It does not prove publication, submission, deployed privacy or production readiness; those require the separate acceptance/release gates.

## Assignments, publication and review implementation map

`teacherWorkspaceFeature.js` is the lazy shell adapter for these tools. The independent feature interfaces are:

```js
createTeacherAssignmentPublisher({
    getUserId,
    repository,  // scoped classroom repository by default
    onPublished // { assignments, classIds }
}); // { open({ classId, materialId, kind } = {}), hide(), destroy() }

createTeacherAssignmentsWorkspace({
    root, getUserId, repository,
    onNavigate,       // { mode, classId, assignmentId, returnMode? }
    onPublish,        // { classId }
    onWordHuntReview  // browse existing Word Hunt evidence across owned assignments
}); // { show({ mode, classId, assignmentId, returnMode? } = {}), hide(), destroy() }
```

The publisher loads saved materials and active private classes only when opened. Class/material shortcuts supply IDs, never mutable material objects or teacher ownership claims. It validates delivery dates in the device timezone, explains immutable published copies, and sends the existing publication RPC. After the first request, retry uses the same frozen payload and publication key; edits cannot turn an uncertain retry into a second publication. Closing a pending dialog does not cancel an already-sent write, but its result cannot navigate or redraw the cancelled workflow.

The assignment workspace lists publication dates/status, filters by private class ID and status, and opens review by assignment ID. Review loads only that assignment's results plus its class roster. Vocabulary review preserves activity rows; Spark review displays written responses and automatic check results separately. Missing work gets an explicit missing status and blank score; a written-only Spark does not acquire an automatic zero. A student selector scopes the review and export dialog. The in-session `returnMode` restores the originating Assignments or Review list; a direct review link defaults to the Review list. Status and student filters remain private instance state.

`teacherAssignmentResults.js` owns the shared review/export data model and safe CSV serialization. `teacherAssignmentExport.js` owns selection and format controls inside the dialog. Available formats are **Spreadsheet (CSV; opens in Excel)** and **PDF report**; no XLSX workbook is implied. CSV can include update times. PDF offers portrait or landscape pages and lazy-loads `teacherAssignmentPdf.js`, which uses the existing jsPDF/AutoTable dependencies. Both formats receive the same selected student IDs and assignment/class scope. Exported missing results remain blank scores. CSV protects cells against formula interpretation. Object URLs are released after download or dialog disposal; stale-account or cancelled asynchronous PDF work cannot download.

The existing Word Hunt evidence browser is linked with its real scope: evidence across the teacher's assignments, not a promised current-assignment filter. Its backend RPC enforces assignment ownership. Its notes/review markers remain device-local, and the link explains this distinction. It is not a new grading write workflow.

`teacherAssignmentUi.js` owns only shared DOM and native-dialog primitives, including native focus trapping, Escape cancellation and focus restoration. `hide()` aborts pending reads and closes transient UI; `destroy()` also clears retained filters and retires the instance. The shell calls hide on navigation and destroy on account replacement.

`tests/teacher-assignment-results.test.mjs` verifies zero/missing results, formula-safe scoped CSV, assignment status and generated PDF contents. `scripts/ui-teacher-assignments-smoke.mjs` verifies the real browser controls with an injected repository, including same-key publication retries, keyboard cancellation, delayed cancelled writes, class scope, return filters, vocabulary/Spark review, downloaded CSV/PDF contents and stale account responses. These tests do not seed or write a live database.

## Data Management implementation map

Data Management is one mounted screen with four closely related workflows. Its external interface is intentionally small:

```js
createTeacherDataManagementFeature({
    ensureAuthenticated,
    activateDataManagement,
    writeDataRoute,
    isRouteApplying,
    loadSubjectSettings,
    loadGamificationSettings,
    loadSchoolCalendarSettings,
    saveGamificationSettings,
    saveSchoolCalendarSettings,
    bindSchoolCalendarInputs,
    addSubjectFromForm,
    saveSubjectSettings,
    loadRoster,
    getRoster,
    getExplicitSelectedStudentIds,
    loadLibrary,
    loadDashboardAnalytics,
    getCurrentUser,
    refreshIcons,
    feedback,
    storage
}) => ({ show, destroy })
```

The factory composes the existing dashboard, export, viewer, and settings implementations into a private context. Those internal seams remain separate files because each workflow has cohesive logic and focused tests. They are not exposed to `TeacherManager` or application routing.

`show({ area, tab, updateRoute, replace })` authenticates, activates the shared view, initializes owned listeners once, and updates the canonical route when appropriate. Data workflows activate on demand. The Settings area loads its three cached settings authorities together. `destroy()` removes owned listeners, destroys Chart instances, clears account-sensitive DOM and loaded files, cancels completion timers, and invalidates dashboard, roster, preview, export, and file-read generations.

The JSON/CSV reset area remains visually gated after export but has no reset listener or repository operation. This remediation preserves that inert behavior. Implementing destructive data reset requires a separate product and security decision.

## Contracts that must remain stable

- **Security:** repositories, Supabase functions, and RLS remain authoritative. Feature metadata and client factories do not authorize data access.
- **Routing:** direct and history navigation must still restore Groups, Sparks, Data/Settings tabs, Word Hunt Review, Quiz hub, and Quiz Maker through their public use cases.
- **Account isolation:** sign-out and UID replacement dispose loaded features and clear shared Student Progress roster, selection, and request caches. Late results from the previous account must not update the next session.
- **Lazy loading:** feature implementations, Chart.js, Papa Parse, Quiz CSS, and Quiz Maker stay outside the eager teacher entry where they were already lazy.
- **Groups persistence:** absence keys remain date-and-class scoped; restriction fallback remains teacher scoped; cloud restrictions continue through `teacherGroupRestrictionsRepository`.
- **Sparks persistence:** cache coalescing, schedule normalization, modal reset behavior, and student-visible Spark IDs remain unchanged.
- **Word Hunt resources:** generated image object URLs are revoked and document listeners are removed on disposal.
- **Quiz resources:** drafts and preferences are teacher scoped; nested builder timers, overlays, object URLs, and callbacks are released on disposal.
- **Data resources:** old Chart instances are destroyed before replacement; file, preview, roster, dashboard, and export work use latest-request and lifecycle guards.

## Rules for another teacher feature

1. Add one lazy definition in `teacherLazyFeatures.js` and one explicit feature factory in the feature-owned module.
2. Expose user-facing use cases only. Do not install internal implementation methods on `TeacherManager`.
3. Pass the smallest existing host capabilities the feature actually needs. Do not pass the manager itself.
4. Keep feature state in the feature instance. Shared shell state must have a documented reason to stay on the manager.
5. Implement idempotent `destroy()` for listeners, timers, object URLs, charts, and pending asynchronous work.
6. Test through the factory's public interface and through the real lazy adapter. Keep repository and security tests at their existing seams.

## Task 15-18 result

The pilot Groups conversion proved the factory pattern and fixed its broken eager listener wiring. Word Hunt Review, Sparks, Quiz, and Data Management then migrated one at a time. Each conversion removed its prototype installer and manager-fallback dependency only after focused tests, browser smoke coverage, the full suite, and the production build passed. The result is one lazy-loading mechanism and five explicit feature interfaces, without a compatibility Proxy or a second feature framework.
