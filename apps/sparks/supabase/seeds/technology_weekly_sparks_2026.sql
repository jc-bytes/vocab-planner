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
    "title": "Parts work together",
    "spark_text": "A student types a sentence on a keyboard. The computer processes the input and shows the sentence on a screen. The keyboard provides input, the processor follows instructions, and the screen provides output. These connected parts work together as a computing system.",
    "why_it_matters": "A system's result depends on parts performing connected jobs.",
    "question": "What jobs do the keyboard and screen perform in this system?",
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
    "title": "Sense, decide, act",
    "spark_text": "A robot detects an object in front of it. Its sensor provides information to a controller. The controller follows a programmed rule and tells the motors to stop. The sensor measures, the controller decides using the rule, and the motors carry out the action.",
    "why_it_matters": "Different robot parts have different jobs in the same system.",
    "question": "Which part detects the object, and which parts carry out the stop action?",
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
    "title": "Resize a shape",
    "spark_text": "A logo is drawn as vector shapes. A vector image describes shapes using paths and points, so the logo can be resized without turning those shapes into a larger grid of pixels. A small pixel-based image enlarged a great deal may show its individual pixels.",
    "why_it_matters": "The type of image affects how well it suits different output sizes.",
    "question": "Why could vector shapes be useful for a logo needed on both a small badge and a large poster?",
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
    "title": "An input leads to an output",
    "spark_text": "A small board has a button and a light display. Pressing the button gives the program an input. The program follows an instruction to show a heart on the display. The visible heart is an output. Input is information received; output is a result produced.",
    "why_it_matters": "Following an input through to its output helps explain how a device works.",
    "question": "What is the input in this example, and what output does it cause?",
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
    "title": "Pause before you send",
    "spark_text": "Leo receives a message that says, 'Send your password now or your account will close.' The message tries to make him act quickly. A password is private information. Instead of replying or using the message's link, Leo can open the service through its usual app and ask a trusted adult for help.",
    "why_it_matters": "An urgent message can pressure someone into sharing private information.",
    "question": "What should Leo do instead of sending his password? Explain why.",
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
    "title": "Sense, decide, act",
    "spark_text": "A robot detects an object in front of it. Its sensor provides information to a controller. The controller follows a programmed rule and tells the motors to stop. The sensor measures, the controller decides using the rule, and the motors carry out the action.",
    "why_it_matters": "Different robot parts have different jobs in the same system.",
    "question": "Which part detects the object, and which parts carry out the stop action?",
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
    "title": "Help the reader see the order",
    "spark_text": "A poster has a title and three text blocks. Their left edges start at different places, making the page feel scattered. The designer aligns the left edges and groups each heading with its paragraph. Alignment and grouping help readers see which elements belong together.",
    "why_it_matters": "Layout can make a message easier to follow without adding more words.",
    "question": "Which two layout changes help organise this poster?",
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
    "title": "Make a visible signal",
    "spark_text": "A small board has an LED that a program can turn on and off. An LED is a light-emitting diode. A program turns it on for one second, then off for one second, and repeats. The changing light is an output that a person can see.",
    "why_it_matters": "A light can communicate that a device is running or has changed state.",
    "question": "What visible pattern does this program produce?",
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
    "title": "Make the next step clear",
    "spark_text": "Two students edit the same shared poster. Both replace the title at the same time and lose track of the intended wording. They agree that one will edit the title while the other checks the image, then review the changes together. Collaboration needs clear responsibilities as well as shared access.",
    "why_it_matters": "An agreed plan can prevent people from undoing each other's work.",
    "question": "How does dividing these two tasks help the students work together?",
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
    "title": "Instructions become movement",
    "spark_text": "A wheeled robot uses motors to turn its wheels. Its program tells both motors to move forward for two seconds and then stop. A motor is an output device because it produces an action. Changing the instruction can change how the robot moves.",
    "why_it_matters": "Movement depends on both the program and the robot's outputs.",
    "question": "What is the output in this example, and which instruction controls how long it moves?",
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
    "title": "Make the signs recognisable",
    "spark_text": "A school club uses the same name, simple logo and two colours on its poster and invitation. These repeated choices help people recognise that the two items belong to the same club. A visual identity is a consistent set of design choices associated with a group or organisation.",
    "why_it_matters": "Consistent design helps an audience recognise related information.",
    "question": "Which repeated choices connect the poster with the invitation?",
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
    "title": "Leave the workspace ready",
    "spark_text": "At the end of a robotics lesson, a pair stops the robot, follows the teacher's power-down instructions, returns the parts to labelled spaces and saves its program. A routine is a repeated sequence of actions. Following the same agreed steps makes missing files or parts easier to notice.",
    "why_it_matters": "A clear routine helps the next person find a usable workspace.",
    "question": "Which action protects the students' code, and which action helps keep the parts organised?",
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
    "title": "Ask before posting",
    "spark_text": "Nora takes a photo of her friend during lunch. She wants to post it where everyone can see it. Her friend has not agreed. Being in a photo does not mean someone has agreed to have it shared. Nora can ask first and respect a 'no.'",
    "why_it_matters": "A photo can reveal information about someone who did not choose to share it.",
    "question": "What should Nora do before posting the photo? Explain your reason.",
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
    "title": "Sense, decide, act",
    "spark_text": "A robot detects an object in front of it. Its sensor provides information to a controller. The controller follows a programmed rule and tells the motors to stop. The sensor measures, the controller decides using the rule, and the motors carry out the action.",
    "why_it_matters": "Different robot parts have different jobs in the same system.",
    "question": "Which part detects the object, and which parts carry out the stop action?",
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
    "title": "Resize a shape",
    "spark_text": "A logo is drawn as vector shapes. A vector image describes shapes using paths and points, so the logo can be resized without turning those shapes into a larger grid of pixels. A small pixel-based image enlarged a great deal may show its individual pixels.",
    "why_it_matters": "The type of image affects how well it suits different output sizes.",
    "question": "Why could vector shapes be useful for a logo needed on both a small badge and a large poster?",
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
    "title": "A press changes the state",
    "spark_text": "A device starts with its light off. Each new button press changes the light to the opposite state: off becomes on, and on becomes off. This is a toggle. After two presses, the light is off again. The program must remember its current state between presses.",
    "why_it_matters": "Remembering state lets the same input have the correct next effect.",
    "question": "Starting with the light off, what state should it have after three presses? Explain.",
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
    "title": "Finding an image is not permission",
    "spark_text": "Sara finds a picture online for a poster. The page says the image is available under a licence that requires credit. A licence explains how a work may be used. Sara reads those conditions and includes the creator's name and the source when she uses the image.",
    "why_it_matters": "The person who made an image may set conditions for using it.",
    "question": "What must Sara check before using the image, and what credit is required in this example?",
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
    "title": "Make the turns more accurate",
    "spark_text": "A robot is programmed to turn 90 degrees, but repeated tests show turns of about 100 degrees. The team adjusts its turning setting and tests again from the same start position. Calibration means adjusting a system using measurements so its results are closer to the intended value.",
    "why_it_matters": "Measurements give a better reason for an adjustment than guessing.",
    "question": "What measurement shows that an adjustment is needed, and what should the team test afterward?",
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
    "title": "Parts work together",
    "spark_text": "A student types a sentence on a keyboard. The computer processes the input and shows the sentence on a screen. The keyboard provides input, the processor follows instructions, and the screen provides output. These connected parts work together as a computing system.",
    "why_it_matters": "A system's result depends on parts performing connected jobs.",
    "question": "What jobs do the keyboard and screen perform in this system?",
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
    "title": "See the values a device sends",
    "spark_text": "A board reads a sensor value of 35 and sends the text 'Light: 35' to a connected computer. Serial communication sends data in a sequence. Displaying the received values lets the programmer compare the sensor readings with the device's surroundings.",
    "why_it_matters": "Visible readings help a programmer inspect what the device is sensing.",
    "question": "What information does 'Light: 35' give the person testing this device?",
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
    "title": "Plan before the robot moves",
    "spark_text": "A floor grid has a start square and a finish square. The planned route is two squares forward, a right turn, then one square forward. A route is an ordered path. The team draws that path first so it can compare the robot's movement with the plan.",
    "why_it_matters": "A clear route lets a team spot where a movement differs from the plan.",
    "question": "What should the robot do immediately after the right turn?",
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
    "title": "Check before using an AI answer",
    "spark_text": "An AI tool writes that a club meeting is on Friday. The school's notice says Thursday. AI-generated text can contain mistakes. Lina checks the claim against the notice and uses Thursday. She also tells her group that she used an AI tool to help draft the message.",
    "why_it_matters": "A fluent answer still needs evidence and responsible use.",
    "question": "Which date should Lina use, and why should she check the AI-generated claim?",
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
    "title": "Mix three light channels",
    "spark_text": "An RGB light combines red, green and blue light. In this example, each channel can be set from 0 to 255. The setting red 255, green 0, blue 0 uses only red. Changing the three channel values changes the combined light.",
    "why_it_matters": "Separate channel values let a program control the colour of a light.",
    "question": "Which channel is active in the setting 255, 0, 0, and which two are off?",
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
    "title": "Structure the page",
    "spark_text": "A web page has a heading, a paragraph and a link. HTML marks the structure and meaning of these parts. CSS controls presentation such as text colour and spacing. Changing the paragraph's colour in CSS changes its appearance without turning it into a different kind of element.",
    "why_it_matters": "Separating structure from presentation makes page changes easier to manage.",
    "question": "Which language would you use to change text colour, and which gives the paragraph its structure?",
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
    "title": "Make a visible signal",
    "spark_text": "A small board has an LED that a program can turn on and off. An LED is a light-emitting diode. A program turns it on for one second, then off for one second, and repeats. The changing light is an output that a person can see.",
    "why_it_matters": "A light can communicate that a device is running or has changed state.",
    "question": "What visible pattern does this program produce?",
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
    "title": "Structure the page",
    "spark_text": "A web page has a heading, a paragraph and a link. HTML marks the structure and meaning of these parts. CSS controls presentation such as text colour and spacing. Changing the paragraph's colour in CSS changes its appearance without turning it into a different kind of element.",
    "why_it_matters": "Separating structure from presentation makes page changes easier to manage.",
    "question": "Which language would you use to change text colour, and which gives the paragraph its structure?",
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
    "title": "Make a visible signal",
    "spark_text": "A small board has an LED that a program can turn on and off. An LED is a light-emitting diode. A program turns it on for one second, then off for one second, and repeats. The changing light is an output that a person can see.",
    "why_it_matters": "A light can communicate that a device is running or has changed state.",
    "question": "What visible pattern does this program produce?",
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
    "title": "Tell people where the link goes",
    "spark_text": "A page has two links, both labelled 'Click here'. One opens club rules and the other opens a registration form. A link connects a reader to another location. Labels such as 'Read club rules' and 'Open registration form' describe the destination before the reader follows it.",
    "why_it_matters": "Clear link labels help people choose the correct destination.",
    "question": "Why are the two descriptive labels more useful than 'Click here'?",
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
    "title": "Choose an action with a condition",
    "spark_text": "A game checks whether the player has at least 10 points. If the condition is true, it opens the next level. If the condition is false, the player stays in the current level. A condition is a statement a program can check as true or false.",
    "why_it_matters": "Conditions let a program choose between actions.",
    "question": "What happens at 8 points and at 10 points? Use the rule in the reading.",
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
    "title": "A claim needs evidence",
    "spark_text": "A post claims that the school will close tomorrow, but it gives no source. Omar checks the school's official notice and finds that classes will continue. A source is where information comes from. Comparing the post with an official notice helps him decide whether to share it.",
    "why_it_matters": "Checking the original source can stop an unsupported claim from spreading.",
    "question": "Which source should Omar rely on here, and what evidence supports his choice?",
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
    "title": "A press changes the state",
    "spark_text": "A device starts with its light off. Each new button press changes the light to the opposite state: off becomes on, and on becomes off. This is a toggle. After two presses, the light is off again. The program must remember its current state between presses.",
    "why_it_matters": "Remembering state lets the same input have the correct next effect.",
    "question": "Starting with the light off, what state should it have after three presses? Explain.",
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
    "title": "Remember the score",
    "spark_text": "A game starts with a score of 0. Each time the player collects a star, the program adds 1 to score. A variable is a named value that a program can change. After three stars, score holds 3, so the game can display the current result.",
    "why_it_matters": "A variable lets a program remember information while it runs.",
    "question": "What value should score hold after five stars, and why does the game need to remember it?",
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
    "title": "Which details should stay private?",
    "spark_text": "A game profile asks Ana to choose a display name. Another player asks for her home address and password. A display name can identify her in the game without revealing her address. She does not need to share her address or password to play with someone.",
    "why_it_matters": "Sharing fewer personal details gives strangers less information about you.",
    "question": "Which two details should Ana keep private, and why?",
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
    "title": "Plan before the robot moves",
    "spark_text": "A floor grid has a start square and a finish square. The planned route is two squares forward, a right turn, then one square forward. A route is an ordered path. The team draws that path first so it can compare the robot's movement with the plan.",
    "why_it_matters": "A clear route lets a team spot where a movement differs from the plan.",
    "question": "What should the robot do immediately after the right turn?",
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
    "title": "A plan needs a clear first step",
    "spark_text": "A group wants to create a guide for new students. It names the audience, lists the three questions the guide must answer, and assigns someone to draft each answer. A project plan describes the intended result and manageable steps toward it.",
    "why_it_matters": "A specific plan makes it easier to begin and check progress.",
    "question": "What should the group decide about its audience and content before making the guide?",
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
    "title": "Sense, decide, act",
    "spark_text": "A robot detects an object in front of it. Its sensor provides information to a controller. The controller follows a programmed rule and tells the motors to stop. The sensor measures, the controller decides using the rule, and the motors carry out the action.",
    "why_it_matters": "Different robot parts have different jobs in the same system.",
    "question": "Which part detects the object, and which parts carry out the stop action?",
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
    "title": "A plan needs a clear first step",
    "spark_text": "A group wants to create a guide for new students. It names the audience, lists the three questions the guide must answer, and assigns someone to draft each answer. A project plan describes the intended result and manageable steps toward it.",
    "why_it_matters": "A specific plan makes it easier to begin and check progress.",
    "question": "What should the group decide about its audience and content before making the guide?",
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
    "title": "Use media to support the message",
    "spark_text": "An online guide explains how to pack a school bag. It includes a short paragraph and a photo showing the arranged items. The photo supports the explanation. An unrelated animated image would use attention without showing the reader how to complete the task.",
    "why_it_matters": "Useful media helps the audience understand the intended message.",
    "question": "Why does the packing photo help this guide more than an unrelated animation?",
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
    "title": "A plan needs a clear first step",
    "spark_text": "A group wants to create a guide for new students. It names the audience, lists the three questions the guide must answer, and assigns someone to draft each answer. A project plan describes the intended result and manageable steps toward it.",
    "why_it_matters": "A specific plan makes it easier to begin and check progress.",
    "question": "What should the group decide about its audience and content before making the guide?",
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
    "title": "Think before throwing a device away",
    "spark_text": "A school has an old tablet that no longer holds a charge. A technician checks whether it can be repaired. If it cannot be reused, the school sends it to an appropriate electronics collection service. Electronic waste includes discarded electrical and electronic devices.",
    "why_it_matters": "Repair, reuse and appropriate collection can reduce what is thrown away.",
    "question": "What should the school check before deciding that the tablet must be discarded?",
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
    "title": "Find the cause of the wrong result",
    "spark_text": "A game should add one point for each star, but it adds two. Eva checks the scoring instructions and finds two 'add 1' commands running for the same star. She removes one and tests again. Debugging means finding and fixing the cause of a problem.",
    "why_it_matters": "A useful fix addresses the cause and is checked with another test.",
    "question": "What caused the extra point, and how can Eva check that her fix worked?",
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
    "title": "Explain what changed",
    "spark_text": "A student compares two versions of a poster. In the first, small text was hard to read. In the second, the text is larger, and three classmates can read it from the same distance. A reflection explains a change, its reason and the evidence of its effect.",
    "why_it_matters": "Specific evidence makes a reflection more useful than simply saying 'It is better.'",
    "question": "Which change did the student make, and what evidence suggests it helped?",
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
    "title": "One successful run is not enough",
    "spark_text": "A robot reaches the finish once. On the next two runs, it stops early. A reliable system works consistently under the same conditions. The team keeps the route and starting point the same and repeats the test after making a change.",
    "why_it_matters": "Repeated tests help show whether a result is consistent.",
    "question": "Why does one successful run not prove that this robot is reliable?",
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
    "title": "Use media to support the message",
    "spark_text": "An online guide explains how to pack a school bag. It includes a short paragraph and a photo showing the arranged items. The photo supports the explanation. An unrelated animated image would use attention without showing the reader how to complete the task.",
    "why_it_matters": "Useful media helps the audience understand the intended message.",
    "question": "Why does the packing photo help this guide more than an unrelated animation?",
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
    "title": "Show evidence of the result",
    "spark_text": "A team presents its game. Instead of only saying 'It works', it shows a player collecting a star and the score changing from 0 to 1. A demonstration shows the system performing an action. Explaining the visible result helps the audience assess the team's claim.",
    "why_it_matters": "A clear demonstration connects a claim with something the audience can observe.",
    "question": "What evidence supports the team's claim that scoring works?",
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
    "title": "Show evidence of the result",
    "spark_text": "A team presents its game. Instead of only saying 'It works', it shows a player collecting a star and the score changing from 0 to 1. A demonstration shows the system performing an action. Explaining the visible result helps the audience assess the team's claim.",
    "why_it_matters": "A clear demonstration connects a claim with something the audience can observe.",
    "question": "What evidence supports the team's claim that scoring works?",
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
    "title": "Show evidence of the result",
    "spark_text": "A team presents its game. Instead of only saying 'It works', it shows a player collecting a star and the score changing from 0 to 1. A demonstration shows the system performing an action. Explaining the visible result helps the audience assess the team's claim.",
    "why_it_matters": "A clear demonstration connects a claim with something the audience can observe.",
    "question": "What evidence supports the team's claim that scoring works?",
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
    "title": "Explain what changed",
    "spark_text": "A student compares two versions of a poster. In the first, small text was hard to read. In the second, the text is larger, and three classmates can read it from the same distance. A reflection explains a change, its reason and the evidence of its effect.",
    "why_it_matters": "Specific evidence makes a reflection more useful than simply saying 'It is better.'",
    "question": "Which change did the student make, and what evidence suggests it helped?",
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
    "title": "Keep a useful record",
    "spark_text": "A team finishes a project and saves its final file, source images and a short note explaining how to open it. An archive is an organised collection kept for later use. Clear names help the team distinguish the final version from earlier drafts.",
    "why_it_matters": "An organised archive helps someone find and understand work later.",
    "question": "Which files and instructions should this team keep so another person can reopen the project?",
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
    "title": "Sense, decide, act",
    "spark_text": "A robot detects an object in front of it. Its sensor provides information to a controller. The controller follows a programmed rule and tells the motors to stop. The sensor measures, the controller decides using the rule, and the motors carry out the action.",
    "why_it_matters": "Different robot parts have different jobs in the same system.",
    "question": "Which part detects the object, and which parts carry out the stop action?",
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
    "title": "Make the signs recognisable",
    "spark_text": "A school club uses the same name, simple logo and two colours on its poster and invitation. These repeated choices help people recognise that the two items belong to the same club. A visual identity is a consistent set of design choices associated with a group or organisation.",
    "why_it_matters": "Consistent design helps an audience recognise related information.",
    "question": "Which repeated choices connect the poster with the invitation?",
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
    "title": "An input leads to an output",
    "spark_text": "A small board has a button and a light display. Pressing the button gives the program an input. The program follows an instruction to show a heart on the display. The visible heart is an output. Input is information received; output is a result produced.",
    "why_it_matters": "Following an input through to its output helps explain how a device works.",
    "question": "What is the input in this example, and what output does it cause?",
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
    "title": "Remember the score",
    "spark_text": "A game starts with a score of 0. Each time the player collects a star, the program adds 1 to score. A variable is a named value that a program can change. After three stars, score holds 3, so the game can display the current result.",
    "why_it_matters": "A variable lets a program remember information while it runs.",
    "question": "What value should score hold after five stars, and why does the game need to remember it?",
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
    "title": "Instructions become movement",
    "spark_text": "A wheeled robot uses motors to turn its wheels. Its program tells both motors to move forward for two seconds and then stop. A motor is an output device because it produces an action. Changing the instruction can change how the robot moves.",
    "why_it_matters": "Movement depends on both the program and the robot's outputs.",
    "question": "What is the output in this example, and which instruction controls how long it moves?",
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
    "title": "Make the signs recognisable",
    "spark_text": "A school club uses the same name, simple logo and two colours on its poster and invitation. These repeated choices help people recognise that the two items belong to the same club. A visual identity is a consistent set of design choices associated with a group or organisation.",
    "why_it_matters": "Consistent design helps an audience recognise related information.",
    "question": "Which repeated choices connect the poster with the invitation?",
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
    "title": "A press changes the state",
    "spark_text": "A device starts with its light off. Each new button press changes the light to the opposite state: off becomes on, and on becomes off. This is a toggle. After two presses, the light is off again. The program must remember its current state between presses.",
    "why_it_matters": "Remembering state lets the same input have the correct next effect.",
    "question": "Starting with the light off, what state should it have after three presses? Explain.",
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
    "title": "Keep several values together",
    "spark_text": "A program stores three club names in a list: chess, art and music. A list keeps several items in an order. Instead of creating a separate variable for every club, the program can work through the list. Adding drama gives it a fourth item.",
    "why_it_matters": "A list helps organise several related values.",
    "question": "How many items are in the list after drama is added, and what makes a list useful here?",
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
    "title": "Find the cause of the wrong result",
    "spark_text": "A game should add one point for each star, but it adds two. Eva checks the scoring instructions and finds two 'add 1' commands running for the same star. She removes one and tests again. Debugging means finding and fixing the cause of a problem.",
    "why_it_matters": "A useful fix addresses the cause and is checked with another test.",
    "question": "What caused the extra point, and how can Eva check that her fix worked?",
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
    "title": "What starts the action?",
    "spark_text": "An app has a button labelled Play. Pressing that button is an event. The app responds by playing a sound. The button itself is not the sound; it is the control that triggers the action. Without the event, this sound does not start.",
    "why_it_matters": "An event connects something the user does with a response from the program.",
    "question": "What is the event in this example, and what action does it trigger?",
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
    "title": "A press changes the state",
    "spark_text": "A device starts with its light off. Each new button press changes the light to the opposite state: off becomes on, and on becomes off. This is a toggle. After two presses, the light is off again. The program must remember its current state between presses.",
    "why_it_matters": "Remembering state lets the same input have the correct next effect.",
    "question": "Starting with the light off, what state should it have after three presses? Explain.",
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
    "title": "Text and numbers behave differently",
    "spark_text": "A program can store the number 12 or the text '12'. Text is stored as a string. Adding the numbers 12 and 3 gives 15. Joining the strings '12' and '3' gives the text '123'. The stored type affects which operation makes sense.",
    "why_it_matters": "Checking a value's type helps prevent unexpected results.",
    "question": "Why are 15 and '123' different results in this example?",
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
    "title": "Instructions become movement",
    "spark_text": "A wheeled robot uses motors to turn its wheels. Its program tells both motors to move forward for two seconds and then stop. A motor is an output device because it produces an action. Changing the instruction can change how the robot moves.",
    "why_it_matters": "Movement depends on both the program and the robot's outputs.",
    "question": "What is the output in this example, and which instruction controls how long it moves?",
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
    "title": "Find the cause of the wrong result",
    "spark_text": "A game should add one point for each star, but it adds two. Eva checks the scoring instructions and finds two 'add 1' commands running for the same star. She removes one and tests again. Debugging means finding and fixing the cause of a problem.",
    "why_it_matters": "A useful fix addresses the cause and is checked with another test.",
    "question": "What caused the extra point, and how can Eva check that her fix worked?",
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
    "title": "Remember the score",
    "spark_text": "A game starts with a score of 0. Each time the player collects a star, the program adds 1 to score. A variable is a named value that a program can change. After three stars, score holds 3, so the game can display the current result.",
    "why_it_matters": "A variable lets a program remember information while it runs.",
    "question": "What value should score hold after five stars, and why does the game need to remember it?",
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
    "title": "A pattern is not a prediction",
    "spark_text": "A class records how many students cycle to school: Monday 4, Tuesday 6 and Wednesday 8. The count increases by two each day in these records. That is a pattern in the data. It does not prove that Thursday's count will be 10, because Thursday has not been measured.",
    "why_it_matters": "A pattern describes the available evidence; a prediction still needs checking.",
    "question": "What is the observed pattern, and why is Thursday's count still uncertain?",
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
    "title": "Make the turns more accurate",
    "spark_text": "A robot is programmed to turn 90 degrees, but repeated tests show turns of about 100 degrees. The team adjusts its turning setting and tests again from the same start position. Calibration means adjusting a system using measurements so its results are closer to the intended value.",
    "why_it_matters": "Measurements give a better reason for an adjustment than guessing.",
    "question": "What measurement shows that an adjustment is needed, and what should the team test afterward?",
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
    "title": "Choose the right comparison",
    "spark_text": "A program lets a player enter when age is at least 12. It checks age >= 12. The symbol >= means greater than or equal to. For age 12 the comparison is true; for age 11 it is false. A comparison produces a true-or-false result.",
    "why_it_matters": "A small change in a comparison can change who meets a rule.",
    "question": "Would age 13 pass this check? Explain what >= means.",
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
    "title": "More than on or off",
    "spark_text": "A light sensor reports values from 0 to 100 in this example. It gives 20 in a dark place and 80 in a bright place. These values describe different amounts of light. A two-state signal would only distinguish two states, such as dark and bright.",
    "why_it_matters": "A range of values can describe changes that an on/off signal cannot.",
    "question": "What extra information does the value 80 provide compared with a simple on/off signal?",
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
    "title": "Ask one clear survey question",
    "spark_text": "A class wants to find its most popular club. It asks every student, 'Which one club would you choose: chess, art or music?' Everyone receives the same options and chooses once. Using a consistent question and one response per student makes the results easier to compare.",
    "why_it_matters": "How data is collected affects what you can conclude from it.",
    "question": "Why would allowing some students to vote twice make the comparison unfair?",
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
    "title": "A pattern is not a prediction",
    "spark_text": "A class records how many students cycle to school: Monday 4, Tuesday 6 and Wednesday 8. The count increases by two each day in these records. That is a pattern in the data. It does not prove that Thursday's count will be 10, because Thursday has not been measured.",
    "why_it_matters": "A pattern describes the available evidence; a prediction still needs checking.",
    "question": "What is the observed pattern, and why is Thursday's count still uncertain?",
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
    "title": "Repeat the instruction",
    "spark_text": "A robot must move forward one step four times. A loop repeats instructions. Instead of writing 'move one step' four separate times, the programmer puts it inside a loop that repeats four times. Each repetition performs the same instruction once.",
    "why_it_matters": "Loops reduce repeated instructions and make repeated actions easier to change.",
    "question": "How many steps would the robot move if the loop repeated six times? Explain.",
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
    "title": "Mix three light channels",
    "spark_text": "An RGB light combines red, green and blue light. In this example, each channel can be set from 0 to 255. The setting red 255, green 0, blue 0 uses only red. Changing the three channel values changes the combined light.",
    "why_it_matters": "Separate channel values let a program control the colour of a light.",
    "question": "Which channel is active in the setting 255, 0, 0, and which two are off?",
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
    "title": "One club, two spellings",
    "spark_text": "A survey lists the same club as 'Chess', 'chess' and 'Chess '. A computer may treat these as different text values when grouping records. Data cleaning means finding and fixing problems such as inconsistent labels. Ali checks that they refer to the same club before giving all three the same spelling.",
    "why_it_matters": "Consistent labels help records that belong together stay together.",
    "question": "Why should Ali check the labels before combining the three entries?",
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
    "title": "A reading triggers a response",
    "spark_text": "A robot uses a distance sensor to measure how far away an object is. Its rule says: if the distance is less than 10 cm, stop the motors. A reading of 6 cm meets that condition; a reading of 15 cm does not.",
    "why_it_matters": "A sensor reading can become the input to a programmed decision.",
    "question": "Should the robot stop at 8 cm? Explain using the rule.",
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
    "title": "Make the next step clear",
    "spark_text": "Two students edit the same shared poster. Both replace the title at the same time and lose track of the intended wording. They agree that one will edit the title while the other checks the image, then review the changes together. Collaboration needs clear responsibilities as well as shared access.",
    "why_it_matters": "An agreed plan can prevent people from undoing each other's work.",
    "question": "How does dividing these two tasks help the students work together?",
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
    "title": "Turn to a position",
    "spark_text": "A small model gate uses a servo. The program tells it to move to 0 degrees to close the gate and 90 degrees to open it. A servo can be controlled to move to a position within its operating range. This differs from simply telling a wheel motor to keep turning.",
    "why_it_matters": "Choosing the right output depends on the movement the model needs.",
    "question": "Which position opens this model gate, and why is position control useful here?",
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
    "title": "Read the bars",
    "spark_text": "A club survey counts 12 students in chess, 8 in art and 5 in music. A bar chart shows one bar for each club, using the same scale for every bar. The chess bar is tallest because 12 is the largest count. Labels tell the reader which club each bar represents.",
    "why_it_matters": "A labelled chart makes comparisons easier to see.",
    "question": "How many more students chose chess than music, and how would the bars show that difference?",
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
    "title": "Read the bars",
    "spark_text": "A club survey counts 12 students in chess, 8 in art and 5 in music. A bar chart shows one bar for each club, using the same scale for every bar. The chess bar is tallest because 12 is the largest count. Labels tell the reader which club each bar represents.",
    "why_it_matters": "A labelled chart makes comparisons easier to see.",
    "question": "How many more students chose chess than music, and how would the bars show that difference?",
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
    "title": "Instructions become movement",
    "spark_text": "A wheeled robot uses motors to turn its wheels. Its program tells both motors to move forward for two seconds and then stop. A motor is an output device because it produces an action. Changing the instruction can change how the robot moves.",
    "why_it_matters": "Movement depends on both the program and the robot's outputs.",
    "question": "What is the output in this example, and which instruction controls how long it moves?",
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
    "title": "A plan needs a clear first step",
    "spark_text": "A group wants to create a guide for new students. It names the audience, lists the three questions the guide must answer, and assigns someone to draft each answer. A project plan describes the intended result and manageable steps toward it.",
    "why_it_matters": "A specific plan makes it easier to begin and check progress.",
    "question": "What should the group decide about its audience and content before making the guide?",
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
    "title": "Remember the score",
    "spark_text": "A game starts with a score of 0. Each time the player collects a star, the program adds 1 to score. A variable is a named value that a program can change. After three stars, score holds 3, so the game can display the current result.",
    "why_it_matters": "A variable lets a program remember information while it runs.",
    "question": "What value should score hold after five stars, and why does the game need to remember it?",
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
    "title": "Make a visible signal",
    "spark_text": "A small board has an LED that a program can turn on and off. An LED is a light-emitting diode. A program turns it on for one second, then off for one second, and repeats. The changing light is an output that a person can see.",
    "why_it_matters": "A light can communicate that a device is running or has changed state.",
    "question": "What visible pattern does this program produce?",
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
    "title": "A plan needs a clear first step",
    "spark_text": "A group wants to create a guide for new students. It names the audience, lists the three questions the guide must answer, and assigns someone to draft each answer. A project plan describes the intended result and manageable steps toward it.",
    "why_it_matters": "A specific plan makes it easier to begin and check progress.",
    "question": "What should the group decide about its audience and content before making the guide?",
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
    "title": "A plan needs a clear first step",
    "spark_text": "A group wants to create a guide for new students. It names the audience, lists the three questions the guide must answer, and assigns someone to draft each answer. A project plan describes the intended result and manageable steps toward it.",
    "why_it_matters": "A specific plan makes it easier to begin and check progress.",
    "question": "What should the group decide about its audience and content before making the guide?",
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
    "title": "A reading triggers a response",
    "spark_text": "A robot uses a distance sensor to measure how far away an object is. Its rule says: if the distance is less than 10 cm, stop the motors. A reading of 6 cm meets that condition; a reading of 15 cm does not.",
    "why_it_matters": "A sensor reading can become the input to a programmed decision.",
    "question": "Should the robot stop at 8 cm? Explain using the rule.",
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
    "title": "Remember the score",
    "spark_text": "A game starts with a score of 0. Each time the player collects a star, the program adds 1 to score. A variable is a named value that a program can change. After three stars, score holds 3, so the game can display the current result.",
    "why_it_matters": "A variable lets a program remember information while it runs.",
    "question": "What value should score hold after five stars, and why does the game need to remember it?",
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
    "title": "A plan needs a clear first step",
    "spark_text": "A group wants to create a guide for new students. It names the audience, lists the three questions the guide must answer, and assigns someone to draft each answer. A project plan describes the intended result and manageable steps toward it.",
    "why_it_matters": "A specific plan makes it easier to begin and check progress.",
    "question": "What should the group decide about its audience and content before making the guide?",
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
    "title": "A plan needs a clear first step",
    "spark_text": "A group wants to create a guide for new students. It names the audience, lists the three questions the guide must answer, and assigns someone to draft each answer. A project plan describes the intended result and manageable steps toward it.",
    "why_it_matters": "A specific plan makes it easier to begin and check progress.",
    "question": "What should the group decide about its audience and content before making the guide?",
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
    "title": "Test the idea before building everything",
    "spark_text": "A team sketches an app with a Home button and a Help button on paper. It asks a classmate where they would tap to find instructions. A prototype is an early version used to test an idea. The sketch lets the team check the navigation before programming it.",
    "why_it_matters": "An early test can reveal a confusing design while it is still easy to change.",
    "question": "What can the team learn from this paper prototype before it writes code?",
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
    "title": "Read the bars",
    "spark_text": "A club survey counts 12 students in chess, 8 in art and 5 in music. A bar chart shows one bar for each club, using the same scale for every bar. The chess bar is tallest because 12 is the largest count. Labels tell the reader which club each bar represents.",
    "why_it_matters": "A labelled chart makes comparisons easier to see.",
    "question": "How many more students chose chess than music, and how would the bars show that difference?",
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
    "title": "Explain what changed",
    "spark_text": "A student compares two versions of a poster. In the first, small text was hard to read. In the second, the text is larger, and three classmates can read it from the same distance. A reflection explains a change, its reason and the evidence of its effect.",
    "why_it_matters": "Specific evidence makes a reflection more useful than simply saying 'It is better.'",
    "question": "Which change did the student make, and what evidence suggests it helped?",
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
    "title": "Explain what changed",
    "spark_text": "A student compares two versions of a poster. In the first, small text was hard to read. In the second, the text is larger, and three classmates can read it from the same distance. A reflection explains a change, its reason and the evidence of its effect.",
    "why_it_matters": "Specific evidence makes a reflection more useful than simply saying 'It is better.'",
    "question": "Which change did the student make, and what evidence suggests it helped?",
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
    "title": "One successful run is not enough",
    "spark_text": "A robot reaches the finish once. On the next two runs, it stops early. A reliable system works consistently under the same conditions. The team keeps the route and starting point the same and repeats the test after making a change.",
    "why_it_matters": "Repeated tests help show whether a result is consistent.",
    "question": "Why does one successful run not prove that this robot is reliable?",
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
    "title": "Remember the score",
    "spark_text": "A game starts with a score of 0. Each time the player collects a star, the program adds 1 to score. A variable is a named value that a program can change. After three stars, score holds 3, so the game can display the current result.",
    "why_it_matters": "A variable lets a program remember information while it runs.",
    "question": "What value should score hold after five stars, and why does the game need to remember it?",
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
    "title": "Show evidence of the result",
    "spark_text": "A team presents its game. Instead of only saying 'It works', it shows a player collecting a star and the score changing from 0 to 1. A demonstration shows the system performing an action. Explaining the visible result helps the audience assess the team's claim.",
    "why_it_matters": "A clear demonstration connects a claim with something the audience can observe.",
    "question": "What evidence supports the team's claim that scoring works?",
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
    "title": "Show evidence of the result",
    "spark_text": "A team presents its game. Instead of only saying 'It works', it shows a player collecting a star and the score changing from 0 to 1. A demonstration shows the system performing an action. Explaining the visible result helps the audience assess the team's claim.",
    "why_it_matters": "A clear demonstration connects a claim with something the audience can observe.",
    "question": "What evidence supports the team's claim that scoring works?",
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
    "title": "Remember the score",
    "spark_text": "A game starts with a score of 0. Each time the player collects a star, the program adds 1 to score. A variable is a named value that a program can change. After three stars, score holds 3, so the game can display the current result.",
    "why_it_matters": "A variable lets a program remember information while it runs.",
    "question": "What value should score hold after five stars, and why does the game need to remember it?",
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
    "title": "Leave the workspace ready",
    "spark_text": "At the end of a robotics lesson, a pair stops the robot, follows the teacher's power-down instructions, returns the parts to labelled spaces and saves its program. A routine is a repeated sequence of actions. Following the same agreed steps makes missing files or parts easier to notice.",
    "why_it_matters": "A clear routine helps the next person find a usable workspace.",
    "question": "Which action protects the students' code, and which action helps keep the parts organised?",
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
    "title": "Parts work together",
    "spark_text": "A student types a sentence on a keyboard. The computer processes the input and shows the sentence on a screen. The keyboard provides input, the processor follows instructions, and the screen provides output. These connected parts work together as a computing system.",
    "why_it_matters": "A system's result depends on parts performing connected jobs.",
    "question": "What jobs do the keyboard and screen perform in this system?",
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
    "title": "Turn club choices into a table",
    "spark_text": "A survey records three choices: Ana chose chess, Luis chose art, and Mei chose chess. A table can organise this data with two columns, Student and Club, and one row for each student. Keeping each student's name beside the correct club preserves the meaning of the records.",
    "why_it_matters": "A clear table keeps related information together.",
    "question": "What should appear in the two cells of Luis's row?",
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
    "title": "Test the idea before building everything",
    "spark_text": "A team sketches an app with a Home button and a Help button on paper. It asks a classmate where they would tap to find instructions. A prototype is an early version used to test an idea. The sketch lets the team check the navigation before programming it.",
    "why_it_matters": "An early test can reveal a confusing design while it is still easy to change.",
    "question": "What can the team learn from this paper prototype before it writes code?",
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
    "title": "Use media to support the message",
    "spark_text": "An online guide explains how to pack a school bag. It includes a short paragraph and a photo showing the arranged items. The photo supports the explanation. An unrelated animated image would use attention without showing the reader how to complete the task.",
    "why_it_matters": "Useful media helps the audience understand the intended message.",
    "question": "Why does the packing photo help this guide more than an unrelated animation?",
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
    "title": "Let the spreadsheet calculate",
    "spark_text": "A spreadsheet stores 6 in cell B2 and 4 in cell B3. The formula =B2+B3 adds those values and shows 10. A formula is an instruction that calculates a result. If B3 changes to 7, the same formula shows 13 without being rewritten.",
    "why_it_matters": "Cell references help calculations follow changes in the data.",
    "question": "What would =B2+B3 show if B2 became 9 and B3 stayed 4? Explain.",
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
    "title": "Let the spreadsheet calculate",
    "spark_text": "A spreadsheet stores 6 in cell B2 and 4 in cell B3. The formula =B2+B3 adds those values and shows 10. A formula is an instruction that calculates a result. If B3 changes to 7, the same formula shows 13 without being rewritten.",
    "why_it_matters": "Cell references help calculations follow changes in the data.",
    "question": "What would =B2+B3 show if B2 became 9 and B3 stayed 4? Explain.",
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
    "title": "What starts the action?",
    "spark_text": "An app has a button labelled Play. Pressing that button is an event. The app responds by playing a sound. The button itself is not the sound; it is the control that triggers the action. Without the event, this sound does not start.",
    "why_it_matters": "An event connects something the user does with a response from the program.",
    "question": "What is the event in this example, and what action does it trigger?",
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
    "title": "Make the message clear",
    "spark_text": "A recording contains a quiet voice and loud background music. Listeners struggle to understand the words. The editor lowers the music and tests the recording again. Sound quality includes how clearly the intended sound can be heard, not just how loud the whole recording is.",
    "why_it_matters": "Listeners need to hear the message clearly.",
    "question": "Why could lowering the music improve this recording more than making everything louder?",
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
    "title": "Design for the person using it",
    "spark_text": "A club makes a lunch-order app for younger students. In a trial, several users cannot find the order button because its label says 'Execute'. The team changes it to 'Place order' and tests again. A user need is something the intended person must be able to understand or do.",
    "why_it_matters": "A design should help its intended users complete their task.",
    "question": "Which user need does the new button label address?",
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
    "title": "Can the budget cover it?",
    "spark_text": "A class has $20 for materials. Card costs $8, tape costs $5 and markers cost $4. A budget compares the money available with planned costs. These items cost $17 altogether, leaving $3. Adding another $5 item would make the total greater than $20.",
    "why_it_matters": "Checking costs before buying helps a group stay within its limit.",
    "question": "Can the class add the $5 item without changing its plan? Explain using the totals.",
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
    "title": "Numbers need labels",
    "spark_text": "A file contains the values 12, 8 and 5. Without labels, Jo cannot tell what they describe. She adds the labels Chess, Art and Music and the heading Number of students. Data is recorded information. Labels give these numbers the context needed to interpret them.",
    "why_it_matters": "A number alone may not tell a reader what was measured.",
    "question": "What information was missing before Jo added the labels?",
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
    "title": "Which details should stay private?",
    "spark_text": "A game profile asks Ana to choose a display name. Another player asks for her home address and password. A display name can identify her in the game without revealing her address. She does not need to share her address or password to play with someone.",
    "why_it_matters": "Sharing fewer personal details gives strangers less information about you.",
    "question": "Which two details should Ana keep private, and why?",
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
    "title": "Break the game into parts",
    "spark_text": "A group wants to make a collecting game. It separates the work into moving the player, placing objects and updating the score. Decomposition means breaking a large problem into smaller parts. The group can build and test each part before combining them.",
    "why_it_matters": "Smaller tasks are easier to explain, share and test.",
    "question": "Name two smaller tasks from the reading and explain why testing them separately could help.",
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
    "title": "Remember the score",
    "spark_text": "A game starts with a score of 0. Each time the player collects a star, the program adds 1 to score. A variable is a named value that a program can change. After three stars, score holds 3, so the game can display the current result.",
    "why_it_matters": "A variable lets a program remember information while it runs.",
    "question": "What value should score hold after five stars, and why does the game need to remember it?",
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
    "title": "Pause before you send",
    "spark_text": "Leo receives a message that says, 'Send your password now or your account will close.' The message tries to make him act quickly. A password is private information. Instead of replying or using the message's link, Leo can open the service through its usual app and ask a trusted adult for help.",
    "why_it_matters": "An urgent message can pressure someone into sharing private information.",
    "question": "What should Leo do instead of sending his password? Explain why.",
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
    "title": "Read the bars",
    "spark_text": "A club survey counts 12 students in chess, 8 in art and 5 in music. A bar chart shows one bar for each club, using the same scale for every bar. The chess bar is tallest because 12 is the largest count. Labels tell the reader which club each bar represents.",
    "why_it_matters": "A labelled chart makes comparisons easier to see.",
    "question": "How many more students chose chess than music, and how would the bars show that difference?",
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
    "title": "A claim needs evidence",
    "spark_text": "A post claims that the school will close tomorrow, but it gives no source. Omar checks the school's official notice and finds that classes will continue. A source is where information comes from. Comparing the post with an official notice helps him decide whether to share it.",
    "why_it_matters": "Checking the original source can stop an unsupported claim from spreading.",
    "question": "Which source should Omar rely on here, and what evidence supports his choice?",
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
    "title": "Choose the right comparison",
    "spark_text": "A program lets a player enter when age is at least 12. It checks age >= 12. The symbol >= means greater than or equal to. For age 12 the comparison is true; for age 11 it is false. A comparison produces a true-or-false result.",
    "why_it_matters": "A small change in a comparison can change who meets a rule.",
    "question": "Would age 13 pass this check? Explain what >= means.",
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
    "title": "Spot the risk before it happens",
    "spark_text": "A group plans to keep its only project file on a shared computer. Other people use that computer and may delete the file. A risk is the possibility that something unwanted could happen. Saving a separate backup reduces the harm if the working file is lost.",
    "why_it_matters": "Naming a risk helps you choose a useful protection.",
    "question": "What is the risk in this situation, and which action would reduce its impact?",
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
    "title": "A model has three dimensions",
    "spark_text": "A digital box model is 4 cm wide, 3 cm deep and 2 cm high. A 3D model represents width, depth and height. If the designer doubles only the height, the new model is 4 cm wide, 3 cm deep and 4 cm high.",
    "why_it_matters": "Checking each dimension helps a designer change the intended part of a model.",
    "question": "Which dimension changes in this example, and which two stay the same?",
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
    "title": "Use media to support the message",
    "spark_text": "An online guide explains how to pack a school bag. It includes a short paragraph and a photo showing the arranged items. The photo supports the explanation. An unrelated animated image would use attention without showing the reader how to complete the task.",
    "why_it_matters": "Useful media helps the audience understand the intended message.",
    "question": "Why does the packing photo help this guide more than an unrelated animation?",
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
    "title": "Choose an action with a condition",
    "spark_text": "A game checks whether the player has at least 10 points. If the condition is true, it opens the next level. If the condition is false, the player stays in the current level. A condition is a statement a program can check as true or false.",
    "why_it_matters": "Conditions let a program choose between actions.",
    "question": "What happens at 8 points and at 10 points? Use the rule in the reading.",
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
    "title": "A plan needs a clear first step",
    "spark_text": "A group wants to create a guide for new students. It names the audience, lists the three questions the guide must answer, and assigns someone to draft each answer. A project plan describes the intended result and manageable steps toward it.",
    "why_it_matters": "A specific plan makes it easier to begin and check progress.",
    "question": "What should the group decide about its audience and content before making the guide?",
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
    "title": "Test the idea before building everything",
    "spark_text": "A team sketches an app with a Home button and a Help button on paper. It asks a classmate where they would tap to find instructions. A prototype is an early version used to test an idea. The sketch lets the team check the navigation before programming it.",
    "why_it_matters": "An early test can reveal a confusing design while it is still easy to change.",
    "question": "What can the team learn from this paper prototype before it writes code?",
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
    "title": "A reading triggers a response",
    "spark_text": "A robot uses a distance sensor to measure how far away an object is. Its rule says: if the distance is less than 10 cm, stop the motors. A reading of 6 cm meets that condition; a reading of 15 cm does not.",
    "why_it_matters": "A sensor reading can become the input to a programmed decision.",
    "question": "Should the robot stop at 8 cm? Explain using the rule.",
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
    "title": "Find the cause of the wrong result",
    "spark_text": "A game should add one point for each star, but it adds two. Eva checks the scoring instructions and finds two 'add 1' commands running for the same star. She removes one and tests again. Debugging means finding and fixing the cause of a problem.",
    "why_it_matters": "A useful fix addresses the cause and is checked with another test.",
    "question": "What caused the extra point, and how can Eva check that her fix worked?",
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
    "title": "Spot the risk before it happens",
    "spark_text": "A group plans to keep its only project file on a shared computer. Other people use that computer and may delete the file. A risk is the possibility that something unwanted could happen. Saving a separate backup reduces the harm if the working file is lost.",
    "why_it_matters": "Naming a risk helps you choose a useful protection.",
    "question": "What is the risk in this situation, and which action would reduce its impact?",
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
    "title": "Explain what changed",
    "spark_text": "A student compares two versions of a poster. In the first, small text was hard to read. In the second, the text is larger, and three classmates can read it from the same distance. A reflection explains a change, its reason and the evidence of its effect.",
    "why_it_matters": "Specific evidence makes a reflection more useful than simply saying 'It is better.'",
    "question": "Which change did the student make, and what evidence suggests it helped?",
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
    "title": "Turn club choices into a table",
    "spark_text": "A survey records three choices: Ana chose chess, Luis chose art, and Mei chose chess. A table can organise this data with two columns, Student and Club, and one row for each student. Keeping each student's name beside the correct club preserves the meaning of the records.",
    "why_it_matters": "A clear table keeps related information together.",
    "question": "What should appear in the two cells of Luis's row?",
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
    "title": "An input leads to an output",
    "spark_text": "A small board has a button and a light display. Pressing the button gives the program an input. The program follows an instruction to show a heart on the display. The visible heart is an output. Input is information received; output is a result produced.",
    "why_it_matters": "Following an input through to its output helps explain how a device works.",
    "question": "What is the input in this example, and what output does it cause?",
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
    "title": "A plan needs a clear first step",
    "spark_text": "A group wants to create a guide for new students. It names the audience, lists the three questions the guide must answer, and assigns someone to draft each answer. A project plan describes the intended result and manageable steps toward it.",
    "why_it_matters": "A specific plan makes it easier to begin and check progress.",
    "question": "What should the group decide about its audience and content before making the guide?",
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
    "title": "An input leads to an output",
    "spark_text": "A small board has a button and a light display. Pressing the button gives the program an input. The program follows an instruction to show a heart on the display. The visible heart is an output. Input is information received; output is a result produced.",
    "why_it_matters": "Following an input through to its output helps explain how a device works.",
    "question": "What is the input in this example, and what output does it cause?",
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
    "title": "Write down what actually happened",
    "spark_text": "A button is supposed to turn a light on. In a test table, Sam records Expected: light turns on; Actual: light stays off. A test compares what should happen with what does happen. Recording the difference gives a clear starting point for finding the problem.",
    "why_it_matters": "An actual result is evidence, even when the test fails.",
    "question": "Did this test pass? Explain using the expected and actual results.",
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
    "title": "Show evidence of the result",
    "spark_text": "A team presents its game. Instead of only saying 'It works', it shows a player collecting a star and the score changing from 0 to 1. A demonstration shows the system performing an action. Explaining the visible result helps the audience assess the team's claim.",
    "why_it_matters": "A clear demonstration connects a claim with something the audience can observe.",
    "question": "What evidence supports the team's claim that scoring works?",
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
    "title": "Two symbols can represent information",
    "spark_text": "A display uses three lights. Each light is either off, written 0, or on, written 1. The patterns 001 and 010 use the same two symbols but put them in different positions. A binary representation uses two possible symbols or states to encode information.",
    "why_it_matters": "Both the states and their positions can carry meaning.",
    "question": "How are 001 and 010 different even though each has only one light on?",
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
    "title": "Remember the score",
    "spark_text": "A game starts with a score of 0. Each time the player collects a star, the program adds 1 to score. A variable is a named value that a program can change. After three stars, score holds 3, so the game can display the current result.",
    "why_it_matters": "A variable lets a program remember information while it runs.",
    "question": "What value should score hold after five stars, and why does the game need to remember it?",
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
    "title": "A plan needs a clear first step",
    "spark_text": "A group wants to create a guide for new students. It names the audience, lists the three questions the guide must answer, and assigns someone to draft each answer. A project plan describes the intended result and manageable steps toward it.",
    "why_it_matters": "A specific plan makes it easier to begin and check progress.",
    "question": "What should the group decide about its audience and content before making the guide?",
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
    "title": "Break the game into parts",
    "spark_text": "A group wants to make a collecting game. It separates the work into moving the player, placing objects and updating the score. Decomposition means breaking a large problem into smaller parts. The group can build and test each part before combining them.",
    "why_it_matters": "Smaller tasks are easier to explain, share and test.",
    "question": "Name two smaller tasks from the reading and explain why testing them separately could help.",
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
    "title": "Show evidence of the result",
    "spark_text": "A team presents its game. Instead of only saying 'It works', it shows a player collecting a star and the score changing from 0 to 1. A demonstration shows the system performing an action. Explaining the visible result helps the audience assess the team's claim.",
    "why_it_matters": "A clear demonstration connects a claim with something the audience can observe.",
    "question": "What evidence supports the team's claim that scoring works?",
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
    "title": "Find the cause of the wrong result",
    "spark_text": "A game should add one point for each star, but it adds two. Eva checks the scoring instructions and finds two 'add 1' commands running for the same star. She removes one and tests again. Debugging means finding and fixing the cause of a problem.",
    "why_it_matters": "A useful fix addresses the cause and is checked with another test.",
    "question": "What caused the extra point, and how can Eva check that her fix worked?",
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
    "title": "Design for the person using it",
    "spark_text": "A club makes a lunch-order app for younger students. In a trial, several users cannot find the order button because its label says 'Execute'. The team changes it to 'Place order' and tests again. A user need is something the intended person must be able to understand or do.",
    "why_it_matters": "A design should help its intended users complete their task.",
    "question": "Which user need does the new button label address?",
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
    "title": "Explain what changed",
    "spark_text": "A student compares two versions of a poster. In the first, small text was hard to read. In the second, the text is larger, and three classmates can read it from the same distance. A reflection explains a change, its reason and the evidence of its effect.",
    "why_it_matters": "Specific evidence makes a reflection more useful than simply saying 'It is better.'",
    "question": "Which change did the student make, and what evidence suggests it helped?",
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
    "title": "Show evidence of the result",
    "spark_text": "A team presents its game. Instead of only saying 'It works', it shows a player collecting a star and the score changing from 0 to 1. A demonstration shows the system performing an action. Explaining the visible result helps the audience assess the team's claim.",
    "why_it_matters": "A clear demonstration connects a claim with something the audience can observe.",
    "question": "What evidence supports the team's claim that scoring works?",
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
    "title": "Show evidence of the result",
    "spark_text": "A team presents its game. Instead of only saying 'It works', it shows a player collecting a star and the score changing from 0 to 1. A demonstration shows the system performing an action. Explaining the visible result helps the audience assess the team's claim.",
    "why_it_matters": "A clear demonstration connects a claim with something the audience can observe.",
    "question": "What evidence supports the team's claim that scoring works?",
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
    "title": "Choose an action with a condition",
    "spark_text": "A game checks whether the player has at least 10 points. If the condition is true, it opens the next level. If the condition is false, the player stays in the current level. A condition is a statement a program can check as true or false.",
    "why_it_matters": "Conditions let a program choose between actions.",
    "question": "What happens at 8 points and at 10 points? Use the rule in the reading.",
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
    "title": "Show evidence of the result",
    "spark_text": "A team presents its game. Instead of only saying 'It works', it shows a player collecting a star and the score changing from 0 to 1. A demonstration shows the system performing an action. Explaining the visible result helps the audience assess the team's claim.",
    "why_it_matters": "A clear demonstration connects a claim with something the audience can observe.",
    "question": "What evidence supports the team's claim that scoring works?",
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
    "title": "A plan needs a clear first step",
    "spark_text": "A group wants to create a guide for new students. It names the audience, lists the three questions the guide must answer, and assigns someone to draft each answer. A project plan describes the intended result and manageable steps toward it.",
    "why_it_matters": "A specific plan makes it easier to begin and check progress.",
    "question": "What should the group decide about its audience and content before making the guide?",
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
    "title": "Show evidence of the result",
    "spark_text": "A team presents its game. Instead of only saying 'It works', it shows a player collecting a star and the score changing from 0 to 1. A demonstration shows the system performing an action. Explaining the visible result helps the audience assess the team's claim.",
    "why_it_matters": "A clear demonstration connects a claim with something the audience can observe.",
    "question": "What evidence supports the team's claim that scoring works?",
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
