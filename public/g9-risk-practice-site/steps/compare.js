export const compare = {
  id: 'compare', title: 'Explain a safe response', short: 'Explain threats', kind: 'form', stage: 'practice',
  intro: `<p>Read each short case. Then write a safe response and explain why it helps.</p><p><strong>Use clear English.</strong> Short sentences are enough.</p>`,
  fields: [
    {name:'phishing-response-v1', label:'Case 1: What is one safe action? Explain how it protects the account.', type:'textarea', rows:4, help:'Sentence frame: I would __ because __.', context:'You receive a message saying your school account will close unless you enter your password on a new page. You did not expect the message, and you are not sure it is really from the school.'},
    {name:'ransomware-response-v1', label:'Case 2: What danger is shown? Write one protection.', type:'textarea', rows:4, help:'Sentence frame: This is __. A protection is __ because __.', context:'A student downloads a free game from an unfamiliar website. After opening it, the computer locks the files and asks for money to unlock them.'},
    {name:'bruteforce-response-v1', label:'Case 3: What danger is shown? Explain one protection.', type:'textarea', rows:4, help:'Sentence frame: This is __. The protection helps because __.', context:'An account record shows hundreds of failed password guesses in one hour. Someone is trying many passwords to enter the account.'},
  ],
};
