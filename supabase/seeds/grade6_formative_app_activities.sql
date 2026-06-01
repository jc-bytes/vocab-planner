-- Grade 6 formative app activities from the monthly planning.
-- These replace paper-style practice, planning, checks, diagrams, and reflections.
-- They are intentionally formative so they do not add extra Primary grades.

with grade6_formative_activities as (
    select *
    from jsonb_to_recordset($grade6_formative_app_activities$
[
  {
    "id": "grade6_formative_2026_03_w1_45_internet_address_check",
    "title": "G6 Formative - March W1 45m - Internet Address Check",
    "class_slot": "March Week 1, 45-minute class",
    "description": "Short in-app check for domain name, IP address, and DNS understanding.",
    "activity_type": "structured-response",
    "estimated_minutes": 12,
    "teacher_note": "Use after comparing home addresses and website addresses.",
    "student_instructions": "Answer the short prompts using today's internet address examples.",
    "student_output": "Completed short internet address check.",
    "materials": "Class notes and one familiar website address.",
    "activity_data": {
      "templateId": "worksheet",
      "responseTemplate": {
        "version": 1,
        "templateId": "worksheet",
        "blocks": [
          { "id": "domain_example", "type": "short-text", "prompt": "Write one domain name you know.", "required": true },
          { "id": "ip_address", "type": "short-text", "prompt": "What is an IP address used for?", "required": true },
          { "id": "dns_sentence", "type": "short-text", "prompt": "Write one sentence explaining what DNS does.", "required": true }
        ]
      }
    }
  },
  {
    "id": "grade6_formative_2026_03_w2_45_packet_diagram",
    "title": "G6 Formative - March W2 45m - Packet Header and Payload Diagram",
    "class_slot": "March Week 2, 45-minute class",
    "description": "Students draw and label a simple data packet with header and payload.",
    "activity_type": "map-diagram",
    "estimated_minutes": 20,
    "teacher_note": "Use while introducing packet structure.",
    "student_instructions": "Draw one simple data packet. Label the header and payload, then add a short note about what each part does.",
    "student_output": "Labeled packet diagram.",
    "materials": "Class notes about data packets.",
    "activity_data": { "templateId": "process-diagram", "excalidrawScene": null }
  },
  {
    "id": "grade6_formative_2026_03_w2_90_packet_order",
    "title": "G6 Formative - March W2 90m - Packet Message Order",
    "class_slot": "March Week 2, 90-minute class",
    "description": "Students sequence packet pieces from first to last.",
    "activity_type": "card-sort",
    "estimated_minutes": 15,
    "teacher_note": "Use before or after the classroom packet simulation.",
    "student_instructions": "Move every packet card into the correct order from first to last.",
    "student_output": "Completed packet sequence sort.",
    "materials": "Packet simulation notes.",
    "activity_data": {
      "templateId": "sequence-sort",
      "cardSortTemplate": {
        "version": 1,
        "templateId": "sequence-sort",
        "prompt": "Place the packet steps in the correct order.",
        "helperText": "Think about what must happen before the message arrives.",
        "requireAllCards": true,
        "orderMode": "within-categories",
        "categories": [{ "id": "correct_order", "title": "Correct Order", "helperText": "First step at the top." }],
        "cards": [
          { "id": "write_message", "text": "Write the message", "expectedCategoryId": "correct_order", "expectedOrder": 1 },
          { "id": "split_packets", "text": "Split the message into packets", "expectedCategoryId": "correct_order", "expectedOrder": 2 },
          { "id": "add_header", "text": "Add header information", "expectedCategoryId": "correct_order", "expectedOrder": 3 },
          { "id": "send_route", "text": "Send packets through the route", "expectedCategoryId": "correct_order", "expectedOrder": 4 },
          { "id": "rebuild", "text": "Rebuild the message in order", "expectedCategoryId": "correct_order", "expectedOrder": 5 }
        ]
      }
    }
  },
  {
    "id": "grade6_formative_2026_03_w3_45_online_tools_sort",
    "title": "G6 Formative - March W3 45m - Online Tools by Purpose",
    "class_slot": "March Week 3, 45-minute class",
    "description": "Students sort online tools by purpose: communicate, share, create, or present.",
    "activity_type": "card-sort",
    "estimated_minutes": 15,
    "teacher_note": "Use as the main practice sort for working together online.",
    "student_instructions": "Sort each tool or action into the purpose it best supports.",
    "student_output": "Completed online tools card sort.",
    "materials": "Class notes about online collaboration tools.",
    "activity_data": {
      "templateId": "category-sort",
      "cardSortTemplate": {
        "version": 1,
        "templateId": "category-sort",
        "prompt": "Sort online tools by purpose.",
        "helperText": "Choose the main purpose for each example.",
        "requireAllCards": true,
        "orderMode": "none",
        "categories": [
          { "id": "communicate", "title": "Communicate" },
          { "id": "share", "title": "Share" },
          { "id": "create", "title": "Create" },
          { "id": "present", "title": "Present" }
        ],
        "cards": [
          { "id": "chat_message", "text": "Send a chat message", "expectedCategoryId": "communicate" },
          { "id": "comment", "text": "Leave a helpful comment", "expectedCategoryId": "communicate" },
          { "id": "shared_file", "text": "Give a partner access to a file", "expectedCategoryId": "share" },
          { "id": "folder", "text": "Put project files in a shared folder", "expectedCategoryId": "share" },
          { "id": "doc", "text": "Write in a shared document", "expectedCategoryId": "create" },
          { "id": "slide", "text": "Design a group slide", "expectedCategoryId": "create" },
          { "id": "class_show", "text": "Show the final project to the class", "expectedCategoryId": "present" },
          { "id": "speaker_notes", "text": "Use talking points during a presentation", "expectedCategoryId": "present" }
        ]
      }
    }
  },
  {
    "id": "grade6_formative_2026_03_w3_90_shared_work_reflection",
    "title": "G6 Formative - March W3 90m - Shared Work Reflection",
    "class_slot": "March Week 3, 90-minute class",
    "description": "Short reflection after group shared-file work.",
    "activity_type": "structured-response",
    "estimated_minutes": 8,
    "teacher_note": "Use as a post-activity exit ticket.",
    "student_instructions": "Reflect on your group's shared digital work.",
    "student_output": "Completed shared work reflection.",
    "materials": "The shared slide, document, or file created in class.",
    "activity_data": {
      "templateId": "reflection",
      "responseTemplate": {
        "version": 1,
        "templateId": "reflection",
        "blocks": [
          { "id": "contribution", "type": "short-text", "prompt": "What useful contribution did you add?", "required": true },
          { "id": "respectful_comment", "type": "short-text", "prompt": "What respectful comment or message helped the group?", "required": true },
          { "id": "group_success", "type": "long-text", "prompt": "What did your group do well, and what could improve next time?", "required": true }
        ]
      }
    }
  },
  {
    "id": "grade6_formative_2026_03_w4_45_public_private_sort",
    "title": "G6 Formative - March W4 45m - Public or Private Communication",
    "class_slot": "March Week 4, 45-minute class",
    "description": "Students sort online communication examples into public, private, or ask first.",
    "activity_type": "card-sort",
    "estimated_minutes": 12,
    "teacher_note": "Use before the online communication scenario quiz.",
    "student_instructions": "Sort each example into the safest communication choice.",
    "student_output": "Completed public/private communication card sort.",
    "materials": "Class notes about public/private communication and permission.",
    "activity_data": {
      "templateId": "category-sort",
      "cardSortTemplate": {
        "version": 1,
        "templateId": "category-sort",
        "prompt": "Sort each example by the safest communication choice.",
        "helperText": "If personal information or another person's work appears, think about permission.",
        "requireAllCards": true,
        "orderMode": "none",
        "categories": [
          { "id": "public", "title": "Public" },
          { "id": "private", "title": "Private" },
          { "id": "ask_first", "title": "Ask First" }
        ],
        "cards": [
          { "id": "class_announcement", "text": "Announce a class website link after checking permissions", "expectedCategoryId": "public" },
          { "id": "teacher_late", "text": "Tell the teacher your group file will be late", "expectedCategoryId": "private" },
          { "id": "friend_project", "text": "Ask one friend for their part of a project", "expectedCategoryId": "private" },
          { "id": "photo", "text": "Post a classmate's photo", "expectedCategoryId": "ask_first" },
          { "id": "drawing", "text": "Use a partner's drawing on a web page", "expectedCategoryId": "ask_first" },
          { "id": "password", "text": "Someone shares an email password", "expectedCategoryId": "private" }
        ]
      }
    }
  },
  {
    "id": "grade6_formative_2026_03_w4_90_website_feature_plan",
    "title": "G6 Formative - March W4 90m - Website Feature and Layout Plan",
    "class_slot": "March Week 4, 90-minute class",
    "description": "Students plan a simple web page with audience, purpose, features, and layout.",
    "activity_type": "map-diagram",
    "estimated_minutes": 20,
    "teacher_note": "Use after students identify title, menu, images, links, and main content on a sample website.",
    "student_instructions": "Sketch a simple web page layout. Include audience, purpose, title, menu, image area, link area, and main content.",
    "student_output": "Annotated web page layout plan.",
    "materials": "Sample website and web page planning notes.",
    "activity_data": { "templateId": "blank-map-diagram", "excalidrawScene": null }
  },
  {
    "id": "grade6_formative_2026_04_w1_45_image_use_sort",
    "title": "G6 Formative - April W1 45m - OK or Not OK Image Use",
    "class_slot": "April Week 1, 45-minute class",
    "description": "Students sort image-use examples into OK to use, not OK to use, or ask/give credit.",
    "activity_type": "card-sort",
    "estimated_minutes": 12,
    "teacher_note": "Use before the copyright image-choice check.",
    "student_instructions": "Sort each image example into the safest category.",
    "student_output": "Completed image-use card sort.",
    "materials": "Class notes about copyright, source, credit, and permission.",
    "activity_data": {
      "templateId": "category-sort",
      "cardSortTemplate": {
        "version": 1,
        "templateId": "category-sort",
        "prompt": "Sort each image-use example.",
        "helperText": "Look for source, permission, license, and credit.",
        "requireAllCards": true,
        "orderMode": "none",
        "categories": [
          { "id": "ok", "title": "OK to Use" },
          { "id": "not_ok", "title": "Not OK" },
          { "id": "ask_credit", "title": "Ask or Credit" }
        ],
        "cards": [
          { "id": "classroom_icon", "text": "Icon from a classroom-safe image site with credit required", "expectedCategoryId": "ask_credit" },
          { "id": "own_photo", "text": "A photo you took of your own object", "expectedCategoryId": "ok" },
          { "id": "social_media", "text": "Random social media photo with no source", "expectedCategoryId": "not_ok" },
          { "id": "all_rights", "text": "News photo marked all rights reserved", "expectedCategoryId": "not_ok" },
          { "id": "classmate_drawing", "text": "Classmate drawing with permission and name included", "expectedCategoryId": "ask_credit" },
          { "id": "public_domain", "text": "Public-domain image from a trusted library", "expectedCategoryId": "ok" }
        ]
      }
    }
  },
  {
    "id": "grade6_formative_2026_04_w2_45_webpage_structure_check",
    "title": "G6 Formative - April W2 45m - Web Page Structure Check",
    "class_slot": "April Week 2, 45-minute class",
    "description": "Students match web page parts to their purpose before building.",
    "activity_type": "structured-response",
    "estimated_minutes": 12,
    "teacher_note": "Use before students organize their planned text and images.",
    "student_instructions": "Match each web page part to what it does, then write one improvement goal.",
    "student_output": "Completed structure matching check.",
    "materials": "Sample web page or web page vocabulary notes.",
    "activity_data": {
      "templateId": "worksheet",
      "responseTemplate": {
        "version": 1,
        "templateId": "worksheet",
        "blocks": [
          {
            "id": "web_parts",
            "type": "matching",
            "prompt": "Match each web page part to its purpose.",
            "required": true,
            "items": [
              { "id": "title", "text": "Title", "matchText": "Names the page or project" },
              { "id": "header", "text": "Header", "matchText": "Top label or important section" },
              { "id": "section", "text": "Section", "matchText": "Organized part of the page" },
              { "id": "image", "text": "Image", "matchText": "Picture that supports the message" },
              { "id": "layout", "text": "Layout", "matchText": "How text and media are arranged" }
            ]
          },
          { "id": "improvement", "type": "short-text", "prompt": "What is one improvement you want to make before building?", "required": true }
        ]
      }
    }
  },
  {
    "id": "grade6_formative_2026_04_w3_45_navigation_map",
    "title": "G6 Formative - April W3 45m - Link and Navigation Map",
    "class_slot": "April Week 3, 45-minute class",
    "description": "Students draw how two or more web pages connect.",
    "activity_type": "map-diagram",
    "estimated_minutes": 15,
    "teacher_note": "Use while introducing links, menus, home page, and navigation.",
    "student_instructions": "Draw a simple map showing how your home page connects to at least two other pages or links.",
    "student_output": "Navigation map with link labels.",
    "materials": "Website plan and navigation vocabulary notes.",
    "activity_data": { "templateId": "process-diagram", "excalidrawScene": null }
  },
  {
    "id": "grade6_formative_2026_04_w3_90_link_evaluation_checklist",
    "title": "G6 Formative - April W3 90m - Link Evaluation Checklist",
    "class_slot": "April Week 3, 90-minute class",
    "description": "Students evaluate one internal or external link for usefulness, safety, and clarity.",
    "activity_type": "structured-response",
    "estimated_minutes": 12,
    "teacher_note": "Use after students add and test a link.",
    "student_instructions": "Check one link from your web page and explain why it helps your audience.",
    "student_output": "Completed link evaluation checklist.",
    "materials": "Student web page and link notes.",
    "activity_data": {
      "templateId": "checklist",
      "responseTemplate": {
        "version": 1,
        "templateId": "checklist",
        "blocks": [
          {
            "id": "link_checklist",
            "type": "checklist",
            "prompt": "Check your link.",
            "items": [
              { "id": "works", "text": "The link opens correctly." },
              { "id": "label", "text": "The link label tells users where it goes." },
              { "id": "safe", "text": "The linked page is appropriate and safe." },
              { "id": "useful", "text": "The link helps my audience." }
            ]
          },
          { "id": "why_useful", "type": "long-text", "prompt": "Why is this link useful for your audience?", "required": true }
        ]
      }
    }
  },
  {
    "id": "grade6_formative_2026_04_w4_45_scratch_variable_prediction",
    "title": "G6 Formative - April W4 45m - Scratch Variable Prediction",
    "class_slot": "April Week 4, 45-minute class",
    "description": "Students predict score changes and explain what a variable remembers.",
    "activity_type": "structured-response",
    "estimated_minutes": 12,
    "teacher_note": "Use before the Scratch score challenge.",
    "student_instructions": "Use the prompts to predict and explain how score variables change.",
    "student_output": "Completed Scratch variable prediction.",
    "materials": "Scratch score example or class demo.",
    "activity_data": {
      "templateId": "worksheet",
      "responseTemplate": {
        "version": 1,
        "templateId": "worksheet",
        "blocks": [
          { "id": "variable_remembers", "type": "short-text", "prompt": "What does a variable remember in a game?", "required": true },
          { "id": "plus_prediction", "type": "short-text", "prompt": "If a sprite changes score by +5, what happens after 3 clicks?", "required": true },
          { "id": "game_idea", "type": "short-text", "prompt": "Name one game idea that could use a score variable.", "required": true }
        ]
      }
    }
  },
  {
    "id": "grade6_formative_2026_05_w1_45_safe_online_actions_sort",
    "title": "G6 Formative - May W1 45m - Safe, Unsafe, or Unsure Online Actions",
    "class_slot": "May Week 1, 45-minute class",
    "description": "Students sort Internet Day actions into safe, unsafe, or unsure.",
    "activity_type": "card-sort",
    "estimated_minutes": 12,
    "teacher_note": "Use to prepare responsible internet rules.",
    "student_instructions": "Sort each action into safe, unsafe, or unsure.",
    "student_output": "Completed responsible-choice sort.",
    "materials": "Internet Day vocabulary notes.",
    "activity_data": {
      "templateId": "category-sort",
      "cardSortTemplate": {
        "version": 1,
        "templateId": "category-sort",
        "prompt": "Sort each online action.",
        "helperText": "Choose unsure when you would need an adult, teacher, or more information.",
        "requireAllCards": true,
        "orderMode": "none",
        "categories": [
          { "id": "safe", "title": "Safe" },
          { "id": "unsafe", "title": "Unsafe" },
          { "id": "unsure", "title": "Unsure" }
        ],
        "cards": [
          { "id": "kind_comment", "text": "Leave a kind, helpful comment", "expectedCategoryId": "safe" },
          { "id": "share_password", "text": "Share your password with a friend", "expectedCategoryId": "unsafe" },
          { "id": "unknown_link", "text": "Open a link from an unknown sender", "expectedCategoryId": "unsafe" },
          { "id": "ask_teacher", "text": "Ask the teacher before posting a group photo", "expectedCategoryId": "safe" },
          { "id": "new_app", "text": "Use a new app that asks for personal information", "expectedCategoryId": "unsure" },
          { "id": "credit_image", "text": "Use an image with permission and credit", "expectedCategoryId": "safe" }
        ]
      }
    }
  },
  {
    "id": "grade6_formative_2026_05_w1_90_campaign_plan",
    "title": "G6 Formative - May W1 90m - Internet Day Campaign Plan",
    "class_slot": "May Week 1, 90-minute class",
    "description": "Students plan a short Internet Day campaign message.",
    "activity_type": "structured-response",
    "estimated_minutes": 15,
    "teacher_note": "Use before students create a poster or slide.",
    "student_instructions": "Plan your campaign message before creating the product.",
    "student_output": "Campaign plan with audience, rule, example, and visual idea.",
    "materials": "Campaign vocabulary and product checklist.",
    "activity_data": {
      "templateId": "worksheet",
      "responseTemplate": {
        "version": 1,
        "templateId": "worksheet",
        "blocks": [
          { "id": "topic", "type": "select", "prompt": "Choose your campaign focus.", "required": true, "items": [{ "id": "safety", "text": "Safety" }, { "id": "kindness", "text": "Kindness" }, { "id": "privacy", "text": "Privacy" }, { "id": "reliable", "text": "Reliable information" }] },
          { "id": "rule", "type": "short-text", "prompt": "Write one internet rule for sixth graders.", "required": true },
          { "id": "example", "type": "long-text", "prompt": "Give one example that supports your rule.", "required": true },
          { "id": "visual", "type": "short-text", "prompt": "What image, icon, or visual will support your message?", "required": true }
        ]
      }
    }
  },
  {
    "id": "grade6_formative_2026_05_w2_90_waste_fact_list",
    "title": "G6 Formative - May W2 90m - Technology Waste Fact List",
    "class_slot": "May Week 2, 90-minute class",
    "description": "Students collect three facts or tips about reducing technology waste.",
    "activity_type": "structured-response",
    "estimated_minutes": 15,
    "teacher_note": "Use after the e-waste sorting check as class-list support.",
    "student_instructions": "Record three facts or tips and choose the one that would help students most.",
    "student_output": "Three facts or tips and one explanation.",
    "materials": "Teacher-approved sources or class notes.",
    "activity_data": {
      "templateId": "worksheet",
      "responseTemplate": {
        "version": 1,
        "templateId": "worksheet",
        "blocks": [
          { "id": "tips_table", "type": "table-grid", "prompt": "Record three facts or tips.", "required": true, "rows": [{ "id": "tip_1", "text": "Fact or tip 1" }, { "id": "tip_2", "text": "Fact or tip 2" }, { "id": "tip_3", "text": "Fact or tip 3" }], "columns": [{ "id": "source", "text": "Source or note" }, { "id": "why_matters", "text": "Why it matters" }] },
          { "id": "best_tip", "type": "long-text", "prompt": "Which fact or tip would help students at school most? Explain why.", "required": true }
        ]
      }
    }
  },
  {
    "id": "grade6_formative_2026_05_w3_45_awareness_layout",
    "title": "G6 Formative - May W3 45m - Awareness Product Layout",
    "class_slot": "May Week 3, 45-minute class",
    "description": "Students sketch an awareness product layout.",
    "activity_type": "map-diagram",
    "estimated_minutes": 20,
    "teacher_note": "Use before the poster, slide, infographic, bookmark, or campaign message.",
    "student_instructions": "Sketch your awareness product. Include a title, three facts or tips, one image/icon area, and one action step.",
    "student_output": "Awareness product layout sketch.",
    "materials": "Topic notes and May vocabulary.",
    "activity_data": { "templateId": "blank-map-diagram", "excalidrawScene": null }
  },
  {
    "id": "grade6_formative_2026_05_w3_90_awareness_reflection",
    "title": "G6 Formative - May W3 90m - Awareness Product Reflection",
    "class_slot": "May Week 3, 90-minute class",
    "description": "Students reflect on the finished awareness product and prepare a short presentation note.",
    "activity_type": "structured-response",
    "estimated_minutes": 10,
    "teacher_note": "Use after students finish or present the awareness product.",
    "student_instructions": "Reflect on your finished product and write one short note you can use when presenting it.",
    "student_output": "Awareness product reflection and presentation note.",
    "materials": "Finished awareness product and topic notes.",
    "activity_data": {
      "templateId": "reflection",
      "responseTemplate": {
        "version": 1,
        "templateId": "reflection",
        "blocks": [
          { "id": "final_message", "type": "short-text", "prompt": "What is the main message of your awareness product?", "required": true },
          { "id": "strong_detail", "type": "short-text", "prompt": "What detail, fact, or visual makes your product strong?", "required": true },
          { "id": "presentation_note", "type": "long-text", "prompt": "Write one short note you can use when presenting your product.", "required": true }
        ]
      }
    }
  },
  {
    "id": "grade6_formative_2026_06_w1_45_robotics_safety_scenarios",
    "title": "G6 Formative - June W1 45m - Robotics Safety Scenarios",
    "class_slot": "June Week 1, 45-minute class",
    "description": "Students choose safe responses to robotics classroom situations.",
    "activity_type": "structured-response",
    "estimated_minutes": 12,
    "teacher_note": "Use before handling mBots.",
    "student_instructions": "Choose the safest action for each robotics classroom situation and explain one rule.",
    "student_output": "Completed robotics safety check.",
    "materials": "Robotics safety rules.",
    "activity_data": {
      "templateId": "worksheet",
      "responseTemplate": {
        "version": 1,
        "templateId": "worksheet",
        "blocks": [
          { "id": "robot_stops", "type": "short-text", "prompt": "What should you do if a robot stops working during testing?", "required": true },
          { "id": "loose_wire", "type": "short-text", "prompt": "What should you do if a wire or cable becomes loose?", "required": true },
          { "id": "edge_table", "type": "short-text", "prompt": "What should you do if a robot drives too close to the edge of the table?", "required": true },
          { "id": "rule_reason", "type": "long-text", "prompt": "Choose one robotics safety rule and explain why it protects people or materials.", "required": true }
        ]
      }
    }
  },
  {
    "id": "grade6_formative_2026_06_w1_90_mbot_parts_diagram",
    "title": "G6 Formative - June W1 90m - mBot Parts and Functions Diagram",
    "class_slot": "June Week 1, 90-minute class",
    "description": "Students draw or label main mBot parts and functions.",
    "activity_type": "map-diagram",
    "estimated_minutes": 20,
    "teacher_note": "Use after students identify wheels, motors, board/controller, sensors, LEDs, buzzer, and power.",
    "student_instructions": "Draw or label the main mBot parts. Add a short function note for at least five parts.",
    "student_output": "mBot parts and functions diagram.",
    "materials": "mBot, diagram reference, and knowledge cards.",
    "activity_data": { "templateId": "labeled-map", "excalidrawScene": null }
  },
  {
    "id": "grade6_formative_2026_06_w2_45_movement_command_order",
    "title": "G6 Formative - June W2 45m - Movement Command Order",
    "class_slot": "June Week 2, 45-minute class",
    "description": "Students sequence movement commands and explain why order matters.",
    "activity_type": "card-sort",
    "estimated_minutes": 15,
    "teacher_note": "Use before unplugged movement practice.",
    "student_instructions": "Place the movement commands in the correct order.",
    "student_output": "Completed command sequence.",
    "materials": "Movement vocabulary notes.",
    "activity_data": {
      "templateId": "sequence-sort",
      "cardSortTemplate": {
        "version": 1,
        "templateId": "sequence-sort",
        "prompt": "Order the commands for a simple mBot path.",
        "helperText": "The robot should move forward, stop, turn right, move forward, then stop.",
        "requireAllCards": true,
        "orderMode": "within-categories",
        "categories": [{ "id": "correct_order", "title": "Correct Order" }],
        "cards": [
          { "id": "forward_1", "text": "Move forward", "expectedCategoryId": "correct_order", "expectedOrder": 1 },
          { "id": "stop_1", "text": "Stop", "expectedCategoryId": "correct_order", "expectedOrder": 2 },
          { "id": "turn_right", "text": "Turn right", "expectedCategoryId": "correct_order", "expectedOrder": 3 },
          { "id": "forward_2", "text": "Move forward again", "expectedCategoryId": "correct_order", "expectedOrder": 4 },
          { "id": "stop_2", "text": "Stop at the marker", "expectedCategoryId": "correct_order", "expectedOrder": 5 }
        ]
      }
    }
  },
  {
    "id": "grade6_formative_2026_06_w2_90_movement_test_notes",
    "title": "G6 Formative - June W2 90m - First mBot Movement Test Notes",
    "class_slot": "June Week 2, 90-minute class",
    "description": "Students record movement test results after changing speed or time.",
    "activity_type": "structured-response",
    "estimated_minutes": 12,
    "teacher_note": "Use after first mBot movement tests.",
    "student_instructions": "Record what changed when you adjusted one movement value.",
    "student_output": "Completed movement test notes.",
    "materials": "mBot, movement program, and test area.",
    "activity_data": {
      "templateId": "worksheet",
      "responseTemplate": {
        "version": 1,
        "templateId": "worksheet",
        "blocks": [
          { "id": "changed_value", "type": "short-text", "prompt": "What value did you change: speed, time, or direction?", "required": true },
          { "id": "before_after", "type": "long-text", "prompt": "What happened before and after the change?", "required": true },
          { "id": "improvement", "type": "short-text", "prompt": "What was one thing you changed to improve movement?", "required": true }
        ]
      }
    }
  },
  {
    "id": "grade6_formative_2026_06_w3_45_debugging_practice",
    "title": "G6 Formative - June W3 45m - mBot Debugging Practice",
    "class_slot": "June Week 3, 45-minute class",
    "description": "Students identify simple movement bugs and choose fixes.",
    "activity_type": "structured-response",
    "estimated_minutes": 15,
    "teacher_note": "Use before the mBot movement debugging summative.",
    "student_instructions": "Choose the best fix for each problem and write one debugging tip.",
    "student_output": "Completed debugging practice.",
    "materials": "mBot debugging notes.",
    "activity_data": {
      "templateId": "worksheet",
      "responseTemplate": {
        "version": 1,
        "templateId": "worksheet",
        "blocks": [
          { "id": "problem_table", "type": "table-grid", "prompt": "Choose the best fix.", "required": true, "rows": [{ "id": "does_not_move", "text": "Robot does not move" }, { "id": "wrong_direction", "text": "Robot moves in the wrong direction" }, { "id": "sensor_no_response", "text": "Sensor does not respond" }], "columns": [{ "id": "best_fix", "text": "Best fix" }, { "id": "why", "text": "Why?" }] },
          { "id": "debug_tip", "type": "short-text", "prompt": "Write one debugging tip for mBot movement.", "required": true }
        ]
      }
    }
  },
  {
    "id": "grade6_formative_2026_06_w4_45_robot_output_signal_match",
    "title": "G6 Formative - June W4 45m - Robot Output Signal Matching",
    "class_slot": "June Week 4, 45-minute class",
    "description": "Students match robot states to clear LED or buzzer signals.",
    "activity_type": "card-sort",
    "estimated_minutes": 12,
    "teacher_note": "Use while introducing robot outputs.",
    "student_instructions": "Sort each signal into the robot state where it makes the most sense.",
    "student_output": "Completed output signal sort.",
    "materials": "Robot output vocabulary notes.",
    "activity_data": {
      "templateId": "category-sort",
      "cardSortTemplate": {
        "version": 1,
        "templateId": "category-sort",
        "prompt": "Match robot signals to states.",
        "helperText": "Think about what a user needs to know.",
        "requireAllCards": true,
        "orderMode": "none",
        "categories": [
          { "id": "start", "title": "Start" },
          { "id": "turn", "title": "Turn" },
          { "id": "stop", "title": "Stop/Obstacle" },
          { "id": "finish", "title": "Finish" }
        ],
        "cards": [
          { "id": "green_led", "text": "Green LED turns on", "expectedCategoryId": "start" },
          { "id": "short_beep", "text": "Short beep before changing direction", "expectedCategoryId": "turn" },
          { "id": "red_led", "text": "Red LED near an obstacle", "expectedCategoryId": "stop" },
          { "id": "long_beep", "text": "Long beep at the end", "expectedCategoryId": "finish" },
          { "id": "flash", "text": "Flashing light while turning", "expectedCategoryId": "turn" }
        ]
      }
    }
  },
  {
    "id": "grade6_formative_2026_07_w5_45_route_prediction",
    "title": "G6 Formative - July W5 45m - Route Prediction from Commands",
    "class_slot": "July Week 5, 45-minute class",
    "description": "Students predict the route made by an ordered command list.",
    "activity_type": "card-sort",
    "estimated_minutes": 12,
    "teacher_note": "Use before route map planning.",
    "student_instructions": "Put the commands in order, then use your notes to predict the route.",
    "student_output": "Completed route command sequence.",
    "materials": "Movement review notes.",
    "activity_data": {
      "templateId": "sequence-sort",
      "cardSortTemplate": {
        "version": 1,
        "templateId": "sequence-sort",
        "prompt": "Order the commands for the route.",
        "helperText": "The route should include at least three moves and one turn.",
        "requireAllCards": true,
        "orderMode": "within-categories",
        "categories": [{ "id": "correct_order", "title": "Correct Order" }],
        "cards": [
          { "id": "start", "text": "Start at the marker", "expectedCategoryId": "correct_order", "expectedOrder": 1 },
          { "id": "forward", "text": "Move forward", "expectedCategoryId": "correct_order", "expectedOrder": 2 },
          { "id": "turn", "text": "Turn right", "expectedCategoryId": "correct_order", "expectedOrder": 3 },
          { "id": "forward_again", "text": "Move forward again", "expectedCategoryId": "correct_order", "expectedOrder": 4 },
          { "id": "stop", "text": "Stop at the finish", "expectedCategoryId": "correct_order", "expectedOrder": 5 }
        ]
      }
    }
  },
  {
    "id": "grade6_formative_2026_07_w6_45_loop_comparison",
    "title": "G6 Formative - July W6 45m - Loop vs Repeated Commands",
    "class_slot": "July Week 6, 45-minute class",
    "description": "Students compare repeated commands with a loop.",
    "activity_type": "structured-response",
    "estimated_minutes": 12,
    "teacher_note": "Use while introducing loops as repeated actions.",
    "student_instructions": "Identify the repeated pattern and explain how a loop can make the program shorter.",
    "student_output": "Completed loop comparison.",
    "materials": "Loop examples or board notes.",
    "activity_data": {
      "templateId": "worksheet",
      "responseTemplate": {
        "version": 1,
        "templateId": "worksheet",
        "blocks": [
          { "id": "repeated_actions", "type": "long-text", "prompt": "Write the repeated actions you see in the sample path.", "required": true },
          { "id": "loop_sentence", "type": "short-text", "prompt": "Write one sentence explaining what a loop does.", "required": true },
          { "id": "shorter", "type": "short-text", "prompt": "How can a loop make a program shorter?", "required": true }
        ]
      }
    }
  },
  {
    "id": "grade6_formative_2026_07_w7_45_sensor_detection_sort",
    "title": "G6 Formative - July W7 45m - Sensor Detection Sort",
    "class_slot": "July Week 7, 45-minute class",
    "description": "Students match sensors and examples to what they detect.",
    "activity_type": "card-sort",
    "estimated_minutes": 12,
    "teacher_note": "Use while introducing sensors around us.",
    "student_instructions": "Sort each example by what the sensor detects.",
    "student_output": "Completed sensor detection sort.",
    "materials": "Sensor vocabulary notes.",
    "activity_data": {
      "templateId": "category-sort",
      "cardSortTemplate": {
        "version": 1,
        "templateId": "category-sort",
        "prompt": "Sort sensor examples by what they detect.",
        "helperText": "Use class examples and mBot cards.",
        "requireAllCards": true,
        "orderMode": "none",
        "categories": [
          { "id": "line", "title": "Line" },
          { "id": "obstacle", "title": "Obstacle/Object" },
          { "id": "light", "title": "Light" },
          { "id": "movement", "title": "Movement" }
        ],
        "cards": [
          { "id": "black_line", "text": "Following a black line", "expectedCategoryId": "line" },
          { "id": "wall", "text": "Detecting a wall in front", "expectedCategoryId": "obstacle" },
          { "id": "bright_room", "text": "Checking if the room is bright", "expectedCategoryId": "light" },
          { "id": "shake", "text": "Reacting when a device is shaken", "expectedCategoryId": "movement" },
          { "id": "table_edge", "text": "Noticing a marker or edge", "expectedCategoryId": "line" }
        ]
      }
    }
  },
  {
    "id": "grade6_formative_2026_07_w7_90_sensor_observation_log",
    "title": "G6 Formative - July W7 90m - Sensor Observation Log",
    "class_slot": "July Week 7, 90-minute class",
    "description": "Students record two sensor tests and the responses they observed.",
    "activity_type": "structured-response",
    "estimated_minutes": 15,
    "teacher_note": "Use after students test a sensor in two situations.",
    "student_instructions": "Record what the sensor detected and what changed in each test.",
    "student_output": "Completed sensor observation log.",
    "materials": "mBot, sensor card, or teacher demonstration.",
    "activity_data": {
      "templateId": "worksheet",
      "responseTemplate": {
        "version": 1,
        "templateId": "worksheet",
        "blocks": [
          { "id": "sensor_log", "type": "table-grid", "prompt": "Record two sensor tests.", "required": true, "rows": [{ "id": "test_1", "text": "Test 1" }, { "id": "test_2", "text": "Test 2" }], "columns": [{ "id": "situation", "text": "Situation" }, { "id": "detected", "text": "What did the sensor detect?" }, { "id": "response", "text": "What response happened?" }] },
          { "id": "sensor_sentence", "type": "short-text", "prompt": "What does a sensor do?", "required": true }
        ]
      }
    }
  },
  {
    "id": "grade6_formative_2026_07_w8_45_if_then_flowchart_practice",
    "title": "G6 Formative - July W8 45m - If/Then Flowchart Practice",
    "class_slot": "July Week 8, 45-minute class",
    "description": "Students practice a simple if/then flowchart before the mBot sensor summative.",
    "activity_type": "flowchart-algorithm",
    "estimated_minutes": 20,
    "teacher_note": "Use as practice for condition, true response, and false response.",
    "student_instructions": "Build a simple if/then flowchart with one condition, one true response, and one false response.",
    "student_output": "Practice if/then flowchart and explanation.",
    "materials": "Condition examples and flowchart notes.",
    "activity_data": {
      "templateId": "if-then-condition",
      "flowchartTemplate": {
        "version": 1,
        "templateId": "if-then-condition",
        "prompt": "Practice building an if/then flowchart.",
        "helperText": "Use an everyday example or robot example.",
        "allowedNodeTypes": ["start", "condition", "output", "end"],
        "requiredNodeTypes": ["start", "condition", "output", "end"],
        "requireConditionBranches": true,
        "minNodes": 5,
        "minEdges": 4,
        "starterNodes": [
          { "id": "start", "type": "start", "label": "Start", "position": { "x": 180, "y": 30 } },
          { "id": "condition", "type": "condition", "label": "Condition?", "position": { "x": 180, "y": 160 } },
          { "id": "true_output", "type": "output", "label": "True response", "position": { "x": 20, "y": 300 } },
          { "id": "false_output", "type": "output", "label": "False response", "position": { "x": 340, "y": 300 } },
          { "id": "end", "type": "end", "label": "End", "position": { "x": 180, "y": 430 } }
        ],
        "starterEdges": [
          { "id": "edge_start_condition", "source": "start", "target": "condition", "label": "" },
          { "id": "edge_condition_true", "source": "condition", "target": "true_output", "label": "True" },
          { "id": "edge_condition_false", "source": "condition", "target": "false_output", "label": "False" },
          { "id": "edge_true_end", "source": "true_output", "target": "end", "label": "" },
          { "id": "edge_false_end", "source": "false_output", "target": "end", "label": "" }
        ],
        "checklistItems": [
          { "id": "condition", "text": "I included one condition.", "required": true },
          { "id": "branches", "text": "I included true and false responses.", "required": true }
        ],
        "reflectionPrompts": [
          { "id": "why_conditions", "prompt": "Why do conditions help a robot or program make decisions?", "required": true }
        ]
      }
    }
  },
  {
    "id": "grade6_formative_2026_07_w9_45_mini_challenge_plan",
    "title": "G6 Formative - July W9 45m - mBot Mini-Challenge Plan",
    "class_slot": "July Week 9, 45-minute class",
    "description": "Students plan a realistic mini-challenge with goal, commands, test area, and success rule.",
    "activity_type": "structured-response",
    "estimated_minutes": 15,
    "teacher_note": "Use before mini-challenge practice.",
    "student_instructions": "Plan a mini-challenge that can be completed in class time.",
    "student_output": "Completed mini-challenge plan.",
    "materials": "mBot cards, class notes, and test-area options.",
    "activity_data": {
      "templateId": "worksheet",
      "responseTemplate": {
        "version": 1,
        "templateId": "worksheet",
        "blocks": [
          { "id": "goal", "type": "short-text", "prompt": "What is your realistic robot goal?", "required": true },
          { "id": "commands", "type": "long-text", "prompt": "What commands, blocks, or cards will you need?", "required": true },
          { "id": "test_area", "type": "short-text", "prompt": "What test area or markers will you use?", "required": true },
          { "id": "success_rule", "type": "short-text", "prompt": "What success rule will show the task worked?", "required": true }
        ]
      }
    }
  },
  {
    "id": "grade6_formative_2026_08_w10_45_knowledge_card_action_match",
    "title": "G6 Formative - August W10 45m - Knowledge Card to Robot Action",
    "class_slot": "August Week 10, 45-minute class",
    "description": "Students match mBot Knowledge Cards to the robot action each card supports.",
    "activity_type": "card-sort",
    "estimated_minutes": 12,
    "teacher_note": "Use before station practice.",
    "student_instructions": "Sort each card or block example by the robot action it helps create.",
    "student_output": "Completed card-to-action sort.",
    "materials": "mBot Knowledge Cards Part 1.",
    "activity_data": {
      "templateId": "category-sort",
      "cardSortTemplate": {
        "version": 1,
        "templateId": "category-sort",
        "prompt": "Match cards to robot actions.",
        "helperText": "Use the card title and example code.",
        "requireAllCards": true,
        "orderMode": "none",
        "categories": [
          { "id": "movement", "title": "Movement" },
          { "id": "output", "title": "Output" },
          { "id": "sensor", "title": "Sensor" },
          { "id": "debug", "title": "Debug/Test" }
        ],
        "cards": [
          { "id": "forward", "text": "Forward and turn card", "expectedCategoryId": "movement" },
          { "id": "speed_time", "text": "Speed or time value", "expectedCategoryId": "movement" },
          { "id": "led", "text": "LED signal card", "expectedCategoryId": "output" },
          { "id": "buzzer", "text": "Buzzer sound card", "expectedCategoryId": "output" },
          { "id": "line_sensor", "text": "Line or obstacle sensor card", "expectedCategoryId": "sensor" },
          { "id": "test_steps", "text": "Test one section at a time", "expectedCategoryId": "debug" }
        ]
      }
    }
  },
  {
    "id": "grade6_formative_2026_08_w10_90_station_notes",
    "title": "G6 Formative - August W10 90m - mBot Station Notes",
    "class_slot": "August Week 10, 90-minute class",
    "description": "Students record what worked and what was hard at two mBot practice stations.",
    "activity_type": "structured-response",
    "estimated_minutes": 12,
    "teacher_note": "Use during or after station rotation.",
    "student_instructions": "Record notes for two practice stations.",
    "student_output": "Completed station notes.",
    "materials": "mBot, station cards, and knowledge cards.",
    "activity_data": {
      "templateId": "worksheet",
      "responseTemplate": {
        "version": 1,
        "templateId": "worksheet",
        "blocks": [
          { "id": "station_table", "type": "table-grid", "prompt": "Record two station notes.", "required": true, "rows": [{ "id": "station_1", "text": "Station 1" }, { "id": "station_2", "text": "Station 2" }], "columns": [{ "id": "card_used", "text": "Card or action used" }, { "id": "worked", "text": "What worked?" }, { "id": "hard", "text": "What was hard?" }] },
          { "id": "use_in_challenge", "type": "short-text", "prompt": "Which card do you want to use in the STEM challenge?", "required": true }
        ]
      }
    }
  },
  {
    "id": "grade6_formative_2026_08_w11_45_stem_challenge_plan",
    "title": "G6 Formative - August W11 45m - mBot STEM Challenge Plan",
    "class_slot": "August Week 11, 45-minute class",
    "description": "Students plan the final mBot STEM challenge.",
    "activity_type": "structured-response",
    "estimated_minutes": 15,
    "teacher_note": "Use before build and test time.",
    "student_instructions": "Plan a challenge that can be finished in class time.",
    "student_output": "Completed STEM challenge plan.",
    "materials": "mBot cards, available parts, and test-area options.",
    "activity_data": {
      "templateId": "worksheet",
      "responseTemplate": {
        "version": 1,
        "templateId": "worksheet",
        "blocks": [
          { "id": "challenge_type", "type": "select", "prompt": "Choose one challenge type.", "required": true, "items": [{ "id": "path", "text": "Path" }, { "id": "obstacle", "text": "Obstacle" }, { "id": "signal", "text": "Signal" }, { "id": "sensor", "text": "Line/Sensor task" }] },
          { "id": "goal", "type": "short-text", "prompt": "What is the goal?", "required": true },
          { "id": "success_rule", "type": "short-text", "prompt": "What rule will show success?", "required": true },
          { "id": "parts_cards", "type": "long-text", "prompt": "Which cards, blocks, or parts will you use?", "required": true }
        ]
      }
    }
  },
  {
    "id": "grade6_formative_2026_08_w12_45_demo_explanation_notes",
    "title": "G6 Formative - August W12 45m - mBot Demonstration Explanation Notes",
    "class_slot": "August Week 12, 45-minute class",
    "description": "Students prepare a one-minute mBot demonstration explanation.",
    "activity_type": "structured-response",
    "estimated_minutes": 12,
    "teacher_note": "Use before the final robotics demonstration.",
    "student_instructions": "Prepare notes for your one-minute explanation.",
    "student_output": "Demonstration explanation notes.",
    "materials": "Robot, code, challenge plan, and test notes.",
    "activity_data": {
      "templateId": "worksheet",
      "responseTemplate": {
        "version": 1,
        "templateId": "worksheet",
        "blocks": [
          { "id": "what_robot_should_do", "type": "long-text", "prompt": "What should your robot do?", "required": true },
          { "id": "helpful_card", "type": "short-text", "prompt": "Which card, block, or part helped your program?", "required": true },
          { "id": "improved", "type": "short-text", "prompt": "What did you improve after testing?", "required": true }
        ]
      }
    }
  },
  {
    "id": "grade6_formative_2026_09_w1_45_readiness_checklist",
    "title": "G6 Formative - September W1 45m - mBot Readiness Checklist",
    "class_slot": "September Week 1, 45-minute class",
    "description": "Students inspect numbered mBots and saved evidence for readiness.",
    "activity_type": "structured-response",
    "estimated_minutes": 12,
    "teacher_note": "Use when restarting mBot STEM data work.",
    "student_instructions": "Inspect your kit and evidence. Mark what is ready and what needs help.",
    "student_output": "Completed readiness checklist.",
    "materials": "Numbered mBot kit, challenge sheet, saved code/screenshot, route/test data, and notes.",
    "activity_data": {
      "templateId": "checklist",
      "responseTemplate": {
        "version": 1,
        "templateId": "checklist",
        "blocks": [
          { "id": "ready_items", "type": "checklist", "prompt": "Readiness checklist", "items": [{ "id": "kit", "text": "Numbered kit is identified." }, { "id": "battery", "text": "Battery is charged or needs charging." }, { "id": "challenge_sheet", "text": "Challenge sheet is available." }, { "id": "code", "text": "Saved code or screenshot is available." }, { "id": "data", "text": "Route/test data and notes are available." }] },
          { "id": "status", "type": "select", "prompt": "Overall status", "required": true, "items": [{ "id": "ready", "text": "Ready" }, { "id": "charging", "text": "Needs charging" }, { "id": "teacher_help", "text": "Needs teacher help" }] },
          { "id": "data_field", "type": "short-text", "prompt": "Write one data field you could record in a second challenge.", "required": true }
        ]
      }
    }
  },
  {
    "id": "grade6_formative_2026_09_w1_90_second_challenge_data_fields",
    "title": "G6 Formative - September W1 90m - Second mBot Challenge Data Fields",
    "class_slot": "September Week 1, 90-minute class",
    "description": "Students plan a second mBot STEM challenge and choose data fields.",
    "activity_type": "structured-response",
    "estimated_minutes": 15,
    "teacher_note": "Use before creating the spreadsheet table.",
    "student_instructions": "Choose your challenge type and data fields.",
    "student_output": "Challenge plan and data-field list.",
    "materials": "mBot readiness notes and challenge options.",
    "activity_data": {
      "templateId": "worksheet",
      "responseTemplate": {
        "version": 1,
        "templateId": "worksheet",
        "blocks": [
          { "id": "challenge_type", "type": "select", "prompt": "Choose one safe challenge type.", "required": true, "items": [{ "id": "route_time", "text": "Route time" }, { "id": "obstacle_success", "text": "Obstacle success" }, { "id": "signal_accuracy", "text": "Signal accuracy" }, { "id": "sensor_response", "text": "Sensor response" }] },
          { "id": "fields", "type": "multi-select", "prompt": "Choose data fields for the table.", "required": true, "items": [{ "id": "team", "text": "Team" }, { "id": "attempts", "text": "Attempts" }, { "id": "time", "text": "Time" }, { "id": "success", "text": "Success" }, { "id": "output_sensor", "text": "Output/sensor used" }, { "id": "improvement", "text": "Improvement" }] },
          { "id": "field_explain", "type": "short-text", "prompt": "Explain one data field to a partner.", "required": true }
        ]
      }
    }
  },
  {
    "id": "grade6_formative_2026_09_w2_45_data_collection_sheet",
    "title": "G6 Formative - September W2 45m - mBot Data Collection Sheet",
    "class_slot": "September Week 2, 45-minute class",
    "description": "Students record clean mBot challenge data before the formal table.",
    "activity_type": "spreadsheet-table",
    "estimated_minutes": 20,
    "teacher_note": "Use during short challenge turns or with teacher data cards.",
    "student_instructions": "Record clean data from at least four test turns.",
    "student_output": "Practice data collection table.",
    "materials": "mBot challenge data or teacher data cards.",
    "activity_data": {
      "templateId": "data-table",
      "spreadsheetTemplate": {
        "version": 1,
        "templateId": "data-table",
        "columns": [
          { "id": "team", "title": "Team", "type": "text", "width": 120 },
          { "id": "attempt", "title": "Attempt", "type": "number", "width": 100 },
          { "id": "result", "title": "Result", "type": "text", "width": 130 },
          { "id": "time_seconds", "title": "Time (sec)", "type": "number", "width": 110 },
          { "id": "note", "title": "Note", "type": "text", "width": 180 }
        ],
        "seedData": [["", "", "", "", ""], ["", "", "", "", ""], ["", "", "", "", ""], ["", "", "", "", ""]],
        "minRows": 4,
        "maxRows": 10,
        "allowAddRows": true,
        "chart": { "enabled": false, "type": "bar", "labelColumnId": "team", "valueColumnId": "time_seconds" },
        "reflectionPrompts": [{ "id": "missing_check", "prompt": "Check one record for missing information. What did you check?", "required": true }]
      }
    }
  },
  {
    "id": "grade6_formative_2026_09_w3_90_formula_practice",
    "title": "G6 Formative - September W3 90m - Formula Practice with mBot Data",
    "class_slot": "September Week 3, 90-minute class",
    "description": "Students practice totals and averages using mBot data.",
    "activity_type": "spreadsheet-table",
    "estimated_minutes": 25,
    "teacher_note": "Use after students learn formula, cell reference, sum, and average.",
    "student_instructions": "Enter values and use formulas to calculate totals or averages.",
    "student_output": "Completed formula practice table and reflection.",
    "materials": "mBot data table or teacher practice data.",
    "activity_data": {
      "templateId": "formula-practice",
      "spreadsheetTemplate": {
        "version": 1,
        "templateId": "formula-practice",
        "columns": [
          { "id": "result_type", "title": "Result Type", "type": "text", "width": 150 },
          { "id": "value_a", "title": "Value A", "type": "number", "width": 110 },
          { "id": "value_b", "title": "Value B", "type": "number", "width": 110 },
          { "id": "total", "title": "Total", "type": "formula", "width": 120 }
        ],
        "seedData": [["Route 1", "4", "3", "=B2+C2"], ["Route 2", "5", "6", "=B3+C3"], ["", "", "", ""], ["", "", "", ""]],
        "minRows": 3,
        "maxRows": 8,
        "allowAddRows": true,
        "chart": { "enabled": false, "type": "bar", "labelColumnId": "result_type", "valueColumnId": "total" },
        "reflectionPrompts": [
          { "id": "formula", "prompt": "Which formula did you use, and what did it calculate?", "required": true },
          { "id": "input_output", "prompt": "What changed when an input value changed?", "required": true }
        ]
      }
    }
  },
  {
    "id": "grade6_formative_2026_10_w1_45_chart_idea",
    "title": "G6 Formative - October W1 45m - Chart Idea and Data Question",
    "class_slot": "October Week 1, 45-minute class",
    "description": "Students choose one mBot data question that could become a chart.",
    "activity_type": "structured-response",
    "estimated_minutes": 12,
    "teacher_note": "Use before the formal chart task.",
    "student_instructions": "Choose a chart idea and explain what it should show.",
    "student_output": "Chart idea and data question.",
    "materials": "mBot STEM data table.",
    "activity_data": {
      "templateId": "worksheet",
      "responseTemplate": {
        "version": 1,
        "templateId": "worksheet",
        "blocks": [
          { "id": "chart_question", "type": "short-text", "prompt": "What mBot data question could become a chart?", "required": true },
          { "id": "labels", "type": "short-text", "prompt": "What title or labels would your chart need?", "required": true },
          { "id": "what_show", "type": "long-text", "prompt": "What should the chart help people understand?", "required": true }
        ]
      }
    }
  },
  {
    "id": "grade6_formative_2026_10_w3_45_3d_shape_label_sketch",
    "title": "G6 Formative - October W3 45m - 3D Shape Label Sketch",
    "class_slot": "October Week 3, 45-minute class",
    "description": "Students sketch a simple model and label at least three shapes.",
    "activity_type": "map-diagram",
    "estimated_minutes": 20,
    "teacher_note": "Use before the 3D model design plan.",
    "student_instructions": "Sketch a small model. Label at least three shapes and note the model purpose.",
    "student_output": "3D model sketch with labels.",
    "materials": "3D modelling notes and shape vocabulary.",
    "activity_data": { "templateId": "labeled-map", "excalidrawScene": null }
  },
  {
    "id": "grade6_formative_2026_10_w4_45_3d_design_review_checklist",
    "title": "G6 Formative - October W4 45m - 3D Design Review Checklist",
    "class_slot": "October Week 4, 45-minute class",
    "description": "Students check design-plan evidence before the formal 3D model design plan.",
    "activity_type": "structured-response",
    "estimated_minutes": 10,
    "teacher_note": "Use as the review buffer before the summative.",
    "student_instructions": "Check your design-plan evidence and identify one missing or unclear part.",
    "student_output": "Completed design review checklist.",
    "materials": "Sketch, model evidence, and design-plan checklist.",
    "activity_data": {
      "templateId": "checklist",
      "responseTemplate": {
        "version": 1,
        "templateId": "checklist",
        "blocks": [
          { "id": "review", "type": "checklist", "prompt": "Design-plan evidence check", "items": [{ "id": "sketch", "text": "My sketch is clear." }, { "id": "labels", "text": "At least 3 shapes are labeled." }, { "id": "purpose", "text": "The model purpose is included." }, { "id": "improvement", "text": "One planned improvement is included." }] },
          { "id": "fix", "type": "short-text", "prompt": "What will you fix before submitting?", "required": true }
        ]
      }
    }
  },
  {
    "id": "grade6_formative_2026_11_w1_45_presentation_notes",
    "title": "G6 Formative - November W1 45m - Presentation Talking Points",
    "class_slot": "November Week 1, 45-minute class",
    "description": "Students prepare three talking points for a chart, spreadsheet, 3D model, or project artifact.",
    "activity_type": "structured-response",
    "estimated_minutes": 12,
    "teacher_note": "Use before one-minute presentations.",
    "student_instructions": "Prepare three talking points and improve one after partner feedback.",
    "student_output": "Presentation talking points.",
    "materials": "Student project artifact and reflection vocabulary.",
    "activity_data": {
      "templateId": "worksheet",
      "responseTemplate": {
        "version": 1,
        "templateId": "worksheet",
        "blocks": [
          { "id": "goal", "type": "short-text", "prompt": "Talking point 1: What was your goal?", "required": true },
          { "id": "made", "type": "short-text", "prompt": "Talking point 2: What did you make?", "required": true },
          { "id": "improved", "type": "short-text", "prompt": "Talking point 3: What did you improve?", "required": true },
          { "id": "feedback_change", "type": "short-text", "prompt": "What talking point did you improve after feedback?", "required": true }
        ]
      }
    }
  },
  {
    "id": "grade6_formative_2026_11_w1_90_project_reflection",
    "title": "G6 Formative - November W1 90m - Project Reflection After Presenting",
    "class_slot": "November Week 1, 90-minute class",
    "description": "Students reflect after presenting and listening to classmates.",
    "activity_type": "structured-response",
    "estimated_minutes": 10,
    "teacher_note": "Use as the post-presentation reflection.",
    "student_instructions": "Reflect on your presentation and one idea you learned from another project.",
    "student_output": "Completed project reflection.",
    "materials": "Presentation notes and peer examples.",
    "activity_data": {
      "templateId": "reflection",
      "responseTemplate": {
        "version": 1,
        "templateId": "reflection",
        "blocks": [
          { "id": "presented", "type": "long-text", "prompt": "What did you present?", "required": true },
          { "id": "positive_comment", "type": "short-text", "prompt": "What positive comment did you give or receive?", "required": true },
          { "id": "learned", "type": "long-text", "prompt": "What idea did you learn from another project?", "required": true }
        ]
      }
    }
  },
  {
    "id": "grade6_formative_2026_11_w2_45_microbit_input_output_sort",
    "title": "G6 Formative - November W2 45m - micro:bit Input/Output Practice Sort",
    "class_slot": "November Week 2, 45-minute class",
    "description": "Students sort micro:bit examples into input and output.",
    "activity_type": "card-sort",
    "estimated_minutes": 12,
    "teacher_note": "Use before the micro:bit parts and input/output summative.",
    "student_instructions": "Sort each example into input or output.",
    "student_output": "Completed micro:bit input/output sort.",
    "materials": "micro:bit notes or reference image.",
    "activity_data": {
      "templateId": "category-sort",
      "cardSortTemplate": {
        "version": 1,
        "templateId": "category-sort",
        "prompt": "Sort each micro:bit example.",
        "helperText": "Input is information or action going in. Output is what the device shows or does.",
        "requireAllCards": true,
        "orderMode": "none",
        "categories": [
          { "id": "input", "title": "Input" },
          { "id": "output", "title": "Output" }
        ],
        "cards": [
          { "id": "button_a", "text": "Pressing Button A", "expectedCategoryId": "input" },
          { "id": "heart", "text": "Showing a heart icon", "expectedCategoryId": "output" },
          { "id": "light", "text": "Light sensor reading", "expectedCategoryId": "input" },
          { "id": "sound", "text": "Playing a sound on a connected speaker", "expectedCategoryId": "output" },
          { "id": "temperature", "text": "Temperature reading", "expectedCategoryId": "input" },
          { "id": "number", "text": "Showing a number on the LEDs", "expectedCategoryId": "output" },
          { "id": "shake", "text": "Shaking the micro:bit", "expectedCategoryId": "input" },
          { "id": "radio", "text": "Radio message received from another micro:bit", "expectedCategoryId": "input" }
        ]
      }
    }
  },
  {
    "id": "grade6_formative_2026_11_w3_45_counter_program_plan",
    "title": "G6 Formative - November W3 45m - micro:bit Counter Program Plan",
    "class_slot": "November Week 3, 45-minute class",
    "description": "Students plan a counter program with variable, button input, and LED output.",
    "activity_type": "structured-response",
    "estimated_minutes": 15,
    "teacher_note": "Use before building the counter program.",
    "student_instructions": "Plan how your counter program will work.",
    "student_output": "Completed counter program plan.",
    "materials": "micro:bit variable notes and MakeCode example.",
    "activity_data": {
      "templateId": "worksheet",
      "responseTemplate": {
        "version": 1,
        "templateId": "worksheet",
        "blocks": [
          { "id": "variable", "type": "short-text", "prompt": "What variable will remember the counter value?", "required": true },
          { "id": "increase", "type": "short-text", "prompt": "Which button will increase the value?", "required": true },
          { "id": "display", "type": "short-text", "prompt": "How will the value appear on the LED display?", "required": true },
          { "id": "remember", "type": "short-text", "prompt": "What does the variable remember?", "required": true }
        ]
      }
    }
  },
  {
    "id": "grade6_formative_2026_12_w1_45_everyday_if_then",
    "title": "G6 Formative - December W1 45m - Everyday If/Then Examples",
    "class_slot": "December Week 1, 45-minute class",
    "description": "Students complete everyday if/then examples before sensor-condition flowcharts.",
    "activity_type": "structured-response",
    "estimated_minutes": 10,
    "teacher_note": "Use before the micro:bit sensor-condition summative.",
    "student_instructions": "Complete the if/then examples and explain one output.",
    "student_output": "Completed if/then practice.",
    "materials": "Condition vocabulary notes.",
    "activity_data": {
      "templateId": "worksheet",
      "responseTemplate": {
        "version": 1,
        "templateId": "worksheet",
        "blocks": [
          { "id": "if_then_table", "type": "table-grid", "prompt": "Complete three everyday if/then examples.", "required": true, "rows": [{ "id": "example_1", "text": "Example 1" }, { "id": "example_2", "text": "Example 2" }, { "id": "example_3", "text": "Example 3" }], "columns": [{ "id": "if", "text": "If condition" }, { "id": "then", "text": "Then response" }] },
          { "id": "output_sentence", "type": "short-text", "prompt": "Write one sentence explaining what an output does.", "required": true }
        ]
      }
    }
  },
  {
    "id": "grade6_formative_2026_12_w2_45_final_project_plan",
    "title": "G6 Formative - December W2 45m - Final Interactive Project Plan",
    "class_slot": "December Week 2, 45-minute class",
    "description": "Students plan the final interactive micro:bit project.",
    "activity_type": "structured-response",
    "estimated_minutes": 15,
    "teacher_note": "Use before final project build time.",
    "student_instructions": "Plan a simple project that can be finished in class time.",
    "student_output": "Completed final project plan.",
    "materials": "micro:bit notes and project idea list.",
    "activity_data": {
      "templateId": "worksheet",
      "responseTemplate": {
        "version": 1,
        "templateId": "worksheet",
        "blocks": [
          { "id": "project_idea", "type": "select", "prompt": "Choose one simple project idea.", "required": true, "items": [{ "id": "alarm", "text": "Alarm" }, { "id": "mood", "text": "Mood display" }, { "id": "counter", "text": "Counter" }, { "id": "reaction", "text": "Reaction game" }, { "id": "night_light", "text": "Night light" }, { "id": "step_counter", "text": "Step-counter-style idea" }] },
          { "id": "input", "type": "short-text", "prompt": "What input will your project use?", "required": true },
          { "id": "output", "type": "short-text", "prompt": "What output will it show or do?", "required": true },
          { "id": "success_rule", "type": "short-text", "prompt": "What success rule will show the project worked?", "required": true }
        ]
      }
    }
  },
  {
    "id": "grade6_formative_2026_12_w3_45_explanation_practice",
    "title": "G6 Formative - December W3 45m - Project Explanation Practice",
    "class_slot": "December Week 3, 45-minute class",
    "description": "Students prepare answers for their one-minute final project explanation.",
    "activity_type": "structured-response",
    "estimated_minutes": 12,
    "teacher_note": "Use before final demonstrations.",
    "student_instructions": "Prepare the answers your audience should understand.",
    "student_output": "Final project explanation notes.",
    "materials": "Final project file and vocabulary notes.",
    "activity_data": {
      "templateId": "worksheet",
      "responseTemplate": {
        "version": 1,
        "templateId": "worksheet",
        "blocks": [
          { "id": "what_does", "type": "short-text", "prompt": "What does your project do?", "required": true },
          { "id": "input", "type": "short-text", "prompt": "What input does it use?", "required": true },
          { "id": "output", "type": "short-text", "prompt": "What output does it show?", "required": true },
          { "id": "improved", "type": "short-text", "prompt": "What did you improve?", "required": true }
        ]
      }
    }
  },
  {
    "id": "grade6_formative_2026_12_w3_90_final_demo_reflection",
    "title": "G6 Formative - December W3 90m - Final Demonstration Reflection",
    "class_slot": "December Week 3, 90-minute class",
    "description": "Students reflect after final micro:bit project demonstrations.",
    "activity_type": "structured-response",
    "estimated_minutes": 10,
    "teacher_note": "Use as the closing reflection and concept check.",
    "student_instructions": "Reflect on your demonstration and one idea you would like to build next.",
    "student_output": "Final reflection and concept check.",
    "materials": "Final project and explanation notes.",
    "activity_data": {
      "templateId": "reflection",
      "responseTemplate": {
        "version": 1,
        "templateId": "reflection",
        "blocks": [
          { "id": "demo", "type": "long-text", "prompt": "What did you demonstrate?", "required": true },
          { "id": "vocab", "type": "long-text", "prompt": "Use input, output, and condition or variable to explain your project.", "required": true },
          { "id": "next_idea", "type": "short-text", "prompt": "What is one idea you would like to build next?", "required": true }
        ]
      }
    }
  }
]
$grade6_formative_app_activities$::jsonb) as activity (
        id text,
        title text,
        class_slot text,
        description text,
        activity_type text,
        estimated_minutes integer,
        teacher_note text,
        student_instructions text,
        student_output text,
        materials text,
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
    description || ' Slot: ' || class_slot || '.',
    activity_type,
    'technology',
    array['6'],
    'Use as formative practice in ' || class_slot || '. ' || teacher_note,
    student_instructions,
    materials,
    estimated_minutes,
    student_output,
    'Complete the same formative activity independently using class notes and submit it before the next class.',
    'formative',
    activity_data,
    null,
    now()
from grade6_formative_activities
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
