# Grade 6 Monthly Plans to App Activity Audit

Reviewed:
- `plans/6th Grade Technology/Draft Planning/Monthly Planning`
- `plans/6th Grade Technology/6th Grade Monthly Planning`
- `plans/6th Grade Technology/Annual Plans/6° Technology and Robotics - Annual Plan - 2026.md`
- Current app activity support in `teacher.html`, `student.html`, `js/teacher.js`, `js/student/studentClassroomActivities.js`, `js/activityStructuredResponse.js`, and `js/activityCardSort.js`

Grade-band rule: Grade 6 is Primary. Each trimester should keep exactly 5 formal grades; app activities should support evidence collection without turning every practice task into another formal grade.

## Current App Support

The app currently has two usable activity lanes.

1. Vocabulary activities:
   - Word Hunt
   - Matching
   - Flashcards
   - Quiz
   - Synonym & Antonym
   - Word Search
   - Crossword
   - Hangman
   - Word Scramble
   - Vocabulary Wordle
   - Speed Match
   - Fill in Blank

2. Classroom Activities:
   - Map / Diagram: blank map, labeled map, concept map, process diagram
   - Structured Response: worksheet, reflection, checklist
   - Structured response block types include short answer, long answer, multiple choice, multi-select, dropdown, true/false, rating, number, date, matching, ranking, table/grid, and checklist.

There is also `card-sort` code with category sort, sequence sort, and process sort templates in `js/activityCardSort.js`, and `js/teacher.js` imports it. However, it is not fully wired into the teacher template dropdown, activity type select, student renderer, or Supabase constraints. Treat card sort as a nearly-started new activity type, not a usable classroom activity yet.

## Already Good Fits

These can be assigned in the current app without needing a new activity type.

### Vocabulary Practice and Vocabulary Grades

Use existing Grade 6 vocabulary sets and the vocabulary activity lane.

- March T1 core vocabulary table: Word Hunt plus final report, then Matching/Quiz for review.
- Weekly vocabulary reviews from March through December: Flashcards, Matching, Crossword, Word Search, Fill in Blank, Quiz, Speed Match.
- June robotics vocabulary table: Word Hunt using `grade6_t2_summative_robotics_vocabulary`.
- September spreadsheet/data vocabulary table: Word Hunt using `grade6_t3_summative_spreadsheet_vocabulary`.

Notes:
- The Grade 6 vocabulary files already exist under `vocabularies/grade6`.
- Word Hunt fits the formal vocabulary-table evidence better than asking students to rebuild a separate table, because it can collect definition, image/illustration, examples, and report output.

### Scenario, Reflection, Checklist, and Short Written Evidence

Use Structured Response.

- March online communication scenario quiz: multiple choice/dropdowns for public/private, audience, and permission, with short explanation fields.
- April copyright image-selection form: source, safe-to-use decision, fit explanation, and credit line.
- April website checklist and link evaluation checklist.
- May Internet Day campaign reflection.
- June robotics safety rules.
- June movement/debugging checks when the evidence is written correction and explanation.
- August final robotics reflection and readiness checklist.
- November project reflection and peer feedback notes.
- December final project plan, explanation notes, and reflection.

### Diagrams, Plans, Layouts, and Flowcharts

Use Map / Diagram, often paired with Structured Response.

- March packet drawing with header/payload.
- March web page layout sketch.
- April web page structure/layout and navigation map.
- July mBot route map and command plan.
- July mBot sensor if/then flowchart.
- October 3D model sketch with labeled shapes.
- December micro:bit sensor-condition flowchart.

Best pattern: Map / Diagram for the drawing, Structured Response for the required explanation/checklist.

## Works, But Awkward Without a New Type

These can be done now, but the current activity type is not ideal.

- Sorting tasks such as public/private, OK/not OK image use, tool purpose, reuse/repair/recycle/e-waste, input/output, sensor/output, and true/false response categories.
  - Current workaround: Structured Response with matching, ranking, dropdowns, or table/grid.
  - Better: Card Sort.

- Ordering tasks such as packet order, movement commands, Scratch design steps, robot testing steps, and plan/build/test/improve.
  - Current workaround: Structured Response ranking.
  - Better: Sequence Sort or Process Sort.

- Labeling mBot and micro:bit parts on a picture.
  - Current workaround: Map / Diagram with a teacher-built diagram or Structured Response matching.
  - Better: Image Label / Hotspot Diagram.

- Screenshot or file evidence from Scratch, Google Sites, Google Sheets, Tinkercad, MakeCode, mBot, or micro:bit.
  - Current workaround: students paste a link or describe the evidence in Structured Response.
  - Better: External Artifact / Evidence Upload.

## New Activity Types Worth Adding

### 1. Card Sort / Sequence Sort

Priority: highest.

This already has partial app code and would cover a large share of Grade 6 tasks.

Use it for:
- March: online tools by purpose; public/private examples.
- April: OK to use/not OK to use image examples; link labels.
- May: safe/unsafe/unsure online actions; reuse/repair/recycle/e-waste sorting.
- June: movement command order; robot actions to output signals.
- July: loop vs non-loop examples; sensor conditions and responses.
- August: mBot Knowledge Card stations and card-to-action matching.
- November: input/output sorting.

Implementation needs:
- Add Card Sort to teacher template dropdown and activity type select.
- Add database constraints for `card-sort`.
- Add teacher builder UI for categories/cards/correct answers.
- Add student drag/drop renderer.
- Add teacher review summary showing correct, misplaced, and unplaced cards.

### 2. External Artifact / Evidence Upload

Priority: very high.

This would let the app manage activities whose actual creation happens in another tool.

Use it for:
- April: Google Sites page evidence and Scratch score project evidence.
- June-August: mBot code screenshots, route/test data, robot demonstration evidence.
- September-October: spreadsheet table/chart screenshots or files; Tinkercad/3D model screenshots.
- November-December: MakeCode/micro:bit screenshots, simulator links, final project evidence.

Suggested fields:
- File upload or image upload.
- Link field.
- Screenshot preview.
- Teacher checklist.
- Student explanation/reflection.
- Optional late/make-up instructions.

### 3. Spreadsheet / Data Table / Chart Activity

Priority: high for September and October.

Use it for:
- September mBot STEM data table.
- September formula practice.
- October chart creation and 3-question conclusion task.

Current Structured Response table/grid is enough for simple entry, but it does not calculate formulas or create charts. A dedicated data activity could include typed rows, numeric validation, simple formulas, and chart output.

### 4. Image Label / Hotspot Diagram

Priority: medium-high.

Use it for:
- Website feature annotation.
- mBot parts diagram.
- micro:bit parts diagram.
- 3D model shape labels.

This could be built as either a new type or as an upgrade to Map / Diagram with locked background images and required labels.

### 5. Flowchart / Algorithm Builder

Priority: medium.

Use it for:
- Packet routes.
- mBot if/then conditions.
- micro:bit sensor response conditions.
- Scratch and MakeCode planning.

Current Map / Diagram can handle this, but a dedicated builder would make grading easier because nodes could have types: input, condition, true action, false action, output, explanation.

### 6. Peer Feedback / Gallery

Priority: medium.

Use it for:
- May awareness products.
- August robotics demonstrations.
- November presentation/reflection.
- December final demonstrations.

Current Structured Response can collect reflections, but it does not create a gallery or assign peer comments.

## Month-by-Month Fit

### March

Already doable:
- Core vocabulary table through Word Hunt.
- DNS/IP short written checks through Structured Response.
- Packet drawing through Map / Diagram.
- Shared digital work reflection through Structured Response.
- Online communication scenario quiz through Structured Response.
- Website feature plan through Map / Diagram plus Structured Response.

New type helpful:
- Public/private and tool-purpose sorting through Card Sort.
- Packet order through Sequence Sort.

### April

Already doable:
- Copyright vocabulary through vocab games.
- Copyright image-selection form through Structured Response.
- Web page layout and navigation map through Map / Diagram.
- Website checklist through Structured Response.
- Scratch variable reflection through Structured Response.

New type helpful:
- OK/not OK image-source sorting through Card Sort.
- Scratch project evidence through External Artifact / Evidence Upload.
- Website screenshot/link evidence through External Artifact / Evidence Upload.

### May

Already doable:
- Internet Day vocabulary and e-waste vocabulary through vocab games.
- Responsible internet rules and campaign reflection through Structured Response.
- Awareness product plan through Map / Diagram.
- Basic poster or campaign sketch through Map / Diagram.

New type helpful:
- E-waste sorting check through Card Sort.
- Polished poster/slide/infographic work through a Media/Product Builder or Evidence Upload.

### June

Already doable:
- Robotics vocabulary through Word Hunt.
- Safety rules through Structured Response.
- mBot part/function explanations through Structured Response.
- Movement prediction and debugging explanation through Structured Response.
- Simple route map through Map / Diagram.
- Output signal explanation through Structured Response.

New type helpful:
- Movement command ordering through Sequence Sort.
- mBot parts labeling through Image Label / Hotspot Diagram.
- Robot code/test evidence through External Artifact / Evidence Upload.

### July

Already doable:
- Route map and command plan through Map / Diagram plus Structured Response.
- Loop explanation through Structured Response.
- Sensor observation notes through Structured Response.
- If/then flowchart through Map / Diagram.
- Mini-challenge plan/reflection through Structured Response.

New type helpful:
- Route command cards through Sequence Sort.
- Sensor condition/response matching through Card Sort.
- Robot test logs and screenshots through External Artifact / Evidence Upload.
- Dedicated Flowchart / Algorithm Builder for the mBot condition grade.

### August

Already doable:
- Knowledge Card notes through Structured Response.
- STEM challenge plan through Structured Response.
- Demonstration explanation notes through Structured Response.
- Final reflection/readiness checklist through Structured Response.

New type helpful:
- Knowledge Card stations through Card Sort or Station Rotation.
- Final challenge evidence through External Artifact / Evidence Upload.
- Peer/demo feedback through Peer Feedback / Gallery.

### September

Already doable:
- Spreadsheet/data vocabulary through Word Hunt and vocabulary games.
- mBot readiness checklist through Structured Response.
- Challenge plan and fair-test reflection through Structured Response.
- Clean data-table explanation through Structured Response.

New type helpful:
- Actual data table and formula practice through Spreadsheet / Data Table / Chart Activity.
- Robot data collection evidence through External Artifact / Evidence Upload.

### October

Already doable:
- Chart vocabulary through vocabulary games.
- Chart questions and conclusion through Structured Response.
- 3D model sketch/design plan through Map / Diagram plus Structured Response.
- 3D model evidence review checklist through Structured Response.

New type helpful:
- Actual chart creation through Spreadsheet / Data Table / Chart Activity.
- 3D model screenshot/file evidence through External Artifact / Evidence Upload.
- Shape labels through Image Label / Hotspot Diagram.

### November

Already doable:
- Presentation notes and reflection through Structured Response.
- Peer feedback notes through Structured Response.
- micro:bit vocabulary through vocabulary games.
- Basic input/output check through Structured Response matching/dropdowns.
- Counter plan and reflection through Structured Response.

New type helpful:
- micro:bit parts labeling through Image Label / Hotspot Diagram.
- Input/output sorting through Card Sort.
- MakeCode evidence through External Artifact / Evidence Upload.

### December

Already doable:
- Sensors/conditions vocabulary through vocabulary games.
- Sensor-condition flowchart through Map / Diagram.
- Final project plan, explanation notes, and final reflection through Structured Response.

New type helpful:
- Dedicated Flowchart / Algorithm Builder for if/then conditions.
- MakeCode/micro:bit screenshot or link evidence through External Artifact / Evidence Upload.
- Demo feedback through Peer Feedback / Gallery.

## Recommended Build Order

1. Finish Card Sort / Sequence Sort because it is already partially present and covers many Grade 6 sorting/order checks.
2. Add External Artifact / Evidence Upload because many Technology activities happen in external tools.
3. Upgrade Map / Diagram for image labeling or add a dedicated Image Label activity.
4. Add Spreadsheet / Data Table / Chart activity for September-October.
5. Add a dedicated Flowchart / Algorithm Builder if route/condition grading needs to be more structured than free drawing.

## Bottom Line

Most Grade 6 planned activities can already be supported by the app as evidence collection, vocabulary practice, reflection, checklist, worksheet, map, diagram, or flowchart activities.

The largest missing pieces are not more vocabulary games. The best next activity types are:
- Card Sort / Sequence Sort
- External Artifact / Evidence Upload
- Image Label / Hotspot Diagram
- Spreadsheet / Data Table / Chart
- Flowchart / Algorithm Builder

Those additions would let the app cover almost every Grade 6 monthly-plan activity without replacing the real tools students still need for Scratch, Google Sites, Google Sheets, Tinkercad, mBot, and micro:bit.
