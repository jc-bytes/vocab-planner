import fs from "node:fs/promises";
import path from "node:path";
import { FileBlob, SpreadsheetFile } from "@oai/artifact-tool";

const reference = "/Users/pjriosc/.codex/skills/artifact-template-google-classroom-rubric/assets/reference.xlsx";
const outputDir = "/Users/pjriosc/Documents/Technology 6A/outputs/google_classroom_rubric_sum5_20260819";
const outputPath = path.join(outputDir, "6th_Grade_Summative_5_mBot_Rescue_Robot_Google_Classroom_Rubric.xlsx");
const previewPath = path.join(outputDir, "work", "sum5_preview.png");

const criteria = [
  {
    title: "Line-Following Code",
    description: "Includes all 7 required features: repeating loop, line-sensor input, forward movement, left correction, right correction, lost-line response, and line following when the path ahead is open.",
    levels: [
      [6, "All requirements", "6 pts = Includes all 7 required features: repeating loop, line-sensor input, forward movement, left correction, right correction, lost-line response, and line following when the path ahead is open."],
      [5, "Most requirements", "5 pts = Includes 4-6 of the 7 required features."],
      [3, "Some requirements", "3 pts = Includes 1-3 of the 7 required features."],
    ],
  },
  {
    title: "Obstacle and Rescue-Zone Code",
    description: "Includes all 7 required features: front-distance condition, left check, left turn when open, right check when left is blocked, right turn when open, stop when all three directions are blocked, and an end condition that prevents restarting.",
    levels: [
      [6, "All requirements", "6 pts = Includes all 7 required features: front-distance condition, left check, left turn when open, right check when left is blocked, right turn when open, stop when all three directions are blocked, and an end condition that prevents restarting."],
      [5, "Most requirements", "5 pts = Includes 4-6 of the 7 required features."],
      [3, "Some requirements", "3 pts = Includes 1-3 of the 7 required features."],
    ],
  },
  {
    title: "Rescue Route Performance",
    description: "Completes all 7 required actions: follows the line, detects obstacles before contact, takes an open left branch, checks right when left is blocked, takes an open right branch, continues after each turn, and stops inside the rescue zone.",
    levels: [
      [6, "All requirements", "6 pts = Completes all 7 required actions: follows the line, detects obstacles before contact, takes an open left branch, checks right when left is blocked, takes an open right branch, continues after each turn, and stops inside the rescue zone."],
      [5, "Most requirements", "5 pts = Includes 4-5 of the 7 required features."],
      [3, "Some requirements", "3 pts = Includes 1-3 of the 7 required features."],
    ],
  },
  {
    title: "Use of the mBlock Platform",
    description: "Independently opens mBlock and the assigned project, makes the required code change, connects the robot, runs or uploads the code successfully, and saves the modified project.",
    levels: [
      [6, "All requirements", "6 pts = Independently opens mBlock and the assigned project, makes the required code change, connects the robot, runs or uploads the code successfully, and saves the modified project."],
      [5, "Most requirements", "5 pts = Includes 4-5 of the 6 required features."],
      [3, "Some requirements", "3 pts = Includes 1-3 of the 6 required features."],
    ],
  },
  {
    title: "English Explanation",
    description: "Uses English for all task-related communication without reminders. Verbally explains (1) what the sensor checks, (2) the condition, (3) the True response, and (4) the False response, while using at least 3 vocabulary words.",
    levels: [
      [6, "English throughout", "6 pts = Uses English for all task-related communication without reminders. Verbally explains what the sensor checks, the condition, and the True and False responses, using at least 3 vocabulary words."],
      [5, "One reminder", "5 pts = Uses another language or needs 1 reminder to return to English. Explains 3-4 required elements and uses at least 2 vocabulary words correctly."],
      [3, "Repeated reminders", "3 pts = Uses another language repeatedly or needs multiple reminders. Verbally explains 1-2 elements and uses at least 1 vocabulary word correctly."],
    ],
  },
  {
    title: "Device and Lab Care",
    description: "Independently verifies the assigned numbered kit, handles the mBot and cables without pulling or forcing, keeps the area organized, powers off and disconnects correctly, returns all parts neatly to the correct box, and leaves the area clean.",
    levels: [
      [6, "All requirements", "6 pts = Independently verifies the assigned numbered kit, handles the mBot and cables without pulling or forcing, keeps the area organized, powers off and disconnects correctly, returns all parts neatly to the correct box, and leaves the area clean."],
      [5, "Most requirements", "5 pts = Completes 4-5 of the 6 actions or needs 1 reminder. No equipment is handled unsafely."],
      [3, "Some requirements", "3 pts = Completes 2-3 actions or needs repeated reminders."],
    ],
  },
  {
    title: "Punctuality, Readiness & Respect",
    description: "Completes all 4 required actions: submits the files to Google Classroom on time, arrives prepared to work, shares the computer and mBot appropriately and communicates respectfully with the partner, and has the required resources, including email access, password, pen, and notebook.",
    levels: [
      [4, "All requirements", "4 pts = Completes all 4 required actions: submits the files to Google Classroom on time, arrives prepared to work, shares the computer and mBot appropriately and communicates respectfully with the partner, and has the required resources, including email access, password, pen, and notebook."],
      [3, "Two requirements", "3 pts = Completes 2 of the 4 required actions."],
      [1, "One requirement", "1 pt = Completes 1 of the 4 required actions."],
    ],
  },
];

const total = criteria.reduce((sum, criterion) => sum + criterion.levels[0][0], 0);
if (total !== 40) throw new Error(`Expected 40 points, found ${total}`);

await fs.mkdir(path.dirname(previewPath), { recursive: true });
const workbook = await SpreadsheetFile.importXlsx(await FileBlob.load(reference));
const sheet = workbook.worksheets.getItem("Template");
sheet.getRange("A3:N37").clear({ applyTo: "contents" });

criteria.forEach((criterion, index) => {
  const row = 3 + index * 5;
  sheet.getRange(`A${row}`).values = [[criterion.title]];
  sheet.getRange(`A${row + 1}`).values = [[criterion.description]];
  sheet.getRange(`B${row + 2}:D${row + 2}`).values = [[...criterion.levels.map((level) => level[0])]];
  sheet.getRange(`B${row + 3}:D${row + 3}`).values = [[...criterion.levels.map((level) => level[1])]];
  sheet.getRange(`B${row + 4}:D${row + 4}`).values = [[...criterion.levels.map((level) => level[2])]];
  sheet.getRange(`A${row + 4}:E${row + 4}`).format.rowHeight = 86;
});

const preview = await workbook.render({ sheetName: "Template", range: "A1:N37", scale: 1.1, format: "png" });
await fs.writeFile(previewPath, new Uint8Array(await preview.arrayBuffer()));
const output = await SpreadsheetFile.exportXlsx(workbook);
await output.save(outputPath);
console.log(JSON.stringify({ outputPath, previewPath, criteria: criteria.length, total }));
