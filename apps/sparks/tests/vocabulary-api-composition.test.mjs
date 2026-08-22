import assert from 'node:assert/strict';
import test from 'node:test';

globalThis.localStorage = { getItem() { return null; }, setItem() {}, removeItem() {} };
globalThis.window = { location: { href: 'http://127.0.0.1:8000/' } };

const vocabularyApi = await import('../js/services/vocabularyApi.js');
const schoolCalendar = await import('../js/services/schoolCalendar.js');
const vocabularyLoader = await import('../js/services/vocabularyLoader.js');
const vocabularySubjects = await import('../js/services/vocabularySubjects.js');

test('vocabulary API remains a complete compatibility barrel with one owner per export', () => {
    const groups = [schoolCalendar, vocabularyLoader, vocabularySubjects];
    const exportNames = groups.flatMap(group => Object.keys(group));

    assert.equal(new Set(exportNames).size, exportNames.length);
    assert.deepEqual(Object.keys(vocabularyApi).sort(), exportNames.sort());
    assert.deepEqual(
        Object.keys(vocabularyLoader).sort(),
        [
            'invalidateManifestCache', 'invalidateVocabularyFileCache', 'loadCloudVocabularyList',
            'loadManifest', 'loadManifestVocabularyList', 'loadVocabularyFile', 'preloadVocabularyFile'
        ]
    );
});

test('subject normalization preserves defaults and stable custom metadata', () => {
    const subjects = vocabularyApi.normalizeSubjects([
        { slug: 'digital-art', name: 'Digital Art', color: '#112233', sortOrder: 5 }
    ]);

    assert.deepEqual(subjects.map(subject => subject.slug), ['digital-art', 'technology', 'science']);
    assert.deepEqual(vocabularyApi.getSubjectBySlug(subjects, 'digital-art'), {
        slug: 'digital-art', id: 'digital-art', name: 'Digital Art',
        color: '#112233', sortOrder: 5, active: true
    });
    assert.equal(vocabularyApi.getVocabSubjectSlug({ subject: 'Digital Art' }), 'digital-art');
});

test('school calendar calculations retain date-only week boundaries', () => {
    assert.equal(vocabularyApi.calculateCalendarEndDateFromWeekCount('2026-03-02', 2), '2026-03-13');
    assert.equal(vocabularyApi.calculateCalendarWeekCount('2026-03-02', '2026-03-13'), 2);
    assert.deepEqual(vocabularyApi.calculateCalendarWeekRange('2026-03-02', 2), {
        startDate: '2026-03-09',
        endDate: '2026-03-13'
    });
});

test('class schedules normalize aliases and release work on the next class day', () => {
    const calendar = vocabularyApi.normalizeSchoolCalendar({
        schoolYear: '2026',
        classSchedules: [{ grade: '6th', section: 'a', weekdays: ['Monday', 'wed', 3] }]
    });

    assert.deepEqual(calendar.classSchedules, [{ grade: '6', section: 'A', weekdays: [1, 3] }]);
    assert.equal(
        vocabularyApi.calculateClassReleaseDate('2026-08-18', calendar, { grade: '6', group: 'A' }),
        '2026-08-19'
    );
});

test('vocabulary placement uses normalized trimester and month metadata', () => {
    const placement = vocabularyApi.calculateVocabularyPlacement(
        '2026-06-15',
        vocabularyApi.getDefaultSchoolCalendar(new Date(2026, 0, 1))
    );

    assert.deepEqual(placement, {
        assignedDate: '2026-06-15',
        trimester: 'IIT',
        month: 'june',
        week: 2
    });
});
