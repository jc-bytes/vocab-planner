import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';

const teacherAuth = await readFile(new URL('../js/teacherAuth.js', import.meta.url), 'utf8');
const teacherOverview = await readFile(new URL('../js/teacherOverview.js', import.meta.url), 'utf8');

test('teacher session loads independent settings in parallel', () => {
    const parallelLoad = /Promise\.all\(\[\s*this\.loadSubjectSettings\([^)]*\),\s*this\.loadSchoolCalendarSettings\([^)]*\)\s*\]\)/;
    assert.match(teacherAuth, parallelLoad);
    assert.equal((teacherAuth.match(new RegExp(parallelLoad.source, 'g')) || []).length, 2);
});

test('overview analytics starts without an artificial idle delay', () => {
    assert.doesNotMatch(teacherOverview, /requestIdleCallback/);
    assert.doesNotMatch(teacherOverview, /setTimeout\(load,\s*1200\)/);
    assert.match(teacherOverview, /void load\(\)/);
});
