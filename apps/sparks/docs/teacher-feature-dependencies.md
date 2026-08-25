# Teacher feature dependency map

This map records the teacher feature architecture after Tasks 15-18. It describes the interfaces new work should preserve.

## Loading and ownership model

`TeacherManager` exposes seven stable lazy entry methods through `teacherLazyFeatures.js`. The first call mounts the feature template, imports the feature module, creates one private feature instance for that manager, and delegates to the feature's public use case. Every lazy feature now uses an explicit factory. The old prototype capture and manager-fallback Proxy have been removed.

The manager remains the application shell. It owns authentication, top-level view activation, routing, shared vocabulary editing, and established repository capabilities. Each feature factory receives only the capabilities it uses. Feature implementation methods and state stay inside the feature instance instead of leaking onto `TeacherManager`.

`disposeLoadedTeacherFeatures()` calls each loaded feature's `destroy()` method on sign-out or teacher-account replacement. A feature must remove its listeners, invalidate pending asynchronous work, and release browser resources there. Feature modules are cached by the JavaScript loader, but manager-specific instances and state are recreated.

`teacherPageRegistry.js` owns the canonical top-level page and view IDs used by shell navigation and routing. Labels, nested modes, route aliases, loaders, and codecs remain with their feature or routing owner because they are not shared page metadata.

## Lazy feature interfaces

| Feature | Manager entries | Factory interface | Private ownership | Important dependencies |
| --- | --- | --- | --- | --- |
| Groups | `showGroupsView` | `{ show, destroy }` | Selected class, absences, generated groups, restrictions, seven control listeners | Authentication, view activation, roster loader, session reader, icons, notifications |
| Sparks | `showSparksView` | `{ show, destroy }` | Spark cache and request generations, active library state, editor state, delegated listeners | Authentication, view activation, session reader, icons, notifications, modal controls |
| Data Management | `showDataManagementView` | `{ show, destroy }` | Active area/tab, viewer file, export preview, asynchronous generations, owned listeners, four chart instances | Authentication, view and route adapters, teacher settings use cases, roster and library readers, analytics query, account identity, notifications, storage |
| Word Hunt Review | `showWordHuntReviewView`, `loadWordHuntReview` | `{ show, load, destroy }` | Review rows and cache, filters, view state, image URLs, content and keyboard listeners | Authentication, workflow activation, subjects reader, icons, notifications |
| Quizzes | `showQuizzesView`, `openQuizMaker` | `{ show, open, destroy }` | Quiz library, drilldown, preferences, account-scoped drafts, builder lifecycle, asynchronous generations | Authentication, Quiz route and view adapters, teacher library, current vocabulary, bounded vocabulary-browser adapter, session identity, icons, notifications, storage |

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
