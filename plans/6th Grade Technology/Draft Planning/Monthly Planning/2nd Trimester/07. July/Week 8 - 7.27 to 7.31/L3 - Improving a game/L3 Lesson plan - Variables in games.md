<!-- Converted from L3 Lesson plan - Variables in games.docx -->

# Lesson 3: Improving a game

Enjoyed teaching these lessons? Found a mistake? Share feedback at the-cc.io/feedback.

## Introduction

Learners apply the concept of variables to enhance an existing game in Scratch. They predict the outcome of changing the same change score block in different parts of a program, then they test their predictions in Scratch. Learners also experiment with using different values in variables, and with using a variable elsewhere in a program. Finally, they add comments to their project to explain how they have met the objectives of the lesson.

## Learning objectives

To choose how to improve a game by using variables

- I can decide where in a program to change a variable

- I can make use of an event in a program to set a variable

- I can recognise that the value of a variable can be used by a program

## Key vocabulary

Variable, set, change, design, event

## Preparation

Subject knowledge:

- You will need to apply the knowledge of variables that has been developed up to this point in the unit.

You will need:

- L3 slides

- Devices that are capable of running Scratch 3

- A0 Scratch project – Pong starter (the-cc.io/pongstarter)

- A1 Activity sheet – Change the score

- A1 Scratch project – Pong (the-cc.io/pong)

## Assessment opportunities

Introduction: You can assess whether learners can identify potential variables that could be added to improve a game.

Activity 1: You can assess whether learners can read code to make predictions and then test their predictions by running the code.

Activity 2: Learners can demonstrate that they can choose and compare values to set and change variables. You can also assess whether learners can predict what will happen when a variable is updated more than once.

Activity 3: Learners can demonstrate that they can use the value of a variable elsewhere in a program.

## Outline plan

Please note that the slide deck labels the activities in the top right-hand corner to help you navigate the lesson.

*Timings are rough guides

| Introduction<br>(Slide 3)<br>5 mins | What could be set and changed in this game?<br>Display slide 3. Direct learners towards the ‘Pong starter remix’ Scratch project. Explain that this is a basic game in which a ball is bounced around the Stage by a paddle that is moved by the mouse; if the paddle misses the ball, the program stops.<br>Share the project with the learners and ask what could be set and changed to improve the game. Possible prompts include:<br>How do you know how well you are doing in the game?<br>How does the game end?<br>If necessary, remind learners of Lesson 2, where a variable for ‘Score’ was introduced.<br>Build the slide to show three variables that could be introduced in this project: ‘score’, ‘timer’, and ‘lives’.<br>Explain to learners that they are going to modify this project to include those variables. |
| --- | --- |
| Activity 1<br>(Slides 4–5)<br>15 mins | Experiment with the ‘score’ variable<br>Display slide 4. Tell learners to open the ‘Pong’ Scratch project on the slide. Ask the learners to create a ‘score’ variable in the Scratch project just as they did in Lesson 2.<br>Note: The ‘Pong’ Scratch project is the same as the project the learners investigated in the Starter activity.<br>Display slide 5. Hand out the activity sheet. Explain to learners that they need to add a change score by 1 block to the existing program in three different places — A, B, and C — which are shown on the slide. Learners should make predictions on their activity sheet for what will happen to the score when the block is added at each position, before they test it using a computer.<br>Scaffolding opportunity: Some learners may benefit from having a choice of the three possibilities. These are included on slide 3 of the activity sheet.<br>Once learners have made their predictions, direct them back to the ‘Pong’ Scratch project. They should add the block to the code and record what happens. Learners should identify the following:<br>Point A: The score is set to one when the green flag is clicked and doesn’t change. This is because the block is positioned in the setup part of the program, before any repeat commands, therefore the score only changes by one.<br>Point B: The score changes while the repeat command is running. In this position, the score changes every time the ball moves 15 steps. As this happens quite quickly in the program, the score appears to increase continuously.<br>Point C: The score changes by one each time the paddle hits the ball. In this position, the change score by 1 block is inside the if touching paddle? then condition. Therefore, the score will only change when the ball touches the paddle. |
| Activity 2 (Slides 6–9)<br>10 mins | Change and set the value of the ‘score’ variable<br>Display slide 6 and pose the question on the slide, “What would happen if the score was never reset in a game?”. Learners should identify that the score would keep changing and would never return to the original value.<br>Build the slide and ask, “When do you need to set the score in a game?”. Learners should recognise that a game score should at least be reset before each new game. Build the slide and explain to learners that a set variable to block is used to set up a variable each time a program is run, and that this is usually associated with the when green flag clicked event.<br>Note: In this activity, learners can choose any of the positions for the change score by block that they used in Activity 1.<br>This activity is less guided than the previous activity and offers learners the opportunity to experiment more freely.<br>Display slide 7. Encourage learners to try changing the score by different increments. They should identify that the larger the increment (change), the more quickly the score changes. Also, suggest that learners try to change the score by a negative number.<br>Finally, ask learners to try to change the set score to block to a different value. Combining this with a negative increment can create a countdown type of scoring system. At this stage, there is no condition to stop the score at 0, so the score continues into negative numbers.<br>Move on to slide 8. Display the code snippet and ask learners to predict how they think this would change the variable ‘score’. Learners may say that the variable increases by three. When this is run, the variables are changed twice, but when seen in a program, it happens too quickly to see each update, so the value appears to update only once.<br>Build the slide. For the second code snippet, the variable does not appear to change. However, as in the previous example, it changes twice: it increases by one, then goes back to the original value.<br>Explain to learners that the score can be changed in more than one place, and that each change score by block can have a different value.<br>Display slide 9. Give learners the opportunity to experiment with different values in multiple change score by blocks. |
| Activity 3<br>(Slides 10–12)<br>10 mins | Variables in programs<br>Display slide 10. Explain to the learners that the value of a variable can be used by a program to perform other tasks. Build the slide to demonstrate the operator blocks. Explain that the operator blocks shown are just some of the ways they could use the value of variables.<br>Display slide 11 and show the learners the code snippet. Build the slide and ask the learners, “What do you think will happen when the score gets to 5?”. Learners should recognise that once the score equals five, the sprite’s costume will change. Explain that the program uses the variable to determine whether to change the sprite’s costume. Explain that the ‘score’ variable can be used within other blocks, by dragging the variable into another block:<br>Display slide 12. Direct learners back to the ‘Pong’ Scratch project and ask them to click the Paddle sprite. Ask learners to click the Operators category. Ask them to add the = operator block to the if then block in the code. The learners can choose what action will take place when the score reaches a set value. |
| Plenary<br>(Slide 13)<br>5 mins | Display the score<br>Display slide 13. Explain that often variables are not displayed throughout the running of a program. Instead, they are used by the program at certain points.<br>In their projects, ask learners to click on the Variables category and untick the variable score. The program will run in the same way as before, but the score will not be visible.<br>Ask learners when, in this (or any) game, it might be useful to know the score. There may be a variety of responses to this question, but in this case, explain that they are going to display the score at the end of the game. Model to the learners using the say block from the Looks category. |
| Next time<br>(Slides 13–14)<br>5 mins | This time, next time<br>Review the ‘Assessment’ and ‘Summary’ slides. |

Resources are updated regularly - the latest version is available at: the-cc.io/curriculum.

This resource is licensed by the Raspberry Pi Foundation under a Creative Commons Attribution-NonCommercial-ShareAlike 4.0 International license. To view a copy of this license, visit, see creativecommons.org/licenses/by-nc-sa/4.0/
