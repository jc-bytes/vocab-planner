<!-- Converted from L6 Lesson plan - Sensing - Y6.docx -->

# Lesson 6: Making a step counter

Enjoyed teaching these lessons? Found a mistake? Share feedback at the-cc.io/feedback.

## Introduction

Learners will use the design that they have created in Lesson 5 to make a micro:bit-based step counter. First, they will review their plans, followed by creating their code. Learners will test and debug their code, using the emulator and then the physical device. To successfully complete this project, learners will need to demonstrate their understanding of all the programming lessons they've had so far.

## Learning objectives

To develop a program to use inputs and outputs on a controllable device

- I can create a program based on my design

- I can test my program against my design

- I can use a range of approaches to find and fix bugs

## Key vocabulary

Plan, create, code, test, debug

## Preparation

Subject knowledge:

To help learners review their design from the previous lesson, it would be useful for them to receive feedback on their designs from Lesson 5.

You will need to be familiar with the completed project. It might be useful for you to attempt to create the project, based on the task and a design, to identify with learners’ experiences.

In this lesson, learners will be working at the ‘code’ and ‘running the code’ levels of abstraction (LOA). More details on LOA are included in the unit overview.

You will need:

- L6 Slides

- L6 – Computers with USB connectivity and access to makecode.microbit.org

- L6 – micro:bits with a micro USB lead

- A1 Activity sheet – Step counter design template from Lesson 5

- A1 Code – Step counter Parson’s (the-cc.io/stepcounterparsons)

- A2 Code – Step counter (the-cc.io/stepcounter)

- A2 (Optional) – Sticky tape, Blu Tack, or elastic bands

- A3 Code – Step counter sensitivity (the-cc.io/stepcountersensitivity)

## Assessment opportunities

Activity 1: Assess whether learners can implement their algorithms as code independently.

Activity 2: Assess whether learners can use a range of approaches to test and debug their code.

Activity 3: Assess whether learners can improve the function of a step counter.

Plenary: Assess whether learners are able to reflect on how well they have met the given task.

## Outline plan

Please note that the slide deck labels the activities in the top right-hand corner to help you navigate the lesson.

*Timings are rough guides

| Introduction<br>(Slides 3)<br>5 mins | Review your design<br>Show slide 3. Ask learners to review their designs from the previous lesson. This is an opportunity for learners to remind themselves of their design and to make improvements. For prompts, ask learners to consider:<br>Is your design clear enough? This is an opportunity for learners to review a partner’s plan — the design should be clear enough for another pupil to follow.<br>Do you know what you need to do next?<br>Emphasise to learners that they should revisit their design when they are creating the code if they feel the design is unclear, or not meeting the task. |
| --- | --- |
| Activity 1<br>(Slide 4)<br>15 mins | Create your code<br>Display slide 4. Explain to the learners that they will now have the opportunity to create their program using their design. Ask the learners to follow the link on the slide to begin creating their project.<br>Note: When testing on the emulator, learners may find that the ‘step’ value increases in multiples each time ‘shake’ is simulated. This is because the sensitivity for ‘shake’ has been pre-set for the on shake block. Learners will have an opportunity to address this in activity 3..<br>Remind the learners that they should be using the emulator to test their code as they move through the creation of their program.<br>Note: To help support learners when creating their code, a completed version of a step counter project is provided with this lesson. This is not the only viable solution; if learners are taking their code in a different direction, but their code is running successfully, encourage them to continue.<br>Scaffolded learning: If some of your learners are not confident enough to start from the template provided, direct them towards the scaffolded learning link in the ‘you will need’ section of this plan. This provides the learners with a number of blocks already in the programming environment, which they can use to build their program.<br>Note: The positioning of the final if, then statement is important. If it is placed inside any of the other if, then or if, then, else statements, it will not function correctly. |
| Activity 2 (Slides 5–9)<br>10 mins | Test and debug<br>Display slide 5. Explain to the learners that they will now have the opportunity to test their programs. Encourage the learners to give their program one more check using the emulator. Once they have completed this check, they can move on to testing it on a physical micro:bit.<br>Share slides 6 and 7. Remind the learners of the process for transferring their program to the micro:bit.<br>Display slide 8. Explain to the learners that they need to make sure that the micro:bit and the battery pack are securely attached to their shoe — one suggested solution is shown on the slide. If necessary, sticky tape, Blu Tack, or elastic bands can be used to provide extra support for the device.<br>Once they have secured their device, ask learners to test it as a physical step counter. They should evaluate how successfully the program and the device functions, and how it compares to the testing on the emulator.<br>Note: Learners may experience a similar issue to when the program is run on the emulator — the pre-set sensitivity of the on shake block may lead to the variable ‘step’ increasing in increments greater than one. Learners have an opportunity to address this in the next activity.<br>Display slide 9. Briefly remind the learners that there are a number of ways to fix any bugs they have found in their code. The two techniques they were taught in Lesson 5 are shown on the slide.<br>Note: If, during the debugging process, learners identify that their algorithm is the problem, they will need to review their designs. This is not part of the debugging process, which is completed solely at the ‘code’ level. |
| Activity 3<br>(Slide 10)<br>10 mins | Adjust the sensitivity of your counter<br>Display slide 10. Explain that the pre-set sensitivity of the on shake block may lead to the variable ‘step’ increasing in increments greater than one.<br>To correct the sensitivity issue caused by using the on shake block, learners can use a ‘greater than’ Logic block. The acceleration (mg) strength block can be found in the Input blocks.<br>Note: The greater the value, the more vigorously the micro:bit will need to be shaken to change the variable. Because each learner will shake the device differently, they will each need to experiment with this value.<br>Using the same process as before, encourage learners to experiment with the value and test it on the emulator and then their micro:bit (time allowing). Remind learners that each time they change the program, they will need to transfer it to their micro:bit again.<br>A complete project, with sensitivity added, is included in this lesson for reference. |
| Plenary<br>(Slide 11)<br>5 mins | Self-reflection<br>Display slide 11. Explain to the learners that this is a chance for them to reflect on their own projects and how well they have met the task. Ask them to consider if they have achieved the task, which is presented on the slide. They also need to think about whether they have enhanced their project in any way to make it work more effectively. |
| Review<br>(Slides 12–13)<br>5 mins | This time, next time<br>Review the ‘Assessment’ and ‘Summary’ slides. |

Resources are updated regularly - the latest version is available at: the-cc.io/curriculum.

This resource is licensed by the Raspberry Pi Foundation under a Creative Commons Attribution-NonCommercial-ShareAlike 4.0 International license. To view a copy of this license, visit, see creativecommons.org/licenses/by-nc-sa/4.0/.
