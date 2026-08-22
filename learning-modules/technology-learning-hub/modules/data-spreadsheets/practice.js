import { CLUB_DATA, MODULE, SECTIONS } from "./content.js";

export const TABLE_ANSWERS = {
  title: "Minutes Spent in School Clubs",
  headers: "Club and Minutes",
  record: "A03, Science, 45",
  value: "50",
};

export const CLEAN_ROWS = [
  { studentId: "A01", club: "Art", minutes: "35" },
  { studentId: "A02", club: "Math", minutes: "50" },
  { studentId: "A03", club: "Science", minutes: "45" },
  { studentId: "A04", club: "Music", minutes: "30" },
];

export function normalizeFormula(value) {
  return String(value || "").trim().replaceAll(" ", "").toUpperCase();
}

export function checkFormula(kind, value) {
  const normalized = normalizeFormula(value);
  const accepted = kind === "sum"
    ? ["=SUM(B2:B5)", "=B2+B3+B4+B5"]
    : ["=AVERAGE(B2:B5)", "=SUM(B2:B5)/4"];
  return accepted.includes(normalized);
}

export function formulaResult(kind, value) {
  if (!checkFormula(kind, value)) return null;
  return kind === "sum" ? 160 : 40;
}

export function checkExactAnswers(given, expected) {
  return Object.entries(expected).every(([key, value]) => String(given?.[key] || "").trim() === value);
}

export function checkCleanRows(given) {
  const rows = Array.isArray(given) ? given : [];
  return {
    rowCount: rows.length === CLEAN_ROWS.length,
    studentIds: rows.length === CLEAN_ROWS.length && rows.every((row, index) => String(row?.studentId || "").trim() === CLEAN_ROWS[index].studentId),
    clubs: rows.length === CLEAN_ROWS.length && rows.every((row, index) => String(row?.club || "").trim() === CLEAN_ROWS[index].club),
    minutes: rows.length === CLEAN_ROWS.length && rows.every((row, index) => String(row?.minutes || "").trim() === CLEAN_ROWS[index].minutes),
  };
}

export function checkChartBuild(given) {
  const rows = Array.isArray(given?.rows) ? given.rows : [];
  const validRows = rows.length === 4 && rows.every((row) => String(row?.category || "").trim() && String(row?.value || "").trim() && Number.isFinite(Number(row.value)));
  return {
    data: Boolean(String(given?.headers?.category || "").trim() && String(given?.headers?.value || "").trim() && validRows),
    selection: given?.selection === "A1:B5",
    chartType: given?.chartType === "column",
    title: String(given?.title || "").trim().length >= 4,
    xLabel: String(given?.xLabel || "").trim().length >= 2,
    yLabel: String(given?.yLabel || "").trim().length >= 2,
  };
}

export function chartFacts() {
  const total = CLUB_DATA.reduce((sum, item) => sum + item.minutes, 0);
  const largest = CLUB_DATA.reduce((best, item) => item.minutes > best.minutes ? item : best);
  const music = CLUB_DATA.find((item) => item.club === "Music");
  return { total, largest: largest.club, difference: largest.minutes - music.minutes };
}

export function checkInterpretation(given) {
  const facts = chartFacts();
  return {
    largest: String(given?.largest || "").trim() === facts.largest,
    difference: Number(given?.difference) === facts.difference,
    total: Number(given?.total) === facts.total,
    conclusion: String(given?.conclusion || "").trim().length >= 20,
  };
}

export function completedPracticeCount(state) {
  return ["read-table", "clean-data", "formulas", "chart", "interpret"]
    .filter((id) => state?.results?.[id]?.passed).length;
}

export function createAttempt({ sectionId, sectionTitle, datasetId = "club-minutes-01", response, passed, details = {}, snapshots = [] }, now = new Date()) {
  const checks = Object.values(details).filter((value) => typeof value === "boolean");
  const correct = checks.length ? checks.filter(Boolean).length : Number(Boolean(passed));
  const total = checks.length || 1;
  return {
    id: `${sectionId}-${now.getTime()}`,
    moduleId: MODULE.id,
    moduleVersion: MODULE.version,
    sectionId,
    sectionTitle,
    datasetId,
    submittedAt: now.toISOString(),
    passed: Boolean(passed),
    score: { correct, total },
    response: structuredClone(response),
    details: structuredClone(details),
    snapshots: snapshots.length ? structuredClone(snapshots) : [structuredClone(response)],
  };
}

export function practiceSummary(attempts = []) {
  const safeAttempts = Array.isArray(attempts) ? attempts : [];
  const correct = safeAttempts.reduce((sum, attempt) => sum + Number(attempt?.score?.correct || 0), 0);
  const total = safeAttempts.reduce((sum, attempt) => sum + Number(attempt?.score?.total || 0), 0);
  const topics = new Set(safeAttempts.map((attempt) => attempt.sectionId));
  return { attempts: safeAttempts.length, correct, total, topics: topics.size };
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function attemptWorkHtml(attempt) {
  const response = attempt?.response || {};
  if (attempt.sectionId === "clean-data") {
    const rows = Array.isArray(response.rows) ? response.rows : [];
    return `<table><caption>Recreated cleaned table</caption><thead><tr><th>Student ID</th><th>Club</th><th>Minutes</th></tr></thead><tbody>${rows.map((row) => `<tr><td>${escapeHtml(row.studentId)}</td><td>${escapeHtml(row.club)}</td><td>${escapeHtml(row.minutes)}</td></tr>`).join("")}</tbody></table>`;
  }
  if (attempt.sectionId === "formulas") {
    return `<table><caption>Recreated formula cells</caption><tbody><tr><th>SUM formula</th><td><code>${escapeHtml(response.sum || "Blank")}</code></td></tr><tr><th>AVERAGE formula</th><td><code>${escapeHtml(response.average || "Blank")}</code></td></tr></tbody></table>`;
  }
  if (attempt.sectionId === "chart") {
    const rows = Array.isArray(response.rows) ? response.rows : [];
    const max = Math.max(1, ...rows.map((row) => Number(row.value) || 0));
    return `<table><caption>Recreated chart data</caption><thead><tr><th>${escapeHtml(response.headers?.category || "Category")}</th><th>${escapeHtml(response.headers?.value || "Value")}</th></tr></thead><tbody>${rows.map((row) => `<tr><td>${escapeHtml(row.category)}</td><td>${escapeHtml(row.value)}</td></tr>`).join("")}</tbody></table><div class="chart-replay"><h3>${escapeHtml(response.title || "Untitled chart")}</h3><div class="chart-replay-area"><span>${escapeHtml(response.yLabel || "Values")}</span><div>${rows.map((row) => `<i style="height:${Math.max(8, Math.round((Number(row.value) || 0) / max * 130))}px"><b>${escapeHtml(row.value)}</b><em>${escapeHtml(row.category)}</em></i>`).join("")}</div></div><p>${escapeHtml(response.xLabel || "Categories")}</p></div><p>Selected range: ${escapeHtml(response.selection || "None")} · Chart type: ${escapeHtml(response.chartType || "None")}</p>`;
  }
  if (attempt.sectionId === "interpret") {
    return `<table><caption>Recreated chart responses</caption><tbody><tr><th>Largest value</th><td>${escapeHtml(response.largest || "Blank")}</td></tr><tr><th>Difference</th><td>${escapeHtml(response.difference || "Blank")}</td></tr><tr><th>Total</th><td>${escapeHtml(response.total || "Blank")}</td></tr><tr><th>Conclusion</th><td>${escapeHtml(response.conclusion || "Blank")}</td></tr></tbody></table>`;
  }
  return `<table><caption>Recreated responses</caption><tbody>${Object.entries(response).map(([key, value]) => `<tr><th>${escapeHtml(key)}</th><td>${escapeHtml(typeof value === "object" ? JSON.stringify(value) : value)}</td></tr>`).join("")}</tbody></table>`;
}

export function renderAttemptHtml(attempt) {
  const score = `${Number(attempt?.score?.correct || 0)} of ${Number(attempt?.score?.total || 0)} checks`;
  return `<article class="attempt-reconstruction"><header><p>${escapeHtml(attempt.sectionTitle || attempt.sectionId)}</p><h2>${attempt.passed ? "Successful attempt" : "Practice attempt"}</h2><small>${escapeHtml(attempt.submittedAt || "")}</small></header><p><strong>${score}</strong> · Dataset ${escapeHtml(attempt.datasetId || "practice")}</p>${attemptWorkHtml(attempt)}</article>`;
}

export function buildEvidenceHtml(state, identity = {}) {
  const attempts = Array.isArray(state?.attempts) ? state.attempts : [];
  const summary = practiceSummary(attempts);
  const topicRows = SECTIONS.filter((section) => section.practice !== false && !["start", "review"].includes(section.id)).map((section) => {
    const topicAttempts = attempts.filter((attempt) => attempt.sectionId === section.id);
    const correct = topicAttempts.reduce((sum, attempt) => sum + Number(attempt.score?.correct || 0), 0);
    const total = topicAttempts.reduce((sum, attempt) => sum + Number(attempt.score?.total || 0), 0);
    return `<tr><th>${escapeHtml(section.title)}</th><td>${topicAttempts.length}</td><td>${total ? `${correct} of ${total}` : "No attempts"}</td></tr>`;
  }).join("");
  const reconstructed = attempts.length ? attempts.map((attempt, index) => `<details ${index === attempts.length - 1 ? "open" : ""}><summary>Attempt ${index + 1}: ${escapeHtml(attempt.sectionTitle)} · ${attempt.score.correct}/${attempt.score.total}</summary>${renderAttemptHtml(attempt)}</details>`).join("") : "<p>No practice attempts were recorded.</p>";
  const generated = escapeHtml(new Date().toISOString().slice(0, 10));
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${MODULE.id} practice report</title><style>body{font:16px Arial,sans-serif;max-width:900px;margin:40px auto;padding:0 24px;color:#17212b}h1{font-size:28px}table{width:100%;border-collapse:collapse;margin:20px 0}caption{text-align:left;font-weight:700;margin-bottom:8px}th,td{border:1px solid #9aa7b2;padding:10px;text-align:left}th{background:#eef4f7}.summary{display:flex;gap:28px;padding:18px;background:#eef8f5}.summary strong{display:block;font-size:26px}details{margin:14px 0;border:1px solid #a9b7bf}summary{padding:14px;cursor:pointer;font-weight:700}.attempt-reconstruction{padding:4px 18px 18px}.attempt-reconstruction header p{margin-bottom:4px}.attempt-reconstruction header h2{margin:0}.note{padding:12px;background:#fff5d9;border-left:4px solid #d99b16}.chart-replay{padding:16px;border:1px solid #9aa7b2}.chart-replay h3{text-align:center}.chart-replay-area{display:grid;grid-template-columns:40px 1fr;min-height:170px}.chart-replay-area>span{writing-mode:vertical-rl;transform:rotate(180deg);text-align:center}.chart-replay-area>div{display:flex;align-items:end;justify-content:space-around;border-left:2px solid #607783;border-bottom:2px solid #607783}.chart-replay i{min-width:48px;background:#267f76;display:flex;position:relative;justify-content:center}.chart-replay b{position:absolute;top:-22px}.chart-replay em{position:absolute;bottom:-24px;font-style:normal}.chart-replay+p,.chart-replay p{text-align:center}</style></head><body><p>${MODULE.id} v${MODULE.version}</p><h1>Data Foundations practice report</h1><p><strong>Student:</strong> ${escapeHtml(identity.student || "Not entered")}</p><p><strong>Class:</strong> ${escapeHtml(identity.className || "Not entered")}</p><p><strong>Generated:</strong> ${generated}</p><div class="summary"><span><strong>${summary.attempts}</strong>attempts saved</span><span><strong>${summary.correct}/${summary.total}</strong>checks correct</span><span><strong>${summary.topics}</strong>topics practiced</span></div><table><thead><tr><th>Topic</th><th>Attempts</th><th>Checks correct</th></tr></thead><tbody>${topicRows}</tbody></table><h2>Recreated practice</h2>${reconstructed}<p class="note">This report records formative practice. It is not a formal Grade 6 assessment.</p></body></html>`;
}
