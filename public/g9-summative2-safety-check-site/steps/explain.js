import { modelBooks } from '../content.js';
import { explanationStep } from '../step-patterns.js';

export const explain = explanationStep({
  id: 'explain', title: 'Explain your choice', short: 'Explain', table: modelBooks,
  question: 'How does the table show that Class C borrowed the most?',
  fieldId: 'reason-v1', help: 'Use the book counts in your answer.',
});
