# Sparks activity results and mastery audit

Author: pjrios
Date: 2026-11-14
Status: Historical local audit of the 2026-11-14 working copy. Consolidated on 2026-11-15. Approved product rules and current gaps are maintained only in [concepts_brief.md](concepts_brief.md). No independent Goldfish review has run.

## Scope and evidence limits

The activity table and existing-behavior findings below are historical code observations, not descriptions of the approved future scoring rules. Do not treat an old audit question as an unresolved product decision; consult the authoritative brief.

This audit covers the local vocabulary activities in apps/sparks, their progress pipeline, SQL migration definitions, and arcade leaderboard code. It does not establish the deployed website or database version. The workspace has substantial existing changes, including activity code. These findings describe that working copy. No application files or database data were changed for this audit.

The audit was extended during clarification to reading checks and classroom Spark check forms. These use different assessment paths from vocabulary activities. Teacher quiz creation/export tools do not by themselves establish an additional student auto-scored activity.

## Main finding

Sparks already distinguishes a finished attempt from a mastered activity, saves best and latest attempts, requires verified completion for signed-in progression, and awards server-controlled rewards. The proposed feature should build on those records.

The main gap is that scores mean different things across activities. A score of 100 often means all items were eventually completed, even when the student made mistakes. It must not become 100% accuracy or five accuracy stars by default.

## What exists by activity

| Activity | Current completion rule | Evidence available for a result screen | Planning consequence |
| --- | --- | --- | --- |
| Quiz | Answer every question and reach at least 80% accuracy | Correct and answered counts; accuracy; finished and mastered status | Already supports a failed finished run and replay. The 80% target is hard-coded in the client and server rules inspected. |
| Synonym/Antonym | Answer every question and reach at least 80% accuracy | Same main evidence as Quiz | Same existing mastery distinction as Quiz. |
| Flashcards | Eventually answer every card's mastery question correctly | Mastered cards; first-attempt correct cards; cards attempted | Students can correct mistakes within the activity. First-attempt accuracy and eventual mastery are different measures. |
| Matching | Complete the required sets and pairs | Correct pairs, attempts, accuracy, completed sets, local round timing statistics | Low selection accuracy does not currently prevent completion after all sets are solved. Confirm which timing details reach the server before using them in rankings. |
| Scramble | Solve every word; skipped or missed words prevent mastery | Correct words, attempts, skipped words, accuracy; local best streak | A finished run may remain incomplete. There is a retry-missed path, which needs checking against the full-set server evidence requirement before treating it as a passing retry. |
| Wordle | Solve every word | Solved and failed word counts; finished status | The stored action ratio describes words solved, not individual guess accuracy. |
| Speed Match | Reach 10 correct matches | Correct match count and target | Its submitted score is progress toward 10, capped at 100. A trustworthy accuracy or speed formula needs additional evidence design. |
| Fill in Blank | Complete every word correctly, with retries during play | Completed words and total | Wrong attempts are not included in the submitted result counts inspected. Do not infer accuracy from completion. |
| Hangman | Complete the word sequence | Completed words and total; local guessing state | Submitted result counts do not describe letter-level accuracy. |
| Crossword | Solve every placed word | Solved words and total; local reveal/hint state | Submitted result counts do not establish first-try accuracy or hint-adjusted points. |
| Word Search | Find every target word | Found words and total | Completion percentage is coverage, not answer accuracy. |
| Word Hunt | Separate research/evidence activity, marked non-replayable | Separate submission flow | Do not give an instant correctness rating without a justified automatic assessment. |

## Attempts, retries, and progression

- Quiz and Synonym/Antonym already show below-target completion messages and replay controls. Tests verify shuffled questions and answer ordering on fresh rounds.
- Attempt records include finished status, mastery, score, action counts where available, details, and state. Aggregate progress preserves best and latest attempts and lifetime accuracy where supported.
- Required activity gates check server-verified completion for signed-in students. The flow also supports replacement credit without inventing a score.
- Existing completion is retained when a later replay performs worse. A new display must distinguish the current run from completion earned earlier.
- Server completion validation checks access, item counts, minimum elapsed time, and activity-specific evidence. Quiz-style mastery also checks the required correct count, rather than relying only on a rounded displayed percentage.
- The inspected server rules use an 80% minimum for Quiz and Synonym/Antonym and a 100 progress score for other activities, followed by activity-specific evidence checks. Those are not equivalent accuracy targets.
- The inspected teacher activity settings include required/additional activities and time limits. This audit did not find a per-activity editable accuracy threshold in those settings.
- A teacher late-work override exists. That is not evidence of a general mastery override. Any proposed completion override needs its own design.

## Time

The work timer counts visible, focused foreground time and pauses on blur or a hidden tab. It stores time locally and reports cumulative seconds to the server. Attempts can retain a time-limit snapshot and lateness information.

This is useful classroom work-time evidence. It is not proof of cheat-resistant competitive timing. Focus changes, recovery, device speed, and client reporting need explicit rules before time affects ranking. The server also rejects implausibly quick completions, which a speed reward must not contradict.

## Rewards and presentation

- XP is server-controlled and uses activity-specific amounts. The inspected difficulty schedule ranges from 10 XP for Flashcards to 50 XP for Word Hunt.
- Required activity XP is intended for first completion per unit/activity; optional activities can earn XP on verified completed attempts. Reward retries and duplicate events already have ledger protections.
- Coins are a separate reward system. The inspected server operation awards progress improvement and a first-completion bonus using configured, bounded reward values.
- The existing shared result processor displays a temporary XP notice. Individual activities own their own summaries. There is no shared animated point calculation and star sequence in that path.
- The new display must use the confirmed reward response. A game-points total must not silently replace XP, coins, completion percentage, accuracy, or school grades.
- Pending saves and offline queues need honest wording. A local finish must not claim a saved reward or official leaderboard position before server confirmation.

## Leaderboards

The existing repository queries arcade scores by grade and game, ordered by score. Student arcade code supplies the leaderboard interface.

That grouping is insufficient for learning activities. Fair comparison needs a defined class or audience, vocabulary or assignment identity, activity, relevant settings, content version, and scoring-rule version. Different word counts, difficulty, hints, or changed content may make raw totals incomparable.

A learning leaderboard needs an explicit eligibility policy and best-attempt rule. The approved design excludes missed-only practice and incomplete runs, permits otherwise valid late full attempts, and versions comparable task settings. Timing details and evidence quality for historical attempts still need implementation design. Do not invent missing metrics for older records.

The existing server validates submitted evidence and attempt conditions. This audit does not establish that the server independently checks every student response. The strength of competitive verification needs review before official rankings.

## Focused verification

Ran from apps/sparks:

```sh
node --test tests/activity-mastery-security.test.mjs tests/student-activity-attempt-results.test.mjs tests/student-activity-work-timer.test.mjs tests/matching-activity.test.mjs tests/scramble-activity.test.mjs tests/flashcards-activity.test.mjs
```

Result: 63 passed, 0 failed. These include executable activity and timer checks plus source-contract checks for SQL definitions. No live database, hosted browser, classroom load, or physical-device verification was performed.

## Expanded historical verification

The single-agent concept review on 2026-11-14 added the reading suite to the focused run:

```sh
cd apps/sparks
node --test tests/activity-mastery-security.test.mjs tests/student-activity-attempt-results.test.mjs tests/student-activity-work-timer.test.mjs tests/matching-activity.test.mjs tests/scramble-activity.test.mjs tests/flashcards-activity.test.mjs tests/spark-reading-activity.test.mjs
```

Reported result: 70 passed, 0 failed. Both the 63-test and 70-test results are historical. Neither run executes the subsequently approved feature or establishes live database behavior, deployment parity, hosted capacity, physical-device behavior, or classroom acceptance. This documentation consolidation did not rerun those suites.

## Reading-check evidence

- `js/activities/sparkReading.js` uses `js/sparkCheckModel.js`. Multiple-choice questions have a correctness key; written answers meeting a minimum length are marked complete. Length does not prove content correctness. The question model limits a check to three questions.
- `js/classroomSparkCheckView.js` presents automatic multiple-choice feedback separately from written answers needing teacher review. Both reading-check paths need the agreed attempt/retry design.
- The consolidated design excludes written answers from automatic accuracy and finalizes the automatic result on whole-check submission, retaining writing on a full multiple-choice retry. These are approved future rules, not implementation claims.

## Source checks during consolidation on 2026-11-15

These limited checks identify remaining gaps without asserting that the whole audit has been rerun.

| Source | Observed behavior | Design implication |
| --- | --- | --- |
| `js/activities/speedMatch.js`, `pickNewDefinition`, `spawnWord`, `loop` | Random target definitions and probabilistic correct-word spawns; movement increments by pixels per animation frame. | The approved design guarantees a correct falling word per scheduled appearance and requires a paused, unscored correction after a wrong or missed answer before advancing. The approved timer starts with usable simultaneous choices including the correct word and stops on first selection or a missed correct target. Comparable movement and synchronization mechanics still need design. This is not a change to the inspected code. Brief gaps G1 and G3. |
| `js/activities/matching/matchingInteractionMethods.js`, `handleCardClick`, `resolveSelection` | Either a term or definition may be selected first; a complete pair produces one shared match or error event. | The approved design attributes a mismatch only to the selected vocabulary term's scheduled appearance. The current shared error event needs per-appearance evidence to implement that rule. Brief G1. |
| `js/activities/sparkReading.js`, `saveAnswers`, `getScore`, form submission | Evaluates the submitted form together, allows later updates, and currently represents an eventual completed check with a 100 progress score. | The approved design locks automatic answers on whole-check submission, then shows score and combo feedback. Separate submission completeness, correctness, and a new full retry. This differs from the inspected editable-update path. Brief G2. |
| `js/sparkCheckModel.js`, `evaluateSparkAnswers` | `isComplete` requires every result to be `correct`; written-response `correct` means sufficient length. | Official below-target full submissions must be representable. Do not reuse this flag or mixed count as automatic scoring. |
| `js/activities/crossword/crosswordGridStateMethods.js`, `crosswordInteractionMethods.js`, `crosswordLifecycleMethods.js` | Grid placement uses uppercased raw words; checks require the active word filled; reveals mark the active word locally; completion counts placed/solved words. | Align grid construction with the approved normalization, preserve first-submission letter credit, and propagate reveal assistance to affected unscored crossing words. Do not silently omit configured words. |
| `js/activities/wordSearch/wordSearchPointerMethods.js`, `handleMouseUp` | Marks a matched unfound word found; invalid or duplicate selections clear without a scored error. | Preserve the approved no-penalty drag behavior. Add assistance and timing evidence rather than inventing a first-drag accuracy measure. |

## Risks retained for design and validation

- Repeating a whole set can reward memorizing its answers and consume class time without improving understanding.
- Shuffling card order and answer choices reduces answer-position memorization but does not create new questions. Small vocabulary sets still allow content memorization, which may support learning but limits what a competitive score proves.
- Counting a corrected subset as a full competitive attempt can inflate scores. Treat learning recovery and leaderboard eligibility explicitly.
- Adding a third number called points can confuse students who already see scores, XP, and coins.
- Required speed can disadvantage careful readers and students using support tools. A time bonus must not redefine mastery by accident.
- Ranking students publicly may discourage students who improve but remain below the top. Personal progress should still be visible.
- Celebrations must distinguish mastery, a finished below-target run, an already-completed replay, and a pending save. They need reduced-motion support, keyboard access, and a way to skip repeated animation.
- Public rankings increase the incentive to manipulate client-reported evidence. The current verification boundary needs to be described honestly.

These risks explain needed checks; they do not reverse approved choices. The user selected best-attempt rankings, personal completion targets, a small speed component, visual-only combos, and versioned same-school boards.

## Source map

Paths below are relative to apps/sparks.

- `js/student/studentActivityRegistry.js`: activity inventory and replay flags.
- `js/activities/quiz.js` and `js/activities/synonymAntonym.js`: 80% mastery rules and result/replay screens.
- `js/activities/flashcards.js`: eventual mastery and first-attempt counts.
- `js/activities/matching/matchingRoundMethods.js`: progress, selection accuracy, set completion.
- `js/activities/scramble/scrambleLifecycleMethods.js`: score, finished status, restart and retry-missed behavior.
- `js/activities/wordle.js`, `speedMatch.js`, `fillInBlank.js`, and `hangman.js`: individual completion and result evidence.
- `js/activities/crossword/crosswordLifecycleMethods.js` and `js/activities/wordSearch/wordSearchLifecycleMethods.js`: puzzle completion evidence.
- `js/student/studentActivityAttemptService.js`: submitted evidence, metrics, and finished-run detection.
- `js/student/studentActivityResultProcessor.js`: server result application and XP notice.
- `js/student/studentActivityAutoSave.js` and `studentActivityFlowConfig.js`: saved progress and required activity flow.
- `js/student/studentActivityWorkTimer.js`: foreground timing and reporting.
- `js/services/leaderboardRepository.js` and `js/student/studentGameLeaderboardMethods.js`: arcade board query and display.
- `js/teacherVocabularyActivityFlowMethods.js`: teacher activity time-limit settings.
- `supabase/migrations/20260816054503_direct_normalized_student_progress_operations.sql`: normalized completion validation, retained completion, XP and coins.
- `supabase/migrations/20260815193743_uncapped_difficulty_based_activity_xp.sql`: difficulty-based XP schedule.
- `supabase/migrations/20260816174250_activity_attempt_results.sql`: finalized attempts, metrics, best/latest records, historical capture quality.
- `supabase/migrations/20260821022218_tolerate_inconsistent_flashcard_accuracy_counts.sql`: optional metrics compatibility wrapper.
- `supabase/migrations/20260821022219_add_active_activity_time_limits.sql`: attempt timing and late-work override.
- `supabase/migrations/20260822144658_replace_expired_activity_attempts.sql`: resumed and expired attempt handling.

Additional source anchors used in the earlier concept review:

- `js/student/studentActivitySyncCoordinator.js`: pending saves, deduplication, and ownership checks.
- `js/sparkCheckModel.js`, `js/activities/sparkReading.js`, and `js/classroomSparkCheckView.js`: the two reading-check paths and their evaluator.
- `supabase/migrations/20260909033212_assignment_vocabulary_activity_context.sql` and `20260909033621_private_workspace_access_cutover.sql`: assignment/context and optional-metric compatibility wrappers.
- `supabase/migrations/20261026121540_simplify_progress_compatibility_and_row_lock.sql`: later strict finalizer, idempotency, and best-attempt selection using the old score. Its presence does not establish deployment or suitability for the new game points.

## Offline planning boundary

The approved design allows a new scored offline attempt only from a complete previously downloaded activity and scoring settings. Work without that preparation is practice only. Download and validation mechanics still need design; this audit does not establish an existing scored-offline download feature. See the brief's approved offline rules and G4.

## Help-counter planning boundary

The approved design clears the active help flag and resets its two-failure counter when the student passes. Two new full below-target attempts after that pass trigger the flag again. Preserve earlier attempts, help history, and earned completion. This is a planning rule, not an audited implementation claim. See the brief's completion/support rules and G5.

## Shared-puzzle timing planning boundary

The approved design uses one scored stopwatch per whole Crossword or Word Search puzzle. Count active scored work once, pause for help, corrections, feedback, and interruptions, and preserve accumulated time on resume. Stop once every word has its scored result. This is a future timing rule, not a claim that the inspected puzzle callbacks already capture those intervals.

## Reading timing planning boundary

The approved design separates reading, multiple-choice, and writing sections and counts only time in the multiple-choice section toward speed. Switching to reading or writing pauses scored time and hides the multiple-choice questions, preserving choices and accumulated time. Answers lock and score/combo feedback appears on whole-check submission. This requires new section and timing behavior; the existing form does not establish it.

## Current planning handoff

The [consolidated brief](concepts_brief.md) replaces the duplicated conversational decisions previously appended here. The [working hypothesis](working-hypothesis.md) retains their planning context and superseded alternatives. The product decisions under G1-G5 are now approved; their remaining engineering mechanics require detailed design and verification before implementation readiness can be established. No application, database, deployment, or reward change was authorized by this consolidation.

## Design finalization on 2026-11-15

The [technical design](activity-results.md) is finalized after approval of its overview, technical plan, alternatives, and detailed implementation and verification plan. Reconciliation against the authoritative brief and subsequent user decisions found no unresolved contradictions or unapproved architecture, interface or dependency additions. The retained [drafting copy](design_draft.md) matches the final design.

Finalization changes planning documents only. Documentation checks cover local links, Markdown structure, planned versus existing verification commands, and exact scoring examples. Application implementation, feature tests, SQL rehearsal, authenticated browser acceptance, hosted migration, deployment, classroom acceptance and independent Goldfish review remain pending. Historical test results elsewhere in this audit retain their original scope.

## Single-agent design review on 2026-11-15

Completed the requested review without subagents, using the EGM checklist directly. The [review report](review_report.md) records four major findings and one medium finding: legacy compatibility/reward isolation, evidence chunk/finalization contracts, Crossword correction crossings, puzzle-generation/publication ownership, and tie-page invalidation on name changes. Implementation readiness is changes required.

The finalized design and retained draft were left unchanged during review. Source inspection and standalone counterexample models support the findings; no feature implementation, database migration, hosted acceptance or independent Goldfish review was performed. The earlier finalization entry describes the completed drafting step and does not resolve the subsequent review findings.

## R1 reward-protection design resolution on 2026-11-16

Applied the user's targeted reward-protection fix to the [final design](activity-results.md) and matching [draft](design_draft.md), without subagents. The [resolution record](reward-protection-resolution.md) traces typed compatibility isolation, the claim/finish lifecycle, legacy mutation/startup guards, shared summary-first locks, explicit completion semantics and completion-trigger exclusion. Trusted learning rewards use accepted evidence and transactional revision/ledger checkpoints.

R1 is resolved in design, pending implementation and real SQL acceptance. The [review report](review_report.md) preserves its original baseline digest and finding evidence; R2–R5 remain open. Documentation verification does not establish runtime reward protection. No application source, migration, hosted database or deployment changed.

## R2 evidence-delivery design resolution on 2026-11-16

Applied the user's next-finding instruction to the [design](activity-results.md) and matching [draft](design_draft.md), without subagents. The [resolution record](evidence-delivery-resolution.md) specifies canonical byte counting, sequential atomic evidence append, revision/hash/receipt acknowledgements, durable outbox request materialization, explicit conflict recovery and bounded terminal submission by accepted evidence reference.

R2 is resolved in design, pending implementation and browser/SQL delivery and capacity acceptance. A standalone synthetic transport model checks the protocol mechanics; documentation checks cover references and synchronization. Neither establishes implemented scoring, reward or database behavior. R3–R5 remain open in the [review report](review_report.md). No application source, migration, hosted database or deployment changed.

## Remaining review resolutions and final handoff on 2026-11-16

Under the user's instruction to finish all remaining findings, resolved R3–R5 in the [design](activity-results.md) and synchronized [draft](design_draft.md), without subagents. Crossword untimed corrections now follow every original word check; puzzle layouts are generated by the teacher browser and independently validated/published in SQL; tie cursors include a digest of current eligible ordering inputs so directory changes force a refresh. The [resolution record](remaining-findings-resolution.md) gives the contracts, examples and pending acceptance cases.

All five findings from the [single-agent review](review_report.md) are resolved in design. Standalone crossing/layout/tie models and documentation checks support the specified examples; they do not prove implemented behavior. The earlier audit entries retain the open counts at their dates/stages. Proceed to implementation using the updated file manifest and verification gates. No feature code, migration, deployment, authenticated staging or classroom acceptance was performed by this design resolution.


## Implementation checkpoint, 2026-11-16

Implementation began without subagents. Shared browser contracts, durable attempts/offline delivery and private SQL validation/reward/support/board helpers are recorded in [implementation-status.md](implementation-status.md). The local test database installs the real historical application migrations with explicit managed-service fixtures. Existing activity/reading launchers, task publication, public RPC grants, full acceptance and deployment remain pending. Do not treat the private core or its passing tests as delivery of the complete game-style results experience.
