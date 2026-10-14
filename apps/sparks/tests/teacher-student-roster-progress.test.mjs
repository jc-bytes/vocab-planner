import assert from 'node:assert/strict';
import test from 'node:test';
import { buildStudentRosterProgress, releasedVocabularyAssignments } from '../js/teacherStudentRosterProgress.js';
const now=Date.parse('2026-10-05T18:00:00Z');
const assignment={id:'a',class_id:'class',kind:'vocabulary',release_at:'2026-10-01',due_at:'2026-10-04',content:{activitySettings:{requiredActivities:['flashcards','matching']}}};
const context={now,assignments:[assignment],rosters:{class:[{studentId:'s'}]}};
const student=units=>({id:'s',studentProfile:{},units});
test('unstarted assigned activities count as unfinished and overdue',()=>{
 const p=buildStudentRosterProgress(student({}),context);
 assert.equal(p.required,2);assert.equal(p.completed,0);assert.equal(p.pending,2);assert.equal(p.overdue,2);assert.equal(p.accuracy,null);assert.equal(p.lastActive,0);
});
test('only verified required completion counts; unrelated progress does not fill assigned work',()=>{
 const p=buildStudentRosterProgress(student({'assignment:a':{scores:{flashcards:{score:100,verified:true,isComplete:true},matching:{score:100,verified:false,isComplete:true}}},other:{scores:{matching:{isComplete:true,verified:true}}}}),context);
 assert.equal(p.completed,1);assert.equal(p.pending,1);assert.equal(p.overdue,1);
});
test('a verified high score without completion does not fill assigned requirements',()=>{
 const p=buildStudentRosterProgress(student({'assignment:a':{scores:{flashcards:{score:100,verified:true},matching:{score:150,verified:true,isComplete:false}}}}),context);
 assert.equal(p.completed,0);assert.equal(p.pending,2);assert.equal(p.overdue,2);
});
test('future, withdrawn, archived and other-year assignments do not create missing work',()=>{
 const classes=[{id:'class',school_year:2026},{id:'archive',school_year:2026,archived:true},{id:'old',school_year:2025}];
 const all=[assignment,{...assignment,id:'future',release_at:'2026-10-06'},{...assignment,id:'withdrawn',withdrawn:true},{...assignment,id:'archived',class_id:'archive'},{...assignment,id:'old',class_id:'old'},{...assignment,id:'spark',kind:'spark'}];
 assert.deepEqual(releasedVocabularyAssignments(all,classes,now).map(a=>a.id),['a']);
});
test('enrollment, optional review and retired sets protect the denominator',()=>{
 const other={...assignment,id:'other',class_id:'other'};
 const review={...assignment,id:'review',content:{activitySettings:{requiredActivities:[]}}};
 const retired={...assignment,id:'retired',content:{activitySettings:{requiredActivities:['quiz'],retiredWeeklySet:true}}};
 const p=buildStudentRosterProgress(student({}),{...context,assignments:[other,review,retired]});
 assert.equal(p.required,0);assert.equal(p.pending,0);
});
test('unknown requirements stay unknown rather than becoming no required work',()=>{
 const p=buildStudentRosterProgress(student({}),{...context,assignments:[{...assignment,content:{}}]});
 assert.equal(p.required,null);assert.equal(p.pending,null);
});
test('accuracy uses latest attempts; account updates do not count as learning',()=>{
 const s=student({'assignment:a':{scores:{flashcards:{score:100,bestAccuracy:100,lastPlayed:'2026-10-02',latestAttempt:{score:50,accuracy:50}},matching:{lastPlayed:'2026-10-03',latestAttempt:{score:70,accuracy:70}}}}});
 s.updatedAt='2026-10-05';const p=buildStudentRosterProgress(s,context);
 assert.equal(p.accuracy,60);assert.equal(p.lastActive,Date.parse('2026-10-03'));
});
test('recent accuracy uses at most ten most recently played activities',()=>{
 const units=Object.fromEntries(Array.from({length:11},(_,i)=>[String(i),{scores:{quiz:{lastPlayed:`2026-09-${String(i+1).padStart(2,'0')}`,latestAttempt:{score:100,accuracy:i===0?0:100}}}}]));
 assert.equal(buildStudentRosterProgress(student(units),context).accuracy,100);
});
