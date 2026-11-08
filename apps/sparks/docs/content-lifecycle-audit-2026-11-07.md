# Sparks content lifecycle: audit and implementation plan

Historical audit. Update on November 8: the school JSON catalog was removed after the database lifecycle release. References below describe the pre-cleanup state. Current behavior is documented in [content operations](content-lifecycle-operations.md).

Date: 7 November 2026. Source baseline: `2cefa05b39a0d53b44b583a12dc306fe93affeb9` (upstream/main). Scope: vocabulary authoring, publication, assignment availability and preservation of student work. This is a read-only production audit, not an implementation or migration approval. No application or production data changed.

## Conclusion

Keep the database and immutable published versions. The core design already has useful safeguards; replacing it wholesale would create unnecessary risk. Complete the missing content lifecycle around it: enforce the required-activity policy, make draft versus published changes explicit, provide controlled updates and retirement across classes, and detect violations before students encounter them.

The earlier description of GitHub and the database as competing live sources for signed-in students was too broad. Signed-in student vocabulary lists use class assignments; their content comes from database snapshots. GitHub files serve catalog/demo/import paths. The problem is not evidence that the database forgets saved work. It is incomplete policy enforcement and inconsistent change semantics.

## Evidence and current flow

Paths below are relative to the repository root. Line references identify the audited baseline.

| Component | Current role | Evidence |
| --- | --- | --- |
| GitHub vocabulary JSON / manifest | Bundled catalog, preview/demo and teacher source material | `apps/sparks/js/services/vocabularyLoader.js:28`; `js/teacherVocabularyStorage.js:110` |
| Teacher browser storage | Local drafts, including recovery after cloud-save failures | `apps/sparks/js/teacherVocabularyStorage.js:34`; `js/teacherVocabularySaves.js:31` |
| `public.vocabularies` | Editable school library | `apps/sparks/js/services/vocabularyRepository.js:95` |
| `private.class_material_versions` | Frozen student content and private assessment material | `apps/sparks/supabase/migrations/20260908205517_private_class_assignments.sql:3` |
| `public.class_assignments` | Class, published version, release/due/close dates and withdrawal | Same migration, line 18 |
| Signed-in student list/detail | Database assignments, not catalog fallback | `apps/sparks/js/student/studentActivityVocabularyDataMethods.js:87`, `:296`; `js/services/classroomRepository.js:167` |
| Placement metadata | Month/week/trimester/date still read from editable library | `apps/sparks/supabase/migrations/20261014164032_assignment_vocabulary_placement.sql:3` |

Flow: bundled source or teacher draft → saved school library → atomic publication → immutable version plus class assignments → student reads and server-verified attempts. Demo/local paths are separate. Student progress and grades remain separate records; they must not be recreated when content changes.

### Existing strengths to preserve

- Initial multi-class publication is already transactional. It locks the target classes, checks access to all of them, creates one version and inserts assignments together. It rejects mixed schools and unavailable classes.
- Publication keys and an advisory lock prevent duplication on retry. The teacher dialog retains the submitted payload after an uncertain failure. Evidence: `20260917131024_school_classroom_ownership.sql:210`; `js/teacherAssignmentPublisher.js:53`.
- The publisher explicitly says editing Library does not change published work. Snapshot behavior is intentional, although that warning alone is insufficient for maintenance.
- Foreign keys protect referenced vocabulary rows from deletion. Live constraint inspection confirmed no cascading deletion from vocabulary to published versions. A failed delete is not evidence of partially deleted assignments.
- Student class reads have account/school generation guards and bounded freshness. Detail loading refreshes the assignment before showing activities. Evidence: `js/student/studentClassSelection.js:53`; `studentActivityVocabularyDataMethods.js:313`.

## Findings

### High: the minimum activity rule can regress

Your rule is Flashcards plus at least one distinct, playable other activity; existing sets with three required activities remain valid.

The teacher editor only protects Flashcards and a minimum of one required activity (`js/teacherVocabularyActivityFlowMethods.js:24–85`). The SQL normalizer returns a configured singleton Flashcards list unchanged (`20260815225000_align_server_activity_rotation_with_catalog.sql:22–35`). A read-only call to the live function on a synthetic row returned `["flashcards"]`. No real vocabulary was inserted or updated.

This proves a policy gap, not that current assignments are wrong. Fresh live inventory found **170 open or scheduled vocabulary assignments across nine classes**, all containing Flashcards plus another activity: 151 have two required activities and 19 have three. This inventory includes future releases and excludes withdrawn/closed assignments. It checks declared requirements, not every activity in a student browser.

Evidence receipts: `output/sparks-content-audit-2026-11-07/live-required-activities.json` and `server-policy-probe.json`.

### High: updating existing published work is not a complete product workflow

The inspected repository interface exposes publish and single-assignment withdrawal, but no controlled revision of existing publications (`js/services/classroomRepository.js:155–158`). Library saves use direct upsert/update; they do not revise the published content. The recent repairs therefore needed targeted operator scripts to replace versions and repoint selected assignments.

That is manageable for an exceptional repair, but insufficient as the normal way to maintain requirements across classes. Automatic synchronization of all snapshots would be equally unsafe: it could change what already completed work means.

### Medium: different fields have different update behavior

Words and requirements are frozen at publication, but assignment placement is read from the current library row. The student mapping overlays that placement onto snapshot content. Moving the library month/week can therefore affect published units while changing their activities does not. These may be legitimate operations, but their scope needs a visible preview and explicit ownership.

### Medium: library saves lack an expected revision

`vocabularyRepository.save/update` writes by school and ID without a compare-and-swap revision. The save coordinator protects the current local document/session, but this is not a cross-tab or cross-teacher conflict check. Concurrent overwrite is a credible code-level risk; this audit did not reproduce a lost edit in production.

### Medium: deletion and retirement are poorly distinguished

Library removal calls DELETE and reports a generic failure. Published references are protected by foreign keys, while withdrawal operates on one assignment. Provide archive/retire operations and a list of affected classes, instead of making teachers infer why deletion failed. No evidence found here supports the claim that the reported incidents were caused by half-deleted content.

### Verification gap: passing a release is not a classroom data audit

The November 4 architecture report primarily establishes local engineering checks. Its broad reliability scores should not be treated as evidence that every live assignment meets a newly specified teaching rule. Keep release validation, live policy inventory, authenticated workflow acceptance and real-device acceptance separate.

## Proposed ownership and behavior

1. **Database library:** authoritative editable school content. GitHub catalogs remain explicit starter imports/demo fixtures; deployments must never silently overwrite school edits. Record import source and checksum for traceability.
2. **Published version:** immutable evidence of what was assigned. Preserve old versions and their assessment material. Do not expose private answers through revision history.
3. **Class assignment:** owns availability and class-specific placement. Initialize placement from the library when publishing; later library moves affect future publication only. A teacher can explicitly move selected existing assignments with a preview.
4. **Student attempts and grades:** retain the content version and policy revision they were evaluated against. Audit existing provenance first; add only missing links. Never infer that old completion proves mastery of newly changed words.
5. **Local storage:** recovery drafts and queued work, never authoritative shared content. Clearly label unsynchronized drafts and retain them until a successful version-checked save.

## Implementation sequence

### Phase 1 — Enforce the teaching rule at the write boundary

- Implement one server policy validator used by publication and any future revision operation. Validate known activity IDs, uniqueness, Flashcards first, at least one other required activity, required/optional/hidden consistency, and playable content for every required activity.
- Drafts may be incomplete, but cannot be published until valid. Prefer clear rejection over silently replacing a teacher's chosen activity.
- Update teacher controls and catalog validation to the same semantics. Use shared case fixtures for JavaScript and SQL; client validation is feedback, server validation is authority.
- Inventory existing publications before adding constraints. Do not rewrite withdrawn/closed historical evidence just to satisfy a current policy.
- Exit: singleton, empty, duplicate and unplayable required sets fail publication even through direct authenticated API calls. Existing valid two/three-activity sets still publish.

### Phase 2 — Versioned library saves and explicit publication status

- Add monotonic library revision and expected-revision save RPC. A stale save returns a conflict with a recoverable local draft, not a success or silent overwrite.
- Show “Draft saved”, “Published to …”, and “Changes not yet applied to …” beside the editor. Display which fields differ and the affected classes.
- Preserve existing publication idempotency. Extend it with the expected library revision/content fingerprint so the teacher publishes the version previewed.
- Exit: two teachers editing the same vocabulary cannot silently overwrite one another; a timeout retry returns the same committed publication.

### Phase 3 — Controlled update, move and retirement workflow

Extend the existing classroom domain interface with narrow operations: preview change, apply change, retire selected assignments. Avoid a new generic data framework.

- Preview returns exact assignment IDs, expected revisions, content changes, dates, students with work, affected requirements and a change classification.
- Apply revalidates authorization, revisions and policy inside one database transaction; locks in deterministic order; updates all selected classes or none; records actor, reason, request key and before/after versions in a receipt.
- Requirements-only changes may preserve assignment IDs and compatible completed activities. Keep history; added activities become outstanding without erasing previous work or re-awarding completed rewards.
- Word/answer changes after work begins need a replacement assignment or an explicit version-aware migration. Default to a replacement, preserving the old assignment and grades. Never simply repoint an assignment and reinterpret existing grades.
- Metadata-only changes retain attempts and grades. Move placement to assignment ownership with an explicit bulk reschedule operation.
- Retire archives library content and withdraws explicitly selected live assignments. Existing work remains available to authorized teachers. Physical deletion is limited to unused drafts, with reference checks in the same transaction.
- Exit: injected failure in any selected class changes none; concurrent revision produces a conflict; repeated requests cannot duplicate changes; completed work and grade history remain intact.

### Phase 4 — Stale clients, offline work and availability

- Include assignment/content revision in read models, attempts and revision-sensitive cache keys where missing. Successful mutations invalidate the affected library, assignment, progress and teacher summary views.
- Preserve account/school guards and server authorization. Refresh on focus and after relevant changes; realtime can improve responsiveness but is not required for correctness.
- Test an old tab completing work after a revision or withdrawal. The server either accepts against its original valid attempt context or returns a recoverable conflict. Never silently attach queued work to different content.
- Keep offline submissions until acknowledged or explicitly resolved. Do not clear IndexedDB/local drafts as a migration shortcut.
- Exit: release/close/withdrawal agrees between list, detail and activity launch; stale tabs cannot bypass it; queued work cannot be credited to the wrong version.

### Phase 5 — Reconciliation, rollout and acceptance

- Add a read-only consistency command covering all schools/classes: policy violations, dangling references, mismatched placement, unplayable requirements, legacy assignments and revision/provenance gaps. Report intentional snapshot differences separately from defects. No automatic overwrite of teacher work.
- Run in CI on fixtures and before promotion against bounded hosted metadata. Run periodic production checks only after explicitly configuring their schedule/owner.
- Rehearse additive migrations on a disposable restored database. Keep sanitized manifests in the repo; private backups and assessment keys stay outside it.
- Backfill assignment placement to exactly what students currently see; preserve IDs, dates, requirements, attempts, rewards and published grades. Verify counts and content hashes before/after, with exceptions reviewed explicitly.
- Roll out to one test class first, then all groups. Keep old reads compatible during rollout. Once new student work references new revisions, rollback must preserve that work; use a forward repair rather than restoring an old snapshot over it.
- Release through existing validation and exact-artifact promotion. Verify the hosted build and hosted schema separately, then teacher/student acceptance on desktop and a school device.

## Acceptance matrix

| Scenario | Required result |
| --- | --- |
| Flashcards only, empty, duplicate or disabled required activity | Publication rejected with actionable explanation |
| Two or three valid required activities | All selected groups receive exactly the reviewed requirements |
| Unauthorized class included | No assignments or versions created |
| Timeout after commit, then retry | Same receipt and assignment IDs; no duplicates |
| Two teachers or stale browser saves | Conflict preserves both recoverable edits |
| Library edit | Existing publication stays unchanged and clearly marked as different |
| Requirements update after completion | Compatible credit retained; added work visible; no duplicate rewards |
| Words/answers change after grading | Historical grades remain tied to original content |
| Retire across classes with injected failure | All-or-none; student records preserved |
| Old tab/offline completion after change | Correct original version or explicit recoverable conflict |
| Close date passes / assignment withdrawn | List/detail/launch agree; server enforces access |
| Deployment only changes catalog | Existing classroom publications remain unchanged |

## Boundaries and remaining uncertainty

This audit traced the relevant current source and ran read-only live inventory, constraint inspection and a policy-function probe. It did not run a new full release suite, mutate production, simulate concurrent teacher edits against production, or perform physical-device acceptance. The 170-assignment count does not cover every historical withdrawn/closed vocabulary. Full attempt/grade provenance and offline queue compatibility require the Phase 3/4 schema and integration audit before implementing revisions.

Do not rewrite authentication, rewards, grading calculations, or the release system unless a focused test identifies a related defect. The prior Pages error is a separate delivery failure; it does not prove a content persistence defect. Retain the existing atomic publication and immutable history, and improve the operations around them.
