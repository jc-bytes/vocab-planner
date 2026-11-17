# Sparks activity results: single-agent design review

Date: 2026-11-15  
Original reviewed baseline: [finalized design](activity-results.md), 769 lines before the R1 amendment  
Original reviewed baseline SHA-256: `c64fb2258580479845ba50e96269274bbb8e3901010b744d4ecb0b2e334d5b39`  
Method: One agent applying the EGM review checklist. The user expressly prohibited subagents. No reviewer delegation, isolated context, independent Goldfish review or simulated panel was used.  
Current verdict after the 2026-11-16 resolutions: All five reported findings are resolved in design. No finding from this review remains open. Proceed to implementation using the amended design and its verification gates; runtime verification, authenticated acceptance and capacity evidence remain pending.

## What this proposes

Give all eleven vocabulary games and both reading-check multiple-choice paths the same explainable result system. Calculate up to 950 points from exact weighted performance and up to 50 from recorded answer time, retain original outcomes through corrections, and keep passing targets separate from competition. Save versioned tasks and attempts for offline use, validate them on synchronization, and publish each student's best eligible full attempt on a school/grade/task board. Keep existing progress and reward schedules through a transactional compatibility bridge.

## How the existing system works, per this document

The current application already saves activity progress, server-created attempts, general work time and rewards. The existing score field has different meanings across games, and the current timer includes work that the new speed score excludes. Reading forms combine multiple-choice answers with writing and permit updates, while the current leaderboard serves arcade games. The new learning result cannot safely be inferred from these existing percentages or presented as confirmed merely because an offline write was queued.

## Review outcome

The product behavior is understandable, and this review found no reason to reopen the 950/50 allocation, five-star maximum, personal completion targets, best-score boards, replacement-computer access or saved-timer recovery. The baseline review identified consequential choices requiring resolution. The amendments now define those choices. The original findings below remain for traceability; they are not claims that an implemented feature has failed.

The order below prioritizes reward integrity, a usable synchronization contract, then scoring and publication details. The original findings and their line references below describe the reviewed baseline identified above. All five have since been addressed in the design as recorded below. No application implementation has been made through this review/resolution work.

## Findings

### R1. Major: isolate compatibility attempts from legacy mutations and reconcile lock order

**Status, 2026-11-16:** Resolved in design, pending implementation and real SQL acceptance. See the [reward-protection resolution](reward-protection-resolution.md). Original finding follows for traceability.

**Evidence.** The design at lines 601–609 creates a same-UUID compatibility row in `private.student_activity_attempts`, retains old RPCs and adds a new trusted reward bridge. It excludes these rows from legacy reuse/cleanup, but does not explicitly require every legacy progress mutation to reject a learning-owned compatibility row. At line 561, new writes lock the progress-summary row before the attempt row.

The current [strict legacy progress implementation](../../../supabase/migrations/20261026121540_simplify_progress_compatibility_and_row_lock.sql), lines 81–100, accepts an owner/unit/activity-matching attempt, locks that attempt first, then calls the older progress procedure. The [older progress procedure](../../../supabase/migrations/20260816054503_direct_normalized_student_progress_operations.sql), lines 702–709 and 764–781, also operates on the legacy attempt and progress records. Its completion and reward effects have a separate validation contract. The [current summary initializer](../../../supabase/migrations/20260917131024_school_classroom_ownership.sql), lines 1382–1385, takes the summary row lock after the legacy path has locked its attempt. The [legacy startup procedure](../../../supabase/migrations/20260822144658_replace_expired_activity_attempts.sql), lines 57–71, deletes/reuses unfinished attempts by time.

**Why it matters.** A legacy entry point must not be able to mutate a learning-owned compatibility row during any unfinished/correction window. Otherwise it can create conflicting progress or reward effects outside the new validator. If both paths can touch the same rows, the new summary-then-attempt order and the old attempt-then-summary order can also deadlock. The current plan does not define when the compatibility row receives its finished marker, so the old finished-row shortcut is insufficient as the stated protection.

This is a missing guarantee, not a demonstrated exploit against new code. The feature has not been implemented.

**Required correction.** Define a durable server-owned learning discriminator and the exact point at which a compatibility row is created/finished. List all legacy mutators and reuse/cleanup functions to amend. Require legacy mutation paths to reject or safely return an already-confirmed snapshot for learning-owned rows before taking conflicting locks or applying rewards. Preserve historical legacy behavior for ordinary legacy rows. Specify a compatible lock order for every path that can still share rows. Keep large evidence in the new tables; compatibility details should contain only bounded references and bridge checkpoints.

**Acceptance.** In real SQL tests, replay an old progress RPC against a learning-owned attempt before finalization, after score lock, during corrections and after completion. It must not change the locked result, progress, help state or reward ledgers. Run overlapping legacy/new writes and duplicate deliveries and prove no duplicate XP/coins, partial commits or lock-order deadlock. Test legacy startup after seven days and confirm it neither reuses nor deletes linked learning work.

### R2. Major: the chunk limit and terminal-submission contract disagree

**Status, 2026-11-16:** Resolved in design, pending implementation, browser/SQL parity and delivery/capacity acceptance. See the [evidence-delivery resolution](evidence-delivery-resolution.md). Original finding follows for traceability.

**Evidence.** Line 512 permits up to 8 MiB of attempt evidence but caps each delivery chunk at 256 KiB. The checkpoint RPC at line 550 can send appended events or cumulative replay, and the finalization RPC at line 551 requires "complete submitted evidence." Lines 585–587 require atomic local chunks and complete-hash validation, without specifying the wire-level assembly contract.

**Why it matters.** An otherwise valid attempt can exceed one request. The design does not say whether finalization resends the full evidence, references already accepted events, or assembles numbered chunks. It also leaves the byte-counting representation, sequence boundaries, acknowledgements and interrupted-upload recovery unspecified. Two implementations could agree on every score rule yet be unable to synchronize the same attempt.

A standalone JSON example with 330 response events was 307,153 bytes. It fits the 8 MiB attempt cap and exceeds the 262,144-byte chunk cap. This demonstrates the contract mismatch; it is not a test of an implemented RPC.

**Required correction.** Define one append protocol with exact fields for sequence range, previous accepted hash, chunk hash, expected revision and stable operation ID. Measure limits over a specified UTF-8 canonical representation. Require each accepted chunk to be an immutable extension. Finalization should send the terminal sequence/hash, writing reference and finish declaration, and validate the accepted server evidence without resending the whole attempt. Define duplicate, overlap, missing-prefix, stale-revision and lost-acknowledgement responses. Make the browser and database fixtures use the same hash serialization.

**Acceptance.** Upload an attempt exceeding 256 KiB through multiple chunks; disconnect between chunks; lose a chunk acknowledgement; retry it; and finalize once. The final result and rewards must match an uninterrupted delivery. Missing, altered, reordered and overlapping chunks must fail without deleting pending local work or creating partial terminal effects.

### R3. Major: untimed Crossword corrections can affect an unscored crossing word

**Status, 2026-11-16:** Resolved in design, pending implementation and the corresponding runtime acceptance cases. See the [remaining-findings resolution](remaining-findings-resolution.md#r3). Original finding follows for traceability.

**Evidence.** Line 567 propagates assistance for explicit reveals. Line 577 says to hide or disable unscored work during correction mode, but does not specify what happens when a correction changes a shared cell belonging to an unscored word.

The existing [Crossword interaction methods](../../../js/activities/crossword/crosswordInteractionMethods.js), lines 2–6 and 215–219, write cell values into the shared grid. The [grid-state methods](../../../js/activities/crossword/crosswordGridStateMethods.js), lines 210–237, derive each word's answer from those same coordinates. Disabling another word's inputs does not isolate its letter state.

**Why it matters.** Suppose a student first checks an incorrect across word while an intersecting down word remains unscored. Correcting the across word while the stopwatch is paused can supply a letter to the down word. The plan does not say whether that letter transfers, whether it counts as assistance, or whether the down word's original draft is restored. This can change both partial credit and recorded answer time.

**Required correction.** Define the phase order explicitly. The smallest remedy is to defer required untimed Crossword corrections until every word has a locked original check. Timed work may continue before that boundary, with already-locked scores unchanged and explicit reveals retaining their assistance effects. Once every original result exists, stop the puzzle timer and perform corrections with no unscored words remaining. If earlier untimed corrections are retained, specify independent word drafts and assistance propagation instead; hiding the grid alone does not settle the scoring semantics.

**Acceptance.** Use at least two intersecting words. Lock a partly wrong original answer for one while the other remains unscored, then exercise correction, reveal, pause and resume. Prove that no unscored answer gains uncharged work or unrecorded assistance and that neither original result is overwritten. Include the resulting combo and timer expectations.

### R4. Major: puzzle publication has no selected generation owner

**Status, 2026-11-16:** Resolved in design, pending implementation and the corresponding runtime acceptance cases. See the [remaining-findings resolution](remaining-findings-resolution.md#r4). Original finding follows for traceability.

**Evidence.** Line 518 requires bounded seeded generation and at least one complete valid layout before publication. The manifest assigns generation to browser module `js/learningResults/task.js`, while publication/preparation happens through database RPCs at lines 548 and 555. The preparation operation may "publish/reuse a valid task if needed." No contract states how a browser-generated candidate reaches that publication operation, or that the database will implement its own generator.

**Why it matters.** Independent validation can reject an invalid layout, but it does not generate the first layout. An implementer still has to choose browser generation plus server registration, a separate server runtime, or generation inside SQL. That choice affects payloads, deployment and the supposedly complete file manifest. The phrase "validated layout variants or ... schedule specification" also leaves the package representation undecided for puzzles.

**Required correction.** Select the generation owner without adding a service by implication. A small option is for the authorized teacher's browser to generate candidate layouts in the listed module, submit them through the revision-checked publication operation, and have SQL independently validate them against authoritative selected content before storing them. The student preparation operation then reads a published task rather than generating/publishing a missing puzzle. Specify candidate/layout fields, seed/version identity, stored validated variants and how a new attempt chooses a variant. If SQL generation is preferred, name that private operation and its exact algorithm/version instead.

**Acceptance.** Publish a puzzle through the actual selected path, download it, start offline, resume and synchronize it. Reject candidates with omitted words, invalid intersections, invalid seeds/variants or mismatched content. A student preparation request must not silently create an unvalidated layout or require an undeclared backend service.

### R5. Medium: alphabetical tie paging is not covered by the board revision

**Status, 2026-11-16:** Resolved in design, pending implementation and the corresponding runtime acceptance cases. See the [remaining-findings resolution](remaining-findings-resolution.md#r5). Original finding follows for traceability.

**Evidence.** Line 539 increments board revision when a best entry changes. Lines 554 and 619 order tied entries using directory display names and use that revision to detect changed pages. No invalidation is specified when a directory name changes while points/time remain equal.

**Why it matters.** A cursor based on name and ID can miss or repeat students if a directory name moves across the cursor between requests while the board revision stays unchanged. A standalone 101-row tie example reproduced both outcomes: renaming a student already shown on page one placed them on page two as well; renaming the unseen 101st student before the cursor made them disappear from the traversal. Neither scenario needs a changed score or time.

**Required correction.** Define a stable ordering snapshot for a paged read or make changes to all ordering inputs invalidate the board cursor. This includes normalized display-name changes. Preserve the approved current-name alphabetical order when refreshing; do not silently switch the tie order to ID-only. Identify any additional directory-update owner or storage fields in the manifest if required.

**Acceptance.** Read the first page of a tie larger than 100, rename a student across the cursor, then request the next page. The client must get either a consistent snapshot or a board-change response and refresh. An uninterrupted traversal must contain each eligible student once and retain the student's shared competitive rank.

## Results of the original five checklist passes

| Pass | Result |
| --- | --- |
| Initial zoom out | Objective and scope are understandable. Shared scoring plus separate evidence/results addresses the different meanings of existing progress. The compatibility bridge is the largest integrity risk, covered by R1. |
| Comprehension | The paraphrases above can be derived from the document. No missing product context blocked understanding. Publication ownership and evidence delivery cannot be reconstructed uniquely, covered by R2 and R4. |
| Design critique | Reviewed scoring, corrections, timing, offline access, rewards and ranking. The Crossword crossing case and tie paging need explicit behavior, covered by R3 and R5. |
| Intermediate zoom out | The findings can be resolved within the selected architecture. No evidence here requires another database, device restrictions, a new reward schedule, extra combo points or a smaller product scope. This was another checklist pass by the same agent, not an independent reviewer. |
| Implementation readiness | Changes required. R1–R4 leave consequential server, scoring or delivery choices to the implementer. R5 should also be settled before board pagination is built. |

## Checks performed and limits

- Read the finalized design and the EGM zoom-out, feature-specification and implementation-readiness standards. Used the comprehension checklist to write the two paraphrases above. The approved brief was already in the same conversation context; fresh-context isolation is not claimed.
- Inspected the current local source for legacy progress writes, XP/progress boundaries, stale-attempt cleanup, Crossword shared cells, sync scheduling and test/build conventions. Findings concern the local design/source, not deployed behavior.
- Ran small standalone Python models for a valid-sized multi-chunk attempt and name changes during tie paging. These models substantiate the specific counterexamples, not the future implementation.
- Checked report links, referenced design/source line locations, the unchanged target digest, and the final/draft copy match.
- Did not run feature tests, SQL migrations, a database exploit/reproduction, authenticated browser acceptance, performance load tests or a classroom pilot. No application code or approved scoring rule was changed.

## Resolution status and handoff

All five findings are resolved in the amended [design](activity-results.md) and matching [draft](design_draft.md):

| Finding | Design resolution | Implementation evidence |
| --- | --- | --- |
| R1, Major | Typed compatibility isolation, guarded legacy paths, summary-first shared locks and one trusted learning reward path | Pending real SQL isolation, reward parity, concurrency and rollback acceptance |
| R2, Major | Bounded sequential append, exact receipt/head recovery and terminal submission by accepted evidence reference | Pending browser/SQL canonical parity, interrupted delivery and capacity acceptance |
| R3, Major | All original Crossword checks precede untimed corrections; timed edits and explicit reveal assistance remain distinct | Pending actual shared-grid adapter, phase/timer/combo/recovery acceptance |
| R4, Major | Teacher-browser generation, independent atomic SQL publication, stored validated variants and read-only student preparation | Pending teacher-to-offline-student publication/validation integration |
| R5, Medium | Single-snapshot reads with both score revision and complete eligible-ordering digest bound to the cursor | Pending actual rename/membership paging and measured digest-query capacity |

The original review baseline digest and findings are retained above. The [reward](reward-protection-resolution.md), [evidence](evidence-delivery-resolution.md) and [remaining-findings](remaining-findings-resolution.md) records explain each amendment and its verification limits. Documentation and standalone models do not substitute for the design's implementation gates.

This completes the requested single-agent design review and resolution. It does not complete an independent Goldfish review, application implementation, database migration, deployment or classroom acceptance. No additional design finding is currently open from these five; future implementation failures must be recorded with their actual evidence.
