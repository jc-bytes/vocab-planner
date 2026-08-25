# Teacher feature dependency map

This map records the current teacher feature architecture before Task 16 changes it. It is a source-traced contract, not a proposal to convert every feature to the same shape.

## Current loading and collaboration model

`TeacherManager` installs seven stable lazy entry methods from `teacherLazyFeatures.js`. On first use, the loader mounts any declared HTML templates, imports the feature module once, captures methods from a temporary prototype, and creates a per-manager `Proxy` with `createFeatureContext`. Feature methods can call one another through that proxy and fall through to manager fields and methods. Assignments through the proxy are written to the manager.

The proxy deliberately does **not** add captured feature methods to `TeacherManager`. This keeps the public manager surface small, but it also hides each feature's required manager capabilities and lets feature state accumulate in the manager constructor. The loader has no route-level teardown; features and listeners live for the teacher application lifetime.

Top-level navigation is independently wired in `teacherShell.js` and `teacherRouting.js`. The router needs only each feature's stable show/open entry point, but it also duplicates view and route knowledge that belongs to Tasks 19–21.

## Lazy feature dependencies

| Feature | Stable lazy entries | State currently reached through `this` | Host and data dependencies | UI behavior and lifecycle | Main risk |
| --- | --- | --- | --- | --- | --- |
| Groups | `showGroupsView` | `selectedGroupClass`, `groupAbsentStudents`, `currentRandomGroups`, `groupPairRestrictions`, `groupRestrictionsLocalFallback`; shared `allStudentData`, `authDisabled`, `currentUser` | `ensureAuthenticated`, `switchView`, `getStudentRosterData`, `refreshIcons`; `teacherGroupRestrictionsRepository`; local storage, clipboard, crypto | Static `teacher.html` view. Fourteen fixed controls/status/results targets. Seven interaction handlers are bound eagerly in `teacherGlobalListeners.js`. No teardown. | **Confirmed wiring defect:** eager listeners call internal feature methods on `TeacherManager`, but those methods exist only on the proxy context, so first interaction can call `undefined`. Feature state and DOM ownership are also implicit. |
| Sparks | `showSparksView` | Weekly Spark cache/promise/refresh state, active view/type/month, editor ID/mode, question editor state | Auth/session, `switchView`, `refreshIcons`; `sparksRepository`; Spark/check/date/subject models | Static library plus lazy modal template. Feature-owned delegated listeners receive the proxy context after mount; modal close resets editor state. No teardown, but binding is once per manager. | Broad 52-method collaboration surface and student-visible persisted authoring model make conversion higher risk. Listener ownership is already correct. An eager pre-mount modal setup is redundant. |
| Data Management | `showDataManagementView` | Viewer/export initialization, selected students, loaded/preview data, active tab, dashboard generation/cache and Chart instances; shared roster/settings and route flags | Auth/session, view/tab/route methods, roster and settings loaders; `teacherExportRepository`; dashboard analytics through `supabaseService`; Papa Parse and Chart lazy resources | Lazy view template. Viewer, dashboard, export, file drag/drop, and reset/settings surfaces share one feature definition. `initTeacherSettingsListeners` is invoked during lazy initialization in addition to eager settings listener initialization. Chart instances are destroyed before replacement; no feature teardown. | It is several workflows behind one name, with broad manager state and duplicated listener initialization. A single factory would be another oversized facade. |
| Word Hunt Review | `showWordHuntReviewView`, `loadWordHuntReview` | Rows/cache, filters, drilldown/view modes, active key, image URL map, initialized flag; shared vocabulary mode/subjects | Auth/session, vocabulary workflow switching, `getSubjects`, `refreshIcons`; review/image methods call `supabaseService`; local review notes | Static workflow view. Content delegation, filters, note/review controls, and a document keydown listener are initialized lazily. Object URLs have explicit revocation logic. | Anonymous app-lifetime document/content listeners make teardown difficult; direct Supabase access and roughly 40 internal methods remain hidden behind proxy fallback. |
| Quizzes | `showQuizzesView`, `openQuizMaker` | Quiz library/drilldown/view modes, builder instance/key/open/return state; also shared vocabulary `libraryItems`, `libraryDrilldown`, `vocabSet`, `vocabularyMode` | Auth/session, routing/view methods, teacher-library and vocabulary browser/render helpers, `refreshIcons`; browser storage draft helper | Lazy view template and lazy `teacherQuiz.css`. Many rendered cards/rows own click listeners. Quiz Maker bridges to the eager vocabulary editor and restores drafts. No teardown. | It is tightly coupled to the existing vocabulary feature's state and internal rendering methods. Converting it first would require defining the vocabulary boundary at the same time. |

## Dependency details that must remain stable

- **Security:** repository and Supabase policies remain authoritative. A feature factory may receive a narrower repository capability, but must not bypass RLS or move authorization into UI metadata.
- **Routing:** `#/teacher/groups`, `#/teacher/sparks`, data/settings tabs, Word Hunt review, Quiz hub, and Quiz Maker deep links must continue to load lazily and restore shell state.
- **Groups persistence:** absence keys remain date-and-class scoped; restriction fallback remains teacher scoped; cloud restrictions continue through `teacherGroupRestrictionsRepository`.
- **Sparks persistence:** cache coalescing/invalidation, schedule normalization, modal reset behavior, and student-visible Spark IDs remain unchanged.
- **Word Hunt resources:** generated image object URLs must still be revoked; the keyboard handler must not be multiplied by repeat navigation.
- **Quiz resources:** `teacherQuiz.css` and Quiz code must remain outside the eager teacher entry.
- **Data resources:** chart and export libraries must remain lazy, and old Chart instances must be destroyed before replacement.

## Why Groups is the Task 16 pilot

Groups is a bounded, representative conversion with one repository, one shared roster capability, five cohesive state values, a static view, and already-tested pure grouping logic. It has no student-facing write model. More importantly, conversion fixes the confirmed listener/context defect rather than creating an architecture-only abstraction.

The smallest justified interface is:

```js
createTeacherGroupsFeature({
    ensureAuthenticated,
    showView,
    loadRoster,
    getRoster,
    getSession,
    refreshIcons,
    repository,
    notifications
}) => ({ show })
```

The factory should own the five Groups state values and bind its own controls after lazy loading. `TeacherManager.showGroupsView()` remains the one routing adapter and delegates to `feature.show()`. Internal click handlers should not become manager methods. Browser APIs can keep safe defaults; inject them only where a test or platform seam requires it. A `destroy()` method is not justified until the loader has an actual teardown/reinitialize lifecycle.

An eager Overview factory was considered because its read-only workflow is smaller. It was rejected as the pilot because it would not exercise or repair the lazy feature boundary that this phase targets. Word Hunt Review is the next-smallest lazy candidate, but its document listener and object-URL lifecycle make it a poorer first proof.

## Task 16 acceptance contract

- Preserve the Groups route, static markup, repository/RLS boundary, local-storage keys, notifications, grouping behavior, and lazy chunk.
- Remove Groups feature state from the manager constructor.
- Move Groups control listeners out of `teacherGlobalListeners.js` and bind them once to the feature instance.
- Expose only the stable `showGroupsView` manager adapter; do not install internal Groups methods or retain a proxy compatibility shim.
- Add an interface-level test that loads the feature and drives representative class, absence, randomize, restriction, and copy interactions.
- Run focused Groups, lazy-loading, routing, repository/security, full regression, production build, and built-page smoke checks.

## Intentionally unchanged in Task 15

Task 15 changes documentation only. It does not alter feature loading, prototypes, routing, DOM, repositories, persistence, or user behavior. Tasks 16–18 will convert and validate one feature at a time; Tasks 19–21 own navigation duplication.
