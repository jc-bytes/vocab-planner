import { site } from './site.js';
import { caseHtml, compactReferenceHtml, referenceHtml } from './content.js';

const short = (name, label, help) => ({name, label, help, type:'text'});
const writing = (name, label, help) => ({name, label, help, type:'textarea', rows:3});

export const lesson = {
  ...site,
  sections: [
    {
      id:'reference', kind:'html', short:'Start', title:'Online safety check',
      summary:'Read the task and the allowed reference. Then begin Case 1.',
      html:referenceHtml,
    },
    {
      id:'case1', kind:'form', assessment:true, short:'Case 1', title:'Case 1: School message',
      summary:'Read the message. Use its details to support your answer.',
      intro:caseHtml({number:1, facts:'A message says it is from the school library. It says your account will close today unless you enter your school password on a new page. The message includes a link.'}) + compactReferenceHtml,
      fields:[
        short('clue','Clue','Which detail warns you? Write one fact from the story.'),
        short('threat','Danger','Name the type of danger.'),
        short('protection','Safe step','What should you do instead of trusting this message?'),
        writing('explanation','Explain in two complete sentences','Sentence 1: why the clue fits the danger. Sentence 2: how your safe step helps.'),
      ],
      pdf:{prompt:'A library message says your account will close unless you enter your school password on a linked new page. Identify one clue, the danger, and a matching protection. Explain the danger and protection in two complete sentences.'},
    },
    {
      id:'case2', kind:'form', assessment:true, short:'Case 2', title:'Case 2: Locked files',
      summary:'Read what happened to the files. Choose a safe response.',
      intro:caseHtml({number:2, facts:'A student downloads a game from an unknown website. Soon, the school files on the computer will not open. A message demands money to unlock them.'}) + compactReferenceHtml,
      fields:[
        short('clue','Clue','Which detail warns you? Write one fact from the story.'),
        short('threat','Danger','Name the type of danger.'),
        short('protection','Protection','What could help protect or recover the files?'),
        writing('safeAction','Safe action now','Write one complete sentence saying what the student should do now.'),
      ],
      pdf:{pageBreakBefore:true, prompt:'A game from an unknown website is followed by locked school files and a payment demand. Identify one clue, the danger, and a matching protection. State one safe action to take now in a complete sentence.'},
    },
    {
      id:'case3', kind:'form', assessment:true, short:'Case 3', title:'Case 3: Password guesses',
      summary:'Read the account record. Choose a way to protect the account.',
      intro:caseHtml({number:3, facts:'A school account record shows hundreds of different password guesses during one night. One guess finally opens the account.'}) + compactReferenceHtml,
      fields:[
        short('clue','Clue','Which detail warns you? Write one fact from the story.'),
        short('threat','Danger','Name the type of danger.'),
        short('protection','Protection','What would make the account safer?'),
      ],
      pdf:{prompt:'A school account record shows hundreds of password guesses, then a successful sign-in. Identify one clue, the danger, and a matching protection.'},
    },
    {
      id:'review', kind:'review', short:'Review', title:'Review and submit',
      summary:'Check every answer. Download one PDF and attach it to Daily Grade 2 in Google Classroom.',
    },
  ],
};
