import test from 'node:test';
import assert from 'node:assert/strict';
import {StudentActivityAttemptService} from '../js/student/studentActivityAttemptService.js';
import {supabaseService} from '../js/supabaseService.js';
test('untimed foreground reports reach the authenticated timing API and update the attempt',async()=>{
 const original=supabaseService.reportStudentActivityTime;let sent;
 try {
  supabaseService.reportStudentActivityTime=async payload=>{sent=payload;return {attemptId:payload.attemptId,activeSeconds:payload.activeSeconds,isLate:false};};
  const session={activityAttempt:{attemptId:'untimed'},workTimer:{render(){}}};
  const service=new StudentActivityAttemptService({activities:{session},sm:{currentUser:{id:'student'}}});
  await service.reportActiveTime({attemptId:'untimed',activeSeconds:42,timeLimitSeconds:null});
  assert.deepEqual(sent,{attemptId:'untimed',activeSeconds:42});assert.equal(session.activityAttempt.activeSeconds,42);
  assert.equal(session.activityAttempt.isLate,false);
 }finally {supabaseService.reportStudentActivityTime=original;}
});
