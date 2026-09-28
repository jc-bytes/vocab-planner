import { threatCases } from '../content.js';

export const compare = {
  id: 'compare', title: 'Explain a safe response', short: 'Explain threats', kind: 'form', stage: 'practice',
  intro: `<p>Write a short answer for each case. Name the danger and explain how the protection helps.</p><p><strong>Use clear English.</strong> Short sentences are enough.</p>`,
  fields: [
    {name:'phishing-response-v1', label:'Case 1: Write one safe action for the fake password message and explain how it protects the account.', type:'textarea', rows:4, help:'Use the clue: a new page asks for the school password.'},
    {name:'ransomware-response-v1', label:'Case 2: Name the danger in the locked-files case and write one protection.', type:'textarea', rows:4, help:'Use the clue: the download locks files and asks for money.'},
    {name:'bruteforce-response-v1', label:'Case 3: Name the danger in the password-guessing case and explain one protection.', type:'textarea', rows:4, help:'Use the clue: hundreds of guesses appear in the account record.'},
  ],
};
