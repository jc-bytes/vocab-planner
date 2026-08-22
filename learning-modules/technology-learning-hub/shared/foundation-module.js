import "./foundation-module.css";

const clone = (value) => JSON.parse(JSON.stringify(value));
const escapeHtml = (value = "") => String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
const uid = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

export function mountFoundationModule(config) {
  const gradeLabel = config.gradeLabel || "Grade 6 Technology";
  const classes = config.classes || ["6A", "6B", "6C"];
  const defaultState = { attempts: [], responses: {}, visited: [config.sections[0].id] };
  let state = load();
  let activeId = route();

  function load() {
    try {
      const saved = JSON.parse(localStorage.getItem(config.storageKey) || "null");
      return { ...clone(defaultState), ...saved, attempts: Array.isArray(saved?.attempts) ? saved.attempts : [], responses: saved?.responses || {}, visited: saved?.visited || defaultState.visited };
    } catch { return clone(defaultState); }
  }
  function save() { localStorage.setItem(config.storageKey, JSON.stringify(state)); }
  function route() {
    const id = location.hash.replace(/^#/, "");
    return config.sections.some((section) => section.id === id) ? id : config.sections[0].id;
  }
  function section() { return config.sections.find((item) => item.id === activeId) || config.sections[0]; }
  function passedCount(sectionId) { return state.attempts.filter((attempt) => attempt.sectionId === sectionId && attempt.passed).length; }
  function status(sectionId) {
    if (state.attempts.some((attempt) => attempt.sectionId === sectionId && attempt.passed) || state.responses[sectionId]?.saved) return "done";
    return state.visited.includes(sectionId) ? "started" : "new";
  }
  function nav() {
    return config.sections.map((item) => `<a href="#${item.id}" class="fm-nav-link ${item.id === activeId ? "is-active" : ""}" ${item.id === activeId ? 'aria-current="page"' : ""}><span class="fm-nav-dot is-${status(item.id)}">${status(item.id) === "done" ? "✓" : ""}</span><span>${item.short}</span><small>${item.minutes} min</small></a>`).join("");
  }
  function historySummary() {
    const topics = new Set(state.attempts.map((attempt) => attempt.sectionId)).size;
    return `<strong>${state.attempts.length} ${state.attempts.length === 1 ? "attempt" : "attempts"} saved</strong><small>${topics} ${topics === 1 ? "topic" : "topics"} practiced</small>`;
  }
  function shell() {
    const classOptions = classes.map((className) => `<option>${escapeHtml(className)}</option>`).join("");
    return `<div class="fm-shell"><header class="fm-topbar"><a class="fm-brand" href="#${config.sections[0].id}"><span>${config.mark}</span><div><small>${escapeHtml(gradeLabel)}</small><strong>${config.shortTitle}</strong></div></a><div class="fm-history">${historySummary()}</div><details class="fm-menu"><summary>Lessons</summary><nav aria-label="Module sections">${nav()}</nav></details></header><main id="fm-main" tabindex="-1"></main><footer class="fm-footer"><details><summary>About this module</summary><p><strong>Practice only.</strong> Formal grades use separate directions and scoring tools.</p><p>Progress stays on this browser and device. Export the report before changing computers.</p><a href="./printable-fallback.html" target="_blank">Open printable fallback</a><button id="fm-reset" class="fm-text-button">Reset this device</button><p>${config.id} v${config.version}</p></details></footer></div><div id="fm-toast" class="fm-toast" role="status" aria-live="polite"></div><dialog id="fm-export-dialog"><form method="dialog" id="fm-export-form"><div class="fm-dialog-heading"><div><small>Practice report</small><h2>Export saved work</h2></div><button value="cancel" aria-label="Close">×</button></div><label>Student name<input name="student" required maxlength="70" autocomplete="off"></label><label>Class<select name="className" required><option value="">Choose class</option>${classOptions}</select></label><button class="fm-button primary" value="default">Download report</button></form></dialog>`;
  }
  function hero(item) {
    const index = config.sections.findIndex((entry) => entry.id === item.id);
    return `<header class="fm-hero"><p>Lesson ${index + 1} of ${config.sections.length} <span>·</span> ${item.minutes} min</p><h1>${item.title}</h1><div>${item.summary}</div></header>`;
  }
  function pager(item) {
    const index = config.sections.findIndex((entry) => entry.id === item.id);
    const previous = config.sections[index - 1]; const next = config.sections[index + 1];
    return `<nav class="fm-pager" aria-label="Lesson navigation">${previous ? `<a href="#${previous.id}">← ${previous.short}</a>` : "<span></span>"}${next ? `<a class="next" href="#${next.id}">${next.short} →</a>` : ""}</nav>`;
  }
  function block(label, title, html, className = "") { return `<section class="fm-block ${className}"><p class="fm-label">${label}</p><h2>${title}</h2>${html}</section>`; }
  function practiceHeader(item, position) {
    return `<section class="fm-set" aria-label="Practice set, activity ${position} of ${item.items.length}"><div><span>Practice set</span><strong>Activity ${position} of ${item.items.length}</strong><small>Complete as many as your teacher assigns.</small></div><ol>${item.items.map((_, index) => `<li class="${index + 1 < position ? "done" : index + 1 === position ? "current" : ""}">${index + 1}</li>`).join("")}</ol></section>`;
  }
  function lessonPage(item) { return `${hero(item)}${item.html}${pager(item)}`; }
  function choicePage(item) {
    const passed = passedCount(item.id);
    const savedResult = state.responses[item.id]?.passed;
    const shownIndex = savedResult ? Math.max(0, passed - 1) % item.items.length : passed % item.items.length;
    const activity = item.items[shownIndex];
    const saved = state.responses[item.id] || {};
    const choices = activity.options.map((option, index) => `<label class="fm-choice"><input type="radio" name="answer" value="${index}" ${String(saved.answer) === String(index) ? "checked" : ""} ${savedResult ? "disabled" : ""}><span><b>${String.fromCharCode(65 + index)}</b>${option}</span></label>`).join("");
    const feedback = saved.checked ? `<div class="fm-feedback ${saved.passed ? "success" : "retry"}"><strong>${saved.passed ? "Practice saved." : "Attempt saved."}</strong><span>${saved.passed ? activity.feedback : activity.retry}</span>${saved.passed ? `<button class="fm-button quiet" type="button" data-next-practice>${passed % item.items.length === 0 ? "Start another set" : "Next activity"}</button>` : ""}</div>` : "";
    return `${hero(item)}${practiceHeader(item, shownIndex + 1)}${block("Practice", activity.title, `${activity.visual || ""}<p class="fm-question">${activity.question}</p><form id="fm-choice-form"><input type="hidden" name="activity" value="${shownIndex}"><div class="fm-choices">${choices}</div><button class="fm-button primary large" ${savedResult ? "disabled" : ""}>Check and save</button></form>${feedback}`)}${pager(item)}`;
  }
  function formPage(item) {
    const saved = state.responses[item.id] || {};
    const fields = item.fields.map((field) => `<label class="fm-field"><span>${field.label}</span>${field.type === "textarea" ? `<textarea name="${field.name}" rows="${field.rows || 4}" minlength="${field.minlength || 3}" required>${escapeHtml(saved[field.name] || "")}</textarea>` : `<input name="${field.name}" value="${escapeHtml(saved[field.name] || "")}" ${field.type ? `type="${field.type}"` : ""} ${field.min ? `min="${field.min}"` : ""} required>`}<small>${field.help || ""}</small></label>`).join("");
    return `${hero(item)}${item.intro || ""}${block("Record", item.prompt, `<form id="fm-record-form" class="fm-record-form">${fields}<button class="fm-button primary large">${saved.saved ? "Update saved work" : "Save this work"}</button></form>${saved.saved ? '<div class="fm-feedback success"><strong>Work saved.</strong><span>You can return and update it before exporting.</span></div>' : ""}`)}${pager(item)}`;
  }
  function sensorPage(item) {
    const saved = state.responses[item.id] || { light: 80, threshold: 100, icon: "moon" };
    const output = Number(saved.light) < Number(saved.threshold) ? item.lowOutput : item.highOutput;
    return `${hero(item)}${block("Test", "Move the light value across the threshold", `<div class="fm-sensor-lab"><div class="fm-microbit" aria-label="micro:bit display"><div class="fm-led-grid" id="fm-led-grid">${renderIcon(output.icon)}</div><strong id="fm-sensor-output">${output.label}</strong></div><form id="fm-sensor-form"><label class="fm-field"><span>Light level: <output id="fm-light-value">${saved.light}</output></span><input name="light" type="range" min="0" max="255" value="${saved.light}"></label><label class="fm-field"><span>Threshold</span><input name="threshold" type="number" min="1" max="254" value="${saved.threshold}" required></label><p class="fm-rule">If light level is below the threshold, show the night icon. Otherwise, clear the display.</p><button class="fm-button primary large">Save this sensor test</button></form>${saved.saved ? '<div class="fm-feedback success"><strong>Test saved.</strong><span>Your light value, threshold, and output are in the report.</span></div>' : ""}</div>`)}${pager(item)}`;
  }
  function renderIcon(pattern) {
    const active = new Set(pattern || []);
    return Array.from({ length: 25 }, (_, index) => `<i class="${active.has(index) ? "on" : ""}"></i>`).join("");
  }
  function reviewPage(item) {
    const attempts = [...state.attempts].reverse();
    const cards = attempts.length ? attempts.map((attempt) => `<article class="fm-attempt"><div><small>${new Date(attempt.at).toLocaleString()}</small><h3>${escapeHtml(attempt.sectionTitle)}</h3><p>${escapeHtml(attempt.activityTitle)} · ${attempt.passed ? "Successful" : "Needs another look"}</p></div><button class="fm-button quiet" data-attempt="${attempt.id}">Recreate</button></article>`).join("") : '<div class="fm-empty"><h2>No practice saved yet.</h2><p>Submit any practice or record page and it will appear here.</p></div>';
    return `${hero(item)}<section class="fm-summary"><div><strong>${state.attempts.length}</strong><span>attempts saved</span></div><div><strong>${state.attempts.filter((attempt) => attempt.passed).length}</strong><span>successful attempts</span></div><div><strong>${Object.values(state.responses).filter((response) => response.saved).length}</strong><span>records saved</span></div></section><section class="fm-history-list"><h2>Practice history</h2>${cards}</section><button id="fm-open-export" class="fm-button primary large" ${state.attempts.length || Object.keys(state.responses).length ? "" : "disabled"}>Export practice report</button><dialog id="fm-attempt-dialog"><div class="fm-dialog-heading"><div><small>Saved attempt</small><h2>Recreated practice</h2></div><button aria-label="Close" data-close-attempt>×</button></div><div id="fm-attempt-body"></div></dialog>${pager(item)}`;
  }
  function attemptHtml(attempt) {
    const response = attempt.response || {};
    return `<article class="fm-recreated"><p>${escapeHtml(attempt.sectionTitle)}</p><h3>${escapeHtml(attempt.activityTitle)}</h3><dl>${Object.entries(response).filter(([key]) => !key.startsWith("_")).map(([key, value]) => `<div><dt>${escapeHtml(key)}</dt><dd>${escapeHtml(value)}</dd></div>`).join("")}</dl><strong>${attempt.passed ? "Successful" : "Needs another look"}</strong></article>`;
  }
  function evidenceHtml(student, className) {
    const responses = Object.entries(state.responses).filter(([, value]) => value.saved).map(([id, response]) => `<section><h2>${escapeHtml(config.sections.find((item) => item.id === id)?.title || id)}</h2>${Object.entries(response).filter(([key]) => key !== "saved").map(([key, value]) => `<p><strong>${escapeHtml(key)}:</strong> ${escapeHtml(value)}</p>`).join("")}</section>`).join("");
    const attempts = state.attempts.map((attempt) => `<section>${attemptHtml(attempt)}</section>`).join("");
    return `<!doctype html><html lang="en"><meta charset="utf-8"><title>${escapeHtml(config.title)} practice report</title><style>body{font:17px Arial,sans-serif;max-width:900px;margin:40px auto;padding:0 24px;color:#102f40}h1,h2,h3{color:#123f58}header,section{margin:0 0 26px;padding:0 0 20px;border-bottom:2px solid #b9c9d0}dl div{display:grid;grid-template-columns:180px 1fr;gap:14px;padding:8px 0}dt{font-weight:bold}dd{margin:0}</style><header><h1>${escapeHtml(config.title)}</h1><p>${escapeHtml(config.id)} v${escapeHtml(config.version)}</p><p><strong>Student:</strong> ${escapeHtml(student)} · <strong>Class:</strong> ${escapeHtml(className)}</p><p><strong>Exported:</strong> ${new Date().toLocaleString()}</p><p>This report records formative practice. It is not a formal grade.</p></header>${responses}<h2>Attempts</h2>${attempts || "<p>No attempts saved.</p>"}</html>`;
  }
  function downloadReport(student, className) {
    const blob = new Blob([evidenceHtml(student, className)], { type: "text/html" });
    const link = document.createElement("a"); link.href = URL.createObjectURL(blob); link.download = `${config.slug}-practice-${className}.html`; link.click(); setTimeout(() => URL.revokeObjectURL(link.href), 1000);
  }
  function toast(message) { const el = document.querySelector("#fm-toast"); el.textContent = message; el.classList.add("show"); setTimeout(() => el.classList.remove("show"), 1800); }
  function render({ focus = false } = {}) {
    const item = section(); if (!state.visited.includes(item.id)) state.visited.push(item.id); save();
    const renderer = item.kind === "choice" ? choicePage : item.kind === "form" ? formPage : item.kind === "sensor" ? sensorPage : item.kind === "review" ? reviewPage : lessonPage;
    document.querySelector("#fm-main").innerHTML = renderer(item);
    document.querySelector(".fm-menu nav").innerHTML = nav(); bind(item);
    document.querySelector(".fm-history").innerHTML = historySummary();
    if (focus) { document.querySelector("#fm-main").focus({ preventScroll: true }); scrollTo({ top: 0, behavior: "smooth" }); }
  }
  function bind(item) {
    document.querySelector("#fm-choice-form")?.addEventListener("submit", (event) => {
      event.preventDefault(); const data = new FormData(event.currentTarget); const activityIndex = Number(data.get("activity")); const activity = item.items[activityIndex]; const answer = Number(data.get("answer")); const passed = answer === activity.answer;
      const response = { checked: true, passed, answer, activity: activityIndex };
      state.responses[item.id] = response; state.attempts.push({ id: uid(), at: new Date().toISOString(), sectionId: item.id, sectionTitle: item.title, activityTitle: activity.title, passed, response: { selected: activity.options[answer] || "No answer", expectedSkill: activity.skill } }); save(); render(); toast(passed ? "Practice saved." : "Attempt saved. Read the hint and try again.");
    });
    document.querySelector("[data-next-practice]")?.addEventListener("click", () => { delete state.responses[item.id]; save(); render({ focus: true }); });
    document.querySelector("#fm-record-form")?.addEventListener("submit", (event) => { event.preventDefault(); const response = Object.fromEntries(new FormData(event.currentTarget).entries()); state.responses[item.id] = { ...response, saved: true }; state.attempts.push({ id: uid(), at: new Date().toISOString(), sectionId: item.id, sectionTitle: item.title, activityTitle: item.prompt, passed: true, response }); save(); render(); toast("Work saved."); });
    const sensorForm = document.querySelector("#fm-sensor-form");
    if (sensorForm) {
      const update = () => { const light = Number(sensorForm.elements.light.value); const threshold = Number(sensorForm.elements.threshold.value); const output = light < threshold ? item.lowOutput : item.highOutput; document.querySelector("#fm-light-value").textContent = light; document.querySelector("#fm-led-grid").innerHTML = renderIcon(output.icon); document.querySelector("#fm-sensor-output").textContent = output.label; };
      sensorForm.addEventListener("input", update); sensorForm.addEventListener("submit", (event) => { event.preventDefault(); const light = Number(sensorForm.elements.light.value); const threshold = Number(sensorForm.elements.threshold.value); const output = light < threshold ? item.lowOutput : item.highOutput; const response = { light, threshold, output: output.label, saved: true }; state.responses[item.id] = response; state.attempts.push({ id: uid(), at: new Date().toISOString(), sectionId: item.id, sectionTitle: item.title, activityTitle: "Sensor threshold test", passed: true, response }); save(); render(); toast("Sensor test saved."); });
    }
    document.querySelectorAll("[data-attempt]").forEach((button) => button.addEventListener("click", () => { const attempt = state.attempts.find((entry) => entry.id === button.dataset.attempt); document.querySelector("#fm-attempt-body").innerHTML = attemptHtml(attempt); document.querySelector("#fm-attempt-dialog").showModal(); }));
    document.querySelector("[data-close-attempt]")?.addEventListener("click", () => document.querySelector("#fm-attempt-dialog").close());
    document.querySelector("#fm-open-export")?.addEventListener("click", () => document.querySelector("#fm-export-dialog").showModal());
  }

  document.body.innerHTML = shell();
  document.querySelector("#fm-reset").addEventListener("click", () => { if (!confirm("Reset all saved practice on this device?")) return; localStorage.removeItem(config.storageKey); state = clone(defaultState); render({ focus: true }); toast("Practice reset."); });
  document.querySelector("#fm-export-form").addEventListener("submit", (event) => { event.preventDefault(); const data = new FormData(event.currentTarget); downloadReport(data.get("student"), data.get("className")); document.querySelector("#fm-export-dialog").close(); toast("Report downloaded."); });
  addEventListener("hashchange", () => { activeId = route(); render({ focus: true }); });
  render();
}
