import test from 'node:test';
import assert from 'node:assert/strict';
import { buildStudentInsight } from '../js/teacherStudentInsightModel.js';
import { assignmentProgressSeries, activityAccuracySeries, dashboardActivityChoices } from '../js/teacherStudentGraphModel.js';
const now = Date.parse('2026-10-06');
const assignment = extra => ({id:'vocab',title:'Safety',kind:'vocabulary',enrolled:true,releaseAt:'2026-10-01',content:{activitySettings:{requiredActivities:['quiz','matching']}},...extra});
test('progress bars include untouched required tasks and keep teacher review separate',()=>{
 const model=buildStudentInsight({assignments:[assignment({progress:[{activity_type:'quiz',verified:true,is_complete:true}]}),
  assignment({id:'reading',kind:'spark',content:{checkMode:'required'},response:{evaluation:{needsTeacherReview:true}}}),
  assignment({id:'unknown',content:{}}),assignment({id:'scheduled',releaseAt:'2099-01-01'})]},now);
 assert.deepEqual(assignmentProgressSeries(model).map(({id,total,completed,review,remaining})=>({id,total,completed,review,remaining})),[
  {id:'vocab',total:2,completed:1,review:0,remaining:1},{id:'reading',total:1,completed:0,review:1,remaining:0}]);
 assert.deepEqual(dashboardActivityChoices(model).map(a=>a.type),['quiz','matching']);
});
test('accuracy uses finished complete captures with the latest metric, ordered by finish time',()=>{
 const attempt=(extra={})=>({attemptId:'a',finishedAt:'2026-10-05',accuracy:40,metricLabel:'correct answers',captureQuality:'complete',...extra});
 const series=activityAccuracySeries([attempt({attemptId:'new',finishedAt:'2026-10-06',accuracy:80}),
  attempt({attemptId:'old',finishedAt:'2026-10-01',accuracy:0}),attempt({metricLabel:'pairs matched',accuracy:95}),
  attempt({captureQuality:'partial',accuracy:100}),attempt({finishedAt:null}),attempt({finishedAt:'bad'}),
  attempt({accuracy:null}),attempt({accuracy:''}),attempt({accuracy:101}),attempt({metricLabel:''})]);
 assert.equal(series.metricLabel,'correct answers');
 assert.deepEqual(series.points.map(p=>[p.attemptId,p.accuracy]),[['old',0],['new',80]]);
});
test('empty and partial history never creates invented trend points',()=>{
 assert.deepEqual(activityAccuracySeries([]),{metricLabel:'',points:[]});
 assert.equal(activityAccuracySeries([{accuracy:40,finishedAt:'2026-10-05',captureQuality:'partial',metricLabel:'correct'}]).points.length,0);
});
