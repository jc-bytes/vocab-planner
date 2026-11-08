import assert from 'node:assert/strict';
import test from 'node:test';
import { weeklyVocabularyVisible, weeklyWordPlayable, activityHasPlayableRound, isVocabularyProjectBreak } from '../js/student/weeklyVocabularyPolicy.js';
import { getStudentActivity } from '../js/student/studentActivityRegistry.js';
import { weeklyFixture } from './fixtures/weekly-vocabulary-fixture.mjs';
test('retired database snapshots remain unavailable for new practice', () => {
 const v=weeklyFixture(6,{retired:true});
 assert.equal(weeklyVocabularyVisible(v,{group:'A'}),false);
 assert.equal(activityHasPlayableRound('flashcards',v,5),false);
});
test('group and actual release dates protect Grade 6 split lessons and closures',()=>{
 const split=weeklyFixture(6,{review:true}); split.activitySettings.releaseDates.C='2026-11-11';
 assert.equal(weeklyVocabularyVisible(split,{group:'A'},new Date(2026,10,13)),false);
 assert.equal(weeklyVocabularyVisible(split,{group:'C'},new Date(2026,10,10)),false);
 assert.equal(weeklyVocabularyVisible(split,{group:'C'},new Date(2026,10,11)),true);
 const closure=weeklyFixture(6,{review:true});
 assert.deepEqual(closure.activitySettings.sections,['C']);
 assert.equal(weeklyVocabularyVisible(closure,{group:'C'},new Date(2026,10,5)),false);
 assert.equal(weeklyVocabularyVisible(closure,{group:'C'},new Date(2026,10,6)),true);
});
test('new Word Search rounds retain short words and adapt the grid; legacy rounds keep their rules',()=>{
 const v=weeklyFixture(8);const d=getStudentActivity('word-search');
 const prepared=d.prepare({vocab:v,wordLimit:5,prioritize:(n,filter)=>v.words.filter(filter).slice(0,n),restore:(_,words)=>words});
 assert.equal(prepared.words.length,5);assert.ok(prepared.words.some(w=>w.word==='Cat'));assert.equal(prepared.compactGrid,true);
 assert.equal(weeklyWordPlayable('word-search',{word:'Bit'},{},d.isPlayable),false);
 assert.equal(activityHasPlayableRound('word-search',v,3),false);
 assert.equal(activityHasPlayableRound('wordle',v,1),true);
});
test('vocabulary backlog is suspended for both complete project weeks only',()=>{
 assert.equal(isVocabularyProjectBreak(new Date(2026,9,11)),false);
 for(const day of [12,16,19,23])assert.equal(isVocabularyProjectBreak(new Date(2026,9,day)),true);
 assert.equal(isVocabularyProjectBreak(new Date(2026,9,24)),false);
});
