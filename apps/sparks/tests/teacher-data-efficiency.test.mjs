import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';

import { mapVocabularyMetadata } from '../js/services/vocabularyRepository.js';

const migration = await readFile(new URL(
    '../supabase/migrations/20260816182203_add_paginated_teacher_summaries_and_batch_exports.sql',
    import.meta.url
), 'utf8');
const wordHuntMigration = await readFile(new URL(
    '../supabase/migrations/20260819010000_add_teacher_word_hunt_review_query.sql',
    import.meta.url
), 'utf8');
const identityRosterMigration = await readFile(new URL(
    '../supabase/migrations/20260819202003_add_teacher_identity_roster.sql',
    import.meta.url
), 'utf8');
const placementBatchMigration = await readFile(new URL(
    '../supabase/migrations/20260819202524_batch_vocabulary_placement_updates.sql',
    import.meta.url
), 'utf8');
const authProfileMethods = await readFile(new URL('../js/supabaseAuthProfileMethods.js', import.meta.url), 'utf8');
const exportMethods = await readFile(new URL('../js/teacherDataExportDataMethods.js', import.meta.url), 'utf8');
const progressPageMethods = await readFile(new URL(
    '../js/teacherStudentProgress/teacherProgressPageMethods.js', import.meta.url
), 'utf8');
const dashboardMethods = await readFile(new URL('../js/teacherDataDashboardViewMethods.js', import.meta.url), 'utf8');
const wordHuntMethods = await readFile(new URL(
    '../js/teacherWordHuntReview/teacherWordHuntReviewDataMethods.js', import.meta.url
), 'utf8');
const groupMethods = await readFile(new URL('../js/teacherGroups.js', import.meta.url), 'utf8');
const subjectSettingsMethods = await readFile(new URL('../js/teacherSubjectSettingsMethods.js', import.meta.url), 'utf8');
const calendarSettingsMethods = await readFile(new URL('../js/teacherSchoolCalendarSettingsMethods.js', import.meta.url), 'utf8');
const gamificationSettingsMethods = await readFile(new URL('../js/teacherGamificationSettingsMethods.js', import.meta.url), 'utf8');
const calendarSettingsMethodsSource = calendarSettingsMethods;
const subjectsRepositorySource = await readFile(new URL('../js/services/subjectsRepository.js', import.meta.url), 'utf8');
const vocabularyRepositorySource = await readFile(new URL('../js/services/vocabularyRepository.js', import.meta.url), 'utf8');
const analyticsMigration = await readFile(new URL(
    '../supabase/migrations/20260816230410_add_teacher_roster_filters_and_dashboard_analytics.sql',
    import.meta.url
), 'utf8');

test('teacher roster uses a bounded paginated summary without full activity snapshots', () => {
    assert.match(migration, /list_student_progress_summaries_v1/i);
    assert.match(migration, /least\(greatest\(coalesce\(p_limit, 100\), 1\), 200\)/i);
    const summarySection = migration.split('create or replace function private.get_students_progress_by_ids_v1')[0];
    assert.doesNotMatch(summarySection, /student_progress_snapshot_v2/i);
    assert.match(progressPageMethods, /listStudentProgressSummaries/);
    assert.match(progressPageMethods, /limit: query\.pageSize/);
    assert.match(progressPageMethods, /grade: query\.grade/);
    assert.match(progressPageMethods, /section: query\.section/);
    assert.match(progressPageMethods, /search: query\.search/);
    assert.match(authProfileMethods, /while \(offset < total\)/, 'explicit bulk workflows retain full retrieval');
    assert.match(authProfileMethods, /list_student_progress_summaries_v1/);
});

test('teacher analytics use a server aggregate instead of expanding every student snapshot', () => {
    assert.match(analyticsMigration, /get_teacher_dashboard_analytics_v1/i);
    assert.match(analyticsMigration, /student_activity_progress/i);
    assert.match(analyticsMigration, /limit 30/i);
    assert.match(dashboardMethods, /getTeacherDashboardAnalytics/);
    assert.doesNotMatch(dashboardMethods, /ensureStudentProgressDetails/);
});

test('Word Hunt review fetches only Word Hunt work instead of every complete student snapshot', () => {
    assert.match(wordHuntMigration, /list_word_hunt_reviews_v1/i);
    assert.match(wordHuntMigration, /work_data\s*->\s*'wordHunt'/i);
    assert.doesNotMatch(wordHuntMigration, /student_progress_snapshot_v2|student_coin_ledger|student_activity_state/i);
    assert.doesNotMatch(wordHuntMethods, /ensureStudentProgressDetails/);
    assert.match(wordHuntMethods, /getWordHuntReviewData/);
});

test('group generation and export selection use identity-only roster data', () => {
    assert.match(identityRosterMigration, /list_student_identity_roster_v1/i);
    assert.match(identityRosterMigration, /from public\.profiles/i);
    assert.doesNotMatch(identityRosterMigration, /student_progress|student_activity|student_coin/i);
    assert.doesNotMatch(groupMethods, /getStudentProgressData/);
    assert.match(groupMethods, /getStudentRosterData/);
    assert.doesNotMatch(dashboardMethods, /getStudentProgressData/);
    assert.match(dashboardMethods, /getStudentRosterData/);
    assert.match(groupMethods, /Promise\.all\(\[/);
});

test('teacher settings avoid duplicate database reads when their values are already loaded', () => {
    assert.match(subjectSettingsMethods, /subjectSettingsLoaded/);
    assert.match(calendarSettingsMethods, /schoolCalendarSettingsLoaded/);
    assert.match(gamificationSettingsMethods, /gamificationSettingsLoaded/);
});

test('teacher settings save large collections with bounded database requests', () => {
    assert.doesNotMatch(subjectsRepositorySource, /Promise\.all\(subjects\.map/);
    assert.match(subjectsRepositorySource, /\.upsert\(payloads/);
    assert.match(placementBatchMigration, /update_vocabulary_placements_v1/i);
    assert.match(vocabularyRepositorySource, /updateVocabularyPlacements/);
    assert.doesNotMatch(calendarSettingsMethodsSource, /Promise\.all\(cloudVocabs\.map/);
});

test('data-management settings load together and expose section-level failures', () => {
    assert.match(dashboardMethods, /Promise\.allSettled\(\[/);
    assert.match(dashboardMethods, /loadSubjectSettings\(\{ surfaceErrors: true \}\)/);
    assert.match(dashboardMethods, /loadGamificationSettings\(\{ surfaceErrors: true \}\)/);
    assert.match(dashboardMethods, /loadSchoolCalendarSettings\(\{ surfaceErrors: true \}\)/);
    assert.match(dashboardMethods, /subjects-save-status/);
    assert.match(dashboardMethods, /gamification-save-status/);
    assert.match(dashboardMethods, /school-calendar-save-status/);
});

test('roster failures preserve the last successful page and expose a retry state', () => {
    assert.match(progressPageMethods, /studentProgressLastPage/);
    assert.match(progressPageMethods, /applyStudentProgressPage\(this\.studentProgressLastPage\)/);
    assert.match(progressPageMethods, /data-progress-retry/);
    assert.doesNotMatch(progressPageMethods, /applyStudentProgressData\(\[\]\)/);
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
