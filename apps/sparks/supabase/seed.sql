-- Add teacher emails after linking or starting Supabase, for example:
-- insert into public.teacher_allowlist (email) values ('teacher@example.com');

-- Grade 6 formal classroom activity library records.
-- Word Hunt summatives stay in the vocabulary lane; these rows cover the non-Word-Hunt app activities.
with grade6_classroom_activities as (
    select *
    from jsonb_to_recordset($grade6_classroom_activities$
[
  {
    "id": "grade6_t1_summative_2_online_communication_scenarios",
    "title": "G6 T1 Summative 2 - Online Communication Scenarios",
    "description": "Students answer 8 online communication scenarios by choosing public/private, identifying the audience, deciding if permission is needed, and explaining the reason. Slot: March Week 4, 90-minute class.",
    "activity_type": "structured-response",
    "teacher_instructions": "Use this formal check after students practice public/private communication, audience, permission, and respectful online choices. Grade the choices, audience, permission decision, and reason for each scenario, plus the two short responses.",
    "student_instructions": "Read each situation carefully. Complete the table, then answer the two short-response questions using clear online safety vocabulary.",
    "materials": "Device, class notes about public/private communication, audience, permission, and respectful comments.",
    "estimated_minutes": 45,
    "student_output": "Completed scenario table and two short responses.",
    "makeup_instructions": "Complete the same scenario check independently using class notes. Submit before the next class if absent.",
    "assessment_purpose": "formal",
    "activity_data": {
      "templateId": "worksheet",
      "responseTemplate": {
        "version": 1,
        "templateId": "worksheet",
        "blocks": [
          {
            "id": "directions",
            "type": "instructions",
            "prompt": "For each situation, choose Public or Private, name the audience, decide if permission is needed, and write one reason.",
            "helperText": "Use the safest choice for the situation, not just the fastest choice."
          },
          {
            "id": "scenario_table",
            "type": "table-grid",
            "prompt": "Part A - Scenarios",
            "helperText": "Complete all 8 rows.",
            "required": true,
            "rows": [
              { "id": "s1", "text": "1. You want to post a classmate's funny photo from recess on a class site." },
              { "id": "s2", "text": "2. Your group needs to tell the teacher that your shared file will be late." },
              { "id": "s3", "text": "3. You found a useful website and want to share the link with your project group." },
              { "id": "s4", "text": "4. A student sends you their email password so you can help fix their account." },
              { "id": "s5", "text": "5. Your team wants to announce the final website link to the whole class." },
              { "id": "s6", "text": "6. You want to use a partner's drawing in your Google Sites page." },
              { "id": "s7", "text": "7. You need to ask one friend for their part of a group project." },
              { "id": "s8", "text": "8. You wrote a comment on a classmate's draft saying what is strong and what to improve." }
            ],
            "columns": [
              { "id": "choice", "text": "Public or private?" },
              { "id": "audience", "text": "Audience" },
              { "id": "permission", "text": "Permission yes/no?" },
              { "id": "reason", "text": "Reason" }
            ]
          },
          {
            "id": "respectful_safe_details",
            "type": "long-text",
            "prompt": "Explain two details that make an online message respectful and safe.",
            "helperText": "Name two details and explain why they matter.",
            "required": true
          },
          {
            "id": "publish_check",
            "type": "long-text",
            "prompt": "A group wants to publish a class website. What should they check before sharing it with others?",
            "helperText": "Name two checks and explain why they matter.",
            "required": true
          }
        ]
      }
    }
  },
  {
    "id": "grade6_t1_summative_3_copyright_image_choice",
    "title": "G6 T1 Summative 3 - Copyright Image-Choice Check",
    "description": "Students choose the safest image for a class web page and justify source, permission, credit, and topic fit decisions. Slot: April Week 1, 90-minute class.",
    "activity_type": "structured-response",
    "teacher_instructions": "Use this formal check after copyright-friendly image practice. Grade safe-use decision, source reasoning, topic fit, and the credit line.",
    "student_instructions": "Read the image options. Choose the safest image for a class web page about saving water at school and explain your decisions.",
    "materials": "Device and class notes about copyright, source, permission, credit line, and topic fit.",
    "estimated_minutes": 45,
    "student_output": "Completed image-choice check with safe-use decisions and explanations.",
    "makeup_instructions": "Complete the same image-choice check independently using class notes.",
    "assessment_purpose": "formal",
    "activity_data": {
      "templateId": "worksheet",
      "responseTemplate": {
        "version": 1,
        "templateId": "worksheet",
        "blocks": [
          {
            "id": "image_options",
            "type": "instructions",
            "prompt": "Image options for a class web page about saving water at school.",
            "helperText": "A: A photo copied from a random social media post. No author listed. No permission information. | B: A simple water-drop icon from a copyright-friendly classroom image site. Author: Green Icons. License says free for school use with credit. | C: A professional photo from a news article. Author listed, but page says all rights reserved. | D: A student drawing made by another classmate. Classmate says it can be used if their name is included."
          },
          {
            "id": "safest_choice",
            "type": "multiple-choice",
            "prompt": "Which image is the safest choice for the web page?",
            "helperText": "Choose one option.",
            "required": true,
            "items": [
              { "id": "a", "text": "A - Random social media photo with no author or permission information" },
              { "id": "b", "text": "B - Water-drop icon from a classroom-safe image site with credit required" },
              { "id": "c", "text": "C - News article photo marked all rights reserved" },
              { "id": "d", "text": "D - Classmate drawing allowed only if the classmate's name is included" }
            ]
          },
          {
            "id": "safest_reason",
            "type": "long-text",
            "prompt": "Explain why your chosen image is the safest choice.",
            "required": true
          },
          {
            "id": "not_safe",
            "type": "long-text",
            "prompt": "Which image is not safe to use? Explain the problem.",
            "required": true
          },
          {
            "id": "permission_or_credit",
            "type": "long-text",
            "prompt": "Which image could be used only after permission or credit? Explain.",
            "required": true
          },
          {
            "id": "credit_line",
            "type": "short-text",
            "prompt": "Write a credit line for the image you chose.",
            "required": true
          },
          {
            "id": "topic_fit",
            "type": "long-text",
            "prompt": "Explain how your chosen image fits the topic of saving water at school. Give two reasons.",
            "required": true
          },
          {
            "id": "caption",
            "type": "short-text",
            "prompt": "What words, title, or caption would you place near the image so the audience understands the message?",
            "required": true
          },
          {
            "id": "two_checks",
            "type": "long-text",
            "prompt": "Name two things students should check before using an image in a school project.",
            "required": true
          },
          {
            "id": "can_use_because",
            "type": "long-text",
            "prompt": "Complete this sentence: I can use this image because...",
            "required": true
          },
          {
            "id": "should_not_use_when",
            "type": "long-text",
            "prompt": "Complete this sentence: I should not use an image when...",
            "required": true
          }
        ]
      }
    }
  },
  {
    "id": "grade6_t1_summative_4_scratch_score_task",
    "title": "G6 T1 Summative 4 - Scratch Score Task Classroom Check",
    "description": "Students confirm their Scratch score task was sent through Classroom, then explain the score variable, sprite actions, and one test or fix. Slot: April Week 4, 90-minute class.",
    "activity_type": "structured-response",
    "teacher_instructions": "Grade the Scratch project evidence from Classroom. Use this in-app check only to confirm submission, capture the readiness checklist, and collect the short explanation.",
    "student_instructions": "Send your Scratch project evidence in Classroom. Then complete this in-app check to confirm your submission and explain how your score task works.",
    "materials": "Scratch project, device, and Classroom assignment.",
    "estimated_minutes": 45,
    "student_output": "Classroom submission confirmation, Scratch readiness checklist, and score-task explanation.",
    "makeup_instructions": "Finish the Scratch score task, send the required evidence in Classroom, and complete this in-app check independently.",
    "assessment_purpose": "formal",
    "activity_data": {
      "templateId": "worksheet",
      "responseTemplate": {
        "version": 1,
        "templateId": "worksheet",
        "blocks": [
          {
            "id": "classroom_directions",
            "type": "instructions",
            "prompt": "Your Scratch project evidence must be sent in Classroom.",
            "helperText": "This app check does not collect the Scratch file, screenshot, or link."
          },
          {
            "id": "classroom_status",
            "type": "select",
            "prompt": "What is your Classroom submission status?",
            "required": true,
            "items": [
              { "id": "submitted_classroom", "text": "I sent the Scratch evidence in Classroom." },
              { "id": "teacher_checked", "text": "My teacher checked the Scratch project during class." },
              { "id": "need_help", "text": "I still need help sending the evidence in Classroom." }
            ]
          },
          {
            "id": "scratch_checklist",
            "type": "checklist",
            "prompt": "Scratch score-task checklist",
            "helperText": "Use this to check your Classroom evidence before submitting.",
            "required": false,
            "items": [
              { "id": "one_variable", "text": "My Scratch task has one score variable." },
              { "id": "two_sprites", "text": "My task has two clickable sprites." },
              { "id": "different_amounts", "text": "The two sprites change the score by different amounts." },
              { "id": "tested_fixed", "text": "I tested the task and fixed or explained one problem." }
            ]
          },
          {
            "id": "sprite_effects",
            "type": "long-text",
            "prompt": "What does each sprite do to the score?",
            "required": true
          },
          {
            "id": "debug_step",
            "type": "short-text",
            "prompt": "What problem did you test, fix, or explain?",
            "required": true
          }
        ]
      }
    }
  },
  {
    "id": "grade6_t1_summative_5_recycling_ewaste_sorting",
    "title": "G6 T1 Summative 5 - Recycling and E-Waste Sorting Check",
    "description": "Students sort 10 technology-waste item cards into reuse, repair, recycle, or e-waste. Slot: May Week 2, 90-minute class.",
    "activity_type": "card-sort",
    "teacher_instructions": "Use this formal card sort after students practice reuse, repair, recycle, and e-waste decisions. Review misplaced cards and ask students to explain two choices orally or in class notes when needed.",
    "student_instructions": "Move each technology-waste card into the best category: reuse, repair, recycle, or e-waste.",
    "materials": "Device and class notes about reuse, repair, recycle, e-waste, batteries, and responsible disposal.",
    "estimated_minutes": 45,
    "student_output": "Completed technology-waste card sort.",
    "makeup_instructions": "Complete the card sort independently using class notes.",
    "assessment_purpose": "formal",
    "activity_data": {
      "templateId": "category-sort",
      "cardSortTemplate": {
        "version": 1,
        "templateId": "category-sort",
        "prompt": "Sort each technology-waste item into the best responsible category.",
        "helperText": "Use the condition of the item to decide. Place every card before submitting.",
        "requireAllCards": true,
        "orderMode": "none",
        "categories": [
          { "id": "reuse", "title": "Reuse", "helperText": "Still works and can be used again." },
          { "id": "repair", "title": "Repair", "helperText": "Could be fixed safely before reuse." },
          { "id": "recycle", "title": "Recycle", "helperText": "Common recyclable material, not electronic waste." },
          { "id": "ewaste", "title": "E-Waste", "helperText": "Electronic waste or unsafe electronic part that needs special handling." }
        ],
        "cards": [
          { "id": "working_keyboard", "text": "Working keyboard the classroom no longer needs", "helperText": "It still works.", "expectedCategoryId": "reuse", "expectedOrder": 1 },
          { "id": "broken_phone_battery", "text": "Broken phone battery that cannot be used safely", "helperText": "Batteries need special handling.", "expectedCategoryId": "ewaste", "expectedOrder": 1 },
          { "id": "monitor_cardboard_box", "text": "Clean cardboard box from a new monitor", "helperText": "Packaging material, not an electronic part.", "expectedCategoryId": "recycle", "expectedOrder": 1 },
          { "id": "slow_laptop", "text": "Old laptop that turns on but needs cleanup or a small fix", "helperText": "It may work better after repair.", "expectedCategoryId": "repair", "expectedOrder": 1 },
          { "id": "cracked_tablet_screen", "text": "Tablet with a cracked screen that can be replaced", "helperText": "One damaged part can be fixed.", "expectedCategoryId": "repair", "expectedOrder": 2 },
          { "id": "one_sided_paper", "text": "Printer paper with one blank side", "helperText": "It can be used again before recycling.", "expectedCategoryId": "reuse", "expectedOrder": 2 },
          { "id": "unsafe_headphones", "text": "Broken headphones with exposed wire", "helperText": "Unsafe small electronic accessory.", "expectedCategoryId": "ewaste", "expectedOrder": 2 },
          { "id": "plastic_bottle", "text": "Plastic bottle from the computer lab", "helperText": "Regular recyclable material.", "expectedCategoryId": "recycle", "expectedOrder": 2 },
          { "id": "working_charger", "text": "Old charger that still works safely", "helperText": "It can still be used.", "expectedCategoryId": "reuse", "expectedOrder": 3 },
          { "id": "damaged_circuit_board", "text": "Damaged circuit board from a device", "helperText": "Electronic part that needs special handling.", "expectedCategoryId": "ewaste", "expectedOrder": 3 }
        ]
      }
    }
  },
  {
    "id": "grade6_t2_summative_2_mbot_movement_debugging",
    "title": "G6 T2 Summative 2 - mBot Movement Debugging Check",
    "description": "Students debug 3 simple mBot movement sequences, write corrections, explain one correction, and describe safe testing. Slot: June Week 3, 90-minute class.",
    "activity_type": "structured-response",
    "teacher_instructions": "Use this formal check after students practice mBot movement, sequence, speed, time, turn, stop, and debugging.",
    "student_instructions": "Read each goal and program. Find the mistake, write the correction, and explain how the correction changes movement.",
    "materials": "Device and class notes about mBot movement commands and safe testing.",
    "estimated_minutes": 45,
    "student_output": "Completed debugging table, best-fix answer, and testing plan.",
    "makeup_instructions": "Complete the debugging check independently using class notes.",
    "assessment_purpose": "formal",
    "activity_data": {
      "templateId": "worksheet",
      "responseTemplate": {
        "version": 1,
        "templateId": "worksheet",
        "blocks": [
          {
            "id": "debug_table",
            "type": "table-grid",
            "prompt": "Part A - Debug the movement sequences.",
            "helperText": "For each row, compare the goal with the program.",
            "required": true,
            "rows": [
              { "id": "sequence_1", "text": "Sequence 1: Goal: Move forward, stop, turn right, then stop. Program: move forward 2 sec -> turn left 1 sec -> stop." },
              { "id": "sequence_2", "text": "Sequence 2: Goal: Move in a small square. Program: forward 1 sec -> right turn -> forward 1 sec -> right turn -> stop." },
              { "id": "sequence_3", "text": "Sequence 3: Goal: Move slowly to a marker and stop. Program: speed 100 -> forward 5 sec -> stop." }
            ],
            "columns": [
              { "id": "mistake", "text": "Mistake" },
              { "id": "correction", "text": "Correction" },
              { "id": "explanation", "text": "Explanation" }
            ]
          },
          {
            "id": "dangerous_sequence",
            "type": "long-text",
            "prompt": "Which sequence would be most dangerous or most likely to crash into something? Explain why.",
            "required": true
          },
          {
            "id": "testing_plan",
            "type": "long-text",
            "prompt": "Write two steps you would use to test a corrected mBot movement program safely.",
            "required": true
          }
        ]
      }
    }
  },
  {
    "id": "grade6_t2_summative_3_mbot_route_map_command_plan",
    "title": "G6 T2 Summative 3 - mBot Route Map and Command Plan",
    "description": "Students draw an mBot route map with at least 4 movement steps and label the command sequence, turns, and stop points. Slot: July Week 5, 90-minute class.",
    "activity_type": "map-diagram",
    "teacher_instructions": "Use this formal route-planning task after students practice route prediction and command order. Remind students to include start, finish, at least 4 movement steps, labeled turns or stop points, and a realistic command sequence.",
    "student_instructions": "Draw your route map. Add a start, finish, at least 4 movement steps, your command sequence, and labels for each turn or stop point.",
    "materials": "Device, mBot route notes, class route examples, and test-area reference if available.",
    "estimated_minutes": 45,
    "student_output": "Route map with command sequence and labeled turns or stop points.",
    "makeup_instructions": "Create the route map independently using class notes. Include all required labels before submitting.",
    "assessment_purpose": "formal",
    "activity_data": {
      "templateId": "process-diagram",
      "excalidrawScene": null
    }
  },
  {
    "id": "grade6_t2_summative_4_mbot_sensor_condition_flowchart",
    "title": "G6 T2 Summative 4 - mBot Sensor Condition Flowchart",
    "description": "Students create an if/then flowchart with one mBot sensor condition, one true response, one false response, and one explanation sentence. Slot: July Week 8, 90-minute class.",
    "activity_type": "flowchart-algorithm",
    "teacher_instructions": "Use this formal flowchart task after students practice sensors, input, response, true/false, and if/then thinking.",
    "student_instructions": "Build an if/then flowchart for an mBot sensor behavior. Include one sensor condition, one true response, one false response, and an explanation.",
    "materials": "Device, mBot sensor notes, flowchart examples, and class condition examples.",
    "estimated_minutes": 45,
    "student_output": "Completed mBot sensor if/then flowchart with checklist and explanation.",
    "makeup_instructions": "Build the flowchart independently using class notes and explain the robot behavior.",
    "assessment_purpose": "formal",
    "activity_data": {
      "templateId": "sensor-response",
      "flowchartTemplate": {
        "version": 1,
        "templateId": "sensor-response",
        "prompt": "Create an mBot if/then flowchart with one sensor condition.",
        "helperText": "Show the sensor input, the condition, what happens when it is true, and what happens when it is false.",
        "allowedNodeTypes": ["start", "input", "condition", "process", "output", "end"],
        "requiredNodeTypes": ["start", "input", "condition", "output", "end"],
        "requireConditionBranches": true,
        "minNodes": 5,
        "minEdges": 4,
        "starterNodes": [
          { "id": "start", "type": "start", "label": "Start", "description": "", "position": { "x": 180, "y": 30 } },
          { "id": "sensor", "type": "input", "label": "Read mBot sensor", "description": "", "position": { "x": 180, "y": 150 } },
          { "id": "condition", "type": "condition", "label": "Condition?", "description": "", "position": { "x": 180, "y": 270 } },
          { "id": "true_response", "type": "output", "label": "True response", "description": "", "position": { "x": 20, "y": 400 } },
          { "id": "false_response", "type": "output", "label": "False response", "description": "", "position": { "x": 340, "y": 400 } },
          { "id": "end", "type": "end", "label": "End", "description": "", "position": { "x": 180, "y": 530 } }
        ],
        "starterEdges": [
          { "id": "edge_start_sensor", "source": "start", "target": "sensor", "label": "" },
          { "id": "edge_sensor_condition", "source": "sensor", "target": "condition", "label": "" },
          { "id": "edge_condition_true", "source": "condition", "target": "true_response", "label": "True" },
          { "id": "edge_condition_false", "source": "condition", "target": "false_response", "label": "False" },
          { "id": "edge_true_end", "source": "true_response", "target": "end", "label": "" },
          { "id": "edge_false_end", "source": "false_response", "target": "end", "label": "" }
        ],
        "checklistItems": [
          { "id": "sensor_condition", "text": "My flowchart includes one clear mBot sensor condition.", "required": true },
          { "id": "true_false", "text": "My flowchart has true and false responses.", "required": true },
          { "id": "arrows_labels", "text": "My arrows and labels are clear.", "required": true }
        ],
        "reflectionPrompts": [
          { "id": "robot_behavior", "prompt": "Explain the robot behavior in one sentence.", "required": true }
        ]
      }
    }
  },
  {
    "id": "grade6_t2_summative_5_mbot_stem_challenge_demo",
    "title": "G6 T2 Summative 5 - mBot STEM Challenge Classroom Check",
    "description": "Students confirm their mBot STEM challenge evidence or demonstration was handled through Classroom or teacher observation, then explain goal, behavior, test result, and one improvement. Slot: August Week 12, 90-minute class.",
    "activity_type": "structured-response",
    "teacher_instructions": "Grade the mBot challenge evidence, demonstration, code screenshots, or route/test data from Classroom and class observation. Use this in-app check only for confirmation, readiness, and student explanation.",
    "student_instructions": "Send your mBot challenge evidence in Classroom or complete the teacher-observed demonstration as instructed. Then complete this in-app check.",
    "materials": "mBot, mBlock or code screenshot, route/test data, challenge sheet, readiness checklist, and Classroom assignment.",
    "estimated_minutes": 45,
    "student_output": "Classroom/demo confirmation, readiness checklist, and mBot explanation.",
    "makeup_instructions": "Send saved code/screenshot evidence in Classroom or arrange the teacher-observed make-up demonstration, then complete this in-app check independently.",
    "assessment_purpose": "formal",
    "activity_data": {
      "templateId": "worksheet",
      "responseTemplate": {
        "version": 1,
        "templateId": "worksheet",
        "blocks": [
          {
            "id": "classroom_directions",
            "type": "instructions",
            "prompt": "Your mBot challenge evidence is handled in Classroom or by teacher observation.",
            "helperText": "This app check does not collect code files, screenshots, routes, or videos."
          },
          {
            "id": "classroom_status",
            "type": "select",
            "prompt": "How was your mBot evidence or demonstration submitted?",
            "required": true,
            "items": [
              { "id": "submitted_classroom", "text": "I sent the evidence in Classroom." },
              { "id": "teacher_observed", "text": "My teacher observed the demonstration in class." },
              { "id": "need_makeup", "text": "I need a make-up submission or demonstration." }
            ]
          },
          {
            "id": "mbot_readiness",
            "type": "checklist",
            "prompt": "mBot challenge readiness checklist",
            "helperText": "Use this to check your work before the grade is finalized.",
            "required": false,
            "items": [
              { "id": "goal", "text": "I can explain the challenge goal." },
              { "id": "behavior", "text": "My Classroom evidence or demo shows the route or robot behavior." },
              { "id": "robot_action", "text": "I named the main robot action." },
              { "id": "output_sensor", "text": "I included one output or sensor." },
              { "id": "test_result", "text": "I recorded a test result." },
              { "id": "readiness", "text": "My kit, battery, challenge sheet, route/test data, and notes are ready." }
            ]
          },
          {
            "id": "improvement",
            "type": "long-text",
            "prompt": "What was one problem and one improvement from testing?",
            "required": true
          },
          {
            "id": "explain_behavior",
            "type": "long-text",
            "prompt": "Explain what your robot did during the demonstration.",
            "required": true
          }
        ]
      }
    }
  },
  {
    "id": "grade6_t3_summative_1_mbot_stem_data_table",
    "title": "G6 T3 Summative 1 - mBot STEM Data Table",
    "description": "Students create a clean mBot STEM data table with at least 6 records, headers, units/categories, readable formatting, and one data sentence. Slot: September Week 2, 90-minute class.",
    "activity_type": "spreadsheet-table",
    "teacher_instructions": "Use this formal spreadsheet activity after students collect or receive mBot STEM challenge data. Check for at least 6 records, clear headers, categories or units, readable formatting, and one accurate data sentence.",
    "student_instructions": "Complete the mBot STEM data table with at least 6 records. Keep the headers clear and write one sentence explaining what the data shows.",
    "materials": "mBot STEM challenge results, data collection sheet or teacher data cards.",
    "estimated_minutes": 45,
    "student_output": "Completed data table with at least 6 records and one data sentence.",
    "makeup_instructions": "Use teacher-provided data cards to complete the table and data sentence.",
    "assessment_purpose": "formal",
    "activity_data": {
      "templateId": "data-table",
      "spreadsheetTemplate": {
        "version": 1,
        "templateId": "data-table",
        "columns": [
          { "id": "team", "title": "Team", "type": "text", "width": 120 },
          { "id": "challenge_type", "title": "Challenge Type", "type": "text", "width": 160 },
          { "id": "attempt", "title": "Attempt", "type": "number", "width": 100 },
          { "id": "time_seconds", "title": "Time (sec)", "type": "number", "width": 110 },
          { "id": "success", "title": "Success?", "type": "text", "width": 110 },
          { "id": "output_sensor", "title": "Output/Sensor Used", "type": "text", "width": 170 },
          { "id": "improvement", "title": "Improvement", "type": "text", "width": 180 }
        ],
        "seedData": [
          ["", "", "", "", "", "", ""],
          ["", "", "", "", "", "", ""],
          ["", "", "", "", "", "", ""],
          ["", "", "", "", "", "", ""],
          ["", "", "", "", "", "", ""],
          ["", "", "", "", "", "", ""]
        ],
        "minRows": 6,
        "maxRows": 12,
        "allowAddRows": true,
        "chart": { "enabled": false, "type": "bar", "labelColumnId": "team", "valueColumnId": "time_seconds" },
        "reflectionPrompts": [
          { "id": "data_sentence", "prompt": "Write one sentence explaining what the data shows.", "required": true },
          { "id": "formatting", "prompt": "How did readable formatting help someone understand your table?", "required": true }
        ]
      }
    }
  },
  {
    "id": "grade6_t3_summative_2_mbot_data_chart_conclusion",
    "title": "G6 T3 Summative 2 - mBot Data Chart and Conclusion",
    "description": "Students create one chart from the mBot STEM data set, add a title and labels, answer 3 chart questions, and write one conclusion sentence. Slot: October Week 1, 90-minute class.",
    "activity_type": "spreadsheet-table",
    "teacher_instructions": "Use this formal chart task after students complete or receive the mBot STEM data set. Check chart accuracy, title/labels, three evidence-based answers, and conclusion.",
    "student_instructions": "Enter chart data, generate one chart, answer the three chart questions, and write one conclusion sentence.",
    "materials": "mBot STEM data set, spreadsheet notes, chart examples.",
    "estimated_minutes": 45,
    "student_output": "Completed chart table, generated chart, three answers, and conclusion.",
    "makeup_instructions": "Use the provided data set to complete the chart and written responses.",
    "assessment_purpose": "formal",
    "activity_data": {
      "templateId": "chart-from-table",
      "spreadsheetTemplate": {
        "version": 1,
        "templateId": "chart-from-table",
        "columns": [
          { "id": "category", "title": "Chart Category", "type": "text", "width": 180 },
          { "id": "value", "title": "Value", "type": "number", "width": 120 }
        ],
        "seedData": [
          ["", ""],
          ["", ""],
          ["", ""],
          ["", ""]
        ],
        "minRows": 3,
        "maxRows": 10,
        "allowAddRows": true,
        "chart": { "enabled": true, "type": "bar", "labelColumnId": "category", "valueColumnId": "value" },
        "reflectionPrompts": [
          { "id": "highest_value", "prompt": "Which chart category has the highest value? Include the value from your chart.", "required": true },
          { "id": "lowest_value", "prompt": "Which chart category has the lowest value, and what does that show?", "required": true },
          { "id": "category_comparison", "prompt": "Compare two chart categories. What is different or similar about them?", "required": true },
          { "id": "conclusion", "prompt": "Write one conclusion sentence that explains what the chart shows.", "required": true }
        ]
      }
    }
  },
  {
    "id": "grade6_t3_summative_3_3d_model_design_plan",
    "title": "G6 T3 Summative 3 - 3D Model Design Classroom Check",
    "description": "Students confirm their 3D model design evidence was sent through Classroom, then explain labeled shapes, model purpose, and one planned improvement. Slot: October Week 4, 90-minute class.",
    "activity_type": "structured-response",
    "teacher_instructions": "Grade the 3D model sketch, screenshot, or design evidence from Classroom. Use this in-app check only for confirmation, checklist review, and student explanation.",
    "student_instructions": "Send your 3D model design evidence in Classroom. Then complete this in-app check to confirm your submission and explain your design.",
    "materials": "3D modelling tool, sketch/design plan, screenshot or PDF evidence, and Classroom assignment.",
    "estimated_minutes": 45,
    "student_output": "Classroom submission confirmation, 3D design checklist, and design explanation.",
    "makeup_instructions": "Send the required 3D model evidence in Classroom, then complete this in-app check independently.",
    "assessment_purpose": "formal",
    "activity_data": {
      "templateId": "worksheet",
      "responseTemplate": {
        "version": 1,
        "templateId": "worksheet",
        "blocks": [
          {
            "id": "classroom_directions",
            "type": "instructions",
            "prompt": "Your 3D model design evidence must be sent in Classroom.",
            "helperText": "This app check does not collect the sketch, screenshot, PDF, or model link."
          },
          {
            "id": "classroom_status",
            "type": "select",
            "prompt": "What is your Classroom submission status?",
            "required": true,
            "items": [
              { "id": "submitted_classroom", "text": "I sent the 3D design evidence in Classroom." },
              { "id": "teacher_checked", "text": "My teacher checked the design evidence during class." },
              { "id": "need_help", "text": "I still need help sending the evidence in Classroom." }
            ]
          },
          {
            "id": "design_checklist",
            "type": "checklist",
            "prompt": "3D design evidence checklist",
            "helperText": "Use this to check your Classroom evidence before submitting.",
            "required": false,
            "items": [
              { "id": "sketch", "text": "My Classroom evidence includes a clear sketch or model view." },
              { "id": "three_shapes", "text": "I labeled at least 3 shapes." },
              { "id": "purpose", "text": "I included the purpose of the model." },
              { "id": "improvement", "text": "I included one planned improvement." }
            ]
          },
          {
            "id": "model_purpose",
            "type": "long-text",
            "prompt": "What is the purpose of your model?",
            "required": true
          },
          {
            "id": "planned_improvement",
            "type": "long-text",
            "prompt": "What is one planned improvement and why?",
            "required": true
          }
        ]
      }
    }
  },
  {
    "id": "grade6_t3_summative_4_microbit_parts_input_output",
    "title": "G6 T3 Summative 4 - micro:bit Parts and Input/Output Sort",
    "description": "Students sort micro:bit part clues and examples into the correct part, input, or output categories. Slot: November Week 2, 90-minute class.",
    "activity_type": "card-sort",
    "teacher_instructions": "Use this formal card sort after students practice micro:bit parts, input, output, LED display, buttons, sensors, and variables. Review misplaced cards and ask follow-up questions if a student confuses parts with input/output behavior.",
    "student_instructions": "Move each card into the correct micro:bit part, input, or output category.",
    "materials": "Device, class notes, micro:bit reference image or physical micro:bit.",
    "estimated_minutes": 45,
    "student_output": "Completed micro:bit parts and input/output card sort.",
    "makeup_instructions": "Complete the card sort independently using class notes and a micro:bit reference image.",
    "assessment_purpose": "formal",
    "activity_data": {
      "templateId": "category-sort",
      "cardSortTemplate": {
        "version": 1,
        "templateId": "category-sort",
        "prompt": "Sort each micro:bit card into the correct part, input, or output category.",
        "helperText": "Some cards are physical part clues. Other cards describe actions or program behavior.",
        "requireAllCards": true,
        "orderMode": "none",
        "categories": [
          { "id": "led_display", "title": "LED Display", "helperText": "The 5x5 light grid." },
          { "id": "button_a", "title": "Button A", "helperText": "The left front button." },
          { "id": "button_b", "title": "Button B", "helperText": "The right front button." },
          { "id": "usb_port", "title": "USB Port", "helperText": "The cable connector for power and programming." },
          { "id": "battery_connector", "title": "Battery Connector", "helperText": "The connector for the external battery pack." },
          { "id": "input", "title": "Input", "helperText": "Information or action going into the program." },
          { "id": "output", "title": "Output", "helperText": "What the device shows, plays, or does." }
        ],
        "cards": [
          { "id": "part_led_grid", "text": "5x5 light grid in the center that shows icons, numbers, or text", "expectedCategoryId": "led_display", "expectedOrder": 1 },
          { "id": "part_left_a", "text": "Front button on the left marked A", "expectedCategoryId": "button_a", "expectedOrder": 1 },
          { "id": "part_right_b", "text": "Front button on the right marked B", "expectedCategoryId": "button_b", "expectedOrder": 1 },
          { "id": "part_usb", "text": "Top cable connector used for power and programming", "expectedCategoryId": "usb_port", "expectedOrder": 1 },
          { "id": "part_battery", "text": "Back connector used for the external battery pack", "expectedCategoryId": "battery_connector", "expectedOrder": 1 },
          { "id": "press_button_a", "text": "Pressing Button A", "expectedCategoryId": "input", "expectedOrder": 1 },
          { "id": "show_heart", "text": "Showing a heart icon", "expectedCategoryId": "output", "expectedOrder": 1 },
          { "id": "light_sensor_reading", "text": "Light sensor reading", "expectedCategoryId": "input", "expectedOrder": 2 },
          { "id": "speaker_sound", "text": "Playing a sound on a connected speaker", "expectedCategoryId": "output", "expectedOrder": 2 },
          { "id": "temperature_reading", "text": "Temperature reading", "expectedCategoryId": "input", "expectedOrder": 3 },
          { "id": "show_number", "text": "Showing a number on the LEDs", "expectedCategoryId": "output", "expectedOrder": 3 },
          { "id": "shake_microbit", "text": "Shaking the micro:bit", "expectedCategoryId": "input", "expectedOrder": 4 },
          { "id": "radio_received", "text": "Radio message received from another micro:bit", "expectedCategoryId": "input", "expectedOrder": 5 }
        ]
      }
    }
  },
  {
    "id": "grade6_t3_summative_5_microbit_sensor_condition_flowchart",
    "title": "G6 T3 Summative 5 - micro:bit Sensor Condition Flowchart",
    "description": "Students create an if/then flowchart with one micro:bit light or temperature condition, one true output, one false output, and one explanation sentence. Slot: December Week 1, 90-minute class.",
    "activity_type": "flowchart-algorithm",
    "teacher_instructions": "Use this formal flowchart task after students practice micro:bit sensors, conditions, if/then logic, true/false outputs, and explanations.",
    "student_instructions": "Build an if/then flowchart for a micro:bit light or temperature condition. Include a true output, a false output, and one explanation sentence.",
    "materials": "Device, micro:bit sensor notes, flowchart examples, and MakeCode reference if needed.",
    "estimated_minutes": 45,
    "student_output": "Completed micro:bit sensor-condition flowchart with explanation.",
    "makeup_instructions": "Build the flowchart independently using class notes and explain how the program works.",
    "assessment_purpose": "formal",
    "activity_data": {
      "templateId": "sensor-response",
      "flowchartTemplate": {
        "version": 1,
        "templateId": "sensor-response",
        "prompt": "Create a micro:bit if/then flowchart with one light or temperature condition.",
        "helperText": "Show the sensor input, the condition, the true output, and the false output.",
        "allowedNodeTypes": ["start", "input", "condition", "process", "output", "end"],
        "requiredNodeTypes": ["start", "input", "condition", "output", "end"],
        "requireConditionBranches": true,
        "minNodes": 5,
        "minEdges": 4,
        "starterNodes": [
          { "id": "start", "type": "start", "label": "Start", "description": "", "position": { "x": 180, "y": 30 } },
          { "id": "sensor", "type": "input", "label": "Read light or temperature", "description": "", "position": { "x": 180, "y": 150 } },
          { "id": "condition", "type": "condition", "label": "Condition?", "description": "", "position": { "x": 180, "y": 270 } },
          { "id": "true_output", "type": "output", "label": "True output", "description": "", "position": { "x": 20, "y": 400 } },
          { "id": "false_output", "type": "output", "label": "False output", "description": "", "position": { "x": 340, "y": 400 } },
          { "id": "end", "type": "end", "label": "End", "description": "", "position": { "x": 180, "y": 530 } }
        ],
        "starterEdges": [
          { "id": "edge_start_sensor", "source": "start", "target": "sensor", "label": "" },
          { "id": "edge_sensor_condition", "source": "sensor", "target": "condition", "label": "" },
          { "id": "edge_condition_true", "source": "condition", "target": "true_output", "label": "True" },
          { "id": "edge_condition_false", "source": "condition", "target": "false_output", "label": "False" },
          { "id": "edge_true_end", "source": "true_output", "target": "end", "label": "" },
          { "id": "edge_false_end", "source": "false_output", "target": "end", "label": "" }
        ],
        "checklistItems": [
          { "id": "sensor_condition", "text": "My flowchart includes one light or temperature condition.", "required": true },
          { "id": "true_output", "text": "My flowchart shows the output when the condition is true.", "required": true },
          { "id": "false_output", "text": "My flowchart shows the output when the condition is false.", "required": true }
        ],
        "reflectionPrompts": [
          { "id": "program_explanation", "prompt": "Explain how the program works in one sentence.", "required": true }
        ]
      }
    }
  }
]
$grade6_classroom_activities$::jsonb) as activity (
        id text,
        title text,
        description text,
        activity_type text,
        teacher_instructions text,
        student_instructions text,
        materials text,
        estimated_minutes integer,
        student_output text,
        makeup_instructions text,
        assessment_purpose text,
        activity_data jsonb
    )
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
    array['6'],
    teacher_instructions,
    student_instructions,
    materials,
    estimated_minutes,
    student_output,
    makeup_instructions,
    assessment_purpose,
    activity_data,
    null,
    now()
from grade6_classroom_activities
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
