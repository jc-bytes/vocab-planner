# T3 vocabulary review and proposed revision

**Status: review and implementation plan only. No catalog, lesson, database, student record or deployment was changed during this review.**

Reviewed 16 current monthly-plan Markdown files, the 91 app catalog files and their class-set source records, and the relevant activity-selection code. Compared all 91 published JSON files with the local catalog: 85 match exactly; six Grade 8 September sets differ. All six have title/description differences, and Week 3 Part 1 also differs in its words: the published version still has File/Folder while the local file has Test/Feedback. The current-word columns and distribution below use the class-set source, which retains that published Grade 8 sequence. Week 1 discrepancies are documented only; the freeze prevents silently publishing those local edits. Monthly-plan DOCX, individual class-guide DOCX, authenticated database rows, and live Classroom posts were not re-audited in this review. Any discrepancy at implementation must be resolved before publishing.

## Recommendation

Use one canonical five-word weekly pool for each active teaching topic from T3 Week 2. Reuse it across class activities, rather than creating isolated two-word pools. **Both project weeks, October 12–16 and October 19–23, have no vocabulary sets or tasks for Grades 6–9.** Five is a working classroom target, not five new concepts every week. Preserve Week 1 vocabulary, dates, identifiers, required work and recorded progress. Keep its existing activity behavior when introducing future-pool changes.

The immediate priority is topic/date alignment. The old generator and class_sets.json no longer reliably represent the monthly sequence. Do not bulk-regenerate from that old source.

A weekly pool is a focus list, not a prohibition on other lesson vocabulary. Mixed-topic weeks still need the previously taught pool available for assessment review. No new required vocabulary tasks belong on a closure, grade-record slot, or assigned-teacher project slot.

## Confirmed findings

| Grade | Existing class sets | Sets after Week 1 | Future weekly rows | Future weeks with only two distinct words |
|---|---:|---:|---:|---:|
| 6 | 26 | 24 | 12 | 6 |
| 7 | 23 | 21 | 11 | 10 |
| 8 | 23 | 21 | 11 | 8 |
| 9 | 19 | 17 | 9 | 6 |
| Total | 91 | 83 | 43 | 30 |

- 90 sets contain two words; one contains three. There are 183 word entries, counting repetitions across sets.
- The upcoming 43 grade/week combinations have 30 two-word pools, three three-word pools, nine four-word pools and one five-word pool. Combining the existing parts alone is insufficient in most weeks.
- All 91 sets cap Flashcards, Matching and Fill in Blank at their existing two/three-word count. Expanding the word array without changing those limits would leave undersized rounds.
- The registry allows only one Word Search word in 14 of the 91 source sets, despite the fixed 15×15 grid. No set supplies more than three.
- All 183 entries have empty synonym and antonym lists. Increasing word count will not make that activity work. Do not manufacture false technical antonyms.
- Eleven class-folder paths in class_sets.json no longer exist. The source needs rebuilding against current planning before generation.
- The newly deployed additional-practice settings and hiding of activities with no suitable words are already in place. This proposal does not reverse them.

## Topic and calendar mismatches to fix first

| Area | Existing catalog | Current monthly plan | Proposed correction |
|---|---|---|---|
| Grade 6, Oct 5–9 | STEAM planning/build | Finish spreadsheet assessment and checking, with group differences | Spreadsheet review pool |
| Grade 6, Oct 26 onward | Spreadsheet work, then later modelling/night-light | Modelling followed by button counters and feedback; groups diverge | Model/counter pools by actual group dates; no new night-light requirement |
| Grade 6, Dec 7–11 | Night-light units | Exams/closure, no normal Technology lesson | No scheduled vocabulary task |
| Grade 7, Oct 7–9 | STEAM planning | Scratch custom block and loop practice | Scratch pool |
| Grade 7, Nov 6 / Nov 11–13 | File organisation | Scratch comparison / radio-warning practice | Reused Scratch pool, then radio pool |
| Grade 8, Sep 21 onward | Lunch map and club signup wording | Running LunchApp tests, completion and explanation | Align app descriptions and examples to LunchApp |
| Grade 8, binary | Week 10 | Week 4 | Move the topic to its teaching week |
| Grade 8, Nov 2–6 | Python-total task | Closure and review of existing records; no student lesson | No required unit |
| Grade 9, Sep 21 | “Organise your work” with Pixel/Bit | Online-danger instruction plus a separate data assessment | Safety focus pool; retain Week 1 data review |
| Grade 9, Sep 28 | Phishing/Malware only | Probability/impact instruction and safety/risk assessments | Risk pool |
| Grade 9, October/November | Repeated STEAM/project-demonstration topics | Online-safety case slides, priority and final presentation | Safety/risk pools; no Week 8 task |

## Proposed weekly pools

These are exact teacher-review selections, not finished student word cards. Definitions, examples and direct dictionary/source checks are an explicit content-authoring step before release. Week numbers below are continuous T3 weeks beginning September 14, not the month-local week numbers used in some Grade 6 folders. Dates show the week start; actual group teaching dates must come from the monthly plan.

“Review” means reuse already taught language, with no additional vocabulary assessment. “No vocabulary” means no required or optional vocabulary set or task is scheduled for either project week. No completion target, deadline or Arcade blocker may be attached to those weeks. In an assessment-only session, review access stays optional and cannot add a new gate before the assessment.


### Grade 6

| T3 week / starts | Current distinct words | Proposed five-word pool | Action and teaching alignment |
|---|---|---|---|
| W02 / 2026-09-21 | Table, Chart, Row, Column | row, column, cell, table, chart | Use the chart lesson to introduce cell; reuse the other terms. |
| W03 / 2026-09-28 | Data, Chart, Table | data, table, row, column, chart | Reuse taught words before the story-table assessment. 6A misses Sep 29; follow its October continuation. |
| W04 / 2026-10-05 | Prototype, Model | table, chart, label, value, comparison | The current plan still teaches spreadsheets on Oct 5–9. Introduce task language through the worked chart, not new assessment content. |
| W05 / 2026-10-12 | Test, Feedback | No vocabulary | No required or optional vocabulary set or task during this project week. |
| W06 / 2026-10-19 | Prototype, Feedback | No vocabulary | No required or optional vocabulary set or task during this project week. |
| W07 / 2026-10-26 | Table, Chart | dimension, length, width, height, model | Model work moves to Oct 26–30. Respect Student Day and the separate 6A/6B/6C lessons. |
| W08 / 2026-11-02 | Dimension, Model | dimension, length, width, height, model | Release only for 6C’s Nov 6 lesson. No required work for 6A/6B during closures. |
| W09 / 2026-11-09 | Dimension, Model | 6A/6B: dimension, length, width, height, model; 6C: input, output, variable, button, counter | 6A/6B keep the model pool. 6C uses input, output, variable, button, counter for its Nov 11/13 lessons. |
| W10 / 2026-11-16 | Dimension, Input, Output, Test, Feedback | input, output, variable, button, counter | 6A/6B begin counters; 6C reuses this pool during explanation and saving. |
| W11 / 2026-11-23 | Input, Output, Test, Feedback | input, output, variable, test, feedback | Use familiar review terms. No added five-new-word requirement during end-of-term work. |
| W12 / 2026-11-30 | Sensor, Threshold, Input, Output | input, output, variable, test, feedback | Reuse Week 11. Respect the Dec 2 holiday. |
| W13 / 2026-12-07 | Sensor, Threshold, Input, Output | No scheduled unit | Withdraw future scheduled night-light work; no normal Technology lesson is planned. |

### Grade 7

| T3 week / starts | Current distinct words | Proposed five-word pool | Action and teaching alignment |
|---|---|---|---|
| W02 / 2026-09-21 | Row, Column, Table, Chart | cell, table, formula, function, chart | Keep the spreadsheet assessment’s existing vocabulary available; select five focus words, not the only words allowed in the lesson. |
| W03 / 2026-09-28 | Formula, Chart | formula, total, average, chart, comparison | Review words already met in Week 1/2 modelling before the activity-afternoon assessment. |
| W04 / 2026-10-05 | Prototype, Model | function, loop, variable, position, reset | Actual Oct 7/9 lesson, replacing the old STEAM-planning set. 7B has no Oct 8 lesson. |
| W05 / 2026-10-12 | Test, Feedback | No vocabulary | No required or optional vocabulary set or task during this project week. |
| W06 / 2026-10-19 | Prototype, Feedback | No vocabulary | No required or optional vocabulary set or task during this project week. |
| W07 / 2026-10-26 | Function, Loop | sensor, threshold, input, output, condition | Use this pool for the ungraded distance lesson. Keep Week 4’s Scratch pool accessible for the separate delivery assessment. |
| W08 / 2026-11-02 | File, Folder | function, loop, variable, position, reset | Only the Nov 6 assessment session remains. No new vocabulary instruction or required extra task before that assessment. |
| W09 / 2026-11-09 | File, Folder | sensor, threshold, radio, message, output | Introduce radio and message through the actual sender/receiver demonstration; retain earlier input/condition review. |
| W10 / 2026-11-16 | Sensor, Threshold | sensor, threshold, radio, message, output | Reuse Week 9 for the exam; do not introduce new assessed language. |
| W11 / 2026-11-23 | Test, Feedback | sensor, threshold, radio, message, output | Keep review optional in the reduced week; Nov 27 is a school event. |
| W12 / 2026-11-30 | Sensor, Threshold | sensor, threshold, radio, message, output | Same pool; honor 7A’s Dec 2 closure and the actual remaining sessions. |

### Grade 8

| T3 week / starts | Current distinct words | Proposed five-word pool | Action and teaching alignment |
|---|---|---|---|
| W02 / 2026-09-21 | Test, Bug, Variable | input, output, variable, test, bug | Replace the outdated club-signup/map wording. Actual lessons use a running LunchApp. |
| W03 / 2026-09-28 | File, Folder, Test, Feedback | variable, event, test, result, feedback | Use the real app/test evidence; do not create a file-organisation lesson. |
| W04 / 2026-10-05 | Prototype, Model | bit, binary, decimal, digit, place value | Move binary from the app’s Week 10 to the actual Oct 5–8 teaching. Explain all five before the binary assessment. |
| W05 / 2026-10-12 | Test, Feedback | No vocabulary | No required or optional vocabulary set or task during this project week. |
| W06 / 2026-10-19 | Prototype, Feedback | No vocabulary | No required or optional vocabulary set or task during this project week. |
| W07 / 2026-10-26 | Input, Variable, Bug | input, variable, integer, output, bug | Use the actual two-number Python program and familiar corrections. |
| W08 / 2026-11-02 | Bug, Variable | No scheduled unit | No student lesson. Remove the scheduled Python-total requirement; existing practice may remain voluntarily accessible. |
| W09 / 2026-11-09 | Bug, Variable | event, variable, input, output, bug | Reuse input/output/variable/bug; event comes from the earlier app. Keep the Week 7 Python pool accessible for assessment review. |
| W10 / 2026-11-16 | Bit, Binary | sprite, event, loop, condition, variable | Use the actual Player/Balloon/Wall build. Fix the inconsistent Catch the Star/Balloon titles when synchronising descriptions. |
| W11 / 2026-11-23 | Loop, Condition | sprite, event, loop, condition, variable | Reuse Week 10 during the final assessment. |
| W12 / 2026-11-30 | Loop, Condition | sprite, event, loop, condition, variable | Reuse the same pool; no new vocabulary burden during feedback/closure. |

### Grade 9

| T3 week / starts | Current distinct words | Proposed five-word pool | Action and teaching alignment |
|---|---|---|---|
| W02 / 2026-09-21 | Pixel, Bit, Sample, Sample rate | phishing, malware, ransomware, password, protection | Safety teaching starts Sep 21. Keep frozen Week 1 pixel/bit/sample/sample-rate review accessible for the separate picture-and-sound assessment. |
| W03 / 2026-09-28 | Phishing, Malware | risk, probability, impact, evidence, protection | Introduce in the Sep 28 worked risk examples before the independent safety/risk assessments. Earlier threat names remain available in Week 2. |
| W04 / 2026-10-05 | Prototype, Model | phishing, risk, probability, impact, protection | Use the real online-safety slides, replacing the stale STEAM-planning topic. |
| W05 / 2026-10-12 | Test, Feedback | No vocabulary | No required or optional vocabulary set or task during this project week. |
| W06 / 2026-10-19 | Prototype, Feedback | No vocabulary | No required or optional vocabulary set or task during this project week. |
| W07 / 2026-10-26 | Phishing, Malware, Probability, Impact | backup, probability, impact, priority, protection | Tie backup/priority to the taught case comparison. 9A has no Oct 27 lesson. |
| W08 / 2026-11-02 | Phishing, Malware | No scheduled unit | No Technology task for either group; remove the scheduled risk-check unit from required work. |
| W09 / 2026-11-09 | Test, Feedback, Prototype | backup, probability, impact, priority, protection | Reuse Week 7 for the actual safety-presentation rehearsal; no STEAM demonstration or new words. |
| W10 / 2026-11-16 | Prototype, Feedback | backup, probability, impact, priority, protection | Reuse the taught pool for the Nov 17/18 exam. Add no Grade 9 academic work after the planned finish. |

## Activity changes needed alongside the content

| Activity | Confirmed current constraint | Planned handling for future weekly pools |
|---|---|---|
| Flashcards / Matching / Fill in Blank | Limits are explicitly 2 or 3 | Use all five pool words. Provide a correct definition and a natural example containing each term. |
| Word Search | Registry rejects labels shorter than 4 characters; puzzle normalizes labels and accepts 2–15 characters; grid is fixed at 15×15 | Align selection with the puzzle’s normalized-word rules, retaining real short terms such as bit and bug. Size the grid to the actual words. Future-pool version must not silently change frozen Week 1 behavior. |
| Crossword | Requires a single alphabetic word and a definition | Phrases such as place value are excluded today. Either explicitly support multiword answers with readable labels or keep this activity hidden when too few usable answers remain. Do not rewrite valid terms to suit the game. |
| Vocabulary Wordle | Accepts 3–10 letters after removing spaces/hyphens | Count eligible terms before showing it. Do not remove academically useful longer words from the pool just for Wordle. |
| Synonym & Antonym | Needs meaningful relations and at least three distinct distractors; no current relations exist | Keep hidden unless genuinely valid questions can be built. Input/output are complementary concepts, not automatically dictionary antonyms. |
| Quiz / Speed Match | Definitions and adequate distinct alternatives matter | Verify the generated choices, not just the number of words or the enabled card. |
| Word Hunt | Separate student research/evidence workflow | Do not make it a new required task. A five-word optional practice pool must not be presented as the formal ten-word Word Hunt. Grade 9’s ordinary review stays supplied-definition practice. |

For future weekly pools, propose a minimum of four usable terms for multiword optional rounds such as Word Search, Crossword and matching-style games. Below that, hide the activity and retain suitable alternatives. This is a product-design proposal to verify per activity, not a change already made. Games designed around one target, such as Wordle, need their own valid-round check. Use one eligibility result for the menu count, launch guard, round generation and server validation.

A five-term definition list is not sufficient evidence of good formative work. Include short meaning/application questions, and use a brief oral check tied to the lesson. Word Search provides spelling recognition practice; it cannot by itself show that a student understands the concept.

## Delivery and progress design

Recommended end state: one weekly vocabulary unit per active grade/group topic, with the daily Spark reading/questions remaining separate. Introduce up to three focus terms in the first class and the remaining terms in the next teaching opportunity; supplied definitions for the whole pool remain available. In a shortened or assessment week, reuse known words rather than squeezing in new instruction.

Proposed required path for normal two-session weeks: Flashcards once, Matching once, then Fill in Blank once across the week. Complete the meaning practice before opening the wider optional library. This reduces four duplicated class-set activity completions to three fuller weekly completions. It is a proposed requirement change to review, not an approved alteration to grades or existing student progress. Required tasks and due dates for short, mixed-topic or assessment weeks need individual assignment rules; do not apply this path automatically to every calendar row.

Before merging class sets, implement an explicit mapping from the old class IDs to the future pool/unit. Preserve old attempts, scores, exports and bookmarked routes. Do not copy a two-word 100% result into five-word mastery. A student with an existing future-unit attempt should keep that record on its old content version and receive the new pool separately. Week 1 remains on its current IDs/content. Retired future sets must stop contributing new required-work and Arcade blockers while their historical evidence remains readable.

Reused pools in later weeks need separate scheduling from the content identity: a repeated review should not automatically award duplicate completion credit, add an obligation on a holiday, or overwrite a prior attempt. Grade 6 group-specific pools must be scoped to the enrolled group, not just grade.

## Implementation order and completion checks

1. **Reconcile the teaching calendar.** Use the 16 monthly-plan sources below. Cross-check their current DOCX versions and the actual class guides before editing. Correct the obsolete topic/date/folder mapping in the generator; preserve all Week 1 records. Record group exceptions and no-class slots explicitly. Remove the Week 5 and Week 6 vocabulary assignments from the planned sequence for all four grades; preserve any historical records without keeping active obligations.
2. **Author the five-word pools.** Use the proposed rows as the review baseline. Write a short contextual definition and an example for every term; check the exact meaning against a direct reputable dictionary/source page. Mark new introduction versus previously taught review. Keep necessary older topic pools available for mixed-topic assessment weeks.
3. **Update the app and assignments together.** Remove two-word limits for the new pools, implement content-version and old-ID handling, check real round eligibility, and revise required-work/Arcade rules for retirement, reuse and closures. Verify signed-in behavior and the server’s question/score assumptions.
4. **Synchronise student directions.** Update monthly vocabulary wording, relevant class guides, app descriptions, the catalog/manifest, generator source and the matching daily Sparks/links. Keep the existing formal assessment counts, products, rubrics and scoring scope. Do not add research, a new submission, or a formal Word Hunt merely because a pool is bigger. Update old two/three-word workflow guidance through the appropriate maintained source; this review does not edit skills or memory.
5. **Pilot Week 2 before bulk release.** Preview one revised pool per grade and the Grade 9 mixed-topic case. Verify all five words are actually used, distractors are valid, unavailable activities are hidden, and the visible count is correct. Check save/reload, completion, exports, next-week access, old routes, and no duplicate rewards. Observe student completion and explanation; task timing is still unknown until tested in class.
6. **Stage the remaining weeks.** Check every row against its actual group dates. Compare database, static files, manifest and live student view. Verify Week 1 hashes/required settings/recorded progress are unchanged, closure weeks add no obligations, both project weeks have no scheduled vocabulary sets or tasks, and old future sets do not remain as duplicate required units. Release only after these checks pass.

## Review boundaries and evidence

This review establishes the catalog shortage, code constraints and current Markdown topic/calendar mismatches. It does not establish a finished classroom-ready package, final dictionary-checked word cards, production migration behavior, or an exact classroom time budget. The weekly list is a concrete proposal for the next authoring pass.

The earlier two/three-word-per-class guidance does not prevent this proposal: the user has explicitly asked to review a five-word weekly model. The distinction between a weekly practice pool and a short class introduction should remain clear in revised materials.

Relevant guidance: [IES vocabulary practice guide](https://ies.ed.gov/ncee/wwc/PracticeGuide/19/Published) supports focused vocabulary taught repeatedly through varied activities; it does not establish five as a universal optimum.

### Sources inspected

- [Grade 6, 09 September](</Users/pjriosc/Documents/TECHNOLOGY 2026/plans/6th Grade Technology/MONTHLY PLAN/3rd Trimester/09 September/00 Monthly Plan - September.md>)
- [Grade 6, 10 October](</Users/pjriosc/Documents/TECHNOLOGY 2026/plans/6th Grade Technology/MONTHLY PLAN/3rd Trimester/10 October/00 Monthly Plan - October.md>)
- [Grade 6, 11 November](</Users/pjriosc/Documents/TECHNOLOGY 2026/plans/6th Grade Technology/MONTHLY PLAN/3rd Trimester/11 November/00 Monthly Plan - November.md>)
- [Grade 6, 12 December](</Users/pjriosc/Documents/TECHNOLOGY 2026/plans/6th Grade Technology/MONTHLY PLAN/3rd Trimester/12 December/00 Monthly Plan - December.md>)
- [Grade 7, 09 September](</Users/pjriosc/Documents/TECHNOLOGY 2026/plans/7th Grade Technology/MONTHLY PLAN/3rd Trimester/09 September/00 Monthly Plan - September.md>)
- [Grade 7, 10 October](</Users/pjriosc/Documents/TECHNOLOGY 2026/plans/7th Grade Technology/MONTHLY PLAN/3rd Trimester/10 October/00 Monthly Plan - October.md>)
- [Grade 7, 11 November](</Users/pjriosc/Documents/TECHNOLOGY 2026/plans/7th Grade Technology/MONTHLY PLAN/3rd Trimester/11 November/00 Monthly Plan - November.md>)
- [Grade 7, 12 December](</Users/pjriosc/Documents/TECHNOLOGY 2026/plans/7th Grade Technology/MONTHLY PLAN/3rd Trimester/12 December/00 Monthly Plan - December.md>)
- [Grade 8, 09 September](</Users/pjriosc/Documents/TECHNOLOGY 2026/plans/8th Grade Technology/MONTHLY PLAN/3rd Trimester/09 September/00 Monthly Plan - September.md>)
- [Grade 8, 10 October](</Users/pjriosc/Documents/TECHNOLOGY 2026/plans/8th Grade Technology/MONTHLY PLAN/3rd Trimester/10 October/00 Monthly Plan - October.md>)
- [Grade 8, 11 November](</Users/pjriosc/Documents/TECHNOLOGY 2026/plans/8th Grade Technology/MONTHLY PLAN/3rd Trimester/11 November/00 Monthly Plan - November.md>)
- [Grade 8, 12 December](</Users/pjriosc/Documents/TECHNOLOGY 2026/plans/8th Grade Technology/MONTHLY PLAN/3rd Trimester/12 December/00 Monthly Plan - December.md>)
- [Grade 9, 09 September](</Users/pjriosc/Documents/TECHNOLOGY 2026/plans/9th Grade Technology/MONTHLY PLAN/3rd Trimester/09 September/00 Monthly Plan - September.md>)
- [Grade 9, 10 October](</Users/pjriosc/Documents/TECHNOLOGY 2026/plans/9th Grade Technology/MONTHLY PLAN/3rd Trimester/10 October/00 Monthly Plan - October.md>)
- [Grade 9, 11 November](</Users/pjriosc/Documents/TECHNOLOGY 2026/plans/9th Grade Technology/MONTHLY PLAN/3rd Trimester/11 November/00 Monthly Plan - November.md>)
- [Grade 9, 12 December](</Users/pjriosc/Documents/TECHNOLOGY 2026/plans/9th Grade Technology/MONTHLY PLAN/3rd Trimester/12 December/00 Monthly Plan - December.md>)
- [class_sets.json](</Users/pjriosc/Documents/TECHNOLOGY 2026/tools/planning/t3_vocab_sync/class_sets.json>)
- [prepare.py](</Users/pjriosc/Documents/TECHNOLOGY 2026/tools/planning/t3_vocab_sync/prepare.py>)
- [studentActivityRegistry.js](</Users/pjriosc/Documents/TECHNOLOGY 2026/apps/sparks/js/student/studentActivityRegistry.js>)
- [studentActivityLauncherMethods.js](</Users/pjriosc/Documents/TECHNOLOGY 2026/apps/sparks/js/student/studentActivityLauncherMethods.js>)
- [studentActivityProgressFlowMethods.js](</Users/pjriosc/Documents/TECHNOLOGY 2026/apps/sparks/js/student/studentActivityProgressFlowMethods.js>)
- [wordSearchPuzzleStateMethods.js](</Users/pjriosc/Documents/TECHNOLOGY 2026/apps/sparks/js/activities/wordSearch/wordSearchPuzzleStateMethods.js>)
- [wordSearch.js](</Users/pjriosc/Documents/TECHNOLOGY 2026/apps/sparks/js/activities/wordSearch.js>)
- [synonymAntonym.js](</Users/pjriosc/Documents/TECHNOLOGY 2026/apps/sparks/js/activities/synonymAntonym.js>)

Supporting files: [published/local differences](published-local-differences.json), [weekly proposal JSON](weekly-pool-proposal.json), [published catalog check](published-catalog-check.json), [activity eligibility audit](activity-eligibility-audit.json).
