import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { weeklyVocabularyVisible, weeklyWordPlayable, activityHasPlayableRound, isVocabularyProjectBreak } from '../js/student/weeklyVocabularyPolicy.js';
import { getStudentActivity } from '../js/student/studentActivityRegistry.js';
const manifest=JSON.parse(readFileSync(new URL('../vocabularies/manifest.json',import.meta.url)));
const weekly=manifest.vocabularies.filter(v=>v.activitySettings?.weeklyPoolVersion===1).map(v=>JSON.parse(readFileSync(new URL('../'+v.path,import.meta.url))));
test('all 33 weekly units have five usable meaning questions and no project-week assignment',()=>{
 assert.equal(weekly.length,33);
 for(const v of weekly){
  assert.equal(v.words.length,5);assert.ok(![1,5,6].includes(v.week));
  assert.equal(new Set(v.words.map(w=>w.word.toLowerCase())).size,5);
  for(const type of ['flashcards','matching','fill-in-blank','quiz','word-search','speed-match']){
   const descriptor=getStudentActivity(type);
   const count=v.words.filter(w=>weeklyWordPlayable(type,w,v,descriptor.isPlayable)).length;
   assert.equal(count,5,`${v.id} ${type}`);assert.equal(activityHasPlayableRound(type,v,count),true);
  }
  for(const w of v.words)assert.ok(w.example.toLowerCase().includes(w.word.toLowerCase()),`${v.id} ${w.word}`);
  assert.deepEqual(v.activitySettings.requiredActivities,v.activitySettings.reviewOnly?[]:['flashcards','matching','fill-in-blank']);
 }
});
test('Week 1 files are byte-for-byte frozen against the release base',()=>{
 for(const v of manifest.vocabularies.filter(v=>/^grade[6-9]_t3_2026_w01_part[12]$/.test(v.id))){
  const frozen=JSON.parse(readFileSync(new URL('./fixtures/weekly-vocabulary-frozen.json',import.meta.url)));
  assert.equal(createHash('sha256').update(readFileSync(new URL('../'+v.path,import.meta.url))).digest('hex'),frozen[v.path]);
 }
});
test('old future units are retained but hidden, with replacement mappings',()=>{
 const old=manifest.vocabularies.filter(v=>v.activitySettings?.retiredWeeklySet);
 assert.equal(old.length,83);
 for(const v of old){assert.equal(weeklyVocabularyVisible(v,{group:'A'}),false);assert.equal(activityHasPlayableRound('flashcards',v,2),false);assert.ok(Array.isArray(v.activitySettings.replacementIds));}
});
test('group and actual release dates protect Grade 6 split lessons and closures',()=>{
 const split=weekly.find(v=>v.id.endsWith('w09_weekly_v1_c'));
 assert.equal(weeklyVocabularyVisible(split,{group:'A'},new Date(2026,10,13)),false);
 assert.equal(weeklyVocabularyVisible(split,{group:'C'},new Date(2026,10,10)),false);
 assert.equal(weeklyVocabularyVisible(split,{group:'C'},new Date(2026,10,11)),true);
 const closure=weekly.find(v=>v.id==='grade6_t3_2026_w08_weekly_v1');
 assert.deepEqual(closure.activitySettings.sections,['C']);
 assert.equal(weeklyVocabularyVisible(closure,{group:'C'},new Date(2026,10,5)),false);
 assert.equal(weeklyVocabularyVisible(closure,{group:'C'},new Date(2026,10,6)),true);
});
test('new Word Search rounds retain short words and adapt the grid; legacy rounds keep their rules',()=>{
 const v=weekly.find(v=>v.id==='grade8_t3_2026_w04_weekly_v1');const d=getStudentActivity('word-search');
 const prepared=d.prepare({vocab:v,wordLimit:5,prioritize:(n,filter)=>v.words.filter(filter).slice(0,n),restore:(_,words)=>words});
 assert.equal(prepared.words.length,5);assert.ok(prepared.words.some(w=>w.word==='Bit'));assert.equal(prepared.compactGrid,true);
 assert.equal(weeklyWordPlayable('word-search',{word:'Bit'},{},d.isPlayable),false);
 assert.equal(activityHasPlayableRound('word-search',v,3),false);
 assert.equal(activityHasPlayableRound('wordle',v,1),true);
});
test('vocabulary backlog is suspended for both complete project weeks only',()=>{
 assert.equal(isVocabularyProjectBreak(new Date(2026,9,11)),false);
 for(const day of [12,16,19,23])assert.equal(isVocabularyProjectBreak(new Date(2026,9,day)),true);
 assert.equal(isVocabularyProjectBreak(new Date(2026,9,24)),false);
});
