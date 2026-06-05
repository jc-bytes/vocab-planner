-- Grade 7 app activities from the monthly planning.
-- Grade 7 is secondary: formal records represent non-Word-Hunt daily grades,
-- appreciation grades, and exam project evidence. Formative records replace
-- paper-style practice, planning sheets, checks, diagrams, and reflections.

with grade7_raw_activities as (
    select *
    from jsonb_to_recordset($grade7_app_activities$
[
  {
    "id": "grade7_t1_daily_2_mbot_parts_diagram",
    "title": "G7 T1 Daily Grade 2 - mBot Parts Diagram",
    "class_slot": "March Week 2, 90-minute class",
    "description": "Students label at least 8 mBot parts and explain the function of 5 parts.",
    "activity_type": "map-diagram",
    "assessment_purpose": "formal",
    "estimated_minutes": 35,
    "template_id": "labeled-map",
    "teacher_note": "Use for Daily Grade #2 after the Week 2 practice labeling activity.",
    "student_instructions": "Draw or label the mBot. Include at least 8 parts and function notes for 5 parts.",
    "student_output": "Labeled mBot parts diagram with function notes.",
    "materials": "mBot kit, diagram reference, and class notes."
  },
  {
    "id": "grade7_t1_daily_3_mblock_interface_labeling",
    "title": "G7 T1 Daily Grade 3 - mBlock Interface Labeling Check",
    "class_slot": "March Week 3, 90-minute class",
    "description": "Students label mBlock interface areas and explain how blocks become robot instructions.",
    "activity_type": "structured-response",
    "assessment_purpose": "formal",
    "estimated_minutes": 25,
    "template_id": "worksheet",
    "teacher_note": "Use for Daily Grade #3 before or after first movement programming.",
    "student_instructions": "Label the main mBlock areas and explain how the blocks control the robot.",
    "student_output": "Completed interface labeling check.",
    "materials": "mBlock interface screenshot or open mBlock workspace.",
    "fields": [
      { "id": "interface_table", "type": "table-grid", "prompt": "Label at least 6 mBlock interface areas.", "rows": [{"id":"stage","text":"Stage or preview area"},{"id":"blocks_palette","text":"Blocks palette"},{"id":"coding_area","text":"Coding/script area"},{"id":"sprite_device_panel","text":"Sprite or device panel"},{"id":"run_controls","text":"Green flag and stop controls"},{"id":"extension_device_button","text":"Extension or connect-device button"}], "columns": [{"id":"label","text":"Label"},{"id":"function","text":"What is it used for?"}] },
      { "id": "blocks_to_robot", "type": "long-text", "prompt": "Explain how connected blocks become robot instructions." }
    ]
  },
  {
    "id": "grade7_t1_daily_4_movement_calibration_chart",
    "title": "G7 T1 Daily Grade 4 - Movement Calibration Chart",
    "class_slot": "April Week 5, 90-minute class",
    "description": "Students record speed, time, observed distance, and one conclusion about movement accuracy.",
    "activity_type": "spreadsheet-table",
    "assessment_purpose": "formal",
    "estimated_minutes": 35,
    "template_id": "data-table",
    "teacher_note": "Use for Daily Grade #4 while students test measured paths.",
    "student_instructions": "Record at least 6 calibration tests and write a conclusion about speed, time, and distance.",
    "student_output": "Movement calibration table and conclusion.",
    "materials": "mBot, tape measure or floor markers, mBlock, and test area.",
    "columns": [
      {"id":"test","title":"Test","type":"text","width":90},
      {"id":"speed","title":"Speed","type":"number","width":100},
      {"id":"time","title":"Time (sec)","type":"number","width":110},
      {"id":"distance","title":"Observed Distance","type":"number","width":150},
      {"id":"note","title":"Accuracy Note","type":"text","width":180}
    ],
    "min_rows": 6,
    "max_rows": 12,
    "reflections": [
      {"id":"conclusion","prompt":"What conclusion can you make about how speed and time affect movement?", "required": true}
    ]
  },
  {
    "id": "grade7_t1_daily_5_obstacle_reaction_demo",
    "title": "G7 T1 Daily Grade 5 - Reactive Obstacle Program Classroom Check",
    "class_slot": "April Week 8, 90-minute class",
    "description": "Students confirm the mBot obstacle reaction evidence or demonstration was handled through Classroom or teacher observation, then explain if/else logic and robot feedback.",
    "activity_type": "structured-response",
    "assessment_purpose": "formal",
    "estimated_minutes": 35,
    "template_id": "worksheet",
    "teacher_note": "Use for Daily Grade #5 after students test obstacle thresholds. Grade the program evidence from Classroom or teacher observation; use this app check for confirmation and explanation.",
    "student_instructions": "Send your obstacle reaction evidence in Classroom or complete the teacher-observed demonstration, then complete this app check.",
    "student_output": "Classroom/demo confirmation, obstacle reaction checklist, and logic explanation.",
    "materials": "mBot, mBlock, ultrasonic sensor, LED or sound output, and Classroom assignment.",
    "fields": [
      {"id":"classroom_note","type":"instructions","prompt":"The obstacle reaction evidence is sent in Classroom or checked by teacher observation.","helperText":"This app check does not collect links, screenshots, files, or videos."},
      {"id":"submission_status","type":"select","prompt":"How was your obstacle reaction evidence checked?","items":[{"id":"classroom","text":"I sent the evidence in Classroom."},{"id":"observed","text":"My teacher observed the program in class."},{"id":"need_help","text":"I still need help submitting or demonstrating it."}]},
      {"id":"reaction_check","type":"checklist","prompt":"Obstacle reaction checklist","items":[{"id":"moves_clear","text":"The robot moves forward when the path is clear."},{"id":"detects_close","text":"The robot detects a nearby object."},{"id":"stops_feedback","text":"The robot stops and shows a red LED or sound feedback."},{"id":"logic_explained","text":"I can explain the if/else logic."}]},
      {"id":"threshold","type":"long-text","prompt":"What threshold or condition did your program use?"},
      {"id":"improvement","type":"long-text","prompt":"What would improve the robot for a maze?"}
    ]
  },
  {
    "id": "grade7_t1_appreciation_1_robotics_safety_responsibility",
    "title": "G7 T1 Appreciation Grade 1 - Robotics Safety and Responsibility",
    "class_slot": "March Week 4, 90-minute class",
    "description": "Students self-check safe setup, testing, teamwork, and cleanup habits during robotics work.",
    "activity_type": "structured-response",
    "assessment_purpose": "formal",
    "estimated_minutes": 10,
    "template_id": "checklist",
    "teacher_note": "Use for Appreciation Grade #1 during the movement sequence practice class.",
    "student_instructions": "Complete the checklist honestly and give one example of responsible robotics work.",
    "student_output": "Safety and responsibility checklist with evidence note.",
    "materials": "Robotics safety rules and group work evidence.",
    "fields": [
      { "id": "safety_check", "type": "checklist", "prompt": "Robotics safety and responsibility checklist", "items": [{"id":"parts_tray","text":"I kept parts organized on the tray."},{"id":"gentle_cables","text":"I connected cables gently."},{"id":"test_area","text":"I tested only in the assigned area."},{"id":"role_share","text":"I shared builder/coder/tester roles."},{"id":"cleanup","text":"I helped clean up correctly."}] },
      { "id": "evidence", "type": "long-text", "prompt": "Give one specific example of responsible work from today." }
    ]
  },
  {
    "id": "grade7_t1_appreciation_2_perseverance_feedback_reflection",
    "title": "G7 T1 Appreciation Grade 2 - Perseverance and Feedback Reflection",
    "class_slot": "April Week 6, 90-minute class",
    "description": "Students reflect on effort, organization, feedback, and perseverance during route testing.",
    "activity_type": "structured-response",
    "assessment_purpose": "formal",
    "estimated_minutes": 10,
    "template_id": "reflection",
    "teacher_note": "Use for Appreciation Grade #2 after efficient navigation testing.",
    "student_instructions": "Reflect on your effort and how you used feedback during testing and debugging.",
    "student_output": "Perseverance and feedback reflection.",
    "materials": "Route testing notes and partner feedback.",
    "fields": [
      { "id": "effort", "type": "rating-scale", "prompt": "Rate your effort during testing from 1 to 5." },
      { "id": "feedback_used", "type": "long-text", "prompt": "What feedback did you receive, and how did you use it?" },
      { "id": "perseverance", "type": "long-text", "prompt": "Describe one moment when you kept working after a problem." },
      { "id": "next_time", "type": "short-text", "prompt": "What habit should you improve next time?" }
    ]
  },
  {
    "id": "grade7_t1_exam_mbot_maze_navigator",
    "title": "G7 T1 Exam Project - mBot Maze Navigator Classroom Check",
    "class_slot": "May Weeks 10-12 exam project",
    "description": "Students confirm mBot Maze Navigator project evidence was handled through Classroom or teacher observation, then reflect on code logic, sensors, and problem solving.",
    "activity_type": "structured-response",
    "assessment_purpose": "formal",
    "estimated_minutes": 90,
    "template_id": "worksheet",
    "teacher_note": "Use as the exam project check for the May project cycle. Grade the project evidence from Classroom and the final demonstration; use this app activity for confirmation and reflection.",
    "student_instructions": "Send your maze navigator evidence in Classroom or complete the teacher-observed demonstration, then complete this project check.",
    "student_output": "Classroom/demo confirmation, project checklist, and reflection.",
    "materials": "mBot, maze, program, test table, project rubric, presentation notes, and Classroom assignment.",
    "fields": [
      {"id":"classroom_note","type":"instructions","prompt":"Your maze navigator files, screenshots, test evidence, or demo evidence belong in Classroom or teacher observation.","helperText":"This app check collects only confirmation and reflection."},
      {"id":"submission_status","type":"select","prompt":"How was your maze navigator evidence submitted or checked?","items":[{"id":"classroom","text":"I sent the project evidence in Classroom."},{"id":"observed","text":"My teacher observed the final demonstration."},{"id":"both","text":"I used both Classroom evidence and teacher observation."},{"id":"need_makeup","text":"I need a make-up submission or demonstration."}]},
      {"id":"project_check","type":"checklist","prompt":"Maze Navigator project checklist","items":[{"id":"plan","text":"My Classroom evidence or demo includes a maze plan with start, finish, checkpoints, and sensor checks."},{"id":"testing","text":"My evidence includes testing or debugging notes."},{"id":"demo","text":"My teacher can see the final robot demonstration or best available section."},{"id":"team_roles","text":"I can explain my role and responsibility."}]},
      {"id":"code_logic","type":"long-text","prompt":"How did your code control the robot?"},
      {"id":"sensor_use","type":"long-text","prompt":"How did sensors support decisions?"},
      {"id":"challenge_solution","type":"long-text","prompt":"Name one challenge and how your group solved or improved it."}
    ]
  },
  {
    "id": "grade7_t2_daily_2_environmental_poster_evidence",
    "title": "G7 T2 Daily Grade 2 - Environmental Poster Classroom Check",
    "class_slot": "June Week 2, 90-minute class",
    "description": "Students confirm their environmental poster was sent through Classroom, then check title, message, readability, image, and source credit.",
    "activity_type": "structured-response",
    "assessment_purpose": "formal",
    "estimated_minutes": 35,
    "template_id": "worksheet",
    "teacher_note": "Use for Daily Grade #2 after Canva revision practice. Grade the poster evidence from Classroom; use this app check for confirmation and reflection.",
    "student_instructions": "Send your poster evidence in Classroom, then complete this app check.",
    "student_output": "Classroom submission confirmation, poster checklist, and design reflection.",
    "materials": "Canva poster, image source, and Google Classroom.",
    "fields": [
      {"id":"classroom_note","type":"instructions","prompt":"Your poster file or screenshot must be sent in Classroom.","helperText":"This app check does not collect the poster file."},
      {"id":"submission_status","type":"select","prompt":"What is your poster submission status?","items":[{"id":"submitted","text":"I sent the poster evidence in Classroom."},{"id":"teacher_checked","text":"My teacher checked the poster during class."},{"id":"need_help","text":"I still need help sending the poster."}]},
      {"id":"poster_check","type":"checklist","prompt":"Poster checklist","items":[{"id":"title","text":"The poster has a clear title."},{"id":"message","text":"The poster communicates one main environmental message."},{"id":"readable","text":"The text is readable."},{"id":"credit","text":"The image has credit or source evidence."}]},
      {"id":"choice","type":"long-text","prompt":"What is your strongest design choice?"},
      {"id":"revision","type":"long-text","prompt":"What revision made the poster clearer?"}
    ]
  },
  {
    "id": "grade7_t2_daily_3_branded_slide_set_evidence",
    "title": "G7 T2 Daily Grade 3 - Branded Mini-Presentation Classroom Check",
    "class_slot": "June Week 3, 90-minute class",
    "description": "Students confirm their 3-slide branded mini-presentation was sent through Classroom, then explain design consistency.",
    "activity_type": "structured-response",
    "assessment_purpose": "formal",
    "estimated_minutes": 35,
    "template_id": "worksheet",
    "teacher_note": "Use for Daily Grade #3 before the Scratch transition. Grade the slide evidence from Classroom; use this app check for confirmation and design explanation.",
    "student_instructions": "Send your mini-presentation evidence in Classroom, then complete this app check.",
    "student_output": "Classroom submission confirmation, slide checklist, and design explanation.",
    "materials": "Canva, Google Slides, or exported screenshot/PDF.",
    "fields": [
      {"id":"classroom_note","type":"instructions","prompt":"Your presentation file, screenshot, or PDF must be sent in Classroom.","helperText":"This app check does not collect the presentation file."},
      {"id":"submission_status","type":"select","prompt":"What is your mini-presentation submission status?","items":[{"id":"submitted","text":"I sent the slide evidence in Classroom."},{"id":"teacher_checked","text":"My teacher checked the slides during class."},{"id":"need_help","text":"I still need help sending the slides."}]},
      {"id":"slide_check","type":"checklist","prompt":"Mini-presentation checklist","items":[{"id":"three_slides","text":"My mini-presentation has 3 slides."},{"id":"consistent_logo","text":"Logo placement is consistent."},{"id":"colors","text":"Colors and text style are consistent and readable."},{"id":"image_icon","text":"At least one image or icon supports the message."}]},
      {"id":"support","type":"long-text","prompt":"How does the design support the message?"}
    ]
  },
  {
    "id": "grade7_t2_daily_4_scratch_sequence_evidence",
    "title": "G7 T2 Daily Grade 4 - Scratch Sequence Program Classroom Check",
    "class_slot": "June Week 4, 90-minute class",
    "description": "Students confirm their Scratch sequence evidence was sent through Classroom, then explain block order.",
    "activity_type": "structured-response",
    "assessment_purpose": "formal",
    "estimated_minutes": 30,
    "template_id": "worksheet",
    "teacher_note": "Use for Daily Grade #4 after sequence and variable practice. Grade Scratch evidence from Classroom or teacher observation; use this app check for confirmation and explanation.",
    "student_instructions": "Send your Scratch sequence evidence in Classroom or show it to your teacher, then complete this app check.",
    "student_output": "Classroom/demo confirmation, Scratch sequence checklist, and order explanation.",
    "materials": "Scratch project, screenshot or link, and Classroom assignment.",
    "fields": [
      {"id":"classroom_note","type":"instructions","prompt":"Your Scratch project evidence belongs in Classroom or teacher observation.","helperText":"This app check does not collect the Scratch file, screenshot, or link."},
      {"id":"submission_status","type":"select","prompt":"How was your Scratch sequence evidence checked?","items":[{"id":"classroom","text":"I sent the Scratch evidence in Classroom."},{"id":"observed","text":"My teacher checked the project during class."},{"id":"need_help","text":"I still need help submitting or showing it."}]},
      {"id":"sequence_check","type":"checklist","prompt":"Scratch sequence checklist","items":[{"id":"eight_blocks","text":"The sequence has at least 8 blocks."},{"id":"event","text":"The program has one event block."},{"id":"change","text":"The program includes one sound or costume change."},{"id":"tested","text":"I tested the sequence."}]},
      {"id":"order","type":"long-text","prompt":"Why does block order matter in your program?"}
    ]
  },
  {
    "id": "grade7_t2_daily_5_scratch_debugging_check",
    "title": "G7 T2 Daily Grade 5 - Scratch Debugging Check",
    "class_slot": "July Week 7, 90-minute class",
    "description": "Students identify 3 Scratch errors, fix at least 2, and explain the problem, fix, and result.",
    "activity_type": "structured-response",
    "assessment_purpose": "formal",
    "estimated_minutes": 30,
    "template_id": "worksheet",
    "teacher_note": "Use for Daily Grade #5 with the Scratch starter program.",
    "student_instructions": "Record three bugs from the starter program. Fix at least two and explain the result.",
    "student_output": "Scratch debugging note.",
    "materials": "Scratch starter file and test program.",
    "fields": [
      { "id": "debug_table", "type": "table-grid", "prompt": "Complete the debugging table.", "rows": [{"id":"event_bug","text":"Event does not start the program"},{"id":"order_bug","text":"Blocks run in the wrong order"},{"id":"feedback_bug","text":"Sound, costume, score, or timer feedback is wrong"}], "columns": [{"id":"problem","text":"Problem"},{"id":"fix","text":"Fix tried"},{"id":"result","text":"Result"}] },
      { "id": "best_fix", "type": "long-text", "prompt": "Which fix improved the program most? Explain why." }
    ]
  },
  {
    "id": "grade7_t2_appreciation_1_feedback_collaboration",
    "title": "G7 T2 Appreciation Grade 1 - Feedback and Collaboration Checklist",
    "class_slot": "July Week 6, 90-minute class",
    "description": "Students complete a peer feedback checklist for respectful comments, participation, and response to feedback.",
    "activity_type": "structured-response",
    "assessment_purpose": "formal",
    "estimated_minutes": 10,
    "template_id": "checklist",
    "teacher_note": "Use for Appreciation Grade #1 during loop and variable practice.",
    "student_instructions": "Complete the checklist and write one feedback example.",
    "student_output": "Feedback and collaboration checklist.",
    "materials": "Pair or group Scratch practice work.",
    "fields": [
      { "id": "feedback_check", "type": "checklist", "prompt": "Peer feedback checklist", "items": [{"id":"respectful","text":"I gave respectful comments."},{"id":"specific","text":"I gave specific suggestions."},{"id":"participated","text":"I participated during work time."},{"id":"responded","text":"I used or considered feedback."}] },
      { "id": "example", "type": "long-text", "prompt": "Write one specific feedback example from today." }
    ]
  },
  {
    "id": "grade7_t2_appreciation_2_pair_programming_responsibility",
    "title": "G7 T2 Appreciation Grade 2 - Pair-Programming Responsibility Reflection",
    "class_slot": "July Week 8, 90-minute class",
    "description": "Students reflect on driver/navigator roles, effort, communication, organization, and feedback response.",
    "activity_type": "structured-response",
    "assessment_purpose": "formal",
    "estimated_minutes": 12,
    "template_id": "reflection",
    "teacher_note": "Use for Appreciation Grade #2 during dance game preparation.",
    "student_instructions": "Reflect on your pair-programming role and responsibility.",
    "student_output": "Pair-programming responsibility reflection.",
    "materials": "Scratch practice feature and partner notes.",
    "fields": [
      { "id": "role", "type": "select", "prompt": "Which role did you practice most today?", "items": [{"id":"driver","text":"Driver"},{"id":"navigator","text":"Navigator"},{"id":"both","text":"Both roles"}] },
      { "id": "communication", "type": "long-text", "prompt": "How did you communicate during pair work?" },
      { "id": "responsibility", "type": "long-text", "prompt": "What responsibility did you complete well?" },
      { "id": "improve", "type": "short-text", "prompt": "What pair-programming habit should you improve?" }
    ]
  },
  {
    "id": "grade7_t2_exam_scratch_dance_game",
    "title": "G7 T2 Exam Project - Scratch Dance Game Classroom Check",
    "class_slot": "August Weeks 10-12 exam project",
    "description": "Students confirm Scratch Dance Game evidence was sent through Classroom or checked by teacher observation, then reflect on organization, application, and improvement.",
    "activity_type": "structured-response",
    "assessment_purpose": "formal",
    "estimated_minutes": 90,
    "template_id": "worksheet",
    "teacher_note": "Use as the exam project check for the August Scratch project cycle. Grade the project link, screenshots, testing notes, or demonstration evidence from Classroom and class observation.",
    "student_instructions": "Send your Scratch Dance Game evidence in Classroom or complete the teacher-observed demonstration, then complete this project check.",
    "student_output": "Classroom/demo confirmation, Scratch Dance Game checklist, and reflection.",
    "materials": "Scratch project, test notes, project rubric, presentation notes, and Classroom assignment.",
    "fields": [
      {"id":"classroom_note","type":"instructions","prompt":"Your Scratch Dance Game project evidence belongs in Classroom or teacher observation.","helperText":"This app check collects only confirmation and reflection."},
      {"id":"submission_status","type":"select","prompt":"How was your Scratch Dance Game evidence submitted or checked?","items":[{"id":"classroom","text":"I sent the Scratch project evidence in Classroom."},{"id":"observed","text":"My teacher observed the demonstration."},{"id":"both","text":"I used both Classroom evidence and teacher observation."},{"id":"need_makeup","text":"I need a make-up submission or demonstration."}]},
      {"id":"project_check","type":"checklist","prompt":"Scratch Dance Game checklist","items":[{"id":"inputs","text":"The game uses player input."},{"id":"concepts","text":"The game uses subroutines, conditionals, loops, and variables."},{"id":"feedback","text":"The game gives success or failure feedback."},{"id":"tested","text":"The game was tested and improved."}]},
      {"id":"organization","type":"long-text","prompt":"How is your code organized?"},
      {"id":"application","type":"long-text","prompt":"What real-world application or skill does this project connect to?"},
      {"id":"improvement","type":"long-text","prompt":"What improvement did you make or would make next?"}
    ]
  },
  {
    "id": "grade7_t3_daily_2_formulas_chart_task",
    "title": "G7 T3 Daily Grade 2 - Formulas and Chart Task",
    "class_slot": "September Week 2, 90-minute class",
    "description": "Students create a spreadsheet with at least 8 data rows, 3 formulas, 1 chart, and 2 interpretation sentences.",
    "activity_type": "spreadsheet-table",
    "assessment_purpose": "formal",
    "estimated_minutes": 40,
    "template_id": "chart-from-table",
    "teacher_note": "Use for Daily Grade #2 after formula practice.",
    "student_instructions": "Enter at least 8 rows, use 3 formulas, create a chart, and write two interpretation sentences.",
    "student_output": "Spreadsheet table, chart, and interpretation.",
    "materials": "Google Sheets or Excel and class data set.",
    "columns": [
      {"id":"item","title":"Item","type":"text","width":150},
      {"id":"category","title":"Category","type":"text","width":130},
      {"id":"value","title":"Value","type":"number","width":100},
      {"id":"formula_result","title":"Formula Result","type":"formula","width":150}
    ],
    "min_rows": 8,
    "max_rows": 15,
    "chart": {"enabled": true, "type": "bar", "labelColumnId": "item", "valueColumnId": "value"},
    "reflections": [
      {"id":"interpretation_1","prompt":"Write one interpretation sentence about your chart.", "required": true},
      {"id":"interpretation_2","prompt":"Write a second interpretation sentence about your chart.", "required": true}
    ]
  },
  {
    "id": "grade7_t3_daily_3_scratch_subroutine_loop_demo",
    "title": "G7 T3 Daily Grade 3 - Scratch Subroutine and Loop Classroom Check",
    "class_slot": "October Week 4, 90-minute class",
    "description": "Students confirm Scratch subroutine and loop evidence was sent through Classroom or checked by teacher observation, then explain decomposition.",
    "activity_type": "structured-response",
    "assessment_purpose": "formal",
    "estimated_minutes": 30,
    "template_id": "worksheet",
    "teacher_note": "Use for Daily Grade #3 after decomposition practice. Grade Scratch evidence from Classroom or class observation; use this app check for confirmation and explanation.",
    "student_instructions": "Send your Scratch evidence in Classroom or show it to your teacher, then complete this app check.",
    "student_output": "Classroom/demo confirmation, Scratch subroutine checklist, and decomposition explanation.",
    "materials": "Scratch project, screenshot or link, and Classroom assignment.",
    "fields": [
      {"id":"classroom_note","type":"instructions","prompt":"Your Scratch program evidence belongs in Classroom or teacher observation.","helperText":"This app check does not collect the project file, screenshot, or link."},
      {"id":"submission_status","type":"select","prompt":"How was your Scratch subroutine evidence checked?","items":[{"id":"classroom","text":"I sent the Scratch evidence in Classroom."},{"id":"observed","text":"My teacher checked the project during class."},{"id":"need_help","text":"I still need help submitting or showing it."}]},
      {"id":"subroutine_check","type":"checklist","prompt":"Scratch subroutine and loop checklist","items":[{"id":"subroutine","text":"My program uses at least one subroutine or custom block."},{"id":"loop","text":"My program uses at least one loop."},{"id":"event","text":"My program uses at least one event."},{"id":"tested","text":"I tested the program."}]},
      {"id":"decomposition","type":"long-text","prompt":"How does decomposition improve your program?"}
    ]
  },
  {
    "id": "grade7_t3_daily_4_source_credibility_image_credit",
    "title": "G7 T3 Daily Grade 4 - Source Credibility and Image Credit Check",
    "class_slot": "October Week 5, 90-minute class",
    "description": "Students evaluate 3 online sources, choose 1 credible source, record credit information, and explain usability.",
    "activity_type": "structured-response",
    "assessment_purpose": "formal",
    "estimated_minutes": 30,
    "template_id": "worksheet",
    "teacher_note": "Use for Daily Grade #4 before blog or media-post work.",
    "student_instructions": "Evaluate three sources and explain which one is usable for school work.",
    "student_output": "Source credibility table, credit information, and explanation.",
    "materials": "Teacher-approved sources or source examples.",
    "fields": [
      { "id": "source_table", "type": "table-grid", "prompt": "Evaluate 3 sources.", "rows": [{"id":"official_page","text":"Official organization or school-safe information page"},{"id":"news_blog","text":"News article or blog post"},{"id":"image_media_page","text":"Image, video, or media source page"}], "columns": [{"id":"author_date","text":"Author/date evidence"},{"id":"purpose","text":"Purpose or bias"},{"id":"evidence","text":"Evidence quality"},{"id":"usable","text":"Usable? Why?"}] },
      { "id": "credit", "type": "short-text", "prompt": "Write the image or text credit information for the source you chose." },
      { "id": "usable_reason", "type": "long-text", "prompt": "Write two sentences explaining why the source is usable." }
    ]
  },
  {
    "id": "grade7_t3_daily_5_microbit_sensor_design_plan",
    "title": "G7 T3 Daily Grade 5 - micro:bit Sensor-System Design Plan",
    "class_slot": "November Week 8, 90-minute class",
    "description": "Students design a micro:bit sensor system with purpose, input, process, output, threshold rule, parts list, diagram, and testing questions.",
    "activity_type": "structured-response",
    "assessment_purpose": "formal",
    "estimated_minutes": 35,
    "template_id": "worksheet",
    "teacher_note": "Use for Daily Grade #5 before Mandrake project setup.",
    "student_instructions": "Complete the sensor-system design plan and include testing questions.",
    "student_output": "micro:bit sensor-system design plan.",
    "materials": "micro:bit or simulator, ultrasonic sensor examples, and project notes.",
    "fields": [
      { "id": "purpose", "type": "short-text", "prompt": "What is the purpose of your system?" },
      { "id": "system_table", "type": "table-grid", "prompt": "Plan the system.", "rows": [{"id":"input","text":"Input"},{"id":"process","text":"Process"},{"id":"output","text":"Output"},{"id":"threshold","text":"Threshold rule"},{"id":"parts","text":"Parts list"}], "columns": [{"id":"plan","text":"Your plan"}] },
      { "id": "diagram_note", "type": "long-text", "prompt": "Describe or reference your simple system diagram." },
      { "id": "questions", "type": "long-text", "prompt": "Write 2 testing questions for your system." }
    ]
  },
  {
    "id": "grade7_t3_appreciation_1_data_teamwork",
    "title": "G7 T3 Appreciation Grade 1 - Data Teamwork Checklist",
    "class_slot": "October Week 3, 90-minute class",
    "description": "Students reflect on teamwork during spreadsheet data analysis practice.",
    "activity_type": "structured-response",
    "assessment_purpose": "formal",
    "estimated_minutes": 10,
    "template_id": "checklist",
    "teacher_note": "Use for Appreciation Grade #1 during spreadsheet analysis.",
    "student_instructions": "Complete the data teamwork checklist and give one evidence note.",
    "student_output": "Data teamwork checklist.",
    "materials": "Spreadsheet data task and group work notes.",
    "fields": [
      { "id": "teamwork_check", "type": "checklist", "prompt": "Data teamwork checklist", "items": [{"id":"shared_data","text":"I helped keep the data accurate."},{"id":"listened","text":"I listened to teammates."},{"id":"helped_formula","text":"I helped check a formula, sort, filter, or chart."},{"id":"resolved","text":"I handled disagreement respectfully."}] },
      { "id": "evidence", "type": "long-text", "prompt": "Give one evidence note that shows responsible data teamwork." }
    ]
  },
  {
    "id": "grade7_t3_appreciation_2_project_readiness_responsibility",
    "title": "G7 T3 Appreciation Grade 2 - Project Readiness and Responsibility",
    "class_slot": "November Week 9, 90-minute class",
    "description": "Students reflect on preparation, organization, effort, safe equipment use, feedback, and improvement before the exam project.",
    "activity_type": "structured-response",
    "assessment_purpose": "formal",
    "estimated_minutes": 12,
    "template_id": "reflection",
    "teacher_note": "Use for Appreciation Grade #2 before the Mandrake project build.",
    "student_instructions": "Reflect on your readiness and responsibility for the exam project.",
    "student_output": "Project readiness and responsibility reflection.",
    "materials": "Project rubric, setup notes, and equipment list.",
    "fields": [
      { "id": "prepared", "type": "long-text", "prompt": "How are you prepared for the project?" },
      { "id": "organization", "type": "short-text", "prompt": "What file, equipment, or note do you need to keep organized?" },
      { "id": "feedback", "type": "long-text", "prompt": "How will you receive and use feedback during the project?" },
      { "id": "goal", "type": "short-text", "prompt": "Write one responsibility goal for project week." }
    ]
  },
  {
    "id": "grade7_t3_exam_mandrake_detection_system",
    "title": "G7 T3 Exam Project - Mandrake Detection System Classroom Check",
    "class_slot": "November Weeks 10-12 exam project",
    "description": "Students confirm Mandrake Detection System evidence was sent through Classroom or checked by teacher observation, then reflect on parts, sensor logic, reliability, and improvement.",
    "activity_type": "structured-response",
    "assessment_purpose": "formal",
    "estimated_minutes": 90,
    "template_id": "worksheet",
    "teacher_note": "Use as the exam project check for the November Mandrake project cycle. Grade project evidence from Classroom and final demonstration; use this app activity for confirmation and reflection.",
    "student_instructions": "Send your Mandrake project evidence in Classroom or complete the teacher-observed demonstration, then complete this project check.",
    "student_output": "Classroom/demo confirmation, Mandrake project checklist, and reflection.",
    "materials": "micro:bit or simulation, sensor, support slide, test table, rubric, and Classroom assignment.",
    "fields": [
      {"id":"classroom_note","type":"instructions","prompt":"Your Mandrake Detection System evidence belongs in Classroom or teacher observation.","helperText":"This app check collects only confirmation and reflection."},
      {"id":"submission_status","type":"select","prompt":"How was your Mandrake project evidence submitted or checked?","items":[{"id":"classroom","text":"I sent the project evidence in Classroom."},{"id":"observed","text":"My teacher observed the final demonstration."},{"id":"both","text":"I used both Classroom evidence and teacher observation."},{"id":"need_makeup","text":"I need a make-up submission or demonstration."}]},
      {"id":"project_check","type":"checklist","prompt":"Mandrake Detection System checklist","items":[{"id":"purpose","text":"My Classroom evidence or demo explains the project purpose."},{"id":"threshold","text":"My evidence shows the threshold rule or sensor logic."},{"id":"testing","text":"My evidence includes test results or reliability notes."},{"id":"demo","text":"My teacher can see the final demonstration or clearly labeled simulation."}]},
      {"id":"parts_logic","type":"long-text","prompt":"Explain the input, threshold/process, signal, and output."},
      {"id":"challenge","type":"long-text","prompt":"What challenge did you face and how did you respond?"},
      {"id":"improvement","type":"long-text","prompt":"What realistic improvement would you make next?"}
    ]
  },
  {
    "id": "grade7_formative_2026_03_w1_45_mbot_parts_sort",
    "title": "G7 Formative - March W1 45m - mBot Parts Category Sort",
    "class_slot": "March Week 1, 45-minute class",
    "description": "Students sort mBot parts into structure, movement, sensor, and control categories.",
    "activity_type": "card-sort",
    "assessment_purpose": "formative",
    "estimated_minutes": 12,
    "template_id": "category-sort",
    "teacher_note": "Use after students observe real or pictured mBot parts.",
    "student_instructions": "Sort each mBot part by its main job.",
    "student_output": "Completed mBot parts sort.",
    "materials": "mBot kit or parts image.",
    "categories": [{"id":"structure","title":"Structure"},{"id":"movement","title":"Movement"},{"id":"sensor","title":"Sensor"},{"id":"control","title":"Control"}],
    "cards": [{"id":"chassis","text":"Chassis/frame","expectedCategoryId":"structure"},{"id":"wheels","text":"Wheels","expectedCategoryId":"movement"},{"id":"motors","text":"Motors","expectedCategoryId":"movement"},{"id":"ultrasonic","text":"Ultrasonic sensor","expectedCategoryId":"sensor"},{"id":"line_sensor","text":"Line sensor","expectedCategoryId":"sensor"},{"id":"control_board","text":"Control board/controller","expectedCategoryId":"control"}]
  },
  {
    "id": "grade7_formative_2026_03_w1_90_safety_routine_reflection",
    "title": "G7 Formative - March W1 90m - Robotics Safety Routine",
    "class_slot": "March Week 1, 90-minute class",
    "description": "Students record one safe robotics routine their group followed.",
    "activity_type": "structured-response",
    "assessment_purpose": "formative",
    "estimated_minutes": 8,
    "template_id": "reflection",
    "teacher_note": "Use after assembly and cleanup.",
    "student_instructions": "Write one safe routine your group followed and why it matters.",
    "student_output": "Safety routine reflection.",
    "materials": "Robotics safety rules.",
    "fields": [{"id":"routine","type":"long-text","prompt":"What safe routine did your group follow well?"},{"id":"why","type":"short-text","prompt":"Why does this routine matter?"}]
  },
  {
    "id": "grade7_formative_2026_03_w2_45_parts_function_practice",
    "title": "G7 Formative - March W2 45m - Parts and Function Practice",
    "class_slot": "March Week 2, 45-minute class",
    "description": "Students practice matching mBot parts with function sentences before the graded diagram.",
    "activity_type": "structured-response",
    "assessment_purpose": "formative",
    "estimated_minutes": 15,
    "template_id": "worksheet",
    "teacher_note": "Use as preparation for Daily Grade #2.",
    "student_instructions": "Complete the practice table and correct one missing label after partner feedback.",
    "student_output": "Practice parts and functions table.",
    "materials": "mBot parts diagram and class notes.",
    "fields": [
      { "id": "parts_table", "type": "table-grid", "prompt": "Practice labels and function sentences.", "rows": [{"id":"chassis","text":"Chassis or frame"},{"id":"control_board","text":"Control board/controller"},{"id":"motor","text":"Motor"},{"id":"wheel","text":"Wheel"},{"id":"ultrasonic_sensor","text":"Ultrasonic sensor"}], "columns": [{"id":"label","text":"Part label"},{"id":"function","text":"Function sentence"}] },
      { "id": "correction", "type": "short-text", "prompt": "What label or function did you correct after feedback?" }
    ]
  },
  {
    "id": "grade7_formative_2026_03_w2_90_mblock_tool_exit",
    "title": "G7 Formative - March W2 90m - mBlock Tool Exit Ticket",
    "class_slot": "March Week 2, 90-minute class",
    "description": "Students identify one mBlock tool they expect to use often.",
    "activity_type": "structured-response",
    "assessment_purpose": "formative",
    "estimated_minutes": 6,
    "template_id": "worksheet",
    "teacher_note": "Use after students explore first scripts.",
    "student_instructions": "Name one mBlock tool and explain how you expect to use it.",
    "student_output": "mBlock tool exit ticket.",
    "materials": "Open mBlock workspace.",
    "fields": [{"id":"tool","type":"short-text","prompt":"Which mBlock tool do you expect to use often?"},{"id":"use","type":"long-text","prompt":"How will this tool help you program the robot?"}]
  },
  {
    "id": "grade7_formative_2026_03_w3_45_movement_test_log",
    "title": "G7 Formative - March W3 45m - Movement Test Log",
    "class_slot": "March Week 3, 45-minute class",
    "description": "Students record one command that worked and one command that needed adjustment.",
    "activity_type": "structured-response",
    "assessment_purpose": "formative",
    "estimated_minutes": 10,
    "template_id": "worksheet",
    "teacher_note": "Use after first forward, stop, backward, and stop tests.",
    "student_instructions": "Record what happened during two movement tests.",
    "student_output": "Movement test log.",
    "materials": "mBot, mBlock, and test area.",
    "fields": [
      { "id": "test_log", "type": "table-grid", "prompt": "Record two movement observations.", "rows": [{"id":"worked","text":"Command that worked"},{"id":"adjust","text":"Command that needed adjustment"}], "columns": [{"id":"command","text":"Command"},{"id":"result","text":"What happened?"},{"id":"next","text":"Next change"}] }
    ]
  },
  {
    "id": "grade7_formative_2026_03_w3_90_path_prediction_sequence",
    "title": "G7 Formative - March W3 90m - Movement Path Sequence",
    "class_slot": "March Week 3, 90-minute class",
    "description": "Students sequence movement commands for a small square path.",
    "activity_type": "card-sort",
    "assessment_purpose": "formative",
    "estimated_minutes": 12,
    "template_id": "sequence-sort",
    "teacher_note": "Use before students program a square or triangle path.",
    "student_instructions": "Place the square-path command cards in order.",
    "student_output": "Completed movement sequence sort.",
    "materials": "Movement command notes.",
    "cards": [{"id":"start","text":"Start program","expectedCategoryId":"correct_order","expectedOrder":1},{"id":"forward_1","text":"Move forward","expectedCategoryId":"correct_order","expectedOrder":2},{"id":"turn_1","text":"Turn","expectedCategoryId":"correct_order","expectedOrder":3},{"id":"repeat_sides","text":"Repeat forward and turn for remaining sides","expectedCategoryId":"correct_order","expectedOrder":4},{"id":"stop","text":"Stop at the end","expectedCategoryId":"correct_order","expectedOrder":5}]
  },
  {
    "id": "grade7_formative_2026_03_w4_45_robot_system_map",
    "title": "G7 Formative - March W4 45m - Robot System Map",
    "class_slot": "March Week 4, 45-minute class",
    "description": "Students map how the control board, sensors, motors, and mBlock program work together.",
    "activity_type": "map-diagram",
    "assessment_purpose": "formative",
    "estimated_minutes": 20,
    "template_id": "process-diagram",
    "teacher_note": "Use for the robots-as-systems lesson.",
    "student_instructions": "Create a system map with input, process, output, arrows, and labels.",
    "student_output": "Robot system map.",
    "materials": "mBot and system vocabulary notes."
  },
  {
    "id": "grade7_formative_2026_03_w4_90_route_debug_note",
    "title": "G7 Formative - March W4 90m - Route Debug Note",
    "class_slot": "March Week 4, 90-minute class",
    "description": "Students record the final route sequence and one debugging step.",
    "activity_type": "structured-response",
    "assessment_purpose": "formative",
    "estimated_minutes": 10,
    "template_id": "worksheet",
    "teacher_note": "Use after taped floor route testing.",
    "student_instructions": "Record your final sequence and one debugging step that improved the route.",
    "student_output": "Route sequence and debugging note.",
    "materials": "mBot route test notes.",
    "fields": [{"id":"sequence","type":"long-text","prompt":"Record the final sequence using arrows or block names."},{"id":"debug","type":"long-text","prompt":"What debugging step improved the route?"}]
  },
  {
    "id": "grade7_formative_2026_04_w5_45_speed_time_prediction",
    "title": "G7 Formative - April W5 45m - Speed and Time Prediction",
    "class_slot": "April Week 5, 45-minute class",
    "description": "Students predict how speed and time affect distance and record sample results.",
    "activity_type": "spreadsheet-table",
    "assessment_purpose": "formative",
    "estimated_minutes": 15,
    "template_id": "data-table",
    "teacher_note": "Use as calibration practice before the graded chart.",
    "student_instructions": "Record two or more practice tests and compare predicted and observed distance.",
    "student_output": "Practice speed-time table.",
    "materials": "mBot, floor markers, and timer.",
    "columns": [{"id":"setting","title":"Setting","type":"text","width":120},{"id":"prediction","title":"Predicted Distance","type":"number","width":150},{"id":"observed","title":"Observed Distance","type":"number","width":150},{"id":"best","title":"Best? Why?","type":"text","width":180}],
    "min_rows": 2,
    "max_rows": 6,
    "reflections": [{"id":"compare","prompt":"Which setting worked best for a short controlled movement?", "required": true}]
  },
  {
    "id": "grade7_formative_2026_04_w6_45_grid_route_map",
    "title": "G7 Formative - April W6 45m - Grid Route Map",
    "class_slot": "April Week 6, 45-minute class",
    "description": "Students draw a route map with start, finish, checkpoints, obstacles, and movement arrows.",
    "activity_type": "map-diagram",
    "assessment_purpose": "formative",
    "estimated_minutes": 18,
    "template_id": "blank-map-diagram",
    "teacher_note": "Use during path planning on a grid.",
    "student_instructions": "Draw a route map with start, finish, 2 checkpoints, obstacles, and at least 6 arrows.",
    "student_output": "Grid route map.",
    "materials": "Grid map, route vocabulary, and arrow examples."
  },
  {
    "id": "grade7_formative_2026_04_w6_90_efficiency_reflection",
    "title": "G7 Formative - April W6 90m - Efficient Route Reflection",
    "class_slot": "April Week 6, 90-minute class",
    "description": "Students explain one route change that made navigation more efficient.",
    "activity_type": "structured-response",
    "assessment_purpose": "formative",
    "estimated_minutes": 8,
    "template_id": "reflection",
    "teacher_note": "Use after students remove an unnecessary command.",
    "student_instructions": "Explain one change that made your route more efficient.",
    "student_output": "Efficient route reflection.",
    "materials": "Route program and test notes.",
    "fields": [{"id":"change","type":"long-text","prompt":"What command or route change made the route more efficient?"},{"id":"why","type":"long-text","prompt":"Why did this change help?"}]
  },
  {
    "id": "grade7_formative_2026_04_w7_45_led_state_match",
    "title": "G7 Formative - April W7 45m - LED State Match",
    "class_slot": "April Week 7, 45-minute class",
    "description": "Students match LED colors to robot states and explain one choice.",
    "activity_type": "card-sort",
    "assessment_purpose": "formative",
    "estimated_minutes": 10,
    "template_id": "category-sort",
    "teacher_note": "Use before programming LED states.",
    "student_instructions": "Sort each color or signal into the robot state it should represent.",
    "student_output": "Completed LED state match.",
    "materials": "LED state examples.",
    "categories": [{"id":"ready","title":"Ready"},{"id":"moving","title":"Moving"},{"id":"warning","title":"Warning"},{"id":"stopped","title":"Stopped"}],
    "cards": [{"id":"green","text":"Green light","expectedCategoryId":"ready"},{"id":"blue","text":"Blue light","expectedCategoryId":"moving"},{"id":"red","text":"Red light","expectedCategoryId":"stopped"},{"id":"beep","text":"Short alert sound","expectedCategoryId":"warning"},{"id":"flash","text":"Flashing light","expectedCategoryId":"warning"}]
  },
  {
    "id": "grade7_formative_2026_04_w7_90_feedback_signal_legend",
    "title": "G7 Formative - April W7 90m - Feedback Signal Legend",
    "class_slot": "April Week 7, 90-minute class",
    "description": "Students write a legend for movement, light, and sound feedback states.",
    "activity_type": "structured-response",
    "assessment_purpose": "formative",
    "estimated_minutes": 10,
    "template_id": "worksheet",
    "teacher_note": "Use after movement with LEDs and sound.",
    "student_instructions": "Write a legend explaining what each light or sound means.",
    "student_output": "Robot feedback signal legend.",
    "materials": "mBot LED and buzzer program.",
    "fields": [
      { "id": "legend", "type": "table-grid", "prompt": "Complete the feedback legend.", "rows": [{"id":"ready","text":"Ready signal"},{"id":"moving","text":"Moving signal"},{"id":"stop","text":"Stop signal"},{"id":"alert","text":"Alert signal"}], "columns": [{"id":"signal","text":"Light or sound"},{"id":"meaning","text":"Meaning"}] }
    ]
  },
  {
    "id": "grade7_formative_2026_04_w8_45_sensor_threshold_quiz",
    "title": "G7 Formative - April W8 45m - Sensor Threshold Check",
    "class_slot": "April Week 8, 45-minute class",
    "description": "Students answer a short quiz-style check on sensor values, thresholds, and if/else choices.",
    "activity_type": "structured-response",
    "assessment_purpose": "formative",
    "estimated_minutes": 15,
    "template_id": "worksheet",
    "teacher_note": "Use before the obstacle reaction daily grade.",
    "student_instructions": "Answer the threshold questions and explain one reasonable too-close threshold.",
    "student_output": "Sensor threshold check.",
    "materials": "Ultrasonic sensor values and class notes.",
    "fields": [
      { "id": "near_far", "type": "multiple-choice", "prompt": "If an object moves closer, what usually happens to the distance reading?", "items": [{"id":"smaller","text":"The reading gets smaller."},{"id":"larger","text":"The reading gets larger."},{"id":"same","text":"The reading stays the same."}] },
      { "id": "threshold", "type": "short-text", "prompt": "Choose a threshold that means too close." },
      { "id": "reason", "type": "long-text", "prompt": "Why is your threshold reasonable?" },
      { "id": "if_else", "type": "long-text", "prompt": "Complete this rule: If the object is close, then..., else..." }
    ]
  },
  {
    "id": "grade7_formative_2026_04_w8_90_if_else_flowchart",
    "title": "G7 Formative - April W8 90m - If/Else Obstacle Flowchart",
    "class_slot": "April Week 8, 90-minute class",
    "description": "Students build a flowchart for clear path versus obstacle behavior.",
    "activity_type": "flowchart-algorithm",
    "assessment_purpose": "formative",
    "estimated_minutes": 18,
    "template_id": "sensor-response",
    "teacher_note": "Use before or after obstacle reaction programming.",
    "student_instructions": "Build a sensor-response flowchart for the rule: if the object is close, stop; else, move forward.",
    "student_output": "If/else obstacle flowchart.",
    "materials": "Sensor threshold notes."
  },
  {
    "id": "grade7_formative_2026_05_w9_45_maze_route_sketch",
    "title": "G7 Formative - May W9 45m - Maze Route Sketch",
    "class_slot": "May Week 9, 45-minute class",
    "description": "Students sketch a maze route with turns, obstacles, checkpoints, movement arrows, and possible sensor checks.",
    "activity_type": "map-diagram",
    "assessment_purpose": "formative",
    "estimated_minutes": 20,
    "template_id": "blank-map-diagram",
    "teacher_note": "Use during maze vocabulary and route planning.",
    "student_instructions": "Sketch a maze route with start, finish, at least 2 turns, 2 obstacles, movement arrows, and possible sensor checks.",
    "student_output": "Maze route sketch.",
    "materials": "Sample maze and project notes."
  },
  {
    "id": "grade7_formative_2026_05_w9_90_project_prep_notes",
    "title": "G7 Formative - May W9 90m - Maze Project Prep Notes",
    "class_slot": "May Week 9, 90-minute class",
    "description": "Students list materials, code blocks, and early issues before exam project build week.",
    "activity_type": "structured-response",
    "assessment_purpose": "formative",
    "estimated_minutes": 15,
    "template_id": "worksheet",
    "teacher_note": "Use after students build a practice maze section.",
    "student_instructions": "Record materials, code blocks, one movement issue, one sensor issue, and one improvement idea.",
    "student_output": "Maze project preparation notes.",
    "materials": "Project rubric and practice maze.",
    "fields": [{"id":"materials","type":"long-text","prompt":"What materials and code blocks will you need?"},{"id":"movement_issue","type":"short-text","prompt":"What movement issue appeared?"},{"id":"sensor_issue","type":"short-text","prompt":"What sensor issue appeared?"},{"id":"improvement","type":"long-text","prompt":"What improvement idea will help next class?"}]
  },
  {
    "id": "grade7_formative_2026_05_w10_90_trial_log",
    "title": "G7 Formative - May W10 90m - Maze Trial Log",
    "class_slot": "May Week 10, 90-minute class",
    "description": "Students record trial results and debug decisions during the mBot Maze Navigator project.",
    "activity_type": "structured-response",
    "assessment_purpose": "formative",
    "estimated_minutes": 12,
    "template_id": "worksheet",
    "teacher_note": "Use during the exam project build class as process evidence, not an extra grade.",
    "student_instructions": "Record your best trial, one code change, and one maze change.",
    "student_output": "Maze trial log.",
    "materials": "mBot project and maze.",
    "fields": [{"id":"best_trial","type":"long-text","prompt":"What was the best trial result so far?"},{"id":"code_change","type":"short-text","prompt":"What code change will you try next?"},{"id":"maze_change","type":"short-text","prompt":"What maze or route change will you try next?"}]
  },
  {
    "id": "grade7_formative_2026_05_w11_45_debugging_checklist",
    "title": "G7 Formative - May W11 45m - Maze Debugging Checklist",
    "class_slot": "May Week 11, 45-minute class",
    "description": "Students choose one movement, sensor, or sequence issue to debug and retest.",
    "activity_type": "structured-response",
    "assessment_purpose": "formative",
    "estimated_minutes": 12,
    "template_id": "checklist",
    "teacher_note": "Use during project debugging.",
    "student_instructions": "Choose one issue, record the fix, and state whether it improved the result.",
    "student_output": "Maze debugging checklist.",
    "materials": "Project notes and rubric.",
    "fields": [
      { "id": "issue_type", "type": "select", "prompt": "Which issue are you debugging?", "items": [{"id":"movement","text":"Movement issue"},{"id":"sensor","text":"Sensor issue"},{"id":"sequence","text":"Sequence issue"}] },
      { "id": "fix", "type": "long-text", "prompt": "What fix did you try?" },
      { "id": "result", "type": "long-text", "prompt": "Did the fix improve the result? Explain." }
    ]
  },
  {
    "id": "grade7_formative_2026_05_w12_45_presentation_rehearsal",
    "title": "G7 Formative - May W12 45m - Maze Presentation Rehearsal Notes",
    "class_slot": "May Week 12, 45-minute class",
    "description": "Students prepare confidence notes and final reminders before the maze demonstration.",
    "activity_type": "structured-response",
    "assessment_purpose": "formative",
    "estimated_minutes": 8,
    "template_id": "reflection",
    "teacher_note": "Use before final maze demonstration.",
    "student_instructions": "Write a confidence note and a final reminder for your demonstration.",
    "student_output": "Presentation rehearsal notes.",
    "materials": "Project rubric and presentation notes.",
    "fields": [{"id":"confidence","type":"short-text","prompt":"What part of the demonstration are you most confident about?"},{"id":"reminder","type":"short-text","prompt":"What final reminder do you need before presenting?"}]
  },
  {
    "id": "grade7_formative_2026_06_w1_45_poster_analysis",
    "title": "G7 Formative - June W1 45m - Environmental Poster Analysis",
    "class_slot": "June Week 1, 45-minute class",
    "description": "Students analyze an environmental poster for strengths, weaknesses, audience, purpose, image, title, and improvement.",
    "activity_type": "structured-response",
    "assessment_purpose": "formative",
    "estimated_minutes": 18,
    "template_id": "worksheet",
    "teacher_note": "Use during clear digital messages.",
    "student_instructions": "Analyze one poster using the checklist prompts.",
    "student_output": "Poster analysis checklist.",
    "materials": "Environmental poster example.",
    "fields": [{"id":"strengths","type":"long-text","prompt":"List 2 strengths."},{"id":"weaknesses","type":"long-text","prompt":"List 2 weaknesses."},{"id":"audience_purpose","type":"long-text","prompt":"Who is the audience and what is the purpose?"},{"id":"improvement","type":"long-text","prompt":"What is one improvement suggestion?"}]
  },
  {
    "id": "grade7_formative_2026_06_w1_90_image_credit_plan",
    "title": "G7 Formative - June W1 90m - Image Credit Planning",
    "class_slot": "June Week 1, 90-minute class",
    "description": "Students write search terms and record copyright-free or Creative Commons image evidence.",
    "activity_type": "structured-response",
    "assessment_purpose": "formative",
    "estimated_minutes": 15,
    "template_id": "worksheet",
    "teacher_note": "Use before Canva poster draft work.",
    "student_instructions": "Record search terms, image source evidence, and why the image is acceptable.",
    "student_output": "Image search and credit plan.",
    "materials": "Teacher-approved image search tools.",
    "fields": [{"id":"search_terms","type":"long-text","prompt":"Write 5 search terms for your environmental topic."},{"id":"source","type":"short-text","prompt":"Record the image source or credit information."},{"id":"acceptable","type":"long-text","prompt":"Why is this image acceptable for school use?"}]
  },
  {
    "id": "grade7_formative_2026_06_w2_45_poster_revision_checklist",
    "title": "G7 Formative - June W2 45m - Poster Revision Checklist",
    "class_slot": "June Week 2, 45-minute class",
    "description": "Students check title, message, image, readability, colors, and credit before graded poster submission.",
    "activity_type": "structured-response",
    "assessment_purpose": "formative",
    "estimated_minutes": 10,
    "template_id": "checklist",
    "teacher_note": "Use before Daily Grade #2 poster submission.",
    "student_instructions": "Use the checklist and name one revision to finish.",
    "student_output": "Poster revision checklist.",
    "materials": "Canva poster draft.",
    "fields": [
      { "id": "revision_check", "type": "checklist", "prompt": "Poster revision checklist", "items": [{"id":"title","text":"Title is clear."},{"id":"message","text":"Main message is clear."},{"id":"image","text":"Image supports the topic."},{"id":"readability","text":"Text is readable."},{"id":"credit","text":"Credit/source evidence is included."}] },
      { "id": "revision", "type": "short-text", "prompt": "What revision will you finish in the long class?" }
    ]
  },
  {
    "id": "grade7_formative_2026_06_w3_45_slide_design_rule",
    "title": "G7 Formative - June W3 45m - Slide Design Rule",
    "class_slot": "June Week 3, 45-minute class",
    "description": "Students record one design rule followed across branded slides.",
    "activity_type": "structured-response",
    "assessment_purpose": "formative",
    "estimated_minutes": 8,
    "template_id": "worksheet",
    "teacher_note": "Use during brand consistency in slides.",
    "student_instructions": "Name one design rule you followed on all slides and one slide to improve.",
    "student_output": "Slide design rule note.",
    "materials": "Slide draft.",
    "fields": [{"id":"rule","type":"short-text","prompt":"What design rule did you follow on all slides?"},{"id":"improve","type":"short-text","prompt":"Which slide should you improve in the long class?"}]
  },
  {
    "id": "grade7_formative_2026_06_w4_45_sequence_order_sort",
    "title": "G7 Formative - June W4 45m - Scratch Sequence Order",
    "class_slot": "June Week 4, 45-minute class",
    "description": "Students arrange Scratch command cards in the correct order for a short song or animation.",
    "activity_type": "card-sort",
    "assessment_purpose": "formative",
    "estimated_minutes": 12,
    "template_id": "sequence-sort",
    "teacher_note": "Use before students build the practice sequence.",
    "student_instructions": "Arrange the Scratch sequence cards in order.",
    "student_output": "Completed Scratch sequence sort.",
    "materials": "Scratch command cards.",
    "cards": [{"id":"event","text":"Add an event block","expectedCategoryId":"correct_order","expectedOrder":1},{"id":"choose_sprite","text":"Choose sprite/costume or sound","expectedCategoryId":"correct_order","expectedOrder":2},{"id":"add_blocks","text":"Add motion, looks, or sound blocks","expectedCategoryId":"correct_order","expectedOrder":3},{"id":"test","text":"Test the sequence","expectedCategoryId":"correct_order","expectedOrder":4},{"id":"fix_order","text":"Fix the block order if needed","expectedCategoryId":"correct_order","expectedOrder":5}]
  },
  {
    "id": "grade7_formative_2026_07_w5_45_true_false_condition_sort",
    "title": "G7 Formative - July W5 45m - True or False Conditions",
    "class_slot": "July Week 5, 45-minute class",
    "description": "Students sort comparison statements into true, false, or depends on the value.",
    "activity_type": "card-sort",
    "assessment_purpose": "formative",
    "estimated_minutes": 12,
    "template_id": "category-sort",
    "teacher_note": "Use before Scratch if/else response programming.",
    "student_instructions": "Sort each condition by whether it is true, false, or depends on the current value.",
    "student_output": "Completed condition sort.",
    "materials": "Scratch condition examples.",
    "categories": [{"id":"true","title":"True"},{"id":"false","title":"False"},{"id":"depends","title":"Depends on Value"}],
    "cards": [{"id":"score_gt_5","text":"score > 5","expectedCategoryId":"depends"},{"id":"timer_zero","text":"timer = 0","expectedCategoryId":"depends"},{"id":"one_less_two","text":"1 < 2","expectedCategoryId":"true"},{"id":"seven_equal_three","text":"7 = 3","expectedCategoryId":"false"},{"id":"answer_yes","text":"answer = yes","expectedCategoryId":"depends"}]
  },
  {
    "id": "grade7_formative_2026_07_w5_90_logic_quiz",
    "title": "G7 Formative - July W5 90m - Comparison Logic Check",
    "class_slot": "July Week 5, 90-minute class",
    "description": "Students complete a short quiz-style check on comparison and logic operators.",
    "activity_type": "structured-response",
    "assessment_purpose": "formative",
    "estimated_minutes": 15,
    "template_id": "worksheet",
    "teacher_note": "Use before Scratch quiz building.",
    "student_instructions": "Answer the comparison questions and explain one testing rule.",
    "student_output": "Comparison logic check.",
    "materials": "Scratch operators notes.",
    "fields": [{"id":"greater","type":"multiple-choice","prompt":"Which condition checks whether score is more than 5?", "items":[{"id":"gt","text":"score > 5"},{"id":"lt","text":"score < 5"},{"id":"eq","text":"score = 5"}]},{"id":"true_false","type":"short-text","prompt":"Write one condition that could be true or false depending on the value."},{"id":"testing_rule","type":"long-text","prompt":"Write one rule for testing conditions carefully."}]
  },
  {
    "id": "grade7_formative_2026_07_w6_45_loop_replacement_plan",
    "title": "G7 Formative - July W6 45m - Loop Replacement Plan",
    "class_slot": "July Week 6, 45-minute class",
    "description": "Students identify repeated blocks and explain how a loop can replace them.",
    "activity_type": "structured-response",
    "assessment_purpose": "formative",
    "estimated_minutes": 12,
    "template_id": "worksheet",
    "teacher_note": "Use before replacing repeated Scratch blocks.",
    "student_instructions": "Find a repeated block pattern and explain the loop replacement.",
    "student_output": "Loop replacement plan.",
    "materials": "Scratch sample script.",
    "fields": [{"id":"repeat_pattern","type":"long-text","prompt":"What blocks repeat in the sample script?"},{"id":"loop_plan","type":"long-text","prompt":"How can a repeat loop replace them?"},{"id":"benefit","type":"short-text","prompt":"Why do loops make programs easier to improve?"}]
  },
  {
    "id": "grade7_formative_2026_07_w7_45_debug_strategy",
    "title": "G7 Formative - July W7 45m - Scratch Debugging Strategy",
    "class_slot": "July Week 7, 45-minute class",
    "description": "Students plan fixes for likely Scratch starter-program errors before the graded debugging check.",
    "activity_type": "structured-response",
    "assessment_purpose": "formative",
    "estimated_minutes": 12,
    "template_id": "worksheet",
    "teacher_note": "Use before Daily Grade #5.",
    "student_instructions": "Identify likely errors and plan how to test fixes.",
    "student_output": "Debugging strategy note.",
    "materials": "Scratch starter program.",
    "fields": [{"id":"likely_error","type":"long-text","prompt":"What error type do you expect to watch for?"},{"id":"test_fix","type":"long-text","prompt":"How will you test whether a fix works?"},{"id":"tip","type":"short-text","prompt":"Write one debugging tip."}]
  },
  {
    "id": "grade7_formative_2026_07_w8_90_dance_feature_plan",
    "title": "G7 Formative - July W8 90m - Dance Feature Plan",
    "class_slot": "July Week 8, 90-minute class",
    "description": "Students plan a practice dance move with key press, costume change, sound, movement, and feedback.",
    "activity_type": "structured-response",
    "assessment_purpose": "formative",
    "estimated_minutes": 15,
    "template_id": "worksheet",
    "teacher_note": "Use during dance game preparation.",
    "student_instructions": "Plan one practice dance move and the feedback it should give.",
    "student_output": "Dance feature plan.",
    "materials": "Scratch and dance prep vocabulary.",
    "fields": [{"id":"key","type":"short-text","prompt":"Which key or input starts the move?"},{"id":"change","type":"short-text","prompt":"What costume, sound, or movement happens?"},{"id":"feedback","type":"long-text","prompt":"What success or failure feedback should the player receive?"}]
  },
  {
    "id": "grade7_formative_2026_08_w9_45_dance_project_plan",
    "title": "G7 Formative - August W9 45m - Scratch Dance Project Plan",
    "class_slot": "August Week 9, 45-minute class",
    "description": "Students plan the Scratch Dance Game goal, keys, dance moves, variables, subroutines, feedback, and pair responsibilities.",
    "activity_type": "structured-response",
    "assessment_purpose": "formative",
    "estimated_minutes": 20,
    "template_id": "worksheet",
    "teacher_note": "Use before exam project build week.",
    "student_instructions": "Complete the project plan and identify the first dance move to build.",
    "student_output": "Scratch Dance Game project plan.",
    "materials": "Project rubric and Scratch notes.",
    "fields": [{"id":"goal","type":"short-text","prompt":"What is the game goal?"},{"id":"features","type":"long-text","prompt":"List keys, dance moves, variables, subroutines, and feedback."},{"id":"roles","type":"long-text","prompt":"What are the pair-programming responsibilities?"},{"id":"first_move","type":"short-text","prompt":"What is the first dance move to build?"}]
  },
  {
    "id": "grade7_formative_2026_08_w9_90_prototype_test_notes",
    "title": "G7 Formative - August W9 90m - Dance Prototype Test Notes",
    "class_slot": "August Week 9, 90-minute class",
    "description": "Students test one starter feature and record what works, what fails, and what still needs building.",
    "activity_type": "structured-response",
    "assessment_purpose": "formative",
    "estimated_minutes": 12,
    "template_id": "worksheet",
    "teacher_note": "Use during prototype and testing checklist class.",
    "student_instructions": "Record one starter feature test and a debugging risk.",
    "student_output": "Prototype test notes.",
    "materials": "Scratch prototype.",
    "fields": [{"id":"works","type":"long-text","prompt":"What works in the starter feature?"},{"id":"fails","type":"long-text","prompt":"What failed or needs fixing?"},{"id":"build_next","type":"short-text","prompt":"What still needs to be built?"},{"id":"risk","type":"short-text","prompt":"What debugging risk should you watch?"}]
  },
  {
    "id": "grade7_formative_2026_08_w11_45_score_timer_explanation",
    "title": "G7 Formative - August W11 45m - Score and Timer Explanation",
    "class_slot": "August Week 11, 45-minute class",
    "description": "Students explain how a variable controls score, timer, or feedback in the dance game.",
    "activity_type": "structured-response",
    "assessment_purpose": "formative",
    "estimated_minutes": 8,
    "template_id": "worksheet",
    "teacher_note": "Use after score, timer, and feedback improvement.",
    "student_instructions": "Explain how one variable controls the game.",
    "student_output": "Score or timer explanation.",
    "materials": "Scratch Dance Game project.",
    "fields": [{"id":"variable","type":"short-text","prompt":"Which variable are you explaining?"},{"id":"control","type":"long-text","prompt":"How does this variable control the game?"}]
  },
  {
    "id": "grade7_formative_2026_09_w1_45_spreadsheet_label_check",
    "title": "G7 Formative - September W1 45m - Spreadsheet Label Check",
    "class_slot": "September Week 1, 45-minute class",
    "description": "Students identify rows, columns, cells, sheet tabs, and the formula bar.",
    "activity_type": "structured-response",
    "assessment_purpose": "formative",
    "estimated_minutes": 12,
    "template_id": "worksheet",
    "teacher_note": "Use during spreadsheet introduction.",
    "student_instructions": "Label spreadsheet parts and write one cell reference.",
    "student_output": "Spreadsheet label check.",
    "materials": "Spreadsheet screenshot or open spreadsheet.",
    "fields": [{"id":"labels","type":"table-grid","prompt":"Label spreadsheet parts.", "rows":[{"id":"row","text":"Row"},{"id":"column","text":"Column"},{"id":"cell","text":"Cell"},{"id":"sheet_tab","text":"Sheet tab"},{"id":"formula_bar","text":"Formula bar"}], "columns":[{"id":"label","text":"Where is it?"},{"id":"purpose","text":"What is it for?"}]},{"id":"cell_ref","type":"short-text","prompt":"Write one example cell reference."}]
  },
  {
    "id": "grade7_formative_2026_09_w2_45_formula_practice",
    "title": "G7 Formative - September W2 45m - Formula Practice",
    "class_slot": "September Week 2, 45-minute class",
    "description": "Students practice total, average, minimum, and maximum formulas with cell references.",
    "activity_type": "spreadsheet-table",
    "assessment_purpose": "formative",
    "estimated_minutes": 20,
    "template_id": "formula-practice",
    "teacher_note": "Use before the formal formulas and chart task.",
    "student_instructions": "Use formulas to calculate totals or averages and check one formula.",
    "student_output": "Formula practice table.",
    "materials": "Small data set and calculator or mental math check.",
    "columns": [{"id":"item","title":"Item","type":"text","width":140},{"id":"value_a","title":"Value A","type":"number","width":110},{"id":"value_b","title":"Value B","type":"number","width":110},{"id":"result","title":"Formula Result","type":"formula","width":150}],
    "min_rows": 4,
    "max_rows": 10,
    "reflections": [{"id":"formula_check","prompt":"Which formula did you check, and was it correct?", "required": true}]
  },
  {
    "id": "grade7_formative_2026_10_w3_45_sort_filter_pattern",
    "title": "G7 Formative - October W3 45m - Sort and Filter Pattern",
    "class_slot": "October Week 3, 45-minute class",
    "description": "Students sort and filter data, highlight two patterns, and write one conclusion.",
    "activity_type": "spreadsheet-table",
    "assessment_purpose": "formative",
    "estimated_minutes": 20,
    "template_id": "data-table",
    "teacher_note": "Use during sorting and filtering data.",
    "student_instructions": "Record the filtered data pattern and one conclusion.",
    "student_output": "Sort/filter pattern evidence.",
    "materials": "Prepared spreadsheet data set.",
    "columns": [{"id":"filter_rule","title":"Filter Rule","type":"text","width":160},{"id":"pattern_1","title":"Pattern 1","type":"text","width":160},{"id":"pattern_2","title":"Pattern 2","type":"text","width":160},{"id":"count","title":"Count","type":"number","width":100}],
    "min_rows": 2,
    "max_rows": 8,
    "reflections": [{"id":"conclusion","prompt":"What conclusion can you make from the filtered data?", "required": true}]
  },
  {
    "id": "grade7_formative_2026_10_w4_45_decomposition_plan",
    "title": "G7 Formative - October W4 45m - Decomposition Plan",
    "class_slot": "October Week 4, 45-minute class",
    "description": "Students break a Scratch action into labeled subroutines before the demonstration task.",
    "activity_type": "structured-response",
    "assessment_purpose": "formative",
    "estimated_minutes": 15,
    "template_id": "worksheet",
    "teacher_note": "Use before Daily Grade #3.",
    "student_instructions": "Plan at least 3 labeled subroutines and revise one step after feedback.",
    "student_output": "Scratch decomposition plan.",
    "materials": "Scratch project idea.",
    "fields": [{"id":"task","type":"short-text","prompt":"What larger Scratch action are you breaking down?"},{"id":"subroutines","type":"long-text","prompt":"List at least 3 labeled subroutines."},{"id":"revision","type":"short-text","prompt":"What step did you revise after feedback?"}]
  },
  {
    "id": "grade7_formative_2026_10_w5_45_scratch_list_idea",
    "title": "G7 Formative - October W5 45m - Scratch List Idea",
    "class_slot": "October Week 5, 45-minute class",
    "description": "Students create a small Scratch list idea and explain one app or game use.",
    "activity_type": "structured-response",
    "assessment_purpose": "formative",
    "estimated_minutes": 12,
    "template_id": "worksheet",
    "teacher_note": "Use during lists and organized data in Scratch.",
    "student_instructions": "Plan a Scratch list with at least 5 related items and one use case.",
    "student_output": "Scratch list idea.",
    "materials": "Scratch list examples.",
    "fields": [{"id":"items","type":"long-text","prompt":"List at least 5 related items."},{"id":"use","type":"long-text","prompt":"What game or app idea could use this list?"}]
  },
  {
    "id": "grade7_formative_2026_10_w6_45_blog_plan",
    "title": "G7 Formative - October W6 45m - Blog Media Plan",
    "class_slot": "October Week 6, 45-minute class",
    "description": "Students plan a cause-based blog section with title, audience, main idea, image idea, and source credit.",
    "activity_type": "structured-response",
    "assessment_purpose": "formative",
    "estimated_minutes": 15,
    "template_id": "worksheet",
    "teacher_note": "Use before building a short media post.",
    "student_instructions": "Plan the blog section and source credit.",
    "student_output": "Blog media plan.",
    "materials": "Google Sites topic notes and source examples.",
    "fields": [{"id":"title","type":"short-text","prompt":"What is the title or heading?"},{"id":"audience","type":"short-text","prompt":"Who is the audience?"},{"id":"main_idea","type":"long-text","prompt":"What is the main idea?"},{"id":"image_credit","type":"long-text","prompt":"What image idea and source credit will you use?"},{"id":"cta","type":"short-text","prompt":"What call to action will you include?"}]
  },
  {
    "id": "grade7_formative_2026_10_w7_45_sensor_system_diagram",
    "title": "G7 Formative - October W7 45m - micro:bit Sensor System Diagram",
    "class_slot": "October Week 7, 45-minute class",
    "description": "Students draw a sensor system with input, process, output, and signal labels.",
    "activity_type": "map-diagram",
    "assessment_purpose": "formative",
    "estimated_minutes": 18,
    "template_id": "process-diagram",
    "teacher_note": "Use during micro:bit sensor systems.",
    "student_instructions": "Draw a simple micro:bit sensor system. Label input, process, output, and signal.",
    "student_output": "Sensor system diagram.",
    "materials": "micro:bit or simulator notes."
  },
  {
    "id": "grade7_formative_2026_10_w7_90_mandrake_concept_map",
    "title": "G7 Formative - October W7 90m - Mandrake Concept Map",
    "class_slot": "October Week 7, 90-minute class",
    "description": "Students map parts, sensor reading, trigger condition, output sound, and reliability concern.",
    "activity_type": "map-diagram",
    "assessment_purpose": "formative",
    "estimated_minutes": 20,
    "template_id": "process-diagram",
    "teacher_note": "Use as the Mandrake Detection System preview.",
    "student_instructions": "Build a concept map showing parts, sensor reading, trigger condition, output sound, and one safety or reliability concern.",
    "student_output": "Mandrake project concept map.",
    "materials": "micro:bit, sensor examples, and project preview notes."
  },
  {
    "id": "grade7_formative_2026_11_w8_45_sensor_system_planning",
    "title": "G7 Formative - November W8 45m - Sensor-System Planning Practice",
    "class_slot": "November Week 8, 45-minute class",
    "description": "Students practice planning a micro:bit sensor system before the graded design plan.",
    "activity_type": "structured-response",
    "assessment_purpose": "formative",
    "estimated_minutes": 15,
    "template_id": "worksheet",
    "teacher_note": "Use before Daily Grade #5.",
    "student_instructions": "Practice the design-plan sections and name one question to resolve.",
    "student_output": "Sensor-system planning practice.",
    "materials": "Project notes and micro:bit examples.",
    "fields": [{"id":"purpose","type":"short-text","prompt":"What is the system purpose?"},{"id":"ipo","type":"long-text","prompt":"Describe input, process, and output."},{"id":"threshold","type":"short-text","prompt":"What threshold rule might you use?"},{"id":"question","type":"short-text","prompt":"What question do you need to resolve?"}]
  },
  {
    "id": "grade7_formative_2026_11_w8_90_threshold_test_table",
    "title": "G7 Formative - November W8 90m - Threshold Test Table",
    "class_slot": "November Week 8, 90-minute class",
    "description": "Students record distance readings, expected output, actual output, and reliability notes.",
    "activity_type": "spreadsheet-table",
    "assessment_purpose": "formative",
    "estimated_minutes": 20,
    "template_id": "data-table",
    "teacher_note": "Use after the sensor-system design plan.",
    "student_instructions": "Record distance tests and choose one reasonable threshold.",
    "student_output": "Threshold test table.",
    "materials": "micro:bit or simulator and sensor data.",
    "columns": [{"id":"distance","title":"Distance","type":"number","width":100},{"id":"expected","title":"Expected Output","type":"text","width":150},{"id":"actual","title":"Actual Output","type":"text","width":150},{"id":"reliability","title":"Reliability Note","type":"text","width":180}],
    "min_rows": 4,
    "max_rows": 10,
    "reflections": [{"id":"threshold","prompt":"Which threshold seems reasonable and why?", "required": true}]
  },
  {
    "id": "grade7_formative_2026_11_w9_90_review_quiz",
    "title": "G7 Formative - November W9 90m - Project Review Quiz",
    "class_slot": "November Week 9, 90-minute class",
    "description": "Students review spreadsheet, Scratch, source credibility, and micro:bit vocabulary before project setup.",
    "activity_type": "structured-response",
    "assessment_purpose": "formative",
    "estimated_minutes": 15,
    "template_id": "worksheet",
    "teacher_note": "Use as the quiz-style review listed in the monthly plan.",
    "student_instructions": "Answer the review prompts and identify the first build task.",
    "student_output": "Project review quiz and setup note.",
    "materials": "September-November notes.",
    "fields": [{"id":"spreadsheet","type":"short-text","prompt":"What does a spreadsheet help you organize?"},{"id":"scratch","type":"short-text","prompt":"What is one Scratch concept used this trimester?"},{"id":"source","type":"short-text","prompt":"Name one sign of a credible source."},{"id":"microbit","type":"short-text","prompt":"What does a micro:bit sensor detect or use?"},{"id":"first_task","type":"short-text","prompt":"What is the first build task for week 10?"}]
  },
  {
    "id": "grade7_formative_2026_11_w11_45_reliability_debug_log",
    "title": "G7 Formative - November W11 45m - Reliability Debug Log",
    "class_slot": "November Week 11, 45-minute class",
    "description": "Students record one reliability problem, adjustment, retest result, and remaining issue.",
    "activity_type": "structured-response",
    "assessment_purpose": "formative",
    "estimated_minutes": 12,
    "template_id": "worksheet",
    "teacher_note": "Use during Mandrake project debugging.",
    "student_instructions": "Record what changed, what improved, and what still needs work.",
    "student_output": "Reliability debug log.",
    "materials": "Mandrake project test notes.",
    "fields": [{"id":"problem","type":"long-text","prompt":"What reliability problem did you find?"},{"id":"adjustment","type":"long-text","prompt":"What adjustment did you make?"},{"id":"retest","type":"long-text","prompt":"What happened when you retested?"},{"id":"still","type":"short-text","prompt":"What still needs work?"}]
  },
  {
    "id": "grade7_formative_2026_11_w12_90_final_reflection",
    "title": "G7 Formative - November W12 90m - Final Trimester Project Reflection",
    "class_slot": "November Week 12, 90-minute class",
    "description": "Students reflect on data, programming, media, and physical computing skills after the final presentation.",
    "activity_type": "structured-response",
    "assessment_purpose": "formative",
    "estimated_minutes": 10,
    "template_id": "reflection",
    "teacher_note": "Use after final Mandrake Detection System presentations.",
    "student_instructions": "Reflect on the final project and one skill to keep practicing.",
    "student_output": "Final trimester reflection.",
    "materials": "Project rubric and final evidence.",
    "fields": [{"id":"demonstrated","type":"long-text","prompt":"What did your group demonstrate?"},{"id":"skills","type":"long-text","prompt":"How did you use data, programming, media, or physical computing skills?"},{"id":"practice","type":"short-text","prompt":"What skill should you keep practicing next year?"}]
  }
]
$grade7_app_activities$::jsonb) as activity (
        id text,
        title text,
        class_slot text,
        description text,
        activity_type text,
        assessment_purpose text,
        estimated_minutes integer,
        template_id text,
        evidence_mode text,
        teacher_note text,
        student_instructions text,
        student_output text,
        materials text,
        fields jsonb,
        categories jsonb,
        cards jsonb,
        columns jsonb,
        seed_data jsonb,
        min_rows integer,
        max_rows integer,
        chart jsonb,
        checklist jsonb,
        reflections jsonb
    )
),
grade7_prepared_activities as (
    select
        id,
        title,
        description || ' Slot: ' || class_slot || '.' as description,
        activity_type,
        assessment_purpose,
        estimated_minutes,
        'Use in ' || class_slot || '. ' || teacher_note as teacher_instructions,
        student_instructions,
        student_output,
        materials,
        case
            when activity_type = 'structured-response' then
                jsonb_build_object(
                    'templateId', coalesce(template_id, 'worksheet'),
                    'responseTemplate', jsonb_build_object(
                        'version', 1,
                        'templateId', coalesce(template_id, 'worksheet'),
                        'blocks', coalesce(
                            (
                                select jsonb_agg(
                                    jsonb_strip_nulls(jsonb_build_object(
                                        'id', coalesce(field->>'id', 'field_' || ordinality),
                                        'type', coalesce(field->>'type', 'short-text'),
                                        'prompt', coalesce(field->>'prompt', 'Respond to this prompt.'),
                                        'helperText', field->>'helperText',
                                        'required', coalesce((field->>'required')::boolean, true),
                                        'items', field->'items',
                                        'rows', field->'rows',
                                        'columns', field->'columns'
                                    ))
                                    order by ordinality
                                )
                                from jsonb_array_elements(coalesce(fields, '[]'::jsonb)) with ordinality as field_data(field, ordinality)
                            ),
                            jsonb_build_array(
                                jsonb_build_object('id', 'response', 'type', 'long-text', 'prompt', student_instructions, 'required', true)
                            )
                        )
                    )
                )
            when activity_type = 'card-sort' then
                jsonb_build_object(
                    'templateId', coalesce(template_id, 'category-sort'),
                    'cardSortTemplate', jsonb_build_object(
                        'version', 1,
                        'templateId', coalesce(template_id, 'category-sort'),
                        'prompt', student_instructions,
                        'helperText', 'Use class notes and the category names to decide where each card belongs.',
                        'requireAllCards', true,
                        'orderMode', case when coalesce(template_id, 'category-sort') in ('sequence-sort', 'process-sort') then 'within-categories' else 'none' end,
                        'categories', coalesce(categories, jsonb_build_array(jsonb_build_object('id', 'correct_order', 'title', 'Correct Order', 'helperText', 'First step at the top.'))),
                        'cards', coalesce(cards, '[]'::jsonb)
                    )
                )
            when activity_type = 'map-diagram' then
                jsonb_build_object(
                    'templateId', coalesce(template_id, 'blank-map-diagram'),
                    'excalidrawScene', null
                )
            when activity_type = 'spreadsheet-table' then
                jsonb_build_object(
                    'templateId', coalesce(template_id, 'data-table'),
                    'spreadsheetTemplate', jsonb_build_object(
                        'version', 1,
                        'templateId', coalesce(template_id, 'data-table'),
                        'columns', coalesce(columns, jsonb_build_array(
                            jsonb_build_object('id', 'item', 'title', 'Item', 'type', 'text', 'width', 150),
                            jsonb_build_object('id', 'value', 'title', 'Value', 'type', 'number', 'width', 120),
                            jsonb_build_object('id', 'notes', 'title', 'Notes', 'type', 'text', 'width', 200)
                        )),
                        'seedData', coalesce(seed_data, jsonb_build_array(
                            jsonb_build_array('', '', '', '', ''),
                            jsonb_build_array('', '', '', '', ''),
                            jsonb_build_array('', '', '', '', ''),
                            jsonb_build_array('', '', '', '', ''),
                            jsonb_build_array('', '', '', '', ''),
                            jsonb_build_array('', '', '', '', '')
                        )),
                        'minRows', coalesce(min_rows, 4),
                        'maxRows', coalesce(max_rows, 12),
                        'allowAddRows', true,
                        'chart', coalesce(chart, jsonb_build_object('enabled', false, 'type', 'bar', 'labelColumnId', 'item', 'valueColumnId', 'value')),
                        'reflectionPrompts', coalesce(reflections, jsonb_build_array(
                            jsonb_build_object('id', 'pattern', 'prompt', 'What pattern or result does your data show?', 'required', true)
                        ))
                    )
                )
            when activity_type = 'flowchart-algorithm' then
                jsonb_build_object('templateId', coalesce(template_id, 'sequence-algorithm'))
            when activity_type = 'external-artifact' then
                jsonb_build_object(
                    'templateId', coalesce(template_id, 'project-evidence'),
                    'externalArtifactTemplate', jsonb_build_object(
                        'version', 1,
                        'templateId', coalesce(template_id, 'project-evidence'),
                        'prompt', student_instructions,
                        'helperText', 'Submit evidence from the external tool, then complete the checklist and reflection prompts.',
                        'evidenceMode', coalesce(evidence_mode, 'either'),
                        'linkLabel', 'Project link',
                        'uploadLabel', 'Screenshot or PDF',
                        'allowedMimeTypes', jsonb_build_array('image/png', 'image/jpeg', 'image/webp', 'application/pdf'),
                        'checklistItems', coalesce(checklist, jsonb_build_array(
                            jsonb_build_object('id', 'matches_task', 'text', 'My evidence matches the assigned task.', 'required', true),
                            jsonb_build_object('id', 'readable', 'text', 'My evidence is readable or opens correctly.', 'required', true)
                        )),
                        'reflectionPrompts', coalesce(reflections, jsonb_build_array(
                            jsonb_build_object('id', 'created', 'prompt', 'What did you create or test?', 'required', true),
                            jsonb_build_object('id', 'improvement', 'prompt', 'What was one challenge or improvement?', 'required', true)
                        ))
                    )
                )
            else jsonb_build_object('templateId', 'worksheet')
        end as activity_data
    from grade7_raw_activities
)
insert into public.classroom_activities (
    id,
    title,
    description,
    activity_type,
    subject_slug,
    grades,
    teacher_instructions,
    student_instructions,
    materials,
    estimated_minutes,
    student_output,
    makeup_instructions,
    assessment_purpose,
    activity_data,
    owner_id,
    updated_at
)
select
    id,
    title,
    description,
    activity_type,
    'technology',
    array['7'],
    teacher_instructions,
    student_instructions,
    materials,
    estimated_minutes,
    student_output,
    case
        when assessment_purpose = 'formal'
            then 'Complete equivalent evidence independently using class notes, the project file, or teacher-approved screenshots. Submit before the teacher deadline.'
        else 'Complete the same formative activity independently using class notes and submit it before the next class.'
    end,
    assessment_purpose,
    activity_data,
    null,
    now()
from grade7_prepared_activities
on conflict (id) do update set
    title = excluded.title,
    description = excluded.description,
    activity_type = excluded.activity_type,
    subject_slug = excluded.subject_slug,
    grades = excluded.grades,
    teacher_instructions = excluded.teacher_instructions,
    student_instructions = excluded.student_instructions,
    materials = excluded.materials,
    estimated_minutes = excluded.estimated_minutes,
    student_output = excluded.student_output,
    makeup_instructions = excluded.makeup_instructions,
    assessment_purpose = excluded.assessment_purpose,
    activity_data = excluded.activity_data,
    updated_at = now();
