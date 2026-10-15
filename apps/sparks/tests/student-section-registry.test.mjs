import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const studentHtml = await readFile(new URL('../student.html', import.meta.url), 'utf8');
const {
    STUDENT_SECTIONS,
    getStudentSectionForRoutePath,
    getStudentSectionForView
} = await import('../js/student/studentSectionRegistry.js');

test('student section registry matches every real tab and owned view', () => {
    assert.deepEqual(STUDENT_SECTIONS.map(section => section.id), [
        'today',
        'vocabulary',
        'sparks',
        'arcade'
    ]);

    for (const section of STUDENT_SECTIONS) {
        assert.match(studentHtml, new RegExp(`id="${section.tabId}"`));
        assert.match(studentHtml, new RegExp(`data-section="${section.id}"`));
        for (const viewId of section.viewIds) {
            assert.match(studentHtml, new RegExp(`id="${viewId}"`));
            assert.equal(getStudentSectionForView(viewId), section.id);
        }
    }

    assert.equal(getStudentSectionForView('login-view'), '');
});

test('student section registry resolves direct route families to the same section as tabs', () => {
    assert.equal(getStudentSectionForRoutePath('menu'), 'today');
    assert.equal(getStudentSectionForRoutePath('units'), 'vocabulary');
    assert.equal(getStudentSectionForRoutePath('unit/digital-citizenship'), 'vocabulary');
    assert.equal(getStudentSectionForRoutePath('sparks'), 'sparks');
    assert.equal(getStudentSectionForRoutePath('arcade'), 'arcade');
    assert.equal(getStudentSectionForRoutePath('unknown'), 'today');
});
