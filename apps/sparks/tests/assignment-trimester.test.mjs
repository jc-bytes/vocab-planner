import test from 'node:test';
import assert from 'node:assert/strict';
import { assignmentTrimester } from '../js/assignmentTrimester.js';
const calendar = { schoolYear:'2026', trimesters:{IT:{startDate:'2026-03-02',endDate:'2026-05-29'},IIT:{startDate:'2026-06-08',endDate:'2026-09-04'},IIIT:{startDate:'2026-09-14',endDate:'2026-12-11'}},academicYears:{'2025':{trimesters:{IT:{startDate:'2025-01-01',endDate:'2025-12-31'}}}}};
test('matches each trimester and includes start and end dates',()=>{
    for(const [date,expected] of [['2026-03-02', '1'],['2026-05-29','1'],['2026-06-08','2'],['2026-09-04','2'],['2026-09-14','3'],['2026-12-11','3']])
        assert.equal(assignmentTrimester({release_at:`${date}T12:00:00Z`},calendar,2026,'America/Panama'),expected);
});
test('uses school timezone at the trimester boundary',()=>{
    assert.equal(assignmentTrimester({release_at:'2026-09-14T02:00:00Z'},calendar,2026,'America/Panama'),'outside');
    assert.equal(assignmentTrimester({release_at:'2026-09-14T05:00:00Z'},calendar,2026,'America/Panama'),'3');
});
test('uses the class academic year rather than the current year',()=>{
    assert.equal(assignmentTrimester({release_at:'2025-07-01T12:00:00Z'},calendar,2025),'1');
    assert.equal(assignmentTrimester({release_at:'2025-07-01T12:00:00Z'},calendar,2024),'unknown');
});
test('never infers trimester from an assignment title',()=>{
    assert.equal(assignmentTrimester({title:'T3 lesson',release_at:'2026-06-08T12:00:00Z'},calendar,2026),'2');
    assert.equal(assignmentTrimester({title:'T3 lesson'},calendar,2026),'unknown');
    assert.equal(assignmentTrimester({release_at:'invalid'},calendar,2026),'unknown');
    assert.equal(assignmentTrimester({release_at:'2026-07-01T00:00:00Z'},null,2026),'unknown');
});
