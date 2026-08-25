# Sparks architecture remediation

This document tracks the incremental remediation started on 2026-08-24. Each task must leave the project in a tested, known-good state before the next task starts.

## Working rules

- Change one architectural concern at a time.
- Reinspect current callers, persistence, UI, and tests before editing.
- Preserve the existing game registry, lazy loading, repository seams, ownership tests, and security rules.
- Add a test when a change creates a new architectural contract.
- Remove compatibility code when its last caller is migrated.
- Do not reorganize folders unless the files are already changing for a behavioral reason.

## Baseline

| Item | Result |
| --- | --- |
| Date | 2026-08-24 |
| Starting commit | `490b36dc Simplify Sparks module ownership` |
| Remediation branch | `codex/sparks-architecture-remediation` |
| Scoped worktree | Clean before remediation |
| Full suite | `npm test` passed, including student shell, page smoke, and 13 HTML game sandbox checks |
| Student design audit | `npm run test:student-design` passed |
| Production build | `npm run desktop:build:web` passed in 7.83 seconds |
| Built-page smoke | `npm run test:ui:smoke:dist` passed all three routes against a fresh build |
| Dependency audit | `npm audit --audit-level=high` found 0 vulnerabilities |
| Import graph | Independent static check found 0 cycles across 215 first-party modules and 494 imports |
| Deployment size | 15.1 MB, under the 30.0 MB limit |
| Student entry | 263.88 kB raw, 68.28 kB gzip |
| Teacher entry | 165.81 kB raw, 45.35 kB gzip |
| Student CSS | 227.37 kB raw, 35.03 kB gzip |
| Teacher CSS | 149.89 kB raw, 24.40 kB gzip |
| Largest lazy feature | `reportGenerator`, 419.74 kB raw, 135.90 kB gzip |
| Student service worker | 17 files, 1,032,872 bytes precached |

The test suite intentionally exercises handled failure paths that log errors. These logs did not fail the baseline. No baseline failure requires remediation before architectural work begins.

## Task tracker

| Task | Status | Files changed | Verification | Decision or result |
| --- | --- | --- | --- | --- |
| 0. Establish baseline | DONE | `docs/architecture-remediation.md` | Full suite, design audit, production build, built-page smoke, dependency audit, independent review | Source and built application are green. Local Supabase checks remain unknown because Docker is unavailable. |
| 1. Activity catalog foundation | DONE | `js/student/studentActivityRegistry.js`, `js/teacherVocabularyEditorConstants.js`, registry tests | Registry, teacher-flow, 128 activity, build-efficiency tests; UI smoke; production build | Existing registry now owns teacher setting keys, labels, IDs, and order. Rewards stay server-authoritative. |
| 2. Activity catalog validation | DONE | Activity registry, registry contract tests, browser loader smoke, package script | Registry, loader smoke, teacher-flow, 128 activity, routing, build-efficiency tests; production build | Descriptors fail clearly when malformed. Chromium proves all 12 lazy loaders resolve their declared exports. |
| 3. Client/server activity parity | DONE | Migration parity test, registry package script | Registry, browser-loader, 128 activity, and security tests | Client IDs must match effective server access, flow-normalization, and required-activity filtering allowlists. Parsing fails on ambiguity, expressions, overload mismatch, or a later function drop. |
| 4. Migrate activities one at a time | DONE | Activity registry, progress flow, launcher, focused tests | All focused suites, the complete test suite, registry browser smoke, production build, and independent review pass | All 12 activities own eligibility, preparation, and construction through the registry. The legacy launch and eligibility switches are gone. Illustration keeps a narrow feature context and protected draft-reset policy. |
| 5. Consolidate duplicated configuration | DONE | Activity/flow policy, catalog tooling, economy and duration config, shared progress/config values | Complete suite, focused config suites, UI/regression smoke, production builds, independent review | Genuine client authorities are centralized; server security remains independent with parity contracts. Unproven product destinations and later-phase navigation/auth policy are documented rather than guessed. |
| 6. Remove confirmed dead code | DONE | XP mirror; save stubs; orphan assets; unused utilities/barrel exports; dead student/teacher CSS; unreachable platform-auth messages | Complete suites, focused ownership/auth suites, UI/regression smoke, production builds, independent review | Removed only code with complete caller/import evidence; preserved uncertain data-driven and source assets. |
| 7. Investigate legacy quiz implementation | DONE | Import ownership; legacy module/modal/listeners/proxies/state/styles | Complete suite, focused quiz/vocabulary/architecture/accessibility tests, source and built UI smoke, production build, independent review | Retired unreachable preview; preserved routed/lazy Quiz Maker and independently registered student Quiz. |
| 8. Introduce semantic design tokens | DONE | Central theme authority, scoped student variant, compatibility aliases, entry loading contract | Complete suite, token/design-system contracts, 9-width student regression, three-page UI smoke, production build, independent review | Existing values remain visually equivalent; app theme authority is centralized without coupling isolated games or lazy feature styles. |
| 9. Migrate shared UI families | DONE | Buttons; inputs/form controls; cards; dialogs; navigation; feedback; containers; typography ownership | Complete suite, UI-family contracts, style comparisons, 9-width regression, source/built UI smoke, production builds, independent review | Repeated shared UI foundations are centralized while page-responsive and feature-owned behavior remains local. Existing typography authority now exclusively owns font delivery. |
| 10. Reduce literal brand colors | DONE | Theme status roles; migrated shared styles; app-shell identity effects; known UI fallbacks; contract test | Complete suite, focused theme/UI contracts, 9-width regression, source/built smoke, production build, independent computed/pixel review | Canonical identity/status hues in migrated areas now derive from semantic tokens. Contextual game and feature palettes remain owned locally. |
| 11. Reduce unnecessary `!important` | DONE | Quiz print; teacher dashboard/Word Hunt/login; lazy Flashcards/game stage; specificity guard | Complete suite, focused feature/style checks, computed/pixel comparisons, 9-width regression, source/built smoke, production build, independent review | Removed 9 proven-redundant declarations. Required state, inline-bridge, reduced-motion, and layered responsive exceptions remain documented rather than removed speculatively. |
| 12. Clean up owned inline styles | DONE | Quiz Maker, Analytics Dashboard, Student Progress roster, Add Student, Student Detail, loading/login, Vocabulary, Settings, Data Export, Data Viewer, and Data Reset presentation; inline-style/specificity contracts | Complete suites, focused ownership/lazy checks, multi-state and multi-viewport computed/pixel comparisons, production builds, source/built smoke | Eleven bounded teacher surfaces delegate fixed presentation to owned CSS. Runtime visibility, drag state, calculated progress, reset gating, and user-selected colors remain with their behavior/data owners. The inert Reset control is documented for a separate product/security decision. |
| 13. Create lightweight shared UI modules | DONE | Shared loading-state helper; Quiz picker and Vocabulary library consumers; primitive contract test | Complete suite, focused UI/Vocabulary/lazy checks, production build, source/built smoke | Added one evidence-backed DOM primitive. Existing element, button/card CSS, modal lifecycle, student skeleton, toast, and completion owners remain the simpler contracts. |
| 14. Standardize application feedback | DONE | Shared notification lifecycle; centered reward timer/presentation; loading and inline-status primitives; six teacher status producers | Complete suite, focused feedback/shell/teacher/lazy/security checks, browser computed-style checks, production build, source/built smoke, independent reviews | Shared application feedback now has small behavior contracts while activity/game visuals and rich feature notices remain owned locally. |
| 15. Map teacher feature dependencies | DONE | `docs/teacher-feature-dependencies.md`, tracker | Source tracing, focused lazy/context and feature suites, full regression, production build, built-page smoke, independent review | Documented loader/proxy, manager, DOM, data, notification, route, and lifecycle dependencies. Groups is the Task 16 pilot because it is bounded and exposes a confirmed listener/context defect. |
| 16. Convert one teacher feature | DONE | Groups factory, lazy adapter, feature-owned state/listeners, runtime/ownership tests, dependency map, package test script | Focused Groups/data/lazy suites, browser factory and real lazy-adapter workflow, full regression, production build, built-page smoke, independent diff review | Groups exposes only `show`/`destroy`; manager retains only `showGroupsView`. The confirmed undefined-manager listener path is removed without changing routes, repositories, storage keys, or lazy loading. |
| 17. Validate the teacher feature pattern | DONE | Tracker and teacher dependency map | Task 16 full regression/build/smoke evidence, lazy-adapter browser workflow, before/after coupling and bundle comparison, independent review | The factory pattern is accepted with constraints: narrow use cases, owned state/listeners, explicit capabilities, and no forced shared base class or route teardown. |
| 18. Migrate remaining teacher features | DONE | Five explicit lazy feature factories; shared disposal; Data dashboard/export/viewer/settings composition; account cleanup; tests, browser workflows, and dependency map | Per-feature focused/full suites, lazy adapter workflows, production builds, built-page smoke, three independent Data reviews | Every lazy teacher feature now has a narrow explicit interface. The prototype capture and manager-fallback Proxy are gone. Data Management retains cohesive internal modules behind one `show`/`destroy` page interface. |
| 19. Create a small page registry | DONE | `js/teacherPageRegistry.js`, teacher shell view discovery, registry contract, package script | Registry, navigation, routing, build/lazy, and source UI smoke checks; independent reviews | Seven primary teacher navigation pages now have one frozen `{id, viewId}` authority. Modes, aliases, loaders, labels, and route codecs stay with their current owners until their incremental migrations. |
| 20. Migrate teacher pages | DONE | All seven primary teacher pages; primary-page browser smoke; account-isolation hardening | Per-page registry, routing, navigation, browser history, lazy feature, account-switch, complete regression suite, and production build | Every primary page now uses its registry descriptor. Data and Settings preserve route-based disambiguation on their intentional shared view. |
| 21. Remove duplicated navigation wiring | DONE | Teacher history listener; registry-derived reverse view mapping; navigation generation/owner tokens; primary route reservations; Vocabulary session/document lifecycle and save ownership; race tests | Focused teacher feature/editor/Quiz suites and browser races, all-seven-page smoke, complete regression suites, production builds, three independent final reviews | History has one authority; stale navigation, account data, cache results, editor work, image callbacks, and save UI cannot cross their owner. Saves use immutable per-document tickets with latest-result recovery. |
| 22. Analyze broad forwarding interfaces | DONE | `docs/manager-facade-analysis.md`, tracker | Repository-wide caller/receiver tracing, existing ownership contracts, three independent maps | Most facades protect real ownership. Bounded Arcade intents were deepened in Task 23 and the revalidated dead-forward list was removed in Task 24; broad facade removal was rejected. |
| 23. Reduce forwarding where a cohesive use case exists | DONE | Arcade selection, add-time, and exit lifecycle intents; listener contracts | Student Games, listener, routing, build/lazy, complete regression, production build, architecture review | Global listeners express complete Arcade intents. Route refresh, Data roster, and Quiz adapter remain unchanged because additional wrappers or cached authorities would increase coupling. |
| 24. Remove obsolete facade methods | DONE | Student/teacher obsolete bridges, aliases, broad read chain, and ownership/least-data contracts | Focused domain/security/build checks; complete regressions; production builds; browser smoke; independent audits | Removed 30 obsolete facade methods plus associated dead state/service code. Live owner APIs, bounded data paths, lazy loading, persistence, and security boundaries remain intact. |
| 25. Move legacy game adapters into descriptors | DONE | Dead host monitor removal; descriptor-owned score order; registry contract | Focused game/registry/security/build checks; complete regressions; production builds; 13-game smoke; independent runtime reviews | Live bridge stays game-owned inside the sandbox. Registry owns message types, frame/capability metadata, and score direction. A formatter interface is intentionally deferred. |
| 26. Define a host/game protocol | DONE | Normalized host score/game-over parser; strict payload contract; host integration | Focused game/registry/security/build checks; 13-game sandbox smoke; complete regression; production build; two independent reviews | Standardized only the live protocol. Source/type validation and lifecycle stay with the host; no unused ready/status/error events were invented. |
| 27. Add game registry contract tests | DONE | Source registry contract; post-build asset/lazy-manifest validator | Registry/game/security/build checks; complete regression; 13-game sandbox smoke; production build; three independent maps | Registry entries must be valid, reachable, loadable, copied, and lazy in production. No second registry or eager validation path was added. |
| 28. Review Supabase seams | DONE | Data-boundary map; raw-access trace; interface decision inputs | Focused repository/API/auth/storage/security suites; complete prior regression baseline; two independent boundary audits | Existing repositories and student capability boundary are sound. Confirmed reward-authority and stale-role risks move to Task 29; secret-key validation moves to Task 30. |
| 29. Add interfaces only where justified | DONE | Signed-in reward authority; narrow teacher auth capability; fail-closed role lifecycle; game/server score parity | Focused/full regression; production builds; registry/database contracts; independent reviews | Added only two justified seams: authoritative signed-in rewards and injectable teacher auth. Client leaderboard capability now exactly matches independent SQL authorization and score order. |
| 30. Consolidate environment authority | DONE | Shared browser-key validation; hosted project identity; planner derivation | Focused config/auth/security tests; planner syntax/runtime checks; complete regression; production build; independent review | One hosted project ref derives the runtime URL and planner fallback. Runtime/build reject current secret and legacy service-role browser keys. Local/server/deployment boundaries remain intentionally separate. |
| 31. Correct stale documentation | DONE | README and four architecture/reliability records | Full regression suite, production build, scoped diff check, reference audit, independent documentation review | Removed broken and stale release guidance; updated completed page/facade/data boundaries; marked the database cutover record historical. Runtime/package naming remains unchanged. |
| 32. Create `ARCHITECTURE.md` | DONE | `ARCHITECTURE.md`, tracker | Documented-path check, full regression suite, 13-game sandbox smoke, production build, independent ownership trace | One concise extension map now answers where and how to add activities, games, teacher features/pages, theme/UI, and data boundaries without duplicating implementation internals. |
| 33. Organize changed features gradually | DONE | Tracker only | Repository ownership/path trace, reference counts, prior full regression/build, independent organization audit | No additional move is justified now. Owned directories, consistent prefixes, registries, factories, and `ARCHITECTURE.md` make boundaries discoverable; import-only churn is rejected. |
| 34. Add delivery-size budgets | DONE | Manifest-driven budget authority, build enforcement, focused tests, architecture map | 16 focused checks, full regression, production build, independent review | Build now limits total deployment, complete initial student/teacher JS+CSS graphs, and the three largest lazy chunks using deterministic gzip and stable manifest names. |
| 35. Preserve lazy loading | DONE | Production lazy-graph validator, build integration, fixture contracts, architecture map | 21 focused build checks, full regression, production builds, student precache validation, independent runtime/manifest review | Nine feature edges and deferred student styles must remain lazy; optional games, activities, reports, teacher tools, Quiz Maker, charts, CSS, and assets cannot enter initial graphs/precache. |
| 36. Remove code and CSS proven obsolete | DONE | Activity state; repository/auth surfaces; teacher, Quiz, and container styles; focused contracts | Focused ownership/style/auth checks, full regression, 9-width regression, source and built smoke, 13-game sandbox, production build, independent reviews | Removed only source-proven zero-caller code and orphan styles. Live security, lazy-feature, student, teacher, Quiz, and shared vocabulary behavior remains owned and tested. |
| 37. Final architecture verification | TODO | | | |

## Change log

### Task 15, map teacher feature dependencies

- Documented the current lazy loader, template mounting, temporary prototype capture, per-manager proxy context, initialization cache, routing boundary, and absence of feature teardown.
- Mapped Groups, Sparks, Data Management, Word Hunt Review, and Quiz state, host capabilities, data access, DOM/listeners, notifications, resources, cleanup, and primary tests.
- Confirmed that the loader intentionally keeps internal captured methods off `TeacherManager`; the proxy test enforces that contract.
- Found a real Groups wiring defect: seven eager global listeners call internal Groups methods on the manager even though those methods exist only on the lazy proxy context.
- Chose Groups as the first conversion because it is bounded, its grouping algorithm is already isolated and tested, it has no student-facing writes, and conversion removes the defect without a compatibility facade.
- Considered eager Overview as the smallest factory pilot and Word Hunt Review as another cohesive lazy candidate. Groups was preferred because it validates the actual lazy-feature boundary and fixes demonstrated coupling; Data Management, Quiz, and Sparks are higher-risk first conversions.
- Task 15 changes documentation only. No runtime, route, persistence, DOM, or security behavior changed.

### Task 16, convert Groups to an explicit feature

- Replaced the Groups temporary-prototype/proxy implementation with `createTeacherGroupsFeature`, while retaining the existing lazy `TeacherManager.showGroupsView()` shell and routing adapter.
- The feature now owns its roster, selected class, absences, generated groups, pair restrictions, local fallback state, and all seven Groups control listeners.
- Removed the five Groups-only fields from `TeacherManager` and removed eager Groups listeners from `teacherGlobalListeners.js`; internal handlers are no longer manager capabilities.
- Exposed only frozen `show()` and `destroy()` use cases. Listener binding is idempotent and `destroy()` removes every owned listener. Later account cleanup made destroyed facades terminal; the lazy owner recreates a fresh context when needed.
- Preserved the identity-only roster loader, restriction repository/RLS boundary, local fallback behavior, clipboard notifications, static markup, grouping algorithm, direct route, and navigation entry. Daily absence keys are now teacher-scoped instead of shared across accounts.
- Added the previously orphaned Groups tests to `npm test` and added a browser workflow covering direct factory behavior plus the real lazy adapter. The latter reproduces the formerly broken manager path and confirms the manager does not expose internal handlers.
- Updated the data-efficiency and build-ownership contracts to follow the new explicit seam. Groups remains a separate 15.61 kB raw, 4.91 kB gzip lazy chunk; the eager teacher entry is 158.31 kB raw, 43.60 kB gzip.
- The first complete suite run found one stale source assertion expecting the roster capability inside `teacherGroups.js`; the assertion now correctly follows the explicit loader dependency. Focused reruns and the subsequent complete suite passed.

### Task 17, validate the explicit teacher feature pattern

- Independent review found no behavior, security, repository, route, lazy-loading, or cleanup regression after the Groups conversion.
- Before conversion, Groups relied on five manager state fields, proxy fallback to manager capabilities, and seven eager listeners that called unavailable manager methods. After conversion, state and listeners are feature-owned, the manager exposes only `showGroupsView`, and the feature facade exposes only `show` and `destroy`.
- Repeat `show()` binds one listener per control. `destroy()` removes all seven exact handlers and the real lazy owner recreates a new context after account disposal. The installer-to-public-method adapter is browser-tested, not only source-matched.
- The feature still receives the existing identity-only roster use case and private restriction repository. It does not receive a manager, raw Supabase client, router, or broad context object.
- Lazy loading is preserved: Groups remains a distinct 15.61 kB raw, 4.91 kB gzip chunk. The eager teacher entry decreased from Task 15's 158.95 kB raw, 43.68 kB gzip to 158.31 kB raw, 43.60 kB gzip.
- Accepted pattern: a feature factory owns cohesive state and listeners, receives explicit capabilities, and returns only application use cases. Do not add a common feature base class, generic event framework, or mandatory `destroy()` where no resource needs cleanup.
- Remaining lazy features must be migrated independently. Their contracts may differ: Word Hunt needs resource/listener cleanup; Sparks has a modal and repository cache; Quiz first needs a narrower vocabulary capability; Data Management should not be preserved as one oversized factory.

### Task 18a, migrate Word Hunt Review

- Replaced the Word Hunt Review prototype capture/proxy with `createTeacherWordHuntReviewFeature`, while preserving both stable manager adapters: `showWordHuntReviewView` maps to `show`, and `loadWordHuntReview` maps to `load`.
- The feature owns its 40 collaborating internal methods, rows, filters, drilldown, selection, view modes, cache/promise, request generations, image URLs, and listener disposers. Its frozen public surface is only `show`, `load`, and `destroy`.
- Replaced implicit manager/global access with explicit capabilities for authentication, review activation, active-state checks, subject metadata, icon refresh, the narrow review/image data source, feedback, storage, scoped DOM, selector escaping, and object URLs.
- Scoped feature queries to `#vocabulary-review-panel`; preserved the static HTML, routes, vocabulary workflow behavior, local note/view-mode keys, review RPC/RLS path, image storage operation, and user-facing copy.
- Persistent content delegation and document keyboard navigation now bind once and remove exact handlers during `destroy()`. Dynamic controls remain owned by the DOM nodes replaced during rendering.
- Added one in-flight normal review request and generation guards. Concurrent loads share the request; a forced refresh is latest-wins; stale success or error work cannot replace a newer view.
- Added an image generation guard. Late downloads from an old selection or disposed feature cannot mutate detached UI or retain blob URLs; active URLs are revoked during selection changes and disposal.
- Added `disposeLoadedTeacherFeatures()` as a manager lifecycle use case. It disposes only explicit contexts that implement `destroy`, isolates failures per feature, and is called for sign-out, null-user auth transitions, and account UID changes. Word Hunt disposal clears sensitive cached rows before a later teacher can log in.
- Browser verification uses the real lazy adapters, navigates the Subject → Grade → Group → Unit review path, loads a real blob URL, disposes the context, observes revocation, reloads, and confirms a fresh data request with no manager-internal state.
- Kept the five method groups private implementation details; tests assemble their own internal harness rather than widening the production API.
- Verification: the complete suite, 13-game sandbox smoke, production build, and built-page smoke passed. Word Hunt remains lazy at 30.80 kB raw / 7.41 kB gzip; the teacher entry is 159.50 kB raw / 43.92 kB gzip, and deployment remains 13.6 MB.

### Task 18b, migrate Teacher Sparks

- Replaced the 52-method Spark proxy composition with `createTeacherSparksFeature`. The frozen public surface is only `show` and `destroy`, while the existing data, library, editor, and persistence method groups remain private implementation collaborators.
- Moved all Spark library cache, view filters, editor identity, and request generations off `TeacherManager`. Removed the ineffective eager modal setup; the factory now owns modal setup after its template is lazily mounted.
- Replaced implicit manager/global dependencies with explicit authentication, view activation, current-user, icon, feedback, modal, DOM, and narrow repository capabilities. The repository implementation stays imported inside the dynamic Spark chunk, not the eager lazy-loader module.
- Converted the ten feature control/delegation listeners to exact removable handlers. Auth disposal closes the modal, removes listeners, clears rendered and cached data, invalidates late async work, and allows one clean rebind on a later session.
- Added latest-wins library generations and identity-checked promise cleanup. Older forced loads and stale failures cannot overwrite a newer view. A separate lifecycle generation suppresses post-disposal save/archive effects without incorrectly hiding a successful write when an ordinary refresh overlaps it.
- Browser verification exercises the real lazy adapter, proves the modal is inert before first use, creates and saves a Spark, disposes/recreates the feature, saves again exactly once, and confirms no Spark internals leak onto the manager.
- Verification: 10 focused composition/race/lifecycle tests, the Spark browser smoke, lazy/build contracts, and production build passed. Sparks remains lazy at 34.57 kB raw / 9.15 kB gzip; the eager teacher entry decreased from 159.50 kB raw / 43.92 kB gzip to 159.21 kB raw / 43.76 kB gzip. Deployment remains 13.6 MB.

### Task 18c, isolate Quiz navigation state

- Before converting Quiz to a factory, removed its hidden mutation of the main Vocabulary browser's `libraryItems` and `libraryDrilldown`. Quiz now owns `quizLibraryItems` and `quizDrilldown`, and canonical Quiz routes are written from that state.
- Added one parameterized vocabulary filter model used by both Vocabulary and Quiz. It takes the item collection and placement functions explicitly, avoiding both duplicated filtering rules and the former temporary array swap.
- Direct Quiz routes pass their parsed drilldown through the existing vocabulary workflow coordinator. Quiz navigation no longer changes the Assign browser's active array or drilldown, while canonical, legacy hub, and editor URLs retain their public contracts.
- Added focused contracts for independent filtering/navigation, Quiz-owned route metadata, removal of mutable Vocabulary state access, and all three Quiz route forms. This is a prerequisite only; the Quiz proxy, lifecycle, full cloud-vocabulary resolution, and nested editor cleanup remain for separate changes.
- Verification: the complete suite, including the 13-game sandbox smoke, passed before the final route-timing hardening. After moving the route write ahead of the asynchronous picker load, the six Quiz composition tests, seven Vocabulary ownership tests, fourteen routing tests, build/lazy contracts, production build, and built-page smoke passed. Quiz remains lazy at 17.16 kB raw / 4.66 kB gzip; teacher entry JavaScript is 159.55 kB raw / 43.92 kB gzip, and deployment remains 13.6 MB.

### Task 18d, resolve full Quiz vocabulary data

- Confirmed that the cloud picker receives metadata-only records from `listMetadata()`: they intentionally carry `wordCount` but omit `words`. The old cloud path cloned this metadata and Quiz Maker rejected it as empty.
- Added a value-returning Quiz vocabulary resolver. Cloud records load their full row by ID, repository records load by path, and local drafts are cloned without I/O. The resolver has no rendering, navigation, manager, persistence, or authorization side effects, and it rejects missing source keys, unknown sources, null responses, and missing word arrays before caller state changes.
- The opener now commits only the latest selection. A monotonically increasing generation suppresses stale success and stale error when cloud or repository requests finish out of order. Resolved values retain source metadata and do not mutate picker inputs.
- Tests use the real `{ word, definition }` shape, prove cloud/remote/local source dispatch and cloning, reject malformed metadata, prove usable cloud words reach the builder seam, and cover out-of-order success and rejection. The existing repository metadata contract continues to prove catalog rows omit full words.
- Did not add cloud caching or change Supabase access. Full cloud reads continue through the authenticated repository/RLS boundary. The existing device-global Quiz draft key can now contain the selected cloud words, as it already can for local/repository vocabularies; account scoping and teardown remain part of the explicit Quiz feature conversion.
- Verification: the complete suite and 13-game sandbox smoke passed after source resolution was added. After the independent review required the latest-selection guard and realistic word fixtures, all eleven Quiz tests, twelve build/lazy tests, production build, and built three-page smoke passed. The reviewer approved the corrected diff. Quiz remains lazy at 18.03 kB raw / 4.95 kB gzip; teacher entry JavaScript is 159.55 kB raw / 43.91 kB gzip, the service worker precaches 20 files totaling 1,027,448 bytes, and deployment remains 13.6 MB.

### Task 18e, remove unreachable Quiz export systems

- Repository-wide source tracing proved the Quiz Maker print, raster-image, and raster-PDF methods had no template control, listener, route, test, or runtime caller. The only live Quiz export control is Word/DOCX and remains bound to `exportAsWord()`.
- Removed the two unreachable method installers and their unused `ensureHtml2Canvas`/`ensureJSZip` helpers instead of expanding the upcoming lifecycle contract around UI that cannot be reached. Removed `html2canvas` as a direct application dependency; it remains transitively available through the live report dependency and therefore still appears as a shared build chunk.
- Independent review caught that the DOCX regression test imports `jszip` directly. Kept it explicitly as a development dependency rather than relying on `docx` dependency hoisting. The live Word exporter, generated document, and ZIP/XML validation are unchanged.
- Added absence guards so both dead installers cannot return. Verification: focused Quiz, build/lazy, report, and live Word-generation tests; the complete suite; 9-width student regression; source UI smoke; 13-game sandbox smoke; production build; and built three-page smoke passed. The reviewer approved the corrected dependency boundary.
- The Quiz Maker nested chunk decreased from 422.19/118.70 kB raw/gzip to 403.92/115.17 kB. The build dropped from 2,333 to 2,327 transformed modules and deployment from 13.6 to 13.5 MB. The lazy Quiz coordinator remains 17.94/4.92 kB, teacher entry remains 159.55/43.92 kB, and the service worker remains 20 files totaling 1,027,448 bytes.

### Task 18f, give Quiz Maker an explicit lifecycle

- Added idempotent `QuizMaker.destroy()`. It invalidates the maker lifecycle, clears the 350 ms generation debounce, detaches property handlers from the static builder controls and tool tabs, clears generated section/preview nodes, removes every tracked rubric overlay, releases drag and callback references, and clears tracked Word-download timers and object URLs.
- Tracked rubric wrappers rather than searching their duplicated inner dialog ID. Normal Cancel/Save removes the exact owned wrapper; session teardown removes every still-open wrapper. Delayed generation and state callbacks are permanently silent after disposal.
- Guarded both asynchronous Word-export boundaries. A maker disposed while its logo or DOCX blob is loading cannot download or report an irrelevant error. Temporary anchors are removed in `finally`; append, click, or timer-setup failures revoke/delete the URL immediately, while successful downloads retain the existing one-second revocation.
- Added a direct lifecycle suite covering idempotent cleanup, static handlers, timers, overlays, URL ownership, delayed Word export, throwing downloads, generated-node clearing, callback silencing, and post-destroy scheduling. Independent review found and then approved the failure-safe download correction.
- Verification: fifteen focused Quiz/lifecycle tests, the live DOCX ZIP/XML regression, build/lazy tests, the complete suite, 9-width student regression, source UI smoke, 13-game sandbox smoke, production build, and built three-page smoke passed. Deployment remains 13.5 MB with 2,327 transformed modules. The nested Quiz Maker chunk is 406.03/115.74 kB raw/gzip, lazy Quiz is 17.94/4.92 kB, teacher entry is 159.55/43.92 kB, and the service worker precaches 20 files totaling 1,027,448 bytes.

### Task 18g, migrate Quiz to an explicit feature

- Replaced the Quiz prototype/proxy installation with `createTeacherQuizFeature`. The frozen public surface is only `show`, `open`, and `destroy`; Quiz library data, drilldown, view preferences, builder identity, return state, and async generations no longer live on `TeacherManager`.
- Added one validated, frozen vocabulary-browser adapter authority. It exposes only the 28 existing browser-model/rendering capabilities Quiz actually uses, rejects missing functions clearly, and replaces both the open-ended proxy context and duplicated capability lists. The later manager-facade audit can reduce this bounded adapter only where a genuinely cohesive use case is demonstrated.
- Preserved first-level Quiz lazy loading, lazy CSS, and the nested QuizMaker import. The shell resumes Quiz through the public use case instead of inspecting Quiz state, and route application passes canonical Quiz drilldown without mutating Assign navigation.
- Scoped Quiz drafts and view preferences to the active teacher UID/ID. Legacy unscoped keys are intentionally ignored rather than assigned to whichever teacher next uses a shared device. Draft restoration, vocabulary commits, and nested builder loading now require current authentication.
- Added latest-wins/lifecycle guards for picker loading, vocabulary selection, nested builder loading, callbacks, and asynchronous row word-count hydration. Disposal removes both picker and view-toggle controls. Failed QuizMaker imports or construction return to the hub with user feedback instead of leaving a blank editor or unhandled rejection.
- Corrected row-mode helpers to receive Quiz's private drilldown explicitly. Assign's current hierarchy can no longer affect Quiz columns, depth classes, or ordering.
- Added a browser workflow using the real lazy adapter. It proves template mounting, routing, empty-state rendering, Assign-state isolation, disposal/recreation, and absence of Quiz implementation fields/methods on the manager.
- Independent architecture and race-condition reviews initially found account scoping, Assign drilldown, capability-list, hydration, listener, failure-rollback, and authentication gaps. Both reviewers approved the corrected diff with no remaining blocker.
- Verification: 25 focused Quiz/lifecycle tests, 12 build/lazy tests, 14 routing tests, Quiz browser smoke, the complete suite, 9-width student regression, source UI smoke, 13-game sandbox smoke, production build, and built three-page smoke passed. The build transforms 2,329 modules; Quiz remains a separate 22.14/5.77 kB raw/gzip chunk, nested QuizMaker remains 406.03/115.74 kB, teacher entry is 161.42/44.43 kB, deployment is 13.5 MB, and the student service worker remains 20 files totaling 1,027,448 bytes.

### Task 18h, correct the Data Management Analytics entry

- Data Management tracing found that the Students page's `Analytics` button called the lazy feature without an area or tab. The existing fallback therefore opened Settings → Subjects instead of Data → Dashboard.
- Made that caller explicit with `{ area: 'data', tab: 'dashboard' }`. No route format, sidebar behavior, repository, template, or other Data Management code changed.
- Added a source contract and ran the 12 teacher-data checks plus all 14 routing checks. Both suites passed. The broader Data Management factory conversion remains the next Task 18 change.

### Task 18i, remove pre-mount Data Management initialization

- Removed two unreachable Student Progress calls to `initExportListeners()` and `initDataViewer()`. Those methods exist only inside the lazy Data Management context, so the calls threw after progress loaded and were swallowed by the broad retry-state catch; they also could not bind controls before the lazy template mounted.
- Removed eager settings-listener initialization from the application listener bootstrap. The Settings controls also live inside the lazy template, so the eager pass always found no elements; the lazy Data Management initialization remains their sole live owner.
- Added a source ownership contract. Focused Student Progress, Data Management, lazy/build, and routing verification must remain green before the factory loader switch.

### Task 18j, migrate Data Management to an explicit feature

- Replaced the last temporary-prototype/Proxy feature with `createTeacherDataManagementFeature`. Its frozen interface contains only `show` and `destroy`; dashboard, export, viewer, and settings implementations remain private, cohesive modules behind that interface.
- Passed explicit capabilities for authentication, view and route activation, settings use cases, roster and selection reads, library and analytics reads, account identity, feedback, storage, and icon refresh. Data methods and state no longer leak onto `TeacherManager`.
- Removed `services/featureContext.js`, its Proxy-specific test, prototype capture, and fallback method path. All five lazy teacher features now use the same explicit factory loader without a compatibility system.
- Made Data listeners feature-owned, including school-calendar inputs and delegated schedule controls. Disposal removes exact handlers, destroys four Chart instances, cancels timers, clears imported and account-sensitive DOM, and invalidates dashboard, roster, preview, export, and file-read work.
- Reserved Data and Settings routes before a cold lazy import and reject stale route continuations, including same-area requests whose omitted tab means Dashboard or Subjects. Direct routes, browser history, and the Students Analytics shortcut retain their canonical behavior.
- Hardened account replacement and sign-out by clearing shared roster, selection, summary, and detail-request state. Late roster and detail results cannot merge into the next teacher session.
- Kept Chart.js and Papa Parse lazy. Dashboard work handles its parallel library rejection immediately and rechecks lifecycle after Chart loading. Export disposal suppresses late downloads, logs, notices, and completion timers.
- Preserved the intentionally inert Reset control. Teardown restores its locked copy without destroying the icon/layout markup. A destructive reset still requires its own product, repository, and security design.
- Normalized imported numeric coin and score fields before rendering, added latest-file-wins behavior, and made Clear remove rendered student data rather than only hiding its containers.
- Added a factory contract and a real-browser lazy workflow covering template mount, routes, Dashboard, default and explicit export selection, export cancellation, charts, disposal/recreation, settings listener ownership, stale same-area navigation, latest file selection, hostile numeric import markup, and Clear privacy.
- Three independent reviews found and verified corrections for capability shadowing, cold-load routing, calendar ownership, chart and library races, account-detail isolation, Reset markup, imported markup, and stale Viewer DOM. All reviewers approved the corrected change.
- Verification: 17 focused Data tests plus browser smoke, 12 Student Progress composition tests, routing, security, lazy/build, and inline-style contracts; the complete `npm test` suite; 9-width student regression; three-page source smoke; 13-game sandbox smoke; production build; and built three-page smoke passed.
- The final build transforms 2,328 modules. Data Management remains a separate 44.19/10.72 kB raw/gzip chunk, Chart.js remains separate at 208.31/71.37 kB, the teacher entry is 163.34/44.66 kB, deployment is 13.5 MB, and the student service worker precaches 20 files totaling 1,027,448 bytes.

Task 18 is complete. The next change is the small top-level page registry in Tasks 19-21. It should centralize existing page metadata without introducing a routing framework.

### Architecture review after Tasks 18g-18j

- Independent review found no behavior, security, lazy-loading, or new-coupling blocker in the Quiz and Data Management conversions.
- Removed the now-dead optional feature initialization cache and hook. All five explicit factories initialize their own private contexts, and repository tracing found no remaining feature definition with a separate `initialize` callback.
- Kept the 28-method Quiz vocabulary-browser adapter for Tasks 22-23. It is broad but explicit, frozen, and tested; replacing it is justified only if cohesive vocabulary-browser use cases reduce the interface.
- Kept Data route/tab consolidation for Tasks 19-21 and capability-contract cleanup for Task 29. Neither requires a compatibility layer or blocks the current feature interfaces.

### Task 19, create the primary teacher page registry

- Added a dependency-free registry for the seven primary teacher navigation pages in their persisted DOM order: Overview, Vocabulary, Sparks, Students, Groups, Data, and Settings.
- Kept each descriptor to `{ id, viewId }`. The ID already serves as the primary navigation section and canonical simple route identity. Labels remain accessible HTML content, lazy imports remain in `teacherLazyFeatures.js`, and complex aliases, modes, tabs, and URL encoding remain in `teacherRouting.js` or their feature owner.
- Explicitly permits only Data and Settings to share `teacher-data-management-view`. Duplicate IDs, other duplicate views, empty fields, unknown fields, null descriptors, and empty registries fail clearly.
- `teacherShell.js` now derives its primary view discovery from the registry. Loading, Login, Vocabulary Editor, and Quiz Maker remain explicit shell or nested-workflow views. This makes the registry a runtime authority without forcing nested workflows into the primary-page model.
- Added an independent seven-page fixture and robust HTML parity checks. The contract verifies page order, `data-section`, `aria-controls`, target existence, descriptor freezing, lookup, exact fields, and the intentional Data/Settings shared view.
- Kept Quiz, Word Hunt Review, editor routes, Data tabs, and compatibility aliases out of the registry. They are Vocabulary modes, nested workflows, or feature-owned route details rather than primary navigation pages.
- Verification: two registry contracts, four navigation contracts, 14 routing contracts, 11 build/lazy contracts, source three-page smoke, and scoped diff validation passed. Independent reviews approved the corrected foundation after the registry gained a production consumer and an independently pinned public-page fixture.

Task 19 is complete. Task 20 will migrate primary pages one at a time; Task 21 will remove the old switches only after every page uses the registry-backed navigation path.

### Task 20a, migrate Overview

- Replaced Overview's duplicated route/view literals in the shell and router with the `overview` registry descriptor. The `/teacher/overview` URL, `/activities` compatibility redirect, default route, view activation, and overview loader remain unchanged.
- Added a browser workflow built from the real teacher navigation markup. It verifies the public section/dashboard navigation paths, direct route application, Back navigation, visible Overview view, active tab, mobile label, top-bar label, canonical hash, and Overview load call.
- Kept route parsing, history serialization, page loading, labels, and static HTML in their existing owners. This page migration uses registry identity and view metadata only.
- Verification: registry and browser page smoke, all 14 routing checks, four navigation checks, production build, all 11 build-efficiency checks, scoped diff validation, and independent review passed.

Task 20 remains in progress. Vocabulary is next because its assign hub is eager but has nested Review, Quiz, and Editor modes that must remain outside the primary-page descriptor.

### Task 20b, migrate Vocabulary

- Replaced duplicated primary Vocabulary page IDs and view IDs in the shell, router, Assign workflow, Overview shortcut, and lazy Review/Quiz parent-page adapters with the `vocabulary` registry descriptor.
- Kept Assign, Review, and Quizzes as page-owned workflow modes. Vocabulary Editor, Quiz Maker, legacy Word Hunt/Quiz URLs, drilldown query fields, lazy imports, and feature contracts remain with their existing owners.
- Extended the browser page workflow to verify normal Vocabulary entry, canonical URL, active view/navigation labels, Assign reset/load behavior, a direct full-drilldown Review URL, and Back restoration.
- Verification passed for 76 focused checks, the primary-page, Word Hunt, and Quiz browser workflows, a production build, bundle/deployment guardrails, and scoped diff validation. Added exact legacy Word Hunt parse/build assertions; independent reviews approved the final boundary.
- Recorded pre-existing route lifecycle issues for Task 21, including duplicate `popstate`/`hashchange` Back dispatch, cold lazy subfeatures finishing after newer navigation, and route-driven Assign/Editor work suppressing a newer direct UI route write. The identity substitutions do not change those behaviors.

Task 20 remains in progress.

### Task 20c, migrate Sparks

- Replaced duplicated teacher Sparks primary page IDs and view IDs in the shell, router, lazy feature adapter, and Overview shortcut with the `sparks` registry descriptor.
- Preserved the lazy `showSparksView()` boundary, modal template mounting, repository/cache/editor behavior, feature key, and the separate student Sparks route.
- Extended the page browser workflow for normal entry, canonical URL, visible view, active navigation labels, direct routing, and Back restoration. The dedicated Sparks lazy browser workflow continues to verify the real feature factory, loading, modal, persistence, disposal, and listener behavior.
- Added exact teacher route parse/build/current-view assertions. All 41 focused checks, both page/Sparks browser workflows, the production build, bundle guardrails, scoped diff validation, and independent review pass. The Sparks feature remains a separate 34.57 kB raw / 9.15 kB gzip chunk.

Task 20 remains in progress.

### Task 20d, migrate Students

- Replaced duplicated teacher Students primary page IDs and view IDs in the shell, router, Student Progress page owner, and Overview shortcut with the `students` registry descriptor.
- Preserved the eager `showProgressView()` workflow and its authentication, loading, roster/filter, pagination, error, and cleanup order. Shared roster capabilities used by Groups and Data Management, selected-student state, detail modals, coin/password actions, repositories, and data shapes are unchanged.
- Extended the primary-page browser workflow with the real production `showProgressView()` method and stubbed data capabilities. It verifies normal entry, one progress load, canonical URL, view/navigation labels, direct routing, and Back restoration without duplicating the changed activation method.
- Added exact teacher route parse/build/current-view assertions. All 43 focused checks, the primary-page browser workflow, production build, bundle/deployment guardrails, scoped diff validation, and independent review pass.
- Review exposed a pre-existing account-isolation gap: session reset does not clear the newer paginated roster cache/filter state or invalidate its requests. It is not caused or worsened by this identity-only change and will be the next separate reliability fix so its behavior and tests remain independently reviewable.

Task 20 remains in progress.

### DONE — Immediate reliability fix, isolate Student Progress across teacher accounts

- Completed the session reset for paginated progress pages, filters, timers, full/identity/detail caches, selections, and load state. Page and filter generations now invalidate late successes and failures before they can cache or render prior-account data.
- Session cleanup synchronously clears desktop/mobile roster output, pagination/status, filter controls, bulk selection UI, CSV status/input, Student Detail content (including temporary passwords), and Add Student form/password visibility. Both student modals close without restoring focus into old account context.
- `showProgressView()`, Add Student, CSV import, password reset, coin actions, and late-work overrides now stop account-bound continuations after session invalidation. Student-specific modal callbacks also verify the active student, and multi-account CSV/bulk loops stop scheduling new RPCs.
- Added focused reset/race contracts covering cache reuse, shared requests, late page success/failure, late filters, queued debounce, chained page loading, rendered/modal scrubbing, late account creation, same-ID detail ordering, same-student password ordering, coin/late-work callbacks, CSV cancellation, and bulk cancellation.
- All 33 focused Student Progress checks, the complete regression suite, production build, and scoped diff validation pass. The build remains 2,329 modules and 13.5 MB; three independent reviews approved the corrected account-isolation contract.

The next reliability check covers feature-local Data Management roster state discovered during the same account-boundary review; it remains a separate commit.

### DONE — Immediate reliability fix, isolate Groups across teacher accounts

- Made a disposed Groups facade terminal and added separate lifecycle/show generations. Concurrent roster/restriction loads are latest-wins, and success or failure from a disposed context cannot repopulate shared DOM.
- Cleared Groups-owned roster, class, absence, restriction, generated-group, status, and control state during disposal. The lazy owner still recreates a fresh context for the next account; the public `{ show, destroy }` interface and lazy chunk remain unchanged.
- Guarded deferred restriction creates/removals and clipboard feedback so completed old-account operations cannot mutate the new context. Already-dispatched repository writes remain governed by the existing server authorization boundary.
- Scoped daily absence storage by teacher identity and normalized both `uid` and `id` for local ownership. Old unscoped absence keys are intentionally not read across accounts.
- Extended the browser workflow to prove terminal disposal, complete DOM scrubbing, teacher-scoped storage, latest-show ordering, stale restriction-save suppression, and a real lazy-adapter/shared-roster account switch in which late account-A data cannot replace account B.
- `npm run test:teacher-groups`, related Student Progress/page/build-efficiency checks, the complete regression suite, production build, and scoped diff validation pass. Three independent reviews approved the contract. The Groups lazy chunk remains separate at 18.50 kB raw / 5.33 kB gzip; total delivery remains 13.5 MB.

### DONE — Immediate reliability fix, clear Data roster controls on account disposal

- Confirmed that Data-owned request generations already suppress late dashboard, roster, export, preview, and file results. The remaining roster leak was rendered control state: account A's dashboard/export grade options and student-selection radio remained visible until account B loaded or indefinitely after a B load failure.
- Extended the existing Data destroy boundary to restore the dashboard grade filter, export grade selector, default all-students selection, loading copy/progress, and export status copy. This also ensures account B's first analytics request cannot inherit account A's selected grade.
- Added an idempotent destroy contract that seeds account-A values, verifies canonical blank/default state, recreates an account-B feature, and proves its first dashboard query uses the all-grades filter.
- All 18 Data composition/efficiency checks, the real lazy-feature browser workflow, related Progress/Groups/build/style checks, the complete regression suite, production build, and scoped diff validation pass. Independent review approved the corrected reset-state contract. The Data lazy chunk remains separate at 45.14 kB raw / 10.95 kB gzip; total delivery remains 13.5 MB.

### DONE — Immediate reliability fix, isolate Settings across teacher accounts

- Added one settings-session generation shared by Subjects, Coins, and School Calendar operations. Load/save continuations check both that account generation and any owning Data/auth lifecycle guard before mutating manager state, shared controls, notifications, or follow-on requests.
- Account replacement, null auth, explicit sign-out, and Data Management disposal now clear loaded flags, subject/calendar state, transient timers, status copy, manager lists, selectors, calendar fields, and save-button state. The exchange-rate control restores the centralized economy default rather than retaining the previous account or becoming blank.
- Preserved independently authorized server writes. A write already dispatched before account invalidation is not rolled back client-side; its stale continuation is suppressed, and Calendar does not start vocabulary metadata or placement work afterward.
- Removed the unawaited post-subject-save library reload. The existing cache invalidation remains the authority, so the next owning view reloads through its normal lifecycle instead of launching an unguarded background continuation.
- Fixed a same-session race in the Coins status timer: each new save cancels the prior success timer before publishing `Saving settings...`, so old delayed UI work cannot clear a newer pending or failed result.
- Added focused contracts covering all three delayed account-A loaders versus account B, canonical control cleanup, the Coins timer race, Calendar follow-on suppression, and all auth exit-path wiring. All 23 focused checks, the real lazy-feature browser smoke, the complete regression suite, production build, and scoped diff validation pass; independent review approved the corrected timer and account-isolation contracts. The build remains 13.5 MB with 2,330 modules, and Data Management remains lazy at 45.31 kB raw / 11.00 kB gzip.

Task 20 remains in progress. Groups is the next primary page migration.

### Task 20e, migrate Groups

- Replaced duplicated Groups primary page IDs and view IDs in the shell, router, lazy feature adapter, and both Overview shortcuts with the `groups` registry descriptor.
- Preserved the frozen `{ show, destroy }` feature interface, lazy import, roster capability, teacher-scoped absence/restriction state, direct URL, navigation label, and account-isolation lifecycle.
- Extended the primary-page browser workflow for normal Groups entry, canonical URL, visible view, active navigation labels, direct routing, one feature load per entry, and Back restoration. The dedicated Groups browser workflow continues to exercise the real lazy adapter and feature factory.
- Added exact route parse/build/current-view assertions and updated shortcut ownership contracts to follow the registry authority.
- Focused page, Groups, routing, lazy/build, scoped diff checks, the complete regression suite, and production build pass. Two independent reviews found no blocker. The build remains 13.5 MB with 2,330 modules; Groups remains lazy at 18.50 kB raw / 5.33 kB gzip.

Task 20 remains in progress. Data is next; it shares a view and lazy feature with Settings, so only its primary area identity should migrate in that commit.

### Task 20f, migrate Data

- Replaced duplicated Data primary page IDs and the shared view activation ID in the shell, router, lazy adapter, Overview Export shortcut, and Students Analytics shortcut with the `data` registry descriptor.
- Preserved the shared Data/Settings view contract. Shell and routing still inspect the current route before selecting an active primary tab, retain Settings as the non-Data fallback, and keep the legacy `data-settings` alias with tab-based area selection.
- Preserved route reservation before cold lazy loading: normal entry writes the requested Data route first and calls the feature with `updateRoute: false`, so its existing stale-route guard can reject an import that finishes after navigation changed.
- Kept feature-internal `area`, tab, section, and DOM strings local to Data Management. Those values describe the feature's two-area workflow and are not a second primary-page registry.
- Extended public route assertions for Data build and legacy alias behavior. Extended the primary-page browser workflow for normal Dashboard entry, explicit Export deep link, shared-view labels/tab state, one feature call per entry, and Back restoration. The dedicated Data browser workflow remains the real lazy/template/lifecycle proof.
- Focused page, Data, Progress, routing, lazy/build, scoped diff checks, the complete regression suite, and production build pass. The build remains 13.5 MB with 2,330 modules; Data Management remains lazy at 45.31 kB raw / 10.99 kB gzip.

Task 20 remains in progress. Settings is the final primary page migration.

### Task 20g, migrate Settings

- Replaced duplicated Settings primary page IDs in the shell, router, and Overview shortcut with the `settings` registry descriptor.
- Preserved the intentional shared Data/Settings view. Shell and routing still use the current route to choose the active primary navigation item, Settings still defaults to Subjects, Data still defaults to Dashboard, and the legacy `data-settings` alias still selects its area from the tab.
- Kept feature-owned Settings area, tab, section, copy, and DOM strings inside Data Management. They describe the shared feature workflow rather than duplicate top-level page metadata.
- Extended public route assertions and the primary-page browser workflow for normal Subjects entry, a direct Gamification route, the shared view with Settings labels, one lazy feature activation per entry, and Back restoration.
- Focused page, Data Management, routing, and build-efficiency checks pass. The complete regression suite, 9-width student shell, three-page UI smoke, 13 sandboxed games, production build, and scoped diff validation pass. Two independent reviews found no blocker. The build remains 13.5 MB with 2,330 modules; Data Management remains lazy at 45.31 kB raw / 10.99 kB gzip.

Task 20 is complete. All seven primary teacher pages now use the page registry. Task 21 will remove only duplicated navigation wiring proven obsolete; feature-owned routing details and the intentional shared-view distinction remain in place.

### Task 21a, remove proven duplicate navigation wiring

- Removed the teacher `popstate` route listener and retained `hashchange` as the single history authority. Sparks writes every teacher route as a hash entry, and Chromium proved that Back previously emitted both events and applied one route twice.
- Replaced copied one-to-one view-to-page comparisons in the shell and current-route serializer with lookup through the frozen page descriptors. Vocabulary editor/Quiz Maker ownership and route-based Data/Settings disambiguation remain explicit before the generic lookup.
- Kept direct page dispatch and route restoration separate. Their Vocabulary reset/restore and Data route-reservation semantics differ, so a shared handler map or loader-bearing registry would add coupling and change behavior.
- Added a source contract preventing a second teacher route event listener and a browser assertion that one Back traversal loads Overview exactly once. Added reverse-mapping coverage for Overview and the unknown-view fallback; existing assertions cover all other primary and shared views.
- Focused page, routing, Data, Groups, Sparks, Quiz, Word Hunt, and lazy/build checks pass. The complete regression suite, 9-width student shell, three-page UI smoke, 13 sandboxed games, production build, and scoped diff validation pass. Two independent reviews found no blocker. The build remains 13.5 MB with 2,330 modules.

Task 21 remains in progress. A separate, already reproduced route-intent race can let a cold lazy feature activate after a newer direct navigation; it requires lifecycle invalidation rather than merging the intentionally different dispatch paths.

### Task 21b, invalidate stale lazy page navigation

- Added a teacher navigation generation token bound to the authenticated owner. Every direct primary-page intent reserves its canonical route before asynchronous loading, and account disposal invalidates all previously captured work.
- Guarded all manager lazy-feature entry points after import but before context creation. A stale cold import can no longer install listeners, request repository data, switch views, or surface an obsolete failure notification. Internal feature refreshes continue to call their owned contexts directly.
- Carried the same token through queued route application, so an older pending route cannot resume after a newer intent. The pending route and token are cleared together.
- Kept feature-owned nested routes explicit. Quiz reserves its generic mode, then replaces that reservation with its owned drilldown route; Chromium proves this creates one history entry rather than leaking the previous Assign drilldown or creating a phantom second entry. Re-selecting an already-active full Quiz route replaces its reservation, preserves the exact drilldown URL, and adds zero history entries. Review and Assign retain their existing Vocabulary route serialization.
- Added real lazy browser races for Groups to Overview, account A to account B, and cold Quiz to Review navigation. The stale Groups paths never invoke the roster capability or create a context, and the stale Quiz path never activates or requests its library after Review wins.
- Focused routing, Vocabulary, Quiz, Word Hunt, Groups, Data, page, and lazy/build suites pass. The complete `npm test` suite and production build pass; the build remains 13.5 MB with 2,330 modules. Three independent reviews approved the corrected lifecycle seam and scoped diff.

Task 21 remains in progress. The editor's own request continuation can still mutate Vocabulary state after a newer route, and a few direct UI controls bypass the primary navigation entry point. Those paths will be corrected separately so this lazy-feature contract remains small and testable.

### Task 21c, stabilize Vocabulary editor navigation

- Passed the active navigation/owner check from route application through editor restoration, cloud retrieval, and remote-file retrieval. Each async path now rechecks after every await and before committing vocabulary state, rendering Editor, changing cloud status, showing feedback, or falling back.
- Made `openTeacherVocabularyItem()` the one user-intent seam for both Vocabulary card renderers. It reserves the editor route, captures one navigation token, and passes that token through local, remote, or cloud loading without changing their repository or parsing behavior. A current failed remote/cloud selection now replaces that reservation with the exact prior library route.
- Guarded both FileReader import callbacks and new-vocabulary creation with the same navigation generation so an older import or pending page load cannot reopen Editor after a newer primary-page intent. The editor Back history path invalidates pending work before requesting browser traversal.
- Canonicalized the editor Back fallback and invalid deep-link recovery through the Vocabulary primary page. Invalid editor URLs are replaced rather than pushed, so reload and Back do not retry a missing ID. Removed three listener blocks whose Progress control IDs no longer exist anywhere in the shipped markup.
- Added direct contracts for stale success, stale rejection, FileReader invalidation, and failed direct remote/cloud selection, plus a Chromium workflow. A delayed local editor route resolved after Overview leaves the Overview URL/view and prior vocabulary state unchanged; a missing editor route returns to the Vocabulary root with zero new history entries.
- Focused Vocabulary, Data ownership, primary-page browser, routing, and lazy/build checks pass. The complete regression suite, 9-width student shell, three-page UI smoke, 13 sandboxed games, production build, and scoped diff validation pass. Two independent reviewers approved the bounded editor-navigation change after direct-failure and live-FileReader coverage corrections. The build remains 13.5 MB with 2,330 modules.

### Task 21d, isolate Vocabulary account and document state

- Added one focused Vocabulary session/document lifecycle owner. Account replacement, auth loss, and explicit sign-out invalidate pending work, detach an old save queue, clear caches and retained library/editor state, cancel owned timers, scrub the live word editor and breadcrumb DOM, and close the word modal before another teacher can use the shell.
- Guarded library requests by session, owner, and exact request identity. A late account-A request or superseded force refresh cannot populate the cache, clear account B's promise, render a stale library, change the Overview count, or resume route warming. Delete, image-preview, import, and editor continuations likewise recheck their relevant session/navigation/document identity.
- Replaced mutable delayed cloud saves with immutable save tickets. Debouncing is per document, repository initiation is serialized within the active session, only the newest ticket for a document owns cloud cleanup or local failure recovery, and UI/status timers require the active document and navigation. Cleanup detaches an unresolved prior-session queue so it cannot block the next teacher.
- Every path that replaces the active vocabulary now begins a document lifecycle, including New, import, library load, and Quiz restore/selection. This prevents one vocabulary's debounce from canceling another's save. Successful Publish finalizes automatic ID generation for the still-active document even if a newer autosave exists; overlapping failures preserve exactly the newest immutable snapshot locally.
- Preserved development mode: Publish and Save as New remain local-only. Removed the now-unused single-timeout and `saveToCloud` compatibility paths after the per-document ticket queue became the sole live save authority.
- Preserved the existing authenticated repository/RLS boundary and server-owned authorization. The device-global `teacher_vocab_library` draft key and shared cloud Vocabulary catalog are intentionally unchanged: changing their tenancy policy also affects student/calendar workflows and requires an explicit product/data migration decision. An already-dispatched account-A server write cannot be cancelled client-side; server ordering/tenancy remains intentional documented debt rather than a hidden client promise.
- Added focused contracts for exact DOM cleanup, same-ID A-to-B routing, library promise/cache ABA races, unresolved A versus B saves, immutable/serialized snapshots, debounce isolation, stale completion suppression, development publishing, cross-document failure recovery, overlapping publish/autosave failures and success, auth exits, and Quiz document commits.
- Verification passed for 22 Vocabulary tests, 26 Quiz/lifecycle tests plus its real lazy browser smoke, all seven teacher pages plus browser history/direct-route smoke, teacher progress/data suites, the complete regression suite, production build and delivery-size checks, and scoped diff validation. Three independent reviewers approved the final account, persistence, routing, and security behavior after the reproduced blockers were corrected.

Task 21 is complete. Top-level page identity, browser-history dispatch, route intent, editor restoration, and account-scoped Vocabulary continuations now have explicit authorities without turning the page registry into a routing framework.

### Task 22, analyze broad forwarding interfaces

- Mapped 60 `StudentManager` forwarding names, 141 `StudentActivities` delegates, 26 `StudentGames` delegates, all seven teacher lazy entries, and the 28-capability Quiz vocabulary-browser adapter to their callers and actual owners.
- Distinguished forwarding from the eager teacher method installers, which place implementations on the composition root rather than forwarding to another parallel object.
- Confirmed that the manager session, route, shell, listener, subject, auth, and progress bridges are live cross-component contracts. Direct child access would expose more implementation detail and increase change impact.
- Confirmed that the broad Student Activities boundary mostly coordinates 13 owned collaborators. A wholesale purge would replace stable domain calls with child-object reach-through rather than create cohesive use cases.
- Found one demonstrated deepening seam: Arcade listeners know lifecycle state and coordinate multiple low-level game operations. Task 23 will migrate one intent at a time into the existing lifecycle owner, beginning with relative game selection.
- Recorded a bounded high-confidence list of unused Student Activities and Student Games pass-throughs for Task 24. No method is removed from audit evidence alone; receiver calls and tests must be rechecked immediately before deletion.
- Preserved the teacher lazy use cases and exact Quiz adapter. A generic feature invoker or wrapper around the existing 28 methods would be weaker, not simpler. A shared Quiz/Assign model remains optional only if it can atomically replace those calls with a genuinely deeper DOM-free interface.
- Three independent read-only maps agreed that broad facade removal is unjustified and that Arcade intent ownership plus dead forwards are the smallest evidence-backed next changes. Full details and the verification matrix are in `docs/manager-facade-analysis.md`.

Task 22 is complete. Task 23 starts with the smallest Arcade listener intent and will not redesign the already-strong game registry or lazy loader.

### Task 23a, deepen Arcade selection navigation

- Added `selectAdjacentGame(offset)` to the existing `StudentGameLifecycle` and exposed that single use case through the lazy `StudentGames` boundary.
- Moved index wrapping plus the selection and leaderboard refresh sequence out of both Previous/Next global listeners. Listeners now request an intent and no longer know `currentGameIndex`, `gamesList`, or the two required render operations.
- Preserved the registry order, circular Previous/Next behavior, lazy `getGames()` boundary, selection UI, leaderboard selection, routes, persistence, and server access. An empty registry now returns without producing an invalid index.
- Added a direct lifecycle contract for backward/forward wrapping, refresh order, and the empty case. Added a listener ownership contract preventing low-level game state and render coordination from returning to those handlers.
- Verification passed for 16 Student Games tests, 6 Student Listener tests, 15 routing tests, and 11 build/lazy-loading checks. Scoped diff validation passed.

Task 23 remains in progress. The add-time path is next because it currently duplicates a complete asynchronous Arcade lifecycle inside the global listener; it will be migrated separately with failure and in-flight tests.

### Task 23b, own the Arcade add-time lifecycle

- Added `requestAdditionalTime()` to the existing game lifecycle and exposed that complete asynchronous intent through `StudentGames`.
- Removed the add-time listener's knowledge of the in-flight lock, queued-time cap, active game ID, server minute request, timer mutation, Arcade UI refresh, and policy-specific warnings. The listener now awaits one lifecycle use case.
- Preserved `StudentGameAccess.startMinute()` as the authenticated coin/formative-time authority. The lifecycle still requests exactly one server minute, uses the returned duration or established default, refreshes account/UI state only after success, and restores the button/timer state in `finally`.
- Preserved the ten-minute queue cap, warning copy, no-formative-work warning, thrown-error message, and immediate in-flight rejection. Removed the now-unused Arcade policy import from the listener.
- Added direct coverage for the cap, an actual overlapping request, game ID selection, returned duration, UI refresh order, null authorization result, thrown error, and lock cleanup. The listener contract prevents low-level add-time orchestration from returning.
- Verification passed for 17 Student Games tests, 7 Student Listener tests, 15 routing tests, and 11 build/lazy checks. Scoped diff validation passed.

Task 23 remains in progress. Exit-to-selection is the final demonstrated Arcade listener sequence; it will be migrated separately before deciding whether any other facade deepening has enough evidence.

### Task 23c, own the Arcade exit transition

- Added `exitToGameSelection()` to the existing lifecycle and exposed it through the lazy `StudentGames` boundary.
- Replaced the global Exit listener's low-level stop-plus-selection sequence with the named transition. Reused the same transition for game-over refusal, exhausted time, a missing descriptor, and a failed lazy game import.
- Preserved cleanup-before-selection order, score/timer/message-handler cleanup, canvas restoration, leaderboard refresh, warning behavior, and the separate policy path that stops a game before routing to required Units work.
- Added a direct transition-order contract and a listener ownership contract preventing the two low-level calls from returning to the handler.
- Verification passed for 18 Student Games tests, 8 Student Listener tests, 15 routing tests, and 11 build/lazy checks. Scoped diff validation passed.

The three demonstrated Arcade listener leaks are now localized. Task 23 will receive an architecture review before any additional facade change; route-owned page refresh orchestration will not be moved merely to reduce call count.

### Architecture review after Task 23a-23c

- Independent review approved all three lifecycle use cases and found real depth: callers provide direction, request time, or exit without coordinating game state, authorization results, cleanup, or multiple render operations.
- Confirmed that lazy loading remains in `StudentRouting`, server coin/formative-time consumption remains in `StudentGameAccess`, leaderboard policy remains in its owner, and the game registry remains unchanged.
- Kept Arcade page-entry refresh in routing. It owns gate redirects, lazy feature CSS, view/loading state, and one entry refresh; wrapping its three calls would add a one-caller pass-through and move route presentation knowledge into games.
- Kept Data's shared roster seam. Adding a private returned-roster cache solely to remove `getRoster` would create a second account-derived authority and new invalidation work.
- Kept the exact frozen Quiz browser adapter. All 28 capabilities are used, and grouping or nesting them would be cosmetic. A future DOM-free shared model is optional only if a demonstrated change-impact problem justifies atomic replacement.
- Focused review reruns passed 18 Student Games, 8 Student Listener, 15 routing, and 11 build/lazy tests. The complete regression and production build gates close Task 23.

Task 23 is complete. Task 24 will remove only pass-throughs whose receiver calls remain conclusively absent; it will not use facade size as deletion evidence.

### Task 24a, remove owner-only Student Activities pass-throughs

- Removed 13 schedule helpers and three progress-flow helpers from `StudentActivities` after exact receiver and dynamic-property tracing found no production or test caller through the parent facade.
- Preserved every implementation on its existing eager `StudentActivitySchedule` or `StudentActivityProgressFlow` owner. Internal schedule composition, unit scoring, preload selection, authentication, persistence, routes, and lazy activity loading are unchanged.
- Added an ownership contract preventing the 16 one-line wrappers from returning to the parent surface. An independent runtime review instantiated `StudentActivities` and confirmed the helpers remain callable on their owners.
- Verification passed for 140 activity tests, 15 routing tests, 11 build/lazy checks, the complete regression suite, 9-width student shell and three-page/game browser smoke, production build, scoped diff validation, and independent review. The build remains 13.5 MB with 2,331 modules; student entry JavaScript is 236.53/60.56 kB raw/gzip.

Task 24 remains in progress. Student Games candidates will be re-traced and removed as a separate change; broader StudentManager and teacher candidates remain unproven until their own caller and compatibility review.

### Task 24b, remove owner-only Student Games pass-throughs

- Removed four uncalled wrappers from `StudentGames`: score-monitor script construction, game restart, timer clear, and timer start. None was part of the tested stable public interface, and exact plus computed-property tracing found no repository caller through the facade.
- Preserved replay, launch, pause, stop, and cleanup behavior on `StudentGameLifecycle`; its internal calls still own restart and timer coordination. Preserved score-monitor construction on `StudentGameHtmlLoader`/`StudentGameScoreMonitor` without changing the sandboxed `postMessage` path used by live HTML games.
- Added an ownership contract preventing these four loader/lifecycle details from returning to `StudentGames`. Independent runtime verification confirmed all four remain callable on their eagerly constructed owners and found no lazy-loading or security boundary change.
- Verification passed for 19 Student Games, eight Student Listener, 15 routing, and 11 build/lazy tests; the complete regression suite, 9-width student shell, three-page/game browser smoke, production build, scoped diff validation, and independent review. Deployment remains 13.5 MB; the lazy Student Games chunk decreased from 39.73/10.55 kB to 39.47/10.52 kB raw/gzip.

Task 24 remains in progress. The small secondary StudentManager and teacher candidate list will receive one final source-and-runtime audit; uncertain or externally meaningful methods will be preserved and documented rather than removed.

### Task 24c, remove obsolete Student Manager bridges

- Removed the uncalled `joinGrade` manager property, registration handler, and route-reset bridge after exact, computed, HTML, listener, and global-surface tracing. Removed the two newly orphaned `StudentAuth` pass-throughs for join-grade parsing and registration submission.
- Preserved the actual join-link state and prefill logic on `StudentAuthUi`, direct registration validation tests, and the dormant UI implementation. Retiring that broader product surface is a separate auth/security decision; this change only removes unreachable forwarding layers.
- Preserved `resetSessionRouting()`, whose two live auth lifecycle callers own lazy Arcade cleanup plus route reset. `StudentRouting.reset()` remains directly tested as the lower-level route-state operation.
- Added negative ownership contracts so the removed bridges cannot silently return. The absence of registration controls, inline handlers, dynamic dispatch, and repository callers was independently verified; server/config signup restrictions and authorization-field protections remain the real security boundary.
- Verification passed for 11 Student Auth, 15 routing, nine shell-composition, and 14 security tests; the complete regression suite, 9-width student shell, three-page/game browser smoke, production build, scoped diff validation, and independent audit. Deployment remains 13.5 MB; student entry JavaScript decreased from 236.53/60.56 kB to 236.21/60.49 kB raw/gzip.

Task 24 remains in progress. The teacher audit identified one small alias/constants cleanup and a larger obsolete whole-progress read chain; they will be handled as separate atomic changes so the live paginated and identity-roster boundaries can be verified independently.

### Task 24d, remove obsolete teacher composition members

- Removed the unused `VOCAB_COLLECTION` manager property; `vocabularyRepository` remains the sole owner of the `vocabularies` table name and all persistence/RLS interaction.
- Removed the uncalled Vocabulary-owned `invalidateStudentProgressCache()` method. Live account cleanup remains with `clearStudentProgressSessionState()`, which invalidates generations, requests, roster/detail/page state, selection, and rendered account data rather than performing the deleted method's incomplete reset.
- Replaced the sole `deleteLocalVocab()` alias call with its existing `removeLocalVocab()` owner and removed the alias. The same validated local-storage filter/write and library-cache invalidation run, the click handler still refreshes the library, and cloud deletion remains separate and authenticated.
- Updated the Vocabulary ownership count and added a negative contract for all three obsolete names. Independent review confirmed exact persistence equivalence and no dynamic/global caller.
- Verification passed for 23 Teacher Vocabulary, 26 Quiz plus lazy smoke, 33 Teacher Progress, 23 Data plus lazy smoke, and 11 build/lazy tests; the complete regression suite, browser smoke, production build, scoped diff validation, and independent review. Deployment remains 13.5 MB; teacher entry JavaScript decreased from 182.35/49.03 kB to 182.12/48.97 kB raw/gzip.

Task 24 remains in progress. The final subtask will remove the independently proven dead full-progress request chain atomically from manager state through the service method, while preserving the bounded Students page, identity roster, details, analytics, export, Groups, and Word Hunt data paths.

### Task 24e, retire the obsolete broad progress read chain

- Removed the uncalled `fetchAllStudentProgress()` and `getStudentProgressData()` teacher methods together with their cache/promise state, cleanup writes, and post-provision/import invalidations. Removed the now-unreachable `supabaseService.getStudentsWithProgress()` loop that repeatedly fetched every summary page.
- Preserved the Students page's bounded 50-row `listStudentProgressSummaries()` path, the identity-only roster shared by Groups and Export selection, bounded batch Export/detail RPCs, dashboard aggregate, and Word Hunt's narrow review RPC. Provisioning and CSV import still force-refresh roster filters and the active paginated page.
- Strengthened the least-data contract to reject the retired whole-roster loop. Updated installer ownership counts and removed the obsolete shared-request test; account isolation remains covered for page, identity-roster, detail, filters, password resets, selection, and DOM cleanup.
- Exact and computed tracing plus independent review found no remaining production caller or dynamic capability path. Removing the broad callable read slightly narrows data exposure without changing RLS, authentication, export authorization, writes, or persistence.
- A two-day-old Sparks Vite process on port 8000 initially served stale modules to two browser smokes. It was stopped explicitly; both smokes passed on fresh ports and the subsequent complete suite passed from a fresh default server. No test harness change was retained.
- Verification passed for 32 Teacher Progress, 23 Teacher Data plus smoke, 13 Word Hunt plus smoke, 12 repository, three student-interface, 14 security, and 11 build/lazy tests; the complete regression suite, 9-width student shell, three-page/game browser smoke, production build, scoped diff validation, and independent review. Deployment remains 13.5 MB; teacher entry JavaScript decreased from 182.12/48.97 kB to 180.60/48.70 kB raw/gzip.

Task 24 is complete. The remaining manager and feature interfaces all have confirmed callers or intentional ownership/security value; no additional facade is removed based on method count alone. Task 25 will inspect legacy game-specific score/message behavior against the existing registry before changing the already-strong game architecture.

### Architecture review after Task 24a-24e

- Independent review found no capability, lazy-loading, data, persistence, security, or test-coverage regression across the five Task 24 commits. All removed names remain free of production and computed callers.
- Confirmed that deleting the obsolete broad-request test did not weaken live account-isolation coverage: identity roster, paginated page, detail, filters, password resets, selection, and DOM cleanup each retain current-path tests.
- Confirmed that the dormant registration UI implementation is intentional deferred auth/security debt, not a Task 24 compatibility shim or a reason to restore its dead manager bridges.
- The net series reduced callable surface and source without moving owner implementations or adding replacement abstractions. Task 24 remains closed.

### Task 25a, remove the dead host score monitor

- Deleted `StudentGameScoreMonitor`, its eager loader construction, and its unused loader pass-through. The class duplicated Radius Raid, Packabunchas, and SpacePi polling but `loadHTMLGame()` never called it.
- Preserved the live `legacy-score-bridge.js` asset loaded inside those three sandboxed games, including explicit desktop asset copying, cached legacy-global discovery, score messages, and game-over reporting.
- Removed Trapdoor's unused `frame.injectScoreMonitor` value; no loader read that property. Preserved descriptor-owned message type, frame, leaderboard capability, iframe source/type checks, numeric coercion, score saves, and cleanup.
- Did not introduce a generic descriptor formatter. Trapdoor is the sole structured status-text outlier, so a new callback interface would expose more surface than the one current condition. Host validation/save/lifecycle behavior likewise remains common host policy.
- Verification passed for 19 Student Games, 21 registry/parity tests plus activity-loader smoke, 14 security tests, package contracts, 11 build/lazy checks, 13 HTML-game sandbox smoke, the complete regression suite, production build, scoped diff validation, and an independent game integration map. The build drops from 2,331 to 2,330 modules; the lazy Student Games chunk decreases from 39.47/10.52 kB to 30.67/9.24 kB raw/gzip.

Task 25 remains in progress. SpacePi's lower-is-better direction is a genuine scalar game capability currently repeated in three host conditions; it will move to the descriptor next while database ordering enforcement remains independent.

### Task 25b, move leaderboard score direction into descriptors

- Added a validated `scoreOrder` descriptor field with the established descending default and SpacePi's ascending override. Replaced three `gameId === 'spacepi'` conditions in score admission, best-score comparison, and leaderboard query ordering with registry lookup.
- Preserved every game's previous client behavior: SpacePi still submits zero/negative values and keeps smaller observed scores; all other and unknown games reject nonpositive scores and use descending order. The existing server RPC independently hardcodes SpacePi ordering, accepts zero, and rejects negative persistence; no database authority moved client-side.
- Added a registry contract requiring `asc` or `desc`, asserting SpacePi's override and every other game's default. Independent runtime review exercised actual submissions and confirmed SpacePi zero/negative attempts plus Snake rejection.
- Kept Trapdoor metadata sanitization, progress text, and leaderboard row formatting as explicit host conditions. One structured outlier does not justify a broad callback interface. Kept legacy-global readers inside the sandbox bridge rather than leaking third-party implementation details into the host descriptor.
- Verification passed for 19 Student Games, 21 registry/parity tests plus smoke, repository/package/security/build checks, 13 HTML-game sandbox smoke, the complete regression suite, production build, scoped diff validation, and independent semantic review. Deployment remains 13.5 MB with 2,330 modules; the lazy Student Games chunk is 30.81/9.29 kB raw/gzip.

Task 25 is complete. The registry owns the game-specific scalar policy that the host legitimately needs, while live legacy extraction remains beside the sandboxed games that understand those globals. Task 26 will define and test the existing host/game message protocol without forcing internal game UI standardization.

### Task 26, define the live host/game protocol

- Added one small parser for the protocol all registered iframe games actually use: numeric score updates and terminal game-over updates. The host still validates the exact iframe source and each descriptor's exact message type before updating UI, saving a score, or invoking completion callbacks.
- Tightened payload validation to the persistence contract: scores must be finite numbers from zero through 100,000,000 and `gameOver` must be a boolean. Optional numeric progress fields must be finite; optional completion must be boolean. Malformed messages are ignored rather than coerced into a zero score or truthy completion.
- Preserved Basic Platformer's `attempts` metadata, Trapdoor's structured progress fields, every descriptor-specific message type, the separate capability-scoped vocabulary-storage channel, callback timing, listener cleanup, and lazy loading.
- Did not add `ready`, `status`, or `error` abstractions because source and runtime tracing found no registered game sender or host consumer for them. The protocol documents current behavior rather than creating speculative game requirements.
- Direct protocol tests cover representative progress and terminal payloads, incorrect message types, invalid scores, invalid completion flags, and optional-field sanitization. Existing host and sandbox tests continue to cover source checks, listener lifecycle, all registered HTML games, and their emitted message types.
- Verification passed for 20 Student Games tests, 21 registry/parity tests plus smoke, 14 security tests, package/build contracts, 13 HTML-game sandbox smoke, the complete regression suite, production build, scoped diff validation, and two independent reviews. Deployment remains 13.5 MB with 2,331 modules; the lazy Student Games chunk is 31.17/9.49 kB raw/gzip.

Task 26 is complete. Task 27 will strengthen registry/build contracts only where the existing tests do not already prove uniqueness, reachability, configuration validity, lazy loading, and copied-asset compatibility.

### Task 27, enforce source and production game contracts

- Extended the existing registry contract instead of creating a second registry or generic framework. Every descriptor must now have a kebab-case ID, non-empty card metadata, reachable cover art, a frozen launch contract, valid leaderboard/score-order policy, and mode-appropriate configuration.
- Each of the seven canvas loaders is executed only inside the test, where it must return a Promise, resolve its configured class export, and expose the `start` and `stop` lifecycle used by the host. Production code remains lazy; registry definition does not import a game.
- HTML descriptors must remain inside `js/games`, cannot traverse parent directories, must use an HTML entry, and must provide finite frame dimensions with a real boolean responsive flag. Leaderboard-enabled HTML games must provide a score message type. Existing sandbox smoke continues to navigate and isolate all 13 entries.
- Added a registry-driven post-build validator. It verifies all 20 copied cover files, all 13 copied HTML entry files, the Student Games dynamic entry, exactly seven game-owned dynamic imports, and every emitted lazy canvas chunk. All desktop web builds now fail immediately if registration and packaged output drift.
- Did not add a `defineStudentGameRegistry()` layer. The two private descriptor factories already own construction defaults, while the source and post-build contracts catch the demonstrated authoring failures without adding a second runtime path.
- Independent tracing confirmed a separate pre-existing offline limitation: the generated service worker does not precache cold game launches, and My Digital Garden uses remote media. Task 27 does not redefine offline product behavior; Task 35 will evaluate this evidence while preserving intentional lazy delivery.
- Verification passed for 21 registry/parity tests plus activity smoke, 20 Student Games, 14 security, 11 build/lazy checks, the complete regression suite, 13-game sandbox smoke, production build, scoped diff validation, and three independent source/runtime/build maps. The production validator reports 20 registered games and seven lazy canvas bundles; deployment remains 13.5 MB with 2,331 modules.

Task 27 is complete. Task 28 will review the existing Supabase boundaries without replacing the repository layer or adding interfaces before a concrete seam is demonstrated.

### Architecture review after Tasks 25-27

- Independent review approved the complete game series with no required change. All live iframe senders match their descriptor message type and the strict score/game-over payload, whose score ceiling matches the database RPC.
- Confirmed that iframe source validation, storage channels, sandbox isolation, listener cleanup, server-owned authorization, and all lazy-loading boundaries remain intact.
- The series removes the unused 185-line host monitor and three repeated SpacePi policy checks. It adds one cohesive pure parser and test/build contracts, with no compatibility shim, duplicate registry, eager game import, or broad interface.
- The concrete registry and manifest checks intentionally make a new dynamic import or game path an explicit architecture decision. A future sender/type static parity check is useful optional hardening, not a current runtime defect.
- Verification passed again through the full regression suite, all 13 sandboxed HTML games, 60 focused game/registry/build tests, and the production validator for 20 games and seven lazy canvas bundles.

### Task 28, review Supabase boundaries

- Traced authentication/session, activity progress, vocabulary, rewards, leaderboards, and Word Hunt assets from callers through repositories/adapters, browser storage, RPCs, RLS, Realtime, and Storage. Updated `docs/data-access-architecture.md` with the complete boundary and decision map.
- Confirmed that raw Supabase operations remain confined to nine domain repositories and the three `supabase*` adapter modules. UI, activities, games, managers, and lazy teacher features do not construct table queries or receive the raw client.
- Confirmed that the frozen `studentApi` forwarding surface is intentional: it prevents student modules from reaching `getClient`, teacher account provisioning, password reset, teacher rewards, or other broad service operations. It should not be removed merely because it delegates.
- Confirmed that vocabulary mapping/persistence, progress reads/Realtime, owner-bound progress writes, reward writes, score reads/writes, and private Word Hunt storage each retain their existing server/RLS authority. No repository replacement or generic interface is justified.
- Found two actionable boundary defects for Task 29: authenticated autosave can add calculated coins locally before the server accepts the result, and cached teacher-role recovery can open the shell after current server verification fails. The former can leave temporary inflated wallet state; the latter does not bypass RLS but can expose stale teacher UI/state.
- Routed the missing privileged-key format guard to Task 30, static client/server game-score parity to Task 29, and high-confidence dead/uncertain data methods to Task 36 after exact caller verification.
- Verification passed across repository, student API/auth, teacher progress/session, Word Hunt review, browser-storage, schema, RPC, and security contracts in two independent audits. No local or production Supabase was contacted; Docker-backed acceptance, lint, and advisors remain unavailable in this environment as previously recorded.

Task 28 is complete. Task 29 will add only the narrow test/security seams needed to fix the two confirmed boundary defects and parity gap; it will not wrap every repository or reorganize data code for symmetry.

### Task 29a, restore one authenticated reward authority

- Stopped both replayable and non-replayable activity autosave paths from adding calculated coins to a signed-in student's local wallet before the database accepts the result. A rejected event can no longer leave phantom activity coins in browser state.
- Preserved local score/evidence saving, debounce/coalescing, attempt timing, owner-bound offline queuing, payload settings, server reward calculation, and authoritative result application. Successful live or replayed RPC results still replace coin, XP, activity-earned, and progress state from the returned snapshot.
- Preserved immediate calculated coin rewards in intentional `authDisabled` mode, where no server authority exists. Tests cover that behavior for both replayable Matching and non-replayable Flashcards.
- Did not add a reward repository or rollback layer. A single mode guard removes the duplicate authority more clearly than compensating mutations after every failure path.
- Verification passed for 108 focused activity/progress tests, 76 Student Progress tests in independent review, the complete regression suite, 13-game sandbox smoke, production build, scoped diff validation, and independent semantic review. Deployment remains 13.5 MB with 2,331 modules.

Task 29 remains in progress. The next subtask will introduce only the auth seam required to test and eliminate stale teacher-role fail-open behavior.

### Task 29b, make teacher authentication explicit and fail closed

- Added one frozen teacher-auth capability containing only the authentication/session methods the teacher workflow actually calls. The auth installer accepts this capability for deterministic tests; it does not expose the raw Supabase client or teacher/data operations.
- Removed the teacher shell's cached-role fallback. A current profile request or allowlist repair must verify the teacher role before the shell opens; a verification failure now disposes lazy features, clears account-owned state, closes the shell, and shows the login view.
- Routed explicit sign-out through the same injected capability. Teacher auth lifecycle code no longer imports the broad service directly.
- Invalidated failed session initialization so a transient profile error is not cached as a completed same-account result. A retry for the same UID now performs a fresh verification and can recover.
- Preserved development auth mode, password and email-link flows, current role repair, route restoration, parallel settings loads, auth-event de-duplication, and repository/RLS security boundaries. Dormant auth methods remain for Task 36 reachability tracing rather than being removed speculatively.
- Verification passed through seven new auth-boundary tests, focused settings/Vocabulary/startup/build/security checks, the complete regression suite, nine-width student regression, three-page smoke, 13-game sandbox smoke, production build, scoped diff validation, and independent review. Deployment remains 13.5 MB with 2,332 modules.

Task 29 remains in progress. The next subtask will add a static parity contract between the independent game registry and the effective server score policy; it will not make client metadata authoritative for database security.

### Task 29c, enforce independent game score policy parity

- Extracted the existing effective-function/SQL-array parser into a focused test helper and reused it for both activity and game parity checks. It still fails on ambiguous definitions, computed arrays, signature drift, or a later function drop.
- Added an exact membership contract between the client registry's leaderboard-capable games and the latest effective private score RPC. The contract compares sorted sets so database authorization does not control Arcade display order.
- Added per-game direction parity: SpacePi remains the sole ascending/lower-is-better game; every other authorized leaderboard remains descending/higher-is-better.
- Found and removed four stale server-authorized IDs whose client descriptors explicitly have no score reporting: `black-hole-square`, `glitch-buster`, `callisto`, and `js13k2021`. A CLI-generated migration changes only the private RPC allowlist; it does not delete historical score rows, alter game availability, weaken identity/range/metadata checks, or change the public wrapper and grants.
- Kept the registry and SQL independently authoritative. The test detects drift without importing browser configuration into database security code.
- Verification passed through 22 registry/parity tests and registry smoke, 61 focused game/repository/security tests, the complete regression suite, nine-width student regression, three-page smoke, 13-game sandbox smoke, production build, scoped diff validation, and independent migration review. Local migration application remains unverified because the local Supabase database cannot connect; static effective-migration checks pass. Deployment remains 13.5 MB with 2,332 modules.

Task 29 is complete. No generic repository wrapper, service container, or read/write reshuffle was added because the existing repository and student capability boundaries already protect meaningful ownership and security seams.

### Task 30a, reject privileged browser keys

- Extended the existing shared Supabase configuration validator instead of adding a second build-only policy. Runtime overrides and Vite validation now use the same privileged-key decision.
- Rejects current `sb_secret_...` keys, explicit service-role values, and legacy JWT keys whose payload role is `service_role`. Current `sb_publishable_...` and legacy anonymous JWT keys remain valid browser credentials.
- Build validation rejects privileged keys for every command and even when missing configuration is intentionally allowed. A secret cannot reach a development browser through the looser missing-config escape hatch.
- Preserved publishable/legacy-anon compatibility, browser test overrides, placeholder handling, production-in-development protection, and all backend-only service-role environment paths.
- Verification passed for 23 focused configuration/auth/security tests, production build, and scoped diff validation. The implementation follows current Supabase guidance that publishable/anon keys are browser-safe while secret/service-role keys bypass RLS and belong only in backend components.

Task 30 remains in progress. The next subtask will remove the duplicated production project reference/URL authority used by the planner while preserving CLI project metadata and environment overrides.

### Task 30b, consolidate hosted project identity

- Added one exported hosted production project reference and derive the browser production URL from it. The reference and URL can no longer drift inside runtime configuration.
- Removed the hardcoded hosted project reference and URL from the planner. Its existing Node-dependent remote-key fallback imports the shared reference, honors explicit `REMOTE_SUPABASE_PROJECT_REF` and `REMOTE_SUPABASE_URL` operator overrides, and otherwise derives the hosted URL.
- Kept `supabase/config.toml` independent because its `project_id` names the local CLI/container stack, not the hosted production project. A reviewer caught and rejected an initial false parity rule before commit.
- Kept CI secrets, ignored `.env.local`, browser test overrides, Edge Function secrets, maintenance service-role variables, and CSP host patterns separate because they are deployment inputs, server-only credentials, or transport policy rather than duplicate hosted identity authorities.
- Verification passed for planner shell syntax/help execution, direct Node import, six configuration contracts, focused auth/security tests, production builds, scoped diff validation, and independent review.

Task 30 is complete. No GitHub Pages URL was invented because no checked-in production site destination exists.

### Phase 0, baseline

- Confirmed a clean Sparks-scoped worktree on `main` before creating the remediation branch.
- Ran the complete existing automated suite and the separate student design audit.
- Rebuilt `dist-desktop` and recorded raw, gzip, deployment, and service-worker metrics.
- Ran the built-page smoke test against a fresh production build and found no high-severity dependency advisories.
- An independent import-graph check found no cycles across 215 first-party modules and 494 imports.
- An independent full-suite run saw one Vite development WebSocket refusal during the student-shell test. Its immediate isolated rerun passed. The primary full-suite run also passed. Treat this as a test-runner flake to watch, not an application baseline failure.
- Local Supabase acceptance, lint, and advisor checks remain unknown because Docker is not running. Authenticated production checks also remain outside this credential-free baseline. Existing source-level database, security, and repository tests passed.
- Chose the existing `studentActivityRegistry.js` as the activity-catalog seam. Creating a second catalog would introduce the duplicate authority this remediation is meant to remove.
- Confirmed that all 12 activity modules are dynamic Vite entries. Catalog work must preserve that build property.

### Task 1, activity catalog foundation

- Added each teacher activity setting key to the existing activity registry.
- Derived teacher activity options, IDs, labels, order, and setting-key lookup from that registry. The duplicate 12-entry teacher list is gone.
- Kept launch factories, activity flow defaults, routes, persistence, and SQL unchanged.
- Did not move the unused client XP map into the registry. Supabase calculates rewards and the client displays the returned total delta, so copying the map would create a false reward authority.
- Preserved lazy loading. The production manifest still keeps teacher feature imports separate and the build stays at 15.1 MB.
- Independent review found zero cycles across 288 first-party JavaScript files and 523 resolved imports. The teacher entry kept its five existing lazy features and gained no eager activity implementation imports.

### Task 2, activity catalog validation

- Added a pure registry definition function that clones, defaults, validates, and freezes activity descriptors.
- Rejects duplicate IDs and setting keys, missing copy or icons, invalid loaders and export names, unsupported routing, malformed policy values, and non-function activity lifecycle hooks.
- Rejects client `xp` fields, including `xp: undefined`, because rewards belong to the server.
- Added an explicit persisted ID-to-setting-key compatibility fixture. A derived projection alone would not detect an accidental stored-key rename.
- Added a Chromium smoke test that imports every lazy activity module and verifies its declared constructor. A Node-only test was rejected because real activity imports initialize browser-owned notification code.
- Preserved the 15.1 MB deployment limit and lazy feature build checks.

### Task 3, client/server activity parity

- Added a migration-order parity test for all three server-owned vocabulary activity allowlists.
- Targets the effective `private.assert_student_activity_access(uuid, text, text, text)`, `private.normalize_vocabulary_activity_flow()`, and `private.required_vocabulary_activities(public.vocabularies)` definitions by signature.
- Requires the server access list, server flow list, required-activity filter, and client registry to contain the same 12 IDs.
- Rejects ambiguous arrays, computed SQL expressions, duplicate IDs, overload mismatch, and a later drop of the selected function.
- Keeps classroom activity types and the weekly Spark reading flow out of this contract because they belong to separate systems.
- Does not compare XP. Reward amounts remain a separate server-only policy and the client registry rejects XP fields.
- An architecture review found the initially omitted required-activity filter before Task 4 was committed. Extending the contract prevents a newly registered activity from being silently removed when a teacher configures it as required.

### Task 4a, migrate Matching

- Added Matching eligibility, word preparation, and construction hooks to its catalog descriptor.
- The progress-flow eligibility check and launcher now dispatch to those hooks. Removed only the Matching cases from their legacy switches; all other activities remain unchanged.
- Kept the descriptor isolated from `StudentActivities`, `StudentManager`, persistence, and the activity implementation. The launcher passes narrow callbacks and the already lazy-loaded `ActivityClass`.
- Preserved teacher setting limits, least-practiced selection, saved word order recovery, constructor arguments, stale-state retry, callback guards, and coverage recording after successful construction.
- Added descriptor, hook-sequencing, and failed-constructor retry contracts. Coverage is proven to run exactly once after a successful retry.
- The production manifest still marks `js/activities/matching.js` as a dynamic entry. The student entry decreased from 263.88 kB raw and 68.28 kB gzip at baseline to 258.88 kB raw and 66.58 kB gzip; deployment remains 15.1 MB.
- Verification: the complete suite, 131 focused student activity tests, the 12-module browser loader smoke, production build, and built-page smoke all passed. The full suite includes routing, teacher activity flow, build ownership, 9-width student-shell regression, three-page UI smoke, and 13 sandboxed HTML games.

### Task 4b, migrate Flashcards

- Added Flashcards eligibility, ordered word limiting, and construction to its descriptor. Removed only its eligibility and launcher switch cases.
- Reused the constructor factory shared with Matching because both receive the same five arguments. Preparation remains activity-specific: Flashcards keeps source order and never calls coverage prioritization or host word-key restoration.
- Passed `playableWords` into the narrow preparation context. No descriptor receives a manager, repository, persistence service, or activity implementation import.
- Preserved mastery-v3 state, saved-state retry, first-attempt evidence, teacher-configured limits, `nonReplayable: true`, and `tracksCoverage: false`. A runtime contract proves Flashcards cannot record practice coverage through this path.
- Left the menu and persistence non-replayable lists unchanged for Task 5. Moving those authorities during a launch migration would combine separate concerns.
- Verification: 132 activity tests, 72 progress tests, registry browser smoke, routing, teacher flow, build-efficiency tests, and production build passed. The manifest keeps `js/activities/flashcards.js` as a dynamic entry; deployment remains 15.1 MB and the student entry is 258.81 kB raw, 66.56 kB gzip.

### Task 4c, migrate Quiz

- Added modern student Quiz eligibility, prioritized state-restorable word preparation, and construction to its descriptor. Removed only the Quiz cases from the launcher and progress-flow switches.
- Reused the word-and-definition eligibility predicate, the standard word-list constructor, and a focused restorable-priority preparation hook. This is shared behavior, not a wrapper around Quiz internals.
- Preserved the configured Quiz limit, saved `wordKeys` order, least-practiced fallback, constructor state, post-construction coverage, 80 percent mastery policy, verified attempt flow, and server-owned rewards.
- Confirmed the modern lazy `js/activities/quiz.js` activity is separate from the teacher legacy quiz subsystem. Task 7 must trace CSS and runtime reachability rather than removing files or selectors based only on the word `quiz`.
- Verification: registry and 12-module browser loader, 132 activity, 72 progress, 14 security, and 8 build-efficiency tests passed. Production build passed with Quiz still dynamic, a 15.1 MB deployment, and a 258.65 kB raw, 66.52 kB gzip student entry.

### Task 4 checkpoint correction

- The three-activity architecture review found that saved word restoration scans the full current vocabulary. Matching and Quiz could therefore restore stale words that their descriptors now reject as unplayable.
- Matching and Quiz preparation now supplies the same eligibility predicate to state restoration. Valid saved order is preserved; an invalid saved subset falls back to the normal prioritized playable words.
- Added a clear lifecycle contract error when a descriptor preparation hook does not return `{ words: Array }`. This replaces an incidental constructor or coverage failure with an actionable activity ID and contract message.
- Confirmed the current `prepared.words` coverage default remains correct only for ordinary word-list activities. Word Search and Crossword require an optional coverage selector before their migrations because they record constructor-filtered words.
- Verification: registry browser smoke, 133 activity, 14 routing, package ownership, and 8 build-efficiency tests passed. Production build remains 15.1 MB.

### Task 4d, migrate Synonym & Antonym

- Added Synonym & Antonym eligibility, filtered prioritized restoration, and construction to its descriptor. Removed only its launcher and progress-flow switch cases.
- Preserved the `synonymAntonym` teacher setting, least-practiced selection, saved word order, constructor state, post-construction coverage, multiple-choice evidence, server mastery rules, and report mapping.
- Applied the checkpoint eligibility rule to stale restoration: a saved word must still have a nonblank label and at least one synonym or antonym. Valid saved state is unchanged; invalid state falls back to prioritized eligible words.
- Did not change the existing sparse-data behavior. Vocabulary with too few distinct distractors can still reach the activity's owned “Not enough data” state; changing that would be a product decision rather than an architecture migration.
- Verification: registry browser smoke, 133 activity, 72 progress, 14 security, and 8 build-efficiency tests passed. The activity remains a dynamic chunk, deployment remains 15.1 MB, and the student entry is 258.34 kB raw, 66.47 kB gzip.

### Task 4e, migrate Hangman

- Added Hangman nonblank-word eligibility, prioritized limiting, and standard construction to its descriptor. Removed only its launcher and progress-flow switch cases.
- Preserved source eligibility, the `hangman` setting, least-practiced selection, constructor state, prepared-word coverage, internal shuffle, and Hangman's owned initial/local state restoration.
- Did not route Hangman through host word-key restoration. It intentionally restores its own `shuffledWords`, so adding a second restoration system would change behavior and ownership.
- Recorded an existing reliability edge for later focused work: Hangman's local storage key uses the prepared word count, while reset logic appears to use the full vocabulary count. This migration does not silently alter persisted-state cleanup.
- Verification: registry browser smoke, 133 activity, 72 progress, and 8 build-efficiency tests passed. Production build keeps Hangman dynamic, deployment remains 15.1 MB, and the student entry is 258.22 kB raw, 66.46 kB gzip.

### Task 4f, migrate Word Scramble

- Added Scramble to the shared nonblank-word, prioritized-limit, standard-constructor lifecycle. Removed only its launcher and progress-flow cases.
- Preserved the `scramble` setting, least-practiced selection, prepared-word coverage, constructor state, internal shuffled order, versioned state validation, edit-distance feedback, and server evidence rules.
- Reused the exact Hangman lifecycle hooks because their host behavior is identical. Scramble's game logic and persistence remain owned by `ScrambleActivity`.
- Recorded a parallel existing cleanup edge: Scramble's modern local key includes the first selected word and prepared count, while generic reset logic appears to remove an older count-only key. This requires a separate persistence test and is not silently changed here.
- Verification: registry browser smoke, the Scramble and runtime/security activity tests, 72 progress tests, and 8 build-efficiency tests passed. Production build keeps Scramble dynamic, deployment remains 15.1 MB, and the student entry is 258.09 kB raw, 66.43 kB gzip.

### Task 4g, migrate Wordle

- Added Wordle's alphabetic-label eligibility, filtered prioritized restoration, and standard construction to its descriptor. Removed only its launcher and progress-flow switch cases.
- Preserved spaces and hyphens, the 3-to-10 letter boundary after punctuation removal, the `wordle` teacher limit, least-practiced selection, saved word order, constructor state, and post-construction coverage.
- State restoration now uses the same descriptor eligibility predicate as fallback selection, so stale saved words cannot bypass Wordle's character and length rules.
- Kept Wordle's verified-attempt evidence, mastery rules, clues, keyboard behavior, and persistence implementation unchanged.
- Recorded existing persistence debt for a separate focused task: Wordle's local key uses the selected word count, while generic reset uses the full vocabulary count. Local fallback can also restore counters after incomplete word-key remapping. Neither behavior was silently changed during this architecture migration.
- Verification: registry browser smoke loaded all 12 constructors; 103 focused activity, progress, runtime, and security tests; 8 build-efficiency tests; and the production build passed. Wordle remains a dynamic chunk, deployment remains 15.1 MB, and the student entry is 257.60 kB raw, 66.31 kB gzip.

### Task 4 lifecycle contract hardening

- The second architecture checkpoint found that malformed descriptor output was treated like stale student state. The recovery path would reset saved progress and retry even though clearing state cannot repair a developer contract error.
- Descriptor preparation and factory-output failures now carry an explicit `ACTIVITY_DESCRIPTOR_CONTRACT` code. State recovery rethrows these failures without resetting or retrying, allowing the outer activity error boundary to fail safely while preserving progress.
- Factory hooks must return an activity instance before coverage is recorded or the timer can start. Registry validation also requires `isPlayable` whenever a descriptor owns `prepare` and `create`, preventing a registered lifecycle that the availability gate cannot reach.
- Added contracts proving malformed preparation preserves saved state, null factory output cannot record coverage, and incomplete lifecycle registration fails during definition.
- Verification: 90 focused registry/runtime tests, 135 student activity tests, registry browser smoke for all 12 activity constructors, 8 build-efficiency tests, and the production build passed. Deployment remains 15.1 MB and activity modules remain lazy chunks.

### Task 4h, migrate Speed Match

- Added Speed Match's nonblank word-and-definition eligibility, prioritized limiting, and standard construction to its descriptor. Removed only its launcher and progress-flow switch cases.
- Preserved the `speedMatch` teacher limit, least-practiced selection, constructor state, high-score behavior, verified attempt rules, minimum active-time requirement, post-construction coverage, and lazy module version suffix.
- Reused existing eligibility, preparation, and construction hooks because Speed Match has the same host lifecycle as the ordinary defined-word activities. Its animation loop, scoring, lives, feedback, and cleanup remain activity-owned.
- Recorded separate persistence debt: local high scores use only the selected word count, which can collide across units, and generic reset uses the full vocabulary count, which can miss limited or filtered selections. The existing tie copy can also announce a new high score without a strictly higher score. These product-level reliability fixes are not mixed into the descriptor migration.
- Verification: registry browser smoke, 135 student activity tests, 72 progress tests, 14 routing tests, 8 build-efficiency tests, and the production build passed. Speed Match remains a dynamic chunk, deployment remains 15.1 MB, and the student entry is 257.64 kB raw, 66.37 kB gzip.

### Task 4i, migrate Fill in Blank

- Added Fill in Blank's nonblank word-and-example eligibility, prioritized limiting, and standard construction to its descriptor. Removed only its launcher and progress-flow switch cases.
- Removed the launcher's redundant example filter. The shared playable-word input has already applied the same complete descriptor predicate before prioritization, so selected words and coverage remain unchanged.
- Preserved the `fillInBlank` teacher limit, least-practiced selection, constructor state, internal shuffle, clue rotation, retry behavior, score evidence, server verification, and post-construction coverage.
- Recorded separate latent reliability debt for focused tests: restored shuffled words and counters are weakly validated, regex metacharacters in a word are not escaped when building the blank, and local persistence uses inconsistent trailing-space keys. The checked catalog currently has valid examples containing their words and no regex-metacharacter terms, so this migration does not change product behavior.
- Verification: registry browser smoke, 135 student activity tests, 72 progress tests, 14 security tests, 8 build-efficiency tests, and the production build passed. Fill in Blank remains a dynamic chunk, deployment remains 15.1 MB, and the student entry is 257.41 kB raw, 66.32 kB gzip.

### Task 4 coverage selector contract

- Added one optional lifecycle hook for activities whose constructor filters the prepared input: `selectCoverageWords({ instance, prepared })`. Ordinary activities keep the existing `prepared.words` default.
- Registry validation rejects malformed selectors, selectors without a registered lifecycle, and selectors on activities that disable coverage.
- Runtime validation requires the selector to return an array. Contract failure destroys the just-created instance, records no coverage, preserves saved state through the existing non-recoverable descriptor error path, and never starts the activity timer.
- Added contracts for the unchanged default, constructor-selected coverage, invalid selector cleanup, and registry definition failures.
- Verification: 95 focused registry/runtime tests, registry browser smoke, 137 student activity tests, 8 build-efficiency tests, and the production build passed. Deployment remains 15.1 MB and activity modules remain lazy chunks.

### Task 4j, migrate Word Search

- Added Word Search eligibility, filtered prioritized restoration, special constructor mapping, and constructor-selected coverage to its descriptor. Removed only its launcher and progress-flow switch cases.
- Passed two narrow host inputs through the registered lifecycle: the stable vocabulary persistence ID and a guarded new-round callback. The descriptor maps them to Word Search's existing constructor without receiving a manager, repository, route object, or persistence service.
- Preserved the `wordSearch` limit, least-practiced selection, saved word order, grid persistence, current-launch guard, explicit state reset before a new puzzle, lazy loading, and post-construction coverage of only words actually placed in the grid.
- Unified fallback selection and saved-state restoration on the descriptor's trimmed four-character eligibility predicate, preventing stale whitespace-padded terms from bypassing the availability rule.
- Verification: registry browser smoke, 6 Word Search ownership/behavior tests, 138 student activity tests, 72 progress tests, 14 routing tests, 8 build-efficiency tests, and the production build passed. Word Search remains a dynamic chunk, deployment remains 15.1 MB, and the student entry is 257.80 kB raw, 66.43 kB gzip.

### Task 4k, migrate Crossword

- Added Crossword's ASCII-letter word-and-definition eligibility, prioritized limiting, standard construction, and placed-word coverage to its descriptor. Removed only its launcher and progress-flow switch cases.
- Preserved the `crossword` teacher limit, least-practiced selection, internal grid placement, constructor-owned state restoration, hint and score evidence, cleanup, and coverage of only the subset placed in the grid.
- Reused the standard constructor factory and prioritized preparation because Crossword's only special host behavior is its post-construction coverage source. The proven optional selector owns that difference without a Crossword-specific launcher branch.
- Recorded separate persistence debt: Crossword's local key uses only the selected word count while generic reset uses the full vocabulary count, so limited or filtered units can retain fallback state and equal-sized units can collide. This migration keeps the existing cloud/local behavior unchanged.
- Verification: registry browser smoke, 138 student activity tests including 11 Crossword behavior tests, 72 progress tests, 8 build-efficiency tests, and the production build passed. Crossword remains a dynamic chunk, deployment remains 15.1 MB, and the student entry is 257.55 kB raw, 66.33 kB gzip.

### Task 4l, migrate Illustration and close activity migration

- Added Illustration's nonblank eligibility, exact three-mode Word Hunt selection policy, special constructor mapping, and protected startup-reset policy to its descriptor.
- The launcher now builds one explicit Word Hunt feature context containing only source data and required callbacks. The registry receives no manager, repository, raw database client, or route implementation.
- Preserved raw-word selection before eligibility filtering, required-unit selection, custom flags including the legacy key, fallback limiting, owner-scoped draft state, image upload/load, PDF export, research context, and deep-link word changes.
- Replaced the hardcoded Illustration recovery exception with `allowStartupStateReset: false`. Flashcards remains non-replayable but retains ordinary stale-state recovery, so the two policies are not conflated.
- Removed the obsolete launch switch, eligibility switch, and `getWordHuntWords` forwarding path. Production registry contracts now require every activity to own eligibility, preparation, and construction.
- Independent review found that the generic validator still permitted descriptors without the now-mandatory lifecycle. Tightened registration to require `isPlayable`, `prepare`, and `create`, so incomplete descriptors fail before reaching a student session.
- Recorded separate reliability debt: Illustration starts its asynchronous `init()` from the constructor without awaiting or retaining the promise. Startup timing and error semantics are unchanged during this architecture migration.
- Verification: 18 registry contracts plus the 12-module browser smoke, 139 student activity tests, 9 Illustration tests, 14 routing tests, 5 report tests, 3 student API tests, 8 build-efficiency tests, the complete `npm test` suite, and the production build passed. Illustration remains a dynamic chunk, deployment remains 15.1 MB, and the student entry is 257.14 kB raw, 66.21 kB gzip.

## Remaining work

Task 4 is complete. Task 5 will verify and consolidate only duplicated configuration that still has more than one genuine authority.

### Task 5a, consume activity descriptor policies

- Removed hardcoded Flashcards/Illustration replay and coverage lists from autosave and the activity menu.
- Coverage aggregation now derives participating activity IDs from descriptors, and activity headers use descriptor titles instead of a second 12-item label map.
- Added an ownership contract preventing the known policy lists and title map from returning outside the catalog.
- Verification: 19 registry/parity contracts plus all 12 browser loaders, 139 student activity tests, 72 student progress tests, and 8 build-efficiency tests passed.

Task 5 remains in progress. The next verified duplicate is the activity-flow policy copied across student, teacher, and catalog tooling.

### Task 5b, centralize activity-flow and catalog policy

- Added a narrow shared activity-flow policy for purpose defaults, the ten-step practice rotation, replacement order, and stable rotation indexing.
- Student and teacher flow owners retain their existing public methods but delegate policy calculation to the shared pure functions; the duplicated arrays and algorithms were removed.
- Catalog tooling now derives IDs and word eligibility from the authoritative activity registry instead of maintaining a second 12-item list and eligibility switch.
- Server access remains independently authoritative. A parity contract now also compares the active SQL summative fallback and practice rotation with the shared client policy.
- Verification: all 146 vocabulary units and catalog SQL generation, 3 teacher flow tests, 20 registry/server parity contracts plus all 12 browser loaders, 139 student activity tests, 8 build-efficiency tests, and the production build passed. Activity modules remain lazy chunks; deployment is 15.1 MB and the student entry is 255.78 kB raw, 65.78 kB gzip.

Task 5 remains in progress. Next is the verified arcade/gamification configuration split, including removal of controls that currently save values no runtime uses.

### Task 5c, separate Arcade economy from activity rewards

- Added a focused gamification configuration module owning client setting keys, the Arcade exchange-rate default/range, and activity reward fallbacks.
- Student and teacher Arcade settings now normalize the displayed price to the server's `1..10000` range. SQL remains independently authoritative, with a parity contract for its fallback and clamp.
- Removed the global completion/progress controls because their saved values were never used by activity rewards. Per-vocabulary and per-activity reward controls remain unchanged and now share one resolver with autosave.
- Removed the vocabulary editor's second exchange-rate control because it wrote `activitySettings.exchangeRate`, which no runtime consumed.
- Verification: 15 student game tests, 73 student progress/security tests, 139 student activity tests, 11 teacher data tests, 4 teacher activity-flow tests, three-page UI smoke, 8 build-efficiency tests, and the production build passed. Deployment remains 15.1 MB and the student entry is 255.52 kB raw, 65.74 kB gzip.

Task 5 remains in progress. Next are smaller verified shared-data and environment authorities; installer destination remains deferred because the repository does not prove the release URL.

### Task 5d, centralize the student coin-data default

- Moved the initial coin-wallet shape to one neutral progress defaults module used by Supabase mapping, authentication fallback records, and student progress initialization.
- Kept synchronization timing constants in the student progress feature; they are behavior owned by that feature, not shared data shape.
- Verification: 12 repository tests, 73 student progress tests, 7 student authentication tests, and 8 build-efficiency tests passed.

Task 5 remains in progress. Next is Supabase build/runtime configuration authority, followed by remaining proven UI metadata and Arcade-duration copies.

### Task 5e, share Supabase build/runtime validation

- Extracted a pure Supabase configuration validator and reused it in runtime checks and Vite's build gate. The production project URL now has one client/build authority.
- Added contract coverage for missing values, placeholders, publishable and legacy anonymous keys, browser overrides, and refusal to use production from development without the explicit override.
- Replaced live-looking values in `.env.example` with onboarding placeholders. CI secrets and ignored local environment files remain deployment authorities.
- Kept service-role secrets, local Supabase CLI identity, and server security enforcement separate as required boundaries.
- Verification: 10 student authentication/config tests, 14 security-hardening tests, and the production build passed. Deployment remains 15.1 MB and the student entry is 255.46 kB raw, 65.73 kB gzip.

Task 5 remains in progress. Next is the student Arcade-duration policy and stale static game metadata.

### Task 5f, centralize Arcade duration policy

- Added one student Arcade policy for the billed minute, formative-pass window, and maximum queued session.
- Replaced duration literals in local storage, session clamping, game lifecycle, listeners, autosave feedback, and dynamically rendered Arcade copy. Static HTML now shows a neutral loading message until runtime policy is available.
- Kept the server allowance independently authoritative and extended its parity test to the shared client duration.
- Verification: 15 student game tests, 74 student progress/security tests, 139 student activity tests, 5 listener tests, three-page UI smoke, 8 build-efficiency tests, and the production build passed. Games remain lazy in `studentGames`; deployment remains 15.1 MB and the student entry is 242.48 kB raw, 62.17 kB gzip.

Task 5 remains in progress. Next is removal of stale static game metadata that the registry already replaces at runtime.

### Task 5g, remove stale static game metadata

- Replaced the hardcoded `22` game count and first-game leaderboard name in the student HTML shell with neutral loading text. Runtime already fills both from the game registry.
- Added an ownership contract preventing numeric game counts and the first registered game name from returning to the static shell.
- Verification: 21 activity/game registry contracts plus all 12 activity loaders, 15 student game tests, three-page UI smoke, and 8 build-efficiency tests passed.

The installer URL is intentionally deferred because changing a product download destination requires evidence the repository does not contain. Account-policy duplication is deferred to the authentication/data-boundary phase; navigation duplication belongs to the page-registry phase.

### Task 5 checkpoint review

- The complete test suite passed, including the 9-width student shell regression, three-page UI smoke, and all 13 sandboxed HTML games.
- Independent review found two misses before closure: remaining Arcade minute literals and an active production-development override in `.env.example`. Both were removed, ownership/config tests were added, and the focused game, progress, registry, and auth/config suites passed again.
- Task 5 is complete. Contextual report labels remain intentionally separate, SQL security/reward authorities remain independent, and no giant global constants module was introduced.

### Task 6a, remove the dead client XP reward mirror

- Removed `ACTIVITY_XP` and `getActivityXp`. Runtime completion displays the server-returned XP delta, the activity registry forbids client XP, and the only caller was a package test written solely for the unused map.
- Kept level thresholds and offline total-XP fallback behavior in `studentExperience`; those remain live through student progress rendering.
- Verification: package refactor checks, 75 student progress tests, 139 student activity tests, and 8 build-efficiency tests passed.

Task 6 remains in progress while independent traces check the audit's no-op store, save-system, utility, CSS, and asset candidates for actual reachability.

### Task 6b, remove obsolete client save stubs

- Deleted the unreferenced ZIP `SaveSystem`. It had no imports, script tags, tests, or build entry and depended on an undeclared `JSZip` global plus an obsolete image-store API.
- Removed `main.js`'s exported no-op `store`. No caller read it, and its TODO save/load methods explicitly deferred to the real backend and browser-storage owners.
- Added a focused ownership guard so the deleted `store` export form and `js/saveSystem.js` path do not quietly return.
- Kept active ZIP/PDF export code and browser activity persistence unchanged; this deletion removes no live persistence path.
- Verification: 9 build-efficiency tests, package refactor checks, 139 student activity tests, 5 report tests, three-page UI smoke, and the production build passed. Deployment remains 15.1 MB and the student entry remains 242.48 kB raw, 62.17 kB gzip.

Task 6 remains in progress. Independent traces have identified additional isolated CSS/build-asset candidates; each will be verified and removed as a separate coherent group.

### Task 6c, remove orphan delivery and generated artifacts

- Removed the unreferenced 1.51 MB PNG duplicate of the live continuation artwork. Student CSS uses the 29 kB WebP twin, now protected by a build-efficiency ownership test.
- Removed an unimported duplicate Inter stylesheet. The landing and application typography owners already bundle the same local font faces, and an existing contract prevents the old icon-loader dependency from returning.
- Removed two tracked Python bytecode artifacts with no source, import, script, or build role. No source scripts or runtime assets were removed.
- Verification: exact reference tracing, 10 build-efficiency tests, three-page UI smoke, and the production build passed. Deployment fell from 15.1 MB to 13.6 MB while entry chunks and the 18-file student offline shell remained unchanged.

Task 6 remains in progress. The remaining high-confidence candidates are isolated unused helpers and narrowly unreferenced CSS selectors; uncertain database-driven images and intentional game source artwork remain untouched.

### Task 6d, remove dead shared utility exports

- Removed `main.js`'s unused JSON cache/fetch helper and safe-async/error wrapper. Repository-wide tracing found no importer, caller, HTML handler, or global exposure; the error helper was referenced only by the dead wrapper.
- Kept the active notification service, modal helpers, password controls, and Lucide refresh behavior unchanged.
- These exports were already absent from production output through tree shaking, so this change reduces the source interface without changing delivered code.
- Verification: package refactor checks, 10 build-efficiency tests, three-page UI smoke, and the production build passed. Deployment remains 13.6 MB and the student entry remains 242.48 kB raw, 62.17 kB gzip.

Task 6 remains in progress. Next is the independently confirmed group of four isolated unused declarations; their owning modules and active siblings will remain intact.

### Task 6e, remove isolated unused declarations

- Removed four exports that occurred only at their definitions: the unused request abort classifier, local coin-authority duration, structured-writing alias, and stylesheet-ready marker.
- Preserved the request timeout implementation, three live progress timing constants, native writing checker, and the stylesheet side-effect module. The three lazy feature imports still load the shared CSS without exposing a false readiness API.
- Verification: package refactor checks, 75 student progress tests, 139 student activity tests, 10 build-efficiency tests, and the production build passed. Deployment remains 13.6 MB; the student entry decreased from 242.48/62.17 kB to 242.36/62.12 kB raw/gzip, and the empty stylesheet marker chunk disappeared.

Task 6 remains in progress. Remaining decisions are the tested-but-runtime-unused vocabulary compatibility exports and isolated CSS selectors; both require their own ownership checks before removal.

### Task 6f, narrow the vocabulary compatibility barrel

- Removed four vocabulary-loader exports with no production caller: two cache invalidators, the manifest-list convenience wrapper, and a cloud-list wrapper that duplicated repository access.
- Removed the cloud repository and subject-slug imports that existed only for the dead wrapper. The live manifest, file-loading, preload, caching, timeout, normalization, and repository paths remain unchanged.
- Updated the compatibility-barrel contract to describe the smaller real interface instead of preserving unused methods solely because a test listed them.
- Verification: 5 vocabulary API contracts, package refactor checks, 75 student progress tests, 139 student activity tests, 10 build-efficiency tests, and the production build passed. Deployment and entry sizes remain unchanged.

Task 6 remains in progress. Only CSS selectors with exact DOM/reference evidence remain before the full Task 6 checkpoint.

### Task 6g, remove obsolete Flashcards meter styles

- Removed four Flashcards study-meter selector families that no current or dynamically constructed activity DOM emits. Kept all live Flashcards panel/control styles and the matching, Crossword, and Scramble arms of grouped progress rules.
- Verification: exact JS/HTML selector tracing, 10 Flashcards behavior tests, package refactor checks, three-page UI smoke, and the production build passed. Shared feature CSS decreased by 0.41 kB raw and student CSS by 0.05 kB raw; deployment remains 13.6 MB.

Task 6 remains in progress. The final deletion group is three isolated teacher component selectors with no HTML, JavaScript, template, or runtime-ID owner.

### Task 6h, remove orphan teacher component styles

- Removed `.glass-panel`, `.back-link`, and `.runtime-pill` style families after exact source/template tracing found no element or dynamic class owner. Kept similarly named student theme variables and all live teacher status indicators.
- Verification: 11 teacher data tests, 8 teacher progress composition tests, 10 build-efficiency tests, three-page UI smoke, and the production build passed. Teacher CSS decreased from 149.89/24.40 kB to 149.14/24.27 kB raw/gzip.
- The optional local responsive harness remains unavailable because `supabase start` exits 1 in this environment, matching the recorded baseline Docker limitation; it is reported as unknown, not passed.

### Task 6 checkpoint review

- The complete `npm test` suite passed, including 9 viewport widths, all three page smokes, and 13 sandboxed HTML games. The production build passed with 2,323 modules, a 13.6 MB deployment, the 18-file student offline shell, and a 242.36/62.12 kB raw/gzip student entry.
- Independent review found no unsafe deletion, missed live caller, broken published interface, new coupling, or runtime regression. It confirmed that `package.json` is private, removed selectors have no dynamic owners, and live WebP/font/lazy-feature assets remain delivered.
- Database-driven vocabulary images, intentional game source/reference artwork, and intertwined responsive selectors were explicitly retained because repository evidence does not prove they are obsolete.

Task 6 is complete. Task 7 will trace legacy quiz reachability separately before any removal.

### Task 7a, remove the vocabulary import dependency on legacy quiz code

- Three independent traces and a real browser run confirmed two separate systems: the active routed/lazy Quiz Maker and a permanently hidden legacy preview modal. The student Quiz activity is a third independent system and remains out of scope.
- A valid vocabulary JSON import updated editor state and then called `manager.downloadForRepository`, a method trapped inside the lazy legacy feature context with no manager proxy. The call always threw and falsely displayed `Error parsing JSON file`.
- Removed only the orphan post-import call and its unnecessary async wrappers. Explicit JSON export and cloud publishing remain the owned vocabulary workflows; importing no longer triggers an unrelated repository-download prompt.
- Added an ownership contract preventing eager JSON import from depending on the lazy quiz feature.
- Verification: 7 teacher vocabulary-library tests, package refactor checks, three-page UI smoke, and the production build passed. Deployment remains 13.6 MB; teacher entry is 163.06/44.66 kB raw/gzip.

Task 7 remains in progress. Next, the unreachable modal, methods, listeners, proxies, state, and exclusively owned styles will be removed together while retaining the modern Quiz Maker and student Quiz contracts.

### Task 7b, retire the unreachable teacher quiz preview

- Source, build, and browser traces proved the old `#quiz-modal` started hidden and had no opener. Overview navigation and Create Quiz reached the routed, lazy `#quiz-maker-view`; the legacy opener existed only as a comment.
- Deleted the 468-line legacy method installer, hidden modal, duplicate/no-op listeners, modal setup, `currentQuiz` state, and `handleGenerateQuiz`/manager `printQuiz` lazy proxies.
- Removed only styles and print exclusions owned by the retired preview, including stale landing/student copies. Preserved `teacherQuizCoreMethods`, `teacherQuizBrowserMethods`, all `quizMaker*` modules, `teacherQuiz.css`, quiz routes/templates, and the student Quiz descriptor/activity/server contracts.
- Added a retirement contract that checks the active quiz owners and prevents the removed module, modal, state, proxies, and selectors from returning beside them. Independent post-diff review broadened this guard to scan the active quiz core, browser, and stylesheet owners.
- Verification: the complete `npm test` suite passed, including 146 catalog units, 139 activity tests, 21 registry/parity tests, 9 viewport widths, three-page UI smoke, and 13 sandboxed games. Focused teacher accessibility, source UI smoke, built UI smoke, package, and architecture suites passed; PostCSS parsing and independent review found no regression.
- Production build passed with 2,322 modules and the same 13.6 MB deployment. The active lazy teacher Quiz chunk decreased from 31.36/8.56 kB to 16.75/4.49 kB raw/gzip; teacher HTML decreased from 111.27/15.62 kB to 109.91/15.38 kB. The student Quiz remains a separate lazy 8.27/3.10 kB chunk.
- The local cross-browser harness remains unavailable because `supabase start` exits 1 without the baseline Docker service. Direct unauthenticated browser inspection reached the expected login boundary; no authenticated post-change session was available, so that specific path is recorded as unknown rather than passed.

Task 7 is complete. Task 8 will introduce a semantic token layer without changing the established visual identity.

### Task 8, introduce the semantic theme authority

- Added `css/theme.css` as the single application color-theme authority. It defines brand, on-brand, information, background, surface, raised surface, text, muted text, border, success, warning, danger, focus, and interactive-state contracts.
- Preserved the established landing/teacher palette as the shared default and the established Celestial student palette as a scoped `.student-site` variant. A recursive independent comparison confirmed every moved legacy palette and glow property resolves to its previous value.
- Moved legacy color aliases out of the three entry stylesheets and mapped them to semantic tokens in the central file. These aliases are intentionally temporary migration bridges for Tasks 9 and 10, not a second theme authority.
- Each Vite application entry now loads the theme once before page-owned styles. Embedded games and join redirects remain isolated; lazy student feature and teacher Quiz styles inherit the tokens without importing the theme or becoming eager.
- Added `test:theme` to the complete suite. Its ownership contract requires the semantic surface, scoped student variant, entry ordering, compatibility mappings, and removal of entry-owned palette aliases.
- Verification: the complete `npm test` suite passed, including 9 viewport widths, three-page UI smoke, and 13 sandboxed games. The student design-system audit, focused architecture/accessibility checks, and independent diff review passed.
- Production build passed with 2,323 modules and a 13.6 MB deployment. Student feature CSS and teacher Quiz CSS remain separate lazy assets; the generated student service worker precaches the themed student entry CSS. No native `color-scheme` behavior was introduced.

Task 8 is complete. Task 9 will migrate shared UI families one at a time, beginning with buttons, while preserving the compatibility aliases until their consumers are retired.

### Task 9a, migrate the shared button family

- Added `css/buttons.css` as the single structural owner for `.btn`, disabled behavior, primary/secondary/accent/danger/text variants, icon sizing, focus rings, and button SVG geometry. Student and teacher load it after the theme and before page-owned refinements; landing does not load unused button CSS.
- Removed the exact duplicated core from `student.css` and `teacher.css`. Preserved the later Celestial student overrides, typography/design-system sizing, responsive rules, teacher/Quiz Maker layout refinements, async `disabled`/`aria-busy` behavior, and every existing class name.
- Migrated shared button colors and the student primary/accent refinements to semantic tokens. The focus token now resolves to the exact pre-migration ring color, and the new accent foreground token preserves both shared white and student dark text.
- Kept non-button `.btn` consumers (`label` and `summary`) working. Did not absorb landing cards, password/close controls, activity-internal layout, `.btn-icon-only`, Quiz document controls, or embedded game buttons into the primitive.
- Added `test:buttons` to the complete suite. It guards stylesheet order, one structural authority, every live variant, semantic-token consumption, student overrides, and the absence of `!important` in the shared core.
- Verification: the complete `npm test` suite passed. The theme and student design-system audits, 9-width/6-view student regression, source and built three-page UI smoke, production build, and independent review passed.
- Independent headless-Chromium comparison found identical computed styles before and after for teacher and student variants, disabled primary, hover, focus, icon/SVG, `label`/`summary` consumers, and lazy Quiz Maker context.
- Production build remains 13.6 MB. The 1.47/0.63 kB raw/gzip shared button asset replaces duplicated entry CSS; teacher entry CSS decreased by 1.33 kB raw and student entry CSS by 1.32 kB raw. Lazy feature CSS remains separate.

Task 9 remains in progress. Task 9b will investigate and migrate shared input/form-control styling without changing feature-owned field layouts.

### Task 9b, migrate the shared form-control family

- Added `css/forms.css` as the structural owner for student and teacher form rows, broad controls, labels, placeholders, focus/readonly states, teacher select presentation, and the shared password field/toggle.
- Preserved student and teacher surfaces through low-specificity page scopes. The later Celestial refinements, typography/design-system sizing, responsive subject selector, Quiz Maker document controls, activity inputs, calendar/roster selection controls, and all validation/listener behavior remain with their current owners.
- Kept the existing broad native `input` behavior unchanged. Checkbox/radio/file/color separation is a demonstrated pre-existing risk, but changing native appearance requires a separate visual/behavior task and was not mixed into this architectural extraction.
- Migrated shared text, muted text, and password focus colors to semantic tokens where they resolve exactly. No `!important`, new validation state, DOM abstraction, or compatibility adapter was introduced.
- Added `test:forms` to the complete suite. It guards entry order, one family owner, page refinements, lazy feature exceptions, semantic color use, and all six password toggles' accessible runtime wiring.
- Verification: the complete `npm test` suite passed. Focused form/button/theme/design-system, auth, and accessibility tests; 9-width/6-view student regression; source and built three-page UI smoke; production build; and independent review passed.
- Independent headless-Chromium comparison against a clean `HEAD` archive found zero computed-style differences across student and teacher text controls, placeholders, focus, readonly, textarea, disabled select, password controls, checkbox/radio/file/color inputs, lazy activities, and lazy Quiz Maker document controls.
- Production deployment remains 13.6 MB. Shared foundation CSS is 5.33/1.38 kB raw/gzip; duplicated teacher entry CSS decreased by another 2.27 kB raw and student entry CSS by 1.73 kB raw. Lazy feature CSS remains separate.

Task 9 remains in progress. Task 9c will investigate the shared card family and keep activity/game-specific surfaces local.

### Task 9c, migrate the shared card family

- Added `css/cards.css` as the single structural owner for the generic `.card` surface and the reusable `.option-card` subtype used by landing choices and student vocabulary choices. All three app entries load it after theme foundations and before page-owned refinements.
- Removed the duplicated card, option-card, content geometry, hover, and focus rules from landing, student, and teacher entry styles. The shared owner consumes semantic surface, raised-surface, border, text, and focus tokens; no new compatibility alias or `!important` was introduced.
- Kept activity, menu, game, vocabulary, Spark, matching, Flashcards, Quiz Maker, responsive, and Celestial card behavior with the feature or page that owns it. Lazy student and Quiz Maker styles remain separate build assets.
- Added `test:cards` to the complete suite and updated the landing ownership check. The contracts guard entry order, one shared owner, semantic-token use, student refinements, and feature-owned Quiz cards.
- Verification: the complete `npm test` suite passed after the final semantic-token change. Focused card, landing, theme, and student design-system checks; 9-width/6-view student regression; source and built three-page smoke; production builds; and independent review passed.
- Independent headless-Chromium comparison against `68a1a91a` found zero settled computed-style differences and pixel-identical screenshots at desktop and mobile widths for landing cards, student login/vocabulary/current-game cards, teacher login/group cards, tabindex focus/hover states, and lazy Quiz Maker question cards.
- Production deployment remains 13.6 MB. Teacher entry CSS is 141.81/22.75 kB raw/gzip and student entry CSS is 221.69/33.78 kB; the 49.98/9.91 kB student feature CSS and 12.48/3.10 kB Quiz Maker CSS remain lazy.

Task 9 remains in progress. Task 9d will investigate shared dialogs and modals without merging activity-internal overlays or the Quiz Maker document surface.

### Task 9d, migrate the shared dialog family

- Added `css/dialogs.css` as the structural owner for the student and teacher app-shell backdrop, panel, header, footer, close control, hidden state, and close-control focus ring. Student and teacher load it after the other shared UI foundations and before page-owned refinements; landing does not load unused dialog CSS.
- Removed the exact duplicated desktop dialog core from student and teacher entry styles. Shared close-control text and focus colors now consume semantic tokens with values identical to the previous aliases/literal.
- Preserved student and teacher mobile differences, Student Detail and activity-preview sizing, typography roles, FIB and Spark Reading modifiers, completion overlays, and the lazy Quiz Maker rubric dialog. Existing responsive `!important` rules remain until their inline-width dependencies are addressed in Tasks 11 and 12.
- Added `test:dialogs` to the complete suite. It guards stylesheet order, one structural owner, semantic-token use, seven static dialogs' ARIA contract, the shared focus lifecycle owner, and feature-owned activity/Quiz dialog variants.
- Verification: the complete `npm test` suite passed, including 139 student activity tests, 6 Teacher Sparks tests, 9 viewport widths, three-page UI smoke, and 13 sandboxed games. Focused design-system and shared UI contracts, source and built UI smoke, production builds, and independent source/cascade review passed.
- Production deployment remains 13.6 MB. The shared foundation CSS grew from 5.33/1.38 to 6.33/1.60 kB raw/gzip while teacher entry CSS decreased to 140.87/22.57 kB and student entry CSS to 220.75/33.60 kB. Lazy student feature and Quiz Maker CSS remain separate and unchanged.
- Independent review found declaration-for-declaration equivalence and unchanged later precedence. Its browser runtime was unavailable, so authenticated modal screenshots and live computed-style inspection are recorded as unknown rather than passed. Source/built smoke and responsive shell checks passed.
- Investigation found a separate pre-existing bug: the lazy Teacher Spark editor's X and Cancel controls mount after the old generic click binding and are inert, although backdrop and Escape closing work. This will be repaired as a separate behavior task so the CSS extraction stays independently verifiable.

Task 9 remains in progress. Next is the focused lazy Spark dialog lifecycle repair, followed by the navigation family.

### Task 9e, repair the lazy Spark dialog close lifecycle

- Confirmed that the Spark editor template mounts only when the Teacher Sparks feature loads, after the eager generic close-button scan has already run. The editor's X and Cancel controls therefore had no click handler; backdrop and Escape closing still worked through `setupModal`.
- Bound exactly the two `#spark-modal .close-modal` controls during the feature's existing one-time lazy initialization. Both now call the established shared `closeModal` lifecycle rather than mutating classes or duplicating cleanup logic.
- Preserved save behavior: successful persistence still closes through the same lifecycle; validation and repository failures keep the editor open. The registered `onClose` continues to clear the editing ID, restore create mode, clear status, and return focus when an opener remains connected.
- Added a focused runtime test that mounts a modal lifecycle, proves both lazy controls receive click handlers, closes through the shared API, and verifies editor state reset. Independent review confirmed the feature initializer cannot duplicate listeners across repeated navigation.
- Verification: 7 Teacher Sparks tests, 11 lazy/build-efficiency tests, the dialog contract, the complete `npm test` suite, source and built three-page UI smoke, production builds, and independent review passed. Deployment remains 13.6 MB and the Teacher Sparks feature remains lazy.

Task 9 remains in progress. Task 9f will investigate the shared navigation family.

### Task 9f, migrate the shared navigation family

- Added `css/navigation.css` as the structural owner for the shared top-level tab shell, mobile menu control, tab list/items, and vocabulary-library breadcrumbs. Student and teacher load it after the other shared foundations and before page-owned styles; landing does not load unused navigation CSS.
- Removed the duplicated base declarations from `student.css` and `teacher.css` while preserving every responsive rail/sidebar rule, the student 1120/1121 transition, teacher 1180 compact behavior, collapsed states, feature tabs, segmented controls, and all route/listener code.
- Added a semantic `--color-link` role because student breadcrumbs intentionally use the Celestial secondary color while teacher breadcrumbs use the information color. Shared navigation otherwise consumes semantic text, muted text, border, and focus tokens; contextual translucent active/surface colors retain their exact existing values.
- Kept the existing teacher-named classes as the live student/teacher DOM contract and retained transitional breadcrumb selectors for the student and lazy Quiz renderers. No generic router, markup migration, compatibility adapter, or `!important` was introduced.
- Added `test:navigation` to the complete suite. It guards stylesheet order, one structural owner, semantic-token use, retained responsive ownership, top-level tab counts, tab semantics, and mobile `aria-expanded`/`aria-controls` wiring. The theme contract now includes the link role.
- Verification: the complete `npm test` suite passed, including the 1120/1121 student shell transition, three-page source smoke, and 13 sandboxed games. Focused navigation, theme, and student-shell contracts, built three-page smoke, production builds, scoped diff checks, and independent source/cascade review passed. The independent computed-style run found only font-dependent width differences because its baseline archive initially lacked Inter; the identical-font rerun was interrupted, so exact pixel equivalence is recorded as incomplete rather than passed.
- Production deployment remains 13.6 MB with 2,328 transformed modules. Teacher entry CSS is 138.66/22.30 kB raw/gzip and student entry CSS is 218.42/33.31 kB; lazy student feature and Quiz Maker CSS remain separate.

Task 9 remains in progress. Next is an architecture review of the recent shared-UI changes, followed by status/feedback styling.

### Architecture review after Tasks 9c-9f

- Independent review of commits `b03ff894`, `28829e0f`, `91158a6c`, and `62c7ff2f` found no blocker, high-confidence regression, new eager dependency, circular dependency, or unnecessary abstraction.
- Confirmed the shared card, dialog, and navigation owners remain narrow while page-responsive and lazy feature refinements retain later precedence. The Spark repair continues through the existing lazy initializer and shared dialog lifecycle.
- Confirmed the teacher/student breadcrumb compatibility selectors are still required by live renderers. They should be removed only when both emit the canonical typography classes, not replaced with another alias now.
- Optional test hardening remains: authenticated modal screenshots, an identical-font navigation pixel rerun, and a repeated Spark-view close-listener assertion. These are evidence gaps or defense-in-depth, not demonstrated product regressions.

No corrective task was added. Task 9 continues with the status/feedback family.

### Task 9g, migrate shared status and completion feedback styles

- Added `css/feedback.css` as the structural owner for cloud status dots and activity completion screens/overlays. Student and teacher load it after navigation and before page-owned styles; landing does not load unused feedback CSS.
- Removed the exact duplicated status and completion declarations from student and teacher entry styles and the duplicated completion sizing from lazy student features. Preserved the later Celestial synced glow, XP reward visuals, activity/game feedback, empty/loading states, inline form statuses, and both existing toast systems for Tasks 12-14.
- Migrated text, surface, border, success, and danger colors to semantic tokens without changing resolved values. The student completion surface is explicitly scoped to the raised surface, while teacher uses the base surface. The pending indicator remains `#fbbf24` because the current student warning token is `#ffc800`; changing it here would alter the established visual state.
- Kept `fadeIn` and `scaleIn` keyframes teacher-owned. Both entries already referenced those names, but only teacher defined them, so moving the keyframes into shared CSS would newly animate student completions. This asymmetric animation behavior is intentional preservation debt for a later product-level decision.
- Added `test:feedback` to the complete suite. It guards stylesheet order, one structural owner, semantic-token use, student and teacher refinements, status-state accessibility wiring, and representative completion producers without introducing a shared behavior abstraction.
- Verification: the complete `npm test` suite passed, including 139 activity tests, 9 responsive widths, three-page source smoke, and 13 sandboxed games. Focused feedback, theme, activity, and build-efficiency checks, built three-page smoke, production build, scoped diff checks, and independent review passed.
- Independent Chromium comparison against `c71cab13` at 390x844 and 1280x900 found zero computed-property differences and pixel-identical screenshots for student and teacher status states and completion overlays, including the real lazy student feature CSS path.
- Production deployment remains 13.6 MB with 2,329 transformed modules. Shared foundation CSS is 9.94/2.25 kB raw/gzip; teacher entry CSS decreased to 137.49/22.04 kB, student entry CSS to 217.39/33.10 kB, and lazy student feature CSS to 49.84/9.88 kB. Quiz Maker remains a separate lazy 12.48/3.10 kB CSS asset.

Task 9 remains in progress. Next is the shared container family, followed by the existing typography authority review.

### Task 9h, migrate shared container styles

- Added `css/containers.css` as the bounded owner for the landing/app shell bases, main surface, decorative shell layer, app header base, and shared vocabulary/activity collection grids. All three entries load it before their page stylesheet.
- Removed only declaration-identical bases from landing, student, and teacher CSS. Preserved login layouts, page panels, activity/game layouts, lazy feature grids, the student 1120/1121 rail, teacher sidebar geometry, all media queries, and feature-specific headers.
- Kept contextual translucent shell colors local to the container family instead of falsely mapping them to stronger surface/border tokens. Existing spacing and radius variables continue to resolve through each entry's intended scale.
- Added `test:containers` to the complete suite. It guards one shared owner and load order, excludes responsive/sidebar/auth concerns from that owner, verifies page refinements remain, and traces live collection producers across student, teacher vocabulary, lazy Quiz, and Word Hunt views.
- Verification: the complete `npm test` suite passed, including 9 responsive widths, three-page source smoke, and 13 sandboxed games. Focused container, landing, student-shell, and build-efficiency suites, built three-page smoke, production build, scoped diff checks, and independent source/cascade review passed.
- The independent before/after browser comparison was invalid because its baseline archive was empty after a path-prefix error; those results were discarded. Current Chromium rendered all three entries at mobile, 1120px, and 1121px, but exact visual parity is recorded as unproven rather than passed.
- Production deployment remains 13.6 MB with 2,330 transformed modules. Shared foundation CSS is 5.91/1.71 kB raw/gzip, teacher entry CSS is 135.99/21.81 kB, student entry CSS is 215.89/32.87 kB, and lazy student/Quiz CSS remains separate at 49.84/9.88 and 12.48/3.10 kB.

Task 9 remains in progress. The typography audit found the current shared authority sufficient; only duplicate font ownership will be removed next.

### Task 9i, consolidate typography ownership

- Kept the existing `css/typography.css` as the single shared typography authority instead of introducing another type system or mechanically moving 1,261 feature-specific declarations. Its semantic text roles and four Inter font faces remain the application contract.
- Removed the duplicate four-face Inter delivery from `landing.css` and the redundant base `body` font-family declarations from landing, student, and teacher styles. All three entries already load `typography.css` after their page stylesheet, so resolved typography remains unchanged.
- Preserved `student-design-system.css` as an intentional scoped Celestial refinement. The new contract distinguishes that page-owned override from shared font delivery and requires every entry to load the shared authority last.
- Strengthened the build-efficiency font check and added `test:typography` to the complete suite. The contracts require exactly one font owner, all four delivered weights, semantic typography roles, entry cascade order, and removal of duplicate landing font faces.
- Verification: the complete `npm test` suite passed, including 9 responsive widths, three-page source smoke, and 13 sandboxed games. Focused typography, build-efficiency, landing-responsive, and design-system checks, built three-page smoke, production build, scoped diff checks, and independent review passed.
- Independent Chromium comparison against `6141063f` found identical computed body/tab typography and byte-identical full-page screenshots for landing at 1440x900 and 390x844. The scoped student override remained effective.
- Production deployment remains 13.6 MB with 2,330 transformed modules. Landing CSS is 23.82/4.07 kB raw/gzip, teacher entry CSS is 135.96/21.78 kB, student entry CSS is 215.86/32.84 kB, lazy student CSS is 49.84/9.88 kB, and Quiz Maker CSS remains lazy at 12.48/3.10 kB. The build emits each Inter WOFF2 asset once; the service worker precaches 20 files totaling 1,029,760 bytes.

Task 9 is complete. Task 10 will replace only duplicated visual-identity literals in migrated/shared areas with semantic tokens and add a narrow regression guard.

### Architecture review after Tasks 9g-9i

- Independent review found no runtime blocker, eager dependency, cascade regression, or unnecessary abstraction. Task 9 remains correctly marked complete.
- Confirmed the four Inter faces have one owner, responsive/sidebar/auth layout remains page-owned, and lazy student/Quiz CSS stays in separate build assets.
- Found one real hidden style dependency: shared completion rules reference animation names whose keyframes are teacher-owned. Student animations are intentionally inert today. A focused behavior-preserving correction will move the animation declarations beside the teacher keyframes after Task 10 instead of making the keyframes global.
- Task 9h exact pixel parity remains unproven and is still documented as an evidence gap, not a passing result.

### Task 10, reduce literal brand colors

- Replaced canonical brand, information, accent, danger, and status hue literals in the migrated button, form, navigation, feedback, and landing foundations with semantic tokens plus `color-mix()` opacity. Cards, dialogs, containers, and typography contained no canonical identity duplicates.
- Added explicit shared status-color roles where the glow or pending color intentionally differs from the generic theme status token. This preserves the teacher success glow and keeps pending `#fbbf24` independent from the student warning color `#ffc800`.
- Migrated landing/teacher background identity gradients, shared brand-mark glows, both activity-summary meters, teacher export controls, and known generated authentication/data-viewer UI fallbacks. The inline layout styles remain for Task 12; only their duplicate color authority changed.
- Kept contextual game, activity, chart, subject, illustration, Celestial glass, and lazy Quiz palettes feature-owned. This is a narrow identity-color contract, not a global ban on CSS literals.
- Added `test:brand-colors` to the complete suite. It derives configured identity channels from `theme.css`, rejects direct duplicates in migrated foundations, requires the shared status roles, checks app-shell consumers, and prevents known application UI producers from recreating the default brand fallback.
- Independent Chromium review found student desktop and mobile screenshots pixel-identical against `e1edb2ef`. Teacher computed values differed only in equivalent browser serialization (`rgba(...)` versus `color(srgb ... / alpha)`), with identical channels and alpha; student overrides and both activity meter colors remained unchanged.
- Landing and teacher screenshot comparisons in the temporary baseline were invalidated by different font delivery, so exact pixel parity for those pages is recorded as unproven. Focused computed-color checks, the 9-width regression, and source/built route smoke passed.
- Verification: the final complete `npm test` suite, focused theme/brand/shared-UI/auth/data checks, student design audit, production build, and built three-page smoke passed. The build remains 13.6 MB with 2,330 transformed modules; student feature and Quiz Maker CSS remain lazy, and the service worker precaches 20 files totaling 1,030,502 bytes.

Task 10 is complete. Next is the focused completion-animation ownership correction found by the architecture review, followed by Task 11's evidence-based `!important` audit.

### Post-Task 9 review correction, localize completion animations

- Removed `fadeIn` and `scaleIn` declarations from the shared feedback foundation and placed them beside their teacher-owned keyframes. The student entry continues to have no completion animation, preserving the established behavior in both shells.
- Strengthened the feedback contract so shared CSS cannot depend on consumer-owned keyframes and teacher CSS must own both the declarations and definitions.
- Verification: the feedback contract, 9-width/6-view student shell regression, source and built three-page smoke, and production build passed. Deployment remains 13.6 MB with lazy student and Quiz Maker CSS separate.

The architecture-review correction is complete. Task 11 will now inspect `!important` declarations one component/viewport family at a time and remove only those proven unnecessary.

### Task 11a, remove redundant Quiz print specificity

- Inventoried 1,035 application `!important` declarations: 961 are concentrated in the layered student responsive shell, while the remaining declarations are split across teacher, lazy activity, Quiz, landing, and Arcade styles. This concentration makes a global removal unsafe.
- Removed the duplicate Quiz print `transform: none` declaration because the same selector already owns that value. Removed `!important` from the later same-specificity print `zoom: 1` reset; no runtime code assigns transform/zoom to live `.document-page` elements.
- Retained the four Quiz layout declarations that currently override inline gap, sidebar width, canvas padding, and canvas background in `teacher.html`. Task 12 can remove those after moving the owned inline layout styles.
- Added `test:specificity` to the complete suite. It keeps all shared UI foundations free of `!important`, proves the Quiz print reset uses normal cascade, and bounds the four known inline-dependent Quiz exceptions.
- Verification: focused specificity and build-efficiency checks, production build, and built three-page smoke passed. The lazy Quiz CSS decreased from 12.48/3.10 to 12.44/3.09 kB raw/gzip; deployment remains 13.6 MB and the Quiz bundle stays lazy.

Task 11 remains in progress while the smaller teacher-entry candidates are verified independently. The student shell's layered responsive overrides will not be changed without exact viewport evidence.

### Task 11b, simplify teacher dashboard and Word Hunt specificity

- Removed unnecessary importance from dashboard summary alignment and icon spacing. The owned `.data-summary-stat .teacher-stat-icon` selector already outranks the generic icon rule.
- Scoped the Word Hunt separator color to `.word-hunt-review-breadcrumb .word-hunt-review-separator`, matching the generic breadcrumb-span selector's specificity so normal source order applies.
- Extended the specificity contract to require these owned selectors and reject `!important` in their blocks.
- Verification: focused specificity, teacher data, and Teacher Word Hunt suites plus source UI smoke passed. Independent Chromium comparison against `9adb6c48` at 1280x720 and 390x720 found identical computed values and byte-identical screenshots for both affected surfaces.

Task 11 remains in progress. Next is the isolated lazy student activity subset; inline-dependent teacher dialog/login rules remain separate.

### Task 11c, simplify lazy Flashcards and game-stage specificity

- Removed importance from the lazy Flashcards controls' base width/max-height and the visible game stage's min-width. No HTML or runtime code assigns those properties to the target elements.
- Preserved the stronger Flashcards mastery/mobile refinement at 820px and below; it remains the correct responsive owner and produces the same widths.
- Extended the specificity contract only around these migrated foundation rules, without claiming the remaining activity-responsive exceptions are ready to remove.
- Verification: the specificity contract, 139 activity tests, 15 game tests, 9-width/6-view student shell regression, and 13-game sandbox smoke passed. Independent Chromium comparison at 1280x900, 820x1000, and 390x844 found identical computed styles and byte-identical screenshots for Flashcards and the visible game stage.

Task 11 remains in progress for the bounded teacher dialog/login candidates. Word Search runtime overrides, `.hidden`, reduced-motion safeguards, the Arcade shell bridge, and the layered student responsive shell remain justified or deferred with evidence.

### Task 11d, simplify teacher mobile login specificity and close the audit

- Removed importance from the mobile `.login-container` min-height. It follows the base rule with identical specificity, and no inline min-height competes with it.
- Attempted removal of the student-detail drawer max-height flags, but independent cascade review proved that the generic 1024px modal rule would then override both the under-900 `88vh` and 900-1024 `100vh` contracts. Restored both flags before commit and added a contract documenting them as required responsive exceptions.
- The completed audit removed 9 proven-redundant declarations, reducing application CSS from 1,035 to 1,026 `!important` occurrences. It intentionally retained `.hidden`, reduced-motion, Word Search runtime, Arcade shell, inline-layout, and layered student-shell overrides.
- Verification: the final complete `npm test` suite passed, including 9 responsive widths, three-page source smoke, and 13 sandboxed games. Focused specificity/dialog/feature checks, production build, built three-page smoke, and independent reviews passed. Mobile login pixel parity is unproven because the independent browser disconnected; equal-specificity cascade and absence of inline competition are confirmed.
- Production deployment remains 13.6 MB with 2,330 transformed modules. Lazy student feature CSS is 49.81/9.87 kB raw/gzip and lazy Quiz CSS is 12.44/3.09 kB.

Task 11 is complete. Task 12 will move owned teacher inline layout styles feature by feature, beginning with Quiz Maker so its four remaining lazy-style specificity bridges can be removed safely.

### Task 12a, move Quiz Maker presentation into its lazy feature stylesheet

- Removed every static inline style from the inert Quiz Maker template and gave the few anonymous elements feature-owned class names. Form behavior, IDs, ARIA, copy, document generation, and runtime-calculated presentation remain unchanged.
- Moved the effective container, sidebar, tool, canvas, list, and empty-state presentation into `teacherQuiz.css`, which still loads only when the Quiz feature opens. Moved the Quiz-specific 1024px rules out of the eager teacher entry so the feature owns its complete cascade.
- Removed the four remaining lazy Quiz specificity bridges and six eager responsive importance flags. Application CSS now contains 1,016 `!important` occurrences, down from 1,026 at Task 11 close; `teacherQuiz.css` contains none.
- The first independent comparison caught a real responsive regression: the old equal-specificity/later-source cascade kept the sidebar clamped at 1024px and mobile widths. Removed the proposed full-width override, documented that established behavior in the contract, and reran the comparison before completion.
- Added `test:teacher-inline-styles` to the complete suite. It requires static Quiz presentation to stay out of the template, keeps base and responsive ownership in the lazy stylesheet, preserves the clamped responsive sidebar, and prevents new Quiz `!important` declarations.
- Independent Chromium comparison against `1b1836c6` found identical computed styles, bounding rectangles, and byte-identical screenshots at 1280x900, 1024x900, and 390x844 with identical font handling. The comparison covered the container, sidebar, header, controls, canvas, list, and empty state.
- Verification: focused inline-style, specificity, form, button, and build/lazy contracts; the final complete `npm test` suite; production build; source/built three-page smoke; 9-width student regression; and 13-game sandbox smoke passed. The build remains 13.6 MB with 2,330 transformed modules; Quiz CSS remains a separate 13.24/3.27 kB raw/gzip lazy asset.

Task 12 remains in progress. The next bounded change will inspect one additional teacher feature and move only static presentation that has a clear owner; calculated runtime styles will remain in JavaScript.

### Task 12b, move Analytics Dashboard presentation into its feature namespace

- Removed 18 static inline-style attributes from the Analytics Dashboard template and 14 generated style attributes from its Recent Activity renderer. The existing `.data-dashboard-*`, `.data-summary-*`, and `.data-chart-*` namespace in `teacher.css` now owns the complete static presentation.
- Kept the data-management feature lazy and left routing, aggregate requests, grade filtering, chart calculations, metric updates, and runtime tab visibility unchanged. Recent Activity still escapes every student-controlled value before rendering.
- Used existing ancestor scope plus one meaningful active-metric modifier and one numeric-column modifier instead of creating a class for each declaration. Shared table typography remains shared; dashboard spacing, alignment, borders, and semantic colors remain feature-owned.
- Preserved two subtle cascade details found during review: the grade select uses the original `background` shorthand so it does not regain the shared arrow image, and only table headers receive physical left alignment while ordinary body cells retain their baseline logical `start` alignment.
- Extended `test:teacher-inline-styles` to reject static inline Dashboard presentation, require the exact owned CSS contract, keep the dashboard rules free of `!important`, and prove runtime tab visibility remains in `switchDataTab()`.
- Independent Chromium comparison against `68c5e897` found zero computed-style or bounding-rectangle differences and byte-identical screenshots at 1280x900, 1024x900, and 390x844 using the real stylesheet chain and embedded Inter fonts.
- Verification: the final complete `npm test` suite; focused inline-style, specificity, form, typography, teacher-data, security, and build/lazy checks; production build; source/built three-page smoke; 9-width student regression; and 13-game sandbox smoke passed. Deployment remains 13.6 MB with 2,330 transformed modules. Teacher HTML is 108.02/15.23 kB raw/gzip, teacher CSS is 137.42/22.05 kB, and the lazy data-management chunk decreased to 41.56/9.57 kB.

Task 12 remains in progress. Next, inspect another bounded teacher surface; keep visibility, progress, drag state, calculated dimensions, and state-selected colors in JavaScript until the shared-feedback task provides a justified state-class seam.

### Task 12c, move Student Progress roster presentation into its feature namespace

- Removed all 15 static inline-style attributes from the Student Progress roster shell and all 10 roster-only generated style attributes from `renderProgressTable()`. The filter controls, desktop table, sticky header, empty state, row cells, desktop action spacing, and bulk coin input now use feature-owned classes in `teacher.css`.
- Preserved the shared form/table/button typography foundations and added only the exact roster refinements that differed from those defaults. The 700px desktop-table/mobile-card switch, 60vh scroll region, pagination, selection, and fixed bulk toolbar are unchanged.
- Removed the brittle `#teacher-progress-view .card>div[style*="overflow-x"]` selector branch and folded the roster's 760px table minimum into `.student-progress-table`. The existing scroll wrapper remains the overflow owner.
- Scoped the previously global `tr.selected` rule to `.student-progress-table tr.selected`; repository tracing confirmed Student Progress is the only application code that selects table rows. The global `.hidden` importance remains because it owns toolbar/loading/pagination visibility.
- Kept Add Student and Student Detail modal presentation and their dynamic status/temporary-password styles outside this unit. No listener, pagination, selection set, coin RPC, repository, or manager boundary changed.
- Extended `test:teacher-inline-styles` to bound both the roster template and only `renderProgressTable()`, reject static inline presentation, require the exact owned styles, keep roster rules free of `!important`, and prevent the inline-substring selector from returning.
- Independent browser comparison against `6072362a` covered populated, empty, selected, and visible-bulk states at 1280, 701, 700, and 390 pixels. All eight screenshots were pixel-identical. A 30-row scroll fixture also preserved the sticky header position and produced identical screenshots at 1280 and 701 pixels.
- Verification: the final complete `npm test` suite; focused inline-style, teacher-progress, form, typography, button, container, specificity, and build/lazy checks; production build; source/built smoke; 9-width student regression; and 13-game sandbox smoke passed. Deployment remains 13.6 MB with 2,330 transformed modules. Teacher HTML is 107.64/15.14 kB raw/gzip, teacher CSS is 138.03/22.17 kB, and the teacher entry JS decreased to 162.30/44.54 kB.

Task 12 remains in progress. The next unit should clean one bounded modal or data-management surface while leaving runtime visibility and state-selected feedback presentation with its current behavior owner.

### Task 12d, move Add Student static presentation into feature classes

- Removed all six static inline-style attributes from the Add Student modal. The dialog width, auto-fit name/password grids, fixed grade/section grid, uppercase section field, and initial muted status color now live in the Student Progress feature section of `teacher.css`.
- Preserved the current responsive contract: the generic 700px modal rule still overrides panel width, the name/password grids collapse through `auto-fit`, and the grade/section grid intentionally remains two columns even at 390px. This styling-only task does not silently redesign the form.
- Left runtime status-color selection in `updateAddStudentStatus()`. Those error/muted/success states are behavior, and Task 14 will decide whether a shared feedback state-class contract provides a simpler owner; Task 12 does not create a one-off state system.
- Kept every field ID, constraint, autocomplete value, password toggle, modal lifecycle, focus behavior, client validation, server/Edge validation, authenticated provisioning call, and roster refresh path unchanged. The shared dialog, form, button, and typography foundations remain the structural owners.
- Extended `test:teacher-inline-styles` to bound the Add Student modal, reject static inline presentation, require the five feature classes and exact declarations, and keep the feature rules free of `!important`.
- Independent comparison against `0a249d06` covered default and populated/error states at 1280, 701, 700, and 390 pixels with real Inter fonts. All eight screenshots were byte-identical; 22 modal/form/password targets had zero computed-style or bounding-rectangle differences. Runtime muted/error/success/fallback colors also matched exactly.
- Verification: the final complete `npm test` suite; focused inline-style, teacher-progress, dialog, form, button, teacher-data, security, and build/lazy checks; production build; source/built smoke; 9-width student regression; and 13-game sandbox smoke passed. Deployment remains 13.6 MB with 2,330 transformed modules. Teacher HTML is 107.47/15.10 kB raw/gzip and teacher CSS is 138.34/22.24 kB.
- Recorded a separate reliability defect for a later bounded correction: account creation can succeed authoritatively and then a roster-refresh failure is reported as account-creation failure, leaving the modal open and making a retry collide with the existing email. That mutation/result boundary is not changed inside this presentation task.

Task 12 remains in progress. Continue with the Student Detail modal or another bounded data surface; do not combine the recorded provisioning reliability correction with CSS ownership work.

### Task 12e, move Student Detail static presentation into feature classes

- Removed static inline presentation from the Student Detail modal template and its activity/unit renderer. Control rows, coin input, action controls, status and password containers, loading/error messages, scores, unit headings, and result lists now use feature-owned classes in `teacher.css`.
- Preserved every runtime state transition: coin/reset status colors and temporary-password visibility remain JavaScript-owned behavior for Task 14. Repository calls, progress loading, coin updates, password reset, modal lifecycle, and listeners are unchanged.
- Removed the panel's redundant inline width while moving its effective `max-width: 800px` into the owned modal rule. The first independent comparison caught the missing cap before completion; it was restored and then reverified.
- Retained the student-detail width and height `!important` declarations proven necessary by the existing responsive cascade. The specificity contract continues to bound those exceptions rather than hiding them in inline styles.
- Removed the dead `div[style*="display: flex"]` selector. Runtime tracing and the independent comparison showed it matched no live generated markup; its inactive flex-only declarations had no geometry or pixel effect.
- Extended `test:teacher-inline-styles` to reject static template and renderer styles, require the exact owned class contract, and preserve the deliberately dynamic state assignments.
- Independent Chromium comparison against `82aac2a5` covered loading, empty, populated, late/excused, no-score, runtime status-color, and temporary-password states at 1280, 1024, 899, and 390 pixels. All 12 screenshots were pixel-identical and computed rectangles/styles matched.
- Verification: the final complete `npm test` suite, focused inline-style/specificity/dialog/progress checks, production build, and built three-page smoke passed. Deployment remains 13.6 MB with 2,330 transformed modules. Teacher HTML is 107.18/14.98 kB raw/gzip, teacher CSS is 139.12/22.39 kB, and the service worker precaches 20 files totaling 1,030,448 bytes.
- Recorded but did not mix in a pre-existing security concern: generated unit headings interpolate `unitName` without escaping. That needs a separate bounded reliability/security correction with source tracing and its own tests.

Task 12 remains in progress. Continue with one bounded teacher surface, keeping static presentation cleanup separate from state behavior and reliability corrections.

### Task 12f, move teacher loading and login presentation into auth classes

- Replaced the loading view's static flex layout, spinner dimensions, and message presentation with auth-owned classes. Moved the login submit width and login-error spacing, surface, radius, and color into the same bounded teacher auth section.
- Kept the login error's initial `display:none` inline because `TeacherAuth` still owns its runtime block/none transition. Header sign-in/sign-out visibility and all session, credential, focus, and error behavior remain unchanged for Task 14.
- Used the semantic text and danger tokens already aliased by the theme. The danger surface keeps the exact established RGBA value; this task moves its authority without changing the visual identity.
- Extended `test:teacher-inline-styles` to reject static loading/login presentation while explicitly preserving the one runtime display assignment. The form, button, feedback, accessibility, and source-route checks also passed.
- Independent comparison against `80f246f8` at 1280x900 and 390x844 found identical computed styles and rectangles for login default/error states and identical loading declarations/geometry. Exact loading screenshots are intentionally not claimed because the temporary baseline server rejected Inter font delivery, producing a known font-width artifact before the corrected run was interrupted.
- Verification: the final complete `npm test` suite, nine-width student regression, 13-game sandbox smoke, production build, and built three-page smoke passed. Deployment remains 13.6 MB with 2,330 transformed modules. Teacher HTML is 106.99/14.83 kB raw/gzip, teacher CSS is 139.53/22.48 kB, and the service worker remains 20 files totaling 1,030,448 bytes.
- The platform-specific Electron/Cursor browser message remains a separate auth subtask: its generated markup contains static styles, but it requires a dedicated rendered-state test and should not be mixed with the always-present login template.

Task 12 remains in progress. Next, clean the generated Electron auth message or another independently renderable feature surface; retain visibility and calculated state in JavaScript until Task 14.

### Post-Task 6 correction, remove unreachable platform-auth message implementations

- Task 12 tracing proved that the duplicated `showElectronAuthMessage()` implementations were not a live styling surface. Repository-wide source and history review found no route, listener, HTML, Tauri, platform, test, script, documentation, bracket lookup, or dynamic-string caller.
- Removed the teacher implementation, student UI implementation, and StudentAuth forwarding method together. This deleted 204 lines of duplicated DOM construction, inline presentation, global IDs, clipboard fallback, listeners, and timers instead of creating a new shared abstraction around dead code.
- Kept all reachable password, session, sign-in, registration, and auth-status paths unchanged. The only theoretical loss is an undocumented manual console invocation through the globally exposed application objects; repository evidence does not establish that as a supported interface.
- Added a build-efficiency contract preventing the three platform-auth identifiers from returning to the auth modules as a second unreachable UI system.
- Verification passed: focused build/lazy ownership, StudentAuth composition and Supabase configuration, teacher startup, security hardening, brand-color contract, and three-page source smoke; then the complete `npm test` suite, nine-width student regression, 13-game sandbox smoke, production build, and built three-page smoke. Deployment remains 13.6 MB. The teacher entry decreased from 162.24/44.49 to 158.82/43.56 kB raw/gzip, the student entry decreased from 242.42/62.14 to 238.76/61.12 kB, and the service-worker precache decreased by 3,651 bytes to 1,026,797 bytes.

This evidence-backed dead-code correction is tracked under completed Task 6 rather than styling or shared primitives. Task 12 continues with reachable teacher vocabulary/data surfaces.

### Task 12g, move teacher Vocabulary static presentation into feature classes

- Removed the remaining static inline presentation from the live Vocabulary Editor heading, library source badges, ID and placement captions, and image-preview error. The feature's existing teacher stylesheet now owns these values.
- Replaced the fixed source-badge color lookup with explicit remote/local/cloud modifier classes backed by equivalent semantic tokens. Source selection, labels, card accessibility, delete controls, click/keyboard dispatch, and local/cloud/repository loading behavior are unchanged.
- Kept the user-configured subject color as the existing escaped `--subject-color` custom property. That value is genuinely data-driven and does not belong in a fixed CSS class.
- Kept image loading lifecycle unchanged: the same image element, `onerror`, and `onload` branches remain; only the fixed error-text color moved to `.vocab-image-error`.
- Extended `test:teacher-inline-styles` to bound the editor template and card renderer, reject fixed inline presentation, require the owned class contract, and prove the dynamic escaped subject-color seam remains.
- Independent comparison against `a82370e3` at 1280x900 and 390x844 covered the editor heading, remote/local/cloud cards including placement/delete variants, and image error. All 10 state/viewport pairs had identical computed styles and rectangles, and all 10 element screenshots were byte-identical.
- Verification: 30 focused inline-style, Vocabulary ownership, security, and brand-color assertions; then the complete `npm test` suite, nine-width student regression, 13-game sandbox smoke, production build, and built three-page smoke passed. Deployment remains 13.6 MB with 2,330 transformed modules. Teacher HTML is 106.98/14.81 kB raw/gzip, teacher CSS is 139.95/22.58 kB, and the service worker remains 20 files totaling 1,026,797 bytes.

Task 12 remains in progress for settings, Data Export, Data Viewer, and Data Reset. Each will remain a separate bounded change, with runtime visibility, drag state, progress width, and reset locking left in JavaScript until Task 14.

### Task 12h, move the Subjects settings grid alignment into feature CSS

- Replaced the sole fixed layout style in the teacher Settings panels with the `teacher-settings-grid--actions` modifier. The general grid remains shared by Subjects, Coins, and Calendar; only the Subjects row opts into bottom alignment.
- Preserved the initial inline `display:none` state for the Coins and Calendar panels and the existing runtime `switchDataTab()` assignments. No settings data, repository call, form control, save action, routing, or tab listener changed.
- Extended the inline-style contract to require class-owned layout while explicitly preserving the two runtime visibility values for Task 14.
- Independent comparison against `0648b93d` found byte-identical Subjects-panel screenshots and exact computed geometry at 1280x900 and 390x844. Simulated initial and selected Coins/Calendar states also matched at both widths.
- Verification: focused inline-style, teacher-data, form, button, accessibility, and source smoke checks; then the complete `npm test` suite, nine-width student regression, 13-game sandbox smoke, production build, and built three-page smoke passed. Deployment remains 13.6 MB with 2,330 modules; teacher HTML is 106.98/14.80 kB raw/gzip, teacher CSS is 140.00/22.59 kB, and service-worker precache remains 1,026,797 bytes.

Task 12 remains in progress. Data Export is next; its static template and generated preview presentation will move together while progress width, visibility, and reset unlocking remain runtime state.

### Task 12i, move Data Export static presentation into feature CSS

- Removed 51 fixed-only inline-style attributes from the Export template, all 42 fixed style attributes from the generated preview renderer, and both fixed generated feedback styles. Removed the static portions of four mixed template styles while retaining their runtime initial values. The feature namespace in `teacher.css` now owns selection panels, controls, loading/success surfaces, preview summary, tables, empty/error states, and the two animations.
- Kept exactly five template inline styles because they seed live behavior: Export tab visibility, loading visibility, calculated progress width, export-status visibility, and preview visibility. Kept the existing JavaScript assignments for those states and reset opacity/pointer events. Export selection, repository batching, JSON/CSV generation, escaping, reset authorization, and lazy data-management loading are unchanged.
- Reused shared table structure only where its effective typography matched the previous renderer. The first independent matrix found that table-level shared roles changed caption/body typography and alignment; those roles were narrowed before completion. A later pass caught the generic form-label cascade and empty-table typography. Owned specificity and an Export-only empty role restored the exact baseline without `!important`.
- Extended `test:teacher-inline-styles` to bound the Export template and generated producers, require the five legitimate runtime styles, reject fixed renderer/feedback styles and template keyframes, and require the feature-owned CSS contract.
- Independent comparison against `8805d831` exercised 13 Export states at 1280x900, 1024x900, and 390x844. The final fresh-page checks for empty and populated previews had zero computed-style or geometry differences and byte-identical screenshots at all three widths; populated fixtures included more than ten progress and score rows. Renderer escaping remained exact for HTML-significant characters.
- Verification: focused inline-style, teacher-data, form, button, typography, and security suites; then the complete `npm test` suite, nine-width student regression, 13-game sandbox smoke, production build, and built three-page smoke passed. Deployment remains 13.6 MB with 2,329 transformed modules. Teacher HTML is 102.82/14.28 kB raw/gzip, teacher CSS is 144.85/23.40 kB, teacher entry JavaScript is 158.82/43.53 kB, and service-worker precache remains 20 files totaling 1,026,797 bytes.

Task 12 remains in progress. Data Viewer is next; static loader, file-info, error, summary, and table presentation can move to owned CSS while drag highlighting and runtime visibility remain with the feature behavior.

### Task 12j, move Data Viewer static presentation into feature CSS

- Removed 19 fixed inline-style attributes from the Viewer template, stripped static declarations from four retained visibility styles, and removed all 43 fixed style attributes from the generated summary/table markup. Viewer-owned classes now cover the header, drop zone, file input/button, success/error notices, summary, table region, captions, rows, cells, overflow status, and empty state.
- Kept the five initial visibility values and all existing runtime assignments for tab, file-info, error, summary, table, and drag state. File parsing, validation, in-memory data, duplicate-listener guard, file-input reset, clear behavior, escaping, tab keyboard behavior, and Data Management lazy loading are unchanged.
- Preserved Viewer-specific table semantics instead of applying Export or Dashboard classes: metric and secondary cells remain main-text colored, only Coins and Score align right, Vocab Units remains start-aligned, the first/second captions keep different margins, and the mobile table retains its 640px internal overflow inside a 600px-tall region.
- Extended `test:teacher-inline-styles` to require exactly five runtime template styles, reject generated inline markup, require the feature class contract, and preserve drag active/reset plus every show/hide assignment.
- Independent comparison against `8ca3215a` covered ten states across 1280x900, 1024x900, and 390x844: default, drag active/restored, progress-only, progress plus 55 scores, scores-only, roles-only, clean error, error after valid data, and clear. All 30 fresh-page pairs had zero computed-style, geometry, or overflow differences and byte-identical Viewer screenshots. Student-controlled IDs, names, grades, and game IDs remained escaped, and the interaction/lazy seams matched.
- Verification: focused inline-style, brand-color, build/lazy, typography, and security suites; then the complete `npm test` suite, nine-width student regression, 13-game sandbox smoke, production build, and built three-page smoke passed. Deployment remains 13.6 MB with 2,329 transformed modules. Teacher HTML is 102.03/14.11 kB raw/gzip, teacher CSS is 147.53/23.73 kB, teacher entry JavaScript is 158.82/43.53 kB, the lazy data-management chunk decreased to 38.19/9.26 kB, and service-worker precache remains 20 files totaling 1,026,797 bytes.
- Preserved two pre-existing behavioral limitations rather than mixing them into presentation work: scores-only/roles-only files pass validation but do not open the table because `renderViewerTables()` requires student rows, and a failed file after a successful file can leave the previous success content visible beside the error. These require a separate reliability task with product-behavior tests.

Task 12 remains in progress. Data Reset is the final bounded data-management surface; its fixed warning/action presentation can move to owned CSS while tab visibility and the post-export locked/unlocked state remain runtime behavior.

### Task 12k, move Data Reset static presentation into feature CSS

- Removed the ten fixed inline-style attributes from the Reset header, prerequisite notice, deletion warning, list, and action button. The sole remaining style attribute contains only live tab/export-gate state: display, opacity, and pointer events.
- Kept `enableResetSection()` byte-unchanged: successful export still sets opacity to one, restores pointer events, enables the button, and replaces the prerequisite copy with the existing green Export status inside the yellow status container. Routing, lazy loading, export logging, and the compounded locked/disabled opacity remain unchanged.
- The source trace proved there is no Reset implementation: the enabled button has no click listener, confirmation, repository method, RPC, network request, loading/error state, or deletion behavior. This presentation task did not invent a destructive client operation or treat UI state/local storage as authorization.
- Extended `test:teacher-inline-styles` to require the one runtime root style, the fixed Reset class contract, the existing unlock assignments, and generated status without inline presentation.
- Independent comparison against `2317aa03` covered locked and unlocked states at 1280, 1121, 1120, 1024, 850, and 390 pixels. All 12 fresh-page pairs had zero computed-style, geometry, wrapping, or overflow differences and byte-identical screenshots. Direct routing matched, and clicking the enabled button still caused no DOM, route, dialog, network, or deletion action.
- Verification: focused inline-style, button, typography, brand-color, build/lazy, and security suites; then the complete `npm test` suite, nine-width student regression, 13-game sandbox smoke, production build, and built three-page smoke passed. Deployment remains 13.6 MB with 2,329 transformed modules. Teacher HTML is 101.50/13.83 kB raw/gzip, teacher CSS is 148.41/23.86 kB, teacher entry JavaScript is 158.82/43.53 kB, the lazy data-management chunk remains 38.19/9.26 kB, and service-worker precache remains 20 files totaling 1,026,797 bytes.

Task 12 is complete. Fixed presentation in every audited teacher surface now has a clear CSS owner, while genuinely dynamic state remains with behavior. Task 13 should inspect repeated DOM construction and introduce only primitives supported by multiple current callers; it must not create a framework or abstract unique game visuals.

### Architecture review after Tasks 8-12

- Independent review found no blocking regression, new eager dependency, circular dependency, or unnecessary abstraction. The shared theme and component-family styles remain genuine authorities with page- and feature-specific refinements kept local.
- Removed the confirmed-dead `--primary-hover` compatibility alias from both theme scopes. Repository-wide tracing found no `var(--primary-hover)` consumer; the theme contract was the only reason it remained.
- Deferred moving namespaced Data Management styles out of eager `teacher.css` until the corresponding teacher features are converted in Tasks 16-18. Moving CSS alone now would be organization-only churn; migrating implementation and owned styles together will create a real lazy feature boundary.
- Recorded two lower-risk follow-ups for the next material changes in those areas: reduce exact presentation-value duplication in `teacher-inline-style-contract.test.mjs`, and co-locate Student Detail responsive rules after generic modal rules so four currently necessary `!important` declarations can be removed safely.

The review correction is complete. Task 13 begins from the existing `createElement` and modal lifecycle utilities and will add only a primitive supported by repeated live behavior.

### Task 13, create one lightweight shared loading primitive

- Added `js/ui/loadingState.js` with one focused use case: replace a container with the existing loading-spinner DOM shape using safe `textContent`, a polite status announcement, and an optional contextual class. It does not own requests, retries, success/error rendering, or feature state.
- Migrated the Quiz vocabulary picker and teacher Vocabulary library first. Both independent async paths previously constructed the same temporary node and then replaced it on success, empty, or error. Their tag, base class, copy, request order, and completion behavior remain unchanged.
- Added a focused DOM contract covering replacement, safe text, base/optional classes, default copy, and accessibility semantics. The complete feedback script now runs this contract.
- Kept existing shared seams instead of adding wrappers: `createElement` plus `css/buttons.css`/`css/cards.css` remains sufficient for buttons and cards; `setupModal`/`openModal`/`closeModal` remains the real Dialog primitive; student page skeletons remain page-shaped; `NotificationManager` remains the toast authority; completion markup remains activity-owned behind shared CSS.
- Deferred the remaining six loading callers for opportunistic migration when their owning features are materially changed. Also deferred the duplicated student/teacher library-choice card because crossing entry/lazy ownership for a specialized factory is higher risk than its current duplication.
- Independent diff review approved the seam without correction: the helper is dependency-free, both imports remain one-way, lazy Quiz stays lazy, and `replaceChildren` preserves the old replacement lifecycle while adding only status semantics.
- Verification: the new primitive tests, teacher Vocabulary ownership, teacher feature/lazy checks, the complete `npm test` suite, 9-width student regression, three-page source smoke, 13-game sandbox smoke, production build, and built three-page smoke passed. The build remains 13.6 MB with 2,330 transformed modules; teacher entry JavaScript is 159.07/43.61 kB raw/gzip, student remains 238.76/61.12 kB, lazy Quiz remains 16.88/4.55 kB, and service-worker precache is 20 files totaling 1,026,713 bytes.

Task 13 is complete. Task 14 will harden the existing notification authority first; it will not replace the visually distinct student reward toast or force activity-internal feedback into one presentation.

### Task 14a, harden the shared notification authority

- Kept the existing `notifications` singleton and its `info`, `success`, `warning`, and `error` API used throughout first-party application code. No caller, placement, stacking, icon, color, duration, click-to-dismiss, or returned-element contract changed.
- Added per-toast announcement semantics: errors use an assertive alert while other types use a polite status, and each toast is atomic. Unknown internal types now normalize class, color, and icon together to the established information variant instead of mixing an unknown class with information visuals.
- Made closing idempotent and cancel the pending auto-dismiss timer. Close-button events now stop at the button, so clicking its nested SVG cannot also invoke the whole-toast handler and schedule a second removal. Timer-versus-click races likewise resolve through one animation/removal path.
- Added a focused fake-DOM contract exercising live attributes, safe message text, unknown-type normalization, descendant event bubbling, propagation stopping, timer cancellation, idempotence, animation timing, node removal, and retained toast-surface dismissal.
- Independent review approved the behavior and tests without correction. It confirmed all production calls use the four convenience methods, valid visuals/API remain unchanged, and JavaScript event serialization plus the `isClosing` guard covers timeout/click races.
- Verification: 11 feedback/primitive tests, security hardening, the complete `npm test` suite, 9-width student regression, three-page source smoke, 13-game sandbox smoke, production build, and built three-page smoke passed. Deployment remains 13.6 MB with 2,330 transformed modules; the shared application chunk is 8.41/2.82 kB raw/gzip and service-worker precache is 20 files totaling 1,026,992 bytes.

Task 14 remains in progress. Next is the distinct centered student reward toast, whose timer ownership bug can be fixed without changing it into the top-right notification presentation.

### Task 14b, stabilize the centered student reward toast

- Preserved the centered, green, replace-in-place reward presentation used for starting coins and coin updates instead of redirecting it to the stacked top-right notification system. The two systems serve materially different interaction patterns.
- Gave `StudentShell` explicit ownership of one hide timer. Showing a newer reward cancels the older timer, so an earlier message can no longer hide a later one; the active callback clears its own ownership after hiding.
- Moved the fixed position, spacing, pill surface, success color, shadow, opacity, transform, transition, and pointer behavior from generated inline CSS into `.student-reward-toast` in the shared feedback stylesheet. JavaScript retains only live visibility transforms. The success surface derives from the centralized semantic status token and resolves to the previous 95% `#10b981` value.
- Added polite atomic status semantics. The persistent node removes `aria-hidden` before each announcement and restores it when visually hidden, preventing stale reward/error copy from remaining exposed after the fade.
- Extended the StudentShell runtime contract to prove isolated timer state, prior-timer cancellation, latest-message ownership, safe text, accessibility visibility, hide-state cleanup, and CSS ownership. Independent review caught the initially missing hidden accessibility state before completion; the correction and test were applied.
- Headless Chromium at 390px confirmed the extracted CSS resolves to the previous fixed position, white text, 95% success green, padding, pill radius, shadow, opacity, pointer behavior, and transform. The complete `npm test` suite, 9-width student regression, three-page source smoke, 13-game sandbox smoke, production build, and built three-page smoke passed after the final accessibility correction.
- Deployment remains 13.6 MB with 2,330 transformed modules. Student entry JavaScript is 238.59/61.00 kB raw/gzip and service-worker precache is 20 files totaling 1,027,131 bytes.

Task 14 remains in progress. Next is the repeated teacher inline-status behavior; only exact state-setting duplication with a stable CSS contract should be consolidated.

### Task 14c, consolidate repeated teacher inline statuses

- Added one dependency-free `setInlineStatus()` helper for the repeated persistent-status behavior: safe text assignment, normalized `muted`/`info`/`success`/`error` state, polite atomic status semantics, and the state data attribute consumed by CSS. It does not own feature copy, timing, visibility, requests, or result interpretation.
- Migrated six live producers: Group restrictions, Group generation, Add Student, roster CSV import, Student Detail coin adjustment, and the Spark editor. Removed their duplicate text/state setters and four inline color maps.
- Added shared semantic state colors in `feedback.css`. The accent-success modifier preserves the intentionally orange success used by Add Student, CSV import, and teacher coin gifts; Groups and Sparks keep green success. Errors, information, and muted states resolve through the existing semantic tokens.
- Removed the now-obsolete Group state-color selectors and Add Student base color rule from `teacher.css`. Feature-owned spacing, sizing, alignment, copy, lifecycle, and richer feedback surfaces remain untouched.
- Added a direct status contract plus source/HTML/CSS ownership checks. The strengthened test requires all six static nodes to expose role, live priority, atomicity, and the shared class, and verifies each state maps to its intended semantic token.
- Independent review approved the abstraction and lazy boundaries. Browser-computed colors matched the prior contracts exactly: success `rgb(52, 211, 153)`, accent success `rgb(249, 115, 22)`, error `rgb(248, 113, 113)`, muted `rgb(203, 213, 245)`, and information `rgb(14, 165, 233)`.
- Verification: 13 feedback/primitive tests; focused teacher progress, Sparks, inline-style, lazy/build, and brand-color checks; the complete `npm test` suite; 9-width student regression; three-page source smoke; 13-game sandbox smoke; production build; and built three-page smoke passed. Deployment remains 13.6 MB with 2,331 modules. Teacher CSS is 148.08/23.84 kB raw/gzip, teacher entry JavaScript is 158.95/43.70 kB, Groups remains lazy at 13.91/4.47 kB, Sparks remains lazy at 32.52/8.76 kB, and service-worker precache is 20 files totaling 1,027,448 bytes.

Task 14 is complete. Loading, stacked notifications, centered rewards, persistent inline statuses, shared completion presentation, and cloud state indicators now have clear bounded owners. Table-row errors, rich notices, progress meters, activity-internal feedback, and game visuals remain feature-owned because their structures and behavior differ materially.

### Architecture review after Tasks 28-30

- Independent review approved the data-boundary, justified-interface, and environment-authority changes without a blocking finding. It found no new cycle, compatibility shim, eager dependency, or generic service layer.
- The narrow `teacherAuthApi` remains justified as a security and test boundary; repositories remain the direct domain boundary elsewhere.
- Client/server activity and game policy stay independently authoritative with static parity contracts. Local Supabase runtime verification remains unknown while Docker is unavailable.
- Production identity is centralized without coupling local Supabase CLI identity, server secrets, deployment credentials, or developer overrides to browser configuration.

### Task 31, correct stale documentation

- Removed the README reference to a release checklist that does not exist and replaced a stale dependency-advisory snapshot with the actual `test:release` gates. Added the primary `npm test` command.
- Clarified that tracked game outputs are production-ready; game rebuild scripts are source-maintenance tools rather than a prerequisite for normal use.
- Updated the manager facade analysis from a pre-Task-23/24 proposal to the verified current ownership boundary and removal result. No brittle method-count snapshot was introduced.
- Updated teacher page ownership to the completed `teacherPageRegistry` boundary and corrected the data-access document to the real `studentApi` and `teacherAuthApi` capability files.
- Marked the normalized progress migration runbook as a completed cutover and retained reliability/rollback record.
- Kept the current `Vocabulary Master` README, package, HTML, Tauri product, and application-bundle naming aligned. A Sparks product rename would require a separate coordinated product decision and was not inferred from an architecture-documentation task.
- Verification passed: scoped Markdown reference inspection, scoped diff validation, the complete `npm test` suite, the production build (2,332 modules, 13.5 MB deployment), and an independent stale-document audit.

Task 31 is complete. Task 32 will add one concise current architecture map and link to detailed records instead of duplicating their histories.

### Task 32, create the current architecture map

- Added root `ARCHITECTURE.md` as an operational guide for the three Vite entries and their activity, game, teacher-feature, page, theme, UI, data, configuration, and database authorities.
- Documented the minimum extension path and focused verification for a new activity, game, teacher lazy feature, and top-level teacher page. Examples use the real registry/factory contracts.
- Made the security boundaries explicit: client catalogs do not authorize work, XP/rewards stay on the server, scoring games require independent SQL parity, browser features do not receive raw Supabase access, and secret/service-role keys are rejected.
- Documented the intentional limits of each abstraction: the page registry owns only shared identity, managers remain composition roots, repositories are not wrapped without a real seam, and distinctive game/activity UI remains feature-owned.
- Verified every explicit documented path exists. An independent source trace confirmed the ownership map, derived activity/game wiring, lazy feature lifecycle, page wiring, shared styling, and data boundaries.
- Verification passed: the complete `npm test` suite, 9-width student regression, all-seven-page teacher smoke, three-page source smoke, 13-game sandbox smoke, and production build. The build remains 2,332 modules and 13.5 MB; student and teacher entry JavaScript remain 236.26/60.50 kB and 181.79/48.89 kB raw/gzip.

Task 32 is complete. Task 33 will inspect whether any additional file move is justified by material ownership work; it will not perform an import-only directory rearrangement.

### Task 33, preserve gradual feature organization

- Confirmed that activity implementations live under `js/activities/`, game implementations and assets under `js/games/`, student composition under `js/student/`, domain data modules under `js/services/`, and repeated DOM behavior under `js/ui/`.
- Confirmed that the flatter teacher area remains discoverable through cohesive `teacherData*`, `teacherQuiz*`, `teacherSparks*`, `teacherGroups*`, `teacherSettings*`, and other feature prefixes plus the single `teacherLazyFeatures.js` composition map. Several larger features already own subfolders.
- Rejected moving teacher feature clusters after their behavioral migrations were complete. Those moves would now change imports and 3-13 source/test/smoke references per entry without changing an interface, dependency direction, lazy boundary, or feature ownership.
- Future material work may move one complete prefix cluster into an owned folder in the same tested task. Folder moves must never be used as a substitute for an explicit feature interface.
- Independent audit agreed that current ownership is clear and found no move whose locality benefit outweighed its import/build churn. Task 32's full regression and production build remain the applicable verification because Task 33 changes no runtime or build input.

Task 33 is complete with no source move. Task 34 will add delivery-size budgets grounded in the current production manifest and compressed output.

### Task 34, add delivery-size budgets

- Extended the existing post-build size check instead of introducing a parallel build tool. The 30 MiB raw deployment limit remains responsible for copied games, images, fonts, vocabularies, and other assets.
- Added one frozen budget authority for the complete static student and teacher JS/CSS graphs plus Report Generator, Quiz Maker, and teacher charts. Manifest `name` fields resolve hashed and query-string chunk keys without filename globs.
- Initial graphs recursively include static imports and their CSS exactly once. Dynamic imports, fonts, images, HTML games, and other on-demand assets are intentionally excluded from the entry graph instead of being misreported as initial delivery.
- Deterministic level-9 gzip now reports and enforces: student 182.5/210 KiB, teacher 155.6/180 KiB, Report Generator 132.4/150 KiB, Quiz Maker 112.7/130 KiB, and teacher charts 69.6/80 KiB. The limits provide approximately 13-16% headroom over the current build.
- Added tests for required budget coverage, recursive de-duplication and cycle safety, CSS inclusion, lazy exclusion, chunk-only measurement, missing/duplicate/broken manifest failures, and exact limit enforcement. The budget tests run in the existing build-efficiency suite.
- Verification passed: 16 build-efficiency/budget tests, the complete `npm test` suite, 9-width student regression, three-page source smoke, 13-game sandbox smoke, and production build. Independent review recalculated every current metric and approved the measurement and thresholds after requiring CSS inclusion.

### Architecture review after Tasks 31-34

- Independent review found no new coupling, lazy-loading regression, compatibility layer, or unnecessary application abstraction. Documentation is aligned with the current extension seams and the no-move decision avoided cosmetic import churn.
- Review corrections clarified the Sparks repository versus historical Vocabulary Master product naming, changed a stale facade table heading and Task 22 result, and made every shared CSS path explicit.
- The delivery guard measures actual initial JS/CSS graphs rather than entry chunks alone, so moving code into shared static imports cannot evade the budget. Lazy feature budgets remain separate and do not pull those features into an eager graph.

Task 34 is complete. Task 35 will verify that every intended lazy boundary remains outside the initial student and teacher graphs and strengthen only missing production-manifest contracts.

### Task 35, preserve lazy loading

- Added one post-build production-manifest validator for nine required edges: Student to Games and Report Generator; Teacher to its five lazy feature entries; Data Management to Chart.js; and Teacher Quiz to Quiz Maker.
- Every required child must be a dynamic entry, appear in its parent's `dynamicImports`, and remain absent from the parent's transitive static graph. Student and teacher initial graphs also reject any optional feature, game module, or activity module.
- Added an explicit guard for the CSS-only `js/student/studentFeatureStyles.js` manifest entry because Vite emits it without a name or `isDynamicEntry`. Its 49.81/9.87 kB raw/gzip stylesheet must stay outside the student initial graph and precache.
- The validator reuses the existing static-graph traversal and service-worker precache collector. `validate-game-build.mjs` remains responsible for registry assets and canvas bundle reachability; the new check owns entry-level delivery boundaries.
- Added fixture tests for missing/duplicate entries, missing dynamic edges, simultaneous static/dynamic imports, eager optional features, games and activities, deferred feature CSS, broken graph entries, and precached lazy code/CSS/assets.
- Independent runtime tracing confirmed My Digital Garden loads its remote media only after iframe launch and parent CSP does not block its current browser path. It and the other HTML games are not guaranteed cold-offline. Asset localization or cache-on-first-use is intentionally deferred because licensing/provenance and offline product behavior must be decided before changing delivery; precaching every game would defeat the initial-load boundary.
- Verification passed: 21 focused build/lazy/budget checks, the complete `npm test` suite, 9-width student regression, three-page source smoke, 13-game sandbox smoke, and final production build. The manifest validator passes, the student precache remains 20 files/1,025,326 bytes, and Task 34 size metrics remain unchanged.

Task 35 is complete. Task 36 will remove only code or CSS that current caller/import/DOM tracing proves obsolete after the completed migrations.

### Task 36a, remove unused student vocabulary state

- Removed the `StudentActivities.cloudVocabs` collection and its merge branch. Production source initialized and read this collection but never populated it; only an isolation test mutated it.
- Preserved manifest and available-vocabulary precedence, routing, activity preparation, browser storage, and cloud repository behavior. No compatibility field remains because there is no production caller.
- Updated the focused runtime-composition contract so it continues to prove per-instance ownership for every live activity state field.
- Verification passed: 140 student-activity tests, 15 student-routing tests, 21 build-efficiency/lazy tests, the complete `npm test` suite, three-page source smoke, 9-width student regression, 13-game sandbox smoke, and production build. The build remains 2,332 modules and 13.5 MB; student initial delivery is 182.4 KiB gzip.

Task 36 remains in progress. The next cleanup will remove only independently traced zero-caller repository methods, separate from the dormant-auth investigation.

### Task 36b, narrow repository and storage surfaces

- Removed four unused single-record/legacy export methods from `teacherExportRepository`; current exports use only bounded batch progress, profile, and score reads plus audit logging. Its obsolete leaderboard and Spark-response imports disappeared with those wrappers.
- Removed the unused single-score `leaderboardRepository.get` and teacher-only `sparkResponsesRepository.listForStudent` methods. Preserved `listForUser`, which remains an authorization acceptance-test use case, and the active student-owned Spark read/submit paths.
- Removed the unused Word Hunt image-delete client method. The live product supports deterministic image upsert and download, not user-facing deletion; the database Storage delete policy remains intact as an independent authorization rule.
- Added an exact live repository-surface contract so these low-value convenience methods cannot silently return.
- Verification passed: 13 repository tests, 23 teacher-data tests and smoke, 13 Word Hunt review tests and smoke, 140 student-activity tests, 21 build/lazy checks, the complete `npm test` suite, 9-width student regression, three-page source smoke, 13-game sandbox smoke, and production build. The build remains 2,332 modules and 13.5 MB; student initial delivery is 182.0 KiB gzip and the precache is 19 files/1,024,562 bytes.

Task 36 remains in progress. Authentication compatibility code and dead CSS will be handled as separate changes after direct UI and caller verification.

### Task 36c, remove unreachable public-auth compatibility code

- Confirmed both entry pages intentionally expose password login only: neither has a student registration nor teacher signup/email-link panel, security tests require those panels to remain absent, and database configuration disables public account creation. Teacher-managed student provisioning remains the supported account path.
- Removed the dormant student join-link, registration validation/submission, auth-panel switching, and redirect-result no-op chain from UI, composition, API, and Supabase service layers. A `?grade=` link can no longer hide the only live login panel.
- Removed dormant teacher signup and email-link listeners, manager methods, API capabilities, and Supabase implementations. The email-link implementations had no UI and explicitly threw “not enabled.”
- Removed two orphan mobile registration selector arms. Preserved password login, restored sessions, forced student password changes, teacher role verification/repair, teacher-managed account creation, and sign-out cleanup.
- Tightened student and teacher auth capability contracts and added source guards preventing the unreachable systems from returning.
- Verification passed: focused student-auth/API/listener, teacher-auth, security, and build/lazy tests; the complete `npm test` suite; 9-width student regression; three-page source smoke; 13-game sandbox smoke; production build; and built three-page smoke. The build remains 2,332 modules and 13.5 MB; student initial delivery decreased to 180.8 KiB gzip, teacher to 154.1 KiB gzip, and the precache to 19 files/1,019,339 bytes.

Task 36 remains in progress. The remaining work is a source-traced CSS cleanup, with mixed or dynamically produced selectors preserved.

### Task 36d, remove source-proven obsolete styles

- Removed copied student activity-menu, dashboard, subject/home, app-header, tab, mobile-navigation, Spark, and preview rules from the teacher stylesheet after tracing every affected selector against static markup, DOM producers, and lazy feature templates.
- Removed retired teacher-library hierarchy, structured-mode, export-menu, document-preview, and legacy Quiz question-card families. Preserved current `doc-q-*` Quiz output, teacher progress/detail selectors, shared vocabulary rows, responsive behavior, and feature-owned lazy styles.
- Removed the last orphan `teacher-library-groups` container rule. Corrected style contracts that still treated retired selectors as ownership sentinels; the contracts now require the live replacement selectors and reject the obsolete families.
- Independent review found no removed live selector and no remaining high-confidence dead-style family that should be included in this task. All styles parse, the scoped diff is clean, and 34 focused build/style contracts pass.
- Final verification passed: the complete `npm test` suite, 9-width student regression, three-page source smoke, 13-game sandbox smoke, production build, and built three-page smoke. The build remains 2,332 modules and 13.5 MB. Teacher CSS decreased from the baseline 149.89 kB raw / 24.40 kB gzip to 125.98 kB raw / 20.78 kB gzip; teacher initial delivery is 151.2 KiB gzip.

Task 36 is complete. Task 37 will repeat the architecture audit and change-impact tests against the final repository state.
