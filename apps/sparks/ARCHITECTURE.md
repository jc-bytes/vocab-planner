# Sparks architecture

This is the practical map for extending Sparks. It describes current ownership and the shortest safe path for common changes. Detailed decisions and completed migrations are recorded in `docs/architecture-remediation.md`. The current audit and repair evidence is in `docs/architecture-audit-2026-10-07.md`. The earlier assessment remains in `docs/architecture-audit-2026-08-30.md`.

The repository and classroom system are called Sparks. The currently shipped HTML titles, npm package, Tauri product, and desktop bundle retain the historical product name Vocabulary Master; changing those together is a separate product-release decision.

## Application shape

Sparks is a vanilla JavaScript multi-page Vite application with three entries:

| Entry | Composition root | Main responsibility |
| --- | --- | --- |
| `index.html` | `js/main.js` | Landing and shared browser behavior |
| `student.html` | `js/student.js` | Student shell, learning activities, progress, and Arcade |
| `teacher.html` | `js/teacher.js` | Teacher shell, content, students, settings, and lazy tools |

`vite.config.mjs` builds all three entries. Large activities, games, teacher tools, reports, charts, and Quiz Maker stay behind dynamic imports. `scripts/generate-service-worker.mjs` derives the full student offline code graph from the production manifest rather than maintaining a second asset list.

## Ownership map

| Concern | Authority |
| --- | --- |
| Student activity runtime metadata and construction | `js/student/studentActivityRegistry.js` |
| Cross-surface activity labels and persisted metric aliases | `js/activityMetadata.js` |
| Activity implementations | `js/activities/` |
| Arcade game metadata and loading | `js/student/studentGameRegistry.js` |
| Game implementations and HTML assets | `js/games/` |
| Teacher lazy-feature composition | `js/teacherLazyFeatures.js` |
| Top-level teacher page IDs and view IDs | `js/teacherPageRegistry.js` |
| Teacher route parsing and application | `js/teacherRouting.js` |
| Semantic theme values | `css/theme.css` |
| Shared UI styles | `css/buttons.css`, `css/forms.css`, `css/cards.css`, `css/dialogs.css`, `css/navigation.css`, `css/feedback.css`, `css/containers.css`, and `css/typography.css` |
| Small shared DOM behavior | `js/ui/` and `js/main.js` |
| Domain data access | `js/services/*Repository.js` and narrow domain API modules |
| Browser Supabase initialization | `js/services/supabaseClient.js` and `js/supabaseService.js` |
| Database authority | `supabase/migrations/` plus RLS and RPC contracts |
| Environment validation | `config/supabase-config.js`, `vite.config.mjs`, and `planner` |
| Student worker version/cache ownership | `js/student/studentWorkerLifecycle.js`, loaded only by the generated worker; `scripts/student-precache.mjs` derives the student graph |
| Delivery-size budgets | `scripts/lib/deliverySizeBudgets.mjs`, enforced by `scripts/check-dist-size.mjs` after every production build |
| Lazy production graph | `scripts/lib/lazyBuildContracts.mjs`, enforced by `scripts/validate-lazy-build.mjs` after every production build |

Managers are application composition roots. They may coordinate shell-level use cases, but new feature internals should not be installed as broad manager methods or reach through a manager to another feature's private object.

## Add an activity

1. Add the implementation under `js/activities/`. Export a class whose name ends in `Activity` and give it an explicit cleanup method when it owns listeners, timers, URLs, or callbacks.
2. Add its canonical ID, shared label, and any legacy persisted metric aliases to `ACTIVITY_DEFINITIONS` in `js/activityMetadata.js`.
3. Add one descriptor to `STUDENT_ACTIVITY_REGISTRY` in `js/student/studentActivityRegistry.js`.
4. Define eligibility, word preparation, and construction on that descriptor. Use shared helpers only when the lifecycle is genuinely the same.
5. Add the activity ID to the independently controlled database activity policy through a migration when the server must accept it. Do not import client metadata into authorization code.
6. Add focused behavior tests and update the exact client/server parity expectation.

```js
{
    id: 'example-practice',
    title: 'Example Practice',
    description: 'Practice the current words.',
    icon: 'sparkles',
    settingKey: 'examplePractice',
    exportName: 'ExamplePracticeActivity',
    load: () => import('../activities/examplePractice.js'),
    isPlayable: word => Boolean(word.word),
    prepare: ({ wordLimit, prioritize }) => ({ words: prioritize(wordLimit) }),
    create: createWordListActivity
}
```

The runtime registry drives cards, routes, teacher setting keys, ordering, lazy loading, replay/coverage policy, and launch behavior. The shared metadata module stays separate so reports and teacher dashboards can label canonical and legacy persisted metrics without importing student launch code. An exact parity test prevents their canonical ID sets from drifting; persisted aliases never become launchable routes. XP and authorization remain server-authoritative. Run `npm run test:student-registries`, the activity's focused tests, `npm run test:student-activities`, and the production build.

## Add a game

Choose one launch mode:

- Canvas game: add a JavaScript module under `js/games/` and a `canvasGame` descriptor with a lazy `load`, exported class name, and factory.
- HTML game: add its self-contained files under `js/games/<game>/`, load `js/games/sandbox-storage.js` before game code, and add an `htmlGame` descriptor with the entry `path` and frame requirements.

Add the single descriptor in `js/student/studentGameRegistry.js`. Add `scoreMessageType` and `scoreOrder` only if the game reports leaderboard scores. A scoring game must also be authorized independently in the score RPC migration; the parity test requires the client and effective SQL policies to agree exactly.

HTML games communicate scores with the normalized score/game-over protocol consumed by the host. They remain sandboxed away from account storage and should not import the main application.

`scripts/copy-desktop-assets.mjs` derives copied HTML game directories and allowed cover art from the registry, so normal additions do not need a second asset list. Run `npm run test:student-games`, `npm run test:student-registries`, `npm run test:games`, `npm run test:ui:game-sandbox`, and `npm run desktop:build:web`. The build validator proves every registered asset exists and every canvas game remains lazy.

## Add a teacher feature

Use an explicit factory for a bounded feature:

```js
export function createTeacherExampleFeature({
    ensureAuthenticated,
    showView,
    repository,
    feedback
}) {
    return Object.freeze({
        async show() { /* authenticate, activate, then load */ },
        destroy() { /* remove owned listeners and invalidate pending work */ }
    });
}
```

Register its dynamic import, capability wiring, public method mapping, and optional inert HTML template in `js/teacherLazyFeatures.js`. Pass only capabilities the feature uses; do not pass `TeacherManager`, `supabaseService`, or an open Proxy into the feature. Keep state in the factory instance and make `destroy()` idempotent. Authentication, account replacement, navigation generations, late async results, listeners, timers, object URLs, charts, and stored account keys all need explicit ownership.

Feature-specific CSS may load with the module when it is large or unique. Shared structural UI belongs in the existing shared styles only when at least two features use the same contract.

Test the factory's public interface and the real lazy adapter. Use `docs/teacher-feature-dependencies.md` for the established lifecycle and security invariants.

## Add a top-level teacher page

1. Add `{ id, viewId }` to `js/teacherPageRegistry.js`.
2. Add the matching `.teacher-tab` and owned view or feature mount in `teacher.html`. Its `data-section` and `aria-controls` must match the descriptor.
3. Add the page's route application in `js/teacherRouting.js`. Keep nested modes and aliases with the owning feature rather than expanding the registry.
4. Connect the shell action to a narrow feature use case. Prefer `js/teacherLazyFeatures.js` when the page is a substantial optional tool.
5. Extend `tests/teacher-page-registry.test.mjs` and `scripts/ui-teacher-pages-smoke.mjs`.

The registry intentionally does not implement a generic router or own labels, route codecs, nested feature modes, or loaders. Run `npm run test:teacher-pages`, relevant feature tests, source smoke, and a production build. Verify navigation, direct hash entry, history, refresh, and account replacement.

## Change the theme or shared UI

Change semantic values in `css/theme.css`. The root scope is the shared theme; `.student-site` is the intentional student Celestial variant. New shared UI should use roles such as `--color-brand`, `--color-surface`, `--color-text`, `--color-danger`, and `--color-focus`, not copied color literals or palette-number names.

Structural shared styles are split by component family under `css/`. Shared behavior remains small: `js/ui/loadingState.js`, `js/ui/inlineStatus.js`, the dialog helpers in `js/main.js`, and `js/notifications.js`. Add a primitive only when repeated live behavior has the same lifecycle and semantics. Games and distinctive activity visuals keep their own palettes and internal UI.

Run the relevant style contract, `npm run test:student-design`, `npm run test:ui:smoke`, and the production build. Test 1120px and 1121px whenever the student shell or responsive ownership changes.

## Add or change data access

First-party UI does not build Supabase queries. Use these boundaries:

- A domain repository under `js/services/` owns table names, query shape, and row mapping.
- `studentApi.js` is the frozen student capability allowlist.
- `teacherAuthApi.js` is the frozen teacher-auth capability allowlist.
- `supabaseService.js` composes internal Supabase adapters; it is not a feature dependency to pass broadly.
- RLS and RPCs in `supabase/migrations/` remain authoritative for identity, roles, rewards, progress, Arcade time, and scores.

`serverStateQuery.js` captures account lifetime and school generation before asynchronous work. Reads default to school scope; use `scope: 'account'` only for data shared across that account's schools, such as the wallet summary. Cleanup invalidates old account lifetimes before awaiting cancellation. Keep ownership checks before dispatch and after awaited results; a cache key alone cannot protect a dynamically scoped repository request.

Do not wrap every repository. Add a new interface only for a real security boundary, alternate implementation, platform boundary, or needed test double. For transactional multi-record behavior, add a domain RPC instead of a generic client batch.

Environment URLs and browser-key validation live in `config/supabase-config.js`. Browser builds accept publishable or legacy anonymous keys and reject secret/service-role keys. Local Supabase CLI identity and deployment credentials remain separate authorities.

Run repository/API contract tests, the affected security/parity tests, and local Supabase acceptance checks when the local stack is available. See `docs/data-access-architecture.md` for the detailed boundary map.

## Own asynchronous UI work

Give each replaceable request a current-owner predicate and check it after every await before changing a model, storage or DOM. A view generation covers replacement of the whole view; independently replaceable previews need their own request identity. Cancel obsolete reads where supported, and still guard their results and errors.

Arcade access/settings share `captureArcadeSession` from `studentGameAccessMethods.js`. Lifecycle start operations own the purchase and launch lock. Stop cancels the launch but retains a confirmed purchase as resumable time; destroy invalidates the session. Keep that distinction when extending game controls. Client cancellation cannot undo a server purchase that already committed.

Wallet operations and gift panels share `captureCoinSession` from `studentProgressCoinMethods.js`. The progress instance can survive account changes, so identity alone is insufficient: retain account/storage ownership and cloud generation too. Pass captured ownership through backend initialization to the RPC dispatch; guarding only the returned result still allows an old action to execute under a new account. Subject batches apply the same rule before each item, preserving already-dispatched partial saves.

## Where new code belongs

- Activity-only behavior: `js/activities/<activity>.js` or an activity-owned folder.
- Game-only behavior/assets: `js/games/<game>/`.
- Student workflow composition: `js/student/`, behind `StudentActivities`, `StudentGames`, or the appropriate owner.
- Teacher feature implementation: a feature-owned module/folder plus one explicit lazy factory registration.
- Reusable DOM behavior: `js/ui/`, after confirming repeated behavior.
- Shared visual structure: the matching `css/<family>.css` file.
- Feature styling: the feature stylesheet or namespaced section of its current owner while materially changing it.
- Data mapping/query logic: an owning repository in `js/services/`.
- Cross-cutting configuration: the smallest domain config module; do not create a global constants bucket.

Prefer cohesive use-case methods such as `launchActivity(id)` over exposing a sequence of child operations. Preserve lazy imports, account/session cleanup, server authorization, existing persisted IDs and setting keys, and focused ownership tests.

## Required verification

For every architectural change:

1. Trace callers, persistence, routes, lazy imports, DOM ownership, and tests first.
2. Make one coherent change and remove its obsolete path in the same task.
3. Run focused contracts, then `npm test` and `npm run desktop:build:web`.
4. Run the relevant browser smoke when routes, UI, games, or account lifecycle change.
5. Inspect the scoped diff and production manifest. Do not commit generated `dist-desktop` output.

The production build enforces gzip budgets for the complete initial student and teacher JS/CSS graphs and for the largest lazy chunks. Raise a budget only after explaining the intentional delivery-cost change; do not move code between chunks merely to evade a limit.

Use `docs/architecture-remediation.md` as the resumable task record and `README.md` for development and release commands.
