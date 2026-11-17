import { fail, assertKeys } from './contract.js';
import { normalizeSpelling, spellingCredit, binaryCredit } from './scoring.js';
// Responses are evidence. Official outcomes must be independently derived by SQL.
export function deriveOutcome(task, opportunity, response, assisted = false) {
    if(!response || typeof response!=='object' || Array.isArray(response))fail('INVALID_RESPONSE');
    const word = task.words.find(w => w.id === opportunity.wordId); if (!word) fail('INVALID_OPPORTUNITY');
    assertKeys(response,task.activity==='wordle'?['guesses']:task.activity==='hangman'?['letters']:task.activity==='word-search'?['variantId','path']:task.activity==='speed-match'?['selectedWordId','missed']:task.activity==='matching'?['selectedDefinitionId']:['flashcards','quiz','synonym-antonym','reading-check'].includes(task.activity)?['optionId']:['answer']);
    let correct, credit;
    switch (task.activity) {
    case 'crossword': case 'fill-in-blank':
        credit = spellingCredit(word.word, response.answer, assisted); correct = normalizeSpelling(word.word) === normalizeSpelling(response.answer); break;
    case 'wordle': {
        const guesses = response.guesses;
        if (!Array.isArray(guesses) || guesses.length < 1 || guesses.length > 6 || guesses.some(g => !/^[a-z]+$/.test(g) || g.length !== normalizeSpelling(word.word).length)) fail('INVALID_GUESSES');
        const solvedAt = guesses.indexOf(normalizeSpelling(word.word));
        if (solvedAt >= 0 && solvedAt !== guesses.length - 1) fail('INVALID_GUESSES');
        correct = solvedAt >= 0; if (!correct && guesses.length !== 6) fail('OUTCOME_NOT_READY'); break;
    }
    case 'hangman': {
        const letters = response.letters, expected = normalizeSpelling(word.word);
        if (!Array.isArray(letters) || new Set(letters).size !== letters.length || letters.some(c => !/^[a-z]$/.test(c))) fail('INVALID_GUESSES');
        let wrong = 0, solved = false; const found = new Set();
        for (const c of letters) {
            if (wrong === 6 || solved) fail('INVALID_GUESSES');
            found.add(c); if (!expected.includes(c)) wrong++;
            solved = [...expected].every(c => found.has(c));
        }
        if (!solved && wrong < 6) fail('OUTCOME_NOT_READY'); correct = solved; break;
    }
    case 'word-search': {
        const path = response.path, layout = task.variants.find(v => v.variantId === response.variantId);
        if (!layout || !Array.isArray(path) || path.length !== normalizeSpelling(word.word).length) fail('INVALID_PATH');
        let dr, dc;
        for (let i=0;i<path.length;i++) {
            const p=path[i]; if (!Array.isArray(p) || p.length !== 2 || !p.every(Number.isInteger)) fail('INVALID_PATH');
            if (i) { const r=p[0]-path[i-1][0], c=p[1]-path[i-1][1]; if (!r && !c || Math.abs(r)>1 || Math.abs(c)>1 || i>1 && (r!==dr || c!==dc)) fail('INVALID_PATH'); dr=r; dc=c; }
        }
        correct = path.map(([r,c])=>layout.gridRows[r]?.[c] || '').join('').toLowerCase() === normalizeSpelling(word.word);
        if (!correct) fail('INVALID_PATH'); break;
    }
    case 'scramble': correct = normalizeSpelling(response.answer) === normalizeSpelling(word.word); break;
    case 'speed-match':
        if(typeof response.missed!=='boolean' || (response.missed ? response.selectedWordId!==null : !task.words.some(w=>w.id===response.selectedWordId)))fail('INVALID_SELECTION');
        correct = response.selectedWordId === word.id && !response.missed; break;
    case 'matching':
        if(!task.words.some(w=>w.id===response.selectedDefinitionId))fail('INVALID_SELECTION');
        correct = response.selectedDefinitionId === word.id; break;
    case 'flashcards': case 'quiz': case 'synonym-antonym': case 'reading-check':
        if (!Array.isArray(word.options) || !word.options.some(o=>o.id === response.optionId)) fail('INVALID_OPTION');
        correct = response.optionId === word.correctOptionId; break;
    default: fail('INVALID_ACTIVITY');
    }
    return { opportunityId: opportunity.id, wordId: word.id, response, assisted, correct, credit: credit || binaryCredit(correct, assisted) };
}
export function validateCorrection(task, opportunity, answer) {
    const word = task.words.find(w => w.id === opportunity.wordId);
    return Boolean(word && normalizeSpelling(answer) === normalizeSpelling(word.word));
}
export const ADAPTER_ACTIVITIES = Object.freeze(['flashcards','matching','scramble','wordle','hangman','fill-in-blank','crossword','word-search','quiz','synonym-antonym','speed-match','reading-check']);
