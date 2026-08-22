import "./styles.css";
import { GROUPS, MODULE, REPORT_ORDER, REPORT_OUTLINE, RUBRIC_AREAS, SECTIONS } from "./content.js";
import { countWords, runScientificChecks } from "./checks.js";
import {
  SOURCE_TYPES,
  buildReference,
  formatBibliography,
  formatNarrativeCitation,
  formatParentheticalCitation,
  referenceSortKey,
  validateReferenceForm,
} from "./references.js";

const STATUS = {
  "not-started": { label: "Not started", short: "" },
  drafted: { label: "Drafted", short: "D" },
  reviewed: { label: "Peer reviewed", short: "P" },
  revised: { label: "Revised", short: "R" },
};

const icons = {
  menu: '<svg aria-hidden="true" viewBox="0 0 24 24"><path d="M4 7h16M4 12h16M4 17h16"/></svg>',
  close: '<svg aria-hidden="true" viewBox="0 0 24 24"><path d="m6 6 12 12M18 6 6 18"/></svg>',
  doc: '<svg aria-hidden="true" viewBox="0 0 24 24"><path d="M6 3h8l4 4v14H6zM14 3v5h4M9 12h6M9 16h6"/></svg>',
  tool: '<svg aria-hidden="true" viewBox="0 0 24 24"><path d="m14.7 6.3 3-3a4 4 0 0 1-5 5L5.5 15.5a2.1 2.1 0 1 0 3 3l7.2-7.2a4 4 0 0 1 5-5l-3 3z"/></svg>',
  download: '<svg aria-hidden="true" viewBox="0 0 24 24"><path d="M12 3v12m-5-5 5 5 5-5M5 20h14"/></svg>',
  external: '<svg aria-hidden="true" viewBox="0 0 24 24"><path d="M14 5h5v5M19 5l-8 8M18 13v6H5V6h6"/></svg>',
  arrow: '<svg aria-hidden="true" viewBox="0 0 24 24"><path d="m9 18 6-6-6-6"/></svg>',
  check: '<svg aria-hidden="true" viewBox="0 0 24 24"><path d="m5 12 4 4L19 6"/></svg>',
};

const defaultState = {
  groupName: "",
  docUrl: "",
  statuses: Object.fromEntries(SECTIONS.map((section) => [section.id, "not-started"])),
  answers: {},
  references: [],
};

let state = loadState();
let activeId = getRoute();
let harperLinter = null;

function loadState() {
  try {
    const savedValue = localStorage.getItem(MODULE.storageKey)
      || MODULE.legacyStorageKeys?.map((key) => localStorage.getItem(key)).find(Boolean);
    const saved = JSON.parse(savedValue || "null");
    return {
      ...structuredClone(defaultState),
      ...saved,
      statuses: { ...defaultState.statuses, ...(saved?.statuses || {}) },
      answers: { ...(saved?.answers || {}) },
      references: Array.isArray(saved?.references) ? saved.references : [],
    };
  } catch {
    return structuredClone(defaultState);
  }
}

function saveState() {
  localStorage.setItem(MODULE.storageKey, JSON.stringify(state));
}

function getRoute() {
  const id = location.hash.replace(/^#/, "");
  return SECTIONS.some((section) => section.id === id) ? id : SECTIONS[0].id;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function completedCount() {
  return Object.values(state.statuses).filter((value) => value !== "not-started").length;
}

function progressPercent() {
  return Math.round((completedCount() / SECTIONS.length) * 100);
}

function navMarkup() {
  return GROUPS.map((group) => {
    const items = SECTIONS.filter((section) => section.group === group.id)
      .map((section) => {
        const current = section.id === activeId;
        const status = state.statuses[section.id] || "not-started";
        return `<a class="nav-item ${current ? "is-active" : ""}" href="#${section.id}" ${current ? 'aria-current="page"' : ""}>
          <span class="nav-status status-${status}" aria-hidden="true">${STATUS[status].short || (current ? "•" : "")}</span>
          <span>${section.navTitle}</span>
        </a>`;
      }).join("");
    return `<div class="nav-group"><p class="nav-group-label">${group.label}</p>${items}</div>`;
  }).join("");
}

function shellMarkup() {
  return `
    <div class="site-shell">
      <aside class="sidebar" id="sidebar" aria-label="Module sections">
        <div class="brand-block">
          <div class="brand-mark" aria-hidden="true">SR</div>
          <div><p class="brand-kicker">Science writing lab</p><p class="brand-title">Report Workshop</p></div>
          <button class="icon-button sidebar-close" id="close-menu" aria-label="Close section menu">${icons.close}</button>
        </div>
        <div class="progress-card">
          <div class="progress-copy"><span>${completedCount()} of ${SECTIONS.length} started</span><strong>${progressPercent()}%</strong></div>
          <div class="progress-track" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${progressPercent()}" aria-label="Module progress"><span style="width:${progressPercent()}%"></span></div>
          <p>Saved only in this browser.</p>
        </div>
        <nav class="section-nav">${navMarkup()}</nav>
        <div class="sidebar-actions">
          <button class="button button-ghost button-full" data-open="workspace">${icons.doc}<span>Group workspace</span></button>
          <button class="button button-accent button-full" data-open="lab">${icons.tool}<span>Writing Lab</span></button>
        </div>
      </aside>
      <div class="sidebar-scrim" id="sidebar-scrim" hidden></div>
      <div class="main-column">
        <header class="topbar">
          <button class="icon-button menu-button" id="open-menu" aria-label="Open section menu">${icons.menu}</button>
          <div class="topbar-title"><span>${MODULE.id}</span><strong>${MODULE.title}</strong></div>
          <div class="topbar-actions">
            <button class="button button-quiet compact-hide" data-open="roadmap">Report roadmap</button>
            <button class="button button-primary" data-open="workspace">${icons.doc}<span class="compact-hide">${state.docUrl ? "Open group report" : "Connect group report"}</span><span class="compact-show">Report</span></button>
          </div>
        </header>
        <main id="lesson-content" tabindex="-1"></main>
      </div>
    </div>
    <div id="toast" class="toast" role="status" aria-live="polite"></div>
    <dialog id="modal" class="modal"><div id="modal-content"></div></dialog>`;
}

function notesMarkup(notes) {
  return notes.map((note) => `<li class="note note-${note.tone}"><span class="note-icon" aria-hidden="true">${note.tone === "good" ? "✓" : note.tone === "better" ? "→" : note.tone === "safety" ? "!" : "·"}</span><span>${note.text}</span></li>`).join("");
}

function listMarkup(items, ordered = false) {
  const tag = ordered ? "ol" : "ul";
  return `<${tag} class="content-list">${items.map((item) => `<li>${item}</li>`).join("")}</${tag}>`;
}

function practiceMarkup(section) {
  const saved = state.answers[section.id];
  return `<section class="lesson-card practice-card" aria-labelledby="practice-heading">
    <div class="card-heading-row"><span class="section-number">05</span><h2 id="practice-heading">Try it</h2></div>
    <p class="practice-question">${section.practice.question}</p>
    <div class="option-list" role="group" aria-label="Practice choices">
      ${section.practice.options.map((option, index) => {
        const selected = saved?.selected === index;
        const className = saved ? (index === section.practice.answer ? "is-correct" : selected ? "is-incorrect" : "") : "";
        return `<button class="option ${className}" data-answer="${index}" ${saved ? "disabled" : ""}><span>${String.fromCharCode(65 + index)}</span>${option}</button>`;
      }).join("")}
    </div>
    <div class="practice-feedback ${saved ? "is-visible" : ""}" aria-live="polite">
      ${saved ? `<strong>${saved.correct ? "Yes. " : "Take another look. "}</strong>${section.practice.feedback}${!saved.correct ? '<button class="text-button" id="retry-practice">Try again</button>' : ""}` : ""}
    </div>
  </section>`;
}

function safeFormat(formatter, referenceOrReferences) {
  try {
    return formatter(referenceOrReferences);
  } catch {
    return "This entry could not be formatted. Delete it and enter the source again.";
  }
}

function referenceMakerMarkup() {
  const references = [...state.references].sort((a, b) => referenceSortKey(a).localeCompare(referenceSortKey(b)));
  const entries = references.map((reference) => `
    <li class="saved-reference">
      <p>${escapeHtml(safeFormat(formatBibliography, reference))}</p>
      <div class="reference-citations">
        <span><strong>Parenthetical</strong> ${escapeHtml(safeFormat(formatParentheticalCitation, reference))}</span>
        <span><strong>Narrative</strong> ${escapeHtml(formatNarrativeCitation(reference))}</span>
      </div>
      <div class="reference-entry-actions">
        <button class="text-button" data-copy-ref="${escapeHtml(reference.id)}">Copy</button>
        <button class="text-button reference-delete" data-delete-ref="${escapeHtml(reference.id)}">Delete</button>
      </div>
    </li>`).join("");
  return `<section class="lesson-card reference-maker" aria-labelledby="reference-maker-heading">
    <div class="card-heading-row"><span class="section-number">TOOL</span><h2 id="reference-maker-heading">APA reference maker</h2></div>
    <p>Enter information from the original source. Citation.js formats it as APA, but your group must compare the result with the source before copying it to Google Docs.</p>
    <form id="reference-form" novalidate>
      <div class="reference-grid">
        <div class="form-field"><label for="reference-type">Source type</label><select id="reference-type" name="type">${Object.entries(SOURCE_TYPES).map(([value, label]) => `<option value="${value}">${label}</option>`).join("")}</select></div>
        <div class="form-field"><label for="reference-date">Publication date <span>leave blank if none</span></label><input id="reference-date" name="date" inputmode="numeric" placeholder="YYYY-MM-DD" aria-describedby="date-help reference-date-error" /><small id="date-help">A year alone is acceptable when that is all the source provides.</small><p class="field-error" id="reference-date-error" data-ref-error="date" role="alert"></p></div>
        <div class="form-field reference-span"><label for="reference-title">Exact source title</label><input id="reference-title" name="title" autocomplete="off" aria-describedby="reference-title-error" /><p class="field-error" id="reference-title-error" data-ref-error="title" role="alert"></p></div>
        <div class="form-field"><label for="author-kind">Who wrote it?</label><select id="author-kind" name="authorKind"><option value="person">Person or people</option><option value="organization">Organization</option><option value="none">No named author</option></select></div>
        <div class="form-field reference-span" data-author-field="person"><label for="reference-authors">Author name or names</label><input id="reference-authors" name="authors" autocomplete="off" placeholder="Rivera, Ana; Chen, David" aria-describedby="authors-help reference-authors-error" /><small id="authors-help">Write each person as Last name, First name. Separate authors with a semicolon.</small><p class="field-error" id="reference-authors-error" data-ref-error="authors" role="alert"></p></div>
        <div class="form-field reference-span" data-author-field="organization" hidden><label for="reference-organization">Organization name</label><input id="reference-organization" name="organization" autocomplete="organization" placeholder="Food and Agriculture Organization of the United Nations" aria-describedby="reference-organization-error" /><p class="field-error" id="reference-organization-error" data-ref-error="organization" role="alert"></p></div>
        <div class="form-field reference-span" data-type-field="container"><label for="reference-container"><span id="container-label">Website name</span> <span id="container-optional">optional</span></label><input id="reference-container" name="container" autocomplete="off" aria-describedby="reference-container-error" /><p class="field-error" id="reference-container-error" data-ref-error="container" role="alert"></p></div>
        <div class="form-field reference-span" data-type-field="publisher" hidden><label for="reference-publisher">Publisher or issuing organization</label><input id="reference-publisher" name="publisher" autocomplete="organization" aria-describedby="reference-publisher-error" /><p class="field-error" id="reference-publisher-error" data-ref-error="publisher" role="alert"></p></div>
        <div class="journal-fields reference-span" data-type-field="journal" hidden>
          <div class="form-field"><label for="reference-volume">Volume <span>optional</span></label><input id="reference-volume" name="volume" /></div>
          <div class="form-field"><label for="reference-issue">Issue <span>optional</span></label><input id="reference-issue" name="issue" /></div>
          <div class="form-field"><label for="reference-pages">Pages <span>optional</span></label><input id="reference-pages" name="pages" placeholder="12-18" /></div>
        </div>
        <div class="form-field reference-span"><label for="reference-url">Source URL <span id="url-optional"></span></label><input id="reference-url" name="url" inputmode="url" placeholder="https://..." aria-describedby="reference-url-error" /><p class="field-error" id="reference-url-error" data-ref-error="url" role="alert"></p></div>
        <div class="form-field reference-span"><label for="reference-doi">DOI <span>optional</span></label><input id="reference-doi" name="doi" autocomplete="off" placeholder="10.xxxx/xxxxx" /><small>Use the DOI for a journal article when it is available.</small></div>
      </div>
      <div class="reference-preview" aria-live="polite"><span>Live APA preview</span><p id="reference-preview">Start by entering the source title.</p><div id="citation-preview"></div></div>
      <div class="draft-actions"><button class="button button-primary" type="submit">Add to bibliography</button><button class="button button-quiet" type="reset" id="clear-reference">Clear fields</button></div>
    </form>
    <div class="bibliography-heading"><div><h3>Saved bibliography</h3><p>${references.length} ${references.length === 1 ? "source" : "sources"}, saved only in this browser</p></div>${references.length ? '<button class="button button-secondary" id="copy-bibliography">Copy all for Google Docs</button>' : ""}</div>
    ${references.length ? `<ol class="saved-bibliography">${entries}</ol><p class="reference-footnote">After pasting into Google Docs, keep the list alphabetical and apply a 0.5-inch hanging indent. Check every reference against its original source.</p>` : '<div class="empty-bibliography">No sources saved yet. Add each source while it is open so the title, author, and date can be checked.</div>'}
  </section>`;
}

function lessonMarkup(section) {
  const index = SECTIONS.findIndex((item) => item.id === section.id);
  const previous = SECTIONS[index - 1];
  const next = SECTIONS[index + 1];
  const status = state.statuses[section.id] || "not-started";
  return `
    <article class="lesson">
      <div class="lesson-hero">
        <div class="eyebrow-row"><span>${section.code}</span><span>${section.minutes} min</span><span>Foundation track</span></div>
        <p class="hero-kicker">${section.eyebrow}</p>
        <h1>${section.title}</h1>
        <p class="hero-summary">${section.objective}</p>
        <div class="hero-actions">
          <button class="button button-primary" data-open="workspace">${icons.doc}${state.docUrl ? "Open group report" : "Set up group report"}</button>
          <button class="button button-secondary" data-open="lab">${icons.tool}Check a draft</button>
        </div>
      </div>

      <div class="lesson-grid">
        <div class="lesson-flow">
          <section class="lesson-card purpose-card">
            <div class="card-heading-row"><span class="section-number">01</span><h2>What this section does</h2></div>
            <p class="large-copy">${section.purpose}</p>
          </section>

          <section class="lesson-card">
            <div class="card-heading-row"><span class="section-number">02</span><h2>What to include</h2></div>
            ${listMarkup(section.includes)}
          </section>

          <section class="lesson-card">
            <div class="card-heading-row"><span class="section-number">03</span><h2>Write it step by step</h2></div>
            ${listMarkup(section.steps, true)}
          </section>

          <section class="lesson-card example-card">
            <div class="card-heading-row"><span class="section-number">04</span><h2>Inspect an example</h2></div>
            <p class="example-label">${section.example.label}</p>
            <blockquote>${section.example.text}</blockquote>
            <ul class="notes-list">${notesMarkup(section.example.notes)}</ul>
          </section>

          ${section.id === "references" ? referenceMakerMarkup() : ""}

          ${practiceMarkup(section)}

          <section class="lesson-card">
            <div class="card-heading-row"><span class="section-number">06</span><h2>Draft yours</h2></div>
            <p>Use one of these frames only if it helps. Replace every bracketed idea with your group's actual evidence.</p>
            <div class="frame-list">${section.frames.map((frame) => `<button class="writing-frame" data-copy="${escapeHtml(frame)}" title="Copy writing frame"><span>${frame}</span><small>Copy</small></button>`).join("")}</div>
            <div class="draft-actions">
              <button class="button button-primary" data-open="workspace">${icons.doc}${state.docUrl ? "Open group report" : "Connect report"}</button>
              <button class="button button-secondary" data-open="lab">${icons.tool}Check this section</button>
            </div>
          </section>

          <section class="lesson-card caution-card">
            <div class="card-heading-row"><span class="section-number">07</span><h2>Before you continue</h2></div>
            <h3>Common mistakes</h3>
            ${listMarkup(section.mistakes)}
            <div class="rubric-link"><span>Rubric connection</span><p>${section.rubric}</p></div>
          </section>
        </div>

        <aside class="lesson-rail" aria-label="Section controls">
          <div class="rail-card sticky-card">
            <p class="rail-label">Section status</p>
            <label for="section-status">Where is your group now?</label>
            <select id="section-status">
              ${Object.entries(STATUS).map(([value, item]) => `<option value="${value}" ${value === status ? "selected" : ""}>${item.label}</option>`).join("")}
            </select>
            <p class="rail-help">A status records workflow, not proof that the writing is correct.</p>
            <hr />
            <p class="rail-label">Quick tools</p>
            <button class="rail-action" data-open="lab">${icons.tool}<span><strong>Writing Lab</strong><small>Grammar and report checks</small></span>${icons.arrow}</button>
            <button class="rail-action" data-open="roadmap">${icons.doc}<span><strong>Report roadmap</strong><small>Finished order and rubric</small></span>${icons.arrow}</button>
          </div>
        </aside>
      </div>

      <nav class="lesson-pager" aria-label="Lesson navigation">
        ${previous ? `<a href="#${previous.id}" class="pager-link pager-previous"><small>Previous</small><strong>← ${previous.navTitle}</strong></a>` : "<span></span>"}
        ${next ? `<a href="#${next.id}" class="pager-link pager-next"><small>Next</small><strong>${next.navTitle} →</strong></a>` : `<button class="button button-primary" data-export>${icons.download}Export progress</button>`}
      </nav>
    </article>`;
}

function renderLesson({ focus = false } = {}) {
  const section = SECTIONS.find((item) => item.id === activeId) || SECTIONS[0];
  document.querySelector("#lesson-content").innerHTML = lessonMarkup(section);
  document.querySelector(".section-nav").innerHTML = navMarkup();
  refreshProgress();
  bindLessonEvents(section);
  if (focus) {
    document.querySelector("#lesson-content").focus({ preventScroll: true });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
}

function refreshProgress() {
  const card = document.querySelector(".progress-card");
  if (!card) return;
  card.querySelector(".progress-copy span").textContent = `${completedCount()} of ${SECTIONS.length} started`;
  card.querySelector(".progress-copy strong").textContent = `${progressPercent()}%`;
  const bar = card.querySelector(".progress-track");
  bar.setAttribute("aria-valuenow", progressPercent());
  bar.querySelector("span").style.width = `${progressPercent()}%`;
}

function bindLessonEvents(section) {
  document.querySelector("#section-status")?.addEventListener("change", (event) => {
    state.statuses[section.id] = event.target.value;
    saveState();
    renderLesson();
    showToast(`Status changed to ${STATUS[event.target.value].label}.`);
  });

  document.querySelectorAll("[data-answer]").forEach((button) => {
    button.addEventListener("click", () => {
      const selected = Number(button.dataset.answer);
      state.answers[section.id] = { selected, correct: selected === section.practice.answer };
      saveState();
      renderLesson();
    });
  });

  document.querySelector("#retry-practice")?.addEventListener("click", () => {
    delete state.answers[section.id];
    saveState();
    renderLesson();
  });

  document.querySelectorAll("[data-copy]").forEach((button) => button.addEventListener("click", async () => {
    await copyText(button.dataset.copy);
    showToast("Writing frame copied.");
  }));

  document.querySelector("[data-export]")?.addEventListener("click", exportProgress);
  if (section.id === "references") bindReferenceMaker();
  bindOpenButtons();
}

function getReferenceFormValues() {
  return Object.fromEntries(new FormData(document.querySelector("#reference-form")).entries());
}

function updateReferenceFields() {
  const type = document.querySelector("#reference-type").value;
  const authorKind = document.querySelector("#author-kind").value;
  document.querySelectorAll("[data-author-field]").forEach((field) => { field.hidden = field.dataset.authorField !== authorKind; });
  document.querySelector('[data-type-field="publisher"]').hidden = !["book", "report"].includes(type);
  document.querySelector('[data-type-field="journal"]').hidden = type !== "article-journal";
  const container = document.querySelector('[data-type-field="container"]');
  container.hidden = ["book", "report"].includes(type);
  document.querySelector("#container-label").textContent = type === "article-journal" ? "Journal name" : type === "motion_picture" ? "Video platform" : "Website name";
  document.querySelector("#container-optional").textContent = type === "article-journal" ? "" : "optional";
  document.querySelector("#url-optional").textContent = ["webpage", "motion_picture"].includes(type) ? "" : "optional";
}

function updateReferencePreview() {
  const values = getReferenceFormValues();
  const preview = document.querySelector("#reference-preview");
  const citations = document.querySelector("#citation-preview");
  if (!values.title?.trim()) {
    preview.textContent = "Start by entering the source title.";
    citations.textContent = "";
    return;
  }
  try {
    const reference = buildReference(values, "preview");
    preview.textContent = formatBibliography(reference);
    citations.innerHTML = `<span><strong>Parenthetical:</strong> ${escapeHtml(formatParentheticalCitation(reference))}</span><span><strong>Narrative:</strong> ${escapeHtml(formatNarrativeCitation(reference))}</span>`;
  } catch {
    preview.textContent = "Add or correct the source information to see the APA preview.";
    citations.textContent = "";
  }
}

function bindReferenceMaker() {
  const form = document.querySelector("#reference-form");
  updateReferenceFields();
  updateReferencePreview();
  form.addEventListener("input", () => {
    document.querySelectorAll("[data-ref-error]").forEach((item) => { item.textContent = ""; });
    updateReferenceFields();
    updateReferencePreview();
  });
  form.addEventListener("reset", () => setTimeout(() => {
    updateReferenceFields();
    updateReferencePreview();
    document.querySelector("#reference-type").focus();
  }));
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const values = getReferenceFormValues();
    const errors = validateReferenceForm(values);
    document.querySelectorAll("[data-ref-error]").forEach((item) => { item.textContent = errors[item.dataset.refError] || ""; });
    if (Object.keys(errors).length) {
      const firstField = {
        title: "#reference-title",
        authors: "#reference-authors",
        organization: "#reference-organization",
        container: "#reference-container",
        publisher: "#reference-publisher",
        date: "#reference-date",
        url: "#reference-url",
      }[Object.keys(errors)[0]];
      document.querySelector(firstField)?.focus();
      return;
    }
    state.references.push(buildReference(values));
    saveState();
    renderLesson();
    showToast("Source added to the bibliography.");
    document.querySelector("#reference-maker-heading")?.scrollIntoView({ block: "start" });
  });
  document.querySelectorAll("[data-delete-ref]").forEach((button) => button.addEventListener("click", () => {
    state.references = state.references.filter((reference) => reference.id !== button.dataset.deleteRef);
    saveState();
    renderLesson();
    showToast("Source deleted from this browser.");
  }));
  document.querySelectorAll("[data-copy-ref]").forEach((button) => button.addEventListener("click", async () => {
    const reference = state.references.find((item) => item.id === button.dataset.copyRef);
    if (!reference) return;
    await copyText(formatBibliography(reference));
    showToast("APA reference copied.");
  }));
  document.querySelector("#copy-bibliography")?.addEventListener("click", async () => {
    await copyText(formatBibliography(state.references));
    showToast("Alphabetized bibliography copied for Google Docs.");
  });
}

function bindOpenButtons() {
  document.querySelectorAll("[data-open]").forEach((button) => {
    button.addEventListener("click", () => openModal(button.dataset.open));
  });
}

function openModal(type) {
  const dialog = document.querySelector("#modal");
  const content = document.querySelector("#modal-content");
  content.innerHTML = type === "workspace" ? workspaceMarkup() : type === "lab" ? labMarkup() : roadmapMarkup();
  bindModalEvents(type);
  dialog.showModal();
  content.querySelector("button, input, select")?.focus();
}

function modalHeader(kicker, title, description = "") {
  return `<div class="modal-header"><div><p>${kicker}</p><h2>${title}</h2>${description ? `<span>${description}</span>` : ""}</div><button class="icon-button" data-close aria-label="Close dialog">${icons.close}</button></div>`;
}

function workspaceMarkup() {
  return `${modalHeader("Group workspace", "Keep one report, one source of truth", "The module stores this information only in the current browser.")}
    <div class="modal-body workspace-body">
      <div class="form-field"><label for="group-name">Group name <span>optional</span></label><input id="group-name" maxlength="60" value="${escapeHtml(state.groupName)}" placeholder="Example: Team Mangrove" /></div>
      <div class="form-field"><label for="doc-url">Shared Google Doc link</label><input id="doc-url" inputmode="url" value="${escapeHtml(state.docUrl)}" placeholder="https://docs.google.com/document/d/..." aria-describedby="doc-help doc-error" /><small id="doc-help">Use one document shared with your group and teacher.</small><p id="doc-error" class="field-error" role="alert"></p></div>
      <div class="workspace-actions">
        <button class="button button-primary" id="save-workspace">Save group workspace</button>
        ${state.docUrl ? `<a class="button button-secondary" href="${escapeHtml(state.docUrl)}" target="_blank" rel="noopener">${icons.external}Open saved report</a>` : `<a class="button button-secondary" href="https://docs.new" target="_blank" rel="noopener">${icons.external}Start a blank Google Doc</a>`}
      </div>
      <div class="outline-panel"><div><h3>Need the report structure?</h3><p>Copy the official section outline, paste it into the group Doc, then apply Google Docs heading styles.</p></div><div class="outline-actions"><button class="button button-quiet" id="copy-outline">Copy report outline</button><a class="button button-quiet" href="/offline-guide.html" target="_blank" rel="noopener">Printable offline guide</a></div></div>
      <details class="privacy-note"><summary>What this site saves</summary><p>The group name, document link, section statuses, practice results, and bibliography entries stay in local browser storage. Draft text pasted into the Writing Lab is not saved. Progress does not follow students to another device.</p></details>
      <button class="text-button reset-button" id="reset-progress">Reset saved group and progress data</button>
    </div>`;
}

function labMarkup() {
  const options = [...SECTIONS.filter((section) => section.id !== "start").map((section) => [section.id, section.navTitle]), ["full-report", "Full report structure"]];
  return `${modalHeader("Writing Lab", "Check the draft, then make the decision", "Grammar suggestions and structural checks are feedback, not a grade.")}
    <div class="modal-body lab-body">
      <div class="lab-controls">
        <div class="form-field"><label for="lab-section">Section being checked</label><select id="lab-section">${options.map(([id, label]) => `<option value="${id}" ${id === activeId ? "selected" : ""}>${label}</option>`).join("")}</select></div>
        <div class="privacy-chip"><span aria-hidden="true">●</span> Processed in this browser</div>
      </div>
      <div class="form-field"><label for="lab-text">Paste the current section from Google Docs</label><textarea id="lab-text" rows="12" placeholder="Paste a draft here. This text is not saved by the module."></textarea><div class="textarea-meta"><span id="lab-count">0 words</span><span>Do not paste student names or private participant data.</span></div></div>
      <div class="lab-actions"><button class="button button-accent" id="run-checks">${icons.tool}Run writing checks</button><button class="button button-quiet" id="clear-lab">Clear</button></div>
      <div id="lab-status" class="lab-status" aria-live="polite"></div>
      <div id="lab-results" class="lab-results"></div>
      <div class="detector-note"><strong>No AI detector.</strong><p>Authorship is checked through drafts, sources, Google Docs history, peer comments, and the group's explanation. A detector percentage is not proof.</p></div>
    </div>`;
}

function roadmapMarkup() {
  return `${modalHeader("Report roadmap", "Write in one order, submit in another", "Start with the investigation. Finish the title, abstract, and table of contents near the end.")}
    <div class="modal-body roadmap-body">
      <section><h3>Finished report order</h3><ol class="report-order">${REPORT_ORDER.map((item, index) => `<li><span>${String(index + 1).padStart(2, "0")}</span>${item}</li>`).join("")}</ol></section>
      <section><h3>Report-specific rubric</h3><div class="rubric-table" role="table" aria-label="Report rubric point allocation">${RUBRIC_AREAS.map((area) => `<div role="row"><span role="cell">${area.label}</span><strong role="cell">${area.points}</strong></div>`).join("")}<div class="rubric-total" role="row"><span role="cell">Total</span><strong role="cell">100</strong></div></div><p class="modal-note">This adapts the fair's project-evaluation priorities for the written report. Poster and interview points remain outside this writing module.</p></section>
    </div>`;
}

function bindModalEvents(type) {
  const dialog = document.querySelector("#modal");
  document.querySelector("[data-close]").addEventListener("click", () => dialog.close());

  if (type === "workspace") {
    document.querySelector("#copy-outline").addEventListener("click", async () => {
      await copyText(REPORT_OUTLINE);
      showToast("Report outline copied.");
    });
    document.querySelector("#save-workspace").addEventListener("click", () => {
      const name = document.querySelector("#group-name").value.trim();
      const url = document.querySelector("#doc-url").value.trim();
      const error = document.querySelector("#doc-error");
      if (url && !/^https:\/\/docs\.google\.com\/document\/d\/[\w-]+/i.test(url)) {
        error.textContent = "Paste a Google Docs document link beginning with https://docs.google.com/document/d/";
        document.querySelector("#doc-url").focus();
        return;
      }
      state.groupName = name;
      state.docUrl = url;
      saveState();
      dialog.close();
      showToast("Group workspace saved in this browser.");
      renderLesson();
    });
    document.querySelector("#reset-progress").addEventListener("click", () => {
      if (!window.confirm("Reset the saved group link, section statuses, practice results, and bibliography on this browser? This cannot be undone.")) return;
      localStorage.removeItem(MODULE.storageKey);
      MODULE.legacyStorageKeys?.forEach((key) => localStorage.removeItem(key));
      state = structuredClone(defaultState);
      dialog.close();
      renderLesson();
      showToast("Local module progress was reset.");
    });
  }

  if (type === "lab") {
    const textarea = document.querySelector("#lab-text");
    const count = document.querySelector("#lab-count");
    textarea.addEventListener("input", () => { count.textContent = `${countWords(textarea.value)} words`; });
    document.querySelector("#clear-lab").addEventListener("click", () => {
      textarea.value = "";
      count.textContent = "0 words";
      document.querySelector("#lab-results").innerHTML = "";
      document.querySelector("#lab-status").textContent = "";
      textarea.focus();
    });
    document.querySelector("#run-checks").addEventListener("click", runWritingLab);
  }
}

async function initHarper() {
  if (harperLinter) return harperLinter;
  const [{ WorkerLinter, Dialect }, { binaryInlined }] = await Promise.all([import("harper.js"), import("harper.js/binaryInlined")]);
  harperLinter = new WorkerLinter({ binary: binaryInlined, dialect: Dialect.American });
  return harperLinter;
}

async function runWritingLab() {
  const text = document.querySelector("#lab-text").value;
  const sectionId = document.querySelector("#lab-section").value;
  const status = document.querySelector("#lab-status");
  const results = document.querySelector("#lab-results");
  const scientific = runScientificChecks(sectionId, text);
  results.innerHTML = `<section class="result-group"><h3>Scientific report checks</h3>${scientific.map(resultCard).join("")}</section>`;
  if (!text.trim()) return;

  status.textContent = "Loading the private grammar checker...";
  try {
    const linter = await initHarper();
    status.textContent = "Checking grammar and spelling...";
    const lints = await linter.lint(text);
    const grammar = lints.slice(0, 25).map((lint) => {
      const span = lint.span();
      const excerpt = text.slice(Math.max(0, span.start - 24), Math.min(text.length, span.end + 24)).replace(/\s+/g, " ");
      const suggestions = lint.suggestions().slice(0, 3).map((suggestion) => suggestion.get_replacement_text()).filter(Boolean);
      return { message: lint.message(), excerpt, suggestions };
    });
    results.insertAdjacentHTML("beforeend", `<section class="result-group"><h3>Grammar and spelling <span>${lints.length}</span></h3>${grammar.length ? grammar.map((item) => `<article class="grammar-result"><p>${escapeHtml(item.message)}</p><small>...${escapeHtml(item.excerpt)}...</small>${item.suggestions.length ? `<div>Try: ${item.suggestions.map((suggestion) => `<code>${escapeHtml(suggestion)}</code>`).join(" ")}</div>` : ""}</article>`).join("") : '<div class="empty-result">Harper found no grammar or spelling suggestions. Read the section aloud and check the science before marking it revised.</div>'}${lints.length > 25 ? `<p class="result-limit">Showing the first 25 of ${lints.length} suggestions.</p>` : ""}</section>`);
    status.textContent = "Check complete. Decide which suggestions improve accuracy and clarity.";
  } catch (error) {
    console.error(error);
    status.textContent = "The grammar checker could not load. The scientific report checks above still work. Try again when the page is online.";
  }
}

function resultCard(item) {
  return `<article class="check-result check-${item.tone}"><span aria-hidden="true">${item.tone === "good" ? "✓" : item.tone === "warn" ? "!" : "i"}</span><div><strong>${item.title}</strong><p>${item.detail}</p></div></article>`;
}

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    const area = document.createElement("textarea");
    area.value = text;
    document.body.append(area);
    area.select();
    document.execCommand("copy");
    area.remove();
  }
}

function exportProgress() {
  const lines = [
    `${MODULE.title} progress record`,
    `${MODULE.id} v${MODULE.version}`,
    `Exported: ${new Date().toLocaleString()}`,
    `Group: ${state.groupName || "Not entered"}`,
    `Group Google Doc: ${state.docUrl || "Not connected"}`,
    "",
    "Section progress",
    ...SECTIONS.map((section) => `${section.code} | ${section.navTitle} | ${STATUS[state.statuses[section.id] || "not-started"].label} | Practice: ${state.answers[section.id]?.correct ? "Correct" : state.answers[section.id] ? "Needs retry" : "Not attempted"}`),
    "",
    "Evidence reminder",
    "This record shows module workflow only. The shared Google Doc contains the group's assessed scientific writing.",
    "Progress is stored only in the browser and does not prove that the report is scientifically correct.",
  ];
  const blob = new Blob([lines.join("\n")], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `${MODULE.id}-${(state.groupName || "group").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "group"}-progress.txt`;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  showToast("Progress record downloaded.");
}

function showToast(message) {
  const toast = document.querySelector("#toast");
  toast.textContent = message;
  toast.classList.add("is-visible");
  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => toast.classList.remove("is-visible"), 2600);
}

function setSidebar(open) {
  document.body.classList.toggle("menu-open", open);
  const scrim = document.querySelector("#sidebar-scrim");
  scrim.hidden = !open;
  document.querySelector("#open-menu").setAttribute("aria-expanded", String(open));
}

function installApp() {
  const app = document.querySelector("#app");
  app.innerHTML = shellMarkup();
  renderLesson();
  bindOpenButtons();

  document.querySelector("#open-menu").addEventListener("click", () => setSidebar(true));
  document.querySelector("#close-menu").addEventListener("click", () => setSidebar(false));
  document.querySelector("#sidebar-scrim").addEventListener("click", () => setSidebar(false));
  document.querySelector("#modal").addEventListener("click", (event) => {
    if (event.target === event.currentTarget) event.currentTarget.close();
  });

  window.addEventListener("hashchange", () => {
    activeId = getRoute();
    setSidebar(false);
    renderLesson({ focus: true });
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && document.body.classList.contains("menu-open")) setSidebar(false);
  });

  if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => {});
}

installApp();
