import assert from 'node:assert/strict';
import test from 'node:test';

globalThis.window = {
    location: {
        hash: '',
        pathname: '/student.html',
        search: '?preview=1'
    },
    history: {
        calls: [],
        pushState(...args) {
            this.calls.push(['pushState', ...args]);
        },
        replaceState(...args) {
            this.calls.push(['replaceState', ...args]);
        }
    }
};

const { parseHashLocation, writeHashLocation } = await import('../js/services/hashRouting.js');
const { installTeacherRoutingMethods } = await import('../js/teacherRouting.js');

test('shared hash parsing safely decodes path parts and exposes query parameters', () => {
    const location = parseHashLocation('#/unit/week%201/activity/illustration?word=3');

    assert.deepEqual(location.parts, ['unit', 'week 1', 'activity', 'illustration']);
    assert.equal(location.params.get('word'), '3');
    assert.equal(parseHashLocation('#'), null);
    assert.deepEqual(parseHashLocation('#/unit/%E0%A4%A').parts, ['unit', '%E0%A4%A']);
});

test('shared hash writing preserves the page URL and chooses history mode', () => {
    window.history.calls.length = 0;
    window.location.hash = '';

    assert.equal(writeHashLocation('#/menu'), true);
    assert.equal(writeHashLocation('#/units', { replace: true }), true);
    assert.deepEqual(window.history.calls, [
        ['pushState', null, '', '/student.html?preview=1#/menu'],
        ['replaceState', null, '', '/student.html?preview=1#/units']
    ]);

    window.location.hash = '#/units';
    assert.equal(writeHashLocation('#/units'), false);
    assert.equal(window.history.calls.length, 2);
});

test('teacher routes keep their public URL contract through the shared parser', () => {
    class TeacherManager {}
    installTeacherRoutingMethods(TeacherManager);
    const teacher = new TeacherManager();

    assert.deepEqual(teacher.parseRoute('#/teacher/vocabulary/editor/week%201'), {
        view: 'editor',
        vocabularyId: 'week 1'
    });
    assert.deepEqual(teacher.parseRoute('#/teacher/data?tab=export'), {
        view: 'data',
        tab: 'export'
    });
    assert.equal(
        teacher.buildRoute({ view: 'vocabulary', grade: '7', mode: 'review' }),
        '#/teacher/vocabulary?grade=7&mode=review'
    );
});
