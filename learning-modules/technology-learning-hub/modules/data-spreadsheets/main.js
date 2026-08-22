import "./styles.css";
import { CLUB_DATA, MODULE, SECTION_GOALS, SECTIONS } from "./content.js";
import { CHART_TYPE_DATASETS, CLEAN_DATASETS, FORMULA_DATASETS, INTERPRET_DATASETS, TABLE_DATASETS } from "./datasets.js";
import { buildEvidenceHtml, checkChartBuild, checkCleanRows, checkExactAnswers, checkFormula, checkInterpretation, createAttempt, formulaResult, practiceSummary, renderAttemptHtml, TABLE_ANSWERS } from "./practice.js";

const defaultState = { results: {}, responses: {}, attempts: [], visited: ["start"] };
const CLEAN_START_ROWS = [
  { key: "row-1", studentId: "A01", club: "Art", minutes: "35" },
  { key: "row-2", studentId: "A02", club: "math", minutes: "50" },
  { key: "row-3", studentId: "A03", club: "Science", minutes: "" },
  { key: "row-4", studentId: "A04", club: "Music", minutes: "thirty" },
  { key: "row-5", studentId: "A04", club: "Music", minutes: "thirty" },
];
let state = loadState();
let activeId = getRoute();

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(MODULE.storageKey) || "null");
    return { ...structuredClone(defaultState), ...saved, results: { ...(saved?.results || {}) }, responses: { ...(saved?.responses || {}) }, attempts: Array.isArray(saved?.attempts) ? saved.attempts : [], visited: Array.isArray(saved?.visited) ? saved.visited : ["start"] };
  } catch {
    return structuredClone(defaultState);
  }
}

function saveState() { localStorage.setItem(MODULE.storageKey, JSON.stringify(state)); }

function getRoute() {
  const route = location.hash.replace(/^#/, "");
  return SECTIONS.some((section) => section.id === route) ? route : "start";
}

function markVisited(id) {
  if (!state.visited.includes(id)) state.visited.push(id);
  saveState();
}

function sectionStatus(id) {
  if (state.attempts.some((attempt) => attempt.sectionId === id)) return "complete";
  if (state.visited.includes(id)) return "started";
  return "not-started";
}

function navMarkup() {
  return SECTIONS.map((section) => {
    const status = sectionStatus(section.id);
    return `<a class="nav-link ${section.id === activeId ? "is-active" : ""}" href="#${section.id}" ${section.id === activeId ? 'aria-current="page"' : ""}><span class="nav-state is-${status}" aria-hidden="true">${status === "complete" ? "✓" : ""}</span><span>${section.short}</span><small>${section.minutes} min</small></a>`;
  }).join("");
}

function shellMarkup() {
  const summary = practiceSummary(state.attempts);
  return `<div class="app-shell">
    <header class="site-header">
      <a class="brand" href="#start"><span class="brand-mark">D6</span><span><small>Technology</small><strong>Data lab</strong></span></a>
      <div class="header-actions">
        <div class="header-progress" aria-label="Practice history"><span>${summary.attempts} ${summary.attempts === 1 ? "attempt" : "attempts"} saved</span><small>${summary.topics} ${summary.topics === 1 ? "topic" : "topics"} practiced</small></div>
        <details class="lesson-menu"><summary>Lessons</summary><nav id="section-nav" aria-label="Module sections">${navMarkup()}</nav></details>
      </div>
    </header>
    <main id="lesson" tabindex="-1"></main>
    <footer class="site-footer"><details><summary>About this practice</summary><div><p><strong>Practice only.</strong> Your teacher gives graded work separately.</p><p>Progress stays on this browser. Download your report before another student resets the computer.</p><p>${MODULE.id} · v${MODULE.version}</p><a href="./printable-fallback.html" target="_blank">Open the printable version</a><button id="reset-progress" class="text-button">Reset this computer</button></div></details></footer>
  </div><div id="toast" class="toast" role="status" aria-live="polite"></div>
  <dialog id="report-dialog"><form method="dialog" id="report-form"><div class="dialog-heading"><div><small>Practice report</small><h2>Save your work</h2></div><button value="cancel" class="icon-button" aria-label="Close">×</button></div><p>Your name and class go into the downloaded file. This page does not save them.</p><label>Student name<input name="student" maxlength="70" required autocomplete="off"></label><label>Class<select name="className" required><option value="">Choose your class</option><option>6A</option><option>6B</option><option>6C</option></select></label><button class="button primary" value="default">Download report</button></form></dialog>`;
}

function lessonPosition(section) {
  const practiceSections = SECTIONS.slice(1, -1);
  const index = practiceSections.findIndex((item) => item.id === section.id);
  if (index >= 0) return `Lesson ${index + 1} of ${practiceSections.length}`;
  return section.id === "start" ? "Start here" : "Finish";
}

function hero(section, summary) {
  return `<header class="lesson-hero"><p class="lesson-position">${lessonPosition(section)} <span>·</span> ${section.minutes} min</p><h1>${section.title}</h1><p class="summary">${summary}</p></header>`;
}

function block(label, title, content, className = "") {
  return `<section class="lesson-block ${className}"><p class="block-label">${label}</p><h2>${title}</h2>${content}</section>`;
}

function schoolTable({ annotated = false } = {}) {
  const rows = [["A01", "Art", "35"], ["A02", "Math", "50"], ["A03", "Science", "45"], ["A04", "Music", "30"]];
  return `<div class="table-scroll"><table class="data-table ${annotated ? "annotated-table" : ""}"><caption>Minutes Spent in School Clubs${annotated ? '<span class="part-tag">table title</span>' : ""}</caption><thead><tr><th>Student ID</th><th>Club${annotated ? '<span class="part-tag">column name</span>' : ""}</th><th>Minutes</th></tr></thead><tbody>${rows.map((row, rowIndex) => `<tr class="${annotated && rowIndex === 2 ? "marked-row" : ""}">${row.map((cell, cellIndex) => `<td class="${annotated && rowIndex === 1 && cellIndex === 2 ? "marked-cell" : ""}">${cell || '<span class="blank-cell">blank</span>'}${annotated && rowIndex === 2 && cellIndex === 0 ? '<span class="part-tag">one row</span>' : ""}${annotated && rowIndex === 1 && cellIndex === 2 ? '<span class="part-tag">one cell</span>' : ""}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;
}

function selectField(name, label, options, saved = "") {
  return `<label class="answer-field"><span>${label}</span><select name="${name}" required><option value="">Choose an answer</option>${options.map((option) => `<option ${saved === option ? "selected" : ""}>${option}</option>`).join("")}</select></label>`;
}

function stepForm(id, fields, buttonText, complete = false) {
  return `<form id="${id}" class="practice-form step-form" data-complete="${complete}"><p class="practice-kicker">Try it</p><div class="step-meter" aria-live="polite"></div>${fields}<div class="step-actions"><button class="button quiet" type="button" data-step-back>Back</button><button class="button primary" type="button" data-step-next>Continue</button><button class="button primary" type="submit">${buttonText}</button></div></form>`;
}

const PRACTICE_SET_SIZE = 5;

function passedAttemptCount(sectionId) {
  return state.attempts.filter((attempt) => attempt.sectionId === sectionId && attempt.passed).length;
}

function practiceSetState(sectionId) {
  const passed = passedAttemptCount(sectionId);
  const showingSavedSuccess = Boolean(state.results[sectionId]?.passed);
  const displayedIndex = showingSavedSuccess ? Math.max(0, passed - 1) : passed;
  return {
    position: (displayedIndex % PRACTICE_SET_SIZE) + 1,
    setNumber: Math.floor(displayedIndex / PRACTICE_SET_SIZE) + 1,
    completedSet: showingSavedSuccess && passed % PRACTICE_SET_SIZE === 0,
  };
}

function practiceSetBanner(sectionId, noun) {
  const progress = practiceSetState(sectionId);
  const markers = Array.from({ length: PRACTICE_SET_SIZE }, (_, index) => {
    const marker = index + 1;
    const className = marker < progress.position ? "is-done" : marker === progress.position ? "is-current" : "";
    return `<li class="${className}"><span>${marker}</span></li>`;
  }).join("");
  return `<section class="practice-set" aria-label="Practice set ${progress.setNumber}, ${noun} ${progress.position} of ${PRACTICE_SET_SIZE}"><div><span>Practice set ${progress.setNumber}</span><strong>${noun} ${progress.position} of ${PRACTICE_SET_SIZE}</strong><small>Do as many as your teacher assigns. Each saved attempt stays in your report.</small></div><ol>${markers}</ol></section>`;
}

function nextPracticeLabel(sectionId, noun) {
  return practiceSetState(sectionId).completedSet ? "Start another set" : `Next ${noun}`;
}

function feedback(id, success, message, nextLabel = "Next activity") {
  if (success === undefined) return `<div id="${id}-feedback" class="feedback" aria-live="polite"></div>`;
  return `<div id="${id}-feedback" class="feedback is-visible ${success ? "success" : "try-again"}" aria-live="polite"><strong>${success ? "Practice saved." : "Attempt saved."}</strong> ${message}${success ? `<button class="button quiet practice-again" type="button">${nextLabel}</button>` : ""}</div>`;
}

function datasetFor(sectionId, datasets) {
  const savedId = state.responses[sectionId]?._datasetId;
  if (savedId) return datasets.find((dataset) => dataset.id === savedId) || datasets[0];
  return datasets[passedAttemptCount(sectionId) % datasets.length];
}

function rowsFromDataset(dataset) {
  return dataset.initial.map((row, index) => ({ key: `${dataset.id}-${index + 1}`, studentId: row[0], club: row[1], minutes: row[2] }));
}

function checkDatasetRows(rows, expected) {
  return {
    rowCount: rows.length === expected.length,
    studentIds: rows.length === expected.length && rows.every((row, index) => String(row.studentId).trim() === expected[index][0]),
    clubs: rows.length === expected.length && rows.every((row, index) => String(row.club).trim() === expected[index][1]),
    minutes: rows.length === expected.length && rows.every((row, index) => String(row.minutes).trim() === String(expected[index][2])),
  };
}

function datasetTable(dataset) {
  return `<div class="table-scroll"><table class="data-table"><caption>${escapeHtml(dataset.title)}</caption><thead><tr>${dataset.headers.map((header) => `<th>${escapeHtml(header)}</th>`).join("")}</tr></thead><tbody>${dataset.rows.map((row) => `<tr>${row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;
}

function renderStart(section) {
  return `${hero(section, "Learn with your teacher, then practice with as many datasets as your class needs.")}<div class="start-callout"><strong>This is a practice library.</strong><span>Open the section your teacher assigns. Every submitted attempt stays in Practice history on this computer.</span></div><ol class="route-map">${SECTIONS.slice(1, -1).map((item, index) => `<li><span>${index + 1}</span><div><strong>${item.short}</strong><small>${item.practice === false ? "Learn or review" : "Repeatable practice"} · ${item.minutes} minutes</small></div></li>`).join("")}</ol><div class="start-actions"><a class="button primary large" href="#read-table">Start with tables</a><a class="plain-link" href="./printable-fallback.html" target="_blank">Use the printed version</a></div>`;
}

function renderReadTable(section) {
  return `${hero(section, SECTION_GOALS[section.id])}<div class="lesson-flow">${block("Learn", "A table has a title, column names, rows, and cells", `<p class="lead">Follow the labels while your teacher explains what each part tells you.</p>${schoolTable({ annotated: true })}<p class="plain-tip">The Student ID belongs in the complete row. It identifies which record you are reading.</p>`)}</div>${pager(section)}`;
}

function renderTablePractice(section) {
  const dataset = datasetFor(section.id, TABLE_DATASETS);
  const saved = state.responses[section.id] || { _datasetId: dataset.id };
  const result = state.results[section.id];
  const q = dataset.questions;
  const fields = `<input type="hidden" name="_datasetId" value="${dataset.id}">${selectField("title", "What is the table title?", [dataset.headers[1], dataset.title, dataset.headers[0]], saved.title)}${selectField("headers", "Which pair contains two column names?", [dataset.rows[0][1] + " and " + dataset.rows[1][1], q.headers, dataset.rows[2][1] + " and " + dataset.rows[2][2]], saved.headers)}${selectField("record", `Which answer shows the complete ${dataset.rows[2][0]} row?`, [dataset.headers[2], q.record, dataset.rows.map((row) => row[1]).join(", ")], saved.record)}${selectField("value", `Which value appears in the ${dataset.headers[2]} column?`, [dataset.headers[1], q.value, `${dataset.rows[1][0]} and ${dataset.rows[1][1]}`], saved.value)}`;
  return `${hero(section, SECTION_GOALS[section.id])}${practiceSetBanner(section.id, "Table")}<div class="practice-context"><span>Dataset ${dataset.id}</span><strong>${dataset.title}</strong></div><div class="lesson-flow">${block("Read", "Use the table to answer", `${datasetTable(dataset)}${stepForm("table-practice-form", fields, "Save this attempt", result?.passed)}${feedback("table-practice", result?.passed, "The report now contains your answers and this dataset.", nextPracticeLabel(section.id, "table"))}`)}</div>${pager(section)}`;
}

function renderCleanLearn(section) {
  return `${hero(section, SECTION_GOALS[section.id])}<div class="lesson-flow">${block("Learn", "Use a source before changing data", `<aside class="source-note"><p>Source note</p><p>A02 joined Math. A03 spent 45 minutes in Science.</p></aside><div class="worked-change"><p><del>math</del><strong>Math</strong><span>Write categories the same way.</span></p><p><del>blank</del><strong>45</strong><span>Use the source. Never guess a missing value.</span></p></div><p class="plain-tip">Keep information that already matches the source. Delete a row only when it is an exact repeat.</p>`)}</div>${pager(section)}`;
}

function renderCleanData(section) {
  const dataset = datasetFor(section.id, CLEAN_DATASETS);
  const saved = state.responses[section.id] || {};
  const result = state.results[section.id];
  const complete = Boolean(result?.passed);
  const rows = Array.isArray(saved.rows) && saved.rows.length ? saved.rows : rowsFromDataset(dataset);
  const hints = result && !complete ? `<div class="clean-hints" aria-live="polite"><strong>Check these parts:</strong>${result.details?.rowCount ? "" : "<p>The final table should have four rows.</p>"}${result.details?.studentIds ? "" : "<p>Check the Student ID column against the source note.</p>"}${result.details?.clubs ? "" : "<p>Check the Club column against the source note.</p>"}${result.details?.minutes ? "" : "<p>Check the Minutes column against the source note.</p>"}</div>` : "";
  const editor = `<aside class="source-note" aria-labelledby="source-note-title"><p id="source-note-title">Source note</p><p>${escapeHtml(dataset.sourceNote)}</p></aside>
    <form id="clean-form" class="clean-editor">
      <input type="hidden" name="_datasetId" value="${dataset.id}">
      <p class="editor-instruction">Use the note to correct the table. You may edit any cell or delete a row.</p>
      <div class="edit-toolbar" aria-label="Table editing history"><button id="undo-clean" class="history-button" type="button" disabled>← Undo</button><button id="redo-clean" class="history-button" type="button" disabled>Redo →</button><span id="edit-status" role="status">No changes yet.</span></div>
      <div class="table-scroll"><table class="data-table editable-table"><caption>${escapeHtml(dataset.title)}</caption><thead><tr><th class="delete-heading">Delete</th>${dataset.headers.map((header) => `<th>${escapeHtml(header)}</th>`).join("")}</tr></thead><tbody id="clean-table-body">${cleanRowsMarkup(rows, complete, result?.details)}</tbody></table></div>
      ${hints}
      <div class="clean-actions"><button class="button primary large" type="submit" ${complete ? "disabled" : ""}>${complete ? "Table cleaned" : "Check my table"}</button></div>
    </form>
    ${feedback("clean", result?.passed, complete ? "Your table now matches the source note." : "Use the source note and the hints to finish the table.", nextPracticeLabel(section.id, "table"))}`;
  return `${hero(section, SECTION_GOALS[section.id])}${practiceSetBanner(section.id, "Table")}<div class="practice-context"><span>Dataset ${dataset.id}</span><strong>${dataset.title}</strong></div><div class="lesson-flow">${block("Fix", "Use the source note to clean the table", editor)}</div>${pager(section)}`;
}

function cleanRowsMarkup(rows, complete = false, details = {}) {
  const columnClass = (name) => details?.[name] === false && !complete ? " is-wrong" : "";
  return rows.map((row, index) => `<tr data-row-key="${escapeAttribute(row.key || `row-${index + 1}`)}">
    <td class="delete-cell"><button class="delete-row" type="button" aria-label="Delete row ${index + 1}" title="Delete row" ${complete ? "disabled" : ""}>×</button></td>
    <td class="editable-cell${columnClass("studentIds")}"><input data-field="studentId" value="${escapeAttribute(row.studentId || "")}" aria-label="Student ID in row ${index + 1}" maxlength="8" required ${complete ? "readonly" : ""}></td>
    <td class="editable-cell${columnClass("clubs")}"><input data-field="club" value="${escapeAttribute(row.club || "")}" aria-label="Club in row ${index + 1}" maxlength="24" required ${complete ? "readonly" : ""}></td>
    <td class="editable-cell${columnClass("minutes")}"><input data-field="minutes" value="${escapeAttribute(row.minutes || "")}" aria-label="Minutes in row ${index + 1}" inputmode="numeric" maxlength="3" required ${complete ? "readonly" : ""}></td>
  </tr>`).join("");
}

function readCleanRows(form) {
  return [...form.querySelectorAll("#clean-table-body tr")].map((row) => ({
    key: row.dataset.rowKey,
    studentId: row.querySelector('[data-field="studentId"]').value,
    club: row.querySelector('[data-field="club"]').value,
    minutes: row.querySelector('[data-field="minutes"]').value,
  }));
}

function renderFormulaLearn(section) {
  return `${hero(section, SECTION_GOALS[section.id])}<div class="lesson-flow">${block("Learn", "A formula tells the spreadsheet what to calculate", `<div class="formula-example"><p><strong>=SUM(B2:B5)</strong><span>Adds every number from B2 through B5.</span></p><p><strong>=AVERAGE(B2:B5)</strong><span>Finds the average of those four numbers.</span></p></div><p class="plain-tip">Every formula starts with <strong>=</strong>. The colon in <strong>B2:B5</strong> means every cell from B2 through B5.</p>`)}</div>${pager(section)}`;
}

function renderFormulas(section) {
  const dataset = datasetFor(section.id, FORMULA_DATASETS);
  const saved = state.responses[section.id] || {};
  const result = state.results[section.id];
  const complete = Boolean(result?.passed);
  const sumValue = saved.sum || "";
  const averageValue = saved.average || "";
  const total = dataset.rows.reduce((sum, row) => sum + row[1], 0);
  const average = total / dataset.rows.length;
  const sumResult = checkFormula("sum", sumValue) ? total : null;
  const averageResult = checkFormula("average", averageValue) ? average : null;
  const formulaSheet = `<form id="formula-form" class="formula-workspace" data-total="${total}" data-average="${average}"><input type="hidden" name="_datasetId" value="${dataset.id}"><p class="editor-instruction">Type each formula into the empty B cell. The result appears when the formula works.</p><div class="table-scroll"><table class="formula-sheet"><caption>${escapeHtml(dataset.title)}</caption><thead><tr><th aria-label="Row numbers"></th><th>A</th><th>B</th></tr></thead><tbody><tr><th>1</th><td><strong>${escapeHtml(dataset.category)}</strong></td><td><strong>${escapeHtml(dataset.value)}</strong></td></tr>${dataset.rows.map((item, index) => `<tr><th>${index + 2}</th><td>${escapeHtml(item[0])}</td><td>${item[1]}</td></tr>`).join("")}<tr class="formula-row"><th>6</th><td><strong>Total</strong></td><td><label><span class="formula-cell-label">Formula for B6</span><input class="${sumResult === null ? "" : "is-calculating"}" name="sum" value="${escapeAttribute(sumValue)}" placeholder="=SUM(...)" required autocapitalize="characters" autocomplete="off" ${complete ? "readonly" : ""}><output data-formula-result="sum" aria-live="polite">${sumResult === null ? "" : `Result: ${sumResult}`}</output></label></td></tr><tr class="formula-row"><th>7</th><td><strong>Average</strong></td><td><label><span class="formula-cell-label">Formula for B7</span><input class="${averageResult === null ? "" : "is-calculating"}" name="average" value="${escapeAttribute(averageValue)}" placeholder="=AVERAGE(...)" required autocapitalize="characters" autocomplete="off" ${complete ? "readonly" : ""}><output data-formula-result="average" aria-live="polite">${averageResult === null ? "" : `Result: ${averageResult}`}</output></label></td></tr></tbody></table></div><p class="plain-tip">Both formulas use the range <strong>B2:B5</strong>.</p><div class="formula-actions"><button class="button primary large" type="submit" ${complete ? "disabled" : ""}>${complete ? "Attempt saved" : "Save this attempt"}</button></div></form>${feedback("formula", result?.passed, complete ? `B6 calculates ${total} and B7 calculates ${average}.` : "Check the equals sign, function name, and range B2:B5.", nextPracticeLabel(section.id, "spreadsheet"))}`;
  return `${hero(section, SECTION_GOALS[section.id])}${practiceSetBanner(section.id, "Spreadsheet")}<div class="practice-context"><span>Dataset ${dataset.id}</span><strong>${dataset.title}</strong></div><div class="lesson-flow">${block("Practice", "Make the spreadsheet calculate", formulaSheet)}</div>${pager(section)}`;
}

function renderBars(dataset = FORMULA_DATASETS[0]) {
  const max = Math.max(...dataset.rows.map((item) => item[1]));
  return `<div class="chart-preview" role="img" aria-label="Column chart for ${escapeAttribute(dataset.title)}"><p class="chart-title">${escapeHtml(dataset.title)}</p><div class="chart-area"><span class="y-label">${escapeHtml(dataset.value)}</span><div class="bars">${dataset.rows.map((item) => `<div class="bar-group"><span class="bar-value">${item[1]}</span><div class="bar" style="height:${Math.round((item[1] / max) * 170)}px"></div><span>${escapeHtml(item[0])}</span></div>`).join("")}</div></div><p class="x-label">${escapeHtml(dataset.category)}</p></div>`;
}

function renderChartBasics(section) {
  const primer = `<div class="chart-primer"><p class="chart-definition"><strong>A chart turns table data into a picture.</strong> It helps you compare values and notice patterns faster than reading every cell.</p><div class="chart-primer-grid"><figure class="chart-anatomy" aria-labelledby="chart-anatomy-caption"><figcaption id="chart-anatomy-caption">The parts of a column chart</figcaption><div class="anatomy-title">Minutes Spent in School Clubs <span>title</span></div><div class="anatomy-plot"><span class="anatomy-side">Minutes <b>side label</b></span><div class="anatomy-columns"><div><strong>35</strong><i style="height:140px"></i><span>Art</span></div><div><strong>50</strong><i style="height:200px"></i><span>Math</span></div><div><strong>45</strong><i style="height:180px"></i><span>Science</span></div><div><strong>30</strong><i style="height:120px"></i><span>Music</span></div></div></div><div class="anatomy-bottom">Club <span>bottom label</span></div></figure><div class="chart-type-guide"><h3>Match the chart to the question</h3><dl><div><dt>Column</dt><dd>Compare categories, such as minutes for each club.</dd></div><div><dt>Bar</dt><dd>Compare categories when the names are long.</dd></div><div><dt>Line</dt><dd>Show how a value changes over time.</dd></div><div><dt>Pie</dt><dd>Show how a whole is divided into parts.</dd></div></dl><p><strong>Our question:</strong> How do the clubs compare? A column chart fits.</p></div></div></div>`;
  return `${hero(section, SECTION_GOALS[section.id])}<div class="lesson-flow">${block("Learn", "What is a chart?", primer)}${block("Next", "Practice choosing a chart", `<p class="lead">In the next lesson, match chart types to different questions before you build your own chart.</p><a class="button primary large" href="#chart-types">Open chart-type practice</a>`)}</div>${pager(section)}`;
}

function renderChartTypes(section) {
  const dataset = datasetFor(section.id, CHART_TYPE_DATASETS);
  const saved = state.responses[section.id] || {};
  const result = state.results[section.id];
  const choices = [["column", "Column"], ["bar", "Bar"], ["line", "Line"], ["pie", "Pie"]].map(([value, label]) => `<label><input type="radio" name="chartType" value="${value}" ${saved.chartType === value ? "checked" : ""} required><span>${label}</span></label>`).join("");
  return `${hero(section, SECTION_GOALS[section.id])}${practiceSetBanner(section.id, "Question")}<div class="practice-context"><span>Situation ${dataset.id}</span><strong>${escapeHtml(dataset.question)}</strong></div><div class="lesson-flow">${block("Choose", "Which chart matches the question?", `<form id="chart-type-form" class="chart-choice-practice"><input type="hidden" name="_datasetId" value="${dataset.id}"><fieldset class="chart-type-picker"><legend>${escapeHtml(dataset.question)}</legend>${choices}</fieldset><button class="button primary large" type="submit" ${result?.passed ? "disabled" : ""}>${result?.passed ? "Attempt saved" : "Save this attempt"}</button></form>${feedback("chart-type", result?.passed, result?.passed ? "The selected chart matches the question." : "Read what each chart type is designed to show.", nextPracticeLabel(section.id, "question"))}`)}</div>${pager(section)}`;
}

function renderChart(section) {
  const dataset = datasetFor(section.id, FORMULA_DATASETS);
  const saved = state.responses[section.id] || {};
  const result = state.results[section.id];
  const studio = {
    headers: { category: saved.headers?.category ?? dataset.category, value: saved.headers?.value ?? dataset.value },
    rows: Array.isArray(saved.rows) ? saved.rows : Array.from({ length: 4 }, () => ({ category: "", value: "" })),
    selection: saved.selection || "",
    chartType: saved.chartType || "",
    title: saved.title || "",
    xLabel: saved.xLabel || "",
    yLabel: saved.yLabel || "",
  };
  const complete = Boolean(result?.passed);
  const hints = result && !complete ? `<div class="clean-hints"><strong>Check these parts:</strong>${result.details?.data ? "" : "<p>Every category and value cell needs valid data.</p>"}${result.details?.selection ? "" : "<p>Select the full range A1:B5.</p>"}${result.details?.chartType ? "" : "<p>Use a column chart for this lesson.</p>"}${result.details?.title ? "" : "<p>Add a clear chart title.</p>"}${result.details?.xLabel ? "" : "<p>Add the bottom label.</p>"}${result.details?.yLabel ? "" : "<p>Add the side label.</p>"}</div>` : "";
  const gridRows = `<tr><th>1</th><td data-cell="A1"><input data-chart-header="category" value="${escapeAttribute(studio.headers.category)}" aria-label="Cell A1" required></td><td data-cell="B1"><input data-chart-header="value" value="${escapeAttribute(studio.headers.value)}" aria-label="Cell B1" required></td></tr>${studio.rows.map((row, index) => `<tr><th>${index + 2}</th><td data-cell="A${index + 2}"><input data-chart-category value="${escapeAttribute(row.category)}" aria-label="Cell A${index + 2}" required></td><td data-cell="B${index + 2}"><input data-chart-value value="${escapeAttribute(row.value)}" aria-label="Cell B${index + 2}" inputmode="numeric" required></td></tr>`).join("")}`;
  const typeChoices = [["column", "Column"], ["bar", "Bar"], ["line", "Line"], ["pie", "Pie"]].map(([value, label]) => `<label><input type="radio" name="chartType" value="${value}" ${studio.chartType === value ? "checked" : ""}><span>${label}</span></label>`).join("");
  const sourceRows = dataset.rows.map((row) => `<tr><td>${escapeHtml(row[0])}</td><td>${row[1]}</td></tr>`).join("");
  const source = `<aside class="chart-source"><p>Data to enter</p><table><thead><tr><th>${escapeHtml(dataset.category)}</th><th>${escapeHtml(dataset.value)}</th></tr></thead><tbody>${sourceRows}</tbody></table></aside>`;
  const builder = `${source}<form id="chart-form" class="chart-studio"><input type="hidden" name="_datasetId" value="${dataset.id}"><p class="editor-instruction">Enter this dataset, select it, and choose how to graph it.</p><div class="chart-stage"><section class="chart-data-entry" aria-labelledby="data-entry-title"><h3 id="data-entry-title">1. Enter the data</h3><div class="selection-tools"><button id="start-selection" class="history-button" type="button">Select by dragging</button><button id="select-all-data" class="history-button" type="button">Select all data</button><span id="range-status" role="status">${studio.selection ? `${studio.selection} selected` : "No cells selected"}</span></div><input id="selected-range" type="hidden" value="${escapeAttribute(studio.selection)}"><div class="table-scroll"><table id="chart-grid" class="chart-grid"><thead><tr><th></th><th>A</th><th>B</th></tr></thead><tbody>${gridRows}</tbody></table></div></section><section class="chart-options" aria-labelledby="chart-options-title"><h3 id="chart-options-title">2. Choose the chart</h3><fieldset class="chart-type-picker"><legend>Chart type</legend>${typeChoices}</fieldset><p id="chart-type-note" class="type-note"></p><div class="chart-label-fields"><label>Chart title<input name="title" value="${escapeAttribute(studio.title)}" required></label><label>Bottom label<input name="xLabel" value="${escapeAttribute(studio.xLabel)}" required></label><label>Side label<input name="yLabel" value="${escapeAttribute(studio.yLabel)}" required></label></div></section></div><section class="live-chart-section" aria-labelledby="live-chart-title"><h3 id="live-chart-title">3. Preview the chart</h3><div id="student-chart-preview">${renderStudentChart(studio)}</div></section>${hints}<div class="chart-submit"><button class="button primary large" type="submit" ${complete ? "disabled" : ""}>${complete ? "Attempt saved" : "Save this attempt"}</button></div></form>${feedback("chart", result?.passed, complete ? "Your selected data produced a labeled column chart." : "Use the hints to finish the chart.", nextPracticeLabel(section.id, "chart"))}`;
  return `${hero(section, SECTION_GOALS[section.id])}${practiceSetBanner(section.id, "Chart")}<div class="practice-context"><span>Dataset ${dataset.id}</span><strong>${dataset.title}</strong></div><div class="lesson-flow">${block("Build", "Create a chart from a table", builder)}</div>${pager(section)}`;
}

function renderStudentChart(studio) {
  const rows = (studio.rows || []).filter((row) => String(row.category || "").trim() && Number.isFinite(Number(row.value)));
  if (!studio.chartType || rows.length === 0) return `<div class="empty-chart"><strong>Your chart will appear here.</strong><span>Enter data and choose a chart type.</span></div>`;
  const title = escapeHtml(studio.title || "Untitled chart");
  const xLabel = escapeHtml(studio.xLabel || studio.headers?.category || "Categories");
  const yLabel = escapeHtml(studio.yLabel || studio.headers?.value || "Values");
  const max = Math.max(1, ...rows.map((row) => Number(row.value)));
  if (studio.chartType === "bar") return `<div class="student-chart"><h4>${title}</h4><div class="horizontal-chart">${rows.map((row) => `<div><span>${escapeHtml(row.category)}</span><i style="width:${Math.max(5, Math.round(Number(row.value) / max * 100))}%"></i><strong>${escapeHtml(row.value)}</strong></div>`).join("")}</div><p>${xLabel} compared by ${yLabel}</p></div>`;
  if (studio.chartType === "line") {
    const points = rows.map((row, index) => `${55 + index * (410 / Math.max(1, rows.length - 1))},${205 - Number(row.value) / max * 155}`).join(" ");
    return `<div class="student-chart"><h4>${title}</h4><svg class="line-chart" viewBox="0 0 520 245" role="img" aria-label="Line chart"><path d="M50 30V210H490" fill="none" stroke="#607783" stroke-width="3"/><polyline points="${points}" fill="none" stroke="#167b72" stroke-width="5"/>${rows.map((row, index) => `<circle cx="${55 + index * (410 / Math.max(1, rows.length - 1))}" cy="${205 - Number(row.value) / max * 155}" r="7" fill="#167b72"/><text x="${55 + index * (410 / Math.max(1, rows.length - 1))}" y="232" text-anchor="middle">${escapeHtml(row.category)}</text>`).join("")}</svg><p>${xLabel} · ${yLabel}</p></div>`;
  }
  if (studio.chartType === "pie") {
    const total = rows.reduce((sum, row) => sum + Math.max(0, Number(row.value)), 0) || 1;
    let angle = 0;
    const colors = ["#167b72", "#f6b91c", "#3f77a8", "#cf694f"];
    const stops = rows.map((row, index) => { const start = angle; angle += Math.max(0, Number(row.value)) / total * 360; return `${colors[index % colors.length]} ${start}deg ${angle}deg`; }).join(",");
    return `<div class="student-chart"><h4>${title}</h4><div class="pie-layout"><div class="pie-chart" style="background:conic-gradient(${stops})"></div><ul>${rows.map((row, index) => `<li><i style="background:${colors[index % colors.length]}"></i>${escapeHtml(row.category)}: ${escapeHtml(row.value)}</li>`).join("")}</ul></div><p>Pie charts show parts of a whole and do not use axes.</p></div>`;
  }
  return `<div class="student-chart"><h4>${title}</h4><div class="student-column-layout"><span class="student-y-label">${yLabel}</span><div class="student-columns">${rows.map((row) => `<div><strong>${escapeHtml(row.value)}</strong><i style="height:${Math.max(8, Math.round(Number(row.value) / max * 180))}px"></i><span>${escapeHtml(row.category)}</span></div>`).join("")}</div></div><p>${xLabel}</p></div>`;
}

function renderInterpretLearn(section) {
  return `${hero(section, SECTION_GOALS[section.id])}<div class="lesson-flow">${block("Learn", "Use the numbers you can see", `${renderBars()}<div class="compare"><p><strong>Uses chart evidence</strong><span>Math has the highest value at 50 minutes.</span></p><p><strong>Guesses a cause</strong><span>Students chose Math because it is fun.</span></p></div><p class="plain-tip">A chart can show what happened. It cannot prove why it happened unless the dataset includes that information.</p>`)}</div>${pager(section)}`;
}

function renderInterpret(section) {
  const dataset = datasetFor(section.id, INTERPRET_DATASETS);
  const saved = state.responses[section.id] || {};
  const result = state.results[section.id];
  const fields = `<input type="hidden" name="_datasetId" value="${dataset.id}">${selectField("largest", `Which ${dataset.category.toLowerCase()} has the largest value?`, dataset.rows.map((row) => row[0]), saved.largest)}<label class="answer-field"><span>What is the difference between the largest and smallest values?</span><input name="difference" type="number" min="0" value="${escapeAttribute(saved.difference || "")}" required></label><label class="answer-field"><span>What is the total?</span><input name="total" type="number" min="0" value="${escapeAttribute(saved.total || "")}" required></label><label class="answer-field"><span>Write one sentence using a category and a number from the chart.</span><textarea name="conclusion" rows="4" minlength="12" required placeholder="The chart shows...">${escapeHtml(saved.conclusion || "")}</textarea></label>`;
  return `${hero(section, SECTION_GOALS[section.id])}${practiceSetBanner(section.id, "Chart")}<div class="practice-context"><span>Dataset ${dataset.id}</span><strong>${dataset.title}</strong></div><div class="lesson-flow">${block("Read", "Answer with chart evidence", `${renderBars(dataset)}${stepForm("interpret-form", fields, "Save this attempt", result?.passed)}${feedback("interpret", result?.passed, result?.passed ? "Your answers and chart statement were saved." : "Read the numbers again. Your sentence needs a category and a number from the chart.", nextPracticeLabel(section.id, "chart"))}`)}</div>${pager(section)}`;
}

function renderReview(section) {
  const summary = practiceSummary(state.attempts);
  const attempts = [...state.attempts].reverse();
  const attemptList = attempts.length ? attempts.map((attempt) => `<article class="attempt-card"><div><small>${escapeHtml(new Date(attempt.submittedAt).toLocaleString())}</small><h3>${escapeHtml(attempt.sectionTitle)}</h3><p>${attempt.score.correct} of ${attempt.score.total} checks · ${attempt.passed ? "Successful" : "Needs another look"}</p></div><button class="button quiet attempt-open" type="button" data-attempt-id="${escapeAttribute(attempt.id)}">Recreate work</button></article>`).join("") : `<div class="empty-history"><h2>No practice saved yet.</h2><p>Submit any practice activity and it will appear here.</p></div>`;
  return `${hero(section, "Review every saved attempt and export a report that recreates the work.")}<div class="practice-summary"><div><strong>${summary.attempts}</strong><span>attempts saved</span></div><div><strong>${summary.correct}/${summary.total}</strong><span>checks correct</span></div><div><strong>${summary.topics}</strong><span>topics practiced</span></div></div><section class="attempt-history" aria-labelledby="attempt-history-title"><h2 id="attempt-history-title">Practice history</h2>${attemptList}</section><div class="finish-actions"><button id="open-report" class="button primary large" ${summary.attempts ? "" : "disabled"}>Export practice report</button><a class="button quiet large" href="./printable-fallback.html" target="_blank">Open printed version</a></div><dialog id="attempt-dialog" class="attempt-dialog"><div class="dialog-heading"><div><small>Saved attempt</small><h2>Recreated practice</h2></div><button class="icon-button close-attempt" type="button" aria-label="Close">×</button></div><div id="attempt-replay"></div><div class="replay-actions"><button class="button quiet replay-back" type="button">← Earlier step</button><span class="replay-status" aria-live="polite"></span><button class="button quiet replay-next" type="button">Later step →</button></div></dialog>`;
}

function pager(section) {
  const index = SECTIONS.findIndex((item) => item.id === section.id);
  const previous = SECTIONS[index - 1];
  const next = SECTIONS[index + 1];
  return `<nav class="pager" aria-label="Lesson navigation">${previous ? `<a href="#${previous.id}" class="previous">← ${previous.short}</a>` : "<span></span>"}${next ? `<a href="#${next.id}" class="next">${next.short} →</a>` : ""}</nav>`;
}

function escapeHtml(value) { return String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;"); }
function escapeAttribute(value) { return escapeHtml(value).replaceAll("`", "&#096;"); }

function render({ focus = false } = {}) {
  const section = SECTIONS.find((item) => item.id === activeId) || SECTIONS[0];
  markVisited(section.id);
  const renderers = { start: renderStart, "read-table": renderReadTable, "table-practice": renderTablePractice, "clean-learn": renderCleanLearn, "clean-data": renderCleanData, "formula-learn": renderFormulaLearn, formulas: renderFormulas, "chart-basics": renderChartBasics, "chart-types": renderChartTypes, chart: renderChart, "interpret-learn": renderInterpretLearn, interpret: renderInterpret, review: renderReview };
  document.querySelector("#lesson").innerHTML = renderers[section.id](section);
  const nav = document.querySelector("#section-nav");
  if (nav) nav.innerHTML = navMarkup();
  refreshProgress();
  bindSectionEvents(section);
  setupStepForms();
  if (focus) { document.querySelector("#lesson").focus({ preventScroll: true }); window.scrollTo({ top: 0, behavior: "smooth" }); }
}

function setupStepForms() {
  document.querySelectorAll(".step-form").forEach((form) => {
    const fields = [...form.querySelectorAll(".answer-field")];
    const meter = form.querySelector(".step-meter");
    const back = form.querySelector("[data-step-back]");
    const next = form.querySelector("[data-step-next]");
    const submit = form.querySelector('[type="submit"]');
    let current = 0;
    if (form.dataset.complete === "true") {
      fields.forEach((field) => { field.hidden = true; });
      form.querySelector(".practice-kicker").textContent = "Finished";
      meter.textContent = "You answered every question correctly.";
      form.querySelector(".step-actions").hidden = true;
      return;
    }
    const show = () => {
      fields.forEach((field, index) => { field.hidden = index !== current; });
      meter.textContent = `Question ${current + 1} of ${fields.length}`;
      back.hidden = current === 0;
      next.hidden = current === fields.length - 1;
      submit.hidden = current !== fields.length - 1;
    };
    back.addEventListener("click", () => { current -= 1; show(); fields[current].querySelector("input, select, textarea")?.focus(); });
    next.addEventListener("click", () => { const control = fields[current].querySelector("input, select, textarea"); if (!control.reportValidity()) return; current += 1; show(); fields[current].querySelector("input, select, textarea")?.focus(); });
    show();
  });
}

function readForm(form) { return Object.fromEntries(new FormData(form).entries()); }

function readChartStudio(form) {
  return {
    _datasetId: form.querySelector('[name="_datasetId"]').value,
    headers: { category: form.querySelector('[data-chart-header="category"]').value, value: form.querySelector('[data-chart-header="value"]').value },
    rows: [...form.querySelectorAll("[data-chart-category]")].map((input, index) => ({ category: input.value, value: form.querySelectorAll("[data-chart-value]")[index].value })),
    selection: form.querySelector("#selected-range").value,
    chartType: form.querySelector('[name="chartType"]:checked')?.value || "",
    title: form.querySelector('[name="title"]').value,
    xLabel: form.querySelector('[name="xLabel"]').value,
    yLabel: form.querySelector('[name="yLabel"]').value,
  };
}

function recordResult(id, responses, passed, details = {}) {
  state.responses[id] = responses;
  const checkedAt = new Date();
  state.results[id] = { passed, checkedAt: checkedAt.toISOString(), ...details };
  const section = SECTIONS.find((item) => item.id === id);
  const attempt = createAttempt({ sectionId: id, sectionTitle: section?.title || id, datasetId: responses?._datasetId || details.datasetId, response: responses, passed, details: details.details || {}, snapshots: details.snapshots || [] }, checkedAt);
  state.attempts.push(attempt);
  const sameTopic = state.attempts.filter((item) => item.sectionId === id);
  if (sameTopic.length > 20) state.attempts.splice(state.attempts.findIndex((item) => item.id === sameTopic[0].id), 1);
  saveState();
  render();
  showToast(passed ? "Practice saved." : "Attempt saved. Read the hint and try again.");
}

function bindSectionEvents(section) {
  document.querySelector(".practice-again")?.addEventListener("click", () => { delete state.responses[section.id]; delete state.results[section.id]; saveState(); render({ focus: true }); showToast("New attempt ready."); });
  document.querySelector("#table-practice-form")?.addEventListener("submit", (event) => { event.preventDefault(); const values = readForm(event.currentTarget); const dataset = TABLE_DATASETS.find((item) => item.id === values._datasetId); const details = Object.fromEntries(Object.entries(dataset.questions).map(([key, expected]) => [key, String(values[key] || "").trim() === expected])); recordResult(section.id, values, Object.values(details).every(Boolean), { details }); });
  const cleanForm = document.querySelector("#clean-form");
  if (cleanForm && !state.results[section.id]?.passed) {
    let history = [readCleanRows(cleanForm)];
    let historyIndex = 0;
    const undo = cleanForm.querySelector("#undo-clean");
    const redo = cleanForm.querySelector("#redo-clean");
    const status = cleanForm.querySelector("#edit-status");
    const body = cleanForm.querySelector("#clean-table-body");
    const updateHistoryButtons = () => { undo.disabled = historyIndex === 0; redo.disabled = historyIndex === history.length - 1; };
    const sameRows = (left, right) => JSON.stringify(left) === JSON.stringify(right);
    const saveHistoryStep = (rows, message, rerender = false) => {
      if (!sameRows(rows, history[historyIndex])) {
        history = history.slice(0, historyIndex + 1);
        history.push(structuredClone(rows));
        historyIndex += 1;
      }
      if (rerender) body.innerHTML = cleanRowsMarkup(rows);
      status.textContent = message;
      updateHistoryButtons();
    };
    cleanForm.addEventListener("change", (event) => {
      if (!event.target.matches("[data-field]")) return;
      saveHistoryStep(readCleanRows(cleanForm), "Cell edit saved.");
    });
    cleanForm.addEventListener("click", (event) => {
      const deleteButton = event.target.closest(".delete-row");
      if (!deleteButton) return;
      const currentRows = readCleanRows(cleanForm);
      const key = deleteButton.closest("tr").dataset.rowKey;
      saveHistoryStep(currentRows.filter((row) => row.key !== key), "Row removed. Use Undo if that was the wrong row.", true);
    });
    undo.addEventListener("click", () => { if (historyIndex === 0) return; historyIndex -= 1; body.innerHTML = cleanRowsMarkup(history[historyIndex]); status.textContent = "Last change undone."; updateHistoryButtons(); });
    redo.addEventListener("click", () => { if (historyIndex === history.length - 1) return; historyIndex += 1; body.innerHTML = cleanRowsMarkup(history[historyIndex]); status.textContent = "Change restored."; updateHistoryButtons(); });
    cleanForm.addEventListener("submit", (event) => { event.preventDefault(); const rows = readCleanRows(event.currentTarget); const datasetId = event.currentTarget.querySelector('[name="_datasetId"]').value; const dataset = CLEAN_DATASETS.find((item) => item.id === datasetId); const details = checkDatasetRows(rows, dataset.expected); recordResult(section.id, { _datasetId: datasetId, rows }, Object.values(details).every(Boolean), { details, snapshots: history.map((snapshotRows) => ({ _datasetId: datasetId, rows: snapshotRows })) }); });
  }
  const formulaForm = document.querySelector("#formula-form");
  formulaForm?.querySelectorAll("input").forEach((input) => input.addEventListener("input", () => {
    const value = checkFormula(input.name, input.value) ? Number(formulaForm.dataset[input.name === "sum" ? "total" : "average"]) : null;
    const output = formulaForm.querySelector(`[data-formula-result="${input.name}"]`);
    output.textContent = value === null ? "" : `Result: ${value}`;
    input.classList.toggle("is-calculating", value !== null);
  }));
  formulaForm?.addEventListener("submit", (event) => { event.preventDefault(); const values = readForm(event.currentTarget); const details = { sum: checkFormula("sum", values.sum), average: checkFormula("average", values.average) }; recordResult(section.id, values, details.sum && details.average, { details }); });
  document.querySelector("#chart-type-form")?.addEventListener("submit", (event) => { event.preventDefault(); const values = readForm(event.currentTarget); const dataset = CHART_TYPE_DATASETS.find((item) => item.id === values._datasetId); const details = { chartType: values.chartType === dataset.answer }; recordResult(section.id, values, details.chartType, { details }); });
  const chartForm = document.querySelector("#chart-form");
  if (chartForm) {
    const preview = chartForm.querySelector("#student-chart-preview");
    const grid = chartForm.querySelector("#chart-grid");
    const rangeInput = chartForm.querySelector("#selected-range");
    const rangeStatus = chartForm.querySelector("#range-status");
    const typeNote = chartForm.querySelector("#chart-type-note");
    let snapshots = [];
    let selectionMode = false;
    let dragging = false;
    let anchor = null;
    const cellPosition = (name) => ({ column: name.charCodeAt(0) - 65, row: Number(name.slice(1)) - 1 });
    const cellName = (column, row) => `${String.fromCharCode(65 + column)}${row + 1}`;
    const showSelection = (startName, endName) => {
      const start = cellPosition(startName);
      const end = cellPosition(endName);
      const minColumn = Math.min(start.column, end.column);
      const maxColumn = Math.max(start.column, end.column);
      const minRow = Math.min(start.row, end.row);
      const maxRow = Math.max(start.row, end.row);
      grid.querySelectorAll("[data-cell]").forEach((cell) => { const position = cellPosition(cell.dataset.cell); cell.classList.toggle("is-selected", position.column >= minColumn && position.column <= maxColumn && position.row >= minRow && position.row <= maxRow); });
      const range = `${cellName(minColumn, minRow)}:${cellName(maxColumn, maxRow)}`;
      rangeInput.value = range;
      rangeStatus.textContent = `${range} selected`;
      if (snapshots.length) captureSnapshot();
    };
    const updatePreview = () => { const studio = readChartStudio(chartForm); preview.innerHTML = renderStudentChart(studio); const notes = { column: "Column charts compare categories.", bar: "Bar charts compare categories from left to right.", line: "Line charts usually show change over time.", pie: "Pie charts show parts of a whole and do not use axes." }; typeNote.textContent = notes[studio.chartType] || "Choose a chart type."; };
    const captureSnapshot = () => { const next = readChartStudio(chartForm); if (JSON.stringify(next) !== JSON.stringify(snapshots.at(-1))) snapshots.push(structuredClone(next)); };
    if (rangeInput.value) { const [start, end] = rangeInput.value.split(":"); if (start && end) showSelection(start, end); }
    chartForm.addEventListener("input", updatePreview);
    chartForm.addEventListener("change", () => { updatePreview(); captureSnapshot(); });
    chartForm.querySelector("#start-selection").addEventListener("click", (event) => { selectionMode = !selectionMode; grid.classList.toggle("is-selecting", selectionMode); event.currentTarget.textContent = selectionMode ? "Drag across the cells" : "Select by dragging"; rangeStatus.textContent = selectionMode ? "Drag from the first cell to the last cell." : (rangeInput.value ? `${rangeInput.value} selected` : "No cells selected"); });
    chartForm.querySelector("#select-all-data").addEventListener("click", () => { selectionMode = false; grid.classList.remove("is-selecting"); chartForm.querySelector("#start-selection").textContent = "Select by dragging"; showSelection("A1", "B5"); });
    grid.addEventListener("pointerdown", (event) => { const cell = event.target.closest("[data-cell]"); if (!selectionMode || !cell) return; event.preventDefault(); anchor = cell.dataset.cell; dragging = true; showSelection(anchor, anchor); });
    grid.addEventListener("pointerover", (event) => { const cell = event.target.closest("[data-cell]"); if (!dragging || !cell) return; showSelection(anchor, cell.dataset.cell); });
    grid.addEventListener("pointerup", (event) => { if (!dragging) return; const cell = event.target.closest("[data-cell]"); if (cell) showSelection(anchor, cell.dataset.cell); dragging = false; selectionMode = false; grid.classList.remove("is-selecting"); chartForm.querySelector("#start-selection").textContent = "Select by dragging"; });
    updatePreview();
    captureSnapshot();
    chartForm.addEventListener("submit", (event) => { event.preventDefault(); const studio = readChartStudio(event.currentTarget); captureSnapshot(); const details = checkChartBuild(studio); recordResult(section.id, studio, Object.values(details).every(Boolean), { details, snapshots }); });
  }
  document.querySelector("#interpret-form")?.addEventListener("submit", (event) => { event.preventDefault(); const values = readForm(event.currentTarget); const dataset = INTERPRET_DATASETS.find((item) => item.id === values._datasetId); const conclusion = String(values.conclusion || "").toLowerCase(); const usesCategory = dataset.rows.some((row) => conclusion.includes(String(row[0]).toLowerCase())); const usesNumber = dataset.rows.some((row) => conclusion.includes(String(row[1]))); const details = { largest: values.largest === dataset.largest, difference: Number(values.difference) === dataset.difference, total: Number(values.total) === dataset.total, conclusion: usesCategory && usesNumber }; recordResult(section.id, values, Object.values(details).every(Boolean), { details }); });
  document.querySelector("#open-report")?.addEventListener("click", () => document.querySelector("#report-dialog").showModal());
  document.querySelectorAll(".attempt-open").forEach((button) => button.addEventListener("click", () => openAttempt(button.dataset.attemptId)));
  document.querySelector(".close-attempt")?.addEventListener("click", () => document.querySelector("#attempt-dialog")?.close());
}

function openAttempt(attemptId) {
  const attempt = state.attempts.find((item) => item.id === attemptId);
  const dialog = document.querySelector("#attempt-dialog");
  if (!attempt || !dialog) return;
  const snapshots = attempt.snapshots?.length ? attempt.snapshots : [attempt.response];
  let step = snapshots.length - 1;
  const replay = dialog.querySelector("#attempt-replay");
  const back = dialog.querySelector(".replay-back");
  const next = dialog.querySelector(".replay-next");
  const status = dialog.querySelector(".replay-status");
  const showStep = () => {
    replay.innerHTML = renderAttemptHtml({ ...attempt, response: snapshots[step] });
    status.textContent = snapshots.length > 1 ? `Step ${step + 1} of ${snapshots.length}` : "Submitted work";
    back.disabled = step === 0;
    next.disabled = step === snapshots.length - 1;
  };
  back.onclick = () => { if (step > 0) { step -= 1; showStep(); } };
  next.onclick = () => { if (step < snapshots.length - 1) { step += 1; showStep(); } };
  showStep();
  dialog.showModal();
}

function refreshProgress() {
  const progress = document.querySelector(".header-progress");
  if (!progress) return;
  const summary = practiceSummary(state.attempts);
  progress.querySelector("span").textContent = `${summary.attempts} ${summary.attempts === 1 ? "attempt" : "attempts"} saved`;
  progress.querySelector("small").textContent = `${summary.topics} ${summary.topics === 1 ? "topic" : "topics"} practiced`;
}

function showToast(message) {
  const toast = document.querySelector("#toast");
  toast.textContent = message;
  toast.classList.add("show");
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => toast.classList.remove("show"), 2400);
}

function downloadReport(identity) {
  const html = buildEvidenceHtml(state, identity);
  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  const safeName = String(identity.student || "student").trim().replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase() || "student";
  link.href = url;
  link.download = `${safeName}-${MODULE.id}-practice-report.html`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

document.querySelector("#app").innerHTML = shellMarkup();
render();

window.addEventListener("hashchange", () => { activeId = getRoute(); document.querySelector(".lesson-menu")?.removeAttribute("open"); render({ focus: true }); });

document.querySelector("#reset-progress")?.addEventListener("click", () => {
  if (!window.confirm("Reset all practice on this computer? Download your report first if you need it.")) return;
  state = structuredClone(defaultState);
  saveState();
  activeId = "start";
  location.hash = "start";
  render({ focus: true });
  showToast("Practice reset.");
});

document.querySelector("#report-form")?.addEventListener("submit", (event) => {
  if (event.submitter?.value === "cancel") return;
  event.preventDefault();
  if (!event.currentTarget.reportValidity()) return;
  downloadReport(readForm(event.currentTarget));
  document.querySelector("#report-dialog").close();
  showToast("Report downloaded.");
});
