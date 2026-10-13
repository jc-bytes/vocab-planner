import test from 'node:test';
import assert from 'node:assert/strict';
import {readingReviewStatus} from '../js/teacherStudentFeedbackModel.js';
import {buildStudentInsight} from '../js/teacherStudentInsightModel.js';
import {assignmentResultRows} from '../js/teacherAssignmentResults.js';
const response={revision:2,evaluation:{needsTeacherReview:true,isComplete:true}};
const feedback={review_status:'reviewed',response_revision:2,activity_type:'',student_id:'s'};
test('acceptance applies only to the reviewed response revision and preserves automatic failures',()=>{
 assert.equal(readingReviewStatus(response,feedback),'Completed');
 assert.equal(readingReviewStatus({...response,revision:3},feedback),'Needs review');
 assert.equal(readingReviewStatus({...response,evaluation:{isComplete:false,needsTeacherReview:true}},feedback),'In progress');
 assert.equal(readingReviewStatus(response,{...feedback,review_status:'needs_revision'}),'Needs revision');
 assert.equal(readingReviewStatus(null,feedback),'Not started');
});
test('student profile and assignment review share revision-aware completion',()=>{
 const a={id:'a',kind:'spark',enrolled:true,releaseAt:'2026-01-01',dueAt:'2026-02-01',content:{checkMode:'required'},response,feedback:[feedback]};
 assert.equal(buildStudentInsight({assignments:[a]}).summary.completed,1);
 assert.equal(assignmentResultRows('spark',[{...response,student_id:'s'}],[],[feedback])[0].status,'Completed');
 const stale={...a,response:{...response,revision:3}};
 assert.equal(buildStudentInsight({assignments:[stale]}).summary.review,1);
 assert.equal(assignmentResultRows('spark',[{...stale.response,student_id:'s'}],[],[feedback])[0].needsTeacherReview,true);
});
test('requesting a revision produces an actionable unfinished task',()=>{
 const a={id:'a',kind:'spark',enrolled:true,releaseAt:'2026-01-01',dueAt:'2026-02-01',content:{checkMode:'required'},response,feedback:[{...feedback,review_status:'needs_revision'}]};
 const summary=buildStudentInsight({assignments:[a]}).summary;
 assert.equal(summary.needsRevision,1);assert.equal(summary.overdue,1);assert.equal(summary.completed,0);
});

test('notes on untouched assignments remain visible in class review after reload',()=>{
 const row=assignmentResultRows('vocabulary',[],[{studentId:'s',name:'Alex'}],[{...feedback,review_status:'unreviewed',note:'Check in next lesson'}])[0];
 assert.equal(row.status,'No work submitted');assert.equal(row.feedback.note,'Check in next lesson');
});
