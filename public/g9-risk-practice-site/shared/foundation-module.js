
import { practiceCheckSpecs } from "./t3-practice.js";
import { checkChoice, foundationEvidence, foundationPdfReport } from "./foundation-evidence.js";
import { downloadStudentPdf } from "./student-pdf.js";
import { selectClassRoute } from "./class-routes.js";

const clone = (value) => JSON.parse(JSON.stringify(value));
const escapeHtml = (value = "") => String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
const uid = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

export function mountFoundationModule(config) {
  config = selectClassRoute(config, new URLSearchParams(location.search).get("class"));
  config.sections = config.sections.map(section=>({...section,inlineChecks:practiceCheckSpecs(section.html)}));
  const assignedRoute = config.assignedRoute;
  const gradeLabel = config.gradeLabel || "Grade 6 Technology";
  const classes = config.classes || ["6A", "6B", "6C"];
  const defaultState = { attempts: [], responses: {}, visited: [config.sections[0].id], identity: {firstName:"",lastName:"",grade:""}, identityStarted:false, choiceDrafts:{}, choicePositions:{}, formPositions:{}, inlineAnswers:{} };
  let storageFailed = false;
  let state = load();
  let activeId = route();
  let editingIdentity = !state.identityStarted;
  for(const section of config.sections)for(const check of section.inlineChecks){if(state.inlineAnswers[check.key]===undefined)try{state.inlineAnswers[check.key]=localStorage.getItem(check.key) || "";}catch{}}

  function load() {
    const record=value=>value && typeof value==='object' && !Array.isArray(value)?value:{};
    try {
      const saved = JSON.parse(localStorage.getItem(config.storageKey) || "null");
      return { ...clone(defaultState), ...saved, attempts: Array.isArray(saved?.attempts) ? saved.attempts.filter(a=>a && typeof a==='object') : [], responses: saved?.responses && typeof saved.responses==='object' ? saved.responses : {}, visited: Array.isArray(saved?.visited) ? saved.visited : defaultState.visited, identity: Object.fromEntries(['firstName','lastName','grade'].map(key=>[key,typeof saved?.identity?.[key]==='string'?saved.identity[key].slice(0,70):''])), choiceDrafts:record(saved?.choiceDrafts), choicePositions:record(saved?.choicePositions), formPositions:record(saved?.formPositions), inlineAnswers:record(saved?.inlineAnswers) };
    } catch { storageFailed = true; return clone(defaultState); }
  }
  function save() { try { localStorage.setItem(config.storageKey, JSON.stringify(state)); } catch { storageFailed = true; } const warning=document.querySelector("#fm-storage-warning"); if(warning) warning.textContent=storageFailed?"This browser cannot save your work. Keep this tab open and download your answers.":""; }
  function route() {
    const id = location.hash.replace(/^#/, "");
    const targetIndex = config.sections.findIndex((section) => section.id === id);
    return targetIndex >= 0 ? id : config.sections[0].id;
  }
  function section() { return config.sections.find((item) => item.id === activeId) || config.sections[0]; }
  function passedCount(sectionId) { return state.attempts.filter((attempt) => attempt.sectionId === sectionId && attempt.passed).length; }
  function status(sectionId) {
    if (state.attempts.some((attempt) => attempt.sectionId === sectionId && attempt.passed) || state.responses[sectionId]?.saved) return "done";
    return state.visited.includes(sectionId) ? "started" : "new";
  }
  function nav() {
    return config.sections.map((item,index) => `<a href="#${item.id}" class="fm-nav-link ${item.id === activeId ? "is-active" : ""}" ${item.id === activeId ? 'aria-current="page"' : ""}>${index+1}. ${escapeHtml(item.short || item.title)}</a>`).join("");
  }
  function studentLabel() {
    return `<span><strong>${escapeHtml([state.identity.firstName,state.identity.lastName].filter(Boolean).join(' ') || 'Your name')}</strong><small>${escapeHtml(state.identity.grade ? `Grade ${state.identity.grade}` : 'Your grade')}</small></span>`;
  }
  function shell() {
    const title = escapeHtml(assignedRoute?.title || config.shortTitle || config.title);
    const branding = config.layout === 'clean-step'
      ? `<div class="fm-brand-title"><small>${escapeHtml(config.subject || 'Technology')}</small><strong class="fm-activity-title">${title}</strong></div>`
      : `<strong class="fm-activity-title">${title}</strong>`;
    return `<div class="fm-shell ${config.layout === 'clean-step' ? 'fm-clean-step' : ''}"><header class="fm-topbar">${branding}<div class="fm-tools"><div class="fm-student"><span id="fm-student-label">${studentLabel()}</span><button id="fm-edit-identity" class="fm-edit" aria-label="Edit your name and grade" title="Edit your name and grade"><svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="m16 3 5 5-12 12-6 1 1-6Z"/><path d="m14 5 5 5"/></svg></button></div><button id="fm-download" class="fm-button primary">Download your answers</button><details class="fm-menu"><summary>Steps</summary><nav aria-label="Activity steps">${nav()}</nav></details></div></header><p id="fm-storage-warning" role="status"></p><main id="fm-main" tabindex="-1"></main><footer class="fm-footer"><a href="${escapeHtml(assignedRoute?.fallback || './printable-fallback.html')}" target="_blank">Paper version</a></footer></div><div id="fm-toast" class="fm-toast" role="status" aria-live="polite"></div>`;
  }
  function identityPage() {
    return `<h1>What is your name?</h1><form id="fm-identity-form">${[['firstName','First name','given-name'],['lastName','Last name','family-name'],['grade','Grade','off']].map(([key,label,autocomplete])=>`<label class="fm-field">${label}<input name="${key}" value="${escapeHtml(state.identity[key])}" autocomplete="${autocomplete}" maxlength="70"></label>`).join('')}<button class="fm-button primary">Continue</button></form>`;
  }
  function hero(item) {
    const index = config.sections.findIndex((entry) => entry.id === item.id);
    const progress = `${config.layout === 'clean-step' ? `${escapeHtml(assignedRoute?.title || config.title)} · ` : ''}Step ${index + 1} of ${config.sections.length}`;
    return `<header class="fm-hero"><p>${progress}</p><h1>${item.title}</h1>${item.summary ? `<div>${item.summary}</div>` : ""}</header>`;
  }
  function pager(item) {
    const index = config.sections.findIndex((entry) => entry.id === item.id);
    const previous = config.sections[index - 1]; const next = config.sections[index + 1];
    return `<nav class="fm-pager" aria-label="Lesson navigation">${previous ? `<a href="#${previous.id}">${config.layout === 'clean-step' ? '← Previous step' : `← ${previous.short}`}</a>` : "<span></span>"}${next ? `<a class="next" href="#${next.id}">${config.layout === 'clean-step' ? 'Next step' : `${next.short} →`}</a>` : ""}</nav>`;
  }
  function block(label, title, html, className = "") { return `<section class="fm-block ${className}"><p class="fm-label">${label}</p>${title ? `<h2>${title}</h2>` : ''}${html}</section>`; }
  function practiceHeader(item, position) {
    return `<section class="fm-set" aria-label="Practice set, activity ${position} of ${item.items.length}"><div><span>Practice set</span><strong>Activity ${position} of ${item.items.length}</strong></div><ol>${item.items.map((_, index) => `<li class="${index + 1 < position ? "done" : index + 1 === position ? "current" : ""}">${index + 1}</li>`).join("")}</ol></section>`;
  }
  function lessonPage(item) { return `${hero(item)}${item.html}${pager(item)}`; }
  function choicePage(item) {
    const priorIndex = state.choicePositions[item.id] ?? (state.responses[item.id]?.activity ?? (passedCount(item.id) % item.items.length));
    const shownIndex = Number.isInteger(priorIndex) && priorIndex>=0 && priorIndex<item.items.length ? priorIndex : 0;
    const activity = item.items[shownIndex];
    const saved = state.responses[item.id] || {};
    const answer = state.choiceDrafts[`${item.id}:${shownIndex}`] ?? saved.answer;
    const choices = activity.options.map((option,index)=>`<label class="fm-choice"><input type="radio" name="answer" value="${index}" ${String(answer)===String(index)?'checked':''}><span><b aria-hidden="true">${index+1}</b>${escapeHtml(option)}</span></label>`).join('');
    const feedback = saved.checked ? `<div class="fm-feedback ${saved.passed?'success':'retry'}" role="status">${saved.passed?'Correct.':escapeHtml(activity.retry || 'Look at the example and try again.')}</div>` : '';
    const count = config.layout === 'clean-step' && item.items.length === 1 ? '' : `<p>Question ${shownIndex+1} of ${item.items.length}</p>`;
    const questionNav = config.layout === 'clean-step' && item.items.length === 1 ? '' : `<nav class="fm-pager" aria-label="Question navigation">${shownIndex?`<button class="fm-button quiet" data-choice-position="${shownIndex-1}">Previous question</button>`:'<span></span>'}${shownIndex<item.items.length-1?`<button class="fm-button quiet" data-choice-position="${shownIndex+1}">Next question</button>`:''}</nav>`;
    return `${hero(item)}${count}${block('',config.layout === 'clean-step' && item.items.length === 1 ? '' : activity.title,`${activity.context ? `<div class="fm-context"><p><strong>Context.</strong> ${escapeHtml(activity.context)}</p></div>` : ''}${activity.visual || ''}<p class="fm-question">${activity.question}</p><form id="fm-choice-form"><input type="hidden" name="activity" value="${shownIndex}"><div class="fm-choices">${choices}</div><button class="fm-button primary">Check</button></form>${feedback}${questionNav}`)}${pager(item)}`;
  }
  function formPage(item) {
    const saved = state.responses[item.responseSource || item.id] || {};
    const position = Math.max(0, Math.min(Number.isInteger(state.formPositions[item.id]) ? state.formPositions[item.id] : 0,item.fields.length-1));
    const field = item.fields[position];
    const input=field.type==='textarea'?`<textarea name="${field.name}" rows="${field.rows || 4}">${escapeHtml(saved[field.name] || '')}</textarea>`:`<input name="${field.name}" value="${escapeHtml(saved[field.name] ?? '')}" type="${field.type || 'text'}" ${field.min!==undefined?`min="${field.min}"`:''}>`;
    const count = config.layout === 'clean-step' && item.fields.length === 1 ? '' : `<p>Part ${position+1} of ${item.fields.length}</p>`;
    const answerNav = config.layout === 'clean-step' && item.fields.length === 1 ? '' : `<nav class="fm-pager" aria-label="Answer navigation">${position?`<button class="fm-button quiet" data-form-position="${position-1}">Previous part</button>`:'<span></span>'}${position<item.fields.length-1?`<button class="fm-button primary" data-form-position="${position+1}">Next part</button>`:''}</nav>`;
    const fieldContext = field.context ? `<div class="fm-context"><p><strong>Context.</strong> ${escapeHtml(field.context)}</p></div>` : '';
    return `${hero(item)}${position===0?item.intro || '':''}${fieldContext}<form id="fm-record-form" class="fm-record-form">${count}<label class="fm-field"><span>${field.label}</span>${input}<small>${field.help || ''}</small></label></form>${answerNav}${pager(item)}`;
  }
  function sensorPage(item) {
    const stored = state.responses[item.id] || {};
    const bounded=(value,fallback,min,max)=>Number.isFinite(Number(value))?Math.min(max,Math.max(min,Number(value))):fallback;
    const saved={...stored,light:bounded(stored.light ?? 80,80,0,255),threshold:bounded(stored.threshold ?? 100,100,1,254)};
    const output = Number(saved.light) < Number(saved.threshold) ? item.lowOutput : item.highOutput;
    return `${hero(item)}${block("Test", "Move the light value across the threshold", `<div class="fm-sensor-lab"><div class="fm-microbit" aria-label="micro:bit display"><div class="fm-led-grid" id="fm-led-grid">${renderIcon(output.icon)}</div><strong id="fm-sensor-output">${output.label}</strong></div><form id="fm-sensor-form"><label class="fm-field"><span>Light level: <output id="fm-light-value">${saved.light}</output></span><input name="light" type="range" min="0" max="255" value="${saved.light}"></label><label class="fm-field"><span>Threshold</span><input name="threshold" type="number" min="1" max="254" value="${saved.threshold}" required></label><p class="fm-rule">If light level is below the threshold, show the night icon. Otherwise, clear the display.</p><button class="fm-button primary large">Save this sensor test</button></form>${saved.saved ? '<div class="fm-feedback success"><strong>Test saved.</strong><span>Your light value, threshold, and output are in the report.</span></div>' : ""}</div>`)}${pager(item)}`;
  }
  function renderIcon(pattern) {
    const active = new Set(pattern || []);
    return Array.from({ length: 25 }, (_, index) => `<i class="${active.has(index) ? "on" : ""}"></i>`).join("");
  }
  function reviewPage(item) {
    const report=foundationEvidence(config,state);
    const body=report.slice(report.indexOf('<section>'),report.lastIndexOf('</html>'));
    return `${hero(item)}${item.summary || ''}${report.includes('<section>') ? body : '<p>No web answers entered.</p>'}${pager(item)}`;
  }
  async function downloadReport(button) {
    await downloadStudentPdf(foundationPdfReport(config, state), `${config.slug}-answers.pdf`, button, toast);
  }
  function toast(message) { const el = document.querySelector("#fm-toast"); el.textContent = message; el.classList.add("show"); setTimeout(() => el.classList.remove("show"), 1800); }
  function render({ focus = false } = {}) {
    const notice=document.querySelector("#fm-toast");if(notice)notice.textContent="";
    const item = section(); if (!state.visited.includes(item.id)) state.visited.push(item.id); save();
    const renderer = item.kind === "choice" ? choicePage : item.kind === "form" ? formPage : item.kind === "sensor" ? sensorPage : item.kind === "review" ? reviewPage : lessonPage;
    const launch = assignedRoute && config.layout !== "clean-step" && item.id === config.sections[0].id ? `<p class="fm-label">${escapeHtml(assignedRoute.title)}</p>${assignedRoute.assignmentStatus === "optional-unassigned" ? `<p class="fm-block">${escapeHtml(assignedRoute.instructions)}</p>` : ""}` : "";
    document.querySelector("#fm-main").innerHTML = editingIdentity ? identityPage() : launch + renderer(item);
    document.querySelector(".fm-menu nav").innerHTML = nav(); bind(item);
    document.querySelector("#fm-student-label").innerHTML = studentLabel();
    save();
    if (focus) { document.querySelector("#fm-main").focus({ preventScroll: true }); scrollTo({ top: 0, behavior: "smooth" }); }
  }
  function bind(item) {
    const identityForm=document.querySelector('#fm-identity-form');
    const captureIdentity=()=>{state.identity=Object.fromEntries(new FormData(identityForm));save();document.querySelector('#fm-student-label').innerHTML=studentLabel();};
    identityForm?.addEventListener('input',captureIdentity);
    identityForm?.addEventListener('submit',event=>{event.preventDefault();captureIdentity();state.identityStarted=true;editingIdentity=false;save();render({focus:true});});
    const choiceForm=document.querySelector('#fm-choice-form');
    choiceForm?.addEventListener('change',()=>{const data=new FormData(choiceForm),index=Number(data.get('activity'));state.choicePositions[item.id]=index;state.choiceDrafts[`${item.id}:${index}`]=Number(data.get('answer'));state.responses[item.id]={answer:Number(data.get('answer')),activity:index,checked:false};save();document.querySelector('.fm-feedback')?.remove();});
    choiceForm?.addEventListener('submit',event=>{
      event.preventDefault();const data=new FormData(choiceForm),activityIndex=Number(data.get('activity')),activity=item.items[activityIndex];
      const result=checkChoice(data.get('answer'),activity.answer,activity.options.length);
      if(!result.checked){toast(result.message);return;}
      state.choicePositions[item.id]=activityIndex;state.choiceDrafts[`${item.id}:${activityIndex}`]=result.answer;
      state.responses[item.id]={...result,activity:activityIndex};
      state.attempts.push({id:uid(),at:new Date().toISOString(),sectionId:item.id,sectionTitle:item.title,activityTitle:activity.title,activityIndex,passed:result.passed,evaluated:true,response:{selected:activity.options[result.answer]}});save();render();
    });
    document.querySelectorAll('[data-choice-position]').forEach(button=>button.addEventListener('click',()=>{state.choicePositions[item.id]=Number(button.dataset.choicePosition);state.responses[item.id]={activity:state.choicePositions[item.id],checked:false};save();render({focus:true});}));
    document.querySelector('#fm-record-form')?.addEventListener('input',event=>{const key=item.responseSource || item.id;state.responses[key]={...state.responses[key],...Object.fromEntries(new FormData(event.currentTarget)),saved:false};save();});
    document.querySelector('#fm-record-form')?.addEventListener('submit',event=>event.preventDefault());
    document.querySelectorAll('[data-form-position]').forEach(button=>button.addEventListener('click',()=>{state.formPositions[item.id]=Number(button.dataset.formPosition);save();render({focus:true});}));
    const sensorForm = document.querySelector("#fm-sensor-form");
    if (sensorForm) {
      const update = () => { const light = Number(sensorForm.elements.light.value); const threshold = Number(sensorForm.elements.threshold.value); const output = light < threshold ? item.lowOutput : item.highOutput; document.querySelector("#fm-light-value").textContent = light; document.querySelector("#fm-led-grid").innerHTML = renderIcon(output.icon); document.querySelector("#fm-sensor-output").textContent = output.label; };
      sensorForm.addEventListener("input", () => { update(); state.responses[item.id] = {...Object.fromEntries(new FormData(sensorForm)), output:document.querySelector("#fm-sensor-output").textContent};save(); }); sensorForm.addEventListener("submit", (event) => { event.preventDefault(); const light = Number(sensorForm.elements.light.value); const threshold = Number(sensorForm.elements.threshold.value); const output = light < threshold ? item.lowOutput : item.highOutput; const response = { light, threshold, output: output.label, saved: true }; state.responses[item.id] = response; state.attempts.push({ id: uid(), at: new Date().toISOString(), sectionId: item.id, sectionTitle: item.title, activityTitle: "Sensor threshold test", evaluated: false, passed: false, response }); save(); render(); toast("Sensor test saved."); });
    }

  }

  document.addEventListener("formative-check-answer",event=>{if(!event.detail || !config.sections.some(s=>s.inlineChecks.some(c=>c.key===event.detail.key)))return;state.inlineAnswers[event.detail.key]=String(event.detail.value ?? "");save();});
  document.body.innerHTML = shell();
  document.querySelector('#fm-download').addEventListener('click',event=>downloadReport(event.currentTarget));
  document.querySelector('#fm-edit-identity').addEventListener('click',()=>{editingIdentity=true;render({focus:true});});
  addEventListener("hashchange", () => { activeId = route(); document.querySelector('.fm-menu').open=false; render({ focus: true }); });
  render();
}
