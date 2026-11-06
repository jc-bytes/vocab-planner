import { tableHtml } from './content.js';
import { taskPdf } from './pdf.js';

const escape = value => String(value).replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));

// These patterns turn one authored question into its screen and PDF versions.
// build-printable.mjs reads the resulting screen section for the paper version.
export function exampleStep({id, title, short, explanation, source, action, table, takeaway, context}) {
  return {
    id, title, short, kind:'html', stage:'model', authoring:{table},
    html:`${context ? `<div class="fm-context"><p><strong>Context.</strong> ${escape(context)}</p></div>` : ''}<p>${escape(explanation)}</p><div class="fm-source"><p>${escape(source)}</p></div><p>${escape(action)}</p>${tableHtml(table)}<p>${escape(takeaway)}</p>`,
  };
}

export function guidedSelect({id, title, short, instruction, table, question, options, answer, hint}) {
  return {
    id, title, short, kind: 'html', stage:'guided', authoring:{question, options, answer, table},
    html: `<div class="t3-lab"><p>${escape(instruction)}</p>${tableHtml(table)}<t3-check answer="${escape(answer)}" hint="${escape(hint)}"><label>${escape(question)}<select aria-label="${escape(question)}"><option value="">Choose…</option>${options.map(option=>`<option>${escape(option)}</option>`).join('')}</select></label></t3-check></div>`,
    pdf: taskPdf({prompt: `${instruction} ${question}`, table, label: question, source: {kind:'inline-check', index:0}}),
  };
}

export function choiceStep({id, title, short, activityTitle, table, question, options, answer, hint, stage='practice'}) {
  return {
    id, title, short, kind: 'choice', stage, authoring:{question, options, answer, table},
    items: [{title: activityTitle, visual: tableHtml(table), question, options, answer, retry: hint}],
    pdf: taskPdf({prompt: question, table, label: question, source: {kind:'choice', index:0}}),
  };
}

export function choiceSetStep({id, title, short, table, items, stage='practice'}) {
  return {
    id, title, short, kind: 'choice', stage,
    items: items.map(item => ({
      title: item.title || 'Practice question',
      visual: item.table || table ? tableHtml(item.table || table) : '',
      question: item.question,
      options: item.options,
      answer: item.answer,
      retry: item.hint,
      context: item.context || '',
    })),
  };
}

export function explanationStep({id, title, short, table, question, fieldId, help}) {
  return {
    id, title, short, kind: 'form', stage:'practice', authoring:{question, table}, intro: tableHtml(table),
    fields: [{name: fieldId, label: question, type:'textarea', help}],
    pdf: taskPdf({prompt: question, table, label: question, source: {kind:'field', name:fieldId}}),
  };
}
