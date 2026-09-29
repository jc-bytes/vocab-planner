export const escapeHTML = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export const checkNumber = (label, answer, hint) => `<t3-check answer="${answer}" hint="${escapeHTML(hint)}"><label>${label}<input inputmode="numeric" autocomplete="off" aria-label="${escapeHTML(label)}"></label></t3-check>`;
export const checkChoice = (label, choices, answer, hint) => `<t3-check answer="${escapeHTML(answer)}" hint="${escapeHTML(hint)}"><label>${label}<select aria-label="${escapeHTML(label)}"><option value="">Choose…</option>${choices.map(c=>`<option>${escapeHTML(c)}</option>`).join('')}</select></label></t3-check>`;
const drafts = new Map();
export function practiceCheckKey(check) {
 const input=check.querySelector('input,select');
 return 't3-practice:v1:'+location.pathname+location.search+':'+(check.closest('.t3-lab')?.querySelector('p')?.textContent||'')+':'+input.getAttribute('aria-label');
}
export function practiceCheckSpecs(html) {
 const template=document.createElement('template');template.innerHTML=html || '';
 return [...template.content.querySelectorAll('t3-check')].map(check=>({key:practiceCheckKey(check),label:check.querySelector('input,select').getAttribute('aria-label')}));
}
class PracticeCheck extends (globalThis.HTMLElement || class {}) {
 connectedCallback(){
  if(this.dataset.ready)return;this.dataset.ready='true';
  const input=this.querySelector('input,select'),key=practiceCheckKey(this);
  if(drafts.has(key))input.value=drafts.get(key);else try{input.value=localStorage.getItem(key)||'';}catch{}
  const button=document.createElement('button');button.type='button';button.textContent='Check';
  const result=document.createElement('p');result.setAttribute('role','status');this.append(button,result);
  const publish=()=>this.dispatchEvent(new CustomEvent('formative-check-answer',{bubbles:true,detail:{key,label:input.getAttribute('aria-label'),value:input.value}}));
  publish();
  button.onclick=()=>{const value=input.value.trim();result.textContent=!value?(input.tagName==='SELECT'?'Choose an answer.':'Enter an answer.'):value===this.getAttribute('answer')?'Correct.':this.getAttribute('hint')||'Try again.';};
  const save=()=>{result.textContent='';drafts.set(key,input.value);publish();try{localStorage.setItem(key,input.value);}catch{result.textContent='This browser cannot save your answer. Download before closing.';}};
  input.addEventListener('input',save);input.addEventListener('change',save);
 }
}
if(typeof customElements!=='undefined' && !customElements.get('t3-check'))customElements.define('t3-check',PracticeCheck);
export function enrich(module, additions){for(const section of module.sections){if(additions[section.id])section.html=additions[section.id]+section.html;}return module;}
