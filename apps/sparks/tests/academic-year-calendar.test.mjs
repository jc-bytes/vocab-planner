import test from 'node:test';
import assert from 'node:assert/strict';
import { getAcademicYearCalendar, withAcademicYearCalendar } from '../js/services/academicYearCalendar.js';
import { getDefaultSchoolCalendar, normalizeSchoolCalendar } from '../js/services/schoolCalendar.js';
const calendar = () => getDefaultSchoolCalendar(new Date(2026, 0, 1, 12));
const future = {IT:{startDate:'2027-03-01',endDate:'2027-05-28'},IIT:{startDate:'2027-06-07',endDate:'2027-09-03'},IIIT:{startDate:'2027-09-13',endDate:'2027-12-10'}};
test('another year retains the active dates and class schedules', () => {
 const source=calendar();source.classSchedules=[{grade:'6',section:'A',weekdays:[1]}];
 const saved=withAcademicYearCalendar(source,2027,future);
 assert.deepEqual(saved.trimesters,source.trimesters);assert.equal(saved.schoolYear,'2026');
 assert.deepEqual(saved.classSchedules,source.classSchedules);
 assert.equal(getAcademicYearCalendar(saved,2027).trimesters.IT.weekCount,13);
 assert.deepEqual(getAcademicYearCalendar(normalizeSchoolCalendar(saved),2027),getAcademicYearCalendar(saved,2027));
 assert.equal(source.academicYears,undefined);
});
test('saving the active year synchronizes legacy and year-specific dates', () => {
 const source=withAcademicYearCalendar(calendar(),2027,future);
 const dates=structuredClone(source.trimesters);dates.IT.startDate='2026-03-03';
 const saved=withAcademicYearCalendar(source,2026,dates);
 assert.equal(saved.trimesters.IT.startDate,'2026-03-03');
 assert.deepEqual(saved.academicYears['2026'].trimesters,saved.trimesters);
 assert.equal(saved.academicYears['2027'].trimesters.IT.startDate,'2027-03-01');
});
test('the first configured year becomes the active calendar and unknown years have no invented dates', () => {
 const saved=withAcademicYearCalendar({},2027,future);
 assert.equal(saved.schoolYear,'2027');assert.equal(getAcademicYearCalendar(saved,2028),null);
});
test('invalid, reversed and overlapping date ranges cannot be saved', () => {
 for(const [startDate,endDate] of [['2027-02-30','2027-05-28'],['2027-06-01','2027-05-28'],['','']])assert.throws(()=>withAcademicYearCalendar({},2027,{...future,IT:{startDate,endDate}}));
 assert.throws(()=>withAcademicYearCalendar({},2027,{...future,IIT:{startDate:'2027-05-28',endDate:'2027-09-03'}}),/previous trimester/);
});
