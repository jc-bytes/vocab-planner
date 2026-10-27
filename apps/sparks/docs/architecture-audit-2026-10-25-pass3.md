# Sparks coupling and startup pass, 2026-10-25

## Final accepted result

This local pass is complete. The remaining teacher-browser ownership work and narrow preview clipping are repaired. The complete `npm run test:release` run exits **0** on the final application and test sources. No urgent or high-priority issue remains identified within this pass's audited scope. This is not a hosted deployment or a claim that the photographed production incident has been reproduced and resolved.

| Category | Final local score | Evidence and remaining limit |
| --- | ---: | --- |
| Modularity | 9.5/10 | Private browser, Menu, Home and evidence owners; explicit Quiz adapter. Legacy Manager composition and context-bound helpers remain. |
| Maintainability | 9.5/10 | Named ownership, retained failure states, source/built regression gates and architecture contracts. Some prototype composition and cascade-sensitive styles remain. |
| Simplicity | 9/10 | Removed implicit browser dependencies and kept headless data independent. Legacy composition and several lifecycle generations still require care. |
| Efficiency | 9.5/10 | Both initial graphs have over 10% budget headroom; shared full-workload descriptor calls fall. Complete descriptors cost more for grouping alone; no universal latency claim. |
| Scalability | 9/10 | Local SQL/SDK equivalence, reduced redundant permission/snapshot work and selected-export payloads pass. RLS performance advisories and sustained hosted mixed-load evidence remain. |
| Reusability | 9.5/10 | Browser and Quiz share one explicit presentation model; retained style and recovery owners have real consumers. Some helpers still depend on a composed context. |
| Reliability | 9.5/10 | Real ownership/receipt/database checks, stale-result suppression, bounded recovery, offline upgrades, Firefox/WebKit and responsive acceptance pass. Native imports cannot be cancelled; hosted/device behavior remains unverified. |
| Developer experience | 9.5/10 | One complete release command, actual CI wiring, strict owned servers, build identity and reproducible failure evidence. Full verification still requires local database infrastructure and a substantial browser run. |

Final gzip level-9 startup graphs are **192,174/215,040 bytes student** and **163,496/184,320 bytes teacher**, giving **10.6%** and **11.3%** budget headroom. Budgets, graph accounting and full student offline precaching are unchanged. The final worker precaches 102 files, 2,388,322 bytes; deployment remains 15.5 MB against 30 MB. Final current-input/config/output build identity and scoped whitespace checks pass.

Validation includes **1,506 portable tests with no failures or skips**, all source and compiled release gates, real local database acceptance, dependency audit with **zero vulnerabilities**, Firefox/WebKit and responsive widths 320 through 1280px. The preview-specific gate covers thirteen widths and real PDF/Back interaction at 320px. Database lint reports no errors, two warning findings and **eight** current RLS performance advisories. The latter are residual performance work, not omitted errors or a perfect scalability score.

Complete successful run: `/tmp/sparks-pass3-full-release-final3.log`. Exact final delivery graph: `/tmp/sparks-pass3-final-delivery.json`. Earlier failed attempts and the immutable presentation reference remain available. No commit, push, deployment or hosted data/schema change was performed.


## Scope and baseline

Continue from the verified second pass. Preserve all visible functionality, persisted identifiers, authorization, progress/receipt guarantees, existing delivery budgets and full student offline precaching. Preserve unrelated worktree changes. No hosted operations, deployment, dependency upgrade or database/schema change is planned.

Starting manifest measurement matched the preceding release: student 208,246/215,040 bytes gzip, teacher 168,888/184,320 bytes. The preceding complete release run passed 1,386 portable tests and all source, built, database, browser and responsive gates. That is the starting evidence, not acceptance of this pass's edits.

| Category | Starting local rating |
| --- | ---: |
| Modularity | 9.5 |
| Maintainability | 9.5 |
| Simplicity | 9 |
| Efficiency | 9 |
| Scalability | 9 |
| Reusability | 9 |
| Reliability | 9.5 |
| Developer experience | 9.5 |

Targets are evidence-based improvements, including at least 10% startup budget headroom where genuine optional ownership permits it. This means student at most 193,536 bytes and teacher at most 165,888 bytes, without increasing budgets or excluding required startup code from accounting. These are targets, not achieved savings. Operational/device acceptance remains separate from source architecture ratings.

## Work order

1. Repair confirmed Word Hunt legacy-image ownership races, then isolate asynchronous evidence I/O behind a bounded module. Retain synchronous draft/merge/report/state callbacks. Prove normal operation, account/unit/session changes, late initialization, failed storage/upload and preview overrides.
2. Prepare one owned unit-menu workspace before showing its presentation. Consider menu-specific CSS and its export popover together. Preserve direct activity/quiz paths, required-work readers, queue flushing and synchronous resets.
3. Move only proven Home and shared Units/Sparks library presentation styles behind their actual renderers if needed for headroom. Keep shell, header, skeleton and shared primitives eager. Prove computed styles, bounds, themes, loading failures and cold-route delivery.
4. Separate teacher vocabulary-library presentation from headless catalog/editor/save ownership. Before extraction, cover the actual populated quiz adapter/composition. Move misplaced cross-feature guards to their established owner; do not wrap all 121 vocabulary methods in a lazy forwarding module.
5. Independently review each repair, measure real rebuilt bytes and cold demand, then run the complete release suite on frozen final source. Record limits and reassess ratings without awarding unproved tens.

## Initial findings

- Word Hunt migration rereads the active account after image conversion and recomputes the upload destination from mutable current vocabulary. A changed account/unit can redirect old evidence. This is the first repair; held-processing regressions reproduce the issue.
- Vocabulary composition installs 121 methods on TeacherManager, including 39 library methods. Catalog data has live headless consumers in quizzes, Data Management, editor lookup and calendar work. Presentation must separate without activating a view for those consumers.
- `ensureAuthenticated` currently belongs to vocabulary workflow although unrelated lazy features call it. Moving the whole vocabulary implementation behind an import would break this hidden dependency.
- The quiz smoke's empty catalog hides an incomplete fake Manager contract. The real adapter needs helpers with different names from its exposed capabilities. Populated actual-composition coverage is required before changing that seam.
- In-memory removal estimates identify menu, Home and shared library presentation savings, but these are not net build results. Units card classes are also used by Sparks. The 6,037-byte chunk labelled floatingActionMenu contains required shared primitives; only its actual popover rules and behavior are optional. QueryCore and Auth are required by real startup reads. Icons are already a small selected set.

## Verification ownership

One production issue at a time. Agents may inspect independent concerns and author tests, but app edits, builds, shared authenticated fixtures and final integration runs have an explicit owner. Historical style baselines may be preserved for comparison; current-source built acceptance still requires the official artifact identity. No failure assertions or existing functionality may be relaxed to satisfy a refactor.

## Word Hunt evidence acceptance

Actual-class held-processing probes reproduced six account/unit/school/session/load/reset races before repair. Async I/O now receives captured actor, assignment and lifetime information; guards check immediately before drawing/storage dispatch and after awaited initialization/processing. Synchronous draft merging, report collection and save callbacks remain eager. Actor-only save callbacks preserve legitimate same-owner old-unit saves while refusing replacement-account state. Ordinary units with no legacy data URLs do not load the I/O module.

Legacy data URLs remain until owned drawing/storage persistence is confirmed. Existing remote images are confirmed rather than overwritten with older base64. Same-word replacement and shared migration controls prevent stale local merges/deletions. Already-dispatched captured-owner uploads can finish because the installed SDK upload method does not forward AbortSignal; stale continuations cannot apply their results to replacement work.

The actual page exposed an additional existing CSP blocker: `fetch(data:image/...)` fails under student connect-src policy. The shared data-URL helper now decodes locally without changing CSP. Its bytes/MIME behavior matches the browser-fetch oracle for representative valid/invalid image inputs; the clipboard's accepted formats are unchanged.

Review also caught an introduced over-strict report guard before acceptance. Educational-map identity checks now apply to migration only. Immutable report snapshots survive ordinary same-unit editing, current export buttons recover on success/failure, and stale account/unit errors cannot notify replacement UI.

Verification: 183 focused controls, independent Word Hunt/runtime/paste/workflow checks, actual-app source and built controls with real canvas/WebP, IndexedDB, actual Storage client acknowledgment and valid PDF download all pass. Source and compiled controls are required in the release command and actual CI. Official build budgets pass at 208,850 student and 169,016 teacher bytes, respectively +604/+128 bytes from baseline. This repair prioritizes correctness and does not claim startup savings. No database/schema or hosted changes occurred.

## Next confirmed lifecycle defect

Populated real quiz composition reveals that replacing a QuizMaker constructs the new editor before destroying the old one. Old disposal clears shared button handlers and preview/composer DOM, breaking the second editor's Back controls. Empty-library tests did not exercise this. A maintained populated smoke and lifecycle tests reproduce the failure; the next bounded repair retires the old instance before new construction while preserving async generation guards, cached reuse, drafts and return destinations.

That repair is now accepted. Old references clear before retirement, full current-generation/document checks run after retirement and construction, and stale errors do not redirect a replacement owner. Eleven adversarial lifecycle controls, populated real composition, actual teacher-app source and built flows all pass, with zero backend writes. The complete portable suite passes 1,442 tests at this checkpoint. The official level-9 gzip measurement is 208,850 student and 169,018 teacher bytes; quiz retirement adds two teacher bytes to the preceding repair. An earlier level-6 estimate was discarded. Real-app source/built replacement checks and the original populated composition check remain required. The explicit test inventory was updated for all new source gates before the successful build.

## Presentation baseline and active workspace extraction

The authoritative historical reference is `/tmp/sparks-presentation-baseline-20261025`. It verifies original and copied output hashes against the official artifact identity while deliberately keeping historical output separate from current-source freshness. Both historical and source modes have 182 style/text/bounds snapshots and 20 cold-route graphs; full repeat captures have zero differences in each mode. Coverage includes current/blocked Home, Units/Sparks cards and rows, expanded unit menus, export popovers, Arcade, Flashcards and real authenticated teacher preview at 320/390/430/760/761/768/1280 widths with dark/light OS preferences. These are OS preference cases, not a claim that the app has a separate theme switch.

The real teacher preview already clips unit cards/text at 320px. Baselines retain that known defect instead of calling it parity success; a separate narrow layout repair is planned after presentation extraction. Early stripped-host and missing-CSS test captures were invalid and superseded by the full-host, manifest-CSS-aware reference.

The active production change is one owned unit-menu workspace. Its preparation must precede menu painting/actions through normal vocabulary loading and preview return paths. Direct activity/Quiz paths remain independent. Business eligibility, global Arcade status, queue/result acknowledgment and reset stay eager. Private presentation owns menu rendering, local gate/scroll display, its scoped styles and export-popover initialization. Lazy-created cards require delegated listeners. Loaded presentation disposal must not destroy pending progress receipts. Home/shared-library styles and teacher-browser extraction remain subsequent, separately reviewed steps.

Independent draft review found an export-only initialization path that could create the workspace before its presentation styles succeeded. A later progress refresh could then paint cards over CSS recovery UI. Acceptance requires a separate presentation-ready condition, including export-before-menu and failed-style regressions; retaining the CSS rejection remains mandatory.

The next Home audit also reproduced two stale-scope defects: a held old account's Spark fetch can replace the new account's current Spark, and an old detached Home render can remove a new render's globally selected Spark tab. These are queued as a separate correctness repair before Home presentation is moved. They are not yet accepted fixes.

Menu source comparison now matches all 182 historical source snapshots, including the original narrow preview defect. Independent actual-Auth probing additionally reproduced a same-UID forced-user refresh that changes the user object without resetting Menu or cloud generations; capture must track that actor incarnation. Independent real-Router probing also reproduced a held assignment read that resumes after Home intent and captures the newer navigation only when entering Menu, temporarily reopening the cancelled unit. The parent vocabulary load must retain its original navigation ownership before its first await. Neither finding is treated as accepted until maintained regressions and built controls pass.

Independent Menu checks now confirm synchronous receipt acknowledgment survives a throwing UI observer and demands no cold Menu import. Actual forced same-UID Auth now rejects the stale import; an ordinary coordinator-deduplicated focus refresh remains valid. The held assignment-to-Home Router probe passes after parent ownership is captured. Actual two-school deep-link and direct non-route loading both still select the authorized assignment school, update placement, render cards and finish loading with the correct route. Source presentation parity remains 182/182 unchanged; compiled acceptance and net byte measurement remain pending.

## Unit-menu workspace accepted

The official build, all 13 maintained compiled browser scenarios, and 182 compiled presentation snapshots pass. The latter have zero computed-style, text or bounds differences from the separately verified historical build; the known 320px preview clipping is unchanged. Source/built recovery checks cover missing code, retained CSS failure, held import, held assignment read, same-unit return, teacher preview Back and direct Quiz bypass. Independent review passed 207 focused controls and actual Auth, two-school navigation and synchronous acknowledgment probes. The new source and compiled controls are registered in the release command and actual CI.

Level-9 startup gzip: student 201,901/215,040 bytes (6,949 fewer than the immediately preceding build; 6.1% budget headroom), teacher 169,258/184,320 bytes (240 more). Budget limits and accounting are unchanged; the worker still precaches the full graph, now 101 files. On actual cold routes compared with the historical reference, Home/Units/Sparks/Arcade/activity demand falls roughly 5.9–6.5 KB with unchanged request counts. Menu demand instead rises 5,924 bytes and five requests; teacher preview rises 7,031 bytes and six requests. This is a startup ownership improvement with a real feature-demand cost, not a claim that every route is cheaper.

The next sole production repair is the independently reproduced Home stale-Spark scope issue. Its maintained method controls have four intended failures and two positive passes; its actual-app source smoke has three intended ownership failures and two positive scenario passes. Those newly discovered failures are queued work, so the earlier 1,457-test portable checkpoint is not presented as a passing final suite.

## Home Spark scope repair checkpoint

The separate correctness repair now passes all 1,477 portable tests, the official build, all five actual-app compiled Home scenarios, and all 13 compiled Menu scenarios. Held old success/null/error responses cannot overwrite a new subject's Spark or remove its tab. Positive current/cached/ordinary refresh and genuine empty-Spark tab behavior remain valid. Data guards stay independent of Home navigation for headless required-work reads; Home composes render/navigation/host ownership. Read/hydration continuations cannot persist or retry under replacement scope. The existing central query service already prefixes school identity and guards school generation; no cache-key redesign was needed.

The correctness cost is 468 startup bytes: student 202,369/215,040, teacher unchanged at 169,258/184,320. No CSS, database, cache semantics or hosted data changed. Independent review also passes 137 controls, including valid headless hydration across Home-to-Arcade navigation and stale session/class failures that produce no persistence, retry or gate acknowledgment. The repair is accepted. Final release acceptance is still pending the remaining ownership work.

The next sole production issue is Home presentation ownership: move only renderer-private helpers, Spark DOM presentation and Home-owned styles behind the existing renderer. Preserve the newly accepted read/publication guards and eager headless work. Shared Units/Sparks styles, teacher vocabulary browsing and the narrow preview layout repair remain separate later steps.

## Home presentation extraction in progress

The first frozen draft passes 1,483 portable tests, nine new actual-app source cold-demand/recovery scenarios and the existing five scope scenarios. Its cold presentation matrix matches all 182 original source snapshots. New Home source/built gates are registered centrally in the release command and actual CI. No compiled extraction acceptance is claimed yet.

Independent warm-order probing caught a gap in the cold matrix: after starting directly in an activity, the deferred Home stylesheet can arrive after 17 runtime-only Home overrides and reverse their original equal-specificity cascade. Historical Home-first and activity-first layouts agree; the candidate's latter path changed padding, icon sizes, grid and type. The chosen repair preserves a small set of order-sensitive Home base branches eager, while deferring bulk hero/recommendation and other independent styles. It adds no stylesheet DOM reordering, new markers or specificity changes. A briefly attempted selector-prefix trial was reverted.

The author retained pre-extraction rule bodies grouped by source, but not source offsets among unrelated rules. Restoration therefore uses the still-unchanged accepted pre-extraction compiled CSS sequence and surviving source neighbors, followed by independent computed-style comparison; it is not claimed to reproduce exact original source line positions. The historical reference remains immutable. Acceptance requires both warm load orders at all seven widths as well as the cold matrix. Future CSS ownership steps will checkpoint their source before editing.

## Home presentation accepted

The retained-base split passes the official build, all 11 compiled Home presentation scenarios, five compiled scope scenarios and 13 compiled Menu scenarios. All 182 compiled cold snapshots match the original historical reference. The independent compiled warm oracle has exactly zero differences: both visit orders, seven widths, normal/focus/pressed states, 11 selectors and 36 properties (20,592 values). Equivalent source/minified gradient formatting differences disappear in the compiled comparison. The root portable run passes all 1,484 tests, including the added same-hash direct-host import ownership regression. No AppUpdates policy change was needed because normal Home rendering follows canonical `#/menu` routing.

Startup gzip is now student 198,445/215,040 and teacher 169,249/184,320: net savings of 3,924/9 bytes from the previous repair. Student budget headroom is 7.7%. The original full-graph offline policy remains; current precache is 100 files. The preserved split retains 74 cascade-sensitive branches eager and defers 104 independent Home branches; the 17 conditional runtime overrides remain in their original owner.

Compared with the original historical cold routes, Home requests one extra file but 5,015 fewer gzip bytes; Units/Sparks/Arcade/activity save approximately 9.4–10.0 KB with unchanged request counts. Menu remains 2,494 bytes/five requests more and preview 3,591 bytes/six requests more than that original reference. These are cumulative pass differences, not isolated savings for a single extraction.

The next issue is shared Units/Sparks presentation styles. Before handoff, all 43 current CSS files were checkpointed with SHA-256 and accepted build-input provenance at `/tmp/sparks-pass3-pre-library-css-post-home`; the original presentation reference remains immutable. Actual consumers, including teacher surfaces, must retain their styling while data/gate readers stay independent. Teacher browser ownership and the separate 320px preview fix remain later work.

## Shared library style checkpoint, not yet accepted

The frozen source passes 1,497 portable tests, 14 actual-app browser scenarios, loading-geometry controls and all 182 original source snapshots. Shared CSS failures remain retained across both consumers; specialized Sparks failure leaves Units available. Early-shell, skeleton and renderer acquisition now share an ordered retained loader instead of raw stylesheet imports. Demo rendering retains its own current-scope error UI. Units preparation/error ownership prevents the installed updater from preempting recovery while preserving healthy safe updates. Independent review also passes focused controls, actual demo success/failure and Home-with-Spark comparisons across four Units/Sparks visit orders and seven widths.

The official candidate build passes all 14 compiled library scenarios, 11 compiled Home presentation scenarios, five scope scenarios and 13 Menu scenarios. Its startup is student 192,157/215,040 bytes (10.6% headroom) and teacher 169,802/184,320 bytes. These are candidate measurements, not final acceptance.

The compiled cold presentation matrix blocks acceptance with 28 differences: only Units/Sparks cards' `grid-template-columns` differs across the seven widths and two OS schemes. Source mode had zero differences. The exact cause is an existing tie between the student-card declaration and shared `.option-card` primitives: their source and compiled stylesheet order differs. Deferring the student declaration changes the compiled winner. The bounded correction retains that one declaration eager at its original owner, preserving both existing mode-specific priorities without changing specificity, shared primitives or accounting. It awaits completion of the independent compiled delayed-fault probe before editing.

The independent compiled Home-with-Spark oracle already has zero raw differences for all four cross-library visit orders. An additional warm-entry CSS-failure probe is checking updater behavior after `window.load`, because cold faults can occur before the production updater installs. No speculative broader update policy change is accepted.

## Shared library styles accepted

The one-declaration repair passes the official rebuild, all 14 compiled library scenarios, 11 compiled Home presentation scenarios, five scope scenarios, 13 Menu scenarios and all 182 original compiled snapshots with exactly zero differences. The original source/build card-grid priority difference is preserved naturally. The independent compiled Home-with-Spark oracle also matches across four Units/Sparks visit orders and seven widths. A warm probe waits for the real production updater to install before emitting an actual Vite CSS failure; subsequent Units/Classes navigation, focus and online events retain recovery without reload or unstyled cards. No speculative broader updater change was needed.

Accepted startup gzip: student **192,156/215,040 bytes**, teacher **169,802/184,320 bytes**. Student headroom is 10.6%, meeting this pass's 10% target without raising budgets, changing accounting or changing full offline precaching. The new build precaches 102 files. Relative to the preceding accepted Home step, student startup falls 6,289 bytes while teacher startup rises 553 bytes; that teacher cost remains visible and informs the next target.

The next sole production issue is teacher vocabulary browsing. The reviewed plan keeps catalog reads/cache, editor documents, save tickets, publication, exports and calendar data headless; a private feature owns browsing UI, state and listeners. The misplaced synchronous auth guard moves unchanged to Auth. Quiz and browsing share a lazy model with explicit descriptors, removing the adapter's browser-model dependency on the teacher entry. Other compiler parent exports must be reported accurately rather than automatically classified as source cycles. Teacher/shared sources (210 files) were checkpointed with SHA-256 and accepted build provenance at `/tmp/sparks-pass3-pre-teacher-browser-source`. The remaining teacher startup target is 165,888 bytes, requiring at least 3,914 bytes net from its current accepted build.

The separate narrow 320px teacher-preview clipping repair is being prepared as test-only work; no layout change has been made yet. Final release acceptance and final ratings remain pending.

## Teacher browser draft review

The active private owner is `teacherVocabularyBrowserFeature.js`, with a shared lazy `teacherVocabularyBrowserModel.js` and explicit subject/placement descriptors for hierarchy and Quiz. Initial focused catalog/session/Quiz/replacement controls and actual populated Quiz/replacement source flows pass. The new source/built browser gate is registered in the release command and actual CI; no teacher build acceptance is claimed yet.

Root review requires bounded late card acquisition and recovery, and a usable view-mode switch even when optional local preference storage fails. Independent deadline/retry/late-read/disposal probes already pass for the catalog phase.

A real-catalog count experiment blocks acceptance of the initial model implementation: grouping and complete sorted IDs match, but helper calls rise from 896 to 9,514 for grouping and from 11,942 to 165,837 for sorting on 224 records. Full descriptors were recomputed for individual fields and scalar labels. This is a measured call-count amplification, not a timing claim. The author is adding bounded render/catalog-snapshot reuse with explicit context invalidation; no global stale cache or duplicate placement parser is authorized.

Test-only preview preparation independently reproduces 14 existing failures only at 320px: twelve clipped cards and two clipped PDF controls. All six wider widths pass at 480px height; a real 34,276-byte PDF and Back action succeed. Its known-red gate stays outside default validation until the separate layout repair.

## Teacher vocabulary browser accepted

All 1,506 portable tests pass without skips after updating the shared-loading contract to its new presentation owner. Source and compiled browser gates pass all five scenarios: populated hierarchy/cards/rows/search/counts/edit/draft/headless/dispose/reopen, navigation during acquisition, same-owner session replacement, held card import with bounded retry and no late paint, and unavailable preference storage. Source populated Quiz composition and actual source/compiled replacement flows pass. Independent read-only review passes 42 focused controls and finds no urgent lifecycle blocker.

The browser exposes four operations. Catalog/cache, editor documents, save tickets, publication, calendar and exports remain headless. `ensureAuthenticated` now belongs to Auth. Quiz uses the shared presentation model through explicit capabilities; the emitted Quiz adapter imports the model rather than the teacher entry. This does not claim that all unrelated compiler parent dependencies or legacy composition have disappeared.

Per-render descriptor and scalar caches reset through `beginRender()` in both consumers. Freshness controls cover calendar/context changes and mutations of the same vocabulary object. On the same 224-record experiment, full-workload helper calls fall from 15,760 to 11,137 and sorting from 11,942 to 8,749, while grouping alone rises from 896 to 4,757 because it prepares complete descriptors. These are call counts, not latency or universal performance claims. Native dynamic imports still cannot be cancelled; stale continuations cannot publish.

The official teacher checkpoint measures student **192,174/215,040 bytes**, teacher **163,496/184,320 bytes**, gzip level 9. Both meet the internal 10% headroom target. Teacher startup falls 6,306 bytes from the preceding accepted library step; student increases 18 bytes. Budgets, static-graph accounting and full offline policy are unchanged. Source and compiled logs are `/tmp/sparks-pass3-final-teacher-{source,build,built,replacement-built}.log`; descriptor counts are `/tmp/sparks-browser-descriptor-memo-counts.log`.

## Narrow teacher preview repair

Historical and current-source controls reproduce fourteen failures at outer width 320px: twelve clipped cards and two export controls. The initial 240px iframe override passes the first source samples but fails two compiled required cards, where text becomes a very narrow column and cards exceed the visible frame height. Independent boundary probing also reproduces failures at outer widths 323 through 326. Those failed attempts remain recorded; no historical reference has been replaced.

The revised preview-only grid caps its minimum by available width. Below a 260px iframe, required cards stack their icon and text vertically, and export controls can wrap without a fixed panel minimum. Normal student runtime styles and action handlers are unchanged. The maintained gate now covers thirteen outer widths, including 323 and 326, and downloads a real PDF and closes preview through Back at 320px. Both source and built gates are registered in the release command and actual CI. Final compiled/layout/presentation and complete release acceptance remain pending below.

## Preview accepted and release verification

The official rebuilt preview passes all thirteen maintained widths with zero visibility failures. At 320px, a 34,276-byte real PDF is generated and Back closes the full teacher preview. Root inspected the compiled 320px screenshot. Independent review confirms the fix is scoped to preview runtime and the test checks actual text-line and ancestor clipping rather than only center hit targets.

The preserved 182-snapshot compiled presentation matrix reports 892 field differences, all confined to preview Menu at 320px and 390px under the two OS color preferences. The 320px horizontal overflow changes from true to false. At 390px, 28 differences reflect required-card width shrinking from the old 220px minimum to the available 210px and related text wrapping. No other route/width differences are present. These intended bounds/wrapping changes are recorded rather than replacing the historical reference or weakening the exact comparator.

The first full release attempt stopped at the existing finite-arrivals queue fairness test under heavy host load. Its 90ms wall-clock cycle could expire before the assertion's assumed number of attempt opportunities. The test now freezes its injected scheduler clock within each cycle and advances it between cycles, preserving all nineteen cycles, receipt/attempt/order assertions and the separate real elapsed-deadline tests. All 27 queue controls pass. Runtime queue behavior and deadlines are unchanged. The original failed run remains `/tmp/sparks-pass3-full-release.log`; final complete release acceptance is pending in `/tmp/sparks-pass3-full-release-final.log`.

The first retry then exposed test fixtures tied to the former vocabulary module ownership. Class Home now composes the real private browser and navigates its actual subject/grade/trimester/month hierarchy instead of inserting a placeholder. The library fixture captures the real session guard rather than an always-current predicate; its stale-session close assertion remains. The routing fixture now reads `resetLibraryDrilldown` from its workflow owner. All original behavioral assertions are retained. The complete remaining source-check preflight passes, including the thirteen-width preview gate.

A subsequent uninterrupted attempt in `/tmp/sparks-pass3-full-release-final2.log` passes the repaired controls and offline upgrade checks but stops at a mobile Arcade control-size assertion after rapid carousel wraparound. The immediately preceding targeted run passes all twenty games at all ten widths. This intermittent result is under diagnosis; no success is claimed for that whole release attempt.

## Final release closure

The intermittent Arcade failure was reproduced with a controlled real pointer press/release. The shared pressed-feedback scale yields a 43.56px arrow immediately after release while the transform transition remains active; actual animation completion restores 44px. The layout test now awaits finite animations on the measured card/arrows with a two-second failure deadline. It preserves all 44px, containment, text and hit-target assertions, adds dimensions to failure messages, and changes no production animation. All twenty games, Resume and both carousel directions pass at all ten widths, including within the successful source and compiled release run. Evidence: `/tmp/sparks-pass3-arcade-active-release-probe.log` and `/tmp/sparks-pass3-arcade-layout-settled.log`.

The successful final run completes every source, database, audit, official-build, compiled-browser, cross-browser, responsive and database-lint/advisor stage without bypassing a gate. Database snapshot/batch/permission/aggregate comparisons retain function and ACL contracts. Final UI and database fixtures clean up their disposable resources. Remote CI execution, publication and physical-device acceptance were not performed. The final assessment and outstanding lower-priority limits are listed at the top of this report.
