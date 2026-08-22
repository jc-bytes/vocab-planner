# Exam project: Catch the Star

Scheduled: 8A and 8B Thursday, December 3  
Score: 90 points  
Practice before grading: `MOD-APP-DESIGN-01` `DECOMPOSE-LEARN-01`; `MOD-SENSOR-SYSTEMS-01` `SYSTEM-LEARN-01`, `TESTING-LEARN-01`; teacher-modeled Scratch events, movement, loop, condition, variable, and feedback blocks.

## Fixed project

Build **Catch the Star** in Scratch. The Player sprite starts at `x: 0, y: -120`. A Star sprite starts at `x: 0, y: 80`. An Obstacle starts at `x: 120, y: -120`. The variable `score` starts at `0`.

- micro:bit button A moves Player left 20 steps; button B moves Player right 20 steps.
- Keyboard fallback: left and right arrow keys perform the same actions.
- A forever loop checks contact.
- Touching Star adds 1 to `score`, plays or shows feedback, and moves Star to a new teacher-approved position.
- Touching Obstacle shows `Try again`, sets `score` to 0, and returns Player to its start.
- Green flag resets score and all three sprites.

Use only the supplied design, block boundary, test sheet, and class/module practice. Art, costumes, sound, and decoration are optional and not scored.

## Fixed tests

1. Green flag → score 0; sprites at supplied starts.
2. Button A or left arrow once → Player x decreases by 20.
3. Button B or right arrow once → Player x increases by 20.
4. Player touches Star → score increases by 1 and Star moves.
5. Player touches Obstacle → `Try again`, score 0, Player returns to start.

## Submit

Submit `8_Class_LastName_Exam_CatchTheStar.sb3`, the completed build/test log, peer-feedback sheet, and reflection. Give a 90–120 second live demonstration. A local `.sb3` file is accepted when Classroom or login is unavailable.

## Allowed resources and fallback

Use this package, assigned module sections, teacher demonstrations, Scratch help, and teacher feedback. A physical micro:bit is not required for full credit: use the supplied keyboard mapping or simulator and explain the A/B mapping. If a school device, platform, teacher-provided account, or hardware failure outside your control occurs, complete the supplied paper block plan and five traces, then demonstrate the same behavior later without losing readiness points. A forgotten personal device or unprepared login may reduce only the 9-point readiness criterion.

<!-- RESPONSIBILITY-POLICY-START -->
## Responsibility points: 9 of 90

At every announced project checkpoint, bring your assigned charged computer, required materials, and school login; begin on time; keep files and materials organized; meet the announced milestones; and submit the final evidence by the deadline. If you forget the computer or login, arrive late or unprepared, or miss responsibility checkpoints, points may be deducted only from these 9 points. Academic project criteria are scored from the project evidence itself.

A documented school network, platform, teacher-provided account, or hardware failure outside your control does not reduce these points when you follow the assigned fallback.
<!-- RESPONSIBILITY-POLICY-END -->
