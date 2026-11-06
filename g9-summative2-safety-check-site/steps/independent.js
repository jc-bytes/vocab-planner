import { independentBooks } from '../content.js';
import { choiceStep } from '../step-patterns.js';

export const independent = choiceStep({
  id: 'independent', title: 'Read a new table', short: 'Try it',
  stage: 'independent',
  activityTitle: 'Find one count', table: independentBooks,
  question: 'How many books did Class A borrow?',
  options: ['3', '5', '8'], answer: 2,
  hint: 'Find Class A, then read across its row.',
});
