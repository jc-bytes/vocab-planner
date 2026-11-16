# Sparks animated learning results

Author: pjrios  
Created: 2026-11-14  
Consolidated: 2026-11-15  
Status: Approved product decisions consolidated; identified product gaps resolved. The [technical design](activity-results.md) is finalized. Implementation and deployment remain pending.  
Review method: Single-agent review at the user's request. No subagents or independent Goldfish review were used.

## Overview and document authority

Give automatically scored learning activities a shared results screen that explains the current attempt, accuracy and speed points, stars, completion target, mistake review, personal best, and eligible leaderboard position. Add visual combos during play and show the attempt's longest combo at the end.

This brief is the authoritative record of the approved decisions. The [audit](audit.md) records inspected code and historical checks. The [working hypothesis](working-hypothesis.md) records the earlier direction and superseded proposals. A recommendation in this brief is not an additional user approval.

## Scope

Include all eleven scored vocabulary games: Flashcards, Matching, Quiz, Synonym/Antonym, Scramble, Wordle, Speed Match, Fill in Blank, Hangman, Crossword, and Word Search. Also include reading-check multiple-choice questions, including the reading activity and classroom check paths.

Written reading responses remain available for teacher review. They do not contribute automatic accuracy. Reading-only work and Word Hunt research do not establish automatic correctness and receive no invented accuracy score or stars. Existing arcade games remain separate.

Keep game points, stars, completion, XP, coins, and school grades distinct. These decisions do not change school grading or the existing XP and coin schedules. Grade-level examples do not authorize adding unsupported grades.

## Approved common scoring

### Weighted percentage and points

Let `p` be the exact weighted credit fraction between 0 and 1, calculated using the activity rules below. The same `100 * p` determines accuracy points, the student's completion-target comparison, and speed-bonus eligibility. It measures the agreed activity performance, such as word solving or letter-position credit; do not label every activity's result first-answer accuracy.

For ordinary question items, credit is 1 for a correct unaided first submission, 0.5 for a correct first submission after extra help, and 0 for an incorrect first submission. Average item credits across the full task. Puzzle and repeated-word rules below take precedence where they define a different unit or partial credit.

A correction cannot increase the scored credit of that item or appearance. A later scheduled appearance is a fresh scored opportunity. Normal Flashcards study, starting definitions, and ordinary puzzle information are not extra-help penalties. Assistance must stay attached to the affected item across pause, help, and resume.

For positive teacher speed target `T` and scored answer time `t`, in the same units:

```text
accuracyPoints = 950 * p
speedPoints = 50 * clamp(2 - t / T, 0, 1)
              only for a fully finished scored run with p >= 0.80
              otherwise 0
points = floor(accuracyPoints + speedPoints)
```

Calculate both components without rounding, add them, and floor the final total once. Do not floor the components separately. Use exact weighted credit for completion and bonus eligibility, not a rounded display percentage. The maximum is 1,000 points. A small speed bonus may let a slightly less accurate fast run outrank a perfect slower run; this tradeoff is approved.

At or faster than `T`, an eligible run earns all 50 speed points. At `1.5T` it earns 25, and at or beyond `2T` it earns zero. Missing the speed target does not fail an otherwise passing activity.

### Stars

| Final whole-number points | Stars |
| --- | --- |
| 0-199 | 0 |
| 200-399 | 1 |
| 400-599 | 2 |
| 600-799 | 3 |
| 800-999 | 4 |
| 1,000 | 5 |

Five stars require full weighted credit and all 50 speed points. Personal passing targets do not change points or stars. A perfect slow run can earn 950 points and four stars. Rounding and animation must not promote a submaximum result to five stars.

## Approved completion, review, and support

Teachers can set a whole-number passing target from 1% to 100%. Resolve the target in this order: individual student override, class/activity setting, then the 80% default. Show that target to the student and authorized teachers, separately from the shared scoring rules.

An individual target affects completion only. It does not rescale points, stars, rankings, or the shared 80% speed-bonus requirement. A student can pass their own target without earning speed points, or qualify for speed points while still falling below a higher personal target.

Distinguish finishing the scored task, completing required correction or review, and passing the activity. Meeting a percentage alone does not excuse an unfinished task. Apply the activity-specific finish requirements below. Preserve already-earned completion after a weaker replay.

After a full below-target attempt, require mistake review and a fresh full shuffled retry until passing. Missed-only practice does not create a new full scored result or earn completion. Original scores remain unchanged. For Flashcards, every missed card must be corrected even if the original percentage already meets the target.

After two full attempts below the student's own completion target for the assigned activity, flag them for help in the teacher view. Keep review and retries available without requiring teacher permission. Clear the active flag automatically once the student passes the activity, including its required corrections or review. Keep earlier attempts and help history. A leaderboard entry or missed-only practice does not clear the flag. Passing also resets the two-failure count. Two new full below-target attempts after that pass trigger the flag again, while earlier history and earned completion remain intact.

If failed offline attempts arrive after a confirmed pass and their timing relative to that pass is uncertain, keep the help flag cleared. Save those attempts in history, but do not count them toward reactivation unless validated evidence establishes that they started after the latest confirmed pass. Require two distinct, fully finished, below-target attempts with that clearly post-pass start to reactivate help. Uncertain uploads do not change points, normal leaderboard eligibility, previously earned completion or rewards. Duplicate uploads never count again. Do not treat a device timestamp or upload arrival order alone as proof of post-pass work.

Completion-target changes affect new attempts only. Resumed and historical attempts retain their target snapshots. Lowering a target does not retroactively pass an earlier failed attempt. A separate manual mastery override has not been approved.

## Approved rules by activity

| Activity | Scored unit and credit | Required finish or review behavior |
| --- | --- | --- |
| Flashcards | First submitted mastery answer per card. Full unaided credit, half after extra help, zero if wrong. Normal initial study is allowed. | Attempt all cards, correct every missed card, and meet the original weighted target. Corrections do not raise score. A higher score needs a full shuffled retry. |
| Quiz and Synonym/Antonym | First submitted answer per question, using full/half/zero credit. | Answer the full set. Below-target runs follow the shared review and full-retry rule. |
| Matching | First submitted pairing on each scheduled appearance. Attribute a wrong pair only to the selected vocabulary term's appearance, not to the word whose definition was selected. Average appearance credits per word, then average words equally. Use full/half/zero credit. | Finish the entire scheduled set. Corrections within one appearance do not increase credit; a later scheduled appearance can earn new credit. |
| Scramble | First submitted complete arrangement per word. Full unaided credit, half after extra help, zero for an incorrect first submission or skip. Moving letters before submission is allowed. | Attempt the full configured set. Corrections cannot increase score. Missed-only practice cannot serve as a full scored retry. |
| Wordle | One result per word. Solving within six guesses earns full credit in normal unaided play; failing within six earns zero. | Attempt every configured word. Normal intermediate guesses do not individually reduce credit. Apply the assisted-credit policy if extra help is offered. |
| Hangman | One result per word. Solving before six incorrect letter guesses earns full credit in normal play; reaching six without solving earns zero. | Attempt every configured word and retain solved/failed outcomes separately from sequence progress. Intermediate wrong letters below the limit do not individually reduce credit. Apply the assisted-credit policy to extra reveals. |
| Fill in Blank | First submitted answer per word, using the normalized letter-position partial-credit rule below. | Correct the answer before advancing, preserving its original scored credit. Attempt the full set and meet the original weighted target. |
| Crossword | First complete Check word submission, using the normalized letter-position rule below. Incomplete checks do not score. | Correct every placed word to finish and meet the original weighted target. Letters from correctly solved crossings are ordinary puzzle information. An explicit reveal marks each affected, still-unscored word assisted. |
| Word Search | Each target word earns full credit when found unaided, half after extra help reveals its location, and zero while unfound. Average across all target words. Unsuccessful drags carry no penalty. | Find every target word and meet the weighted target. All words found unaided earn 950 accuracy points, plus any eligible speed points. |
| Speed Match | First selection per scheduled appearance. Correct unaided earns 1, correct after extra help earns 0.5 if offered, and wrong or missed correct targets earn 0. Letting distractors pass is unpenalized. Average appearances per word, then words equally. | Finish the entire scheduled set instead of ending after three lost lives. Guarantee the correct word falls during every scheduled appearance. After a wrong selection or missed correct target, pause falling words and require a correct word-to-definition match before advancing. Keep zero credit for the failed appearance; exclude correction time and do not build a combo. Resolve remaining timing details under G3. |
| Reading-check multiple choice | First submitted answers in the full multiple-choice check, using the shared credit rules. Exclude written responses from numerator and denominator. | Lock the automatic answers at whole-check submission, including required written responses, and then show score and combo feedback. A full multiple-choice retry preserves previously submitted writing and creates a new scored attempt. |

### Matching and Speed Match repetition

Default to five scheduled appearances per word. Teachers may adjust the count. Every word gets the same planned number of appearances, and everyone on the same board uses the same task specification and count. Three full-credit appearances out of five give that word 60%.

Use a fixed planned schedule rather than allowing random sampling to omit some words. Each word has equal weight. Resuming retains the original schedule; a new full attempt gets its own appearance evidence. A teacher change to the count starts a new leaderboard for the changed task, preserving prior results.

### Crossword and Fill in Blank spelling credit

Before comparing the expected and submitted answers, ignore capitalization, trim leading/trailing whitespace, and remove internal spaces and hyphens from both. Thus `input device`, `inputdevice`, and `input-device` receive identical letter-based credit.

```text
letterCredit = letters matching in the same positions
               / max(expected normalized length, submitted normalized length)
wordCredit = letterCredit * 0.5 if assisted, otherwise letterCredit
p = average(wordCredit across all words)
```

Against `COMPUTER`, `COMPUTE` earns 7/8, `COMPUTERS` earns 8/9, and `COMPUTER` earns full credit before any assistance adjustment. Six correct letters out of eight after extra help earn 0.375. Each word has equal weight regardless of its length.

This is a position-based measure. Do not silently replace it with fuzzy spelling or shifted-letter alignment. It measures spelling evidence, not verified understanding of a definition. Normalize before computing lengths so ignored characters do not affect credit. Grid construction must use the same representation. Other punctuation, accents, and Unicode handling require a documented implementation policy; no broader equivalence has been approved.

### Reading submission and retries

The automatic score becomes official when the whole reading check is successfully submitted, including any required written responses. Do not wait for the teacher to review the writing. A check with no multiple-choice questions has no automatic accuracy score or accuracy stars.

On a full multiple-choice retry, keep the submitted written responses and earlier attempt results. Students do not rewrite or resubmit unchanged writing solely to improve the automatic score. Link the retained written submission to the new attempt. The retry's full multiple-choice submission satisfies the whole-check requirement with that retained writing.

Students may edit their multiple-choice choices before whole-check submission. Submission locks that attempt's automatic answers; reveal correctness, score, and combo feedback afterward. A later score improvement requires a new full multiple-choice retry. Preserve the original attempt's locked answers.

Use separate reading, multiple-choice, and writing sections. Only time spent in the multiple-choice section counts toward speed points. Switching to reading or writing pauses scored time and hides the multiple-choice questions. Preserve their editable choices and accumulated answer time when they return. Sum all active visits to the multiple-choice section until whole-check submission locks the attempt; reading and writing time remain outside that scored total.

Submission completeness must be separate from correctness. A whole check containing wrong multiple-choice answers can still produce an official below-target attempt. A written response meeting a length requirement is submitted work, not automatically correct content. G2 records the approved locking rule and the remaining written-edit versioning detail.

## Approved timing and interruption rules

Keep total work time separate from scored answer time. Flashcard study, extra clues/help, corrections, mistake review, feedback, and celebration do not add scored answer time. Preserve elapsed time before help and retain assistance state. Opening help cannot restart an answer as unaided.

Teachers choose a positive speed target and may calibrate it using real student work. Share one target across every section on the same school/grade/activity/content/task leaderboard. It is separate from the existing activity time limit or assignment deadline. Do not use an adult's completion time or the fastest student's replay as an assumed class target.

When students pause or leave the activity, pause scored answer time and hide the question or puzzle until resume. Freeze falling words and timed gameplay. Resuming preserves the already-recorded time, answers, assistance, current combo, and longest combo. It creates no fresh scored opportunity.

After an unexpected crash or shutdown, resume the same attempt from its last valid saved timer value and keep the speed bonus available under the normal full-run, weighted-credit and speed rules. Restore saved answers, assistance and combo state. Count no time while the activity is closed and do not estimate missing seconds or apply a crash penalty. Save each scored answer and timer value before feedback, save time periodically during longer interactions, and save on pause/leave whenever possible. Some time since the last successful save may be unavailable; using the recorded total is the approved recovery tradeoff.

For Speed Match, show the definition and an initial group containing the correct word and distractors together. Start scored answer time when those choices are visible and selectable, then stop at the first selection or when the correct word falls past. Exclude waiting before usable choices appear and all subsequent correction time. Sum the scored intervals across scheduled appearances. This timing rule is approved.

Use one scored stopwatch for the whole Crossword puzzle and one for the whole Word Search puzzle, not separate timers per word. Count active scored work once across the shared grid. Pause for help, correction mode, feedback, or interruptions, and preserve accumulated time on resume. Stop when every word has received its scored result even if required corrections remain; for Word Search this is when all target words are found.

For question items, the proposed timer starts when the answer interaction is usable and ends at the first scored submission. For Wordle and Hangman it must cover the scored word challenge across permitted guesses. For reading checks, time only active visits to the separate multiple-choice section; switching to reading or writing pauses the timer and hides those questions. Preserve accumulated time until the whole check is submitted. The approved boundaries and remaining adapter mechanics are recorded under G3.

## Approved visual combos

Use combos across all eleven scored vocabulary games and reading-check multiple-choice questions. Each agreed scored item or scheduled appearance is one combo opportunity. Written reading responses neither build nor break a combo.

Only full-credit unaided outcomes build the combo. Wrong, missed, partial-credit, or assisted scored outcomes reset it. Corrections do not build it; a later scheduled appearance can start a new streak. Ordinary intermediate Wordle or Hangman guesses do not independently reset a combo if the scored word ultimately earns full unaided credit. Unsuccessful Word Search drags likewise are not scored failures.

The counter increases on every qualifying outcome. Celebrate at 3, 5, and 10, then every additional 5: 15, 20, 25, 30, and so on. Counts such as 11-14 update the counter without a milestone celebration. Celebrations let students keep playing and add no points.

Show the completed attempt's longest combo on its results screen, for example `Best streak: 12`. A reset does not erase that best streak. Both counters survive resume of the same attempt; a fresh attempt starts both at zero. Restoring or syncing an answer must not count it twice. Combos do not affect points, completion, stars, leaderboard order, or rewards.

## Approved leaderboards

### Audience, eligibility, and versions

Keep boards within each school, grouped by grade, activity, content set/version, and comparable task settings. Combine sections such as 7A and 7B when those settings match. Different personal completion targets do not split the board. There is no combined total across unrelated activities.

Fully finished scored attempts can qualify even below the student's completion target. Completion and retry requirements still apply separately. Incomplete and missed-only practice runs do not qualify. Late attempts remain eligible if otherwise valid and fully finished. Keep lateness visible to the teacher without changing game points. Historical records still require adequate evidence under G5.

Start a new leaderboard when the shared speed target, scored words/questions, or scheduled appearance count changes. Preserve previous boards, scores, stars, and earned completion. New attempts use the new configuration; resumed attempts retain their original configuration and previous board. Do not rescore history or move an old best score onto a different-version board.

### Best attempt and ordering

Use one entry per student with their best eligible full-attempt whole-number points within that board version. Replays do not accumulate. A lower later result does not replace the best score. Among the student's equal-best-point attempts, choose the one with the shortest scored answer time. Keep the points and time from that same attempt.

Equal points share a rank. Use standard competition numbering, such as 1, 2, 2, 4. Rank is one plus the number of eligible student entries with strictly higher points. Within a shared rank, display shorter scored answer time first. If points and time match, display names alphabetically; identical display names can use a stable internal identifier for consistent rendering without creating a competitive distinction.

Show the top five ranks plus the current student's rank and score. Include every entry sharing a displayed rank, including all ties at fifth. Do not duplicate the student's row if already shown. With competition numbering, skipped rank numbers do not imply missing entries.

### Offline results

Show a locally calculated offline result immediately as provisional, labeled `Waiting to sync`. Add it to the official board only after successful synchronization and server validation. Do not show an official rank or saved rewards merely because a delivery is queued. Preserve pending evidence and retry synchronization without duplicate attempts or rewards. Starting a scored attempt while already offline requires the complete activity and its scoring settings to have been downloaded beforehand. Without that prepared activity, offer practice only; it does not produce a leaderboard result. Preserve the downloaded content/task/settings version for later validation and the corresponding board. G4 records this approval and the remaining download mechanics.

## Recommended design and release safeguards

These are engineering recommendations, not claims of implementation or additional product approvals.

- Use one shared results presenter and one scoring adapter per activity. Each adapter supplies task identity, evidence, scoring units, finish state, mistakes, and review route. Keep calculations deterministic and animations separate from scoring.
- Snapshot school, student, assignment context, normalized content, complete scheduled task, scoring-rule version, effective completion target, shared speed target, timing policy, and leaderboard version with the attempt. Separate section-specific assignment context from the shared board identity.
- Retain first submissions, assistance, appearance IDs, outcomes, timing intervals, combo state, and correction state. Reject missing, duplicated, impossible, or out-of-task evidence rather than deriving competitive credit from eventual completion counts.
- The server should validate answers and derive official totals using stored task/settings snapshots instead of trusting client point totals or `isComplete`. Specify exactly what client timing can and cannot prove. Pause-and-hide is a user experience rule, not proof that external study never occurred.
- Make finalization and reward delivery idempotent. Guard concurrent tabs, stale responses, student changes, resumed attempts, failed saves, offline retries, and duplicate events. A provisional result must not replace a confirmed different attempt.
- Preserve existing completion, XP/coin contracts, and old records. Do not fabricate first-answer credit, speed, or stars where historical evidence is missing. Design staged compatibility and rollback before activation.
- Use short skippable celebrations, keyboard access, no required sound, and a static reduced-motion result. Announce the final result once instead of every count-up frame. Keep private targets, answers, accommodations, and teacher notes out of leaderboard responses.
- Query a bounded leaders list plus the student's own position after results or on demand, not every answer/frame. Measure hosted query plans, concurrency, retention, and payload cost before capacity claims. Keep the feature within the current app/database unless evidence justifies another service.

The intended results screen leads with current-run weighted percentage, completion target/status, accuracy and speed breakdown, stars, longest combo, review/retry, and eligible leaderboard entry. Personal best and confirmed XP/coin feedback are separate from the current attempt. A weaker replay should still acknowledge previously earned completion.

## Resolved product gaps and remaining engineering work

The consolidation review identified five gap areas. Their product decisions are now approved as recorded below. Keep the remaining engineering work explicit; resolving it must not silently alter the approved rules. This pass identifies no outstanding product decision before detailed design.

### G1. Repeated-word appearance boundaries and Speed Match scheduling

The inspected game picks definitions randomly, spawns words probabilistically, and moves them by pixels per frame. It does not guarantee five scored appearances per word or a timely correct option. A fair fixed schedule must define each target appearance, its distractors, its guaranteed correct word, and its end. Distractor spawns are not additional scheduled scoring opportunities.

Approved on 2026-11-15: guarantee the correct word comes down during every scheduled Speed Match appearance. Do not rely on a random spawn chance to provide that opportunity. Missing the guaranteed correct target still follows the approved zero-credit rule.

Approved on 2026-11-15: after a wrong selection or missed correct target, pause the falling words and require the student to match the correct word to its definition before the next scheduled appearance. The failed appearance keeps zero credit. The correction is unscored practice, does not build the combo, and does not add scored answer time. Retain the scheduled appearance identity so correction clicks cannot create another scoring opportunity.

Approved on 2026-11-15: show the definition and an initial falling group containing the correct word and distractors together. Start scored time once the choices are visible and selectable; stop at the first selection or when the correct word falls past. Waiting before that usable group and the required correction add no scored time.

Remaining engineering detail: use comparable spawn/travel settings across the board, synchronize the usable starting group, and make motion depend on elapsed time rather than display frame count. Do not let random waiting or correction clicks create scored opportunities.

Approved on 2026-11-15: in Matching, count a wrong pair against only the selected vocabulary term's scheduled appearance. The selected definition does not penalize the other word's appearance. For example, pairing keyboard with mouse's definition gives keyboard's appearance zero credit while leaving mouse's own scoring opportunity intact. This attribution is based on the term card, regardless of which card type was clicked first. Once an appearance has scored, its corrections do not change its credit or create another opportunity.

### G2. Reading answer locking and combo feedback

The inspected reading form evaluates the submitted answers together and permits later updates. The approved design needs an immutable first scored submission and a distinct full retry. Showing a combo increase while a choice is still editable could reveal correctness before the first scored submission.

Approved on 2026-11-15: let students edit multiple-choice choices until whole-check submission. Lock that attempt's automatic answers at submission and show score and combo feedback afterward. A later score improvement requires a new full multiple-choice attempt, retaining the submitted writing. Present the combo outcomes using question order and show the attempt's longest streak without exposing correctness while choices remain editable.

Remaining engineering detail: version any later written edits without overwriting earlier submitted writing. Preserve existing required-response checks without describing them as correctness. An offline submission locks its local attempt too, but its score remains provisional until synchronization and validation under the approved offline rule.

### G3. Activity-specific scored-time boundaries

Approved on 2026-11-15: use one accumulated scored stopwatch per whole Crossword or Word Search puzzle. Count active scored work once rather than summing overlapping word timers. Pause for help, correction mode, feedback, or interruptions. Stop after the last word's scored result, preserving accumulated time across resume. Required corrections remain outside scored time.

Approved on 2026-11-15: separate reading, multiple-choice, and writing sections and time only the multiple-choice section. Switching to reading or writing pauses scored time and hides the multiple-choice questions. Preserve editable choices and sum the active multiple-choice visits until whole-check submission. Show correctness and combo feedback only after that submission. Speed Match's usable starting group and stop conditions are also approved.

Remaining engineering detail: specify exact adapter events and enforce scored versus correction modes, including grid access during corrections. Test help/review overlays, blur, hidden tabs, closure, and resume so elapsed time cannot be dropped or counted twice. Fix timing units/precision for exact ties.

### G4. Starting scored attempts while already offline

Approved on 2026-11-15: require a previously downloaded complete activity and its scoring settings for a scored attempt started while already offline. Otherwise offer clearly labeled practice without a leaderboard result. The locally calculated scored result remains provisional until synchronization and validation, as already approved.

Remaining engineering detail: specify download preparation, saved task/settings snapshots, authorization, completeness checks, attempt identifiers, and synchronization. Use the prepared configuration's leaderboard version rather than mixing old settings into a new board. A downloaded activity must not silently switch to newer settings while offline or on resume.

### Replacement computers and synchronization

Approved correction: students can sign in and continue on a replacement computer without teacher approval or waiting for pending attempts on the original computer to sync. This supersedes the one-device pending-work restriction and teacher-authorized replacement proposed during technical drafting.

Load server-saved progress and restore only checkpoints actually received by the server. Work saved solely on an inaccessible computer cannot be reconstructed and may need to be repeated as a fresh full attempt. If the original computer later reconnects, use ordinary authenticated synchronization and server validation; preserve otherwise valid late-attempt eligibility, original task/board versions and protection against duplicate rewards. Handle conflicting saves of the same attempt without blocking the student's account or new permitted attempts. Cross-device support-history reconciliation follows the approved conservative help-flag rule: uncertain failures remain visible without reactivating a cleared flag; two clearly post-pass full failures are required. It cannot require teacher device approval. See [the technical design](activity-results.md) for the current contracts.

### G5. Support history and remaining eligibility edges

Approved on 2026-11-15: passing resets the two-failure help counter. Count new full below-target attempts since the most recent pass; two such attempts trigger the flag again. Preserve earlier attempts, help history, and earned completion. For out-of-order offline uploads, apply the uncertainty rule in the completion/support section: uncertain failures stay in history, and reactivation requires two clearly post-pass full failures.

Approved on 2026-11-15: late attempts remain eligible for their matching leaderboard when otherwise valid and fully finished. Keep lateness visible to the teacher without changing game points or overriding other assignment policies. The speed target remains separate from the assignment deadline.

Remaining engineering detail: define historical eligibility from available evidence rather than assuming every old result qualifies. No new timing, first-answer, or assistance evidence may be invented for older records.

### Engineering details that do not need repeated product questions

Define authority for shared teacher settings, content normalization/version keys, empty or invalid task handling, allowed repetition-count limits, stable word/appearance IDs, and valid puzzle generation. Detect words that cannot be placed or normalize into duplicates; do not silently shorten a full ranked task. Specify diacritic and remaining punctuation handling without inventing broader accepted spellings. Choose audit retention, answer-validation strength, timing anomaly checks, migrations, access controls, and rollout strategy.

The core approved decisions are mutually consistent. In particular, fully finished below-target leaderboard results, a shared 80% speed gate, personalized passing targets, and visual-only combos do not require changing one another. The current code still needs changes to support them; this document does not establish deployed behavior.

## Alternatives weighed

| Alternative | Outcome |
| --- | --- |
| Personalized targets change bonus eligibility or points | Superseded by the shared scoring rule and fixed 80% speed gate. |
| 90/10 accuracy/speed or illustrative completion bonuses | Superseded by the approved 950/50 allocation. |
| Rank by accuracy first and use speed only for ties | Not selected; the approved 50-point speed component may change close-score order. |
| Latest or cumulative replay score on the leaderboard | Best eligible attempt selected instead. |
| Three appearances per word | Five selected as the default, with a shared teacher-adjustable count. |
| Stop Speed Match after three lost lives | Replaced by finishing the scheduled set. |
| Zero for every misspelled Crossword/Fill in Blank answer | Replaced by normalized letter-position partial credit. |
| Extra combo points | Visual-only combos selected. |
| Treat eventual completion or short-text length as automatic accuracy | Unsupported by the evidence; do not use it. |
| Limit release scope to selected vocabulary games | Conflicts with the approved all-automatic-activities scope; smaller internal checkpoints may still stage development. |
| Independent full results logic in every game | Recommend rejecting in favor of shared presentation and explicit activity adapters. |

## Staging and acceptance evidence

1. Draft per-activity scoring/timing examples from the approved decisions and resolve the engineering work listed under G1-G5. Keep technical choices distinct from any new product changes requiring approval.
2. Draft versioned task/attempt/settings contracts, validation, finalization, and independent best-game-result selection. Review compatibility with current completion and XP/coin rules.
3. Integrate every in-scope activity and both reading-check paths through adapters. Cover full retries, preserved writing, assistance, corrections, and resume.
4. Connect the accessible shared presenter and school/grade learning boards to confirmed results, with clearly provisional offline feedback.
5. Verify exact score/star boundaries, target precedence, repeat scheduling, assistance, combos, shared ranks, version changes, interruptions, duplicates, concurrent tabs, and rollback.
6. Check authenticated browser flows at narrow and desktop widths, keyboard/reduced-motion behavior, hosted board costs, and a classroom pilot. Calibrate speed targets from student work before claiming lesson fit.

Historical local verification on 2026-11-14 reported 63 passing existing tests, then 70 with the reading suite included. Those runs precede this consolidated design and do not test the proposed feature. This consolidation changes planning documents only. No new runtime test, migration, deployment, hosted acceptance, or student/device validation is claimed. See the [audit](audit.md) for exact commands and inspected source anchors.
