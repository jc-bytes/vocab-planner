# Exam milestone: fixed Mandrake design template

## Fixed system specification

The system represents a Mandrake resting close to an ultrasonic sensor. The fixed rule is:

`IF distance > 18 cm, send ALERT by Bluetooth and play the warning sound; ELSE do not alert.`

At exactly 18 cm, the condition is false and there is no alert. This is the same boundary rule practiced in the Sensor Systems module.

Assigned parts: micro:bit or controller, ultrasonic sensor, Bluetooth message, computer or second micro:bit receiver or simulator, sound output, power or data cable, stable nonliving model, and labeled safe base.

## Complete the plan

User need: _______________________________________________________________

Testable goal: ___________________________________________________________

| System stage | Required part | Its job |
|---|---|---|
| Input | Ultrasonic sensor or distance reading | |
| Process | Comparison with 18 cm | |
| Signal | Bluetooth `ALERT` message | |
| Output | Warning sound | |

Draw or type this flow in the correct order: start; read distance; compare with 18; true branch; false branch; repeat reading.

| Required test | Distance | Expected Bluetooth result | Expected sound result | Safe or setup condition |
|---|---:|---|---|---|
| Below | 17 cm | | | |
| At | 18 cm | | | |
| Above | 19 cm | | | |

Filename: `Lastname_Firstname_7A-or-7B_Exam_MandrakePlan`
