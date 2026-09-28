export const sharedFolder = {
  caption: 'Practice case: shared project folder',
  columns: ['What happened', 'What we know'],
  rows: [
    ['A file was deleted yesterday', 'Five students can edit the folder'],
    ['The file was restored', 'Version history restored it'],
    ['A backup was checked this morning', 'The group can recover the work'],
  ],
};

export const threatCases = {
  caption: 'Threat clues',
  columns: ['Case clue', 'What the clue tells you'],
  rows: [
    ['A new page asks for a school password', 'The message may be pretending to be official'],
    ['A download locks files and asks for money', 'The files may be held for payment'],
    ['Hundreds of password guesses appear', 'Someone is trying many passwords'],
    ['A free theme asks you to turn off security', 'The download may be harmful software'],
  ],
};

export const riskCases = {
  caption: 'Risk cases',
  columns: ['Case', 'Facts'],
  rows: [
    ['Attendance account', 'Unknown logins; short shared password; student records'],
    ['Library computer', 'Updates missing for six months; students download attachments'],
    ['Project folder', 'No backup; a file is deleted about once each month'],
    ['Club account', 'Unknown logins; short shared password; private contact details'],
  ],
};

export const clubAccount = {
  caption: 'Try it: club account',
  columns: ['What happened', 'What we know'],
  rows: [
    ['Unknown logins appeared', 'The password is short and shared'],
    ['The account stores contact details', 'Private information is inside'],
  ],
};

const escape = value => String(value).replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
export const tableHtml = table => `<table><caption>${escape(table.caption)}</caption><thead><tr>${table.columns.map(column=>`<th scope="col">${escape(column)}</th>`).join('')}</tr></thead><tbody>${table.rows.map(row=>`<tr>${row.map((cell,index)=>index===0?`<th scope="row">${escape(cell)}</th>`:`<td>${escape(cell)}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
