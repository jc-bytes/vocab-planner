import { riskCases, tableHtml } from '../content.js';

export const explain = {
  id: 'explain', title: 'Learn to rate a risk', short: 'Risk example', kind: 'html', stage: 'guided',
  html: `<p>Probability asks, <strong>How likely is it?</strong> Impact asks, <strong>How much harm could it cause?</strong></p><p>Example: A project file is deleted every week and has no backup. Probability is high because deletion happens often. Impact is high because the only copy could be lost. A separate backup protects the work because it allows recovery.</p>${tableHtml(riskCases)}<p>For each risk, use one fact for probability, one fact for impact, and one protection that matches the danger.</p><div class="fm-context"><p><strong>Context.</strong> You will now learn to rate risks using probability and impact. The table shows four real cases from a school. Each case has facts that tell you how likely the risk is and how much harm it could cause. Use those facts, not guesses.</p></div>`,
};
