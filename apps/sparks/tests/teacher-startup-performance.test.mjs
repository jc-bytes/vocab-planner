import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';

const teacherAuth = await readFile(new URL('../js/teacherAuth.js', import.meta.url), 'utf8');
const teacherOverview = await readFile(new URL('../js/teacherOverview.js', import.meta.url), 'utf8');

test('teacher session loads independent settings in parallel', () => {
    const parallelLoad = /Promise\.all(?:Settled)?\(\[\s*this\.loadSubjectSettings\([^)]*\),\s*this\.loadSchoolCalendarSettings\([^)]*\)\s*\]\)/;
    assert.match(teacherAuth, parallelLoad);
    assert.equal((teacherAuth.match(new RegExp(parallelLoad.source, 'g')) || []).length, 1);
    assert.match(teacherAuth, /const settingsResults = await Promise\.allSettled\(\[/);
    assert.match(teacherAuth, /signal => this\.loadSubjectSettings/);
    assert.match(teacherAuth, /signal => this\.loadSchoolCalendarSettings/);
});

test('overview analytics starts without an artificial idle delay', () => {
    assert.doesNotMatch(teacherOverview, /requestIdleCallback/);
    assert.doesNotMatch(teacherOverview, /setTimeout\(load,\s*1200\)/);
    assert.match(teacherOverview, /void load\(\)/);
});
