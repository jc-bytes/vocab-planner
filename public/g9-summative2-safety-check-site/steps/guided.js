import { modelBooks } from '../content.js';
import { guidedSelect } from '../step-patterns.js';

export const guided = guidedSelect({
  id: 'guided', title: 'Find Class C', short: 'Find a count',
  instruction: 'Find Class C. Read across the same row.',
  table: modelBooks,
  question: 'How many books did Class C borrow?',
  options: ['2', '4', '6'], answer: '6',
  hint: 'Read the number beside Class C.',
});
