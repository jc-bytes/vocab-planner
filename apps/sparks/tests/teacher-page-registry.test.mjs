import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const { defineTeacherPages, teacherPageRegistry } = await import('../js/teacherPageRegistry.js');

const EXPECTED_PRIMARY_PAGES = [
    { id: 'overview', viewId: 'teacher-overview-view' },
    { id: 'vocabulary', viewId: 'teacher-dashboard-view' },
    { id: 'sparks', viewId: 'teacher-sparks-view' },
    { id: 'students', viewId: 'teacher-progress-view' },
    { id: 'groups', viewId: 'teacher-groups-view' },
    { id: 'data', viewId: 'teacher-data-management-view' },
    { id: 'settings', viewId: 'teacher-data-management-view' }
];

function readAttribute(tag, name) {
    return tag.match(new RegExp(`\\b${name}=["']([^"']+)["']`))?.[1] || null;
}

test('teacher page registry matches every top-level navigation destination', async () => {
    const [teacherHtml, teacherShell] = await Promise.all([
        readFile(new URL('../teacher.html', import.meta.url), 'utf8'),
        readFile(new URL('../js/teacherShell.js', import.meta.url), 'utf8')
    ]);
    const htmlPages = Array.from(teacherHtml.matchAll(/<button\b[^>]*>/g), match => match[0])
        .filter(tag => (readAttribute(tag, 'class') || '').split(/\s+/).includes('teacher-tab'))
        .map(tag => ({
            id: readAttribute(tag, 'data-section'),
            viewId: readAttribute(tag, 'aria-controls')
        }));

    assert.equal(Object.isFrozen(teacherPageRegistry), true);
    assert.equal(Object.isFrozen(teacherPageRegistry.pages), true);
    teacherPageRegistry.pages.forEach(page => {
        assert.equal(Object.isFrozen(page), true);
        assert.deepEqual(Object.keys(page), ['id', 'viewId']);
        assert.equal(teacherPageRegistry.get(page.id), page);
    });
    assert.deepEqual(teacherPageRegistry.pages, EXPECTED_PRIMARY_PAGES);
    assert.deepEqual(htmlPages, EXPECTED_PRIMARY_PAGES);
    assert.match(teacherShell, /teacherPageRegistry\.pages\.map\(page => page\.viewId\)/);
    EXPECTED_PRIMARY_PAGES.forEach(page => {
        assert.match(teacherHtml, new RegExp(`\\sid=["']${page.viewId}["']`));
    });
    assert.equal(teacherPageRegistry.get('quizzes'), null);
    assert.equal(teacherPageRegistry.get('word-hunt-review'), null);
});

test('teacher page descriptors reject ambiguous registration', () => {
    const base = { id: 'overview', viewId: 'overview-view' };
    assert.throws(() => defineTeacherPages([]), /at least one descriptor/);
    assert.throws(() => defineTeacherPages([null]), /descriptors must be objects/);
    assert.throws(() => defineTeacherPages([{ ...base, label: 'Overview' }]), /unsupported field label/);
    assert.throws(() => defineTeacherPages([base, { ...base }]), /Duplicate teacher page id/);
    assert.throws(() => defineTeacherPages([
        base,
        { id: 'students', viewId: 'overview-view' }
    ]), /Duplicate teacher page view/);

    const sharedDataView = defineTeacherPages([
        { id: 'data', viewId: 'data-view' },
        { id: 'settings', viewId: 'data-view' }
    ]);
    assert.equal(sharedDataView.pages.length, 2);
});

test('teacher history has one hash-route event authority', async () => {
    const listenerSource = await readFile(new URL('../js/teacherGlobalListeners.js', import.meta.url), 'utf8');
    assert.equal((listenerSource.match(/addEventListener\('hashchange'/g) || []).length, 1);
    assert.doesNotMatch(listenerSource, /addEventListener\('popstate'/);
});
