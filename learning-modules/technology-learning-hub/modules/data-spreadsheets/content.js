export const MODULE = {
  id: "MOD-DATA-SPREADSHEETS-01",
  version: "0.5.0",
  title: "Data Foundations and Spreadsheets",
  track: "Grade 6 Foundation",
  storageKey: "MOD-DATA-SPREADSHEETS-01:v0.5.0:foundation",
};

export const SECTIONS = [
  { id: "start", code: "START-01", title: "Start here", short: "Start", minutes: 5 },
  { id: "read-table", code: "TABLE-LEARN-01", title: "Learn to read a data table", short: "Learn tables", minutes: 10, practice: false },
  { id: "table-practice", code: "TABLE-PRACTICE-01", title: "Practice reading tables", short: "Practice tables", minutes: 20 },
  { id: "clean-learn", code: "CLEAN-LEARN-01", title: "Learn to clean data", short: "Learn cleaning", minutes: 10, practice: false },
  { id: "clean-data", code: "CLEAN-PRACTICE-01", title: "Practice cleaning data", short: "Practice cleaning", minutes: 25 },
  { id: "formula-learn", code: "FORMULA-LEARN-01", title: "Learn SUM and AVERAGE", short: "Learn formulas", minutes: 10, practice: false },
  { id: "formulas", code: "FORMULA-PRACTICE-01", title: "Practice SUM and AVERAGE", short: "Practice formulas", minutes: 25 },
  { id: "chart-basics", code: "CHART-BASICS-01", title: "Understand charts", short: "Understand charts", minutes: 10, practice: false },
  { id: "chart-types", code: "CHART-TYPES-PRACTICE-01", title: "Practice choosing charts", short: "Choose charts", minutes: 15 },
  { id: "chart", code: "CHART-PRACTICE-01", title: "Practice building charts", short: "Build charts", minutes: 25 },
  { id: "interpret-learn", code: "INTERPRET-LEARN-01", title: "Learn to read a chart", short: "Learn chart reading", minutes: 10, practice: false },
  { id: "interpret", code: "INTERPRET-PRACTICE-01", title: "Practice reading charts", short: "Practice chart reading", minutes: 20 },
  { id: "review", code: "HISTORY-01", title: "Practice history and export", short: "Practice history", minutes: 10, practice: false },
];

export const CLUB_DATA = [
  { club: "Art", minutes: 35 },
  { club: "Math", minutes: 50 },
  { club: "Science", minutes: 45 },
  { club: "Music", minutes: 30 },
];

export const SECTION_GOALS = {
  "read-table": "Follow the labeled example while your teacher explains the parts of a table.",
  "table-practice": "Read a new table and save each practice attempt.",
  "clean-learn": "See how a source note helps you correct data without guessing.",
  "clean-data": "Correct a new table and save the editing steps.",
  "formula-learn": "See how SUM and AVERAGE use a cell range.",
  formulas: "Enter SUM and AVERAGE formulas in different spreadsheets.",
  "chart-basics": "Learn what charts show, identify their parts, and match a chart type to a question.",
  "chart-types": "Choose a chart type that matches the question.",
  chart: "Enter data, select a range, and build labeled charts.",
  "interpret-learn": "See how chart answers use visible numbers instead of guesses.",
  interpret: "Read different charts and save evidence-based answers.",
};
