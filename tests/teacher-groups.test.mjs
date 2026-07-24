import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import {
    getStudentClassKey,
    getStudentDisplayName,
    pairKey,
    randomizeStudentsWithRestrictions,
    randomizeStudents
} from '../js/teacherGroupsLogic.js';

const student = (id, firstName, lastName, grade = '6', group = 'B') => ({
    id,
    studentProfile: { firstName, lastName, grade, group }
});

test('group generator derives a combined class label and display name', () => {
    const ana = student('1', 'Ana', 'Torres', '6', 'b');
    assert.equal(getStudentClassKey(ana), '6B');
    assert.equal(getStudentDisplayName(ana), 'Ana Torres');
});

test('randomizeStudents creates pairs without losing or duplicating students', () => {
    const students = Array.from({ length: 6 }, (_, index) => student(String(index), `Student ${index}`, 'Test'));
    const groups = randomizeStudents(students, 2, () => 0.25);

    assert.deepEqual(groups.map(group => group.length), [2, 2, 2]);
    assert.deepEqual(
        groups.flat().map(item => item.id).sort(),
        students.map(item => item.id).sort()
    );
});

test('an odd number of students is balanced without leaving a singleton', () => {
    const students = Array.from({ length: 5 }, (_, index) => student(String(index), `Student ${index}`, 'Test'));
    const groups = randomizeStudents(students, 2, () => 0.5);

    assert.deepEqual(groups.map(group => group.length), [3, 2]);
    assert.ok(groups.every(group => group.length >= 2));
});

test('larger requested groups also avoid a one-student remainder', () => {
    const students = Array.from({ length: 7 }, (_, index) => student(String(index), `Student ${index}`, 'Test'));
    const groups = randomizeStudents(students, 3, () => 0.75);

    assert.deepEqual(groups.map(group => group.length), [4, 3]);
});

test('saved student pairs never appear in the same group across repeated reshuffles', () => {
    const students = Array.from({ length: 12 }, (_, index) => student(String(index), `Student ${index}`, 'Test'));
    const restrictions = [
        { studentAId: '0', studentBId: '1' },
        { studentAId: '2', studentBId: '3' },
        { studentAId: '4', studentBId: '5' }
    ];
    const blocked = new Set(restrictions.map(item => pairKey(item.studentAId, item.studentBId)));

    for (let attempt = 0; attempt < 100; attempt += 1) {
        const groups = randomizeStudentsWithRestrictions(students, 2, restrictions);
        assert.ok(groups, `reshuffle ${attempt + 1} should find a valid arrangement`);
        groups.forEach(group => {
            for (let left = 0; left < group.length; left += 1) {
                for (let right = left + 1; right < group.length; right += 1) {
                    assert.equal(blocked.has(pairKey(group[left].id, group[right].id)), false);
                }
            }
        });
    }
});

test('generator returns no groups when restrictions make a valid arrangement impossible', () => {
    const students = [
        student('1', 'One', 'Student'),
        student('2', 'Two', 'Student'),
        student('3', 'Three', 'Student')
    ];
    const restrictions = [
        { studentAId: '1', studentBId: '2' },
        { studentAId: '1', studentBId: '3' },
        { studentAId: '2', studentBId: '3' }
    ];

    assert.equal(randomizeStudentsWithRestrictions(students, 2, restrictions), null);
});

test('teacher overview exposes direct group-generator shortcuts', async () => {
    const [html, listeners] = await Promise.all([
        readFile(new URL('../teacher.html', import.meta.url), 'utf8'),
        readFile(new URL('../js/teacherGlobalListeners.js', import.meta.url), 'utf8')
    ]);

    assert.match(html, /id="overview-groups-btn"[\s\S]*?Randomize Groups/);
    assert.match(html, /id="overview-groups-action-btn"[\s\S]*?Randomize groups/);
    assert.match(listeners, /overview-groups-btn[\s\S]*?showTeacherSection\('groups'\)/);
    assert.match(listeners, /overview-groups-action-btn[\s\S]*?showTeacherSection\('groups'\)/);
});

test('pairing restrictions have a private device fallback when cloud storage is unavailable', async () => {
    const groupsSource = await readFile(new URL('../js/teacherGroups.js', import.meta.url), 'utf8');

    assert.match(groupsSource, /groupRestrictionsLocalFallback = true/);
    assert.match(groupsSource, /Restrictions are private and saved on this device/);
    assert.match(groupsSource, /localStorage\.setItem\(/);
});
