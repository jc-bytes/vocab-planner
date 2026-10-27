import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';

const teacherAuth = await readFile(new URL('../js/teacherAuth.js', import.meta.url), 'utf8');

test('teacher session loads independent settings in parallel', () => {
    const parallelLoad = /Promise\.all(?:Settled)?\(\[\s*this\.loadSubjectSettings\([^)]*\),\s*this\.loadSchoolCalendarSettings\([^)]*\)\s*\]\)/;
    assert.match(teacherAuth, parallelLoad);
    assert.equal((teacherAuth.match(new RegExp(parallelLoad.source, 'g')) || []).length, 1);
    assert.match(teacherAuth, /const settingsResults = await Promise\.allSettled\(\[/);
    assert.match(teacherAuth, /signal => this\.loadSubjectSettings/);
    assert.match(teacherAuth, /signal => this\.loadSchoolCalendarSettings/);
});

test('class home starts immediately after authentication', async () => {
    const { installTeacherOverviewMethods } = await import('../js/teacherOverview.js');
    class Manager { ensureAuthenticated() { return this.authenticated; } }
    installTeacherOverviewMethods(Manager);
    const manager = new Manager();
    let calls = 0;
    manager.showClassHome = () => { calls++; return Promise.resolve('classes'); };
    manager.authenticated = false;
    assert.equal(manager.loadTeacherOverview(), undefined);
    assert.equal(calls, 0);
    manager.authenticated = true;
    const pending = manager.loadTeacherOverview();
    assert.equal(calls, 1);
    assert.equal(await pending, 'classes');
});
