-- Grade 8 app activities from the monthly planning.
-- Grade 8 is secondary: formal records represent non-Word-Hunt daily grades,
-- appreciation grades, and exam project evidence. Formative records replace
-- paper-style practice, planning sheets, checks, diagrams, logs, and reflections.

with grade8_raw_activities as (
    select *
    from jsonb_to_recordset($grade8_app_activities$
[
  {
    "id": "grade8_t1_daily_2_campaign_icon_logo_draft",
    "title": "G8 T1 Daily Grade 2 - Campaign Icon or Logo Draft",
    "class_slot": "March Week 3, 90-minute class",
    "description": "Students submit an original Inkscape campaign icon or logo draft with vector technique evidence and a campaign message.",
    "activity_type": "external-artifact",
    "assessment_purpose": "formal",
    "estimated_minutes": 35,
    "template_id": "project-evidence",
    "evidence_mode": "either",
    "teacher_note": "Use for Daily Grade #2 after campaign graphic planning.",
    "student_instructions": "Submit a screenshot, exported image, or file link for your campaign icon or logo and complete the checklist.",
    "student_output": "Campaign icon/logo evidence, checklist, and message.",
    "materials": "Inkscape file, planning sketch, rubric, and upload or screenshot tool.",
    "checklist": [
      {"id":"objects","text":"My design has at least 8 vector objects.", "required": true},
      {"id":"fill_stroke","text":"My design uses intentional fill and stroke choices.", "required": true},
      {"id":"grouped","text":"My design has at least 2 grouped parts.", "required": true},
      {"id":"edited_path","text":"My design includes at least 1 edited path.", "required": true}
    ],
    "reflections": [
      {"id":"message","prompt":"Write the one-sentence campaign message for this icon or logo.", "required": true},
      {"id":"improve","prompt":"What is one improvement goal for next class?", "required": true}
    ]
  },
  {
    "id": "grade8_t1_daily_3_computing_systems_diagram",
    "title": "G8 T1 Daily Grade 3 - Computing Systems Diagram",
    "class_slot": "April Week 5, 90-minute class",
    "description": "Students label a computing system and explain how parts work together to run a website.",
    "activity_type": "map-diagram",
    "assessment_purpose": "formal",
    "estimated_minutes": 30,
    "template_id": "labeled-map",
    "teacher_note": "Use for Daily Grade #3 after computing-system practice.",
    "student_instructions": "Create a labeled computing systems diagram with processor, memory, storage, input, output, communication, operating system, and program. Add one explanation sentence.",
    "student_output": "Labeled computing systems diagram and explanation.",
    "materials": "Computing systems notes and diagram reference."
  },
  {
    "id": "grade8_t1_daily_4_html_css_campaign_page",
    "title": "G8 T1 Daily Grade 4 - HTML/CSS Campaign Page",
    "class_slot": "April Week 7, 90-minute class",
    "description": "Students submit one campaign web page using HTML and CSS with required structure, style, image, link, and credit evidence.",
    "activity_type": "external-artifact",
    "assessment_purpose": "formal",
    "estimated_minutes": 40,
    "template_id": "project-evidence",
    "evidence_mode": "either",
    "teacher_note": "Use for Daily Grade #4 during the HTML/CSS campaign page task.",
    "student_instructions": "Submit your web page evidence and complete the HTML/CSS checklist.",
    "student_output": "HTML/CSS page link or screenshot with checklist and reflection.",
    "materials": "Text editor, browser, campaign images, source credit, and HTML/CSS files.",
    "checklist": [
      {"id":"title_sections","text":"The page has a title and two sections.", "required": true},
      {"id":"image_alt","text":"The page includes one image with alt text.", "required": true},
      {"id":"list_link","text":"The page includes one list and one link.", "required": true},
      {"id":"css_rules","text":"The page has at least three CSS style rules.", "required": true},
      {"id":"credit","text":"The page includes a short source credit.", "required": true}
    ],
    "reflections": [
      {"id":"tag_issue","prompt":"What tag or CSS issue did you fix or review?", "required": true}
    ]
  },
  {
    "id": "grade8_t1_daily_5_portfolio_planning_map",
    "title": "G8 T1 Daily Grade 5 - Portfolio Planning Map and Evidence Checklist",
    "class_slot": "May Week 9, 90-minute class",
    "description": "Students plan the Google Sites portfolio pages, evidence, vector graphics, video status, source credits, and call to action.",
    "activity_type": "structured-response",
    "assessment_purpose": "formal",
    "estimated_minutes": 35,
    "template_id": "worksheet",
    "teacher_note": "Use for Daily Grade #5 before the Google Sites exam project begins.",
    "student_instructions": "Complete the portfolio planning map and evidence checklist before building the final site.",
    "student_output": "Portfolio planning map and evidence checklist.",
    "materials": "Project rubric, Google Sites, vector files, video file or storyboard, and source notes.",
    "fields": [
      {"id":"pages_table","type":"table-grid","prompt":"Plan at least 5 portfolio pages.", "rows":[{"id":"home","text":"Home"},{"id":"campaign","text":"Campaign"},{"id":"graphics","text":"Vector Graphics"},{"id":"credits","text":"Research/Credits"},{"id":"reflection","text":"Reflection"}], "columns":[{"id":"content","text":"Required content"},{"id":"evidence","text":"Evidence or file needed"}]},
      {"id":"graphics","type":"long-text","prompt":"List the 3 original vector graphics you will include."},
      {"id":"video","type":"long-text","prompt":"Where is the required environmental video, or what is the storyboard status?"},
      {"id":"credits","type":"long-text","prompt":"Record 2 source credits."},
      {"id":"cta","type":"short-text","prompt":"Write one campaign call to action."}
    ]
  },
  {
    "id": "grade8_t1_appreciation_1_design_collaboration",
    "title": "G8 T1 Appreciation Grade 1 - Design Responsibility and Collaboration",
    "class_slot": "March Week 4, 90-minute class",
    "description": "Students complete a collaboration checklist and explain one design improvement made after feedback.",
    "activity_type": "structured-response",
    "assessment_purpose": "formal",
    "estimated_minutes": 12,
    "template_id": "checklist",
    "teacher_note": "Use for Appreciation Grade #1 during design review and improvement.",
    "student_instructions": "Complete the collaboration checklist and explain your strongest improvement.",
    "student_output": "Collaboration checklist and improvement note.",
    "materials": "Campaign graphic draft, peer feedback, and review checklist.",
    "fields": [
      {"id":"collaboration","type":"checklist","prompt":"Collaboration checklist", "items":[{"id":"responsibility","text":"I used class time responsibly."},{"id":"communication","text":"I communicated clearly during peer review."},{"id":"respect","text":"I gave respectful feedback."},{"id":"organization","text":"I kept files organized."},{"id":"improved","text":"I used feedback to improve work."}]},
      {"id":"improvement","type":"long-text","prompt":"What was the strongest improvement you made after feedback?"}
    ]
  },
  {
    "id": "grade8_t1_appreciation_2_web_research_responsibility",
    "title": "G8 T1 Appreciation Grade 2 - Web Research and Digital Responsibility",
    "class_slot": "April Week 8, 90-minute class",
    "description": "Students reflect on effort, organization, digital responsibility, feedback, and improvement during web and research work.",
    "activity_type": "structured-response",
    "assessment_purpose": "formal",
    "estimated_minutes": 12,
    "template_id": "reflection",
    "teacher_note": "Use for Appreciation Grade #2 during portfolio content and video organization.",
    "student_instructions": "Reflect honestly on your work habits during the web and research unit.",
    "student_output": "Web research responsibility reflection.",
    "materials": "Search notes, source credits, site map, and video outline.",
    "fields": [
      {"id":"effort","type":"rating-scale","prompt":"Rate your effort during web and research work from 1 to 5."},
      {"id":"organization","type":"long-text","prompt":"How did you organize sources, files, or portfolio evidence?"},
      {"id":"responsibility","type":"long-text","prompt":"How did you show digital responsibility with sources, media, or feedback?"},
      {"id":"improvement","type":"short-text","prompt":"What should you improve before the final project?"}
    ]
  },
  {
    "id": "grade8_t1_exam_google_sites_environmental_portfolio",
    "title": "G8 T1 Exam Project - Google Sites Environmental Campaign Portfolio",
    "class_slot": "May Weeks 10-12 exam project",
    "description": "Students submit the final Google Sites portfolio with campaign purpose, vector graphics, environmental video, source credits, reflection, and presentation evidence.",
    "activity_type": "external-artifact",
    "assessment_purpose": "formal",
    "estimated_minutes": 90,
    "template_id": "link-evidence",
    "evidence_mode": "link",
    "teacher_note": "Use as the exam project evidence wrapper for the May Google Sites portfolio.",
    "student_instructions": "Submit the final site link and complete the project checklist and reflection prompts.",
    "student_output": "Published or preview site link, checklist, and reflection.",
    "materials": "Google Sites portfolio, vector graphics, environmental video, source credits, and rubric.",
    "checklist": [
      {"id":"pages","text":"The site has the required pages and clear navigation.", "required": true},
      {"id":"graphics","text":"The site includes at least 3 original vector graphics.", "required": true},
      {"id":"video","text":"The site includes the required environmental video or teacher-approved video evidence.", "required": true},
      {"id":"credits","text":"The site includes research or media source credits.", "required": true},
      {"id":"reflection","text":"The site includes a project reflection.", "required": true}
    ],
    "reflections": [
      {"id":"audience","prompt":"How does your site support the campaign audience?", "required": true},
      {"id":"techniques","prompt":"What vector or web design techniques did you use?", "required": true},
      {"id":"challenge","prompt":"What challenge did you solve during the project?", "required": true}
    ]
  },
  {
    "id": "grade8_t2_daily_2_button_led_build",
    "title": "G8 T2 Daily Grade 2 - Button-Controlled LED Build",
    "class_slot": "June Week 3, 90-minute class",
    "description": "Students submit evidence of a button-controlled LED circuit and explain input, process, and output.",
    "activity_type": "external-artifact",
    "assessment_purpose": "formal",
    "estimated_minutes": 35,
    "template_id": "project-evidence",
    "evidence_mode": "either",
    "teacher_note": "Use for Daily Grade #2 during Serial Monitor basics.",
    "student_instructions": "Submit your labeled circuit evidence and complete the checklist.",
    "student_output": "Labeled circuit evidence and input-process-output explanation.",
    "materials": "Arduino/Freenove kit, LED, resistor, button, breadboard, code, and screenshot/photo tool.",
    "checklist": [
      {"id":"button","text":"The circuit uses a button as input.", "required": true},
      {"id":"led","text":"The circuit uses an LED as output.", "required": true},
      {"id":"state","text":"The LED changes state when the button is pressed.", "required": true},
      {"id":"labeled","text":"The evidence labels the circuit or diagram.", "required": true}
    ],
    "reflections": [
      {"id":"ipo","prompt":"Explain the input, process, and output in one or two sentences.", "required": true}
    ]
  },
  {
    "id": "grade8_t2_daily_3_analog_sensor_data_chart",
    "title": "G8 T2 Daily Grade 3 - Analog Sensor Data Chart",
    "class_slot": "July Week 5, 90-minute class",
    "description": "Students record potentiometer positions, analog readings, LED brightness observations, and one input-output conclusion.",
    "activity_type": "spreadsheet-table",
    "assessment_purpose": "formal",
    "estimated_minutes": 35,
    "template_id": "data-table",
    "teacher_note": "Use for Daily Grade #3 during potentiometer data and LED brightness.",
    "student_instructions": "Record at least 6 potentiometer readings and write a conclusion about the input-output relationship.",
    "student_output": "Analog sensor data chart and conclusion.",
    "materials": "Arduino/Freenove kit, potentiometer, LED, Serial Monitor, and test notes.",
    "columns": [
      {"id":"position","title":"Position","type":"text","width":130},
      {"id":"reading","title":"Analog Reading","type":"number","width":140},
      {"id":"brightness","title":"LED Brightness","type":"text","width":150},
      {"id":"note","title":"Observation","type":"text","width":190}
    ],
    "min_rows": 6,
    "max_rows": 12,
    "reflections": [
      {"id":"conclusion","prompt":"What conclusion can you make about the relationship between input and output?", "required": true}
    ]
  },
  {
    "id": "grade8_t2_daily_4_servo_buzzer_input_control",
    "title": "G8 T2 Daily Grade 4 - Servo or Buzzer Controlled by Input",
    "class_slot": "July Week 7, 90-minute class",
    "description": "Students submit evidence of a servo and buzzer system controlled by a button, potentiometer, or sensor.",
    "activity_type": "external-artifact",
    "assessment_purpose": "formal",
    "estimated_minutes": 35,
    "template_id": "project-evidence",
    "evidence_mode": "either",
    "teacher_note": "Use for Daily Grade #4 during servo control.",
    "student_instructions": "Submit the circuit evidence, identify the input and output behavior, and explain how control works.",
    "student_output": "Circuit evidence, labeled diagram, and control explanation.",
    "materials": "Arduino/Freenove kit, servo or buzzer, input component, diagram, and code notes.",
    "checklist": [
      {"id":"input","text":"The system uses a button, potentiometer, or sensor as input.", "required": true},
      {"id":"output","text":"The system controls a servo, buzzer, RGB LED, or LED output.", "required": true},
      {"id":"diagram","text":"The evidence includes a labeled circuit diagram or photo.", "required": true},
      {"id":"explanation","text":"I explained how the input controls the output.", "required": true}
    ],
    "reflections": [
      {"id":"smooth","prompt":"What improvement would make control smoother or clearer?", "required": true}
    ]
  },
  {
    "id": "grade8_t2_daily_5_arduino_project_design_plan",
    "title": "G8 T2 Daily Grade 5 - Arduino Project Design Plan",
    "class_slot": "August Week 9, 90-minute class",
    "description": "Students create an Arduino prototype design plan with purpose, role, components, diagram, behavior, test cases, and materials.",
    "activity_type": "structured-response",
    "assessment_purpose": "formal",
    "estimated_minutes": 35,
    "template_id": "worksheet",
    "teacher_note": "Use for Daily Grade #5 before the Arduino exam project begins.",
    "student_instructions": "Complete the Arduino project design plan before building the prototype.",
    "student_output": "Arduino project design plan.",
    "materials": "Project rubric, approved component list, and circuit notes.",
    "fields": [
      {"id":"purpose","type":"long-text","prompt":"What problem or purpose will your prototype address?"},
      {"id":"role","type":"short-text","prompt":"What is your individual or pair role?"},
      {"id":"components","type":"table-grid","prompt":"Plan the input and output system.", "rows":[{"id":"input","text":"Input component"},{"id":"output","text":"Output component"},{"id":"process","text":"Process/code idea"},{"id":"materials","text":"Materials list"}], "columns":[{"id":"plan","text":"Your plan"}]},
      {"id":"behavior","type":"long-text","prompt":"Describe the expected behavior."},
      {"id":"tests","type":"table-grid","prompt":"Write 3 test cases.", "rows":[{"id":"test_1","text":"Test case 1"},{"id":"test_2","text":"Test case 2"},{"id":"test_3","text":"Test case 3"}], "columns":[{"id":"condition","text":"Condition/input"},{"id":"expected","text":"Expected output"}]}
    ]
  },
  {
    "id": "grade8_t2_appreciation_1_safe_material_use",
    "title": "G8 T2 Appreciation Grade 1 - Safe Material Use and Teamwork",
    "class_slot": "June Week 4, 90-minute class",
    "description": "Students complete a safe material use and teamwork checklist during the Arduino build challenge.",
    "activity_type": "structured-response",
    "assessment_purpose": "formal",
    "estimated_minutes": 12,
    "template_id": "checklist",
    "teacher_note": "Use for Appreciation Grade #1 during safe build challenge.",
    "student_instructions": "Complete the checklist and describe one safe teamwork habit.",
    "student_output": "Safe material use and teamwork checklist.",
    "materials": "Arduino/Freenove kit and lab roles.",
    "fields": [
      {"id":"safety","type":"checklist","prompt":"Safe material use and teamwork checklist", "items":[{"id":"power","text":"I checked power and ground before testing."},{"id":"resistor","text":"I used resistors correctly."},{"id":"components","text":"I handled components carefully."},{"id":"roles","text":"I followed builder, coder, checker, or recorder roles."},{"id":"cleanup","text":"I returned parts correctly."}]},
      {"id":"habit","type":"long-text","prompt":"Describe one safe teamwork habit from today."}
    ]
  },
  {
    "id": "grade8_t2_appreciation_2_perseverance_feedback",
    "title": "G8 T2 Appreciation Grade 2 - Arduino Perseverance and Feedback",
    "class_slot": "July Week 8, 90-minute class",
    "description": "Students reflect on perseverance, organization, careful testing, response to feedback, and improvement during Arduino work.",
    "activity_type": "structured-response",
    "assessment_purpose": "formal",
    "estimated_minutes": 12,
    "template_id": "reflection",
    "teacher_note": "Use for Appreciation Grade #2 during the integrated practice challenge.",
    "student_instructions": "Reflect on your Arduino work habits during the integrated challenge.",
    "student_output": "Perseverance and feedback reflection.",
    "materials": "Integrated challenge notes and feedback.",
    "fields": [
      {"id":"perseverance","type":"long-text","prompt":"Describe one moment when you continued after difficulty."},
      {"id":"organization","type":"short-text","prompt":"How did you keep materials, code, or notes organized?"},
      {"id":"feedback","type":"long-text","prompt":"What feedback did you use or respond to?"},
      {"id":"improvement","type":"long-text","prompt":"What improvement did you make during testing?"}
    ]
  },
  {
    "id": "grade8_t2_exam_arduino_freenove_prototype",
    "title": "G8 T2 Exam Project - Arduino/Freenove Integrated Prototype",
    "class_slot": "August Weeks 10-12 exam project",
    "description": "Students submit Arduino/Freenove prototype evidence with circuit, code, testing, improvement, explanation, and reflection.",
    "activity_type": "external-artifact",
    "assessment_purpose": "formal",
    "estimated_minutes": 90,
    "template_id": "project-evidence",
    "evidence_mode": "both",
    "teacher_note": "Use as the exam project evidence wrapper for the August Arduino/Freenove prototype.",
    "student_instructions": "Submit prototype evidence and complete the project checklist and reflections.",
    "student_output": "Prototype evidence, checklist, testing notes, and reflection.",
    "materials": "Arduino/Freenove prototype, circuit diagram, code evidence, testing notes, and rubric.",
    "checklist": [
      {"id":"purpose","text":"My evidence explains the prototype purpose.", "required": true},
      {"id":"circuit","text":"My evidence includes a labeled circuit diagram or photo.", "required": true},
      {"id":"code","text":"My evidence includes code or code screenshots.", "required": true},
      {"id":"testing","text":"My evidence includes testing notes or results.", "required": true},
      {"id":"improvement","text":"My evidence explains an improvement or debug step.", "required": true}
    ],
    "reflections": [
      {"id":"logic","prompt":"Explain how the input, code/process, and output work together.", "required": true},
      {"id":"debug","prompt":"What wiring, code, or design issue did you fix?", "required": true},
      {"id":"future","prompt":"What future improvement would make the prototype more reliable?", "required": true}
    ]
  },
  {
    "id": "grade8_t3_daily_2_app_screen_plan_event_map",
    "title": "G8 T3 Daily Grade 2 - App Screen Plan and Event Map",
    "class_slot": "September Week 3, 90-minute class",
    "description": "Students create an app screen plan and event map with screens, interface elements, events, variable/input, and test cases.",
    "activity_type": "structured-response",
    "assessment_purpose": "formal",
    "estimated_minutes": 35,
    "template_id": "worksheet",
    "teacher_note": "Use for Daily Grade #2 after user-needs practice.",
    "student_instructions": "Complete the app plan and event map evidence.",
    "student_output": "App screen plan and event map.",
    "materials": "App planning checklist, wireframe notes, and event examples.",
    "fields": [
      {"id":"screens","type":"table-grid","prompt":"Plan at least 3 app screens.", "rows":[{"id":"screen_1","text":"Screen 1"},{"id":"screen_2","text":"Screen 2"},{"id":"screen_3","text":"Screen 3"}], "columns":[{"id":"purpose","text":"Purpose"},{"id":"elements","text":"Interface elements"}]},
      {"id":"events","type":"table-grid","prompt":"Plan at least 4 events.", "rows":[{"id":"event_1","text":"Event 1"},{"id":"event_2","text":"Event 2"},{"id":"event_3","text":"Event 3"},{"id":"event_4","text":"Event 4"}], "columns":[{"id":"trigger","text":"Trigger"},{"id":"result","text":"Result/screen flow"}]},
      {"id":"variable","type":"short-text","prompt":"What variable or user input will the app use?"},
      {"id":"tests","type":"long-text","prompt":"Write 3 test cases."}
    ]
  },
  {
    "id": "grade8_t3_daily_3_python_input_output_variable_task",
    "title": "G8 T3 Daily Grade 3 - Python Input/Output and Variable Task",
    "class_slot": "October Week 5, 90-minute class",
    "description": "Students submit Python code that asks for two numbers, calculates at least 3 results, displays labeled output, and includes a purpose comment.",
    "activity_type": "external-artifact",
    "assessment_purpose": "formal",
    "estimated_minutes": 35,
    "template_id": "project-evidence",
    "evidence_mode": "either",
    "teacher_note": "Use for Daily Grade #3 during selection with if/else.",
    "student_instructions": "Submit your Python code or screenshot and complete the checklist.",
    "student_output": "Python code evidence and test reflection.",
    "materials": "Python environment and code screenshot or file.",
    "checklist": [
      {"id":"inputs","text":"The program asks for two numbers.", "required": true},
      {"id":"calculations","text":"The program calculates at least 3 results.", "required": true},
      {"id":"labels","text":"The output is clearly labeled.", "required": true},
      {"id":"comment","text":"The code includes one purpose comment.", "required": true}
    ],
    "reflections": [
      {"id":"test","prompt":"Write one test input that proved your program worked.", "required": true}
    ]
  },
  {
    "id": "grade8_t3_daily_4_python_selection_loop_debugging",
    "title": "G8 T3 Daily Grade 4 - Python Selection and Loop Debugging Check",
    "class_slot": "October Week 7, 90-minute class",
    "description": "Students debug a Python program with 5 errors involving variables, if/else, and a loop.",
    "activity_type": "structured-response",
    "assessment_purpose": "formal",
    "estimated_minutes": 35,
    "template_id": "worksheet",
    "teacher_note": "Use for Daily Grade #4 before Scratch + Micro:bit setup.",
    "student_instructions": "Record the five errors, fixes, and results from the debugging check.",
    "student_output": "Python debugging table and corrected-code note.",
    "materials": "Python starter/debugging file.",
    "fields": [
      {"id":"debug_table","type":"table-grid","prompt":"Complete the debugging table.", "rows":[{"id":"error_1","text":"Error 1"},{"id":"error_2","text":"Error 2"},{"id":"error_3","text":"Error 3"},{"id":"error_4","text":"Error 4"},{"id":"error_5","text":"Error 5"}], "columns":[{"id":"problem","text":"Problem/error type"},{"id":"fix","text":"Fix"},{"id":"result","text":"Result"}]},
      {"id":"best_fix","type":"long-text","prompt":"Which fix was most important? Explain why."}
    ]
  },
  {
    "id": "grade8_t3_daily_5_representation_binary_check",
    "title": "G8 T3 Daily Grade 5 - Representation and Binary Check",
    "class_slot": "November Week 9, 90-minute class",
    "description": "Students complete vocabulary matches, decimal/binary conversions, and examples of how devices represent information.",
    "activity_type": "structured-response",
    "assessment_purpose": "formal",
    "estimated_minutes": 35,
    "template_id": "worksheet",
    "teacher_note": "Use for Daily Grade #5 before final Scratch + Micro:bit project planning.",
    "student_instructions": "Complete the representation and binary check and the short device-representation examples.",
    "student_output": "Representation and binary check.",
    "materials": "Binary and representation notes.",
    "fields": [
      {"id":"matches","type":"matching","prompt":"Match each term to the correct meaning.", "items":[{"id":"representation","text":"representation","matchText":"A way to show information."},{"id":"symbol","text":"symbol","matchText":"A mark or picture that stands for something."},{"id":"bit","text":"bit","matchText":"A single binary digit."},{"id":"binary","text":"binary","matchText":"A number system using 0 and 1."},{"id":"byte","text":"byte","matchText":"A group of 8 bits."},{"id":"decimal","text":"decimal","matchText":"The number system using digits 0 through 9."}]},
      {"id":"conversions","type":"table-grid","prompt":"Complete 6 small conversions.", "rows":[{"id":"c1","text":"Conversion 1"},{"id":"c2","text":"Conversion 2"},{"id":"c3","text":"Conversion 3"},{"id":"c4","text":"Conversion 4"},{"id":"c5","text":"Conversion 5"},{"id":"c6","text":"Conversion 6"}], "columns":[{"id":"given","text":"Given value"},{"id":"converted","text":"Converted value"}]},
      {"id":"examples","type":"long-text","prompt":"Write 2 short examples of how devices represent information."}
    ]
  },
  {
    "id": "grade8_t3_appreciation_1_pair_programming_debugging",
    "title": "G8 T3 Appreciation Grade 1 - Pair Programming and Debugging Habits",
    "class_slot": "October Week 8, 90-minute class",
    "description": "Students complete a pair programming and debugging habits checklist during Scratch + Micro:bit prototype work.",
    "activity_type": "structured-response",
    "assessment_purpose": "formal",
    "estimated_minutes": 12,
    "template_id": "checklist",
    "teacher_note": "Use for Appreciation Grade #1 during prototype and habits check.",
    "student_instructions": "Complete the habits checklist and name the next feature to build.",
    "student_output": "Pair programming and debugging habits checklist.",
    "materials": "Scratch + Micro:bit prototype and role notes.",
    "fields": [
      {"id":"habits","type":"checklist","prompt":"Pair programming and debugging habits", "items":[{"id":"communication","text":"I communicated clearly."},{"id":"participation","text":"I participated in my role."},{"id":"perseverance","text":"I kept working through bugs."},{"id":"feedback","text":"I gave or received respectful feedback."},{"id":"testing","text":"I kept testing organized."}]},
      {"id":"next_feature","type":"short-text","prompt":"What is the next feature to build?"}
    ]
  },
  {
    "id": "grade8_t3_appreciation_2_project_readiness",
    "title": "G8 T3 Appreciation Grade 2 - Scratch + Micro:bit Project Readiness",
    "class_slot": "November Week 10, 90-minute class",
    "description": "Students reflect on responsibility, organization, effort, safe device use, feedback, and improvement during final project work.",
    "activity_type": "structured-response",
    "assessment_purpose": "formal",
    "estimated_minutes": 12,
    "template_id": "reflection",
    "teacher_note": "Use for Appreciation Grade #2 during game building and sensor control.",
    "student_instructions": "Reflect on your project readiness and responsibility.",
    "student_output": "Project readiness reflection.",
    "materials": "Game plan, Scratch + Micro:bit setup, and rubric.",
    "fields": [
      {"id":"responsibility","type":"long-text","prompt":"What responsibility did you complete well?"},
      {"id":"organization","type":"short-text","prompt":"How did you organize files, screenshots, or notes?"},
      {"id":"safe_use","type":"long-text","prompt":"How did you use devices safely and responsibly?"},
      {"id":"improvement","type":"long-text","prompt":"What feedback or improvement will help your project next?"}
    ]
  },
  {
    "id": "grade8_t3_exam_scratch_microbit_game",
    "title": "G8 T3 Exam Project - Scratch + Micro:bit Interactive Game",
    "class_slot": "November Weeks 10-12 exam project",
    "description": "Students submit the final Scratch + Micro:bit game evidence with sensor input, game logic, testing, challenge, and reflection.",
    "activity_type": "external-artifact",
    "assessment_purpose": "formal",
    "estimated_minutes": 90,
    "template_id": "link-evidence",
    "evidence_mode": "either",
    "teacher_note": "Use as the exam project evidence wrapper for the Scratch + Micro:bit final project.",
    "student_instructions": "Submit the Scratch project link or screenshot evidence and complete the project checklist and reflections.",
    "student_output": "Scratch project evidence, checklist, and reflection.",
    "materials": "Scratch project, Micro:bit or simulator, screenshots, test notes, and rubric.",
    "checklist": [
      {"id":"game_shell","text":"The project has a game title, sprite, and background.", "required": true},
      {"id":"microbit_input","text":"The game uses Micro:bit input or a clearly labeled simulation.", "required": true},
      {"id":"logic","text":"The game includes game logic such as motion, score, obstacle, or win condition.", "required": true},
      {"id":"testing","text":"The evidence includes user testing or debugging notes.", "required": true},
      {"id":"presentation","text":"I prepared a game explanation or presentation notes.", "required": true}
    ],
    "reflections": [
      {"id":"controls","prompt":"How does the Micro:bit input control the game?", "required": true},
      {"id":"challenge","prompt":"What challenge or bug did you solve?", "required": true},
      {"id":"learned","prompt":"What did you learn from testing and presenting?", "required": true}
    ]
  },
  {
    "id": "grade8_formative_2026_03_w1_45_vector_symbol_sketch",
    "title": "G8 Formative - March W1 45m - Vector Symbol Sketch",
    "class_slot": "March Week 1, 45-minute class",
    "description": "Students sketch a simple environmental symbol using basic shapes.",
    "activity_type": "map-diagram",
    "assessment_purpose": "formative",
    "estimated_minutes": 15,
    "template_id": "blank-map-diagram",
    "teacher_note": "Use during the introduction to vector graphics.",
    "student_instructions": "Sketch a leaf, water drop, recycling arrow, sun, tree, or warning sign using only basic shapes.",
    "student_output": "Environmental symbol sketch.",
    "materials": "Notebook sketch idea or app drawing tool."
  },
  {
    "id": "grade8_formative_2026_03_w1_90_badge_improvement_note",
    "title": "G8 Formative - March W1 90m - Badge Improvement Note",
    "class_slot": "March Week 1, 90-minute class",
    "description": "Students record two changes made to an environmental badge and why the changes improved the design.",
    "activity_type": "structured-response",
    "assessment_purpose": "formative",
    "estimated_minutes": 8,
    "template_id": "reflection",
    "teacher_note": "Use after students create the badge draft.",
    "student_instructions": "Record two changes you made and why they improved your badge.",
    "student_output": "Badge improvement note.",
    "materials": "Inkscape badge draft.",
    "fields": [
      {"id":"changes","type":"long-text","prompt":"What two changes did you make?"},
      {"id":"why","type":"long-text","prompt":"Why did these changes improve the design?"}
    ]
  },
  {
    "id": "grade8_formative_2026_03_w2_45_alignment_grouping_sort",
    "title": "G8 Formative - March W2 45m - Alignment and Grouping Sort",
    "class_slot": "March Week 2, 45-minute class",
    "description": "Students sort examples into aligned, distributed, grouped, and ungrouped categories.",
    "activity_type": "card-sort",
    "assessment_purpose": "formative",
    "estimated_minutes": 12,
    "template_id": "category-sort",
    "teacher_note": "Use before students organize repeated objects.",
    "student_instructions": "Sort each design example by the layout action it shows.",
    "student_output": "Completed alignment and grouping sort.",
    "materials": "Alignment and grouping examples.",
    "categories": [{"id":"aligned","title":"Aligned"},{"id":"distributed","title":"Distributed"},{"id":"grouped","title":"Grouped"},{"id":"ungrouped","title":"Ungrouped"}],
    "cards": [{"id":"same_left","text":"Objects line up on the same left edge","expectedCategoryId":"aligned"},{"id":"even_space","text":"Objects have even spacing between them","expectedCategoryId":"distributed"},{"id":"move_together","text":"Several objects move as one unit","expectedCategoryId":"grouped"},{"id":"separate","text":"Objects move separately","expectedCategoryId":"ungrouped"}]
  },
  {
    "id": "grade8_formative_2026_03_w2_90_path_node_practice",
    "title": "G8 Formative - March W2 90m - Path and Node Practice",
    "class_slot": "March Week 2, 90-minute class",
    "description": "Students practice drawing a path-based symbol and compare a shape with a path.",
    "activity_type": "map-diagram",
    "assessment_purpose": "formative",
    "estimated_minutes": 20,
    "template_id": "labeled-map",
    "teacher_note": "Use after path and node practice.",
    "student_instructions": "Draw a path-based symbol and add notes showing possible nodes or path changes.",
    "student_output": "Path and node practice drawing.",
    "materials": "Inkscape path practice notes."
  },
  {
    "id": "grade8_formative_2026_03_w3_45_campaign_graphic_plan",
    "title": "G8 Formative - March W3 45m - Campaign Graphic Plan",
    "class_slot": "March Week 3, 45-minute class",
    "description": "Students plan a campaign icon or logo with audience, action, colors, shapes, and vector techniques.",
    "activity_type": "structured-response",
    "assessment_purpose": "formative",
    "estimated_minutes": 18,
    "template_id": "worksheet",
    "teacher_note": "Use before the campaign icon/logo daily grade.",
    "student_instructions": "Complete the campaign graphic planning prompts.",
    "student_output": "Campaign graphic plan.",
    "materials": "Campaign topic notes and Inkscape planning sketch.",
    "fields": [
      {"id":"topic","type":"short-text","prompt":"What environmental campaign topic did you choose?"},
      {"id":"audience","type":"short-text","prompt":"Who is the audience?"},
      {"id":"action","type":"short-text","prompt":"What action do you want viewers to take?"},
      {"id":"techniques","type":"long-text","prompt":"List at least 5 vector techniques you plan to use."}
    ]
  },
  {
    "id": "grade8_formative_2026_03_w4_45_svg_markup_check",
    "title": "G8 Formative - March W4 45m - SVG Markup Check",
    "class_slot": "March Week 4, 45-minute class",
    "description": "Students identify SVG markup parts and explain how markup can describe an image.",
    "activity_type": "structured-response",
    "assessment_purpose": "formative",
    "estimated_minutes": 12,
    "template_id": "worksheet",
    "teacher_note": "Use during SVG and markup basics.",
    "student_instructions": "Complete the SVG markup check.",
    "student_output": "SVG markup check.",
    "materials": "Simple SVG code sample.",
    "fields": [
      {"id":"terms","type":"matching","prompt":"Match each SVG idea.", "items":[{"id":"svg","text":"SVG","matchText":"A vector image file format."},{"id":"tag","text":"tag","matchText":"A markup label inside angle brackets."},{"id":"attribute","text":"attribute","matchText":"Extra information inside a tag."},{"id":"property","text":"property","matchText":"A style or setting."}]},
      {"id":"explain","type":"long-text","prompt":"How can markup describe an image?"}
    ]
  },
  {
    "id": "grade8_formative_2026_04_w5_45_system_examples_sort",
    "title": "G8 Formative - April W5 45m - Computing System Examples Sort",
    "class_slot": "April Week 5, 45-minute class",
    "description": "Students sort examples into hardware, software, input, output, processor, memory, and storage.",
    "activity_type": "card-sort",
    "assessment_purpose": "formative",
    "estimated_minutes": 12,
    "template_id": "category-sort",
    "teacher_note": "Use before the computing systems diagram daily grade.",
    "student_instructions": "Sort each example into the best computing-system category.",
    "student_output": "Completed computing examples sort.",
    "materials": "Computing system vocabulary notes.",
    "categories": [{"id":"hardware","title":"Hardware"},{"id":"software","title":"Software"},{"id":"input","title":"Input"},{"id":"output","title":"Output"},{"id":"storage","title":"Storage"}],
    "cards": [{"id":"keyboard","text":"Keyboard","expectedCategoryId":"input"},{"id":"screen","text":"Screen","expectedCategoryId":"output"},{"id":"operating_system","text":"Operating system","expectedCategoryId":"software"},{"id":"ssd","text":"Drive or SSD","expectedCategoryId":"storage"},{"id":"speaker","text":"Speaker","expectedCategoryId":"output"},{"id":"touchscreen","text":"Touchscreen","expectedCategoryId":"input"}]
  },
  {
    "id": "grade8_formative_2026_04_w5_90_logic_operator_practice",
    "title": "G8 Formative - April W5 90m - Search Logic Practice",
    "class_slot": "April Week 5, 90-minute class",
    "description": "Students create simple AND, OR, and NOT logic examples connected to search and filtering.",
    "activity_type": "structured-response",
    "assessment_purpose": "formative",
    "estimated_minutes": 10,
    "template_id": "worksheet",
    "teacher_note": "Use after the computing systems diagram.",
    "student_instructions": "Write one example using AND, OR, and NOT for research or filtering.",
    "student_output": "Search logic examples.",
    "materials": "Search operator notes.",
    "fields": [
      {"id":"and_example","type":"short-text","prompt":"Write an AND search example."},
      {"id":"or_example","type":"short-text","prompt":"Write an OR search example."},
      {"id":"not_example","type":"short-text","prompt":"Write a NOT or minus-sign search example."}
    ]
  },
  {
    "id": "grade8_formative_2026_04_w6_45_ai_demo_notes",
    "title": "G8 Formative - April W6 45m - AI Demo Notes",
    "class_slot": "April Week 6, 45-minute class",
    "description": "Students record the data used, model prediction, and one limitation from an approved AI demo.",
    "activity_type": "structured-response",
    "assessment_purpose": "formative",
    "estimated_minutes": 15,
    "template_id": "worksheet",
    "teacher_note": "Use during AI and machine learning.",
    "student_instructions": "Record what data was used, what the model predicted, and one mistake or limitation.",
    "student_output": "AI demo notes.",
    "materials": "Approved AI demo or Teachable Machine activity.",
    "fields": [
      {"id":"data","type":"long-text","prompt":"What data was used?"},
      {"id":"prediction","type":"short-text","prompt":"What did the model predict?"},
      {"id":"limitation","type":"long-text","prompt":"What mistake or limitation did you notice?"},
      {"id":"ethics","type":"short-text","prompt":"Write one ethical question about AI use."}
    ]
  },
  {
    "id": "grade8_formative_2026_04_w6_90_source_credit_check",
    "title": "G8 Formative - April W6 90m - Source and Credit Check",
    "class_slot": "April Week 6, 90-minute class",
    "description": "Students record source/credit information for two images or resources for the campaign site.",
    "activity_type": "structured-response",
    "assessment_purpose": "formative",
    "estimated_minutes": 15,
    "template_id": "worksheet",
    "teacher_note": "Use during open source and responsible remixing.",
    "student_instructions": "Complete the source/credit check for two campaign resources.",
    "student_output": "Source and credit notes.",
    "materials": "Approved image or resource sources.",
    "fields": [
      {"id":"source_table","type":"table-grid","prompt":"Record two source/credit notes.", "rows":[{"id":"source_1","text":"Source 1"},{"id":"source_2","text":"Source 2"}], "columns":[{"id":"title","text":"Title/resource"},{"id":"creator","text":"Creator/source"},{"id":"link","text":"Link"},{"id":"permission","text":"Permission note"}]},
      {"id":"why_credit","type":"long-text","prompt":"Why does credit matter when using online resources?"}
    ]
  },
  {
    "id": "grade8_formative_2026_04_w7_45_html_tag_order",
    "title": "G8 Formative - April W7 45m - HTML Tag Order",
    "class_slot": "April Week 7, 45-minute class",
    "description": "Students order the parts of a simple HTML document.",
    "activity_type": "card-sort",
    "assessment_purpose": "formative",
    "estimated_minutes": 12,
    "template_id": "sequence-sort",
    "teacher_note": "Use during HTML structure practice.",
    "student_instructions": "Place the HTML structure cards in order.",
    "student_output": "Completed HTML tag order.",
    "materials": "Simple HTML document example.",
    "cards": [{"id":"doctype","text":"Start the HTML document","expectedCategoryId":"correct_order","expectedOrder":1},{"id":"head","text":"Add head information","expectedCategoryId":"correct_order","expectedOrder":2},{"id":"body","text":"Open the body","expectedCategoryId":"correct_order","expectedOrder":3},{"id":"heading","text":"Add heading and paragraphs","expectedCategoryId":"correct_order","expectedOrder":4},{"id":"close","text":"Close body and html tags","expectedCategoryId":"correct_order","expectedOrder":5}]
  },
  {
    "id": "grade8_formative_2026_04_w8_45_search_query_plan",
    "title": "G8 Formative - April W8 45m - Search Query Plan",
    "class_slot": "April Week 8, 45-minute class",
    "description": "Students create improved search queries and explain which query gives useful results.",
    "activity_type": "structured-response",
    "assessment_purpose": "formative",
    "estimated_minutes": 15,
    "template_id": "worksheet",
    "teacher_note": "Use during search engines and keywords.",
    "student_instructions": "Write improved search queries and choose the most useful one.",
    "student_output": "Search query plan.",
    "materials": "Campaign topic and search strategy notes.",
    "fields": [
      {"id":"queries","type":"long-text","prompt":"Write 5 improved search queries using AND, OR, NOT, quotes, or minus sign."},
      {"id":"best","type":"long-text","prompt":"Which query gave the most useful results and why?"},
      {"id":"sources","type":"long-text","prompt":"Save two useful source links for later."}
    ]
  },
  {
    "id": "grade8_formative_2026_04_w8_90_site_map_video_outline",
    "title": "G8 Formative - April W8 90m - Site Map and Video Outline",
    "class_slot": "April Week 8, 90-minute class",
    "description": "Students plan Google Sites pages and a 5-shot environmental video storyboard or outline.",
    "activity_type": "structured-response",
    "assessment_purpose": "formative",
    "estimated_minutes": 20,
    "template_id": "worksheet",
    "teacher_note": "Use after the Appreciation Grade #2 reflection.",
    "student_instructions": "Plan your Google Sites pages and required environmental video outline.",
    "student_output": "Site map and video outline.",
    "materials": "Google Sites planning notes and video/storyboard examples.",
    "fields": [
      {"id":"site_pages","type":"long-text","prompt":"List the pages your portfolio will need."},
      {"id":"video_table","type":"table-grid","prompt":"Plan 5 video shots or scenes.", "rows":[{"id":"shot_1","text":"Shot 1"},{"id":"shot_2","text":"Shot 2"},{"id":"shot_3","text":"Shot 3"},{"id":"shot_4","text":"Shot 4"},{"id":"shot_5","text":"Shot 5"}], "columns":[{"id":"visual","text":"Visual"},{"id":"message","text":"Narration/text"},{"id":"source","text":"Source need"}]},
      {"id":"question","type":"short-text","prompt":"What question do you still have before the final project?"}
    ]
  },
  {
    "id": "grade8_formative_2026_05_w9_45_project_evidence_check",
    "title": "G8 Formative - May W9 45m - Project Evidence Check",
    "class_slot": "May Week 9, 45-minute class",
    "description": "Students check which portfolio evidence pieces are complete and which need finishing.",
    "activity_type": "structured-response",
    "assessment_purpose": "formative",
    "estimated_minutes": 12,
    "template_id": "checklist",
    "teacher_note": "Use before the Daily Grade #5 planning map.",
    "student_instructions": "Mark project pieces that are complete and list one item to finish.",
    "student_output": "Project evidence check.",
    "materials": "Portfolio evidence list.",
    "fields": [
      {"id":"evidence","type":"checklist","prompt":"Portfolio evidence checklist", "items":[{"id":"vector","text":"Vector graphic/icon is ready."},{"id":"video","text":"Required environmental video or storyboard is ready."},{"id":"campaign","text":"Campaign message is clear."},{"id":"credits","text":"Research/source credits are saved."},{"id":"pages","text":"Page and navigation plan is started."}]},
      {"id":"finish","type":"short-text","prompt":"What item needs to be finished in the long class?"}
    ]
  },
  {
    "id": "grade8_formative_2026_05_w10_45_homepage_launch_note",
    "title": "G8 Formative - May W10 45m - Homepage Launch Note",
    "class_slot": "May Week 10, 45-minute class",
    "description": "Students record the audience, campaign message, homepage purpose, and one question for the next work session.",
    "activity_type": "structured-response",
    "assessment_purpose": "formative",
    "estimated_minutes": 8,
    "template_id": "worksheet",
    "teacher_note": "Use during exam project launch.",
    "student_instructions": "Record your homepage launch details.",
    "student_output": "Homepage launch note.",
    "materials": "Google Sites project and rubric.",
    "fields": [
      {"id":"audience","type":"short-text","prompt":"Who is the audience?"},
      {"id":"message","type":"short-text","prompt":"What is the campaign message?"},
      {"id":"purpose","type":"long-text","prompt":"What should the homepage help visitors understand?"},
      {"id":"question","type":"short-text","prompt":"What question do you have for the next work session?"}
    ]
  },
  {
    "id": "grade8_formative_2026_05_w11_45_peer_testing_checklist",
    "title": "G8 Formative - May W11 45m - Portfolio Peer Testing Checklist",
    "class_slot": "May Week 11, 45-minute class",
    "description": "Students test navigation, readability, image visibility, links, and source credits with a partner.",
    "activity_type": "structured-response",
    "assessment_purpose": "formative",
    "estimated_minutes": 12,
    "template_id": "checklist",
    "teacher_note": "Use during testing and feedback.",
    "student_instructions": "Complete the peer testing checklist and name the fix that helped your audience most.",
    "student_output": "Portfolio peer testing checklist.",
    "materials": "Google Sites draft and partner checklist.",
    "fields": [
      {"id":"checks","type":"checklist","prompt":"Peer testing checklist", "items":[{"id":"navigation","text":"Navigation works."},{"id":"readability","text":"Text is readable."},{"id":"images","text":"Images and video are visible."},{"id":"links","text":"Links open correctly."},{"id":"credits","text":"Credits are present."}]},
      {"id":"best_fix","type":"long-text","prompt":"Which fix helped your audience most?"}
    ]
  },
  {
    "id": "grade8_formative_2026_05_w12_45_presentation_notes",
    "title": "G8 Formative - May W12 45m - Portfolio Presentation Notes",
    "class_slot": "May Week 12, 45-minute class",
    "description": "Students prepare speaking notes and one final detail to check before presenting.",
    "activity_type": "structured-response",
    "assessment_purpose": "formative",
    "estimated_minutes": 10,
    "template_id": "worksheet",
    "teacher_note": "Use during presentation setup.",
    "student_instructions": "Prepare speaking notes for your portfolio presentation.",
    "student_output": "Presentation notes.",
    "materials": "Google Sites portfolio and rubric.",
    "fields": [
      {"id":"notes","type":"long-text","prompt":"Write speaking notes for a 1:30-2 minute explanation."},
      {"id":"final_check","type":"short-text","prompt":"What final detail should you check before presenting?"}
    ]
  },
  {
    "id": "grade8_formative_2026_06_w1_45_arduino_board_label",
    "title": "G8 Formative - June W1 45m - Arduino Board and Breadboard Labeling",
    "class_slot": "June Week 1, 45-minute class",
    "description": "Students label a Freenove/Arduino board and breadboard diagram for practice.",
    "activity_type": "map-diagram",
    "assessment_purpose": "formative",
    "estimated_minutes": 18,
    "template_id": "labeled-map",
    "teacher_note": "Use during Arduino and Freenove kit introduction.",
    "student_instructions": "Label the board, breadboard, LED, resistor, jumper wires, button, USB cable, power, and ground.",
    "student_output": "Arduino board and breadboard labeling practice.",
    "materials": "Freenove kit and board diagram."
  },
  {
    "id": "grade8_formative_2026_06_w1_90_blink_troubleshooting_note",
    "title": "G8 Formative - June W1 90m - Blink Troubleshooting Note",
    "class_slot": "June Week 1, 90-minute class",
    "description": "Students record one LED Blink troubleshooting step they used or would use.",
    "activity_type": "structured-response",
    "assessment_purpose": "formative",
    "estimated_minutes": 8,
    "template_id": "reflection",
    "teacher_note": "Use after LED Blink circuit practice.",
    "student_instructions": "Record one troubleshooting step for LED Blink and why it helps.",
    "student_output": "Blink troubleshooting note.",
    "materials": "LED Blink circuit and code.",
    "fields": [
      {"id":"step","type":"long-text","prompt":"What troubleshooting step did you use or would use?"},
      {"id":"why","type":"short-text","prompt":"Why does this step help?"}
    ]
  },
  {
    "id": "grade8_formative_2026_06_w2_45_led_sequence_order",
    "title": "G8 Formative - June W2 45m - Flowing LED Sequence Order",
    "class_slot": "June Week 2, 45-minute class",
    "description": "Students order steps for a flowing LED pattern.",
    "activity_type": "card-sort",
    "assessment_purpose": "formative",
    "estimated_minutes": 12,
    "template_id": "sequence-sort",
    "teacher_note": "Use during flowing LED sequence.",
    "student_instructions": "Place the LED sequence steps in the correct order.",
    "student_output": "Completed LED sequence order.",
    "materials": "LED pattern notes.",
    "cards": [{"id":"setup_pins","text":"Set up output pins","expectedCategoryId":"correct_order","expectedOrder":1},{"id":"turn_first","text":"Turn first LED on","expectedCategoryId":"correct_order","expectedOrder":2},{"id":"delay","text":"Wait using delay","expectedCategoryId":"correct_order","expectedOrder":3},{"id":"turn_off","text":"Turn LED off","expectedCategoryId":"correct_order","expectedOrder":4},{"id":"next_led","text":"Repeat for the next LED","expectedCategoryId":"correct_order","expectedOrder":5}]
  },
  {
    "id": "grade8_formative_2026_06_w2_90_input_output_relationship",
    "title": "G8 Formative - June W2 90m - Button Input/Output Relationship",
    "class_slot": "June Week 2, 90-minute class",
    "description": "Students record how a button input changes an LED output.",
    "activity_type": "structured-response",
    "assessment_purpose": "formative",
    "estimated_minutes": 10,
    "template_id": "worksheet",
    "teacher_note": "Use after button and LED circuit testing.",
    "student_instructions": "Record the input/output relationship and explain input versus output.",
    "student_output": "Input/output relationship note.",
    "materials": "Button and LED circuit.",
    "fields": [
      {"id":"relationship","type":"long-text","prompt":"What happened when the button was pressed or released?"},
      {"id":"difference","type":"long-text","prompt":"Explain the difference between input and output."}
    ]
  },
  {
    "id": "grade8_formative_2026_06_w3_45_button_logic_trace",
    "title": "G8 Formative - June W3 45m - Button Logic Trace",
    "class_slot": "June Week 3, 45-minute class",
    "description": "Students trace button state changes and record one problem solved.",
    "activity_type": "structured-response",
    "assessment_purpose": "formative",
    "estimated_minutes": 12,
    "template_id": "worksheet",
    "teacher_note": "Use before the button-controlled LED daily grade.",
    "student_instructions": "Trace button state changes and record a solved problem.",
    "student_output": "Button logic trace.",
    "materials": "Button-controlled LED practice circuit.",
    "fields": [
      {"id":"trace","type":"table-grid","prompt":"Trace button states.", "rows":[{"id":"pressed","text":"Button pressed"},{"id":"released","text":"Button released"}], "columns":[{"id":"input","text":"Input state"},{"id":"output","text":"Expected LED output"}]},
      {"id":"problem","type":"short-text","prompt":"What problem did you solve?"}
    ]
  },
  {
    "id": "grade8_formative_2026_06_w3_90_serial_observations",
    "title": "G8 Formative - June W3 90m - Serial Monitor Observations",
    "class_slot": "June Week 3, 90-minute class",
    "description": "Students record three observations from the Serial Monitor and explain how serial messages help debugging.",
    "activity_type": "structured-response",
    "assessment_purpose": "formative",
    "estimated_minutes": 10,
    "template_id": "worksheet",
    "teacher_note": "Use after serial communication sketch practice.",
    "student_instructions": "Record three Serial Monitor observations and explain how they help debugging.",
    "student_output": "Serial Monitor observations.",
    "materials": "Serial communication sketch.",
    "fields": [
      {"id":"observations","type":"long-text","prompt":"Record three observations from the Serial Monitor."},
      {"id":"debugging","type":"long-text","prompt":"How do serial messages help debugging?"}
    ]
  },
  {
    "id": "grade8_formative_2026_06_w4_45_circuit_debugging_checklist",
    "title": "G8 Formative - June W4 45m - Circuit Debugging Checklist",
    "class_slot": "June Week 4, 45-minute class",
    "description": "Students debug a circuit using checks for power, ground, resistor, LED direction, pin number, code upload, and cable.",
    "activity_type": "structured-response",
    "assessment_purpose": "formative",
    "estimated_minutes": 12,
    "template_id": "checklist",
    "teacher_note": "Use during debugging circuits.",
    "student_instructions": "Use the checklist and add one debugging tip.",
    "student_output": "Circuit debugging checklist.",
    "materials": "Provided LED/button circuit with mistakes.",
    "fields": [
      {"id":"checks","type":"checklist","prompt":"Circuit debugging checks", "items":[{"id":"power","text":"Power is connected safely."},{"id":"ground","text":"Ground is connected."},{"id":"resistor","text":"Resistor is in the correct place."},{"id":"direction","text":"LED/component direction is correct."},{"id":"pin","text":"Pin number matches the code."},{"id":"upload","text":"Code was uploaded."}]},
      {"id":"tip","type":"short-text","prompt":"Write one debugging tip."}
    ]
  },
  {
    "id": "grade8_formative_2026_07_w5_45_digital_analog_sort",
    "title": "G8 Formative - July W5 45m - Digital or Analog Sort",
    "class_slot": "July Week 5, 45-minute class",
    "description": "Students sort examples into digital or analog signals.",
    "activity_type": "card-sort",
    "assessment_purpose": "formative",
    "estimated_minutes": 10,
    "template_id": "category-sort",
    "teacher_note": "Use during digital versus analog signals.",
    "student_instructions": "Sort each example as digital or analog.",
    "student_output": "Completed digital/analog sort.",
    "materials": "Signal examples.",
    "categories": [{"id":"digital","title":"Digital"},{"id":"analog","title":"Analog"}],
    "cards": [{"id":"button","text":"Button pressed or not pressed","expectedCategoryId":"digital"},{"id":"switch","text":"Switch on/off","expectedCategoryId":"digital"},{"id":"potentiometer","text":"Potentiometer knob value","expectedCategoryId":"analog"},{"id":"light_level","text":"Changing light level","expectedCategoryId":"analog"},{"id":"led_on","text":"LED on/off","expectedCategoryId":"digital"},{"id":"brightness","text":"Brightness level","expectedCategoryId":"analog"}]
  },
  {
    "id": "grade8_formative_2026_07_w6_45_light_threshold_readings",
    "title": "G8 Formative - July W6 45m - Light Threshold Readings",
    "class_slot": "July Week 6, 45-minute class",
    "description": "Students record light readings and choose a threshold for dim and bright conditions.",
    "activity_type": "spreadsheet-table",
    "assessment_purpose": "formative",
    "estimated_minutes": 18,
    "template_id": "data-table",
    "teacher_note": "Use during photoresistor and environmental input.",
    "student_instructions": "Record at least 4 light readings and choose a dim/bright threshold.",
    "student_output": "Light threshold readings table.",
    "materials": "Photoresistor circuit and Serial Monitor.",
    "columns": [{"id":"location","title":"Condition/Location","type":"text","width":160},{"id":"reading","title":"Reading","type":"number","width":110},{"id":"label","title":"Dim or Bright","type":"text","width":130},{"id":"note","title":"Note","type":"text","width":180}],
    "min_rows": 4,
    "max_rows": 10,
    "reflections": [{"id":"threshold","prompt":"Which threshold did you choose for dim/bright and why?", "required": true}]
  },
  {
    "id": "grade8_formative_2026_07_w6_90_rgb_values_table",
    "title": "G8 Formative - July W6 90m - RGB Values Table",
    "class_slot": "July Week 6, 90-minute class",
    "description": "Students record RGB combinations, color output, and one sensor-connected behavior idea.",
    "activity_type": "spreadsheet-table",
    "assessment_purpose": "formative",
    "estimated_minutes": 18,
    "template_id": "data-table",
    "teacher_note": "Use during RGB LED and color output.",
    "student_instructions": "Record at least 4 RGB combinations and the color each produced.",
    "student_output": "RGB values table.",
    "materials": "RGB LED circuit and code.",
    "columns": [{"id":"red","title":"Red","type":"number","width":90},{"id":"green","title":"Green","type":"number","width":90},{"id":"blue","title":"Blue","type":"number","width":90},{"id":"color","title":"Observed Color","type":"text","width":150}],
    "min_rows": 4,
    "max_rows": 10,
    "reflections": [{"id":"behavior","prompt":"How could a sensor value control one color behavior?", "required": true}]
  },
  {
    "id": "grade8_formative_2026_07_w7_45_buzzer_alert_plan",
    "title": "G8 Formative - July W7 45m - Buzzer Alert Plan",
    "class_slot": "July Week 7, 45-minute class",
    "description": "Students plan a useful alert system and the tone/timing values it could use.",
    "activity_type": "structured-response",
    "assessment_purpose": "formative",
    "estimated_minutes": 10,
    "template_id": "worksheet",
    "teacher_note": "Use during buzzer output.",
    "student_instructions": "Plan one useful alert system and the tone/timing pattern.",
    "student_output": "Buzzer alert plan.",
    "materials": "Buzzer code examples.",
    "fields": [
      {"id":"use","type":"long-text","prompt":"What useful alert system could use a buzzer?"},
      {"id":"pattern","type":"long-text","prompt":"What tone or timing pattern should the alert use?"}
    ]
  },
  {
    "id": "grade8_formative_2026_07_w8_45_if_else_sensor_flowchart",
    "title": "G8 Formative - July W8 45m - Sensor If/Else Flowchart",
    "class_slot": "July Week 8, 45-minute class",
    "description": "Students build a flowchart for a sensor threshold that changes an output.",
    "activity_type": "flowchart-algorithm",
    "assessment_purpose": "formative",
    "estimated_minutes": 18,
    "template_id": "sensor-response",
    "teacher_note": "Use during conditional logic with sensors.",
    "student_instructions": "Build a sensor-response flowchart using if/else, threshold, input, and output.",
    "student_output": "Sensor if/else flowchart.",
    "materials": "Sensor threshold notes."
  },
  {
    "id": "grade8_formative_2026_08_w9_45_ultrasonic_readings",
    "title": "G8 Formative - August W9 45m - Ultrasonic Distance Readings",
    "class_slot": "August Week 9, 45-minute class",
    "description": "Students record ultrasonic readings and identify one reliable near/far threshold.",
    "activity_type": "spreadsheet-table",
    "assessment_purpose": "formative",
    "estimated_minutes": 18,
    "template_id": "data-table",
    "teacher_note": "Use during ultrasonic sensing.",
    "student_instructions": "Record at least 5 distance readings and identify a near/far threshold.",
    "student_output": "Ultrasonic readings table.",
    "materials": "Ultrasonic sensor and ranging sketch.",
    "columns": [{"id":"test","title":"Test","type":"text","width":100},{"id":"distance","title":"Distance (cm)","type":"number","width":130},{"id":"near_far","title":"Near/Far","type":"text","width":110},{"id":"output_idea","title":"Output Idea","type":"text","width":170}],
    "min_rows": 5,
    "max_rows": 10,
    "reflections": [{"id":"project_idea","prompt":"What project idea could use distance sensing?", "required": true}]
  },
  {
    "id": "grade8_formative_2026_08_w10_45_first_test_note",
    "title": "G8 Formative - August W10 45m - Prototype First Test Note",
    "class_slot": "August Week 10, 45-minute class",
    "description": "Students record whether the first Arduino prototype test worked, partly worked, or did not work.",
    "activity_type": "structured-response",
    "assessment_purpose": "formative",
    "estimated_minutes": 8,
    "template_id": "worksheet",
    "teacher_note": "Use during exam project launch.",
    "student_instructions": "Record the first test status and what to fix next.",
    "student_output": "Prototype first test note.",
    "materials": "Arduino prototype.",
    "fields": [
      {"id":"status","type":"select","prompt":"What was the first test status?", "items":[{"id":"worked","text":"Worked"},{"id":"partly","text":"Partly worked"},{"id":"not","text":"Did not work"}]},
      {"id":"next","type":"long-text","prompt":"What needs to be fixed or checked next?"}
    ]
  },
  {
    "id": "grade8_formative_2026_08_w11_45_debug_cause_solution",
    "title": "G8 Formative - August W11 45m - Debug Cause and Solution",
    "class_slot": "August Week 11, 45-minute class",
    "description": "Students record one wiring, code, or design issue, likely cause, and solution.",
    "activity_type": "structured-response",
    "assessment_purpose": "formative",
    "estimated_minutes": 12,
    "template_id": "worksheet",
    "teacher_note": "Use during testing and debugging.",
    "student_instructions": "Record one problem, likely cause, and solution from prototype debugging.",
    "student_output": "Debug cause and solution note.",
    "materials": "Arduino prototype and debugging checklist.",
    "fields": [
      {"id":"problem","type":"long-text","prompt":"What problem did you find?"},
      {"id":"cause","type":"long-text","prompt":"What was the likely cause?"},
      {"id":"solution","type":"long-text","prompt":"What solution did you try?"}
    ]
  },
  {
    "id": "grade8_formative_2026_09_w1_45_app_task_breakdown",
    "title": "G8 Formative - September W1 45m - App Task Breakdown",
    "class_slot": "September Week 1, 45-minute class",
    "description": "Students decompose one app idea into smaller tasks and record one user question.",
    "activity_type": "structured-response",
    "assessment_purpose": "formative",
    "estimated_minutes": 15,
    "template_id": "worksheet",
    "teacher_note": "Use during decomposition and app purpose.",
    "student_instructions": "Break one app idea into at least 5 smaller tasks.",
    "student_output": "App decomposition note.",
    "materials": "App idea examples.",
    "fields": [
      {"id":"idea","type":"short-text","prompt":"What app idea are you decomposing?"},
      {"id":"tasks","type":"long-text","prompt":"List at least 5 smaller tasks."},
      {"id":"user_question","type":"short-text","prompt":"What question might a user ask?"}
    ]
  },
  {
    "id": "grade8_formative_2026_09_w1_90_wireframe_plan",
    "title": "G8 Formative - September W1 90m - Three-Screen Wireframe Plan",
    "class_slot": "September Week 1, 90-minute class",
    "description": "Students create a three-screen wireframe plan and note one usability improvement.",
    "activity_type": "map-diagram",
    "assessment_purpose": "formative",
    "estimated_minutes": 20,
    "template_id": "blank-map-diagram",
    "teacher_note": "Use after app vocabulary and interface planning.",
    "student_instructions": "Create a 3-screen wireframe and show how the screens connect.",
    "student_output": "Three-screen wireframe plan.",
    "materials": "App screen examples and planning notes."
  },
  {
    "id": "grade8_formative_2026_09_w2_45_event_flowchart",
    "title": "G8 Formative - September W2 45m - App Event Flowchart",
    "class_slot": "September Week 2, 45-minute class",
    "description": "Students build or trace a simple event map showing how a user moves between app screens.",
    "activity_type": "flowchart-algorithm",
    "assessment_purpose": "formative",
    "estimated_minutes": 18,
    "template_id": "sequence-algorithm",
    "teacher_note": "Use during events and screen flow.",
    "student_instructions": "Create an event flowchart with at least 4 events and screen changes.",
    "student_output": "App event flowchart.",
    "materials": "Event examples and app screen notes."
  },
  {
    "id": "grade8_formative_2026_09_w2_90_tappy_tap_bug_log",
    "title": "G8 Formative - September W2 90m - Tappy Tap Bug Log",
    "class_slot": "September Week 2, 90-minute class",
    "description": "Students record what worked, what failed, and what to fix next after modifying a simple app.",
    "activity_type": "structured-response",
    "assessment_purpose": "formative",
    "estimated_minutes": 10,
    "template_id": "worksheet",
    "teacher_note": "Use after Tappy Tap-style app practice.",
    "student_instructions": "Update the bug log with worked, failed, and next-fix notes.",
    "student_output": "Tappy Tap bug log.",
    "materials": "Guided app or project template.",
    "fields": [
      {"id":"worked","type":"long-text","prompt":"What worked?"},
      {"id":"failed","type":"long-text","prompt":"What failed or behaved differently?"},
      {"id":"fix","type":"short-text","prompt":"What should you fix next?"}
    ]
  },
  {
    "id": "grade8_formative_2026_09_w3_45_user_needs_chart",
    "title": "G8 Formative - September W3 45m - User Needs Chart",
    "class_slot": "September Week 3, 45-minute class",
    "description": "Students complete a chart for audience, problem, feature, and success criteria.",
    "activity_type": "structured-response",
    "assessment_purpose": "formative",
    "estimated_minutes": 15,
    "template_id": "worksheet",
    "teacher_note": "Use before the app plan and event map daily grade.",
    "student_instructions": "Complete the user-needs chart for your app idea.",
    "student_output": "User-needs chart.",
    "materials": "User scenarios and app idea notes.",
    "fields": [
      {"id":"needs_table","type":"table-grid","prompt":"Complete the user-needs chart.", "rows":[{"id":"user","text":"User/audience"},{"id":"problem","text":"Problem"},{"id":"feature","text":"Feature"},{"id":"success","text":"Success criteria"}], "columns":[{"id":"plan","text":"Your app idea"}]},
      {"id":"design_choice","type":"long-text","prompt":"How do user needs affect design choices?"}
    ]
  },
  {
    "id": "grade8_formative_2026_10_w4_45_python_algorithm_order",
    "title": "G8 Formative - October W4 45m - Python Routine Order",
    "class_slot": "October Week 4, 45-minute class",
    "description": "Students order a simple routine for opening a file, entering input, running a program, checking output, and saving work.",
    "activity_type": "card-sort",
    "assessment_purpose": "formative",
    "estimated_minutes": 10,
    "template_id": "sequence-sort",
    "teacher_note": "Use during algorithms and first Python output.",
    "student_instructions": "Place the Python work routine cards in order.",
    "student_output": "Completed Python routine sequence.",
    "materials": "Python vocabulary notes.",
    "cards": [{"id":"open","text":"Open file or editor","expectedCategoryId":"correct_order","expectedOrder":1},{"id":"enter","text":"Enter or edit code/input","expectedCategoryId":"correct_order","expectedOrder":2},{"id":"run","text":"Run program","expectedCategoryId":"correct_order","expectedOrder":3},{"id":"check","text":"Check output","expectedCategoryId":"correct_order","expectedOrder":4},{"id":"save","text":"Save work","expectedCategoryId":"correct_order","expectedOrder":5}]
  },
  {
    "id": "grade8_formative_2026_10_w4_90_variable_input_test_log",
    "title": "G8 Formative - October W4 90m - Variable Input Test Log",
    "class_slot": "October Week 4, 90-minute class",
    "description": "Students test a Python input program with at least 3 inputs and explain what a variable stores.",
    "activity_type": "structured-response",
    "assessment_purpose": "formative",
    "estimated_minutes": 12,
    "template_id": "worksheet",
    "teacher_note": "Use during variables and input.",
    "student_instructions": "Record three test inputs and explain what a variable stores.",
    "student_output": "Variable input test log.",
    "materials": "Python input program.",
    "fields": [
      {"id":"tests","type":"table-grid","prompt":"Record three test inputs.", "rows":[{"id":"test_1","text":"Test 1"},{"id":"test_2","text":"Test 2"},{"id":"test_3","text":"Test 3"}], "columns":[{"id":"input","text":"Input"},{"id":"output","text":"Output"}]},
      {"id":"variable","type":"long-text","prompt":"What does a variable store?"}
    ]
  },
  {
    "id": "grade8_formative_2026_10_w5_45_arithmetic_prediction",
    "title": "G8 Formative - October W5 45m - Arithmetic Prediction Check",
    "class_slot": "October Week 5, 45-minute class",
    "description": "Students predict results of arithmetic expressions and record one input conversion issue.",
    "activity_type": "structured-response",
    "assessment_purpose": "formative",
    "estimated_minutes": 12,
    "template_id": "worksheet",
    "teacher_note": "Use before the Python input/output daily grade.",
    "student_instructions": "Predict arithmetic results and record one issue you solved.",
    "student_output": "Arithmetic prediction check.",
    "materials": "Python arithmetic examples.",
    "fields": [
      {"id":"predictions","type":"long-text","prompt":"Predict the result of 5 arithmetic expressions."},
      {"id":"issue","type":"long-text","prompt":"What arithmetic or input conversion issue did you solve?"}
    ]
  },
  {
    "id": "grade8_formative_2026_10_w6_90_loop_trace",
    "title": "G8 Formative - October W6 90m - Loop Trace Table",
    "class_slot": "October Week 6, 90-minute class",
    "description": "Students trace a while loop and identify the counter, condition, update, and one long-loop bug risk.",
    "activity_type": "structured-response",
    "assessment_purpose": "formative",
    "estimated_minutes": 15,
    "template_id": "worksheet",
    "teacher_note": "Use during loops and counters.",
    "student_instructions": "Complete the loop trace and bug-risk prompts.",
    "student_output": "Loop trace table.",
    "materials": "Python loop example.",
    "fields": [
      {"id":"trace","type":"table-grid","prompt":"Trace the loop.", "rows":[{"id":"step_1","text":"Step 1"},{"id":"step_2","text":"Step 2"},{"id":"step_3","text":"Step 3"},{"id":"step_4","text":"Step 4"}], "columns":[{"id":"counter","text":"Counter value"},{"id":"condition","text":"Condition true/false"},{"id":"output","text":"Output/action"}]},
      {"id":"bug","type":"long-text","prompt":"What bug could cause a loop to run too long?"}
    ]
  },
  {
    "id": "grade8_formative_2026_10_w7_45_debug_strategy",
    "title": "G8 Formative - October W7 45m - Python Debugging Strategy",
    "class_slot": "October Week 7, 45-minute class",
    "description": "Students identify likely Python errors and compare one possible fix before the graded debugging check.",
    "activity_type": "structured-response",
    "assessment_purpose": "formative",
    "estimated_minutes": 12,
    "template_id": "worksheet",
    "teacher_note": "Use before Daily Grade #4.",
    "student_instructions": "Record likely errors, one fix, and the error type to watch next time.",
    "student_output": "Python debugging strategy.",
    "materials": "Python debugging examples.",
    "fields": [
      {"id":"errors","type":"long-text","prompt":"Which likely errors do you see?"},
      {"id":"fix","type":"long-text","prompt":"What possible fix did you compare with a partner?"},
      {"id":"watch","type":"short-text","prompt":"What error type will you watch for next time?"}
    ]
  },
  {
    "id": "grade8_formative_2026_10_w8_45_sensor_game_concept",
    "title": "G8 Formative - October W8 45m - Sensor-Controlled Game Concept",
    "class_slot": "October Week 8, 45-minute class",
    "description": "Students plan a sensor-controlled game with purpose, goal, Micro:bit input, sprite response, scoring, and challenge.",
    "activity_type": "structured-response",
    "assessment_purpose": "formative",
    "estimated_minutes": 18,
    "template_id": "worksheet",
    "teacher_note": "Use during sensor-controlled game planning.",
    "student_instructions": "Complete the game concept plan and record one partner suggestion.",
    "student_output": "Sensor-controlled game concept plan.",
    "materials": "Scratch + Micro:bit examples.",
    "fields": [
      {"id":"purpose","type":"short-text","prompt":"What is the game purpose?"},
      {"id":"goal","type":"short-text","prompt":"What is the player goal?"},
      {"id":"input","type":"short-text","prompt":"What Micro:bit input will control the game?"},
      {"id":"response","type":"long-text","prompt":"How will the sprite respond?"},
      {"id":"challenge","type":"long-text","prompt":"What scoring, success condition, or challenge will the game include?"},
      {"id":"suggestion","type":"short-text","prompt":"What suggestion did a partner give?"}
    ]
  },
  {
    "id": "grade8_formative_2026_11_w9_45_binary_practice",
    "title": "G8 Formative - November W9 45m - Binary Representation Practice",
    "class_slot": "November Week 9, 45-minute class",
    "description": "Students practice representation vocabulary, small binary conversions, and one question about data representation.",
    "activity_type": "structured-response",
    "assessment_purpose": "formative",
    "estimated_minutes": 15,
    "template_id": "worksheet",
    "teacher_note": "Use before the representation and binary daily grade.",
    "student_instructions": "Complete the binary practice prompts.",
    "student_output": "Binary representation practice.",
    "materials": "Binary and representation notes.",
    "fields": [
      {"id":"sort_examples","type":"long-text","prompt":"Sort examples into text, image, sound, number, symbol, or physical signal."},
      {"id":"conversion","type":"short-text","prompt":"Write one small binary/decimal conversion you checked."},
      {"id":"question","type":"short-text","prompt":"What question do you still have about binary or representation?"}
    ]
  },
  {
    "id": "grade8_formative_2026_11_w10_45_game_shell_launch",
    "title": "G8 Formative - November W10 45m - Game Shell Launch Note",
    "class_slot": "November Week 10, 45-minute class",
    "description": "Students record whether the Scratch + Micro:bit connection worked and what to fix next.",
    "activity_type": "structured-response",
    "assessment_purpose": "formative",
    "estimated_minutes": 8,
    "template_id": "worksheet",
    "teacher_note": "Use during exam project launch.",
    "student_instructions": "Record the game shell status and Micro:bit connection note.",
    "student_output": "Game shell launch note.",
    "materials": "Scratch + Micro:bit project.",
    "fields": [
      {"id":"status","type":"select","prompt":"Did the Micro:bit connection work?", "items":[{"id":"yes","text":"Yes"},{"id":"partly","text":"Partly"},{"id":"no","text":"No"}]},
      {"id":"fix","type":"long-text","prompt":"What needs to be fixed or built next?"}
    ]
  },
  {
    "id": "grade8_formative_2026_11_w11_45_user_testing_log",
    "title": "G8 Formative - November W11 45m - Game User Testing Log",
    "class_slot": "November Week 11, 45-minute class",
    "description": "Students record one control issue, one clarity issue, one positive feature, and one fix from peer testing.",
    "activity_type": "structured-response",
    "assessment_purpose": "formative",
    "estimated_minutes": 12,
    "template_id": "worksheet",
    "teacher_note": "Use during debugging and user testing.",
    "student_instructions": "Record peer testing feedback and one fix you made.",
    "student_output": "Game user testing log.",
    "materials": "Scratch + Micro:bit game and peer tester.",
    "fields": [
      {"id":"control","type":"long-text","prompt":"What control issue did the user find?"},
      {"id":"clarity","type":"long-text","prompt":"What clarity issue did the user find?"},
      {"id":"positive","type":"short-text","prompt":"What positive feature did the user notice?"},
      {"id":"fix","type":"long-text","prompt":"What issue did you fix?"}
    ]
  },
  {
    "id": "grade8_formative_2026_12_w13_90_final_reflection",
    "title": "G8 Formative - December W13 90m - Final Reflection and File Cleanup",
    "class_slot": "December Week 13, 90-minute class",
    "description": "Students reflect on strongest skill, biggest challenge, debugging strategy, and one improvement for future projects.",
    "activity_type": "structured-response",
    "assessment_purpose": "formative",
    "estimated_minutes": 12,
    "template_id": "reflection",
    "teacher_note": "Use only if December reflection or file cleanup is assigned.",
    "student_instructions": "Complete the final reflection and confirm files are organized.",
    "student_output": "Final trimester reflection.",
    "materials": "Project evidence, file list, and reflection notes.",
    "fields": [
      {"id":"strongest","type":"long-text","prompt":"What was your strongest skill this trimester?"},
      {"id":"challenge","type":"long-text","prompt":"What was your biggest challenge?"},
      {"id":"debugging","type":"long-text","prompt":"What debugging strategy helped you?"},
      {"id":"improvement","type":"short-text","prompt":"What is one improvement for future projects?"}
    ]
  }
]
$grade8_app_activities$::jsonb) as activity (
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
grade8_prepared_activities as (
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
    from grade8_raw_activities
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
    array['8'],
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
from grade8_prepared_activities
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
