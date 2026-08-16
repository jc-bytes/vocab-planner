import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';

import { mapVocabularyMetadata } from '../js/services/vocabularyRepository.js';

const migration = await readFile(new URL(
    '../supabase/migrations/20260816182203_add_paginated_teacher_summaries_and_batch_exports.sql',
    import.meta.url
), 'utf8');
const authProfileMethods = await readFile(new URL('../js/supabaseAuthProfileMethods.js', import.meta.url), 'utf8');
const exportMethods = await readFile(new URL('../js/teacherDataExportDataMethods.js', import.meta.url), 'utf8');

test('teacher roster uses a bounded paginated summary without full activity snapshots', () => {
    assert.match(migration, /list_student_progress_summaries_v1/i);
    assert.match(migration, /least\(greatest\(coalesce\(p_limit, 100\), 1\), 200\)/i);
    const summarySection = migration.split('create or replace function private.get_students_progress_by_ids_v1')[0];
    assert.doesNotMatch(summarySection, /student_progress_snapshot_v2/i);
    assert.match(authProfileMethods, /while \(offset < total\)/);
    assert.match(authProfileMethods, /list_student_progress_summaries_v1/);
});

test('teacher detail and export requests use a bounded batch RPC', () => {
    assert.match(migration, /get_students_progress_by_ids_v1/i);
    assert.match(migration, /cardinality\(requested_ids\) > 200/i);
    assert.match(exportMethods, /getStudentProgressBatch\(studentIds\)/);
    assert.match(exportMethods, /listScoresForUsers\(studentIds\)/);
    assert.doesNotMatch(exportMethods, /for \(const studentId of studentIds\)/);
});

test('vocabulary catalog metadata carries counts without retaining word arrays', () => {
    assert.match(migration, /list_vocabulary_metadata_v1/i);
    assert.match(migration, /jsonb_array_length\(vocabulary\.words\)/i);
    const metadataFunction = migration.split('create or replace function public.list_vocabulary_metadata_v1')[1];
    assert.doesNotMatch(metadataFunction, /'words',\s*vocabulary\.words/i);

    const vocabulary = mapVocabularyMetadata({
        id: 'unit-1', name: 'Metadata', subjectSlug: 'technology', wordCount: 24,
        updatedAt: '2026-08-16T12:00:00.000Z'
    });
    assert.equal(vocabulary.wordCount, 24);
    assert.equal(vocabulary.words, undefined);
    assert.equal(vocabulary.metadataOnly, true);
    assert.equal(vocabulary.updatedAt.toDate().toISOString(), '2026-08-16T12:00:00.000Z');
});
