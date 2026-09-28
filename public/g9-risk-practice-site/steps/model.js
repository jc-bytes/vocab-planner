import { sharedFolder } from '../content.js';
import { exampleStep } from '../step-patterns.js';

export const model = exampleStep({
  id: 'model', title: 'Read the example', short: 'Example',
  explanation: 'Probability means how likely something is. Impact means how much harm it could cause. Use facts from the case, not guesses.',
  source: 'A shared folder had one accidental deletion. The file was restored, and a checked backup exists.',
  action: 'The chance of another deletion is medium because five students can edit the folder. The impact is medium because the group could lose work, but version history and the backup help recovery.',
  table: sharedFolder,
  takeaway: 'A protection should reduce the chance of harm or reduce the harm if it happens.',
  context: 'Five students in a Grade 9 group project share one folder. Yesterday, one student accidentally deleted the group\'s presentation file. The group restored it using version history, and they checked that a backup exists. This is a real situation: shared folders have more people who can make mistakes, but protections like version history and backups reduce the harm.',
});
