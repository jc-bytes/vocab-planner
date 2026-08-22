# Supplied design and block boundary

## Required sprites and variables

| Item | Start | Required behavior |
|---|---|---|
| Player | x 0, y -120 | A/left: change x by -20; B/right: change x by 20 |
| Star | x 0, y 80 | On contact: score +1, feedback, new approved position |
| Obstacle | x 120, y -120 | On contact: feedback, score 0, Player to start |
| `score` | 0 | Reset at green flag; change only on required contacts |

## Allowed block families

Events, motion, control (`forever`, `if`), sensing (`touching`), variables (`set`, `change`), looks or sound feedback, and micro:bit A/B events. Keyboard arrow events are the equal-access fallback. Clones, custom blocks, lists, cloud variables, advanced extensions, and extra levels are not required or scored.

## Structural example, not the answer

An unrelated Maze Door project could use: `when green flag → set key to 0`; `forever → if touching Key then change key by 1`; `if touching Door and key = 1 then say Open`. This illustrates event → loop → condition → variable → feedback without giving the Catch the Star block sequence.

## Teacher expected output

The final project opens at the supplied start state, responds to both required directions through A/B or the labeled keyboard fallback, awards exactly one point per demonstrated Star contact, resets after Obstacle contact, and passes the five fixed tests. Optional visual differences do not affect the score.
