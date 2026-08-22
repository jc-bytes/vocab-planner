# Daily Grade 2 fixed spreadsheet build sheet

Open or import `Daily Grade 2 - Fixed Dataset.csv`. Do not replace or add records.

## Required cells and formulas

The imported table must place `Club` in A1 and `Students` in B1, with the eight clubs in rows 2–9.

| Cell | Label in column D | Formula/result in column E |
|---|---|---|
| E2 | Total | `=SUM(B2:B9)` |
| E3 | Average | `=AVERAGE(B2:B9)` |
| E4 | Highest | `=MAX(B2:B9)` |

Create one **column chart** from A1:B9. Title it `Students in School Clubs`. Use `Club` as the horizontal-axis label and `Students` as the vertical-axis label.

Under the table, answer these exact questions in complete sentences:

1. Which club has the highest number of students? State the club and exact value.
2. Compare Music and Robotics. State both values and the numerical difference.

These are the only functions and chart type assessed. They are taught in the Spreadsheet Analysis module at `#formula-learn`, `#formula-practice`, `#chart-learn`, and `#chart-practice`.

