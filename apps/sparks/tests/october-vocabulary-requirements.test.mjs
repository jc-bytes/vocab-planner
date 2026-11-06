import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
const manifest=JSON.parse(readFileSync(new URL('../vocabularies/manifest.json',import.meta.url)));
test('active October vocabulary requires Flashcards and one other activity',()=>{
 const entries=manifest.vocabularies.filter(v=>v.month?.toLowerCase()==='october' && v.grades?.length && !v.activitySettings?.retiredWeeklySet);
 assert.ok(entries.length>=10);
 for(const entry of entries){
  const vocab=JSON.parse(readFileSync(new URL('../'+entry.path,import.meta.url)));
  assert.equal(vocab.activitySettings.requiredActivities.length,2,entry.id);
  assert.equal(vocab.activitySettings.requiredActivities[0],'flashcards',entry.id);
  assert.notEqual(vocab.activitySettings.requiredActivities[1],'flashcards',entry.id);
  assert.deepEqual(entry.activitySettings,vocab.activitySettings,entry.id);
  assert.equal(vocab.activitySettings.reviewOnly===true,false,entry.id);
  assert.doesNotMatch(vocab.description,/No required|Complete Flashcards, Matching and Fill in Blank/i,entry.id);
 }
});
