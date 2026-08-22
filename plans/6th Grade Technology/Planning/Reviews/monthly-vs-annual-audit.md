# Monthly Plans vs Annual Plan Audit

Source files reviewed:

- `TECHNOLOGY 6°/ANNUAL PLAN /6° Technology and Robotics - Annual Plan - 2026.md`
- Monthly overview files from March through December in `TECHNOLOGY 6°/MONTHLY PLAN /`

## What To Check

Use this checklist when revising each month:

- Annual alignment: every monthly topic should clearly connect to an annual topic, objective, competence, or indicator.
- Missing annual content: if a monthly topic is valuable but absent from the annual plan, add it to the annual plan instead of leaving it disconnected.
- Continuity: topics should build in prerequisite order, from concept to guided practice to project/application to assessment/reflection.
- Weekly load: each 1-hour or 2-hour class block should have a realistic number of activities for 6th grade students.
- Vocabulary usefulness: keep only terms students will use in the activity, product, reflection, or assessment.
- Assessment pacing: summatives should appear after enough practice, not immediately after a new skill.
- Student product: each lesson should produce something observable, such as a notebook response, file, program, diagram, worksheet, logbook entry, prototype, or reflection.
- Resources: every named resource should exist or be easy to access: videos, worksheets, websites, kits, Google Classroom templates, slides, study guides.
- Year/trimester/date consistency: all monthly plans should match 2026 and the correct trimester.
- Naming and spelling: file names, month names, topic titles, and repeated section labels should be consistent.
- Placeholder cleanup: no empty `Topic`, `Book pages`, `Competences`, `Learning Objectives`, or `Learning Outcomes` sections should remain.
- Language consistency: use STEM consistently unless an official document explicitly requires another term.
- Group feasibility: projects should specify whether students work individually, in pairs, or groups, and how groups are assessed.

## High Priority Findings

### 0. Updated constraint: 6th grade will use mBot, not Python or Worm Robot

Teacher decision:

- Do not teach Python or similar text-based programming in 6th grade.
- Do not teach the Worm Robot project.
- Use mBot for the robotics unit.
- Use mBot Knowledge Cards Part 1 as a main robotics resource.
- May will be used for Internet Day and recycling, not for finishing Scratch.

Impact:

- July's Python lessons should be removed or replaced.
- July's K96131/Worm Robot lessons should be removed or rewritten for mBot.
- The annual plan should not add Python or Worm Robot.
- The annual second trimester should explicitly name mBot if that is the required platform.

What remains useful:

- General robot structure and components.
- Motors, controller, sensors, power, wheels.
- Basic movement.
- Sequencing and paths.
- LED/visual feedback.
- Sound/audio feedback if the mBot setup supports it.
- Ultrasonic or line-following sensors, depending on the mBot kit available.
- Simple sensor-triggered behavior.
- An integrated mBot challenge/project.

### 1. May and August are empty planning shells

Files:

- `MONTHLY PLAN /1st Trimester/05. May/6° Technology - May.md`
- `MONTHLY PLAN /2nd Trimester/08. August/6° Technology - August.md`

Issue:

Both files contain blank competences, learning objectives, learning outcomes, and repeated empty topic blocks. They cannot currently function as monthly extensions of the annual plan.

Recommended fix:

- May should be rebuilt around Internet Day and recycling, connecting back to digital citizenship, responsible technology use, research, communication, and environmental responsibility.
- August should complete the second-trimester robotics scope using mBot Knowledge Cards Part 1: visual feedback, audio feedback, sensors, sensor-triggered behavior, integrated mini-project, assessment, and reflection.

### 2. Several monthly plans still say `Year: 2024`

Files include:

- May
- June
- July
- August
- September
- October
- December

Issue:

The annual plan is for 2026, but many monthly plans still show 2024. This is a formal consistency problem.

Recommended fix:

Update all monthly overview files to `Year: 2026`.

### 3. September file name was misspelled

File:

- Previous file name: `MONTHLY PLAN /3rd Trimester/09. September/6° Technology - Septemeber.md`
- Corrected file name: `MONTHLY PLAN /3rd Trimester/09. September/6° Technology - September.md`

Issue:

The file name said `Septemeber`, while the document content said `SEPTEMBER`.

Status:

Corrected in the Markdown and original Word file names.

### 4. June and July need to be converted into an mBot unit

Current monthly topics to remove or replace:

- Intermediate Python variables, data types, `print()`, operators, and `if` statements
- K96131 kit assembly
- Worm Robot project

Current monthly topics that can be kept but simplified for mBot:

- Robot communication methods
- Robot coordination
- Robot sensors
- Robot data processing and sensor integration

Annual second trimester currently includes:

- Robot structure
- Basic movement
- Visual and audio feedback
- Sensors and reactive behaviors

Issue:

The annual plan fits an mBot robotics unit, but June/July currently contain Python, K96131, and Worm Robot content that no longer matches the intended 6th grade course.

Recommended fix:

- Add `mBot` explicitly to the annual second trimester plan as the robotics platform.
- Replace Python lessons with mBot block-based programming lessons.
- Replace K96131/Worm Robot lessons with mBot assembly/setup, movement, sensors, and challenge lessons.
- Keep robotics vocabulary only when it connects to the mBot kit students will use.

### 5. Third trimester monthly plans shift into STEM projects not described in the annual plan

Files:

- September
- October
- November
- December

Issue:

The annual third trimester is organized around spreadsheets, 3D modelling, and micro:bit sensing movement. The monthly plans use a broad STEM project/logbook structure. That can work, but the annual plan should explicitly say that spreadsheets, 3D modelling, and micro:bit are applied through a STEM project cycle.

Recommended fix:

Add an annual third-trimester strand such as:

> Integrated STEM project cycle: students document a project in a digital logbook, organize project data with spreadsheets, design or prototype parts using 3D modelling, test and improve their solution, present their work, and reflect on results.

Then revise September-November so every STEM project lesson names the annual skill it is practicing.

### 6. November and December repeat STEM competences while teaching micro:bit

Issue:

November and December include STEM-focused competences/objectives/outcomes, but the actual late November and December lessons are micro:bit programming, inputs, LEDs, variables, sensors, conditionals, sound, and final interactive projects.

Recommended fix:

Rewrite the monthly competences/objectives/outcomes to include both:

- STEM project presentation/reflection, if kept.
- Micro:bit programming with inputs, outputs, variables, conditionals, sensors, and testing.

### 7. December shows the wrong trimester

File:

- `MONTHLY PLAN /3rd Trimester/12. December/6° Technology - December.md`

Issue:

The file is stored under the 3rd Trimester folder, but the plan header says `Trimester:2nd`.

Recommended fix:

Change December to `Trimester:3rd`.

## Pacing Concerns

### March

March has 8 lesson blocks across 4 weeks, which matches 3 hours per week if the pattern is Tuesday 1 hour and Thursday 2 hours. The content generally follows the annual plan:

- Internet addresses
- Data packets
- Working together
- Shared/remixed work
- Communication
- Responsible communication
- Website exploration
- Web page planning

Concerns:

- Week 1, lesson 1 includes lab rules, robotic kit handling, packet ordering, DNS lookup, multiple websites, and reflection. That is probably too much for 1 hour.
- Some robotics/lab rules language appears during an internet-address lesson. Keep safety rules if needed, but remove robotic kit handling unless kits are used that day.
- `Reusing and Remixing Online` is not named clearly in the annual plan. It fits `Working together` and `Shared working`, but the annual plan should mention reuse/remix if this remains a major lesson.

Recommended fix:

- Split the first lesson into: lab norms + internet addresses + one DNS lookup.
- Move packet ordering fully to the Data Packets lesson.
- Add `reuse/remix of shared digital work` under first-trimester online collaboration if kept.

### April

April mostly extends the first-trimester annual plan:

- Copyright and fair use
- Web design and previewing
- Navigation paths
- External links and website evaluation
- Variables in Scratch
- Updating variables
- Improving games
- Designing games

Concerns:

- The first copyright lesson has duplicate `Books: Pi Foundation - the-cc.io/curriculum`.
- Some 2-hour blocks are realistic, but some 1-hour blocks list 8-10 activities. For example, the variable lessons include worksheet design, Scratch project creation, programming three sprites, testing, debugging, and post-lesson worksheet work.
- The annual plan includes `Design to code` and `Improving and sharing`, but April stops at designing games. May must finish implementation, debugging, sharing, evaluation, and summative assessment.

Recommended fix:

- Trim each 1-hour block to one core skill, one practice task, one exit ticket.
- Put full game build/share/evaluate sequence in May.

### May

May is currently blank. Teacher direction is to use May for Internet Day and recycling.

Recommended May structure:

- Week 1: Internet Day: responsible internet use, online communication, digital citizenship, and safe/ethical sharing.
- Week 2: Recycling and technology: e-waste, responsible device use, reuse/repair/recycle, and environmental impact.
- Week 3: Create and present a digital awareness product: poster, slide, infographic, short campaign, or classroom pledge.

Annual plan impact:

- Add May topics to the annual plan under first-trimester digital citizenship or correlated environmental responsibility.
- If Scratch `Design to code` and `Improving and sharing` remain in the annual plan, they need either a reduced April placement or a shorter assessment/product sequence.

### June

June is listed as 1 week but contains 4 lesson blocks, which suggests 2 weeks of content if the normal pattern is two class meetings per week.

Concerns:

- Competences/objectives/outcomes are blank.
- Year is 2024.
- Robotics introduction and parts identification align with annual second trimester.
- Advanced components, microcontrollers, actuators, power supply, wheels, tracks, gear systems, and Canva poster may be too much if June truly has only one week.

Recommended fix:

- Either change `WEEKS:1` to match the actual number of planned class weeks, or reduce June to two blocks.
- Add objectives from annual robotics: identify components, assemble safely, explain main robot parts, follow classroom norms.

### July

July has 10 lesson blocks across 5 weeks, which fits the 3-hour weekly pattern.

Concerns:

- Year is 2024.
- Python intermediate should be removed for 6th grade.
- `Programming with Python: Operators and If Statements` appears twice and should be replaced.
- K96131 and Worm Robot should be removed because the robotics platform will be mBot.
- Robot communication, coordination, sensors, and data processing can remain only if rewritten as concrete mBot lessons.
- Some vocabulary is heavy for 6th grade and may not be used in a student product: Wi-Fi, Bluetooth, infrared, gyroscope, accelerometer, data processing, microcontroller, actuator, circuitry.

Recommended fix:

- Make July a focused mBot robotics month.
- Replace Python with mBot block-based programming, sequence, movement commands, turns, loops, and simple conditions.
- Replace K96131/Worm Robot with mBot setup, calibration, path challenges, obstacle avoidance, line following, and troubleshooting.
- Keep vocabulary tied to kit use: mBot, motor, wheel, controller, sensor, ultrasonic sensor, line sensor, LED, buzzer, block, sequence, loop, condition, test, debug.

Suggested July replacement:

- Week 1: mBot setup and basic movement: connect, upload/run, move forward/backward, turn, stop.
- Week 2: Movement sequences and paths: create a route, test, debug turns and timing.
- Week 3: Visual/audio feedback: LEDs and buzzer communicate robot state.
- Week 4: Sensors: ultrasonic obstacle detection and/or line sensor readings.
- Week 5: Teacher-assigned mBot Ultrasonic Sensor Flowchart and Programming Task with two required responses.

### August

August is a three-week teacher-assigned Rescue Robot sequence.

The final second-trimester sequence includes:

- Basic movement
- Movement sequences and paths
- Line-sensor input and corrections
- Ultrasonic obstacle checks
- Left/right branch decisions
- Final rescue-zone stop

Recommended August structure:

- Week 1: Review and test the assigned line-following logic.
- Week 2: Finish the teacher-provided obstacle, branch, and stop logic, then present and demonstrate Summative #5.
- Week 3: Complete formative Rescue Robot reflection, peer feedback, robotics review stations, debugging practice, and equipment readiness.

### September

September has only 2 weeks and begins the third trimester with STEM, databases, spreadsheet roles, and formulas.

Concerns:

- The original file name typo has been corrected.
- The revised monthly plan now removes the old 2024/trimester metadata issue.
- STEM/database/logbook work was reduced so September now focuses more directly on data, formatting, and formulas.
- Annual plan starts third trimester with collecting data and formatting spreadsheets. September now aligns more directly with that sequence.

Recommended fix:

- Keep September as a short, focused spreadsheet entry month: data/information, clean tables, formatting, and simple formulas.

### October

October has 8 lesson blocks across 4 weeks.

Concerns:

- Header says Trimester 2 and Year 2024.
- It mixes spreadsheets, 3D modelling, STEM project building, testing, report, and presentation in one month.
- Annual plan expects a fuller sequence for spreadsheets and 3D modelling. October jumps quickly from spreadsheets to 3D objects to full project testing/reporting.
- The vocabulary updates are broad project-management words, but some are not directly assessed or used in technical outcomes.

Recommended fix:

- Keep October as the bridge from spreadsheet planning to 3D modelling, but reduce the final report/presentation load or move it to November.
- Make vocabulary serve the product: data set, formula, chart, 3D shape, rotate, resize, group, align, prototype, test.

### November

November contains STEM project completion/presentation/reflection, then micro:bit introduction and variables.

Concerns:

- It starts with a blank placeholder cell.
- Competences/objectives/outcomes focus on STEM, while the later lessons teach micro:bit.
- Micro:bit content aligns with annual third trimester, but it arrives late if December is only three weeks.
- Use `STEM` consistently.

Recommended fix:

- Remove the placeholder cell.
- Make the first half of November final STEM/3D project presentation/reflection only if October truly produced the project.
- Make the second half a clear start to `Programming B - Sensing movement`: micro:bit, MakeCode, inputs, LED display, variables.

### December

December has 2 lesson blocks despite saying 3 weeks.

Concerns:

- Header says Trimester 2 and Year 2024.
- Competences/objectives/outcomes focus on STEM, but lessons teach micro:bit sensors, conditionals, sound, and final interactive project.
- Annual plan includes specific topics that are not fully represented: `Go with the flow`, `Sensing inputs`, `Finding your way`, `Designing a step counter`, `Making a step counter`.
- The final interactive project may be too open unless students already practiced inputs, variables, conditionals, sensors, and testing.

Recommended fix:

- Either add more December blocks for the missing micro:bit sequence, or reduce the annual plan’s micro:bit scope.
- If the step counter remains in the annual plan, December needs explicit step counter design/build/testing lessons.

## Content Missing From Monthly Plans

These annual topics are missing, incomplete, or only indirectly present:

- May: Internet Day and recycling are not currently in the annual plan.
- If Scratch is still expected: `Design to code`, `Improving and sharing` for Scratch games need to be compressed into April or explicitly removed/reduced in the annual plan.
- Second trimester: basic robot movement, movement sequences and paths, visual feedback, audio feedback, sensor-triggered behavior, integrated mini-project.
- Third trimester: spreadsheet chart creation/presenting data is not clearly developed in the monthly overview.
- Third trimester: 3D modelling sequence is compressed and missing explicit name badge/desk tidy style practice unless the broader STEM project replaces it.
- Third trimester: micro:bit compass/finding your way and step counter sequence is not clearly planned in the monthly overview.

## Topics To Add To Annual Plan If Kept

Add these only if they are intentional parts of the year:

- Internet Day.
- Recycling, e-waste, and environmental responsibility in technology use.
- STEM project cycle and digital logbook.
- Spreadsheet database for project roles and planning.
- mBot robotics platform.
- mBot Knowledge Cards Part 1 as a robotics resource.
- mBot movement, LED/buzzer feedback, ultrasonic sensor, line sensor, and integrated robot challenge.
- Robot communication and coordination, only as simple mBot behavior/project vocabulary.
- Robot data processing, only in age-appropriate language such as `sense-think-act`.
- Canva poster/brochure as a presentation artifact, if assessed.

## Vocabulary Cleanup Guidance

Keep vocabulary if students will use it in at least one of these ways:

- Say it during discussion.
- Write it in a notebook/logbook/reflection.
- Apply it directly in a program, spreadsheet, website, robot build, or model.
- See it on an assessment/rubric.

Vocabulary to reconsider or reduce:

- March: keep DNS, IP address, packet, header, payload, protocol. Remove or delay unrelated robotics/lab kit terms.
- April: keep copyright, fair use, hyperlink, navigation, variable, value, set, change, event, algorithm. Avoid repeating web page/media terms every lesson unless used.
- July: reduce advanced robotics vocabulary unless students handle those exact parts. Consider removing Wi-Fi/Bluetooth/IR/gyroscope/accelerometer if the kit does not use them.
- September-November: use STEM consistently. Keep project vocabulary only if it appears in logbooks or rubrics.
- December: use micro:bit vocabulary: input, output, LED, variable, condition, sensor, temperature, light level, sound, test, debug.

## Suggested Revision Order

1. Fix formal metadata: year, trimester, September spelling, blank placeholders.
2. Update the annual plan to name mBot and remove Python/Worm Robot from the monthly direction.
3. Fill May with Internet Day/recycling and August with mBot Knowledge Cards Part 1 robotics.
4. Rewrite November and December objectives so they match the actual micro:bit lessons.
5. Rebalance overloaded 1-hour lessons.
6. Trim vocabulary to words used in activities/products/assessments.
7. Add or update summative assessment points for each trimester.

## Recommended Curriculum Spine

This spine would make the monthly plans read as direct extensions of the annual plan:

- March: internet addresses, packets, online collaboration, responsible communication, website exploration and planning.
- April: copyright, web page creation, navigation, links/evaluation, Scratch variables and game design.
- May: Internet Day, digital citizenship reinforcement, recycling/e-waste, environmental responsibility, awareness product.
- June: mBot safety, kit organization, robot structure, components, simple movement foundations.
- July: mBot movement sequences, robot feedback, sensors, condition practice, and the teacher-assigned ultrasonic Summative #4 task.
- August: assigned Rescue Robot line-following and obstacle-decision practice, testing, English explanation, Summative #5 demonstration, and equipment return.
- September: data/information, spreadsheet data sets, formatting, formulas.
- October: event/project planning spreadsheet, charts/presenting data, 3D modelling basics and design.
- November: 3D/STEM project completion, presentation/reflection, micro:bit introduction.
- December: micro:bit sensors, conditionals, final sensing project or step counter, assessment/reflection.
