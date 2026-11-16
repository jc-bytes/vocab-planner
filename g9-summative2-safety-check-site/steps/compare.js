import { modelBooks } from '../content.js';
import { choiceStep } from '../step-patterns.js';

export const compare = choiceStep({
  id: 'compare', title: 'Find the largest count', short: 'Compare',
  activityTitle: 'Compare the book counts', table: modelBooks,
  question: 'Which class borrowed the most books?',
  options: ['Class A', 'Class B', 'Class C'], answer: 2,
  hint: 'Find the largest number, then read the class beside it.',
});
