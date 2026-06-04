# Feasibility Check - 7th Grade Technology 2026

Review date: June 3, 2026

## Scope Reviewed

- Annual plan: `plans/7th Grade Technology/Annual Plans/7° Technology and Robotics - Annual Plan - 2026.md`
- Official monthly DOCX plans: March, April, May, June, July, August, September, October, November, December
- Draft monthly Markdown plans: March through December
- Existing overview: `plans/7th Grade Technology/Assestments/simple-classroom-progress.md`
- Rubrics, study guides, and trimester project drafts
- Grade 7 vocabulary JSON files
- Grade 7 app activity seed: `supabase/seeds/grade7_app_activities.sql`

## Executive Verdict

The 7th grade plan is feasible and mostly teach-ready, but it has a higher execution risk than 6th grade because it correctly follows the secondary assessment structure: 5 daily grades, 2 appreciation grades, and 1 exam project per trimester.

The strongest part of the plan is the year arc. It moves from mBot robotics and mBlock, to media design and Scratch programming, to spreadsheets, Scratch decomposition, credible-source/media work, and micro:bit physical-computing design. The weakest point is not curriculum logic; it is project control. The three exam projects are appropriate only if their required evidence stays tightly bounded and the teacher has hardware/accounts/starter files ready before the project weeks.

Overall rating: feasible with moderate risk.

## Scorecard

| Metric | Rating | Notes |
|---|---|---|
| Assessment compliance | Strong | Each trimester has 5 daily grades, 2 appreciation grades, and 1 exam project in the official monthly plans. |
| Continuity | Strong | Robotics builds toward mBot Maze Navigator; media/Scratch builds toward Scratch Dance Game; spreadsheets/media/micro:bit build toward Mandrake Detection System. |
| Dosification | Mostly strong | 45-minute classes are usually practice, review, planning, or rehearsal. 90-minute classes carry the daily grades and project build work. |
| Content density | High but teachable | March, April, May, October, and November each show 10 topic rows in the official DOCX files. Some include placeholder rows, but Grade 7 remains busier than Grade 6. |
| Gradeability | Strong | Daily/appreciation/exam evidence is visible and mostly rubric-backed. |
| Age appropriateness | Mostly strong | Tasks fit Grade 7 if Scratch/mBot/micro:bit projects are not allowed to expand beyond the stated evidence. |
| Resource readiness | Medium | Rubrics and several study guides exist, but hardware, accounts, starter files, and make-up paths remain the main dependency. |
| Vocabulary alignment | Strong | Each trimester has 12 vocabulary sets: 1 summative set and 11 practice sets. Word load is balanced: IT 79 words, IIT 77, IIIT 82. |
| App/activity support | Mostly strong | The app seed has 67 activities: 46 formative, 12 non-vocabulary daily-grade activities, 6 appreciation activities, and 3 exam-project evidence activities. |
| Official DOCX quality | Mostly strong | All official monthly plans use A4 landscape, 0.5 inch margins, no Word numbering, and green week headers. June-August need Word style cleanup. |

## Formal Assessment Check

Secondary education rule: Grade 7 should have 5 daily grades, 2 appreciation grades, and 1 exam project per trimester.

| Trimester | Daily grades | Appreciation grades | Exam project |
|---|---|---|---|
| 1st Trimester | #1 mBot vocabulary table, #2 mBot parts diagram, #3 mBlock interface labeling, #4 movement calibration chart, #5 obstacle reaction demo | #1 robotics safety and responsibility, #2 perseverance and feedback | mBot Maze Navigator |
| 2nd Trimester | #1 poster/media vocabulary table, #2 environmental poster, #3 branded mini-presentation, #4 Scratch sequence, #5 Scratch debugging check | #1 constructive peer feedback, #2 pair-programming responsibility | Scratch Dance Game |
| 3rd Trimester | #1 spreadsheet vocabulary table, #2 formulas/chart task, #3 Scratch subroutine and loop demo, #4 source credibility/image credit check, #5 micro:bit sensor-system design plan | #1 data teamwork, #2 blog/media responsibility | Mandrake Detection System |

Assessment decision: compliant. The formal structure should be preserved.

## Content Density Check

| Month | Weeks | Active pattern | Formal assessment load | Density decision |
|---|---:|---|---|---|
| March | 4 | mBot parts, assembly, mBlock interface, first movement, system map | 3 daily, 1 appreciation | Dense but acceptable if mBots are ready and routines are explicit. |
| April | 4 | calibration, path planning, LEDs/sound, sensor values, if/else obstacle reaction | 2 daily, 1 appreciation | Teachable; hardware setup and sensor reliability are the main risks. |
| May | 4 | maze project planning, build, debug, documentation, presentation | exam project | Good project window; needs strict team roles and a one-page trial log. |
| June | 4 | poster/media design, Canva, branding, Scratch sequence | 4 daily | Heavy. It moves quickly from media design to Scratch; starter templates help. |
| July | 5 | Scratch selection, operators, loops, debugging, dance prep | 1 daily, 2 appreciation | Teachable; good breathing room after June. |
| August | 4 | Scratch Dance Game project | exam project | Good project window; keep features constrained. |
| September | 2 | spreadsheet intro, formulas, chart | 2 daily | Short but focused; appropriate after recess. |
| October | 5 | data analysis, Scratch decomposition, sources/blog, micro:bit design | 3 daily, 2 appreciation | High density; this is the tightest month. |
| November | 5 | micro:bit threshold practice and Mandrake exam project | exam project | Feasible if micro:bit/sensor/Bluetooth setup is pre-tested. |
| December | 1 | exam/admin buffer | no new grades | Appropriate buffer. |

Density conclusion: feasible, but June and October should not absorb extra school events, make-up overload, or expanded project requirements.

## Continuity Check

The curriculum sequence works:

1. mBot parts, mBlock interface, movement control, calibration, sensors, and if/else.
2. mBot Maze Navigator exam project.
3. Media design and branding before Scratch programming.
4. Scratch sequence, conditions, loops, variables, debugging.
5. Scratch Dance Game exam project.
6. Spreadsheet basics and charts.
7. Scratch decomposition/subroutines and source credibility/media responsibility.
8. micro:bit sensor-system design.
9. Mandrake Detection System exam project.

Continuity strengths:

- Each exam project grows out of the trimester’s daily-grade skills.
- Daily grades are placed before exam projects and are not disguised as project grading.
- Appreciation grades assess habits at natural pressure points: robotics safety, feedback/perseverance, pair programming, data teamwork, and media responsibility.
- Vocabulary sets are distributed around the same monthly skills.

Continuity risks:

- The second trimester jumps from Canva/media design into Scratch fairly quickly. It is manageable, but students need a clear “digital design to interactive design” bridge.
- Third trimester includes spreadsheets, Scratch, source credibility/blog media, and micro:bit design before the Mandrake project. The sequence is logical, but October is crowded.
- The annual-plan Markdown conversion contains repeated table columns from the DOCX conversion. The spine is understandable, but the annual Markdown is visually noisy and should be cleaned if used for official review.

## Project Feasibility

### mBot Maze Navigator

Feasible with conditions.

Strengths:

- Daily grades already prepare students for parts, interface, movement, calibration, and if/else.
- May gives project planning, build, debugging, documentation, rehearsal, and presentation time.

Risks:

- Maze navigation can balloon into route perfection.
- Sensor reliability and battery/motor calibration can create unfair grading differences.

Guardrail:

- Grade plan, route section, code logic, test evidence, debugging, and explanation. Do not grade a perfect maze run as the only success path.

### Scratch Dance Game

Feasible with controlled features.

Strengths:

- Students practice sequence, variables, conditions, loops, debugging, and pair-programming before the project.
- August gives a full project build and presentation window.

Risks:

- The project draft includes ambitious language such as advanced phases and real-world application. Some parts are excellent for extension, but too much for all students if treated as required.

Guardrail:

- Required product should stay to a small interactive dance game with at least two dance routines, input, conditionals, loop/variable use, feedback, one debugging note, and a short explanation.

### Mandrake Detection System

Feasible but highest risk.

Strengths:

- October Daily Grade #5 prepares the sensor-system design.
- November includes threshold testing, project setup, build, reliability debugging, and presentation.

Risks:

- micro:bit plus ultrasonic sensor plus Bluetooth/sound output is technically fragile.
- If the equipment is not ready, students could spend the project week troubleshooting connections rather than demonstrating learning.

Guardrail:

- Prepare a simulation/starter-file fallback. Grade purpose, input/output diagram, threshold rule, test table, reliability improvement, and explanation even if the physical build needs teacher-supported equipment.

## Planning Quality Check

What is working:

- Official monthly plans clearly identify daily grades, appreciation grades, and exam project windows.
- Rubrics exist for each trimester’s daily/appreciation/project structure, with extra teacher keys and print versions for some checks.
- Student evidence is concrete: diagrams, screenshots, checklists, charts, posters, Scratch files, source checks, test tables, demonstrations, and reflections.
- Post activities mostly stay as closure, submission, reflection, or rehearsal.

What needs tightening:

- Standardize wording between `Daily Grade` and `Daily Summative`; both are used, but the gradebook language should be consistent.
- Fix a mismatch in the app seed: the official October plan and rubric place IIIT Appreciation Grade #2 as `Blog Media Responsibility`, but the app seed names it `Project Readiness and Responsibility` in November. The monthly DOCX/rubric should be treated as the current source of truth unless intentionally changed.
- Make sure Daily Grade #1 vocabulary tables are clearly represented in the workflow. They are handled by vocabulary JSONs rather than the app activity seed, which is acceptable but should be documented.

## Resource And Classroom Readiness

Must confirm before teaching:

- mBot kits, batteries, USB/Bluetooth setup, mBlock version, sensors, spare cables, and testing space.
- Canva access, approved image sources, Google Classroom submission flow, and poster templates.
- Scratch accounts or offline Scratch access, starter files, and example projects.
- Google Sheets or Excel access for the spreadsheet unit.
- Google Sites/blog-style post access or a fallback document template.
- micro:bits, ultrasonic sensors, batteries, cables, MakeCode access, Bluetooth/sound-output plan, and simulation fallback.

Materials to prioritize:

1. Make-up versions for Daily Grades #2-#5 in each trimester.
2. A one-page project log for each exam project.
3. mBot calibration and trial-log templates.
4. Scratch starter/debugging files for second trimester.
5. Spreadsheet data set and chart template for third trimester.
6. Source credibility/image credit form.
7. micro:bit Mandrake starter file or simulation pathway.

## App And Vocabulary Alignment

Vocabulary:

- IT: 12 sets, 79 words.
- IIT: 12 sets, 77 words.
- IIIT: 12 sets, 82 words.
- Each trimester has one 10-word summative vocabulary set and 11 smaller practice sets.

App seed:

- 67 total activity records.
- 46 formative classroom activities.
- 12 daily-grade activities for Daily Grades #2-#5 across the three trimesters.
- 6 appreciation-grade activities.
- 3 exam-project evidence activities.

Alignment decision:

- App support is strong, but fix the third-trimester Appreciation Grade #2 title/timing mismatch before relying on the app for formal grade collection.

## DOCX Format And Compatibility Check

Confirmed across official monthly DOCX plans:

- A4 landscape page setup.
- 0.5 inch margins on all sides.
- No Word numbering/list properties found.
- Green week header shading is present.
- Formal assessment emphasis is present in the relevant months.

Compatibility issue:

- June, July, and August official DOCX files were flagged by the Word compatibility audit for nameless styles in `word/styles.xml`.
- March, April, May, September, October, November, and December passed the same package audit.

Recommendation: repair June-August styles before final printing/submission, especially if the files will be opened in Microsoft Word for Mac.

## Final Feasibility Decision

The Grade 7 plan is teachable and coherent. It should be approved with project guardrails and one app-alignment correction.

Approval conditions:

1. Preserve the secondary assessment structure: 5 daily grades, 2 appreciation grades, and 1 exam project per trimester.
2. Keep exam projects evidence-based and bounded; do not require perfect hardware performance as the only path to success.
3. Prepare hardware, starter files, templates, and make-up paths before project weeks.
4. Correct the IIIT Appreciation Grade #2 mismatch between the official/rubric plan and the app seed.
5. Repair June-August DOCX nameless styles before official Word submission.

Final status: feasible with moderate project-resource risk.
