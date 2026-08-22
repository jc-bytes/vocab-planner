import test from 'node:test';
import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';

import {
    AUDIT_PASSWORD,
    AUDIT_STUDENT_EMAIL,
    AUDIT_TEACHER_EMAIL,
    seedLocalAuditData
} from '../scripts/lib/local-supabase-audit.mjs';
import { leaderboardRepository } from '../js/services/leaderboardRepository.js';
import { settingsRepository } from '../js/services/settingsRepository.js';
import { sparksRepository } from '../js/services/sparksRepository.js';
import { studentProgressRepository } from '../js/services/studentProgressRepository.js';
import { subjectsRepository } from '../js/services/subjectsRepository.js';
import { teacherExportRepository } from '../js/services/teacherExportRepository.js';
import { vocabularyRepository } from '../js/services/vocabularyRepository.js';
import { supabaseService } from '../js/supabaseService.js';
import {
    getActiveStudentStorageOwner,
    setActiveStudentStorageOwner
} from '../js/student/persistence/studentStorage.js';

const RUN_ID = `acceptance-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const IDS = {
    settings: `${RUN_ID}-settings`,
    subject: `${RUN_ID}-subject`,
    vocabulary: `${RUN_ID}-vocabulary`,
    spark: `${RUN_ID}-spark`,
    unit: `${RUN_ID}-unit`,
    peerEmail: `${RUN_ID}@aid.edu.pa`,
    signupEmail: `${RUN_ID}-public@aid.edu.pa`,
    exportFilename: `${RUN_ID}.json`
};

function localClient(browserConfig) {
    return createClient(browserConfig.url, browserConfig.publishableKey, {
        auth: {
            autoRefreshToken: false,
            detectSessionInUrl: false,
            persistSession: false
        }
    });
}

async function signIn(client, email) {
    const { data, error } = await client.auth.signInWithPassword({ email, password: AUDIT_PASSWORD });
    if (error) throw error;
    assert.ok(data.user?.id, `Expected a signed-in user for ${email}`);
    await client.realtime.setAuth(data.session.access_token);
    return data.user;
}

async function withServiceClient(client, callback) {
    const previousClient = supabaseService.client;
    const previousUser = supabaseService.currentUser;
    const previousSession = supabaseService.currentSession;
    const previousInitialized = supabaseService.initialized;
    const previousInitPromise = supabaseService.initPromise;
    supabaseService.client = client;
    supabaseService.initialized = true;
    supabaseService.initPromise = null;
    try {
        return await callback();
    } finally {
        supabaseService.client = previousClient;
        supabaseService.currentUser = previousUser;
        supabaseService.currentSession = previousSession;
        supabaseService.initialized = previousInitialized;
        supabaseService.initPromise = previousInitPromise;
    }
}

async function expectRejected(operation, messagePattern = null) {
    let caught = null;
    try {
        await operation();
    } catch (error) {
        caught = error;
    }
    assert.ok(caught, 'Expected the operation to be rejected by authorization or validation.');
    if (messagePattern) {
        assert.match(String(caught.message || caught), messagePattern);
    }
    return caught;
}

async function waitFor(predicate, message, timeoutMs = 8000) {
    const started = Date.now();
    let lastError = null;
    while (Date.now() - started < timeoutMs) {
        try {
            if (await predicate()) return;
        } catch (error) {
            lastError = error;
        }
        await new Promise(resolve => setTimeout(resolve, 50));
    }
    throw new Error(`${message}${lastError ? `: ${lastError.message}` : ''}`);
}

function channelJoined(client) {
    return client.getChannels().length === 1 && client.getChannels()[0]?.state === 'joined';
}

async function createPeerStudent(admin) {
    const provisioningToken = crypto.randomUUID();
    await admin.rpc('issue_auth_user_provisioning_ticket', {
        p_email: IDS.peerEmail,
        p_token: provisioningToken
    }).throwOnError();
    const { data: created, error: createError } = await admin.auth.admin.createUser({
        email: IDS.peerEmail,
        password: AUDIT_PASSWORD,
        email_confirm: true,
        user_metadata: {
            first_name: 'Acceptance',
            last_name: 'Peer',
            provisioning_token: provisioningToken
        }
    });
    if (createError) throw createError;
    const peer = created.user;
    await admin.auth.admin.updateUserById(peer.id, {
        user_metadata: { first_name: 'Acceptance', last_name: 'Peer' }
    });
    await admin.from('profiles').upsert({
        user_id: peer.id,
        role: 'student',
        first_name: 'Acceptance',
        last_name: 'Peer',
        email: IDS.peerEmail,
        grade_level: 7,
        section_letter: 'B',
        must_change_password: false
    }, { onConflict: 'user_id' }).throwOnError();
    await admin.rpc('provision_student_progress_v2', {
        p_student_id: peer.id,
        p_student_profile: {
            firstName: 'Acceptance', lastName: 'Peer', name: 'Acceptance Peer',
            email: IDS.peerEmail, grade: '7', group: 'B'
        }
    }).throwOnError();
    return peer;
}

async function cleanupAcceptanceData({ admin, peer, student }) {
    await admin.from('export_logs').delete().eq('filename', IDS.exportFilename);
    await admin.from('weekly_sparks').delete().eq('id', IDS.spark);
    await admin.from('vocabularies').delete().eq('id', IDS.vocabulary);
    await admin.from('app_settings').delete().eq('key', IDS.settings);
    await admin.from('subjects').delete().eq('slug', IDS.subject);
    await admin.from('scores').delete().eq('user_id', student.id).eq('game_id', 'snake');
    await admin.from('student_xp_events').delete().eq('user_id', student.id).eq('unit_key', `technology:${IDS.vocabulary}`);
    if (peer?.id) await admin.auth.admin.deleteUser(peer.id);
}

test('local Supabase repository, RLS, RPC, and Realtime acceptance', { timeout: 120000 }, async t => {
    const seeded = await seedLocalAuditData();
    const { admin, browserConfig, users } = seeded;
    const teacherClient = localClient(browserConfig);
    const studentClient = localClient(browserConfig);
    const peerClient = localClient(browserConfig);
    const anonClient = localClient(browserConfig);
    let peer = null;

    try {
        const teacher = await signIn(teacherClient, AUDIT_TEACHER_EMAIL);
        const student = await signIn(studentClient, AUDIT_STUDENT_EMAIL);
        peer = await createPeerStudent(admin);
        await signIn(peerClient, IDS.peerEmail);
        assert.equal(teacher.id, users.teacher.id);
        assert.equal(student.id, users.student.id);

        await t.test('Public signup is disabled', async () => {
            const { data, error } = await anonClient.auth.signUp({
                email: IDS.signupEmail,
                password: AUDIT_PASSWORD
            });
            if (data.user?.id) await admin.auth.admin.deleteUser(data.user.id);
            assert.ok(error, 'Expected unauthenticated signup to be rejected.');
        });

        await t.test('Students cannot change grade, section, role, or email', async () => {
            const { error } = await studentClient
                .from('profiles')
                .update({
                    grade_level: 9,
                    section_letter: 'Z',
                    role: 'teacher',
                    email: IDS.signupEmail
                })
                .eq('user_id', student.id);
            assert.ok(error, 'Expected protected profile fields to reject student updates.');

            const { data: profile, error: readError } = await studentClient
                .from('profiles')
                .select('grade_level,section_letter,role,email')
                .eq('user_id', student.id)
                .single();
            if (readError) throw readError;
            assert.equal(profile.role, 'student');
            assert.notEqual(profile.grade_level, 9);
            assert.notEqual(profile.section_letter, 'Z');
            assert.notEqual(profile.email, IDS.signupEmail);
        });

        await t.test('Teacher settings mutation succeeds and Student mutation is denied', async () => {
            await withServiceClient(teacherClient, () => settingsRepository.save(IDS.settings, {
                marker: 'teacher-created', count: 1
            }));
            const created = await withServiceClient(teacherClient, () => settingsRepository.get(IDS.settings));
            assert.equal(created.marker, 'teacher-created');
            assert.equal(created.count, 1);
            assert.equal(typeof created.updatedAt.toDate, 'function');

            await withServiceClient(teacherClient, () => settingsRepository.save(IDS.settings, {
                marker: 'teacher-updated', count: 2
            }));
            const updated = await withServiceClient(teacherClient, () => settingsRepository.get(IDS.settings));
            assert.equal(updated.marker, 'teacher-updated');
            assert.equal(updated.count, 2);

            await expectRejected(() => withServiceClient(studentClient, () => (
                settingsRepository.save(IDS.settings, { marker: 'student-denied' })
            )));
            const preserved = await withServiceClient(teacherClient, () => settingsRepository.get(IDS.settings));
            assert.equal(preserved.marker, 'teacher-updated');
        });

        await t.test('Teacher subject mutation succeeds and Student create/update/delete are denied', async () => {
            await withServiceClient(teacherClient, () => subjectsRepository.saveAll([{
                slug: IDS.subject, name: 'Acceptance Subject', color: '#123456', sortOrder: 987, active: true
            }]));
            let subject = (await withServiceClient(teacherClient, () => subjectsRepository.list()))
                .find(item => item.slug === IDS.subject);
            assert.deepEqual({ name: subject.name, sortOrder: subject.sortOrder, active: subject.active }, {
                name: 'Acceptance Subject', sortOrder: 987, active: true
            });

            await withServiceClient(teacherClient, () => subjectsRepository.saveAll([{
                ...subject, name: 'Acceptance Subject Updated', active: false
            }]));
            subject = (await withServiceClient(teacherClient, () => subjectsRepository.list()))
                .find(item => item.slug === IDS.subject);
            assert.equal(subject.name, 'Acceptance Subject Updated');
            assert.equal(subject.active, false);

            await expectRejected(() => withServiceClient(studentClient, () => subjectsRepository.saveAll([{
                ...subject, name: 'Student Update Denied'
            }])));
            await expectRejected(() => withServiceClient(studentClient, () => subjectsRepository.saveAll([{
                slug: `${IDS.subject}-student`, name: 'Student Create Denied', color: '#654321'
            }])));

            const { data: deleted, error: deleteError } = await studentClient
                .from('subjects').delete().eq('slug', IDS.subject).select('slug');
            if (deleteError) assert.match(deleteError.message, /permission|policy|row-level security/i);
            assert.deepEqual(deleted || [], []);
            const stillPresent = (await withServiceClient(teacherClient, () => subjectsRepository.list()))
                .some(item => item.slug === IDS.subject);
            assert.equal(stillPresent, true);
        });

        await t.test('Teacher vocabulary CRUD succeeds and Student mutations are denied', async () => {
            const source = {
                name: 'Acceptance Vocabulary', description: 'Created by local acceptance validation',
                grades: ['6'], subjectSlug: 'technology', assignedDate: '2026-07-14',
                trimester: '1', month: 'July', week: 2,
                activitySettings: { completionBonus: 25 },
                words: [{ word: 'Repository', definition: 'A domain data access boundary.' }],
                ownerId: teacher.id
            };
            const saved = await withServiceClient(teacherClient, () => vocabularyRepository.save(IDS.vocabulary, source));
            assert.equal(saved.id, IDS.vocabulary);
            let vocabulary = await withServiceClient(teacherClient, () => vocabularyRepository.get(IDS.vocabulary));
            assert.equal(vocabulary.id, IDS.vocabulary);
            assert.equal(vocabulary.name, source.name);
            assert.equal(vocabulary.subjectSlug, 'technology');
            assert.equal(vocabulary.createdAt.toDate() instanceof Date, true);
            assert.equal(vocabulary.updatedAt.toDate() instanceof Date, true);
            assert.equal((await withServiceClient(teacherClient, () => vocabularyRepository.list()))
                .some(item => item.id === IDS.vocabulary), true);
            const metadata = (await withServiceClient(teacherClient, () => vocabularyRepository.listMetadata()))
                .find(item => item.id === IDS.vocabulary);
            assert.equal(metadata.wordCount, 1);
            assert.equal(metadata.words, undefined);

            vocabulary = await withServiceClient(teacherClient, () => vocabularyRepository.update(IDS.vocabulary, {
                ...source, name: 'Acceptance Vocabulary Updated', week: 3
            }));
            assert.equal(vocabulary.name, 'Acceptance Vocabulary Updated');
            assert.equal(vocabulary.week, 3);

            const placementResult = await withServiceClient(teacherClient, () => (
                vocabularyRepository.updateVocabularyPlacements([{
                    id: IDS.vocabulary,
                    assignedDate: '2026-07-21',
                    trimester: 'IIT',
                    month: 'July',
                    week: 4
                }])
            ));
            assert.deepEqual(placementResult, { requested: 1, updated: 1 });
            vocabulary = await withServiceClient(teacherClient, () => vocabularyRepository.get(IDS.vocabulary));
            assert.equal(vocabulary.week, 4);

            await expectRejected(() => withServiceClient(studentClient, () => vocabularyRepository.update(IDS.vocabulary, {
                ...source, name: 'Student Update Denied'
            })));
            await expectRejected(() => withServiceClient(studentClient, () => (
                vocabularyRepository.updateVocabularyPlacements([{
                    id: IDS.vocabulary,
                    assignedDate: '2026-08-01',
                    trimester: 'IIT',
                    month: 'August',
                    week: 5
                }])
            )));
            await withServiceClient(studentClient, () => vocabularyRepository.remove(IDS.vocabulary));
            assert.ok(await withServiceClient(teacherClient, () => vocabularyRepository.get(IDS.vocabulary)),
                'RLS must keep the vocabulary row after a Student delete attempt.');
            await expectRejected(() => withServiceClient(studentClient, () => vocabularyRepository.save(
                `${IDS.vocabulary}-student`, source
            )));

            await withServiceClient(teacherClient, () => vocabularyRepository.remove(IDS.vocabulary));
            assert.equal(await withServiceClient(teacherClient, () => vocabularyRepository.get(IDS.vocabulary)), null);
        });

        await t.test('Teacher Spark save/update/archive succeeds and Student mutations are denied', async () => {
            const source = {
                sparkType: 'trivia', title: 'Acceptance Spark', sparkText: 'Repository integration test',
                whyItMatters: 'It proves real RLS behavior.', question: 'Did the mutation persist?',
                gradeQuestions: { 6: 'What changed?' }, targetGrades: ['6'],
                sourceTitle: 'Local acceptance', sourceUrl: '', subjectSlug: 'technology',
                scheduledDate: '', status: 'draft', ownerId: teacher.id
            };
            await withServiceClient(teacherClient, () => sparksRepository.save(IDS.spark, source));
            let spark = (await withServiceClient(teacherClient, () => sparksRepository.list()))
                .find(item => item.id === IDS.spark);
            assert.equal(spark.title, source.title);
            assert.equal(typeof spark.updatedAt.toDate, 'function');

            spark = await withServiceClient(teacherClient, () => sparksRepository.update(IDS.spark, {
                ...source, title: 'Acceptance Spark Updated', status: 'archived'
            }));
            assert.equal(spark.title, 'Acceptance Spark Updated');
            assert.equal(spark.status, 'archived');

            await expectRejected(() => withServiceClient(studentClient, () => sparksRepository.update(IDS.spark, {
                ...source, title: 'Student Update Denied'
            })));
            await expectRejected(() => withServiceClient(studentClient, () => sparksRepository.save(
                `${IDS.spark}-student`, source
            )));
            const preserved = (await withServiceClient(teacherClient, () => sparksRepository.list()))
                .find(item => item.id === IDS.spark);
            assert.equal(preserved.status, 'archived');
        });

        await t.test('Teacher export logging succeeds and Student logging is denied', async () => {
            const row = await withServiceClient(teacherClient, () => teacherExportRepository.logExport({
                teacherId: teacher.id,
                dataTypes: ['studentProgress', 'scores'],
                studentCount: 1,
                format: 'json',
                filename: IDS.exportFilename,
                metadata: { runId: RUN_ID }
            }));
            assert.ok(row.id);
            assert.equal(row.teacher_id, teacher.id);
            assert.deepEqual(row.data_types, ['studentProgress', 'scores']);
            assert.equal(row.filename, IDS.exportFilename);

            await expectRejected(() => withServiceClient(studentClient, () => teacherExportRepository.logExport({
                teacherId: student.id, filename: `${RUN_ID}-student.json`
            })));
        });

        await t.test('Teacher roster summaries paginate and detailed batches remain teacher-only', async () => {
            const { data: page, error: pageError } = await teacherClient.rpc('list_student_progress_summaries_v1', {
                p_limit: 1,
                p_offset: 0
            });
            if (pageError) throw pageError;
            assert.equal(page.items.length, 1);
            assert.equal(page.limit, 1);
            assert.equal(Object.hasOwn(page.items[0], 'units'), false);

            const { data: filters, error: filtersError } = await teacherClient.rpc(
                'list_student_roster_filters_v1'
            );
            if (filtersError) throw filtersError;
            assert.ok(filters.grades.includes(6));
            assert.ok(filters.classes.some(item => item.grade === '6' && item.section === 'A'));

            const { data: identityRoster, error: identityRosterError } = await teacherClient.rpc(
                'list_student_identity_roster_v1'
            );
            if (identityRosterError) throw identityRosterError;
            assert.ok(identityRoster.some(item => item.id === student.id));
            assert.equal(identityRoster.every(item => !Object.hasOwn(item, 'units')), true);

            const { data: wordHuntReviews, error: wordHuntReviewsError } = await teacherClient.rpc(
                'list_word_hunt_reviews_v1'
            );
            if (wordHuntReviewsError) throw wordHuntReviewsError;
            assert.ok(Array.isArray(wordHuntReviews));

            const { data: analytics, error: analyticsError } = await teacherClient.rpc(
                'get_teacher_dashboard_analytics_v1', { p_grade: 6 }
            );
            if (analyticsError) throw analyticsError;
            assert.ok(analytics.totalStudents >= 1);
            assert.ok(Array.isArray(analytics.coinDistribution));
            assert.ok(Array.isArray(analytics.recentActivities));

            const { data: details, error: detailsError } = await teacherClient.rpc('get_students_progress_by_ids_v1', {
                p_user_ids: [student.id, peer.id]
            });
            if (detailsError) throw detailsError;
            assert.equal(details.length, 2);
            assert.equal(details.every(item => item.units && typeof item.units === 'object'), true);

            await expectRejected(() => studentClient.rpc('list_student_progress_summaries_v1', {
                p_limit: 10,
                p_offset: 0
            }).throwOnError());
            await expectRejected(() => studentClient.rpc('get_students_progress_by_ids_v1', {
                p_user_ids: [peer.id]
            }).throwOnError());
            await expectRejected(() => studentClient.rpc('list_student_roster_filters_v1').throwOnError());
            await expectRejected(() => studentClient.rpc('list_student_identity_roster_v1').throwOnError());
            await expectRejected(() => studentClient.rpc('list_word_hunt_reviews_v1').throwOnError());
            await expectRejected(() => studentClient.rpc('get_teacher_dashboard_analytics_v1', {
                p_grade: 6
            }).throwOnError());
        });

        await t.test('Student RPCs enforce authentication, role, ownership, idempotency, and score uniqueness', async () => {
            await withServiceClient(teacherClient, () => vocabularyRepository.save(IDS.vocabulary, {
                name: 'Verified Activity Unit', description: 'Acceptance activity verification',
                grades: ['6'], subjectSlug: 'technology', assignedDate: '2026-07-14',
                trimester: 'IIT', month: 'July', week: 1,
                activitySettings: {
                    requiredActivities: ['flashcards', 'matching'],
                    progressReward: 1,
                    completionBonus: 25
                },
                words: [
                    { word: 'Data', definition: 'Facts used for analysis.' },
                    { word: 'Chart', definition: 'A visual display of data.' },
                    { word: 'Cell', definition: 'A spreadsheet box.' },
                    { word: 'Formula', definition: 'A spreadsheet calculation.' }
                ],
                ownerId: teacher.id
            }));
            const activityUnitKey = `technology:${IDS.vocabulary}`;
            const initial = await withServiceClient(studentClient, () => supabaseService.ensureOwnStudentProgress({
                firstName: 'Audit', lastName: 'Student', email: AUDIT_STUDENT_EMAIL, grade: '6', group: 'A'
            }));
            assert.equal(initial.userId, student.id);

            const welcome = await withServiceClient(studentClient, () => supabaseService.claimStudentWelcomeBonus({
                clientId: `${RUN_ID}-welcome`
            }));
            const welcomeRetry = await withServiceClient(studentClient, () => supabaseService.claimStudentWelcomeBonus({
                clientId: `${RUN_ID}-welcome`
            }));
            assert.equal(welcomeRetry.coinData.balance, welcome.coinData.balance);
            const { count: welcomeCount, error: welcomeCountError } = await admin
                .from('student_coin_ledger').select('id', { count: 'exact', head: true })
                .eq('user_id', student.id).eq('source', 'welcome');
            if (welcomeCountError) throw welcomeCountError;
            assert.equal(welcomeCount, 1);

            await expectRejected(() => withServiceClient(studentClient, () => (
                supabaseService.startStudentActivityAttempt({
                    unitKey: activityUnitKey,
                    vocabularyId: IDS.vocabulary,
                    activityType: 'matching'
                })
            )), /flashcards/i);

            const attempt = await withServiceClient(studentClient, () => (
                supabaseService.startStudentActivityAttempt({
                    unitKey: activityUnitKey,
                    vocabularyId: IDS.vocabulary,
                    activityType: 'flashcards'
                })
            ));
            const activityPayload = {
                unitKey: activityUnitKey,
                unitContext: { unitId: 'forged-unit', unitName: 'Forged', subjectSlug: 'science', grade: '9' },
                activityType: 'flashcards', score: 100, isComplete: true,
                details: { evidence: { masteredCount: 4, correctCount: 4, totalCount: 4 } },
                activitySettings: { progressReward: 1000, completionBonus: 10000 },
                clientId: `${RUN_ID}-activity`, isRequired: false, attemptId: attempt.attemptId
            };
            await expectRejected(() => withServiceClient(studentClient, () => (
                supabaseService.submitStudentActivityProgress(activityPayload)
            )), /quickly/i);
            await new Promise(resolve => setTimeout(resolve, (attempt.minimumSeconds * 1000) + 100));
            const activity = await withServiceClient(studentClient, () => (
                supabaseService.submitStudentActivityProgress(activityPayload)
            ));
            assert.equal(activity.activity.unitKey, activityUnitKey);
            assert.equal(activity.activity.activityType, 'flashcards');
            assert.equal(activity.activity.score, 100);
            assert.equal(activity.activity.isComplete, true);
            assert.equal(activity.activity.verified, true);
            const activityRetry = await withServiceClient(studentClient, () => (
                supabaseService.submitStudentActivityProgress(activityPayload)
            ));
            assert.deepEqual(activityRetry, activity);

            const synced = await withServiceClient(studentClient, () => supabaseService.syncStudentUnitWork({
                unitKey: activityUnitKey,
                unitContext: activityPayload.unitContext,
                workPatch: { acceptanceNote: 'persisted', scores: { forbiddenOverwrite: true } }
            }));
            assert.equal(synced.unit.acceptanceNote, 'persisted');
            assert.equal(synced.unit.scores, undefined);

            await expectRejected(() => withServiceClient(studentClient, () => supabaseService.syncStudentUnitWork({
                unitKey: activityUnitKey,
                unitContext: activityPayload.unitContext,
                workPatch: { crossUserReplay: true }
            }, { ownerUserId: peer.id })), /owner does not match/i);

            const firstScore = await withServiceClient(studentClient, () => supabaseService.submitStudentGameScore({
                gameId: 'snake', score: 123, metadata: { runId: RUN_ID }
            }));
            const lowerRetry = await withServiceClient(studentClient, () => supabaseService.submitStudentGameScore({
                gameId: 'snake', score: 100, metadata: { runId: RUN_ID, retry: true }
            }));
            assert.equal(firstScore.id, `${student.id}-snake`);
            assert.equal(lowerRetry.score, 123);
            const improved = await withServiceClient(studentClient, () => supabaseService.submitStudentGameScore({
                gameId: 'snake', score: 150, metadata: { runId: RUN_ID, improved: true }
            }));
            assert.equal(improved.score, 150);
            const scores = await withServiceClient(studentClient, () => leaderboardRepository.listForUser(student.id));
            assert.equal(scores.filter(score => score.gameId === 'snake').length, 1);

            const gifted = await withServiceClient(teacherClient, () => supabaseService.giftStudentCoins({
                studentId: student.id, amount: 7, message: 'Acceptance gift'
            }));
            assert.ok(gifted.coinData.giftCoins >= 7);
            const accepted = await withServiceClient(studentClient, () => supabaseService.acceptStudentGiftCoins({
                clientId: `${RUN_ID}-accept-gift`
            }));
            assert.equal(accepted.coinData.giftCoins, 0);

            await expectRejected(() => withServiceClient(anonClient, () => supabaseService.ensureOwnStudentProgress({})));
            await expectRejected(() => withServiceClient(anonClient, () => supabaseService.submitStudentGameScore({
                gameId: 'snake', score: 1
            })));
            await expectRejected(() => withServiceClient(studentClient, () => supabaseService.giftStudentCoins({
                studentId: peer.id, amount: 1
            })), /teacher/i);
            await expectRejected(() => withServiceClient(teacherClient, () => supabaseService.submitStudentGameScore({
                gameId: 'snake', score: 1
            })), /student/i);
            await expectRejected(() => withServiceClient(teacherClient, () => supabaseService.syncStudentUnitWork({
                unitKey: IDS.unit, unitContext: {}, workPatch: { denied: true }
            })), /student/i);
            await expectRejected(() => withServiceClient(teacherClient, () => supabaseService.giftStudentCoins({
                studentId: crypto.randomUUID(), amount: 1
            })), /not found/i);

            await expectRejected(
                () => withServiceClient(studentClient, () => studentProgressRepository.get(peer.id)),
                /not allowed to read/i
            );
            const { error: studentCrossWriteError } = await studentClient.from('student_progress_summary')
                .update({ total_xp: 999999 }).eq('user_id', peer.id);
            assert.ok(studentCrossWriteError, 'A Student direct cross-user progress write must be rejected.');
            const { error: teacherDirectWriteError } = await teacherClient.from('student_progress_summary')
                .update({ total_xp: 999999 }).eq('user_id', student.id);
            assert.ok(teacherDirectWriteError, 'A Teacher direct progress write must use the domain RPC instead.');
        });

        await t.test('Realtime delivery, unsubscribe, resubscribe, and repeated application initialization are exact', async () => {
            const { data: original, error: originalError } = await admin.from('student_progress_summary')
                .select('version').eq('user_id', student.id).single();
            if (originalError) throw originalError;
            const markerCounts = new Map();
            let lastMarker = 0;
            const recordMarker = progress => {
                const marker = Number(progress.version || 0);
                lastMarker = marker;
                markerCounts.set(marker, (markerCounts.get(marker) || 0) + 1);
            };
            let nextMarker = Number(original.version || 0);
            const updateMarker = async () => {
                nextMarker += 1;
                const marker = nextMarker;
                const { error } = await admin.from('student_progress_summary').update({ version: marker })
                    .eq('user_id', student.id);
                if (error) throw error;
                return marker;
            };
            const warmRealtimeStream = async label => {
                for (let attempt = 1; attempt <= 6; attempt += 1) {
                    const marker = await updateMarker();
                    try {
                        await waitFor(() => lastMarker === marker, 'Realtime stream did not warm up.', 1500);
                        markerCounts.clear();
                        lastMarker = 0;
                        return;
                    } catch {
                        // A freshly started Realtime service can join the WebSocket
                        // before its logical-replication stream is ready. Retry with
                        // a new marker, then measure exact delivery only after it is.
                    }
                }
                throw new Error('Realtime stream did not become ready.');
            };

            try {
                await withServiceClient(studentClient, async () => {
                    const unsubscribe = studentProgressRepository.subscribe(student.id, progress => {
                        recordMarker(progress);
                    });
                    await waitFor(() => channelJoined(studentClient), 'Realtime channel did not join.');
                    await warmRealtimeStream('initial');
                    const deliveryMarker = await updateMarker();
                    await waitFor(() => lastMarker === deliveryMarker, 'Initial Realtime update was not delivered.');
                    await new Promise(resolve => setTimeout(resolve, 150));
                    assert.equal(markerCounts.get(deliveryMarker), 1);

                    await unsubscribe();
                    await waitFor(() => studentClient.getChannels().length === 0, 'Realtime channel was not removed.');
                    const unsubscribedMarker = await updateMarker();
                    await new Promise(resolve => setTimeout(resolve, 500));
                    assert.equal(markerCounts.get(unsubscribedMarker) || 0, 0,
                        'No callback may arrive after unsubscribe.');

                    const unsubscribeAgain = studentProgressRepository.subscribe(student.id, progress => {
                        recordMarker(progress);
                    });
                    await waitFor(() => channelJoined(studentClient), 'Resubscribed Realtime channel did not join.');
                    await warmRealtimeStream('resubscribe');
                    const resubscribeMarker = await updateMarker();
                    await waitFor(() => lastMarker === resubscribeMarker, 'Resubscribed update was not delivered.');
                    await new Promise(resolve => setTimeout(resolve, 150));
                    assert.equal(markerCounts.get(resubscribeMarker), 1);
                    await unsubscribeAgain();
                    await waitFor(() => studentClient.getChannels().length === 0, 'Resubscribed channel was not removed.');
                });

                const originalGlobals = {
                    window: globalThis.window,
                    document: globalThis.document,
                    navigator: globalThis.navigator,
                    sessionStorage: globalThis.sessionStorage
                };
                let applicationCallbacks = 0;
                let applicationLastMarker = 0;
                let repeatedInitMarker = 0;
                const previousStorageOwner = getActiveStudentStorageOwner();
                try {
                    const storage = new Map();
                    globalThis.sessionStorage = {
                        getItem: key => storage.get(key) || null,
                        setItem: (key, value) => storage.set(key, String(value))
                    };
                    globalThis.window = {
                        addEventListener() {}, removeEventListener() {},
                        setInterval: () => 1, clearInterval() {},
                        setTimeout, clearTimeout
                    };
                    globalThis.document = {
                        visibilityState: 'visible', addEventListener() {}, removeEventListener() {},
                        getElementById: () => ({ appendChild() {} }), querySelectorAll: () => []
                    };
                    Object.defineProperty(globalThis, 'navigator', {
                        configurable: true, value: { onLine: false }
                    });
                    const { StudentProgress } = await import('../js/student/studentProgress.js');
                    const progress = new StudentProgress({
                        authDisabled: false,
                        currentUser: { uid: student.id },
                        logStudentDomUpdate() {}
                    });
                    progress.cloud.applyRemoteCoinProgress = snapshot => {
                        applicationLastMarker = Number(snapshot?.version || 0);
                        if (applicationLastMarker === repeatedInitMarker) {
                            applicationCallbacks += 1;
                        }
                    };
                    setActiveStudentStorageOwner(student.id);

                    await withServiceClient(studentClient, async () => {
                        progress.startCoinSync();
                        await waitFor(() => channelJoined(studentClient), 'Application Realtime channel did not join.');
                        progress.startCoinSync();
                        await waitFor(() => channelJoined(studentClient), 'Repeated initialization did not settle to one channel.');
                        assert.equal(studentClient.getChannels().length, 1);
                        for (let attempt = 1; attempt <= 6; attempt += 1) {
                            const marker = await updateMarker();
                            try {
                                await waitFor(() => applicationLastMarker === marker,
                                    'Application Realtime stream did not warm up.', 1500);
                                break;
                            } catch {
                                if (attempt === 6) throw new Error('Application Realtime stream did not become ready.');
                            }
                        }
                        repeatedInitMarker = await updateMarker();
                        await waitFor(() => applicationCallbacks === 1, 'Repeated initialization update was not delivered exactly once.');
                        await new Promise(resolve => setTimeout(resolve, 150));
                        assert.equal(applicationCallbacks, 1);
                        progress.stopCoinSync();
                        await waitFor(() => studentClient.getChannels().length === 0, 'Application teardown did not remove channels.');
                    });
                } finally {
                    setActiveStudentStorageOwner(previousStorageOwner);
                    globalThis.window = originalGlobals.window;
                    globalThis.document = originalGlobals.document;
                    globalThis.sessionStorage = originalGlobals.sessionStorage;
                    Object.defineProperty(globalThis, 'navigator', {
                        configurable: true, value: originalGlobals.navigator
                    });
                }
            } finally {
                await studentClient.removeAllChannels();
                await admin.from('student_progress_summary').update({ version: original.version }).eq('user_id', student.id);
            }
        });
    } finally {
        await cleanupAcceptanceData({ admin, peer, student: users.student });
        await Promise.allSettled([
            teacherClient.removeAllChannels(), studentClient.removeAllChannels(), peerClient.removeAllChannels(),
            teacherClient.auth.signOut(), studentClient.auth.signOut(), peerClient.auth.signOut()
        ]);
        supabaseService.client = null;
        supabaseService.currentUser = null;
        supabaseService.currentSession = null;
    }
});
