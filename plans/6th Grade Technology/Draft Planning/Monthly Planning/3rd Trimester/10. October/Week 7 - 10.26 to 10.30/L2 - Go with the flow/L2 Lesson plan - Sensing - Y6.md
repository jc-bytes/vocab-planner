<!-- Converted from L2 Lesson plan - Sensing - Y6.docx -->

# Lesson 2: Go with the flow

Enjoyed teaching these lessons? Found a mistake? Share feedback at the-cc.io/feedback.

## Introduction

Learners will explore how ‘if, then, else’ statements are used to direct the flow of a program. They will initially relate ‘if, then, else’ statements to real-world situations, before creating programs in MakeCode. They will apply their knowledge of ‘if, then, else’ statements to create a program that features selection influenced by a random number to create a micro:bit fortune teller project.

## Learning objectives

To explain that selection can control the flow of a program

- I can identify examples of conditions in the real world

- I can use a variable in an ‘if, then, else’ statement to select the flow of a program

- I can determine the flow of a program using selection

## Key vocabulary

Selection, condition, if then else, variable, random

## Preparation

Subject knowledge:

You will need to be familiar with the programming construct of selection. This is introduced in the Year 5 units, with if statements covered in ‘Programming A – Selection in physical computing’, and ‘if, then, else’ in ‘Programming B – Selection in quizzes’.

This lesson introduces program flow — this is the order in which commands are executed (run) in a program. The diagrams in this, and subsequent lessons are indicative of the program flow, but may not be a true representation of the full sequence of the program.

It will be useful to familiarise yourself with the projects featured in all three activities.

For the ‘If, then, else statement in a program’ activity, make sure you show the emulator rather than the code. This will need to be set up prior to the lesson.

You will need:

- L2 Slides

- L2 – Computers with USB connectivity and access to makecode.microbit.org

- L2 – micro:bits with a micro USB lead

- A1 Activity sheet – Conditions in the real world

- A2 Code – Icons (the-cc.io/icons)

- A2 Code – Yes or no (the-cc.io/yesorno)

- A2 Code – Exploratory task (the-cc.io/yesornoexploratory)

- A2 Handout – Algorithm and program flow

- A2 Activity sheet (Exploratory task) – Adding another ‘else’

- A3 Activity sheet – The flow of a program

- A3 Solutions – The flow of a program

## Assessment opportunities

Activity 1: Assess whether learners can relate conditions to real-world situations.

Activity 2: Assess whether learners can use variables to select the flow of a program.

Activity 3: Assess whether learners can demonstrate the flow of a program.

## Outline plan

Please note that the slide deck labels the activities in the top right-hand corner to help you navigate the lesson.

*Timings are rough guides

| Introduction<br>(Slide 3)<br>5 mins | Following a flow<br>Show slide 3. Explain to learners that when they make decisions, they follow a flow. This can help them find out information, categorise objects, or determine the flow of a program. The image on slide 3 is an example of branching (covered in the Year 3 Data and information unit – Branching databases).<br>Ask learners to use the diagram to answer the questions on the slide. Build the slide one question at a time. After each question has been answered, trace the route through on the slide to demonstrate.<br>Q: Which object can fly without wings?<br>A: The hot-air balloon<br>Q: Which object cannot fly, but has got an engine?<br>A: The motorbike |
| --- | --- |
| Activity 1<br>(Slides 4–7)<br>10 mins | Making decisions<br>Display slide 4. Show the example of a real-world situation, where a condition influences the decision that is made. In this case, the decision is that if it is sunny, then they will play basketball, otherwise they will go bowling. Build the slide to demonstrate this flow.<br>Show slide 5. Explain that the previous slide was an example of an ‘if, then, else’ statement with two outcomes: one to be carried out if the condition is true (it is sunny); the other to be carried out if the condition is false (it is not sunny).<br>Display slide 6. Demonstrate that the ‘if, then, else’ principle can be applied to a decision like this one. Build the slide to show each part of the ‘if, then, else’ statement.<br>Share slide 7 and show how ‘if, then, else’ statements are represented in programming. Distribute the A1 Activity sheet. Ask learners to come up with their own examples of real-world ‘if, then, else’ statements in a similar format to the statement on the slide.<br>Note: The ‘code’ on slide 7 is solely a representation of code and is not supposed to mimic a specific programming language. |
| Activity 2<br>(Slides 8–12)<br>15 mins | Using variables<br>Display slide 8. Demonstrate the project on the emulator, using the language on the slide:<br>If button A is pressed then<br>Show a tick<br>Else<br>Show a cross<br>Note: The emulator takes a few seconds to recognise that the button has been clicked, so you will need to hold the button longer than a single click.<br>Explain that the project uses button A as the input to control the flow of the program.<br>Show slide 9. Explain to the learners that instead of using buttons to control the flow of a program, they can also use a variable. Remind the learners that a variable is a value that can be set and changed throughout the running of a program. Ask learners to make a new project in MakeCode and name it ‘fortune teller’.<br>Display slide 10. To complete this task, learners will need to generate a random number. Explain that in MakeCode, random numbers can be generated using the pick random block. The example on slide 11 would perform in a similar way to a dice. Each time it is run, it will generate a random number between one and six. Build the slide to show the dice also generating random numbers.<br>Share slide 11. Show the learners the algorithm design and program flow for a program that will randomly generate ‘Yes’ or ‘No’ answers. Read through the algorithm and then ask some questions to assess learners’ understanding of it, e.g.:<br>Q: Where is the input in the algorithm?<br>A: When shaken<br>Q: Where is a variable introduced?<br>A: When the random number is saved as ‘answer’<br>Q: Where is there a condition?<br>A: When the answer is checked<br>Provide each learner with the A2 Handout and allow them time to create their program. Remind the learners to use their emulators to help identify any bugs in their code. Allow learners time to modify their code, if they need it.<br>Note: You may wish to give the learners time to flash their programs to physical micro:bits to demonstrate their working project away from the emulator.<br>Exploratory task: Provide the learners with the A2 Activity sheet. Challenge the learners to adapt their program so there are three possible outcomes. They will need to click the plus symbol at the bottom of the if, then, else block to add an else, if. They then need to adapt the range of random numbers created and decide on the string for the third outcome. The complete program for the exploratory task is included in the ‘You will need’ section of this plan and as a ‘hex’ file in the lesson folder.<br>A solution to the main activity is included on slide 12. A complete program, A2 Code – Yes or no, is also included in the ‘You will need’ section of this plan and as a ‘hex’ file in the lesson folder. |
| Activity 3 (Slides 13–15)<br>10 mins | The flow of a program<br>Display slide 13. Explain to learners that the ‘flow’ of the program differs according to whether a condition is met or not, and that this can be represented on a flow diagram. The flow diagram represents the program flow in the code the learners have created (some pupils may not have added the else, if to their project) in the previous activity.<br>Show slide 14. Ask the pupils to think, pair share, what flow the program will follow if the answer is 2. Take suggestions and build the slide to show the flow.<br>Display slide 15. Provide learners with A3 Activity sheet. Explain to the pupils that they will need to determine the flow of the program based on the answer given. They can shade their activity sheet to show the direction of flow. The file A3 Solutions, provided in the lesson folder, shows the flow of the program. |
| Plenary<br>(Slide 16)<br>5 mins | Alternative power!<br>Display slide 16. Explain that later in the unit, the learners will need to test their code on a micro:bit that is powered by a battery pack. Demonstrate how to connect the battery pack to the battery connector on the micro:bit.<br>Ask learners about the advantages and disadvantages of running the micro:bit from a battery pack instead of from a computer. Responses may include:<br>Advantages: The device will be more portable, it can be tested away from the computer, it could be integrated into other projects etc.<br>Disadvantages: You need batteries to power it, the battery pack is bulky compared to the device, you need to connect it back to a computer to flash a new or updated program. |
| Next time<br>(Slides 17–18)<br>5 mins | This time, next time<br>Review the ‘Assessment’ and ‘Summary’ slides. |

Resources are updated regularly - the latest version is available at: the-cc.io/curriculum.

This resource is licensed by the Raspberry Pi Foundation under a Creative Commons Attribution-NonCommercial-ShareAlike 4.0 International license. To view a copy of this license, visit, see creativecommons.org/licenses/by-nc-sa/4.0/.
