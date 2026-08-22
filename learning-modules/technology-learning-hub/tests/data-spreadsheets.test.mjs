import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { MODULE, SECTIONS } from "../modules/data-spreadsheets/content.js";
import { buildEvidenceHtml, chartFacts, checkChartBuild, checkCleanRows, checkExactAnswers, checkFormula, checkInterpretation, CLEAN_ROWS, completedPracticeCount, createAttempt, formulaResult, practiceSummary, renderAttemptHtml, TABLE_ANSWERS } from "../modules/data-spreadsheets/practice.js";

test("data module has stable identity and section codes", async () => {
  const manifest = JSON.parse(await readFile(new URL("../modules/data-spreadsheets/module.json", import.meta.url), "utf8"));
  assert.equal(MODULE.id, "MOD-DATA-SPREADSHEETS-01");
  assert.equal(manifest.id, MODULE.id);
  assert.equal(manifest.version, MODULE.version);
  assert.equal(manifest.status, "prototype");
  assert.equal(SECTIONS.length, 13);
  assert.equal(new Set(SECTIONS.map((section) => section.code)).size, SECTIONS.length);
  assert.equal(SECTIONS.reduce((sum, section) => sum + section.minutes, 0), 195);
  assert.equal(SECTIONS.find((section) => section.id === "chart-basics")?.code, "CHART-BASICS-01");
  assert.equal(SECTIONS.find((section) => section.id === "chart-basics")?.practice, false);
});

test("table, cleaning, formula, and chart checks accept only the planned practice answers", () => {
  assert.equal(TABLE_ANSWERS.record, "A03, Science, 45");
  assert.equal(checkExactAnswers({ ...TABLE_ANSWERS, record: "Science, 45" }, TABLE_ANSWERS), false);
  assert.equal(checkExactAnswers(TABLE_ANSWERS, TABLE_ANSWERS), true);
  assert.equal(checkExactAnswers({ ...TABLE_ANSWERS, value: "Club" }, TABLE_ANSWERS), false);
  assert.deepEqual(CLEAN_ROWS, [{ studentId: "A01", club: "Art", minutes: "35" }, { studentId: "A02", club: "Math", minutes: "50" }, { studentId: "A03", club: "Science", minutes: "45" }, { studentId: "A04", club: "Music", minutes: "30" }]);
  assert.ok(Object.values(checkCleanRows(CLEAN_ROWS)).every(Boolean));
  assert.equal(checkCleanRows([...CLEAN_ROWS, CLEAN_ROWS[3]]).rowCount, false);
  assert.equal(checkCleanRows(CLEAN_ROWS.map((row, index) => index === 2 ? { ...row, minutes: "25" } : row)).minutes, false);
  const chartBuild = { headers: { category: "Club", value: "Minutes" }, rows: [{ category: "Art", value: "35" }, { category: "Math", value: "50" }, { category: "Science", value: "45" }, { category: "Music", value: "30" }], selection: "A1:B5", chartType: "column", title: "Minutes Spent in School Clubs", xLabel: "Club", yLabel: "Minutes" };
  assert.ok(Object.values(checkChartBuild(chartBuild)).every(Boolean));
  assert.equal(checkChartBuild({ ...chartBuild, chartType: "pie" }).chartType, false);
  assert.equal(checkChartBuild({ ...chartBuild, rows: chartBuild.rows.map((row, index) => index === 1 ? { ...row, value: "many" } : row) }).data, false);
  assert.equal(checkFormula("sum", " =sum(B2:B5) "), true);
  assert.equal(checkFormula("average", "=AVERAGE(B2:B5)"), true);
  assert.equal(checkFormula("sum", "=SUM(B2:B4)"), false);
  assert.equal(formulaResult("sum", "=SUM(B2:B5)"), 160);
  assert.equal(formulaResult("average", "=AVERAGE(B2:B5)"), 40);
  assert.equal(formulaResult("sum", "=SUM(B2:B4)"), null);
});

test("chart facts and interpretation match the practice dataset", () => {
  assert.deepEqual(chartFacts(), { total: 160, largest: "Math", difference: 20 });
  const result = checkInterpretation({ largest: "Math", difference: "20", total: "160", conclusion: "Math has the highest value at 50 minutes." });
  assert.ok(Object.values(result).every(Boolean));
  assert.equal(checkInterpretation({ largest: "Art", difference: "20", total: "160", conclusion: "Math has the highest value at 50 minutes." }).largest, false);
});

test("attempt history summarizes and reconstructs escaped student work", () => {
  const results = Object.fromEntries(["read-table", "clean-data", "formulas", "chart", "interpret"].map((id) => [id, { passed: true }]));
  const attempt = createAttempt({ sectionId: "interpret", sectionTitle: "Practice reading charts", datasetId: "clubs-formula-01", response: { largest: "Math", difference: "20", total: "160", conclusion: "<Math> has 50 minutes." }, passed: true, details: { largest: true, difference: true, total: true, conclusion: true } }, new Date("2026-08-19T15:00:00Z"));
  const state = { results, responses: {}, attempts: [attempt] };
  assert.equal(completedPracticeCount(state), 5);
  assert.deepEqual(practiceSummary(state.attempts), { attempts: 1, correct: 4, total: 4, topics: 1 });
  assert.match(renderAttemptHtml(attempt), /Practice reading charts/);
  const report = buildEvidenceHtml(state, { student: "<Student>", className: "6A" });
  assert.match(report, /&lt;Student&gt;/);
  assert.doesNotMatch(report, /<Student>/);
  assert.match(report, /This report records formative practice/);
  assert.match(report, /&lt;Math&gt; has 50 minutes/);
  assert.match(report, /Recreated practice/);
});

test("public module does not contain phone, camera, or formal-answer language", async () => {
  const files = ["index.html", "content.js", "main.js", "practice.js", "printable-fallback.html"];
  const text = (await Promise.all(files.map((file) => readFile(new URL(`../modules/data-spreadsheets/${file}`, import.meta.url), "utf8")))).join("\n");
  assert.doesNotMatch(text, /take (?:a )?(?:photo|picture)|phone camera/i);
  assert.doesNotMatch(text, /Summative Activity #[125].*answer/i);
  assert.match(text, /Practice only/i);
});
