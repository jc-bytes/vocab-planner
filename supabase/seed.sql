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
              { "id": "a", "text": "A" },
              { "id": "b", "text": "B" },
              { "id": "c", "text": "C" },
              { "id": "d", "text": "D" }
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
    "title": "G6 T1 Summative 4 - Scratch Score Task Evidence",
    "description": "Students submit evidence of a Scratch score task with one variable and two clickable sprites that change the score by different amounts. Slot: April Week 4, 90-minute class.",
    "activity_type": "external-artifact",
    "teacher_instructions": "Use this formal evidence upload after students build the Scratch score task. Check the link or screenshot before grading the checklist and reflections.",
    "student_instructions": "Submit a Scratch link or screenshot that shows your score task. Complete the checklist and explain what each sprite does to the score.",
    "materials": "Scratch project, device, screenshot tool if needed.",
    "estimated_minutes": 45,
    "student_output": "Scratch project link or screenshot with checklist and explanation.",
    "makeup_instructions": "Finish the Scratch score task, submit a working link or screenshot, and answer the reflection prompts.",
    "assessment_purpose": "formal",
    "activity_data": {
      "templateId": "project-evidence",
      "externalArtifactTemplate": {
        "version": 1,
        "templateId": "project-evidence",
        "prompt": "Submit evidence of your Scratch score task.",
        "helperText": "Use a project link, screenshot, or PDF that clearly shows the variable and clickable sprites.",
        "evidenceMode": "either",
        "linkLabel": "Scratch project link",
        "uploadLabel": "Scratch screenshot or PDF",
        "allowedMimeTypes": ["image/png", "image/jpeg", "image/webp", "application/pdf"],
        "checklistItems": [
          { "id": "one_variable", "text": "My Scratch task has one score variable.", "required": true },
          { "id": "two_sprites", "text": "My task has two clickable sprites.", "required": true },
          { "id": "different_amounts", "text": "The two sprites change the score by different amounts.", "required": true },
          { "id": "tested_fixed", "text": "I tested the task and fixed or explained one problem.", "required": true }
        ],
        "reflectionPrompts": [
          { "id": "sprite_effects", "prompt": "What does each sprite do to the score?", "required": true },
          { "id": "debug_step", "prompt": "What problem did you test, fix, or explain?", "required": true }
        ]
      }
    }
  },
  {
    "id": "grade6_t1_summative_5_recycling_ewaste_sorting",
    "title": "G6 T1 Summative 5 - Recycling and E-Waste Sorting Check",
    "description": "Students sort 10 technology-waste items and explain responsible choices. Slot: May Week 2, 90-minute class.",
    "activity_type": "structured-response",
    "teacher_instructions": "Use this formal check after students practice reuse, repair, recycle, and e-waste decisions. Accept reasonable alternate categories when explanations show responsible thinking.",
    "student_instructions": "Choose the best category for each item, then explain responsible choices and one realistic school action.",
    "materials": "Device and class notes about reuse, repair, recycle, e-waste, batteries, and responsible disposal.",
    "estimated_minutes": 45,
    "student_output": "Completed sorting table, explanations, and school action step.",
    "makeup_instructions": "Complete the sorting check independently using class notes.",
    "assessment_purpose": "formal",
    "activity_data": {
      "templateId": "worksheet",
      "responseTemplate": {
        "version": 1,
        "templateId": "worksheet",
        "blocks": [
          {
            "id": "sorting_table",
            "type": "table-grid",
            "prompt": "Part A - Sort each item into reuse, repair, recycle, or e-waste.",
            "helperText": "Choose the best answer for the situation, not just the fastest answer.",
            "required": true,
            "rows": [
              { "id": "keyboard", "text": "1. Working keyboard that the classroom no longer needs" },
              { "id": "battery", "text": "2. Broken phone battery" },
              { "id": "cardboard", "text": "3. Empty cardboard box from a new monitor" },
              { "id": "laptop", "text": "4. Old laptop that works slowly but turns on" },
              { "id": "tablet", "text": "5. Cracked tablet screen" },
              { "id": "paper", "text": "6. Used printer paper with one blank side" },
              { "id": "headphones", "text": "7. Broken headphones with exposed wire" },
              { "id": "bottle", "text": "8. Plastic bottle from the computer lab" },
              { "id": "charger", "text": "9. Old charger that still works" },
              { "id": "circuit_board", "text": "10. Damaged circuit board from a device" }
            ],
            "columns": [
              { "id": "category", "text": "Best category" }
            ]
          },
          {
            "id": "explain_choice_1",
            "type": "long-text",
            "prompt": "Choose one item from Part A. Explain why your category is the responsible choice.",
            "required": true
          },
          {
            "id": "explain_choice_2",
            "type": "long-text",
            "prompt": "Choose a second item from Part A. Explain why your category is the responsible choice.",
            "required": true
          },
          {
            "id": "school_action",
            "type": "long-text",
            "prompt": "Write one realistic action our school could take to reduce technology waste. Explain why it would help.",
            "required": true
          }
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
    "title": "G6 T2 Summative 5 - mBot STEM Challenge Demonstration",
    "description": "Students submit mBot STEM challenge evidence and explain the goal, behavior, robot action, output or sensor, test result, and one improvement. Slot: August Week 12, 90-minute class.",
    "activity_type": "external-artifact",
    "teacher_instructions": "Use this formal evidence task for the final mBot STEM challenge demonstration. Students may submit code screenshots, route/test data, or a short evidence file.",
    "student_instructions": "Submit evidence of your mBot STEM challenge. Complete the checklist and explain how your robot behaved and improved.",
    "materials": "mBot, mBlock or code screenshot, route/test data, challenge sheet, readiness checklist.",
    "estimated_minutes": 45,
    "student_output": "Project evidence, demonstration checklist, and reflection.",
    "makeup_instructions": "Submit saved code/screenshot evidence and complete the reflection and readiness checklist independently.",
    "assessment_purpose": "formal",
    "activity_data": {
      "templateId": "project-evidence",
      "externalArtifactTemplate": {
        "version": 1,
        "templateId": "project-evidence",
        "prompt": "Submit evidence for your mBot STEM Challenge Project.",
        "helperText": "Use a screenshot, PDF, or link that helps your teacher verify the robot challenge.",
        "evidenceMode": "either",
        "linkLabel": "Optional project or evidence link",
        "uploadLabel": "Code, route, or test evidence screenshot/PDF",
        "allowedMimeTypes": ["image/png", "image/jpeg", "image/webp", "application/pdf"],
        "checklistItems": [
          { "id": "goal", "text": "I can explain the challenge goal.", "required": true },
          { "id": "behavior", "text": "My evidence shows the route or robot behavior.", "required": true },
          { "id": "robot_action", "text": "I named the main robot action.", "required": true },
          { "id": "output_sensor", "text": "I included one output or sensor.", "required": true },
          { "id": "test_result", "text": "I recorded a test result.", "required": true },
          { "id": "readiness", "text": "I completed the readiness check: numbered kit, charged battery, challenge sheet, route/test data, and notes.", "required": true }
        ],
        "reflectionPrompts": [
          { "id": "improvement", "prompt": "What was one problem and one improvement from testing?", "required": true },
          { "id": "explain_behavior", "prompt": "Explain what your robot did during the demonstration.", "required": true }
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
          { "id": "question_1", "prompt": "Answer chart question 1 using evidence from the chart.", "required": true },
          { "id": "question_2", "prompt": "Answer chart question 2 using evidence from the chart.", "required": true },
          { "id": "question_3", "prompt": "Answer chart question 3 using evidence from the chart.", "required": true },
          { "id": "conclusion", "prompt": "Write one conclusion sentence that explains what the chart shows.", "required": true }
        ]
      }
    }
  },
  {
    "id": "grade6_t3_summative_3_3d_model_design_plan",
    "title": "G6 T3 Summative 3 - 3D Model Design Plan",
    "description": "Students submit a 3D model design plan with sketch evidence, at least 3 labeled shapes, model purpose, and one planned improvement. Slot: October Week 4, 90-minute class.",
    "activity_type": "external-artifact",
    "teacher_instructions": "Use this formal design-plan evidence task after students practice 3D shapes, moving, resizing, rotating, duplicating, grouping, and improving a model.",
    "student_instructions": "Submit your 3D model design evidence. Make sure your sketch or screenshot shows at least 3 labeled shapes, the model purpose, and one planned improvement.",
    "materials": "3D modelling tool, sketch/design plan, screenshot or PDF evidence.",
    "estimated_minutes": 45,
    "student_output": "Uploaded or linked 3D model design evidence with checklist and reflection.",
    "makeup_instructions": "Submit a screenshot/PDF or link showing your model design evidence and complete the reflection prompts.",
    "assessment_purpose": "formal",
    "activity_data": {
      "templateId": "project-evidence",
      "externalArtifactTemplate": {
        "version": 1,
        "templateId": "project-evidence",
        "prompt": "Submit your 3D model design plan evidence.",
        "helperText": "Upload or link evidence that shows the sketch/model, labels, purpose, and planned improvement.",
        "evidenceMode": "either",
        "linkLabel": "Optional model/design link",
        "uploadLabel": "Sketch or model screenshot/PDF",
        "allowedMimeTypes": ["image/png", "image/jpeg", "image/webp", "application/pdf"],
        "checklistItems": [
          { "id": "sketch", "text": "My evidence includes a clear sketch or model view.", "required": true },
          { "id": "three_shapes", "text": "I labeled at least 3 shapes.", "required": true },
          { "id": "purpose", "text": "I included the purpose of the model.", "required": true },
          { "id": "improvement", "text": "I included one planned improvement.", "required": true }
        ],
        "reflectionPrompts": [
          { "id": "model_purpose", "prompt": "What is the purpose of your model?", "required": true },
          { "id": "planned_improvement", "prompt": "What is one planned improvement and why?", "required": true }
        ]
      }
    }
  },
  {
    "id": "grade6_t3_summative_4_microbit_parts_input_output",
    "title": "G6 T3 Summative 4 - micro:bit Parts and Input/Output Check",
    "description": "Students label 5 micro:bit parts, sort 8 examples into input/output, and answer short application questions. Slot: November Week 2, 90-minute class.",
    "activity_type": "structured-response",
    "teacher_instructions": "Use this formal check after students practice micro:bit parts, input, output, LED display, buttons, sensors, and variables.",
    "student_instructions": "Complete each part of the check. Use input/output words carefully and answer in complete ideas.",
    "materials": "Device, class notes, micro:bit reference image or physical micro:bit.",
    "estimated_minutes": 45,
    "student_output": "Completed micro:bit parts, input/output, and application responses.",
    "makeup_instructions": "Complete the same check independently using class notes and a micro:bit reference image.",
    "assessment_purpose": "formal",
    "activity_data": {
      "templateId": "worksheet",
      "responseTemplate": {
        "version": 1,
        "templateId": "worksheet",
        "blocks": [
          {
            "id": "part_labels",
            "type": "table-grid",
            "prompt": "Part A - Label these 5 micro:bit parts: LED display, Button A, Button B, USB port, battery connector.",
            "required": true,
            "rows": [
              { "id": "part_1", "text": "Part 1" },
              { "id": "part_2", "text": "Part 2" },
              { "id": "part_3", "text": "Part 3" },
              { "id": "part_4", "text": "Part 4" },
              { "id": "part_5", "text": "Part 5" }
            ],
            "columns": [
              { "id": "part_name", "text": "Part name" }
            ]
          },
          {
            "id": "input_output_sort",
            "type": "table-grid",
            "prompt": "Part B - Sort each example as input or output.",
            "required": true,
            "rows": [
              { "id": "button_a", "text": "1. Pressing Button A" },
              { "id": "heart_icon", "text": "2. Showing a heart icon" },
              { "id": "light_sensor", "text": "3. Light sensor reading" },
              { "id": "speaker_sound", "text": "4. Playing a sound on a connected speaker" },
              { "id": "temperature", "text": "5. Temperature reading" },
              { "id": "led_number", "text": "6. Showing a number on the LEDs" },
              { "id": "shake", "text": "7. Shaking the micro:bit" },
              { "id": "radio_received", "text": "8. Radio message received from another micro:bit" }
            ],
            "columns": [
              { "id": "input_output", "text": "Input or output?" }
            ]
          },
          {
            "id": "button_smile",
            "type": "short-text",
            "prompt": "A program shows a smile when Button A is pressed. What is the input and what is the output?",
            "required": true
          },
          {
            "id": "hot_sensor",
            "type": "short-text",
            "prompt": "A program shows HOT when the temperature is high. What sensor input is used?",
            "required": true
          },
          {
            "id": "counter_changes",
            "type": "short-text",
            "prompt": "A counter increases when Button B is pressed. What changes in the program?",
            "required": true
          },
          {
            "id": "needs_both",
            "type": "long-text",
            "prompt": "Why does a micro:bit project need both input and output?",
            "required": true
          },
          {
            "id": "one_sentence",
            "type": "short-text",
            "prompt": "Explain the difference between input and output in one sentence.",
            "required": true
          }
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
