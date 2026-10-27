// Each selector points at an existing control. Guidance never supplies an answer.
const step = (selector, title, message, pose = 'step') => ({selector, title, message, pose});
export const ACTIVITY_EMBER_PLANS = {
 matching: [step('.term-card:not(:disabled)', 'Choose a word', 'Choose one word card.'), step('.definition-card:not(:disabled)', 'Find its meaning', 'Choose the card that matches the word.')],
 'fill-in-blank': [step('.fib-sentence', 'Read the sentence', 'Read the words around the blank.'), step('.fib-input', 'Complete the sentence', 'Type the missing vocabulary word.'), step('.fib-wrapper > .primary-btn', 'Check your answer', 'Choose Check Answer when you are ready.')],
 quiz: [step('.quiz-container .card h2', 'Read the question', 'Read the question before choosing an answer.'), step('.option-btn:not(:disabled)', 'Read every choice', 'Choose the meaning that fits the question.')],
 'synonym-antonym': [step('.quiz-container .pos-tag', 'Check the task', 'Synonym means a similar meaning. Antonym means an opposite meaning.'), step('.quiz-container .card h2', 'Read the question', 'Check which kind of word the question asks for.'), step('.option-btn:not(:disabled)', 'Choose a word', 'Read every choice before you answer.')],
 'word-search': [step('.word-list-container h3', 'Read the word list', 'Choose a word from the list to find.'), step('.word-search-instructions', 'Find the letters', 'Drag from the first letter to the last letter in a straight line.')],
 crossword: [step('.cw-active-clue', 'Read the clue', 'Choose a clue. Read it and count its answer boxes.'), step('.cw-cell:not(:disabled)', 'Enter the word', 'Type one letter in each box. Crossing letters can help.'), step('#cw-check-word', 'Check the word', 'Choose Check Word to check your selected answer.')],
 hangman: [step('.hangman-hint', 'Read the clue', 'Use the definition to think of the word.'), step('.hangman-word', 'Count the letters', 'Each empty space is one missing letter.'), step('.key-btn:not(:disabled)', 'Choose a letter', 'Choose a letter. Watch how many guesses remain.')],
 scramble: [step('.scramble-clue', 'Look for a clue', 'Use Hint if you need help with the word.'), step('.scramble-pool-area .scramble-tile', 'Build the word', 'Choose letters in order. Tap an answer letter to put it back.')],
 wordle: [step('.wordle-hint', 'Read the definition', 'Think of a word that matches this meaning.'), step('.wordle-board .wordle-tile', 'Enter your guess', 'Type a word that fits the row, then press Enter.'), step('.wordle-message', 'Use the feedback', 'Green means the right place. Yellow means a different place. Gray means the letter is not needed there.')],
 'speed-match': [step('.speed-match-intro h2', 'Get ready', 'Choose falling words that match the definition. Help stays off while the round runs.'), step('#start-speed-match', 'Start when ready', 'Choose Start Game. Read the definition and tap the matching words.')],
 illustration: [step('.word-hunt-title strong', 'Read the word', 'This is the word you will explain.'), step('#word-hunt-definition', 'Explain its meaning', 'Write a clear definition in your own words.'), step('.word-hunt-upload-title', 'Add an image', 'Choose an image that shows the word. Use the image controls to add it.'), step('#word-hunt-example-one', 'Write an example', 'Use the word in a technology sentence.'), step('#word-hunt-example-two', 'Write another example', 'Write a different sentence using the same word.'), step('.word-hunt-next-btn', 'Review and continue', 'Check the required parts, then choose Next or Finish.')]
};
export const SCREEN_EMBER_PLANS = {
 'main-menu-view': [step('.student-continue-hero button, .student-continue-hero', 'Start your work', 'Open your assigned task here.'), step('#student-tab-vocabulary', 'Find your units', 'Use Units to see your class activities.')],
 'vocab-selection-view': [step('#vocab-list .teacher-library-choice-card, #vocab-list .student-vocab-row:not(.student-vocab-unit-row)', 'Choose a unit', 'Choose a month or unit to see its activities.')],
 'activity-menu-view': [step('.next-activity-card:not(:disabled), [data-activity]:not(:disabled)', 'Choose an activity', 'Start with an unfinished required activity. You can review completed work too.')],
 'student-sparks-view': [step('.student-class-spark-heading h2, .spark-reading-copy h2', 'Read the Spark', 'Read the passage before answering.'), step('.student-class-spark-questions h3, .spark-check-open-btn', 'Check your understanding', 'Use the reading to help you answer. Reading-only Sparks do not need a response.'), step('.student-class-spark-questions button[type="submit"]:not(:disabled)', 'Save your answers', 'Choose Check answers. Wait for confirmation before leaving.'), step('.student-spark-library-choice', 'Choose a Spark', 'Open a Spark to read it and see its questions.')],
 'arcade-view': [step('.student-arcade-gate-notice, .arcade-game-card, .game-card, #arcade-view h2', 'Choose a game', 'Check your available Arcade time. Finish required activities if Arcade is locked.')]
};
export function isEmberTargetVisible(element) {
 if (!element?.isConnected || element.closest('.hidden,[hidden],[inert]')) return false;
 const rect=element.getBoundingClientRect();
 return rect.width>0 && rect.height>0 && getComputedStyle(element).visibility!=='hidden';
}
export function resolveEmberSteps(root, plan) {
 return plan.flatMap(({selector,...copy})=>{
  const target=[...root.querySelectorAll(selector)].find(isEmberTargetVisible);
  return target ? [{...copy,target}] : [];
 });
}

// Use progress metadata from the same completion model that renders Cards and Rows.
// DOM order is the current list's schedule order; never select navigation buttons.
export function resolveNextWorkSteps(root, type) {
 const available = selector => [...root.querySelectorAll(selector)].filter(el =>
  isEmberTargetVisible(el) && !el.disabled && el.getAttribute('aria-disabled') !== 'true');
 if (type === 'vocab-selection-view') {
  const units = available('[data-ember-unit]');
  if (!units.length) return null;
  const unfinished = units.filter(el => Number(el.dataset.emberRequiredTotal) > Number(el.dataset.emberRequiredCompleted));
  const target = unfinished.find(el => Number(el.dataset.emberRequiredCompleted) > 0) || unfinished[0];
  if (target) {
   const started = Number(target.dataset.emberRequiredCompleted) > 0;
   return [{target, pose:'step', title:started ? 'Continue this unit' : 'Start this unit', message:'Open this unit, then choose its next required activity.'}];
  }
  return resolveEmberSteps(root, [{selector:'.student-unit-list-heading', pose:'calm', title:'No unfinished required work here', message:'You can review a unit or choose another month.', action:'Got it'}]);
 }
 if (type === 'activity-menu-view') {
  const candidates = available('.required-activity-card:not(.activity-path-complete)');
  const target = candidates.find(el => el.classList.contains('next-activity-card')) || candidates[0];
  if (target) return [{target, pose:'step', title:'Do this activity next', message:'Choose this activity to continue your required work.'}];
  return resolveEmberSteps(root, [{selector:'h2,h3', pose:'calm', title:'Check your required work', message:'No unfinished required activity is available here. Review your progress or choose another unit.', action:'Got it'}]);
 }
 return null;
}
