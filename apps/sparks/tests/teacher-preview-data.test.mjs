import assert from 'node:assert/strict';
import test from 'node:test';
import { cloneTeacherPreviewData } from '../js/teacherPreviewData.js';
import { toClientTimestamp } from '../js/services/supabaseValues.js';

test('preview copies repository timestamps as date values without mutating library data', () => {
    const timestamp = toClientTimestamp('2026-10-18T12:00:00Z');
    const source = { type: 'teacher-unit-preview', vocab: {
        createdAt: timestamp, updatedAt: timestamp,
        words: [{ word: 'packet', definition: 'A piece of a message.' }],
        activitySettings: { requiredActivities: ['flashcards'] }
    }, subjects: [{ createdAt: timestamp }] };
    const copy = cloneTeacherPreviewData(source);
    assert.equal(copy.vocab.createdAt, '2026-10-18T12:00:00.000Z');
    assert.equal(copy.subjects[0].createdAt, copy.vocab.createdAt);
    assert.deepEqual(structuredClone(copy), copy);
    copy.vocab.words[0].word = 'changed';
    copy.vocab.activitySettings.requiredActivities.push('matching');
    assert.equal(source.vocab.words[0].word, 'packet');
    assert.deepEqual(source.vocab.activitySettings.requiredActivities, ['flashcards']);
    assert.equal(timestamp.toDate().toISOString(), copy.vocab.createdAt);
});

test('preview preserves JSON content and rejects unexpected functions', () => {
    const source = { spark: { questions: [{ correctOption: 0, required: false, answer: null }], title: 'Read' } };
    assert.deepEqual(cloneTeacherPreviewData(source), source);
    assert.throws(() => cloneTeacherPreviewData({ callback() {} }), /must not contain functions/);
});
