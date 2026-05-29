<!-- Converted from L3 Lesson plan - Sensing - Y6.docx -->

# Lesson 3: Sensing inputs

Enjoyed teaching these lessons? Found a mistake? Share feedback at the-cc.io/feedback.

## Introduction

Learners will initially use the buttons to change the value of a variable using selection. They will then develop their programs to update the variable by moving their micro:bit and using the accelerometer to sense motion. Finally, they will learn that a variable’s value remains the same after it has been checked by the program.

## Learning objectives

To update a variable with a user input

- I can use a condition to change a variable

- I can experiment with different physical inputs

- I can explain that checking a variable doesn’t change its value

## Key vocabulary

Input, selection, condition, variable, sensing, accelerometer, value

## Preparation

Subject knowledge:

You will need to be familiar with the input capabilities of a micro:bit, especially the accelerometer, which senses movement. For more information, visit https://microbit.org/get-started/user-guide/overview/. You will also need to be familiar with the programming constructs of selection and variables. Where they apply is explained in the lesson plan below.

You will need:

- L3 Slides

- L3 – Computers with USB connectivity and access to makecode.microbit.org

- A1 Handout – Counter design template

- A1 Code – Counter full project (the-cc.io/counterfull)

- A3 (Optional) – Individual whiteboards and pens

## Assessment opportunities

Activity 1: Assess whether learners can apply their knowledge and understanding of selection to create a program, featuring selection, which updates a variable.

Activity 2: Assess whether learners can experiment with different inputs.

Activity 3: Assess whether learners can display a variable in a program and explain that, when used, the value of a variable remains the same.

## Outline plan

Please note that the slide deck labels the activities in the top right-hand corner to help you navigate the lesson.

*Timings are rough guides

| Introduction<br>(Slides 3–5)<br>5 mins | Micro:bit inputs<br>Show slide 3. Ask learners to look at their micro:bits and identify what inputs they think are on the device. From the previous lesson, learners should identify buttons A and B as inputs, they may also identify the reset button. Other inputs (the accelerometer, compass, microphone, and GPIO pins) are labelled. In addition, there is also a temperature sensor on the rear, a light sensor, and touch logo button on the front which are not labelled.<br>Display slide 4. This slide has the inputs labelled to give learners a chance to see them on their own devices.<br>Show slide 5. Explain that learners will be changing variables by using buttons A and B for the next activity. |
| --- | --- |
| Activity 1<br>(Slides 6–10)<br>15 mins | Changing a variable with buttons<br>Display slide 6. Remind the learners that a variable is a value that can be set and changed throughout the running of a program. Ask the learners to think, pair, share, “What is the first thing you need to do when working with a variable?” Build the slide to demonstrate that a variable needs to be set at the beginning of a program.<br>Share slide 7. Explain that in MakeCode, learners can initialise their variable using the on start block. This ensures that when they restart their program, the variable will be set back to the original value.<br>Show slide 8. Introduce the task for this activity — to create a program that will change a variable when a button is pressed and display the value. Build the slide and explain to the learners that this could be completed using the wrap-around Input blocks, but that the challenge in this task is to use selection from the Logic blocks.<br>Display slide 9. Provide the learners with the A1 Handout. Explain that the design for this project has been completed already. The learners need to follow the design to create their program in MakeCode. Some of the blocks they will need to use are on the slide.<br>Remind the learners to debug their code as they work through the design, using the micro:bit emulator.<br>Note: This activity encourages learners to use selection to trigger events using both buttons in one code snippet. Some programming languages do not allow you to run multiple parts, known as threads, at the same time. Therefore, it's important to know how to use selection to control the program in one long program strand.<br>Show slide 10. Open the MakeCode project link on the slide. Using the emulator to demonstrate, explain that their programs should work in a similar way.<br>Note: There are other ways of achieving this using selection. Any code that achieves the task is acceptable. |
| Activity 2<br>(Slides 11–12)<br>10 mins | Using a different input<br>Display slide 11. Remind learners that in Lesson 1 they learnt that the accelerometer senses and measures movement.<br>Share slide 12. Explain that the is gesture block from the Input category can be used to detect movement from the accelerometer. Challenge learners to adapt their program so that the counter changes when the micro:bit is moved. Learners may choose any of the options from the is gesture block.<br>Remind the learners to continue using the emulator to check their code as they create it.<br>Note: When the variable is changed by motion, it will increment in larger amounts as the micro:bit registers many small movements, all of which change the variable. This is something to draw the learners’ attention to, and it will be addressed in more detail in Lesson 6.<br>Note: Although testing the code on a device is an important step to ensure it works as expected, at this stage in the unit, the focus is on whether the learners can create a program using different inputs. As such, this program will not be transferred to the physical micro:bits. |
| Activity 3 (Slides 13–15)<br>10 mins | Checking variables<br>Display slide 13. Explain to the learners that the program on the slide is similar to the program they created in activity 1. However, it has been modified, and will not show the count after each button press. Ask the learners to think, pair, share, “How would you show the value of the count variable?”<br>Show slide 14. Explain that the program now has another if, then block. The program will now display the count value when shaken.<br>Display slide 15. There is a video to share with the learners on the slide. Using individual whiteboards, or scrap paper, ask the learners to note down the count variable value each time the micro:bit is shaken. They should have five values by the end of the video.<br>Ask the learners to think, pair, share, “Does the value of the count variable change when it is checked by the program?” Remind the learners that the is gesture condition is only showing the value of the count variable. When a program checks a variable, it does not change the value. This can be shown by the two values of 8 when the micro:bit is shaken but the button is not pressed. |
| Plenary<br>(Slides 16–17)<br>5 mins | Adding another condition<br>Show slide 16. Explain to the learners that you want to include another condition that will check whether the classroom is ‘full’. To do this, you will need to add another if, then block to your code. This will need a comparison block (for the condition) and a show string block to display the message.<br>Note: The new condition could be placed in multiple places throughout the program and work as expected. However, to make the code easier to read and follow, it has been placed in the existing if, then block for this activity.<br>Display slide 17. Reveal that the block could be placed inside the existing if, then block. Discuss that it would be most useful to place the new block here, to ensure the program flow is clearest. |
| Next time<br>(Slides 18–19)<br>5 mins | This time, next time<br>Review the ‘Assessment’ and ‘Summary’ slides. |

Resources are updated regularly - the latest version is available at: the-cc.io/curriculum.

This resource is licensed by the Raspberry Pi Foundation under a Creative Commons Attribution-NonCommercial-ShareAlike 4.0 International license. To view a copy of this license, visit, see creativecommons.org/licenses/by-nc-sa/4.0/.
