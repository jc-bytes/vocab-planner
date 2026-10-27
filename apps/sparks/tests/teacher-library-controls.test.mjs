import test from 'node:test';
import assert from 'node:assert/strict';
import { filterLibraryItems, vocabularyStatus } from '../js/teacherLibraryControls.js';
const items = [
    {type:'cloud',vocab:{id:'a',name:'Digital footprints',grade:'7',trimester:'IIIT'}},
    {type:'local',vocab:{id:'b',name:'Safe messages',grade:'6',trimester:'IT'}},
    {type:'remote',vocab:{id:'c',name:'Binary numbers',grade:'8',trimester:'IIT'}},
    {type:'cloud',vocab:{id:'d',name:'Retired - Old unit',grade:'7',trimester:'IIIT'}},
    {type:'cloud',vocab:{id:'e',name:'Old archived unit',status:'archived',grade:'7',trimester:'IIIT'}}
];
const access = {getGrades:item=>[item.vocab.grade],getTrimester:item=>item.vocab.trimester};
test('library filters combine title, grade, trimester and status without changing source data',()=>{
    const before=JSON.stringify(items);
    assert.deepEqual(filterLibraryItems(items,{query:' FOOT ',grade:'7',trimester:'IIIT',status:'saved'},access).map(i=>i.vocab.id),['a']);
    assert.deepEqual(filterLibraryItems(items,{status:'current'},access).map(i=>i.vocab.id),['a','b','c']);
    assert.deepEqual(filterLibraryItems(items,{status:'draft'},access).map(i=>i.vocab.id),['b']);
    assert.deepEqual(filterLibraryItems(items,{status:'retired'},access).map(i=>i.vocab.id),['d','e']);
    assert.equal(filterLibraryItems(items,{query:'absent'},access).length,0);
    assert.equal(JSON.stringify(items),before);
});
test('library status treats explicit drafts and archived records consistently',()=>{
    assert.equal(vocabularyStatus({type:'cloud',vocab:{name:'New unit',status:'draft'}}),'draft');
    assert.equal(vocabularyStatus(items[2]),'repository');
    assert.equal(filterLibraryItems(items,{status:'all'},access).length,items.length);
});
