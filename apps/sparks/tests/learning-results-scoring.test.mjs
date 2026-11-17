import test from 'node:test';import assert from 'node:assert/strict';
import {fraction,spellingCredit,normalizeSpelling,calculateResult,weightedCredit,comboSummary} from '../js/learningResults/scoring.js';
import {canonical,bytes,initialHash,extendHash} from '../js/learningResults/contract.js';
const scheduled=[{id:'a:0',wordId:'a'},{id:'b:0',wordId:'b'}];
const result=(credits,time=10000,passingTarget=80)=>calculateResult({outcomes:credits.map((credit,i)=>({opportunityId:scheduled[i].id,credit})),scheduled,recordedMilliseconds:time,sharedTargetMilliseconds:10000,passingTarget});
test('950/50 exact scoring, speed gate, single floor, completion and five stars',()=>{
 for(const [n,d,t,points] of [[1,1,10000,1000],[1,1,20000,950],[4,5,10000,810],[799,1000,10000,759]])assert.equal(result([fraction(n,d),fraction(n,d)],t).points,points);
 assert.equal(result([fraction(2,3),fraction(1)],15000).points,816);assert.equal(result([fraction(1),fraction(1)],20000).stars,4);
 assert.equal(result([fraction(79,100),fraction(79,100)],10000,70).passed,true);assert.equal(result([fraction(79,100),fraction(79,100)]).passed,false);
});
test('word weights and duplicate/missing outcomes',()=>{
 const s=[{id:'a0',wordId:'a'},{id:'a1',wordId:'a'},{id:'b0',wordId:'b'}],o=[{opportunityId:'a0',credit:fraction(1)},{opportunityId:'a1',credit:fraction(0)},{opportunityId:'b0',credit:fraction(1)}];
 assert.deepEqual(weightedCredit(o,s),fraction(3,4));assert.throws(()=>weightedCredit(o.slice(1),s),{code:'EVIDENCE_INCOMPLETE'});assert.throws(()=>weightedCredit([...o,o[0]],s),{code:'DUPLICATE_OUTCOME'});
});
test('frozen Unicode spelling and position partial credit',()=>{
 assert.equal(normalizeSpelling(' A‐b C‑D- '),'abcd');assert.equal(normalizeSpelling('E\u0301'),'é');assert.equal(normalizeSpelling('ẞ'),'ß');assert.notEqual(normalizeSpelling('é'),'e');
 assert.deepEqual(spellingCredit('CAT','CXT'),fraction(2,3));assert.deepEqual(spellingCredit('CAT','CATS'),fraction(3,4));assert.deepEqual(spellingCredit('CAT','CA',true),fraction(1,3));assert.deepEqual(spellingCredit('𐐀A','𐐨a'),fraction(1));
});
test('combo milestones and resets',()=>{const o=Array.from({length:21},()=>({credit:fraction(1),assisted:false}));assert.deepEqual(comboSummary(o),{current:21,longest:21,celebrations:[3,5,10,15,20]});assert.equal(comboSummary([...o,{credit:fraction(1,2),assisted:true}]).current,0);});
test('canonical encoding and batch-independent hashes',async()=>{
 assert.equal(canonical({é:'a\n',a:'"\\'}),'{"a":"\\"\\\\","é":"a\\u000a"}');assert.deepEqual(bytes({b:2,a:1}),bytes({a:1,b:2}));
 for(const v of [1.5,NaN,undefined,new Date(),[,1],'\ud800','\u0000'])assert.throws(()=>canonical(v));
 const h=await initialHash('00000000-0000-4000-8000-000000000001','00000000-0000-4000-8000-000000000002'),events=[{sequence:1,answer:'é'},{sequence:2,answer:'b'}];
 assert.equal(await extendHash(h,events),await extendHash(await extendHash(h,events.slice(0,1)),events.slice(1)));
});
