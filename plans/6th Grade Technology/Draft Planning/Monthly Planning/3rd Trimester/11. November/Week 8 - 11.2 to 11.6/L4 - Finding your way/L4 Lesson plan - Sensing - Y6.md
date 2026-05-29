<!-- Converted from L4 Lesson plan - Sensing - Y6.docx -->

# Lesson 4: Finding your way

Enjoyed teaching these lessons? Found a mistake? Share feedback at the-cc.io/feedback.

## Introduction

Learners will apply their understanding of the importance of order in programs. They will then use comparison operators in selection to determine the flow of a program. Learners will then modify a program, which will enable the micro:bit to be used as a navigational device. To code this, they will adapt the code they completed to make a basic compass.

## Learning objectives

To use a conditional statement to compare a variable to a value

- I can use a comparison operator (e.g. <>=) in an if, then statement

- I can explain the importance of the order of conditions in else, if statements

- I can modify a program to achieve a different outcome

## Key vocabulary

Compass, direction, variable, navigation

## Preparation

Subject knowledge:

If the compass is being used on the micro:bit for the first time, the device will prompt the user to move it in a number of different directions so that it orientates correctly. Simply follow the instructions on the LEDs to complete this process.

The ‘Using a micro:bit for directions’ activity is structured around the levels of abstraction (LOA) theory of design. More guidance on LOA is included in the unit overview.

Throughout this lesson, the term ‘comparison operators’ has been used to describe math symbols within an expression. This allows us to distinguish between ‘comparison operators’ (e.g. < > =) and ‘logical operators’ (e.g. and/or) which learners may be familiar with from other units.

You will need:

- L4 Slides

- L4 – Computers with USB connectivity and access to makecode.microbit.org

- L4 – micro:bits with a micro USB lead

- A1 Activity sheet – Program flow

- A2 Code – Simple compass (the-cc.io/simplecompass)

- A2 (Optional) – Individual whiteboards or scrap paper

- A3 Handout – Compass algorithm and program flow

- A3 Code – Complete compass (the-cc.io/compass)

- A3 Handout – Compass exploratory task

- A3 Code – Complete compass exploratory (the-cc.io/compasscomplex)

- L4 Homework – Micro:bit project ideas (Optional)

## Assessment opportunities

Activity 1: Assess whether learners can explain the importance of order in else, if statements.

Activity 2: Assess whether learners can use a comparison operator in an if, then statement.

Activity 3: Assess whether learners can modify a program to achieve a different outcome.

## Outline plan

Please note that the slide deck labels the activities in the top right-hand corner to help you navigate the lesson.

*Timings are rough guides

| Introduction<br>(Slides 3–5)<br>10 mins | What is a compass?<br>Show slide 3. Ask the learners what they know about compasses, encouraging them to use the points on the slide as prompts.<br>Show slide 4. Identify that compasses are used for navigation, as they show which direction is north. Explain that they work because a small magnet means the needle always points towards the magnetic North Pole. Discuss who might use a compass, offer examples such as sailors or people navigating remote terrain.<br>Note: Some learners may say that we use satellite navigation for this purpose. Explain that satellite navigation relies on roads, and would not be helpful in remote locations or at sea.<br>Display slide 5. Ask the learners to think, pair, share, “Which direction is the compass pointing?” Build the slide to show the arrow pointing north, then east, and then between east and south. Explain to learners that if they are only using the four points of a compass, in this example the pointer is nearest to south. |
| --- | --- |
| Activity 1<br>(Slides 6–9)<br>10 mins | Using comparison operators<br>Display slide 6. Explain to the learners that compass headings can also be represented in degrees. Build the slide to show the compass heading (°) block from the MakeCode environment, which uses degrees.<br>Share slide 7. Show learners that if only the four main points of a compass are being used, a range can be applied to each direction. Build slide 7 to demonstrate the range for each direction. Ensure pupils understand that because north is at 0° and 360°, two ranges are required: 315° to 360° and 0° to 45°.<br>Display slide 8. Group the learners into pairs and provide each pair with the A1 Activity sheet. Explain to the learners that their handouts show the complete program flow for the incomplete program on the slide. Explain that you will build the slide to reveal some compass headings and the learners need to trace their program flow to find what will be shown on the micro:bit when the program is complete.<br>Note: This activity will demonstrate the learners’ understanding of using comparison operators. It is important that they can tell you how they have reached a specific part of the program flow and not just give the answer. Have the learners come and show how they got to the correct answer using the program flow on the slide.<br>Display slide 9 to reveal the answers (noted below).<br>The solutions and expected learner responses can be found below.<br>120 = East. “I know that it is more than 45, so the first condition is false. It is less than 135, so the next condition is true. The heading will be E.”<br>30 = North. “I know that the number is less than 45, so the condition is true. The heading will be N.”<br>140 = South. “I know that the number is more than 135, so the first two conditions will be false. The next condition is true because it is less than 225. The heading will be S.”<br>325 = North. “I know that all of the conditions are false because it is more than 315. The program will use the else part of the selection. The heading will be N.”<br>270 = West. “I know that the first three conditions are false, because it is more than 225. The next condition is true, so the heading will be W.” |
| Activity 2 (Slides 10–13)<br>10 mins | Parson’s problem<br>Display slide 10. Explain to the pupils that there is an incomplete program on the slide. Explain that this program is a very simple compass, where only north and south are used.<br>Display slide 11. Tell the learners to use the link provided on the slide to open MakeCode. Explain that they need to place the two additional blocks into the program and that you would like them to test the blocks in both positions. Build the slide and ask the learners to test the program on the emulator using the number provided. They should note down the heading displayed before testing the blocks in the opposite position and noting down the new heading displayed.<br>Note: The learners need to use the emulator to check what happens with their code blocks in different positions. When using the compass, the emulator allows you to pick the direction you would like to face. You can do this by dragging the micro:bit logo on the emulator.<br>Share slide 12. Bring the learners back to the slides and ask them to think, pair, share, “What did you find out?” The learners should have two different answers for the same degree heading. Ask the learners to think, pair, share, “What does this tell you about the order of your code?” They should recognise that there is a right order in which to place the blocks to ensure the program works as expected.<br>Display slide 13. Build the slide to show the program flow for each of the different orders to reiterate the importance of placing the code in the correct order. |
| Activity 3<br>(Slides 14–15)<br>15 mins | Using a micro:bit for directions<br>Show slide 14. Explain that the learners’ task is on the slide. The learners will now be modifying their programs to create their own micro:bit compass. They will need to add two more else, if sections to their if, then block. Explain they can do this by selecting the plus symbol at the bottom of the block.<br>Display slide 15. Play the short video demonstrating how the completed program should work. Provide the pupils with the A3 Handout – Compass algorithm and program flow. Allow the learners time to complete their programs and test it on a physical micro:bit if available.<br>Note: If learners add their own set heading to block rather than duplicating, then they will also need to add the text area to the block to enable them to add letters. They can find this through the Advanced menu, under Text .<br>Exploratory task: Provide learners with A3 Handout – Exploratory task. Challenge the learners to create more accurate compasses with a narrowed range for each of the headings. For a further challenge, they may also like to include headings for north east, south east, south west, and north west.<br>Both complete codes for activity 3 can be found in the ‘You will need’ section of this lesson plan. |
| Plenary<br>(Slide 16)<br>5 mins | What else could you make?<br>Remind learners of the projects they have created so far in this unit.<br>Explain to learners that in the next lesson they will design and make their own project. Give them an opportunity to discuss some ideas. |
| Next time<br>(Slides 17–18)<br>5 mins | This time, next time<br>Review the ‘Assessment’ and ‘Summary’ slides. |
| Homework<br>(Optional) | Micro:bit project ideas<br>Ask the learners to suggest other projects that could be completed using micro:bits, based on the projects they have completed so far in this unit. |

Resources are updated regularly - the latest version is available at: the-cc.io/curriculum.

This resource is licensed by the Raspberry Pi Foundation under a Creative Commons Attribution-NonCommercial-ShareAlike 4.0 International license. To view a copy of this license, visit, see creativecommons.org/licenses/by-nc-sa/4.0/.
