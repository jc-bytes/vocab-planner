import { riskCases, tableHtml } from '../content.js';

export const priority = {
  id: 'priority', title: 'Choose what to fix first', short: 'Priority', kind: 'form', stage: 'practice',
  intro: `${tableHtml(riskCases)}<p>Choose one case. Write three short sentences: name the case, use probability and impact facts, and explain how its protection reduces the risk.</p>`,
  fields: [{name:'priority-v1', label:'Which case should be fixed first? Explain your choice in three short sentences.', type:'textarea', rows:7, help:'Sentence frame: I would fix __ first. Probability is __ because __. Impact is __ because __. The protection __ helps because __.'}],
};
