import { riskCases } from '../content.js';
import { choiceSetStep } from '../step-patterns.js';

export const independent = choiceSetStep({
  id: 'independent', title: 'Rate the risks', short: 'Risk practice', stage: 'independent', table: riskCases,
  items: [
    {title:'R1 probability', question:'R1: What supports high probability?', options:['Unknown logins have already appeared','The account contains records','The account belongs to attendance'], answer:0, hint:'Probability uses how often or how likely the event is. Use the unknown logins.'},
    {title:'R1 impact', question:'R1: What supports high impact?', options:['Student records could be exposed','The password is short','The account has a name'], answer:0, hint:'Impact uses the harm if the event happens. Student records are private.'},
    {title:'R1 protection', question:'R1: Which protection best matches the account risk?', options:['Use a long unique password and multi-factor authentication','Keep the short password shared','Delete the login alerts'], answer:0, hint:'These protections address weak password access and add another check.'},
    {title:'R4 probability', question:'R4: What supports high probability?', options:['The computer missed updates for six months and downloads attachments','The computer is in a library','The screen is large'], answer:0, hint:'Missing updates and downloaded attachments create repeated exposure.'},
    {title:'R4 impact', question:'R4: What supports high impact?', options:['A harmful attachment could affect the computer and school work','The computer has a keyboard','The library has tables'], answer:0, hint:'Impact describes the harm from a successful unsafe attachment.'},
    {title:'R4 protection', question:'R4: Which protection best matches the computer risk?', options:['Install verified security updates and scan attachments','Turn off security before opening files','Use any free download'], answer:0, hint:'Updates repair known weaknesses, and scanning checks attachments.'},
    {title:'R6 probability', question:'R6: What supports high probability?', options:['A file is deleted about once each month','The folder has a bright name','The project is in a folder'], answer:0, hint:'A repeated deletion is evidence that another deletion is likely.'},
    {title:'R6 impact', question:'R6: What supports high impact?', options:['There is no backup, so the only copy could be lost','The project has a title','The folder has five files'], answer:0, hint:'Losing the only copy makes the harm serious.'},
    {title:'R6 protection', question:'R6: Which protection best matches the project risk?', options:['Keep and test a separate backup','Give everyone edit access','Use one shared password'], answer:0, hint:'A separate tested backup allows the group to restore lost work.'},
    {title:'P1 probability', question:'P1: What supports high probability?', options:['Unknown logins have appeared and the password is short','The account stores contact details','The club has members'], answer:0, hint:'Unknown logins and a weak password show a likely account attack.'},
    {title:'P1 impact', question:'P1: What supports high impact?', options:['Private contact details could be exposed','The password has letters','The account has a username'], answer:0, hint:'Impact is high when private information could be exposed.'},
    {title:'P1 protection', question:'P1: Which protection best matches the club account risk?', options:['Change to a long unique password and add multi-factor authentication','Keep sharing the short password','Ignore unknown logins'], answer:0, hint:'The protection must address weak access and unexpected logins.'},
  ],
});
