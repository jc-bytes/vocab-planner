-- Technology Sparks for the 2026 school year.
-- Generated from vocabularies/manifest.json so Sparks follow each grade's weekly topic.
delete from public.weekly_sparks
where id ~ '^technology_2026_'
   or id ~ '^grade[0-9]+_2026_w[0-9]{2}_[ab]$';

with technology_weekly_sparks_2026 as (
    select
        spark.id,
        spark.spark_type,
        spark.title,
        spark.spark_text,
        spark.why_it_matters,
        spark.question,
        spark.source_title,
        spark.source_url,
        spark.subject_slug,
        array(
            select jsonb_array_elements_text(spark.target_grades)
        ) as target_grades,
        spark.scheduled_date,
        spark.status
    from jsonb_to_recordset($technology_weekly_sparks_2026$
[
  {
    "id": "technology_2026_g6_it_march_week1_core_vocabulary",
    "spark_type": "debate",
    "title": "Core Vocabulary",
    "spark_text": "This week, Grade 6 connects its vocabulary to core first-trimester words for the Grade 6 summative vocabulary table.",
    "why_it_matters": "This connects the weekly vocabulary to the work students will practice in class.",
    "question": "What is one idea from Core Vocabulary that could help your Technology work this week?",
    "source_title": "Technology Planning 2026",
    "source_url": "",
    "subject_slug": "technology",
    "target_grades": [
      "6"
    ],
    "scheduled_date": "2026-03-02",
    "status": "scheduled"
  },
  {
    "id": "technology_2026_g7_it_march_week1_robotics_parts",
    "spark_type": "reflection",
    "title": "Robotics Parts",
    "spark_text": "This week, Grade 7 connects its vocabulary to core first-trimester words for the Grade 7 robotics vocabulary table.",
    "why_it_matters": "This connects the weekly vocabulary to the work students will practice in class.",
    "question": "What is one robot behavior, sensor detail, or safety habit from Robotics Parts that your team should test carefully?",
    "source_title": "Technology Planning 2026",
    "source_url": "",
    "subject_slug": "technology",
    "target_grades": [
      "7"
    ],
    "scheduled_date": "2026-03-02",
    "status": "scheduled"
  },
  {
    "id": "technology_2026_g8_it_march_week1_vector_graphics",
    "spark_type": "cool_fact",
    "title": "Vector Graphics",
    "spark_text": "This week, Grade 8 connects its vocabulary to core first-trimester words for the Grade 8 vector graphics vocabulary table.",
    "why_it_matters": "This connects the weekly vocabulary to the work students will practice in class.",
    "question": "What is one idea from Vector Graphics that could help your Technology work this week?",
    "source_title": "Technology Planning 2026",
    "source_url": "",
    "subject_slug": "technology",
    "target_grades": [
      "8"
    ],
    "scheduled_date": "2026-03-02",
    "status": "scheduled"
  },
  {
    "id": "technology_2026_g9_it_march_week1_physical_computing",
    "spark_type": "trivia",
    "title": "Physical Computing",
    "spark_text": "This week, Grade 9 connects its vocabulary to core first-trimester words for the Grade 9 physical computing vocabulary table.",
    "why_it_matters": "This connects the weekly vocabulary to the work students will practice in class.",
    "question": "What is one idea from Physical Computing that could help your Technology work this week?",
    "source_title": "Technology Planning 2026",
    "source_url": "",
    "subject_slug": "technology",
    "target_grades": [
      "9"
    ],
    "scheduled_date": "2026-03-02",
    "status": "scheduled"
  },
  {
    "id": "technology_2026_g6_it_march_week2_sending_messages",
    "spark_type": "reflection",
    "title": "Sending Messages",
    "spark_text": "This week, Grade 6 connects its vocabulary to sending messages and packet order.",
    "why_it_matters": "This connects the weekly vocabulary to the work students will practice in class.",
    "question": "What is one idea from Sending Messages that could help your Technology work this week?",
    "source_title": "Technology Planning 2026",
    "source_url": "",
    "subject_slug": "technology",
    "target_grades": [
      "6"
    ],
    "scheduled_date": "2026-03-09",
    "status": "scheduled"
  },
  {
    "id": "technology_2026_g7_it_march_week2_robotics_mblock_workspace",
    "spark_type": "cool_fact",
    "title": "Robotics: mBlock Workspace",
    "spark_text": "This week, Grade 7 connects its vocabulary to mBlock tools and first scripts.",
    "why_it_matters": "This connects the weekly vocabulary to the work students will practice in class.",
    "question": "What is one robot behavior, sensor detail, or safety habit from Robotics: mBlock Workspace that your team should test carefully?",
    "source_title": "Technology Planning 2026",
    "source_url": "",
    "subject_slug": "technology",
    "target_grades": [
      "7"
    ],
    "scheduled_date": "2026-03-09",
    "status": "scheduled"
  },
  {
    "id": "technology_2026_g8_it_march_week2_alignment_and_grouping",
    "spark_type": "trivia",
    "title": "Alignment and Grouping",
    "spark_text": "This week, Grade 8 connects its vocabulary to Grade 8 first-trimester work.",
    "why_it_matters": "This connects the weekly vocabulary to the work students will practice in class.",
    "question": "What is one idea from Alignment and Grouping that could help your Technology work this week?",
    "source_title": "Technology Planning 2026",
    "source_url": "",
    "subject_slug": "technology",
    "target_grades": [
      "8"
    ],
    "scheduled_date": "2026-03-09",
    "status": "scheduled"
  },
  {
    "id": "technology_2026_g9_it_march_week2_blink_and_signals",
    "spark_type": "good_news",
    "title": "Blink and Signals",
    "spark_text": "This week, Grade 9 connects its vocabulary to Grade 9 first-trimester physical computing work.",
    "why_it_matters": "This connects the weekly vocabulary to the work students will practice in class.",
    "question": "What is one idea from Blink and Signals that could help your Technology work this week?",
    "source_title": "Technology Planning 2026",
    "source_url": "",
    "subject_slug": "technology",
    "target_grades": [
      "9"
    ],
    "scheduled_date": "2026-03-09",
    "status": "scheduled"
  },
  {
    "id": "technology_2026_g6_it_march_week3_working_together_online",
    "spark_type": "cool_fact",
    "title": "Working Together Online",
    "spark_text": "This week, Grade 6 connects its vocabulary to online collaboration and shared work.",
    "why_it_matters": "This connects the weekly vocabulary to the work students will practice in class.",
    "question": "What is one idea from Working Together Online that could help your Technology work this week?",
    "source_title": "Technology Planning 2026",
    "source_url": "",
    "subject_slug": "technology",
    "target_grades": [
      "6"
    ],
    "scheduled_date": "2026-03-16",
    "status": "scheduled"
  },
  {
    "id": "technology_2026_g7_it_march_week3_robotics_movement_commands",
    "spark_type": "trivia",
    "title": "Robotics: Movement Commands",
    "spark_text": "This week, Grade 7 connects its vocabulary to basic robot movement.",
    "why_it_matters": "This connects the weekly vocabulary to the work students will practice in class.",
    "question": "What is one robot behavior, sensor detail, or safety habit from Robotics: Movement Commands that your team should test carefully?",
    "source_title": "Technology Planning 2026",
    "source_url": "",
    "subject_slug": "technology",
    "target_grades": [
      "7"
    ],
    "scheduled_date": "2026-03-16",
    "status": "scheduled"
  },
  {
    "id": "technology_2026_g8_it_march_week3_campaign_graphics",
    "spark_type": "good_news",
    "title": "Campaign Graphics",
    "spark_text": "This week, Grade 8 connects its vocabulary to Grade 8 first-trimester work.",
    "why_it_matters": "This connects the weekly vocabulary to the work students will practice in class.",
    "question": "What is one idea from Campaign Graphics that could help your Technology work this week?",
    "source_title": "Technology Planning 2026",
    "source_url": "",
    "subject_slug": "technology",
    "target_grades": [
      "8"
    ],
    "scheduled_date": "2026-03-16",
    "status": "scheduled"
  },
  {
    "id": "technology_2026_g9_it_march_week3_lab_routine",
    "spark_type": "debate",
    "title": "Lab Routine",
    "spark_text": "This week, Grade 9 connects its vocabulary to Grade 9 first-trimester physical computing work.",
    "why_it_matters": "This connects the weekly vocabulary to the work students will practice in class.",
    "question": "What is one idea from Lab Routine that could help your Technology work this week?",
    "source_title": "Technology Planning 2026",
    "source_url": "",
    "subject_slug": "technology",
    "target_grades": [
      "9"
    ],
    "scheduled_date": "2026-03-16",
    "status": "scheduled"
  },
  {
    "id": "technology_2026_g6_it_march_week4_safe_communication_and_websites",
    "spark_type": "trivia",
    "title": "Safe Communication and Websites",
    "spark_text": "This week, Grade 6 connects its vocabulary to safe communication and basic website planning.",
    "why_it_matters": "This connects the weekly vocabulary to the work students will practice in class.",
    "question": "What is one idea from Safe Communication and Websites that could help your Technology work this week?",
    "source_title": "Technology Planning 2026",
    "source_url": "",
    "subject_slug": "technology",
    "target_grades": [
      "6"
    ],
    "scheduled_date": "2026-03-23",
    "status": "scheduled"
  },
  {
    "id": "technology_2026_g7_it_march_week4_robotics_robot_systems",
    "spark_type": "good_news",
    "title": "Robotics: Robot Systems",
    "spark_text": "This week, Grade 7 connects its vocabulary to robots as systems and debugging.",
    "why_it_matters": "This connects the weekly vocabulary to the work students will practice in class.",
    "question": "What is one robot behavior, sensor detail, or safety habit from Robotics: Robot Systems that your team should test carefully?",
    "source_title": "Technology Planning 2026",
    "source_url": "",
    "subject_slug": "technology",
    "target_grades": [
      "7"
    ],
    "scheduled_date": "2026-03-23",
    "status": "scheduled"
  },
  {
    "id": "technology_2026_g8_it_march_week4_svg_and_markup",
    "spark_type": "debate",
    "title": "SVG and Markup",
    "spark_text": "This week, Grade 8 connects its vocabulary to Grade 8 first-trimester work.",
    "why_it_matters": "This connects the weekly vocabulary to the work students will practice in class.",
    "question": "What is one idea from SVG and Markup that could help your Technology work this week?",
    "source_title": "Technology Planning 2026",
    "source_url": "",
    "subject_slug": "technology",
    "target_grades": [
      "8"
    ],
    "scheduled_date": "2026-03-23",
    "status": "scheduled"
  },
  {
    "id": "technology_2026_g9_it_march_week4_button_toggle",
    "spark_type": "reflection",
    "title": "Button Toggle",
    "spark_text": "This week, Grade 9 connects its vocabulary to Grade 9 first-trimester physical computing work.",
    "why_it_matters": "This connects the weekly vocabulary to the work students will practice in class.",
    "question": "What is one idea from Button Toggle that could help your Technology work this week?",
    "source_title": "Technology Planning 2026",
    "source_url": "",
    "subject_slug": "technology",
    "target_grades": [
      "9"
    ],
    "scheduled_date": "2026-03-23",
    "status": "scheduled"
  },
  {
    "id": "technology_2026_g6_it_april_week1_copyright_and_images",
    "spark_type": "reflection",
    "title": "Copyright and Images",
    "spark_text": "This week, Grade 6 connects its vocabulary to choosing safe images and giving credit.",
    "why_it_matters": "This connects the weekly vocabulary to the work students will practice in class.",
    "question": "What is one idea from Copyright and Images that could help your Technology work this week?",
    "source_title": "Technology Planning 2026",
    "source_url": "",
    "subject_slug": "technology",
    "target_grades": [
      "6"
    ],
    "scheduled_date": "2026-04-01",
    "status": "scheduled"
  },
  {
    "id": "technology_2026_g7_it_april_week5_robotics_calibration",
    "spark_type": "reflection",
    "title": "Robotics: Calibration",
    "spark_text": "This week, Grade 7 connects its vocabulary to speed, time, distance, and accuracy.",
    "why_it_matters": "This connects the weekly vocabulary to the work students will practice in class.",
    "question": "What is one robot behavior, sensor detail, or safety habit from Robotics: Calibration that your team should test carefully?",
    "source_title": "Technology Planning 2026",
    "source_url": "",
    "subject_slug": "technology",
    "target_grades": [
      "7"
    ],
    "scheduled_date": "2026-04-01",
    "status": "scheduled"
  },
  {
    "id": "technology_2026_g8_it_april_week5_computing_systems",
    "spark_type": "cool_fact",
    "title": "Computing Systems",
    "spark_text": "This week, Grade 8 connects its vocabulary to Grade 8 first-trimester work.",
    "why_it_matters": "This connects the weekly vocabulary to the work students will practice in class.",
    "question": "What is one idea from Computing Systems that could help your Technology work this week?",
    "source_title": "Technology Planning 2026",
    "source_url": "",
    "subject_slug": "technology",
    "target_grades": [
      "8"
    ],
    "scheduled_date": "2026-04-01",
    "status": "scheduled"
  },
  {
    "id": "technology_2026_g9_it_april_week5_serial_and_analog",
    "spark_type": "trivia",
    "title": "Serial and Analog",
    "spark_text": "This week, Grade 9 connects its vocabulary to Grade 9 first-trimester physical computing work.",
    "why_it_matters": "This connects the weekly vocabulary to the work students will practice in class.",
    "question": "What is one idea from Serial and Analog that could help your Technology work this week?",
    "source_title": "Technology Planning 2026",
    "source_url": "",
    "subject_slug": "technology",
    "target_grades": [
      "9"
    ],
    "scheduled_date": "2026-04-01",
    "status": "scheduled"
  },
  {
    "id": "technology_2026_g7_it_april_week6_robotics_route_planning",
    "spark_type": "cool_fact",
    "title": "Robotics: Route Planning",
    "spark_text": "This week, Grade 7 connects its vocabulary to planning and improving robot routes.",
    "why_it_matters": "This connects the weekly vocabulary to the work students will practice in class.",
    "question": "What is one robot behavior, sensor detail, or safety habit from Robotics: Route Planning that your team should test carefully?",
    "source_title": "Technology Planning 2026",
    "source_url": "",
    "subject_slug": "technology",
    "target_grades": [
      "7"
    ],
    "scheduled_date": "2026-04-06",
    "status": "scheduled"
  },
  {
    "id": "technology_2026_g8_it_april_week6_ai_and_responsible_remix",
    "spark_type": "trivia",
    "title": "AI and Responsible Remix",
    "spark_text": "This week, Grade 8 connects its vocabulary to Grade 8 first-trimester work.",
    "why_it_matters": "This connects the weekly vocabulary to the work students will practice in class.",
    "question": "What is one idea from AI and Responsible Remix that could help your Technology work this week?",
    "source_title": "Technology Planning 2026",
    "source_url": "",
    "subject_slug": "technology",
    "target_grades": [
      "8"
    ],
    "scheduled_date": "2026-04-06",
    "status": "scheduled"
  },
  {
    "id": "technology_2026_g9_it_april_week6_sensor_and_rgb",
    "spark_type": "good_news",
    "title": "Sensor and RGB",
    "spark_text": "This week, Grade 9 connects its vocabulary to Grade 9 first-trimester physical computing work.",
    "why_it_matters": "This connects the weekly vocabulary to the work students will practice in class.",
    "question": "What is one robot behavior, sensor detail, or safety habit from Sensor and RGB that your team should test carefully?",
    "source_title": "Technology Planning 2026",
    "source_url": "",
    "subject_slug": "technology",
    "target_grades": [
      "9"
    ],
    "scheduled_date": "2026-04-06",
    "status": "scheduled"
  },
  {
    "id": "technology_2026_g6_it_april_week2_web_page_structure",
    "spark_type": "cool_fact",
    "title": "Web Page Structure",
    "spark_text": "This week, Grade 6 connects its vocabulary to organizing and previewing a web page.",
    "why_it_matters": "This connects the weekly vocabulary to the work students will practice in class.",
    "question": "What is one idea from Web Page Structure that could help your Technology work this week?",
    "source_title": "Technology Planning 2026",
    "source_url": "",
    "subject_slug": "technology",
    "target_grades": [
      "6"
    ],
    "scheduled_date": "2026-04-08",
    "status": "scheduled"
  },
  {
    "id": "technology_2026_g7_it_april_week7_feedback_signals",
    "spark_type": "trivia",
    "title": "Feedback Signals",
    "spark_text": "This week, Grade 7 connects its vocabulary to lights, sound, and robot state signals.",
    "why_it_matters": "This connects the weekly vocabulary to the work students will practice in class.",
    "question": "What is one idea from Feedback Signals that could help your Technology work this week?",
    "source_title": "Technology Planning 2026",
    "source_url": "",
    "subject_slug": "technology",
    "target_grades": [
      "7"
    ],
    "scheduled_date": "2026-04-13",
    "status": "scheduled"
  },
  {
    "id": "technology_2026_g8_it_april_week7_html_and_css",
    "spark_type": "good_news",
    "title": "HTML and CSS",
    "spark_text": "This week, Grade 8 connects its vocabulary to Grade 8 first-trimester work.",
    "why_it_matters": "This connects the weekly vocabulary to the work students will practice in class.",
    "question": "What is one idea from HTML and CSS that could help your Technology work this week?",
    "source_title": "Technology Planning 2026",
    "source_url": "",
    "subject_slug": "technology",
    "target_grades": [
      "8"
    ],
    "scheduled_date": "2026-04-13",
    "status": "scheduled"
  },
  {
    "id": "technology_2026_g9_it_april_week7_led_teamwork",
    "spark_type": "debate",
    "title": "LED Teamwork",
    "spark_text": "This week, Grade 9 connects its vocabulary to Grade 9 first-trimester physical computing work.",
    "why_it_matters": "This connects the weekly vocabulary to the work students will practice in class.",
    "question": "What is one idea from LED Teamwork that could help your Technology work this week?",
    "source_title": "Technology Planning 2026",
    "source_url": "",
    "subject_slug": "technology",
    "target_grades": [
      "9"
    ],
    "scheduled_date": "2026-04-13",
    "status": "scheduled"
  },
  {
    "id": "technology_2026_g6_it_april_week3_links_and_navigation",
    "spark_type": "trivia",
    "title": "Links and Navigation",
    "spark_text": "This week, Grade 6 connects its vocabulary to moving around a website and testing links.",
    "why_it_matters": "This connects the weekly vocabulary to the work students will practice in class.",
    "question": "What is one idea from Links and Navigation that could help your Technology work this week?",
    "source_title": "Technology Planning 2026",
    "source_url": "",
    "subject_slug": "technology",
    "target_grades": [
      "6"
    ],
    "scheduled_date": "2026-04-15",
    "status": "scheduled"
  },
  {
    "id": "technology_2026_g7_it_april_week8_robotics_sensor_conditions",
    "spark_type": "good_news",
    "title": "Robotics: Sensor Conditions",
    "spark_text": "This week, Grade 7 connects its vocabulary to ultrasonic sensors and if/else reactions.",
    "why_it_matters": "This connects the weekly vocabulary to the work students will practice in class.",
    "question": "What is one robot behavior, sensor detail, or safety habit from Robotics: Sensor Conditions that your team should test carefully?",
    "source_title": "Technology Planning 2026",
    "source_url": "",
    "subject_slug": "technology",
    "target_grades": [
      "7"
    ],
    "scheduled_date": "2026-04-20",
    "status": "scheduled"
  },
  {
    "id": "technology_2026_g8_it_april_week8_search_and_portfolio",
    "spark_type": "debate",
    "title": "Search and Portfolio",
    "spark_text": "This week, Grade 8 connects its vocabulary to Grade 8 first-trimester work.",
    "why_it_matters": "This connects the weekly vocabulary to the work students will practice in class.",
    "question": "What is one idea from Search and Portfolio that could help your Technology work this week?",
    "source_title": "Technology Planning 2026",
    "source_url": "",
    "subject_slug": "technology",
    "target_grades": [
      "8"
    ],
    "scheduled_date": "2026-04-20",
    "status": "scheduled"
  },
  {
    "id": "technology_2026_g9_it_april_week8_state_prototype",
    "spark_type": "reflection",
    "title": "State Prototype",
    "spark_text": "This week, Grade 9 connects its vocabulary to Grade 9 first-trimester physical computing work.",
    "why_it_matters": "This connects the weekly vocabulary to the work students will practice in class.",
    "question": "What is one idea from State Prototype that could help your Technology work this week?",
    "source_title": "Technology Planning 2026",
    "source_url": "",
    "subject_slug": "technology",
    "target_grades": [
      "9"
    ],
    "scheduled_date": "2026-04-20",
    "status": "scheduled"
  },
  {
    "id": "technology_2026_g6_it_april_week4_scratch_variables",
    "spark_type": "good_news",
    "title": "Scratch Variables",
    "spark_text": "This week, Grade 6 connects its vocabulary to a Scratch score challenge.",
    "why_it_matters": "This connects the weekly vocabulary to the work students will practice in class.",
    "question": "What is one idea from Scratch Variables that could help your Technology work this week?",
    "source_title": "Technology Planning 2026",
    "source_url": "",
    "subject_slug": "technology",
    "target_grades": [
      "6"
    ],
    "scheduled_date": "2026-04-22",
    "status": "scheduled"
  },
  {
    "id": "technology_2026_g6_it_may_week1_internet_day",
    "spark_type": "cool_fact",
    "title": "Internet Day",
    "spark_text": "This week, Grade 6 connects its vocabulary to responsible Internet Day choices and campaign messages.",
    "why_it_matters": "This connects the weekly vocabulary to the work students will practice in class.",
    "question": "What is one idea from Internet Day that could help your Technology work this week?",
    "source_title": "Technology Planning 2026",
    "source_url": "",
    "subject_slug": "technology",
    "target_grades": [
      "6"
    ],
    "scheduled_date": "2026-05-01",
    "status": "scheduled"
  },
  {
    "id": "technology_2026_g7_it_may_week9_robotics_maze_planning",
    "spark_type": "reflection",
    "title": "Robotics: Maze Planning",
    "spark_text": "This week, Grade 7 connects its vocabulary to maze route planning.",
    "why_it_matters": "This connects the weekly vocabulary to the work students will practice in class.",
    "question": "What is one robot behavior, sensor detail, or safety habit from Robotics: Maze Planning that your team should test carefully?",
    "source_title": "Technology Planning 2026",
    "source_url": "",
    "subject_slug": "technology",
    "target_grades": [
      "7"
    ],
    "scheduled_date": "2026-05-01",
    "status": "scheduled"
  },
  {
    "id": "technology_2026_g8_it_may_week9_portfolio_planning",
    "spark_type": "cool_fact",
    "title": "Portfolio Planning",
    "spark_text": "This week, Grade 8 connects its vocabulary to Grade 8 first-trimester work.",
    "why_it_matters": "This connects the weekly vocabulary to the work students will practice in class.",
    "question": "What is one idea from Portfolio Planning that could help your Technology work this week?",
    "source_title": "Technology Planning 2026",
    "source_url": "",
    "subject_slug": "technology",
    "target_grades": [
      "8"
    ],
    "scheduled_date": "2026-05-01",
    "status": "scheduled"
  },
  {
    "id": "technology_2026_g9_it_may_week9_robot_design",
    "spark_type": "trivia",
    "title": "Robot Design",
    "spark_text": "This week, Grade 9 connects its vocabulary to Grade 9 first-trimester physical computing work.",
    "why_it_matters": "This connects the weekly vocabulary to the work students will practice in class.",
    "question": "What is one robot behavior, sensor detail, or safety habit from Robot Design that your team should test carefully?",
    "source_title": "Technology Planning 2026",
    "source_url": "",
    "subject_slug": "technology",
    "target_grades": [
      "9"
    ],
    "scheduled_date": "2026-05-01",
    "status": "scheduled"
  },
  {
    "id": "technology_2026_g7_it_may_week10_project_plan",
    "spark_type": "cool_fact",
    "title": "Project Plan",
    "spark_text": "This week, Grade 7 connects its vocabulary to planning the mBot maze project.",
    "why_it_matters": "This connects the weekly vocabulary to the work students will practice in class.",
    "question": "What is one idea from Project Plan that could help your Technology work this week?",
    "source_title": "Technology Planning 2026",
    "source_url": "",
    "subject_slug": "technology",
    "target_grades": [
      "7"
    ],
    "scheduled_date": "2026-05-04",
    "status": "scheduled"
  },
  {
    "id": "technology_2026_g8_it_may_week10_homepage_and_media",
    "spark_type": "trivia",
    "title": "Homepage and Media",
    "spark_text": "This week, Grade 8 connects its vocabulary to Grade 8 first-trimester work.",
    "why_it_matters": "This connects the weekly vocabulary to the work students will practice in class.",
    "question": "What is one idea from Homepage and Media that could help your Technology work this week?",
    "source_title": "Technology Planning 2026",
    "source_url": "",
    "subject_slug": "technology",
    "target_grades": [
      "8"
    ],
    "scheduled_date": "2026-05-04",
    "status": "scheduled"
  },
  {
    "id": "technology_2026_g9_it_may_week10_project_build",
    "spark_type": "good_news",
    "title": "Project Build",
    "spark_text": "This week, Grade 9 connects its vocabulary to Grade 9 first-trimester physical computing work.",
    "why_it_matters": "This connects the weekly vocabulary to the work students will practice in class.",
    "question": "What is one idea from Project Build that could help your Technology work this week?",
    "source_title": "Technology Planning 2026",
    "source_url": "",
    "subject_slug": "technology",
    "target_grades": [
      "9"
    ],
    "scheduled_date": "2026-05-04",
    "status": "scheduled"
  },
  {
    "id": "technology_2026_g6_it_may_week2_recycling_and_e_waste",
    "spark_type": "trivia",
    "title": "Recycling and E-Waste",
    "spark_text": "This week, Grade 6 connects its vocabulary to responsible technology waste choices.",
    "why_it_matters": "This connects the weekly vocabulary to the work students will practice in class.",
    "question": "What is one idea from Recycling and E-Waste that could help your Technology work this week?",
    "source_title": "Technology Planning 2026",
    "source_url": "",
    "subject_slug": "technology",
    "target_grades": [
      "6"
    ],
    "scheduled_date": "2026-05-08",
    "status": "scheduled"
  },
  {
    "id": "technology_2026_g7_it_may_week11_testing_and_debugging",
    "spark_type": "trivia",
    "title": "Testing and Debugging",
    "spark_text": "This week, Grade 7 connects its vocabulary to debugging and documenting robot performance.",
    "why_it_matters": "This connects the weekly vocabulary to the work students will practice in class.",
    "question": "What is one idea from Testing and Debugging that could help your Technology work this week?",
    "source_title": "Technology Planning 2026",
    "source_url": "",
    "subject_slug": "technology",
    "target_grades": [
      "7"
    ],
    "scheduled_date": "2026-05-11",
    "status": "scheduled"
  },
  {
    "id": "technology_2026_g8_it_may_week11_testing_and_revision",
    "spark_type": "good_news",
    "title": "Testing and Revision",
    "spark_text": "This week, Grade 8 connects its vocabulary to Grade 8 first-trimester work.",
    "why_it_matters": "This connects the weekly vocabulary to the work students will practice in class.",
    "question": "What is one idea from Testing and Revision that could help your Technology work this week?",
    "source_title": "Technology Planning 2026",
    "source_url": "",
    "subject_slug": "technology",
    "target_grades": [
      "8"
    ],
    "scheduled_date": "2026-05-11",
    "status": "scheduled"
  },
  {
    "id": "technology_2026_g9_it_may_week11_reliability",
    "spark_type": "debate",
    "title": "Reliability",
    "spark_text": "This week, Grade 9 connects its vocabulary to Grade 9 first-trimester physical computing work.",
    "why_it_matters": "This connects the weekly vocabulary to the work students will practice in class.",
    "question": "What is one idea from Reliability that could help your Technology work this week?",
    "source_title": "Technology Planning 2026",
    "source_url": "",
    "subject_slug": "technology",
    "target_grades": [
      "9"
    ],
    "scheduled_date": "2026-05-11",
    "status": "scheduled"
  },
  {
    "id": "technology_2026_g6_it_may_week3_awareness_product",
    "spark_type": "good_news",
    "title": "Awareness Product",
    "spark_text": "This week, Grade 6 connects its vocabulary to planning and presenting an awareness product.",
    "why_it_matters": "This connects the weekly vocabulary to the work students will practice in class.",
    "question": "What is one idea from Awareness Product that could help your Technology work this week?",
    "source_title": "Technology Planning 2026",
    "source_url": "",
    "subject_slug": "technology",
    "target_grades": [
      "6"
    ],
    "scheduled_date": "2026-05-15",
    "status": "scheduled"
  },
  {
    "id": "technology_2026_g7_it_may_week12_presentation",
    "spark_type": "good_news",
    "title": "Presentation",
    "spark_text": "This week, Grade 7 connects its vocabulary to presenting the maze solution.",
    "why_it_matters": "This connects the weekly vocabulary to the work students will practice in class.",
    "question": "What is one idea from Presentation that could help your Technology work this week?",
    "source_title": "Technology Planning 2026",
    "source_url": "",
    "subject_slug": "technology",
    "target_grades": [
      "7"
    ],
    "scheduled_date": "2026-05-18",
    "status": "scheduled"
  },
  {
    "id": "technology_2026_g8_it_may_week12_presentation",
    "spark_type": "debate",
    "title": "Presentation",
    "spark_text": "This week, Grade 8 connects its vocabulary to Grade 8 first-trimester work.",
    "why_it_matters": "This connects the weekly vocabulary to the work students will practice in class.",
    "question": "What is one idea from Presentation that could help your Technology work this week?",
    "source_title": "Technology Planning 2026",
    "source_url": "",
    "subject_slug": "technology",
    "target_grades": [
      "8"
    ],
    "scheduled_date": "2026-05-18",
    "status": "scheduled"
  },
  {
    "id": "technology_2026_g9_it_may_week12_demonstration",
    "spark_type": "reflection",
    "title": "Demonstration",
    "spark_text": "This week, Grade 9 connects its vocabulary to Grade 9 first-trimester physical computing work.",
    "why_it_matters": "This connects the weekly vocabulary to the work students will practice in class.",
    "question": "What is one idea from Demonstration that could help your Technology work this week?",
    "source_title": "Technology Planning 2026",
    "source_url": "",
    "subject_slug": "technology",
    "target_grades": [
      "9"
    ],
    "scheduled_date": "2026-05-18",
    "status": "scheduled"
  },
  {
    "id": "technology_2026_g8_it_may_week13_archive_and_reflection",
    "spark_type": "reflection",
    "title": "Archive and Reflection",
    "spark_text": "This week, Grade 8 connects its vocabulary to Grade 8 first-trimester work.",
    "why_it_matters": "This connects the weekly vocabulary to the work students will practice in class.",
    "question": "What is one idea from Archive and Reflection that could help your Technology work this week?",
    "source_title": "Technology Planning 2026",
    "source_url": "",
    "subject_slug": "technology",
    "target_grades": [
      "8"
    ],
    "scheduled_date": "2026-05-25",
    "status": "scheduled"
  },
  {
    "id": "technology_2026_g9_it_may_week13_archive",
    "spark_type": "cool_fact",
    "title": "Archive",
    "spark_text": "This week, Grade 9 connects its vocabulary to Grade 9 first-trimester physical computing work.",
    "why_it_matters": "This connects the weekly vocabulary to the work students will practice in class.",
    "question": "What is one idea from Archive that could help your Technology work this week?",
    "source_title": "Technology Planning 2026",
    "source_url": "",
    "subject_slug": "technology",
    "target_grades": [
      "9"
    ],
    "scheduled_date": "2026-05-25",
    "status": "scheduled"
  },
  {
    "id": "technology_2026_g6_iit_june_week1_robotics_vocabulary",
    "spark_type": "trivia",
    "title": "Robotics Vocabulary",
    "spark_text": "This week, Grade 6 connects its vocabulary to core second-trimester words for the Grade 6 robotics summative vocabulary table.",
    "why_it_matters": "This connects the weekly vocabulary to the work students will practice in class.",
    "question": "What is one robot behavior, sensor detail, or safety habit from Robotics Vocabulary that your team should test carefully?",
    "source_title": "Technology Planning 2026",
    "source_url": "",
    "subject_slug": "technology",
    "target_grades": [
      "6"
    ],
    "scheduled_date": "2026-06-08",
    "status": "scheduled"
  },
  {
    "id": "technology_2026_g7_iit_june_week1_poster_and_media_design",
    "spark_type": "good_news",
    "title": "Poster and Media Design",
    "spark_text": "This week, Grade 7 connects its vocabulary to core second-trimester words for the Grade 7 poster and media design vocabulary table.",
    "why_it_matters": "This connects the weekly vocabulary to the work students will practice in class.",
    "question": "What is one idea from Poster and Media Design that could help your Technology work this week?",
    "source_title": "Technology Planning 2026",
    "source_url": "",
    "subject_slug": "technology",
    "target_grades": [
      "7"
    ],
    "scheduled_date": "2026-06-08",
    "status": "scheduled"
  },
  {
    "id": "technology_2026_g8_iit_june_week1_arduino_basics",
    "spark_type": "debate",
    "title": "Arduino Basics",
    "spark_text": "This week, Grade 8 connects its vocabulary to core second-trimester words for the Grade 8 Arduino vocabulary table.",
    "why_it_matters": "This connects the weekly vocabulary to the work students will practice in class.",
    "question": "What is one idea from Arduino Basics that could help your Technology work this week?",
    "source_title": "Technology Planning 2026",
    "source_url": "",
    "subject_slug": "technology",
    "target_grades": [
      "8"
    ],
    "scheduled_date": "2026-06-08",
    "status": "scheduled"
  },
  {
    "id": "technology_2026_g9_iit_june_week1_python_and_data",
    "spark_type": "reflection",
    "title": "Python and Data",
    "spark_text": "This week, Grade 9 connects its vocabulary to core second-trimester words for the Grade 9 Python and data vocabulary table.",
    "why_it_matters": "This connects the weekly vocabulary to the work students will practice in class.",
    "question": "What is one data detail, pattern, or Python idea from Python and Data that could help your work this week?",
    "source_title": "Technology Planning 2026",
    "source_url": "",
    "subject_slug": "technology",
    "target_grades": [
      "9"
    ],
    "scheduled_date": "2026-06-08",
    "status": "scheduled"
  },
  {
    "id": "technology_2026_g6_iit_june_week2_robotics_movement_instructions",
    "spark_type": "good_news",
    "title": "Robotics: Movement Instructions",
    "spark_text": "This week, Grade 6 connects its vocabulary to movement instructions and timing.",
    "why_it_matters": "This connects the weekly vocabulary to the work students will practice in class.",
    "question": "What is one robot behavior, sensor detail, or safety habit from Robotics: Movement Instructions that your team should test carefully?",
    "source_title": "Technology Planning 2026",
    "source_url": "",
    "subject_slug": "technology",
    "target_grades": [
      "6"
    ],
    "scheduled_date": "2026-06-15",
    "status": "scheduled"
  },
  {
    "id": "technology_2026_g7_iit_june_week2_branding",
    "spark_type": "debate",
    "title": "Branding",
    "spark_text": "This week, Grade 7 connects its vocabulary to branding and consistent design.",
    "why_it_matters": "This connects the weekly vocabulary to the work students will practice in class.",
    "question": "What is one idea from Branding that could help your Technology work this week?",
    "source_title": "Technology Planning 2026",
    "source_url": "",
    "subject_slug": "technology",
    "target_grades": [
      "7"
    ],
    "scheduled_date": "2026-06-15",
    "status": "scheduled"
  },
  {
    "id": "technology_2026_g8_iit_june_week2_led_and_button",
    "spark_type": "reflection",
    "title": "LED and Button",
    "spark_text": "This week, Grade 8 connects its vocabulary to Grade 8 second-trimester Arduino work.",
    "why_it_matters": "This connects the weekly vocabulary to the work students will practice in class.",
    "question": "What is one idea from LED and Button that could help your Technology work this week?",
    "source_title": "Technology Planning 2026",
    "source_url": "",
    "subject_slug": "technology",
    "target_grades": [
      "8"
    ],
    "scheduled_date": "2026-06-15",
    "status": "scheduled"
  },
  {
    "id": "technology_2026_g9_iit_june_week2_python_and_data_list_methods",
    "spark_type": "cool_fact",
    "title": "Python and Data: List Methods",
    "spark_text": "This week, Grade 9 connects its vocabulary to Grade 9 second-trimester Python and data work.",
    "why_it_matters": "This connects the weekly vocabulary to the work students will practice in class.",
    "question": "What is one data detail, pattern, or Python idea from Python and Data: List Methods that could help your work this week?",
    "source_title": "Technology Planning 2026",
    "source_url": "",
    "subject_slug": "technology",
    "target_grades": [
      "9"
    ],
    "scheduled_date": "2026-06-15",
    "status": "scheduled"
  },
  {
    "id": "technology_2026_g6_iit_june_week3_debugging_paths",
    "spark_type": "debate",
    "title": "Debugging Paths",
    "spark_text": "This week, Grade 6 connects its vocabulary to testing, debugging, and improving robot paths.",
    "why_it_matters": "This connects the weekly vocabulary to the work students will practice in class.",
    "question": "What is one idea from Debugging Paths that could help your Technology work this week?",
    "source_title": "Technology Planning 2026",
    "source_url": "",
    "subject_slug": "technology",
    "target_grades": [
      "6"
    ],
    "scheduled_date": "2026-06-22",
    "status": "scheduled"
  },
  {
    "id": "technology_2026_g7_iit_july_week3_scratch_intro",
    "spark_type": "cool_fact",
    "title": "Scratch Intro",
    "spark_text": "This week, Grade 7 connects its vocabulary to Scratch sequences and events.",
    "why_it_matters": "This connects the weekly vocabulary to the work students will practice in class.",
    "question": "What is one idea from Scratch Intro that could help your Technology work this week?",
    "source_title": "Technology Planning 2026",
    "source_url": "",
    "subject_slug": "technology",
    "target_grades": [
      "7"
    ],
    "scheduled_date": "2026-06-22",
    "status": "scheduled"
  },
  {
    "id": "technology_2026_g8_iit_june_week3_state_and_serial",
    "spark_type": "cool_fact",
    "title": "State and Serial",
    "spark_text": "This week, Grade 8 connects its vocabulary to Grade 8 second-trimester Arduino work.",
    "why_it_matters": "This connects the weekly vocabulary to the work students will practice in class.",
    "question": "What is one idea from State and Serial that could help your Technology work this week?",
    "source_title": "Technology Planning 2026",
    "source_url": "",
    "subject_slug": "technology",
    "target_grades": [
      "8"
    ],
    "scheduled_date": "2026-06-22",
    "status": "scheduled"
  },
  {
    "id": "technology_2026_g9_iit_june_week3_python_and_data_loops_and_strings",
    "spark_type": "trivia",
    "title": "Python and Data: Loops and Strings",
    "spark_text": "This week, Grade 9 connects its vocabulary to Grade 9 second-trimester Python and data work.",
    "why_it_matters": "This connects the weekly vocabulary to the work students will practice in class.",
    "question": "What is one data detail, pattern, or Python idea from Python and Data: Loops and Strings that could help your work this week?",
    "source_title": "Technology Planning 2026",
    "source_url": "",
    "subject_slug": "technology",
    "target_grades": [
      "9"
    ],
    "scheduled_date": "2026-06-22",
    "status": "scheduled"
  },
  {
    "id": "technology_2026_g6_iit_june_week4_robotics_robot_outputs",
    "spark_type": "reflection",
    "title": "Robotics: Robot Outputs",
    "spark_text": "This week, Grade 6 connects its vocabulary to robot outputs and signals.",
    "why_it_matters": "This connects the weekly vocabulary to the work students will practice in class.",
    "question": "What is one robot behavior, sensor detail, or safety habit from Robotics: Robot Outputs that your team should test carefully?",
    "source_title": "Technology Planning 2026",
    "source_url": "",
    "subject_slug": "technology",
    "target_grades": [
      "6"
    ],
    "scheduled_date": "2026-06-29",
    "status": "scheduled"
  },
  {
    "id": "technology_2026_g8_iit_june_week4_safe_debugging",
    "spark_type": "trivia",
    "title": "Safe Debugging",
    "spark_text": "This week, Grade 8 connects its vocabulary to Grade 8 second-trimester Arduino work.",
    "why_it_matters": "This connects the weekly vocabulary to the work students will practice in class.",
    "question": "What is one idea from Safe Debugging that could help your Technology work this week?",
    "source_title": "Technology Planning 2026",
    "source_url": "",
    "subject_slug": "technology",
    "target_grades": [
      "8"
    ],
    "scheduled_date": "2026-06-29",
    "status": "scheduled"
  },
  {
    "id": "technology_2026_g7_iit_july_week4_variables",
    "spark_type": "trivia",
    "title": "Variables",
    "spark_text": "This week, Grade 7 connects its vocabulary to variables and if/else choices.",
    "why_it_matters": "This connects the weekly vocabulary to the work students will practice in class.",
    "question": "What is one idea from Variables that could help your Technology work this week?",
    "source_title": "Technology Planning 2026",
    "source_url": "",
    "subject_slug": "technology",
    "target_grades": [
      "7"
    ],
    "scheduled_date": "2026-07-01",
    "status": "scheduled"
  },
  {
    "id": "technology_2026_g9_iit_july_week4_python_and_data_data_science",
    "spark_type": "debate",
    "title": "Python and Data: Data Science",
    "spark_text": "This week, Grade 9 connects its vocabulary to Grade 9 second-trimester Python and data work.",
    "why_it_matters": "This connects the weekly vocabulary to the work students will practice in class.",
    "question": "What is one data detail, pattern, or Python idea from Python and Data: Data Science that could help your work this week?",
    "source_title": "Technology Planning 2026",
    "source_url": "",
    "subject_slug": "technology",
    "target_grades": [
      "9"
    ],
    "scheduled_date": "2026-07-01",
    "status": "scheduled"
  },
  {
    "id": "technology_2026_g6_iit_july_week5_robotics_route_accuracy",
    "spark_type": "trivia",
    "title": "Robotics: Route Accuracy",
    "spark_text": "This week, Grade 6 connects its vocabulary to route maps and accurate movement.",
    "why_it_matters": "This connects the weekly vocabulary to the work students will practice in class.",
    "question": "What is one robot behavior, sensor detail, or safety habit from Robotics: Route Accuracy that your team should test carefully?",
    "source_title": "Technology Planning 2026",
    "source_url": "",
    "subject_slug": "technology",
    "target_grades": [
      "6"
    ],
    "scheduled_date": "2026-07-06",
    "status": "scheduled"
  },
  {
    "id": "technology_2026_g7_iit_july_week5_operators",
    "spark_type": "good_news",
    "title": "Operators",
    "spark_text": "This week, Grade 7 connects its vocabulary to comparison and logic operators.",
    "why_it_matters": "This connects the weekly vocabulary to the work students will practice in class.",
    "question": "What is one idea from Operators that could help your Technology work this week?",
    "source_title": "Technology Planning 2026",
    "source_url": "",
    "subject_slug": "technology",
    "target_grades": [
      "7"
    ],
    "scheduled_date": "2026-07-06",
    "status": "scheduled"
  },
  {
    "id": "technology_2026_g8_iit_july_week5_analog_values",
    "spark_type": "debate",
    "title": "Analog Values",
    "spark_text": "This week, Grade 8 connects its vocabulary to Grade 8 second-trimester Arduino work.",
    "why_it_matters": "This connects the weekly vocabulary to the work students will practice in class.",
    "question": "What is one idea from Analog Values that could help your Technology work this week?",
    "source_title": "Technology Planning 2026",
    "source_url": "",
    "subject_slug": "technology",
    "target_grades": [
      "8"
    ],
    "scheduled_date": "2026-07-06",
    "status": "scheduled"
  },
  {
    "id": "technology_2026_g9_iit_july_week5_python_and_data_collection_plan",
    "spark_type": "reflection",
    "title": "Python and Data: Collection Plan",
    "spark_text": "This week, Grade 9 connects its vocabulary to Grade 9 second-trimester Python and data work.",
    "why_it_matters": "This connects the weekly vocabulary to the work students will practice in class.",
    "question": "What is one data detail, pattern, or Python idea from Python and Data: Collection Plan that could help your work this week?",
    "source_title": "Technology Planning 2026",
    "source_url": "",
    "subject_slug": "technology",
    "target_grades": [
      "9"
    ],
    "scheduled_date": "2026-07-06",
    "status": "scheduled"
  },
  {
    "id": "technology_2026_g6_iit_july_week6_repeat_patterns",
    "spark_type": "good_news",
    "title": "Repeat Patterns",
    "spark_text": "This week, Grade 6 connects its vocabulary to loops and repeated movement patterns.",
    "why_it_matters": "This connects the weekly vocabulary to the work students will practice in class.",
    "question": "What is one idea from Repeat Patterns that could help your Technology work this week?",
    "source_title": "Technology Planning 2026",
    "source_url": "",
    "subject_slug": "technology",
    "target_grades": [
      "6"
    ],
    "scheduled_date": "2026-07-13",
    "status": "scheduled"
  },
  {
    "id": "technology_2026_g7_iit_july_week6_loops",
    "spark_type": "debate",
    "title": "Loops",
    "spark_text": "This week, Grade 7 connects its vocabulary to loops and timing.",
    "why_it_matters": "This connects the weekly vocabulary to the work students will practice in class.",
    "question": "What is one idea from Loops that could help your Technology work this week?",
    "source_title": "Technology Planning 2026",
    "source_url": "",
    "subject_slug": "technology",
    "target_grades": [
      "7"
    ],
    "scheduled_date": "2026-07-13",
    "status": "scheduled"
  },
  {
    "id": "technology_2026_g8_iit_july_week6_light_and_rgb",
    "spark_type": "reflection",
    "title": "Light and RGB",
    "spark_text": "This week, Grade 8 connects its vocabulary to Grade 8 second-trimester Arduino work.",
    "why_it_matters": "This connects the weekly vocabulary to the work students will practice in class.",
    "question": "What is one idea from Light and RGB that could help your Technology work this week?",
    "source_title": "Technology Planning 2026",
    "source_url": "",
    "subject_slug": "technology",
    "target_grades": [
      "8"
    ],
    "scheduled_date": "2026-07-13",
    "status": "scheduled"
  },
  {
    "id": "technology_2026_g9_iit_july_week6_python_and_data_cleaning_and_model",
    "spark_type": "cool_fact",
    "title": "Python and Data: Cleaning and Model",
    "spark_text": "This week, Grade 9 connects its vocabulary to Grade 9 second-trimester Python and data work.",
    "why_it_matters": "This connects the weekly vocabulary to the work students will practice in class.",
    "question": "What is one data detail, pattern, or Python idea from Python and Data: Cleaning and Model that could help your work this week?",
    "source_title": "Technology Planning 2026",
    "source_url": "",
    "subject_slug": "technology",
    "target_grades": [
      "9"
    ],
    "scheduled_date": "2026-07-13",
    "status": "scheduled"
  },
  {
    "id": "technology_2026_g6_iit_july_week7_robotics_sensor_detection",
    "spark_type": "debate",
    "title": "Robotics: Sensor Detection",
    "spark_text": "This week, Grade 6 connects its vocabulary to sensors, inputs, and responses.",
    "why_it_matters": "This connects the weekly vocabulary to the work students will practice in class.",
    "question": "What is one robot behavior, sensor detail, or safety habit from Robotics: Sensor Detection that your team should test carefully?",
    "source_title": "Technology Planning 2026",
    "source_url": "",
    "subject_slug": "technology",
    "target_grades": [
      "6"
    ],
    "scheduled_date": "2026-07-20",
    "status": "scheduled"
  },
  {
    "id": "technology_2026_g7_iit_july_week7_debugging_roles",
    "spark_type": "reflection",
    "title": "Debugging Roles",
    "spark_text": "This week, Grade 7 connects its vocabulary to debugging and pair-programming roles.",
    "why_it_matters": "This connects the weekly vocabulary to the work students will practice in class.",
    "question": "What is one idea from Debugging Roles that could help your Technology work this week?",
    "source_title": "Technology Planning 2026",
    "source_url": "",
    "subject_slug": "technology",
    "target_grades": [
      "7"
    ],
    "scheduled_date": "2026-07-20",
    "status": "scheduled"
  },
  {
    "id": "technology_2026_g8_iit_july_week7_buzzer_and_servo",
    "spark_type": "cool_fact",
    "title": "Buzzer and Servo",
    "spark_text": "This week, Grade 8 connects its vocabulary to Grade 8 second-trimester Arduino work.",
    "why_it_matters": "This connects the weekly vocabulary to the work students will practice in class.",
    "question": "What is one idea from Buzzer and Servo that could help your Technology work this week?",
    "source_title": "Technology Planning 2026",
    "source_url": "",
    "subject_slug": "technology",
    "target_grades": [
      "8"
    ],
    "scheduled_date": "2026-07-20",
    "status": "scheduled"
  },
  {
    "id": "technology_2026_g9_iit_july_week7_python_and_data_charts_and_patterns",
    "spark_type": "trivia",
    "title": "Python and Data: Charts and Patterns",
    "spark_text": "This week, Grade 9 connects its vocabulary to Grade 9 second-trimester Python and data work.",
    "why_it_matters": "This connects the weekly vocabulary to the work students will practice in class.",
    "question": "What is one data detail, pattern, or Python idea from Python and Data: Charts and Patterns that could help your work this week?",
    "source_title": "Technology Planning 2026",
    "source_url": "",
    "subject_slug": "technology",
    "target_grades": [
      "9"
    ],
    "scheduled_date": "2026-07-20",
    "status": "scheduled"
  },
  {
    "id": "technology_2026_g6_iit_july_week8_conditions_and_flowcharts",
    "spark_type": "reflection",
    "title": "Conditions and Flowcharts",
    "spark_text": "This week, Grade 6 connects its vocabulary to simple conditions and robot responses.",
    "why_it_matters": "This connects the weekly vocabulary to the work students will practice in class.",
    "question": "What is one data detail, pattern, or Python idea from Conditions and Flowcharts that could help your work this week?",
    "source_title": "Technology Planning 2026",
    "source_url": "",
    "subject_slug": "technology",
    "target_grades": [
      "6"
    ],
    "scheduled_date": "2026-07-27",
    "status": "scheduled"
  },
  {
    "id": "technology_2026_g7_iit_august_week8_dance_prep",
    "spark_type": "trivia",
    "title": "Dance Prep",
    "spark_text": "This week, Grade 7 connects its vocabulary to dance game preparation.",
    "why_it_matters": "This connects the weekly vocabulary to the work students will practice in class.",
    "question": "What is one idea from Dance Prep that could help your Technology work this week?",
    "source_title": "Technology Planning 2026",
    "source_url": "",
    "subject_slug": "technology",
    "target_grades": [
      "7"
    ],
    "scheduled_date": "2026-07-27",
    "status": "scheduled"
  },
  {
    "id": "technology_2026_g8_iit_july_week8_integrated_challenge",
    "spark_type": "trivia",
    "title": "Integrated Challenge",
    "spark_text": "This week, Grade 8 connects its vocabulary to Grade 8 second-trimester Arduino work.",
    "why_it_matters": "This connects the weekly vocabulary to the work students will practice in class.",
    "question": "What is one idea from Integrated Challenge that could help your Technology work this week?",
    "source_title": "Technology Planning 2026",
    "source_url": "",
    "subject_slug": "technology",
    "target_grades": [
      "8"
    ],
    "scheduled_date": "2026-07-27",
    "status": "scheduled"
  },
  {
    "id": "technology_2026_g9_iit_august_week8_python_and_data_data_product",
    "spark_type": "debate",
    "title": "Python and Data: Data Product",
    "spark_text": "This week, Grade 9 connects its vocabulary to Grade 9 second-trimester Python and data work.",
    "why_it_matters": "This connects the weekly vocabulary to the work students will practice in class.",
    "question": "What is one data detail, pattern, or Python idea from Python and Data: Data Product that could help your work this week?",
    "source_title": "Technology Planning 2026",
    "source_url": "",
    "subject_slug": "technology",
    "target_grades": [
      "9"
    ],
    "scheduled_date": "2026-07-27",
    "status": "scheduled"
  },
  {
    "id": "technology_2026_g6_iit_august_week9_knowledge_cards",
    "spark_type": "trivia",
    "title": "Knowledge Cards",
    "spark_text": "This week, Grade 6 connects its vocabulary to mBot card stations and actions.",
    "why_it_matters": "This connects the weekly vocabulary to the work students will practice in class.",
    "question": "What is one idea from Knowledge Cards that could help your Technology work this week?",
    "source_title": "Technology Planning 2026",
    "source_url": "",
    "subject_slug": "technology",
    "target_grades": [
      "6"
    ],
    "scheduled_date": "2026-08-03",
    "status": "scheduled"
  },
  {
    "id": "technology_2026_g6_iit_july_week9_mini_challenge_plan",
    "spark_type": "cool_fact",
    "title": "Mini-Challenge Plan",
    "spark_text": "This week, Grade 6 connects its vocabulary to planning a small mBot challenge.",
    "why_it_matters": "This connects the weekly vocabulary to the work students will practice in class.",
    "question": "What is one idea from Mini-Challenge Plan that could help your Technology work this week?",
    "source_title": "Technology Planning 2026",
    "source_url": "",
    "subject_slug": "technology",
    "target_grades": [
      "6"
    ],
    "scheduled_date": "2026-08-03",
    "status": "scheduled"
  },
  {
    "id": "technology_2026_g7_iit_august_week9_project_planning",
    "spark_type": "good_news",
    "title": "Project Planning",
    "spark_text": "This week, Grade 7 connects its vocabulary to dance game planning and scoring.",
    "why_it_matters": "This connects the weekly vocabulary to the work students will practice in class.",
    "question": "What is one idea from Project Planning that could help your Technology work this week?",
    "source_title": "Technology Planning 2026",
    "source_url": "",
    "subject_slug": "technology",
    "target_grades": [
      "7"
    ],
    "scheduled_date": "2026-08-03",
    "status": "scheduled"
  },
  {
    "id": "technology_2026_g8_iit_august_week9_ultrasonic_design",
    "spark_type": "debate",
    "title": "Ultrasonic Design",
    "spark_text": "This week, Grade 8 connects its vocabulary to Grade 8 second-trimester Arduino work.",
    "why_it_matters": "This connects the weekly vocabulary to the work students will practice in class.",
    "question": "What is one idea from Ultrasonic Design that could help your Technology work this week?",
    "source_title": "Technology Planning 2026",
    "source_url": "",
    "subject_slug": "technology",
    "target_grades": [
      "8"
    ],
    "scheduled_date": "2026-08-03",
    "status": "scheduled"
  },
  {
    "id": "technology_2026_g9_iit_august_week9_python_and_data_project_readiness",
    "spark_type": "reflection",
    "title": "Python and Data: Project Readiness",
    "spark_text": "This week, Grade 9 connects its vocabulary to Grade 9 second-trimester Python and data work.",
    "why_it_matters": "This connects the weekly vocabulary to the work students will practice in class.",
    "question": "What is one data detail, pattern, or Python idea from Python and Data: Project Readiness that could help your work this week?",
    "source_title": "Technology Planning 2026",
    "source_url": "",
    "subject_slug": "technology",
    "target_grades": [
      "9"
    ],
    "scheduled_date": "2026-08-03",
    "status": "scheduled"
  },
  {
    "id": "technology_2026_g6_iit_august_week10_final_challenge_plan",
    "spark_type": "good_news",
    "title": "Final Challenge Plan",
    "spark_text": "This week, Grade 6 connects its vocabulary to planning and improving the final mBot challenge.",
    "why_it_matters": "This connects the weekly vocabulary to the work students will practice in class.",
    "question": "What is one idea from Final Challenge Plan that could help your Technology work this week?",
    "source_title": "Technology Planning 2026",
    "source_url": "",
    "subject_slug": "technology",
    "target_grades": [
      "6"
    ],
    "scheduled_date": "2026-08-10",
    "status": "scheduled"
  },
  {
    "id": "technology_2026_g7_iit_august_week10_build",
    "spark_type": "debate",
    "title": "Build",
    "spark_text": "This week, Grade 7 connects its vocabulary to building and testing dance game logic.",
    "why_it_matters": "This connects the weekly vocabulary to the work students will practice in class.",
    "question": "What is one idea from Build that could help your Technology work this week?",
    "source_title": "Technology Planning 2026",
    "source_url": "",
    "subject_slug": "technology",
    "target_grades": [
      "7"
    ],
    "scheduled_date": "2026-08-10",
    "status": "scheduled"
  },
  {
    "id": "technology_2026_g8_iit_august_week10_prototype_build",
    "spark_type": "reflection",
    "title": "Prototype Build",
    "spark_text": "This week, Grade 8 connects its vocabulary to Grade 8 second-trimester Arduino work.",
    "why_it_matters": "This connects the weekly vocabulary to the work students will practice in class.",
    "question": "What is one idea from Prototype Build that could help your Technology work this week?",
    "source_title": "Technology Planning 2026",
    "source_url": "",
    "subject_slug": "technology",
    "target_grades": [
      "8"
    ],
    "scheduled_date": "2026-08-10",
    "status": "scheduled"
  },
  {
    "id": "technology_2026_g9_iit_august_week10_python_and_data_visualization",
    "spark_type": "cool_fact",
    "title": "Python and Data: Visualization",
    "spark_text": "This week, Grade 9 connects its vocabulary to Grade 9 second-trimester Python and data work.",
    "why_it_matters": "This connects the weekly vocabulary to the work students will practice in class.",
    "question": "What is one data detail, pattern, or Python idea from Python and Data: Visualization that could help your work this week?",
    "source_title": "Technology Planning 2026",
    "source_url": "",
    "subject_slug": "technology",
    "target_grades": [
      "9"
    ],
    "scheduled_date": "2026-08-10",
    "status": "scheduled"
  },
  {
    "id": "technology_2026_g6_iit_august_week11_demo_reflection",
    "spark_type": "debate",
    "title": "Demo Reflection",
    "spark_text": "This week, Grade 6 connects its vocabulary to testing, explaining, and reflecting on the final robotics challenge.",
    "why_it_matters": "This connects the weekly vocabulary to the work students will practice in class.",
    "question": "What is one idea from Demo Reflection that could help your Technology work this week?",
    "source_title": "Technology Planning 2026",
    "source_url": "",
    "subject_slug": "technology",
    "target_grades": [
      "6"
    ],
    "scheduled_date": "2026-08-17",
    "status": "scheduled"
  },
  {
    "id": "technology_2026_g7_iit_august_week11_improve",
    "spark_type": "reflection",
    "title": "Improve",
    "spark_text": "This week, Grade 7 connects its vocabulary to improving game features.",
    "why_it_matters": "This connects the weekly vocabulary to the work students will practice in class.",
    "question": "What is one idea from Improve that could help your Technology work this week?",
    "source_title": "Technology Planning 2026",
    "source_url": "",
    "subject_slug": "technology",
    "target_grades": [
      "7"
    ],
    "scheduled_date": "2026-08-17",
    "status": "scheduled"
  },
  {
    "id": "technology_2026_g8_iit_august_week11_reliability",
    "spark_type": "cool_fact",
    "title": "Reliability",
    "spark_text": "This week, Grade 8 connects its vocabulary to Grade 8 second-trimester Arduino work.",
    "why_it_matters": "This connects the weekly vocabulary to the work students will practice in class.",
    "question": "What is one idea from Reliability that could help your Technology work this week?",
    "source_title": "Technology Planning 2026",
    "source_url": "",
    "subject_slug": "technology",
    "target_grades": [
      "8"
    ],
    "scheduled_date": "2026-08-17",
    "status": "scheduled"
  },
  {
    "id": "technology_2026_g9_iit_august_week11_python_and_data_revision",
    "spark_type": "trivia",
    "title": "Python and Data: Revision",
    "spark_text": "This week, Grade 9 connects its vocabulary to Grade 9 second-trimester Python and data work.",
    "why_it_matters": "This connects the weekly vocabulary to the work students will practice in class.",
    "question": "What is one data detail, pattern, or Python idea from Python and Data: Revision that could help your work this week?",
    "source_title": "Technology Planning 2026",
    "source_url": "",
    "subject_slug": "technology",
    "target_grades": [
      "9"
    ],
    "scheduled_date": "2026-08-17",
    "status": "scheduled"
  },
  {
    "id": "technology_2026_g7_iit_august_week12_demo",
    "spark_type": "cool_fact",
    "title": "Demo",
    "spark_text": "This week, Grade 7 connects its vocabulary to demonstrating and reflecting on the dance game.",
    "why_it_matters": "This connects the weekly vocabulary to the work students will practice in class.",
    "question": "What is one idea from Demo that could help your Technology work this week?",
    "source_title": "Technology Planning 2026",
    "source_url": "",
    "subject_slug": "technology",
    "target_grades": [
      "7"
    ],
    "scheduled_date": "2026-08-24",
    "status": "scheduled"
  },
  {
    "id": "technology_2026_g8_iit_august_week12_demonstration",
    "spark_type": "trivia",
    "title": "Demonstration",
    "spark_text": "This week, Grade 8 connects its vocabulary to Grade 8 second-trimester Arduino work.",
    "why_it_matters": "This connects the weekly vocabulary to the work students will practice in class.",
    "question": "What is one idea from Demonstration that could help your Technology work this week?",
    "source_title": "Technology Planning 2026",
    "source_url": "",
    "subject_slug": "technology",
    "target_grades": [
      "8"
    ],
    "scheduled_date": "2026-08-24",
    "status": "scheduled"
  },
  {
    "id": "technology_2026_g9_iit_august_week12_python_and_data_presentation",
    "spark_type": "good_news",
    "title": "Python and Data: Presentation",
    "spark_text": "This week, Grade 9 connects its vocabulary to Grade 9 second-trimester Python and data work.",
    "why_it_matters": "This connects the weekly vocabulary to the work students will practice in class.",
    "question": "What is one data detail, pattern, or Python idea from Python and Data: Presentation that could help your work this week?",
    "source_title": "Technology Planning 2026",
    "source_url": "",
    "subject_slug": "technology",
    "target_grades": [
      "9"
    ],
    "scheduled_date": "2026-08-24",
    "status": "scheduled"
  },
  {
    "id": "technology_2026_g8_iit_august_week13_cleanup",
    "spark_type": "good_news",
    "title": "Cleanup",
    "spark_text": "This week, Grade 8 connects its vocabulary to Grade 8 second-trimester Arduino work.",
    "why_it_matters": "This connects the weekly vocabulary to the work students will practice in class.",
    "question": "What is one idea from Cleanup that could help your Technology work this week?",
    "source_title": "Technology Planning 2026",
    "source_url": "",
    "subject_slug": "technology",
    "target_grades": [
      "8"
    ],
    "scheduled_date": "2026-08-31",
    "status": "scheduled"
  },
  {
    "id": "technology_2026_g6_iiit_september_week1_iiit_vocabulary",
    "spark_type": "reflection",
    "title": "IIIT Vocabulary",
    "spark_text": "This week, Grade 6 connects its vocabulary to core third-trimester words for the Grade 6 IIIT summative vocabulary table.",
    "why_it_matters": "This connects the weekly vocabulary to the work students will practice in class.",
    "question": "What is one idea from IIIT Vocabulary that could help your Technology work this week?",
    "source_title": "Technology Planning 2026",
    "source_url": "",
    "subject_slug": "technology",
    "target_grades": [
      "6"
    ],
    "scheduled_date": "2026-09-14",
    "status": "scheduled"
  },
  {
    "id": "technology_2026_g7_iiit_september_week1_spreadsheets",
    "spark_type": "cool_fact",
    "title": "Spreadsheets",
    "spark_text": "This week, Grade 7 connects its vocabulary to core third-trimester words for the Grade 7 spreadsheet vocabulary table.",
    "why_it_matters": "This connects the weekly vocabulary to the work students will practice in class.",
    "question": "What is one idea from Spreadsheets that could help your Technology work this week?",
    "source_title": "Technology Planning 2026",
    "source_url": "",
    "subject_slug": "technology",
    "target_grades": [
      "7"
    ],
    "scheduled_date": "2026-09-14",
    "status": "scheduled"
  },
  {
    "id": "technology_2026_g8_iiit_september_week1_app_design",
    "spark_type": "trivia",
    "title": "App Design",
    "spark_text": "This week, Grade 8 connects its vocabulary to core third-trimester words for the Grade 8 app design vocabulary table.",
    "why_it_matters": "This connects the weekly vocabulary to the work students will practice in class.",
    "question": "What is one idea from App Design that could help your Technology work this week?",
    "source_title": "Technology Planning 2026",
    "source_url": "",
    "subject_slug": "technology",
    "target_grades": [
      "8"
    ],
    "scheduled_date": "2026-09-14",
    "status": "scheduled"
  },
  {
    "id": "technology_2026_g9_iiit_september_week1_digital_media",
    "spark_type": "good_news",
    "title": "Digital Media",
    "spark_text": "This week, Grade 9 connects its vocabulary to core third-trimester words for the Grade 9 digital media vocabulary table.",
    "why_it_matters": "This connects the weekly vocabulary to the work students will practice in class.",
    "question": "What is one idea from Digital Media that could help your Technology work this week?",
    "source_title": "Technology Planning 2026",
    "source_url": "",
    "subject_slug": "technology",
    "target_grades": [
      "9"
    ],
    "scheduled_date": "2026-09-14",
    "status": "scheduled"
  },
  {
    "id": "technology_2026_g6_iiit_september_week2_formulas",
    "spark_type": "cool_fact",
    "title": "Formulas",
    "spark_text": "This week, Grade 6 connects its vocabulary to spreadsheet formulas and values.",
    "why_it_matters": "This connects the weekly vocabulary to the work students will practice in class.",
    "question": "What is one idea from Formulas that could help your Technology work this week?",
    "source_title": "Technology Planning 2026",
    "source_url": "",
    "subject_slug": "technology",
    "target_grades": [
      "6"
    ],
    "scheduled_date": "2026-09-21",
    "status": "scheduled"
  },
  {
    "id": "technology_2026_g7_iiit_september_week2_formulas_and_charts",
    "spark_type": "trivia",
    "title": "Formulas and Charts",
    "spark_text": "This week, Grade 7 connects its vocabulary to formulas, functions, and chart interpretation.",
    "why_it_matters": "This connects the weekly vocabulary to the work students will practice in class.",
    "question": "What is one data detail, pattern, or Python idea from Formulas and Charts that could help your work this week?",
    "source_title": "Technology Planning 2026",
    "source_url": "",
    "subject_slug": "technology",
    "target_grades": [
      "7"
    ],
    "scheduled_date": "2026-09-21",
    "status": "scheduled"
  },
  {
    "id": "technology_2026_g8_iiit_september_week2_events_and_flow",
    "spark_type": "good_news",
    "title": "Events and Flow",
    "spark_text": "This week, Grade 8 connects its vocabulary to Grade 8 third-trimester app, Python, and Micro:bit work.",
    "why_it_matters": "This connects the weekly vocabulary to the work students will practice in class.",
    "question": "What is one idea from Events and Flow that could help your Technology work this week?",
    "source_title": "Technology Planning 2026",
    "source_url": "",
    "subject_slug": "technology",
    "target_grades": [
      "8"
    ],
    "scheduled_date": "2026-09-21",
    "status": "scheduled"
  },
  {
    "id": "technology_2026_g9_iiit_september_week2_sound_quality",
    "spark_type": "debate",
    "title": "Sound Quality",
    "spark_text": "This week, Grade 9 connects its vocabulary to Grade 9 third-trimester STEM and cybersecurity work.",
    "why_it_matters": "This connects the weekly vocabulary to the work students will practice in class.",
    "question": "What is one idea from Sound Quality that could help your Technology work this week?",
    "source_title": "Technology Planning 2026",
    "source_url": "",
    "subject_slug": "technology",
    "target_grades": [
      "9"
    ],
    "scheduled_date": "2026-09-21",
    "status": "scheduled"
  },
  {
    "id": "technology_2026_g8_iiit_september_week3_user_needs",
    "spark_type": "debate",
    "title": "User Needs",
    "spark_text": "This week, Grade 8 connects its vocabulary to Grade 8 third-trimester app, Python, and Micro:bit work.",
    "why_it_matters": "This connects the weekly vocabulary to the work students will practice in class.",
    "question": "What is one idea from User Needs that could help your Technology work this week?",
    "source_title": "Technology Planning 2026",
    "source_url": "",
    "subject_slug": "technology",
    "target_grades": [
      "8"
    ],
    "scheduled_date": "2026-09-28",
    "status": "scheduled"
  },
  {
    "id": "technology_2026_g6_iiit_october_week1_budget_planning",
    "spark_type": "cool_fact",
    "title": "Budget Planning",
    "spark_text": "This week, Grade 6 connects its vocabulary to planning with quantities, costs, and totals.",
    "why_it_matters": "This connects the weekly vocabulary to the work students will practice in class.",
    "question": "What is one idea from Budget Planning that could help your Technology work this week?",
    "source_title": "Technology Planning 2026",
    "source_url": "",
    "subject_slug": "technology",
    "target_grades": [
      "6"
    ],
    "scheduled_date": "2026-10-01",
    "status": "scheduled"
  },
  {
    "id": "technology_2026_g7_iiit_october_week3_data_analysis",
    "spark_type": "debate",
    "title": "Data Analysis",
    "spark_text": "This week, Grade 7 connects its vocabulary to sorting, filtering, and patterns.",
    "why_it_matters": "This connects the weekly vocabulary to the work students will practice in class.",
    "question": "What is one data detail, pattern, or Python idea from Data Analysis that could help your work this week?",
    "source_title": "Technology Planning 2026",
    "source_url": "",
    "subject_slug": "technology",
    "target_grades": [
      "7"
    ],
    "scheduled_date": "2026-10-01",
    "status": "scheduled"
  },
  {
    "id": "technology_2026_g9_iiit_october_week3_personal_data",
    "spark_type": "cool_fact",
    "title": "Personal Data",
    "spark_text": "This week, Grade 9 connects its vocabulary to Grade 9 third-trimester STEM and cybersecurity work.",
    "why_it_matters": "This connects the weekly vocabulary to the work students will practice in class.",
    "question": "What is one data detail, pattern, or Python idea from Personal Data that could help your work this week?",
    "source_title": "Technology Planning 2026",
    "source_url": "",
    "subject_slug": "technology",
    "target_grades": [
      "9"
    ],
    "scheduled_date": "2026-10-01",
    "status": "scheduled"
  },
  {
    "id": "technology_2026_g7_iiit_october_week4_scratch_decomposition",
    "spark_type": "reflection",
    "title": "Scratch Decomposition",
    "spark_text": "This week, Grade 7 connects its vocabulary to decomposition and subroutines.",
    "why_it_matters": "This connects the weekly vocabulary to the work students will practice in class.",
    "question": "What is one idea from Scratch Decomposition that could help your Technology work this week?",
    "source_title": "Technology Planning 2026",
    "source_url": "",
    "subject_slug": "technology",
    "target_grades": [
      "7"
    ],
    "scheduled_date": "2026-10-05",
    "status": "scheduled"
  },
  {
    "id": "technology_2026_g8_iiit_october_week4_first_python",
    "spark_type": "cool_fact",
    "title": "First Python",
    "spark_text": "This week, Grade 8 connects its vocabulary to Grade 8 third-trimester app, Python, and Micro:bit work.",
    "why_it_matters": "This connects the weekly vocabulary to the work students will practice in class.",
    "question": "What is one data detail, pattern, or Python idea from First Python that could help your work this week?",
    "source_title": "Technology Planning 2026",
    "source_url": "",
    "subject_slug": "technology",
    "target_grades": [
      "8"
    ],
    "scheduled_date": "2026-10-05",
    "status": "scheduled"
  },
  {
    "id": "technology_2026_g9_iiit_october_week4_social_engineering_and_malware",
    "spark_type": "trivia",
    "title": "Social Engineering and Malware",
    "spark_text": "This week, Grade 9 connects its vocabulary to Grade 9 third-trimester STEM and cybersecurity work.",
    "why_it_matters": "This connects the weekly vocabulary to the work students will practice in class.",
    "question": "What is one idea from Social Engineering and Malware that could help your Technology work this week?",
    "source_title": "Technology Planning 2026",
    "source_url": "",
    "subject_slug": "technology",
    "target_grades": [
      "9"
    ],
    "scheduled_date": "2026-10-05",
    "status": "scheduled"
  },
  {
    "id": "technology_2026_g6_iiit_october_week2_charts",
    "spark_type": "trivia",
    "title": "Charts",
    "spark_text": "This week, Grade 6 connects its vocabulary to chart parts and conclusions.",
    "why_it_matters": "This connects the weekly vocabulary to the work students will practice in class.",
    "question": "What is one data detail, pattern, or Python idea from Charts that could help your work this week?",
    "source_title": "Technology Planning 2026",
    "source_url": "",
    "subject_slug": "technology",
    "target_grades": [
      "6"
    ],
    "scheduled_date": "2026-10-08",
    "status": "scheduled"
  },
  {
    "id": "technology_2026_g7_iiit_october_week5_sources_and_lists",
    "spark_type": "cool_fact",
    "title": "Sources and Lists",
    "spark_text": "This week, Grade 7 connects its vocabulary to lists, credible sources, and citation.",
    "why_it_matters": "This connects the weekly vocabulary to the work students will practice in class.",
    "question": "What is one data detail, pattern, or Python idea from Sources and Lists that could help your work this week?",
    "source_title": "Technology Planning 2026",
    "source_url": "",
    "subject_slug": "technology",
    "target_grades": [
      "7"
    ],
    "scheduled_date": "2026-10-12",
    "status": "scheduled"
  },
  {
    "id": "technology_2026_g8_iiit_october_week5_numbers_and_selection",
    "spark_type": "trivia",
    "title": "Numbers and Selection",
    "spark_text": "This week, Grade 8 connects its vocabulary to Grade 8 third-trimester app, Python, and Micro:bit work.",
    "why_it_matters": "This connects the weekly vocabulary to the work students will practice in class.",
    "question": "What is one idea from Numbers and Selection that could help your Technology work this week?",
    "source_title": "Technology Planning 2026",
    "source_url": "",
    "subject_slug": "technology",
    "target_grades": [
      "8"
    ],
    "scheduled_date": "2026-10-12",
    "status": "scheduled"
  },
  {
    "id": "technology_2026_g9_iiit_october_week5_security_risk",
    "spark_type": "good_news",
    "title": "Security Risk",
    "spark_text": "This week, Grade 9 connects its vocabulary to Grade 9 third-trimester STEM and cybersecurity work.",
    "why_it_matters": "This connects the weekly vocabulary to the work students will practice in class.",
    "question": "What is one idea from Security Risk that could help your Technology work this week?",
    "source_title": "Technology Planning 2026",
    "source_url": "",
    "subject_slug": "technology",
    "target_grades": [
      "9"
    ],
    "scheduled_date": "2026-10-12",
    "status": "scheduled"
  },
  {
    "id": "technology_2026_g6_iiit_october_week3_3d_basics",
    "spark_type": "good_news",
    "title": "3D Basics",
    "spark_text": "This week, Grade 6 connects its vocabulary to basic 3D modeling actions.",
    "why_it_matters": "This connects the weekly vocabulary to the work students will practice in class.",
    "question": "What is one idea from 3D Basics that could help your Technology work this week?",
    "source_title": "Technology Planning 2026",
    "source_url": "",
    "subject_slug": "technology",
    "target_grades": [
      "6"
    ],
    "scheduled_date": "2026-10-15",
    "status": "scheduled"
  },
  {
    "id": "technology_2026_g7_iiit_october_week6_blog_media",
    "spark_type": "trivia",
    "title": "Blog Media",
    "spark_text": "This week, Grade 7 connects its vocabulary to blog posts and media layout.",
    "why_it_matters": "This connects the weekly vocabulary to the work students will practice in class.",
    "question": "What is one idea from Blog Media that could help your Technology work this week?",
    "source_title": "Technology Planning 2026",
    "source_url": "",
    "subject_slug": "technology",
    "target_grades": [
      "7"
    ],
    "scheduled_date": "2026-10-19",
    "status": "scheduled"
  },
  {
    "id": "technology_2026_g8_iiit_october_week6_loops_and_branches",
    "spark_type": "good_news",
    "title": "Loops and Branches",
    "spark_text": "This week, Grade 8 connects its vocabulary to Grade 8 third-trimester app, Python, and Micro:bit work.",
    "why_it_matters": "This connects the weekly vocabulary to the work students will practice in class.",
    "question": "What is one idea from Loops and Branches that could help your Technology work this week?",
    "source_title": "Technology Planning 2026",
    "source_url": "",
    "subject_slug": "technology",
    "target_grades": [
      "8"
    ],
    "scheduled_date": "2026-10-19",
    "status": "scheduled"
  },
  {
    "id": "technology_2026_g9_iiit_october_week6_project_problem",
    "spark_type": "debate",
    "title": "Project Problem",
    "spark_text": "This week, Grade 9 connects its vocabulary to Grade 9 third-trimester STEM and cybersecurity work.",
    "why_it_matters": "This connects the weekly vocabulary to the work students will practice in class.",
    "question": "What is one idea from Project Problem that could help your Technology work this week?",
    "source_title": "Technology Planning 2026",
    "source_url": "",
    "subject_slug": "technology",
    "target_grades": [
      "9"
    ],
    "scheduled_date": "2026-10-19",
    "status": "scheduled"
  },
  {
    "id": "technology_2026_g6_iiit_october_week4_design_prototype",
    "spark_type": "debate",
    "title": "Design Prototype",
    "spark_text": "This week, Grade 6 connects its vocabulary to planning and improving a simple model.",
    "why_it_matters": "This connects the weekly vocabulary to the work students will practice in class.",
    "question": "What is one idea from Design Prototype that could help your Technology work this week?",
    "source_title": "Technology Planning 2026",
    "source_url": "",
    "subject_slug": "technology",
    "target_grades": [
      "6"
    ],
    "scheduled_date": "2026-10-22",
    "status": "scheduled"
  },
  {
    "id": "technology_2026_g7_iiit_october_week7_robotics_sensor_systems",
    "spark_type": "good_news",
    "title": "Robotics: Sensor Systems",
    "spark_text": "This week, Grade 7 connects its vocabulary to micro:bit input and output systems.",
    "why_it_matters": "This connects the weekly vocabulary to the work students will practice in class.",
    "question": "What is one robot behavior, sensor detail, or safety habit from Robotics: Sensor Systems that your team should test carefully?",
    "source_title": "Technology Planning 2026",
    "source_url": "",
    "subject_slug": "technology",
    "target_grades": [
      "7"
    ],
    "scheduled_date": "2026-10-26",
    "status": "scheduled"
  },
  {
    "id": "technology_2026_g8_iiit_october_week7_debugging",
    "spark_type": "debate",
    "title": "Debugging",
    "spark_text": "This week, Grade 8 connects its vocabulary to Grade 8 third-trimester app, Python, and Micro:bit work.",
    "why_it_matters": "This connects the weekly vocabulary to the work students will practice in class.",
    "question": "What is one idea from Debugging that could help your Technology work this week?",
    "source_title": "Technology Planning 2026",
    "source_url": "",
    "subject_slug": "technology",
    "target_grades": [
      "8"
    ],
    "scheduled_date": "2026-10-26",
    "status": "scheduled"
  },
  {
    "id": "technology_2026_g9_iiit_october_week7_risk_map",
    "spark_type": "reflection",
    "title": "Risk Map",
    "spark_text": "This week, Grade 9 connects its vocabulary to Grade 9 third-trimester STEM and cybersecurity work.",
    "why_it_matters": "This connects the weekly vocabulary to the work students will practice in class.",
    "question": "What is one idea from Risk Map that could help your Technology work this week?",
    "source_title": "Technology Planning 2026",
    "source_url": "",
    "subject_slug": "technology",
    "target_grades": [
      "9"
    ],
    "scheduled_date": "2026-10-26",
    "status": "scheduled"
  },
  {
    "id": "technology_2026_g6_iiit_november_week1_present_and_reflect",
    "spark_type": "trivia",
    "title": "Present and Reflect",
    "spark_text": "This week, Grade 6 connects its vocabulary to presenting, feedback, and reflection.",
    "why_it_matters": "This connects the weekly vocabulary to the work students will practice in class.",
    "question": "What is one idea from Present and Reflect that could help your Technology work this week?",
    "source_title": "Technology Planning 2026",
    "source_url": "",
    "subject_slug": "technology",
    "target_grades": [
      "6"
    ],
    "scheduled_date": "2026-11-02",
    "status": "scheduled"
  },
  {
    "id": "technology_2026_g7_iiit_november_week8_test_table",
    "spark_type": "reflection",
    "title": "Test Table",
    "spark_text": "This week, Grade 7 connects its vocabulary to sensor testing and reliability.",
    "why_it_matters": "This connects the weekly vocabulary to the work students will practice in class.",
    "question": "What is one idea from Test Table that could help your Technology work this week?",
    "source_title": "Technology Planning 2026",
    "source_url": "",
    "subject_slug": "technology",
    "target_grades": [
      "7"
    ],
    "scheduled_date": "2026-11-02",
    "status": "scheduled"
  },
  {
    "id": "technology_2026_g8_iiit_october_week8_micro_bit_setup",
    "spark_type": "reflection",
    "title": "Micro:bit Setup",
    "spark_text": "This week, Grade 8 connects its vocabulary to Grade 8 third-trimester app, Python, and Micro:bit work.",
    "why_it_matters": "This connects the weekly vocabulary to the work students will practice in class.",
    "question": "What is one idea from Micro:bit Setup that could help your Technology work this week?",
    "source_title": "Technology Planning 2026",
    "source_url": "",
    "subject_slug": "technology",
    "target_grades": [
      "8"
    ],
    "scheduled_date": "2026-11-02",
    "status": "scheduled"
  },
  {
    "id": "technology_2026_g9_iiit_november_week8_proposal",
    "spark_type": "trivia",
    "title": "Proposal",
    "spark_text": "This week, Grade 9 connects its vocabulary to Grade 9 third-trimester STEM and cybersecurity work.",
    "why_it_matters": "This connects the weekly vocabulary to the work students will practice in class.",
    "question": "What is one idea from Proposal that could help your Technology work this week?",
    "source_title": "Technology Planning 2026",
    "source_url": "",
    "subject_slug": "technology",
    "target_grades": [
      "9"
    ],
    "scheduled_date": "2026-11-02",
    "status": "scheduled"
  },
  {
    "id": "technology_2026_g6_iiit_november_week2_micro_bit_input_and_output",
    "spark_type": "good_news",
    "title": "micro:bit Input and Output",
    "spark_text": "This week, Grade 6 connects its vocabulary to micro:bit parts, inputs, and outputs.",
    "why_it_matters": "This connects the weekly vocabulary to the work students will practice in class.",
    "question": "What is one idea from micro:bit Input and Output that could help your Technology work this week?",
    "source_title": "Technology Planning 2026",
    "source_url": "",
    "subject_slug": "technology",
    "target_grades": [
      "6"
    ],
    "scheduled_date": "2026-11-09",
    "status": "scheduled"
  },
  {
    "id": "technology_2026_g7_iiit_november_week9_review_setup",
    "spark_type": "cool_fact",
    "title": "Review Setup",
    "spark_text": "This week, Grade 7 connects its vocabulary to reviewing third-trimester concepts.",
    "why_it_matters": "This connects the weekly vocabulary to the work students will practice in class.",
    "question": "What is one idea from Review Setup that could help your Technology work this week?",
    "source_title": "Technology Planning 2026",
    "source_url": "",
    "subject_slug": "technology",
    "target_grades": [
      "7"
    ],
    "scheduled_date": "2026-11-09",
    "status": "scheduled"
  },
  {
    "id": "technology_2026_g8_iiit_november_week9_binary_representation",
    "spark_type": "trivia",
    "title": "Binary Representation",
    "spark_text": "This week, Grade 8 connects its vocabulary to Grade 8 third-trimester app, Python, and Micro:bit work.",
    "why_it_matters": "This connects the weekly vocabulary to the work students will practice in class.",
    "question": "What is one idea from Binary Representation that could help your Technology work this week?",
    "source_title": "Technology Planning 2026",
    "source_url": "",
    "subject_slug": "technology",
    "target_grades": [
      "8"
    ],
    "scheduled_date": "2026-11-09",
    "status": "scheduled"
  },
  {
    "id": "technology_2026_g9_iiit_november_week9_project_habits",
    "spark_type": "good_news",
    "title": "Project Habits",
    "spark_text": "This week, Grade 9 connects its vocabulary to Grade 9 third-trimester STEM and cybersecurity work.",
    "why_it_matters": "This connects the weekly vocabulary to the work students will practice in class.",
    "question": "What is one idea from Project Habits that could help your Technology work this week?",
    "source_title": "Technology Planning 2026",
    "source_url": "",
    "subject_slug": "technology",
    "target_grades": [
      "9"
    ],
    "scheduled_date": "2026-11-09",
    "status": "scheduled"
  },
  {
    "id": "technology_2026_g6_iiit_november_week3_micro_bit_variables",
    "spark_type": "debate",
    "title": "micro:bit Variables",
    "spark_text": "This week, Grade 6 connects its vocabulary to counters and changing values.",
    "why_it_matters": "This connects the weekly vocabulary to the work students will practice in class.",
    "question": "What is one idea from micro:bit Variables that could help your Technology work this week?",
    "source_title": "Technology Planning 2026",
    "source_url": "",
    "subject_slug": "technology",
    "target_grades": [
      "6"
    ],
    "scheduled_date": "2026-11-16",
    "status": "scheduled"
  },
  {
    "id": "technology_2026_g7_iiit_november_week10_project_plan",
    "spark_type": "trivia",
    "title": "Project Plan",
    "spark_text": "This week, Grade 7 connects its vocabulary to planning the Mandrake Detection System.",
    "why_it_matters": "This connects the weekly vocabulary to the work students will practice in class.",
    "question": "What is one idea from Project Plan that could help your Technology work this week?",
    "source_title": "Technology Planning 2026",
    "source_url": "",
    "subject_slug": "technology",
    "target_grades": [
      "7"
    ],
    "scheduled_date": "2026-11-16",
    "status": "scheduled"
  },
  {
    "id": "technology_2026_g8_iiit_november_week10_game_build",
    "spark_type": "good_news",
    "title": "Game Build",
    "spark_text": "This week, Grade 8 connects its vocabulary to Grade 8 third-trimester app, Python, and Micro:bit work.",
    "why_it_matters": "This connects the weekly vocabulary to the work students will practice in class.",
    "question": "What is one idea from Game Build that could help your Technology work this week?",
    "source_title": "Technology Planning 2026",
    "source_url": "",
    "subject_slug": "technology",
    "target_grades": [
      "8"
    ],
    "scheduled_date": "2026-11-16",
    "status": "scheduled"
  },
  {
    "id": "technology_2026_g9_iiit_november_week10_build_evidence",
    "spark_type": "debate",
    "title": "Build Evidence",
    "spark_text": "This week, Grade 9 connects its vocabulary to Grade 9 third-trimester STEM and cybersecurity work.",
    "why_it_matters": "This connects the weekly vocabulary to the work students will practice in class.",
    "question": "What is one idea from Build Evidence that could help your Technology work this week?",
    "source_title": "Technology Planning 2026",
    "source_url": "",
    "subject_slug": "technology",
    "target_grades": [
      "9"
    ],
    "scheduled_date": "2026-11-16",
    "status": "scheduled"
  },
  {
    "id": "technology_2026_g7_iiit_november_week11_debug_reliability",
    "spark_type": "good_news",
    "title": "Debug Reliability",
    "spark_text": "This week, Grade 7 connects its vocabulary to retesting and improving reliability.",
    "why_it_matters": "This connects the weekly vocabulary to the work students will practice in class.",
    "question": "What is one idea from Debug Reliability that could help your Technology work this week?",
    "source_title": "Technology Planning 2026",
    "source_url": "",
    "subject_slug": "technology",
    "target_grades": [
      "7"
    ],
    "scheduled_date": "2026-11-23",
    "status": "scheduled"
  },
  {
    "id": "technology_2026_g8_iiit_november_week11_user_testing",
    "spark_type": "debate",
    "title": "User Testing",
    "spark_text": "This week, Grade 8 connects its vocabulary to Grade 8 third-trimester app, Python, and Micro:bit work.",
    "why_it_matters": "This connects the weekly vocabulary to the work students will practice in class.",
    "question": "What is one idea from User Testing that could help your Technology work this week?",
    "source_title": "Technology Planning 2026",
    "source_url": "",
    "subject_slug": "technology",
    "target_grades": [
      "8"
    ],
    "scheduled_date": "2026-11-23",
    "status": "scheduled"
  },
  {
    "id": "technology_2026_g9_iiit_november_week11_testing_and_improvement",
    "spark_type": "reflection",
    "title": "Testing and Improvement",
    "spark_text": "This week, Grade 9 connects its vocabulary to Grade 9 third-trimester STEM and cybersecurity work.",
    "why_it_matters": "This connects the weekly vocabulary to the work students will practice in class.",
    "question": "What is one idea from Testing and Improvement that could help your Technology work this week?",
    "source_title": "Technology Planning 2026",
    "source_url": "",
    "subject_slug": "technology",
    "target_grades": [
      "9"
    ],
    "scheduled_date": "2026-11-23",
    "status": "scheduled"
  },
  {
    "id": "technology_2026_g7_iiit_november_week12_presentation",
    "spark_type": "debate",
    "title": "Presentation",
    "spark_text": "This week, Grade 7 connects its vocabulary to presenting the final system.",
    "why_it_matters": "This connects the weekly vocabulary to the work students will practice in class.",
    "question": "What is one idea from Presentation that could help your Technology work this week?",
    "source_title": "Technology Planning 2026",
    "source_url": "",
    "subject_slug": "technology",
    "target_grades": [
      "7"
    ],
    "scheduled_date": "2026-11-30",
    "status": "scheduled"
  },
  {
    "id": "technology_2026_g8_iiit_november_week12_presentation",
    "spark_type": "reflection",
    "title": "Presentation",
    "spark_text": "This week, Grade 8 connects its vocabulary to Grade 8 third-trimester app, Python, and Micro:bit work.",
    "why_it_matters": "This connects the weekly vocabulary to the work students will practice in class.",
    "question": "What is one idea from Presentation that could help your Technology work this week?",
    "source_title": "Technology Planning 2026",
    "source_url": "",
    "subject_slug": "technology",
    "target_grades": [
      "8"
    ],
    "scheduled_date": "2026-11-30",
    "status": "scheduled"
  },
  {
    "id": "technology_2026_g6_iiit_december_week1_robotics_sensors_and_conditions",
    "spark_type": "good_news",
    "title": "Robotics: Sensors and Conditions",
    "spark_text": "This week, Grade 6 connects its vocabulary to sensors, conditions, and messages.",
    "why_it_matters": "This connects the weekly vocabulary to the work students will practice in class.",
    "question": "What is one robot behavior, sensor detail, or safety habit from Robotics: Sensors and Conditions that your team should test carefully?",
    "source_title": "Technology Planning 2026",
    "source_url": "",
    "subject_slug": "technology",
    "target_grades": [
      "6"
    ],
    "scheduled_date": "2026-12-01",
    "status": "scheduled"
  },
  {
    "id": "technology_2026_g9_iiit_december_week12_final_demo",
    "spark_type": "trivia",
    "title": "Final Demo",
    "spark_text": "This week, Grade 9 connects its vocabulary to Grade 9 third-trimester STEM and cybersecurity work.",
    "why_it_matters": "This connects the weekly vocabulary to the work students will practice in class.",
    "question": "What is one idea from Final Demo that could help your Technology work this week?",
    "source_title": "Technology Planning 2026",
    "source_url": "",
    "subject_slug": "technology",
    "target_grades": [
      "9"
    ],
    "scheduled_date": "2026-12-01",
    "status": "scheduled"
  },
  {
    "id": "technology_2026_g6_iiit_december_week2_final_project",
    "spark_type": "debate",
    "title": "Final Project",
    "spark_text": "This week, Grade 6 connects its vocabulary to building and improving the final micro:bit project.",
    "why_it_matters": "This connects the weekly vocabulary to the work students will practice in class.",
    "question": "What is one idea from Final Project that could help your Technology work this week?",
    "source_title": "Technology Planning 2026",
    "source_url": "",
    "subject_slug": "technology",
    "target_grades": [
      "6"
    ],
    "scheduled_date": "2026-12-08",
    "status": "scheduled"
  },
  {
    "id": "technology_2026_g6_iiit_december_week3_demonstrate_and_explain",
    "spark_type": "reflection",
    "title": "Demonstrate and Explain",
    "spark_text": "This week, Grade 6 connects its vocabulary to demonstrating and explaining the final project.",
    "why_it_matters": "This connects the weekly vocabulary to the work students will practice in class.",
    "question": "What is one idea from Demonstrate and Explain that could help your Technology work this week?",
    "source_title": "Technology Planning 2026",
    "source_url": "",
    "subject_slug": "technology",
    "target_grades": [
      "6"
    ],
    "scheduled_date": "2026-12-15",
    "status": "scheduled"
  }
]
$technology_weekly_sparks_2026$) as spark (
        id text,
        spark_type text,
        title text,
        spark_text text,
        why_it_matters text,
        question text,
        source_title text,
        source_url text,
        subject_slug text,
        target_grades jsonb,
        scheduled_date date,
        status text
    )
)
insert into public.weekly_sparks (
    id, spark_type, title, spark_text, why_it_matters, question, source_title, source_url, subject_slug, target_grades, scheduled_date, status
)
select
    id, spark_type, title, spark_text, why_it_matters, question, source_title, source_url, subject_slug, target_grades, scheduled_date, status
from technology_weekly_sparks_2026
on conflict (id) do update set
    spark_type = excluded.spark_type,
    title = excluded.title,
    spark_text = excluded.spark_text,
    why_it_matters = excluded.why_it_matters,
    question = excluded.question,
    source_title = excluded.source_title,
    source_url = excluded.source_url,
    subject_slug = excluded.subject_slug,
    target_grades = excluded.target_grades,
    scheduled_date = excluded.scheduled_date,
    status = excluded.status,
    updated_at = now();
