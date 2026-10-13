import test from 'node:test';
import assert from 'node:assert/strict';
import { buildStudentInsight, attemptTiming, comparableTrend, activityAttention, capturedAnswerRows } from '../js/teacherStudentInsightModel.js';
const now = Date.parse('2026-10-05');
const assignment = (extra={}) => ({ id:'a', kind:'vocabulary', enrolled:true, releaseAt:'2026-10-01', dueAt:'2026-10-03', content:{activitySettings:{requiredActivities:['quiz','matching']}}, progress:[], ...extra });
test('untouched required work stays in the denominator and past-due count',()=>{
 const {summary,work}=buildStudentInsight({assignments:[assignment()]},now);
 assert.equal(summary.required,2);assert.equal(summary.notStarted,2);assert.equal(summary.overdue,2);assert.equal(work[0].overdue,true);
});
test('unverified results and optional results never satisfy required completion',()=>{
 const {summary,work}=buildStudentInsight({assignments:[assignment({progress:[{activity_type:'quiz',score:100,verified:false,is_complete:true},{activity_type:'matching',verified:true,is_complete:true},{activity_type:'flashcards',verified:true,is_complete:true}]})]},now);
 assert.equal(summary.required,2);assert.equal(summary.completed,1);assert.equal(summary.inProgress,1);assert.equal(work[0].activities.length,3);
});
test('scheduled, withdrawn, historical and retired work are visible outside current totals',()=>{
 const inputs=[{releaseAt:'2026-10-06'},{withdrawn:true},{archived:true},{enrolled:false},{content:{activitySettings:{retiredWeeklySet:true,requiredActivities:['quiz']}}}].map(assignment);
 const result=buildStudentInsight({assignments:inputs},now);
 assert.equal(result.work.length,5);assert.equal(result.summary.required,0);
});
test('unknown requirements are explicit and never become zero-work success',()=>{
 const result=buildStudentInsight({assignments:[assignment({content:{}})]},now);
 assert.equal(result.summary.unknown,1);assert.equal(result.work[0].known,false);
});
test('reading submission needing review is not called completed even if automatic questions pass',()=>{
 const result=buildStudentInsight({assignments:[assignment({kind:'spark',content:{checkMode:'required'},response:{evaluation:{isComplete:true,needsTeacherReview:true}}})]},now);
 assert.equal(result.summary.review,1);assert.equal(result.summary.completed,0);assert.equal(result.summary.overdue,0);
 const checked=buildStudentInsight({assignments:[assignment({kind:'spark',content:{checkMode:'required'},response:{evaluation:{isComplete:true,needsTeacherReview:false}}})]},now);
 assert.equal(checked.summary.completed,1);
});
test('zero scores stay zero and old untimed zeros stay unavailable',()=>{
 assert.equal(attemptTiming({activeSeconds:0}),'Time unavailable');
 assert.match(attemptTiming({activeSeconds:70,timeLimitSeconds:60}),/1:10 foreground time.*1:00 limit/);
 assert.deepEqual(comparableTrend([{captureQuality:'complete',finishedAt:'x',accuracy:0,metricLabel:'correct answers'},{captureQuality:'complete',finishedAt:'x',accuracy:40,metricLabel:'correct answers'}]),{latest:0,previous:40,label:'correct answers'});
 assert.equal(comparableTrend([{captureQuality:'complete',finishedAt:'x',accuracy:0,metricLabel:'a'},{captureQuality:'complete',finishedAt:'x',accuracy:40,metricLabel:'b'}]),null);
});

test('reading-only and optional checks do not create invented missing required submissions',()=>{
 const result=buildStudentInsight({assignments:[assignment({kind:'spark',content:{checkMode:'reading_only'}}),assignment({kind:'spark',content:{checkMode:'optional'}})]},now);
 assert.equal(result.summary.required,0);assert.equal(result.summary.unknown,2);
});

test('attention reasons are evidence-based and long foreground time alone produces no concern',()=>{
 assert.deepEqual(activityAttention({status:'In progress',progress:{latestAttempt:{activeSeconds:8000}}}),[]);
 assert.equal(activityAttention({status:'In progress',progress:{finished_runs:3,latestAttempt:{captureQuality:'complete',finishedAt:'x',accuracy:0,attemptedActions:5,isLate:true}}}).length,3);
});
test('captured answers preserve actual quiz mistakes and missing answers without guessing',()=>{
 const rows=capturedAnswerRows('quiz',{state:{questions:[{word:'Phishing',correctAnswer:'Deception'},{word:'Privacy'}],selectedAnswers:[{selected:'Safety',correct:'Deception',isCorrect:false}]}});
 assert.equal(rows[0].answer,'Safety');assert.equal(rows[0].correct,false);assert.equal(rows[1].answer,null);
 assert.deepEqual(capturedAnswerRows('matching',{state:{score:20}}),[]);
});

test('partial historical captures do not masquerade as comparable full attempts',()=>{
 assert.equal(comparableTrend([{finishedAt:'x',accuracy:20,metricLabel:'answers',captureQuality:'partial'},{finishedAt:'x',accuracy:40,metricLabel:'answers',captureQuality:'complete'}]),null);
});
