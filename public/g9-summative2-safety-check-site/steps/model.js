import { modelBooks } from '../content.js';
import { exampleStep } from '../step-patterns.js';

export const model = exampleStep({
  id:'model', title:'Read one row', short:'Example',
  explanation:'A row goes across a table. Each row keeps one class with its book count.',
  source:'Class B borrowed 4 books.',
  action:'Find Class B, then read across the same row.',
  table:modelBooks,
  takeaway:'The Books column shows 4 for Class B.',
});
