import test from 'node:test';import assert from 'node:assert/strict';
import {deriveOutcome,ADAPTER_ACTIVITIES} from '../js/learningResults/adapters.js';import {fraction} from '../js/learningResults/scoring.js';import {validateTask,validateLayout,makeSchedule,chooseVariant} from '../js/learningResults/task.js';
const word={id:'cat',word:'CAT',options:[{id:'yes'},{id:'no'}],correctOptionId:'yes'},opportunity={id:'cat:0',wordId:'cat'};
const variants=[{variantId:'00000000-0000-4000-8000-000000000005',generatorVersion:'grid-v1',seed:'00000001',rows:3,columns:3,gridRows:['#B#','CAT','#T#'],placements:[{wordId:'cat',startRow:1,startColumn:0,direction:'across'},{wordId:'bat',startRow:0,startColumn:1,direction:'down'}]}];
for(const activity of ADAPTER_ACTIVITIES)test(`${activity}: unaided and assisted original`,()=>{
 const response=activity==='wordle'?{guesses:['dog','cat']}:activity==='hangman'?{letters:['c','a','t']}:activity==='matching'?{selectedDefinitionId:'cat'}:activity==='speed-match'?{selectedWordId:'cat',missed:false}:activity==='word-search'?{variantId:variants[0].variantId,path:[[1,0],[1,1],[1,2]]}:['flashcards','quiz','synonym-antonym','reading-check'].includes(activity)?{optionId:'yes'}:{answer:'CAT'};
 for(const assisted of [false,true])assert.deepEqual(deriveOutcome({activity,words:[word],variants},opportunity,response,assisted).credit,fraction(1,assisted?2:1));
});
test('Wordle sixth guess and incomplete failure',()=>{assert.deepEqual(deriveOutcome({activity:'wordle',words:[word]},opportunity,{guesses:['dog','dog','dog','dog','dog','cat']}).credit,fraction(1));assert.throws(()=>deriveOutcome({activity:'wordle',words:[word]},opportunity,{guesses:['dog']}),{code:'OUTCOME_NOT_READY'});});
test('complete Crossword coverage and crossing letters',()=>{const words=[word,{id:'bat',word:'BAT'}];validateLayout(words,'crossword',variants[0]);for(const v of [{...variants[0],gridRows:['#B#','CXT','#T#']},{...variants[0],placements:variants[0].placements.slice(0,1)}])assert.throws(()=>validateLayout(words,'crossword',v),{code:'LAYOUT_INVALID'});});
test('complete repetition schedule and stable variant selection',async()=>{const task={id:'00000000-0000-4000-8000-000000000001',activity:'matching',appearances:5,words:[word,{id:'bat',word:'BAT'}],variants};assert.equal(makeSchedule(task,7).length,10);assert.deepEqual(makeSchedule(task,7),makeSchedule(task,7));const id='00000000-0000-4000-8000-000000000002';assert.deepEqual(await chooseVariant(task,id),variants[0]);});
import {generateLayout} from '../js/learningResults/task.js';
test('bounded teacher generation produces complete deterministic validated puzzles',()=>{
 const words=[{id:'cat',word:'CAT'},{id:'bat',word:'BAT'},{id:'tab',word:'TAB'}],variantId='00000000-0000-4000-8000-000000000005';
 for(const activity of ['crossword','word-search']){const layout=generateLayout({words,activity,seed:4,variantId});assert.equal(layout.placements.length,3);validateLayout(words,activity,layout);assert.deepEqual(layout,generateLayout({words,activity,seed:4,variantId}));}
 assert.throws(()=>generateLayout({words:[{id:'a',word:'AA'},{id:'b',word:'BB'}],activity:'crossword',seed:1,variantId}),{code:'LAYOUT_GENERATION_FAILED'});
});

test('task validation accepts 250 answers and rejects an oversized repetition schedule',()=>{
 const words=Array.from({length:50},(_,i)=>({id:`term-${i}`,word:`Term ${i}`,definition:`Definition ${i}`}));
 for(const activity of ['matching','speed-match']){
  const task={id:crypto.randomUUID(),contractVersion:'learning-results-v1',activity,sharedTargetMilliseconds:10000,words,appearances:5};
  validateTask(task);assert.equal(makeSchedule(task,7).length,250);
  assert.throws(()=>validateTask({...task,words:[...words,{id:'extra',word:'Extra',definition:'Extra definition'}]}),{code:'INVALID_TASK'});
 }
});
