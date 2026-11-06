import { riskCases, tableHtml } from '../content.js';

export const priority = {
  id: 'priority', title: 'Choose what to fix first', short: 'Priority', kind: 'form', stage: 'practice',
  intro: `<div class="fm-context"><p><strong>Context.</strong> You have learned to rate risks using probability and impact. Now you will decide which case to fix first. Think about which risk has the highest combination of probability and impact. A risk that is both likely and harmful should usually be fixed before a risk that is only likely or only harmful.</p></div>${tableHtml(riskCases)}<p>Choose one case. Write three short sentences: name the case, use probability and impact facts, and explain how its protection reduces the risk.</p>`,
  fields: [{name:'priority-v1', label:'Which case should be fixed first? Explain your choice in three short sentences.', type:'textarea', rows:7, help:'Sentence frame: I would fix __ first. Probability is __ because __. Impact is __ because __. The protection __ helps because __.'}],
};
