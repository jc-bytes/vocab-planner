import test from 'node:test';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { createClient } from '@supabase/supabase-js';
import { readLocalSupabaseStatus, createLocalAdminClient, getBrowserSupabaseConfig, runLocalAuditSql } from '../scripts/lib/local-supabase-audit.mjs';
import { createClassroomRepository } from '../js/services/classroomRepository.js';

test('private classes enforce ownership and verified enrollment through real authenticated requests', async t => {
    const status = await readLocalSupabaseStatus({ startIfStopped: false });
    const config = getBrowserSupabaseConfig(status);
    const dbContainer = process.env.SPARKS_TEST_DB_CONTAINER || 'supabase_db_ifofhiypzffruzhiukst';
    assert.ok(['supabase_db_ifofhiypzffruzhiukst', 'supabase_db_sparks_private_rehearsal', 'supabase_db_sparks_school_full_20260917', 'supabase_db_sparks-release-20261013'].includes(dbContainer));
    const admin = createLocalAdminClient(status);
    const run = crypto.randomUUID();
    let sparkCheckMaterialId;
    const users = [], clients = [], subjects = [], classes = [], materials = [], sparks = [];
    const schoolA = crypto.randomUUID(), schoolB = crypto.randomUUID();
    async function actor(label, role, confirmed = true) {
        const email = `classes-${run}-${label}@aid.edu.pa`;
        const password = `Classes-${crypto.randomUUID()}!`;
        if (role === 'teacher') await admin.from('teacher_allowlist').insert({ email, active: true }).throwOnError();
        const token = crypto.randomUUID();
        await admin.rpc('issue_auth_user_provisioning_ticket', { p_email: email, p_token: token }).throwOnError();
        const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: confirmed,
            user_metadata: { provisioning_token: token, first_name: label, last_name: 'ClassesTest', grade: '6', group: 'A' } });
        assert.ifError(error);
        assert.ok(data.user, `create ${label}`);
        const user = data.user; users.push({ ...user, role });
        await admin.from('profiles').update({ role, first_name: label, last_name: 'ClassesTest',
            grade_level: role === 'student' ? 6 : null, section_letter: role === 'student' ? 'A' : null,
            must_change_password: false }).eq('user_id', user.id).throwOnError();
        const client = createClient(config.url, config.publishableKey, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false } });
        clients.push(client);
        const signed = await client.auth.signInWithPassword({ email, password });
        assert.ifError(signed.error);
        return { id: user.id, email, password, client, repo: createClassroomRepository(() => client, () => label === 'teacher-b' ? schoolB : schoolA) };
    }
    try {
        const a = await actor('teacher-a', 'teacher'), b = await actor('teacher-b', 'teacher');
        const both = await actor('both', 'student'), neither = await actor('neither', 'student');
        runLocalAuditSql(`insert into public.schools(id,name,timezone) values('${schoolA}','Classes A ${run}','America/Panama'),('${schoolB}','Classes B ${run}','America/Panama');`);
        for (const [schoolId, owner] of [[schoolA,a],[schoolB,b]]) {
            runLocalAuditSql(`insert into public.school_memberships(school_id,user_id) values('${schoolId}','${owner.id}');`);
            runLocalAuditSql(`insert into public.school_member_roles(school_id,user_id,role) values('${schoolId}','${owner.id}','school_admin'),('${schoolId}','${owner.id}','teacher');`);
            await owner.client.rpc('set_school_year_v1',{p_school_id:schoolId,p_year:2026,p_label:'2026',p_archived:false}).throwOnError();
        }
        for (const [schoolId, student] of [[schoolA,both],[schoolB,both]]) {
            runLocalAuditSql(`insert into public.school_memberships(school_id,user_id,grade,section) values('${schoolId}','${student.id}','6','A');`);
            runLocalAuditSql(`insert into public.school_member_roles(school_id,user_id,role) values('${schoolId}','${student.id}','student');`);
        }
        const sa = await a.repo.createSubject('Technology'); subjects.push(sa.id);
        const sb = await b.repo.createSubject('Technology'); subjects.push(sb.id);
        const robotics = await a.repo.createSubject('Robotics'); subjects.push(robotics.id);
        const ca = await a.repo.createClass({ name: '6A', subjectId: sa.id, schoolYear: 2026 }); classes.push(ca.id);
        const cb = await b.repo.createClass({ name: '6A', subjectId: sb.id, schoolYear: 2026 }); classes.push(cb.id);
        const club = await a.repo.createClass({ name: 'Club', subjectId: robotics.id, schoolYear: 2026 }); classes.push(club.id);
        await t.test('identical class/subject names stay private and teachers can own multiple subjects', async () => {
            assert.deepEqual((await a.repo.listSubjects()).map(s => s.id).sort(), [sa.id, robotics.id].sort());
            assert.deepEqual((await b.repo.listClasses()).map(c => c.id), [cb.id]);
            assert.equal((await both.repo.listSubjects()).length, 0);
            await assert.rejects(both.repo.listClasses(), {code:'42501',message:'School teacher or administrator required.'});
            assert.equal((await a.client.from('teaching_classes').select('*').eq('id', cb.id)).data.length, 0);
        });
        await t.test('foreign links, forged ownership, transfer and direct membership writes are denied', async () => {
            await assert.rejects(a.repo.createClass({ name: 'Foreign', subjectId: sb.id, schoolYear: 2026 }));
            assert.ok((await a.client.from('teacher_subjects').insert({ name: 'Forged', owner_id: b.id })).error);
            assert.ok((await a.client.from('teacher_subjects').update({ owner_id: b.id }).eq('id', sa.id)).error);
            assert.ok((await both.client.from('class_memberships').insert({ class_id: cb.id, student_id: both.id })).error);
            await assert.rejects(a.repo.inviteStudent(cb.id, both.email));
            await assert.rejects(a.repo.getRoster(cb.id));
        });
        await t.test('invitations appear only to the matching student; acceptance is retry-safe', async () => {
            await a.repo.inviteStudent(ca.id, both.email.toUpperCase());
            await b.repo.inviteStudent(cb.id, both.email);
            assert.equal((await neither.repo.listMyInvitations()).length, 0);
            const invites = await both.repo.listMyInvitations(); assert.equal(invites.length, 2);
            await assert.rejects(neither.repo.acceptInvitation(invites[0].id));
            for (const invite of invites) {
                const first = await both.repo.acceptInvitation(invite.id);
                assert.equal(await both.repo.acceptInvitation(invite.id), first);
            }
            assert.deepEqual((await both.repo.listMyClasses()).map(c => c.id).sort(), [ca.id, cb.id].sort());
            assert.equal((await neither.repo.listMyClasses()).length, 0);
            assert.equal((await a.repo.getRoster(ca.id)).length, 1);
            assert.equal((await a.repo.getRoster(club.id)).length, 0);
            assert.equal((await b.repo.getRoster(cb.id))[0].studentId, both.id);
        });
        await t.test('bulk invitations are atomic, private and cancellable', async () => {
            const newEmail = `pending-${run}@aid.edu.pa`;
            await assert.rejects(a.repo.inviteStudents(club.id, [newEmail, 'invalid']));
            assert.equal((await a.repo.listInvitations(club.id)).length, 0);
            assert.equal(await a.repo.inviteStudents(club.id, [newEmail, neither.email]), 2);
            const pending = await a.repo.listInvitations(club.id);
            assert.equal(pending.length, 2);
            await assert.rejects(b.repo.listInvitations(club.id));
            const invite = pending.find(row => row.email === neither.email);
            await assert.rejects(b.repo.revokeInvitation(invite.id));
            await a.repo.revokeInvitation(invite.id);
            assert.equal((await neither.repo.listMyInvitations()).length, 0);
            await assert.rejects(neither.repo.acceptInvitation(invite.id));
        });
        await t.test('removal revokes old invitations and leaves the other teacher membership intact', async () => {
            await a.repo.inviteStudent(ca.id, both.email);
            const invite = (await both.repo.listMyInvitations())[0];
            await a.repo.removeStudent(ca.id, both.id);
            await assert.rejects(both.repo.acceptInvitation(invite.id));
            assert.deepEqual((await both.repo.listMyClasses()).map(c => c.id), [cb.id]);
            assert.equal((await a.repo.getRoster(ca.id)).length, 0);
            assert.equal((await b.repo.getRoster(cb.id)).length, 1);
            await assert.rejects(b.repo.removeStudent(ca.id, both.id));
        });
        await t.test('publication is private, atomic, retry-safe and retains a version after library edits', async () => {
            const materialId = `private-vocab-${run}`; materials.push(materialId);
            await admin.from('vocabularies').insert({ id: materialId, owner_id: a.id, school_id: schoolA, teacher_subject_id:sa.id, name: 'Cell practice',
                words: [{ word: 'Cell', definition: 'A box in a spreadsheet.' }] }).throwOnError();
            const request = { classIds: [ca.id, club.id], kind: 'vocabulary', materialId,
                releaseAt: new Date(Date.now() - 60000).toISOString(), publicationKey: crypto.randomUUID() };
            await assert.rejects(b.repo.publishMaterial({ ...request, classIds: [cb.id] }));
            await assert.rejects(a.repo.publishMaterial({ ...request, classIds: [ca.id, cb.id] }));
            assert.equal((await a.repo.listAssignments()).length, 0, 'failed multi-class request rolls back every assignment');
            const published = await a.repo.publishMaterial(request); assert.equal(published.length, 2);
            assert.deepEqual((await a.repo.publishMaterial(request)).map(x => x.id), published.map(x => x.id));
            await assert.rejects(a.repo.publishMaterial({ ...request, classIds: [ca.id] }));
            const assignment = published.find(x => x.class_id === ca.id);
            assert.equal((await b.repo.listAssignments()).length, 0);
            await assert.rejects(b.repo.readAssignment(assignment.id));
            await assert.rejects(neither.repo.readAssignment(assignment.id));
            await assert.rejects(both.repo.readAssignment(assignment.id), 'removed members lose access');
            await a.repo.inviteStudent(ca.id, both.email);
            await both.repo.acceptInvitation((await both.repo.listMyInvitations())[0].id);
            assert.equal((await both.repo.readAssignment(assignment.id)).content.words[0].word, 'Cell');
            await admin.from('vocabularies').update({ words: [{ word: 'Changed', definition: 'Later library edit.' }] }).eq('id', materialId).throwOnError();
            assert.equal((await both.repo.readAssignment(assignment.id)).content.words[0].word, 'Cell');
            const future = (await a.repo.publishMaterial({ ...request, classIds: [ca.id],
                releaseAt: new Date(Date.now() + 86400000).toISOString(), publicationKey: crypto.randomUUID() }))[0];
            await assert.rejects(both.repo.readAssignment(future.id));
            assert.equal((await both.repo.listAssignments(ca.id)).length, 1);
            await assert.rejects(b.repo.withdrawAssignment(assignment.id));
            await a.repo.withdrawAssignment(assignment.id);
            await assert.rejects(both.repo.readAssignment(assignment.id));
        });
        await t.test('legacy library, profile, settings and report APIs respect workspace boundaries', async () => {
            assert.equal((await b.client.from('vocabularies').select('*').eq('id', materials[0])).data.length, 0);
            assert.equal((await both.client.from('vocabularies').select('*')).data.length, 0);
            assert.equal((await b.client.from('vocabularies').update({ name: 'Stolen' }).eq('id', materials[0]).select()).data.length, 0);
            assert.ok((await a.client.from('vocabularies').update({ owner_id: b.id }).eq('id', materials[0])).error);
            assert.equal((await a.client.from('profiles').select('*').eq('user_id', both.id)).data.length, 0);
            assert.equal((await a.client.from('profiles').update({ first_name: 'Changed by teacher' }).eq('user_id', both.id).select()).data.length, 0);
            await a.client.rpc('set_school_setting_v1', { p_school_id:schoolA,p_key:'private-note',p_value:{note:'Only A'} }).throwOnError();
            assert.ok((await b.client.rpc('get_school_settings_v1', {p_school_id:schoolA})).error);
            assert.equal((await both.client.from('teacher_settings').select('*')).data.length, 0);
            const roster = await a.client.rpc('list_student_identity_roster_school_v1', { p_school_id:schoolA }); assert.ifError(roster.error);
            assert.deepEqual(roster.data.map(s => s.userId), [both.id]);
            const summary = await a.client.rpc('get_student_progress_school_v3', { p_school_id:schoolA, p_user_id: both.id }); assert.ifError(summary.error);
            assert.ok(!summary.data || !('coinHistory' in summary.data));
            assert.ok((await a.client.rpc('get_student_progress_school_v3', { p_school_id:schoolA, p_user_id: neither.id })).error);
            assert.ok((await both.client.rpc('start_student_activity_attempt', { p_unit_key: `technology:${materials[0]}`,
                p_vocabulary_id: materials[0], p_activity_type: 'flashcards' })).error);
            assert.ok((await a.client.rpc('gift_student_coins_v2', { p_event_id: crypto.randomUUID(), p_student_id: neither.id, p_amount: 1 })).error);

        });
        await t.test('account administration rejects teachers even with forged user metadata', async () => {
            const { readFile } = await import('node:fs/promises');
            const { stripTypeScriptTypes } = await import('node:module');
            await a.client.auth.updateUser({ data: { school_admin: true } });
            for (const name of ['reset-student-password', 'create-student-account']) {
                const source = await readFile(new URL(`../supabase/functions/${name}/index.ts`, import.meta.url), 'utf8');
                const script = stripTypeScriptTypes(source.replace(/^import .*;$/gm, ''));
                let handler;
                const environment = { SUPABASE_URL: config.url, SUPABASE_ANON_KEY: config.publishableKey,
                    SUPABASE_SERVICE_ROLE_KEY: status.SERVICE_ROLE_KEY };
                // Execute the actual handler with Deno's environment/server adapters;
                // createClient performs real requests against local Auth and Postgres.
                new Function('Deno', 'createClient', script)({ env: { get: key => environment[key] }, serve: fn => { handler = fn; } }, createClient);
                const { data } = await a.client.auth.getSession();
                const body = name === 'reset-student-password' ? { userId: both.id }
                    : { firstName: 'Test', lastName: 'Student', email: neither.email, grade: '6', section: 'A', password: 'TemporaryPass123!' };
                const response = await handler(new Request('http://localhost/functions', { method: 'POST',
                    headers: { Authorization: `Bearer ${data.session.access_token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body) }));
                assert.equal(response.status, 410);
                assert.match((await response.json()).error, /school invitations|account recovery|password recovery/i);
                if (process.env.SPARKS_TEST_FUNCTION_GATEWAY === '1') {
                    const gateway = await fetch(`${config.url}/functions/v1/${name}`, { method: 'POST',
                        headers: { Authorization: `Bearer ${data.session.access_token}`, 'Content-Type': 'application/json', apikey: config.publishableKey },
                        body: JSON.stringify(body) });
                    assert.equal(gateway.status, 410);
                    assert.match((await gateway.json()).error, /school invitations|account recovery|password recovery/i);
                }

            }
        });
        await t.test('vocabulary attempts and saved state use the assignment snapshot and enrollment', async () => {
            const [assignment] = await a.repo.publishMaterial({ classIds: [ca.id], kind: 'vocabulary', materialId: materials[0],
                releaseAt: new Date(Date.now()-60000).toISOString(), publicationKey: crypto.randomUUID() });
            const key = `assignment:${assignment.id}`;
            const start = { p_unit_key: key, p_vocabulary_id: materials[0], p_activity_type: 'flashcards' };
            assert.ok((await neither.client.rpc('start_student_activity_attempt', start)).error);
            const { data: attempt, error } = await both.client.rpc('start_student_activity_attempt', start);
            assert.ifError(error); assert.ok(attempt.attemptId);
            const work = { p_event_id: crypto.randomUUID(), p_unit_key: key, p_unit_context: {},
                p_work_patch: { states: { flashcards: { cardIndex: 1 } } } };
            assert.ifError((await both.client.rpc('sync_student_unit_work_v2', work)).error);
            const { data: rows } = await both.client.from('student_activity_state').select('assignment_id').eq('unit_key', key);
            assert.equal(rows[0].assignment_id, assignment.id);
            await new Promise(resolve => setTimeout(resolve, (attempt.minimumSeconds + 1) * 1000));
            assert.ifError((await both.client.rpc('report_student_activity_time_v1', { p_attempt_id: attempt.attemptId, p_active_seconds: attempt.minimumSeconds })).error);
            const completed = await both.client.rpc('submit_student_activity_progress_v3', {
                p_event_id: crypto.randomUUID(), p_unit_key: key, p_unit_context: {}, p_activity_type: 'flashcards',
                p_score: 100, p_is_complete: true, p_is_finished: true, p_attempt_id: attempt.attemptId,
                p_details: { evidence: { masteredCount: 1, correctCount: 1, totalCount: 1, attemptedCount: 1, firstAttemptCorrectCount: 1 } }
            });
            assert.ifError(completed.error);
            const results = await a.repo.getResults(assignment.id);
            assert.equal(results[0].score, 100); assert.equal(results[0].studentId, both.id);
            await assert.rejects(b.repo.getResults(assignment.id));
            await assert.rejects(neither.repo.getResults(assignment.id));

            assert.equal((await b.client.from('student_activity_state').select('*').eq('unit_key', key)).data.length, 0);
            const exported = await b.client.rpc('get_student_progress_school_v3', { p_school_id:schoolB, p_user_id: both.id }); assert.ifError(exported.error);
            assert.ok(!exported.data?.units?.[key]);
            const filePath = `${assignment.id}/${both.id}/cell.webp`;
            const blob = new Blob([Uint8Array.from(Buffer.from('UklGRiIAAABXRUJQVlA4IBYAAAAwAQCdASoBAAEADsD+JaQAA3AAAAAA','base64'))], { type: 'image/webp' });
            assert.ifError((await both.client.storage.from('word-hunt-images').upload(filePath, blob)).error);
            assert.ifError((await a.client.storage.from('word-hunt-images').download(filePath)).error);
            assert.ok((await b.client.storage.from('word-hunt-images').download(filePath)).error);
            assert.ok((await neither.client.storage.from('word-hunt-images').download(filePath)).error);
            await a.repo.withdrawAssignment(assignment.id);
            assert.ok((await both.client.storage.from('word-hunt-images').download(filePath)).error);
            assert.ok((await both.client.storage.from('word-hunt-images').upload(filePath, blob, { upsert: true })).error);
            await admin.storage.from('word-hunt-images').remove([filePath]);
            assert.ok((await both.client.rpc('sync_student_unit_work_v2', work)).error, 'receipt replay must recheck access');
            assert.ok((await both.client.rpc('start_student_activity_attempt', start)).error);
            assert.ok((await both.client.rpc('report_student_activity_time_v1', { p_attempt_id: attempt.attemptId, p_active_seconds: 0 })).error);
        });
        await t.test('shared student responses stay private and obey enrollment and assignment state', async () => {
            const materialId = `private-spark-${run}`; sparks.push(materialId);
            await admin.from('weekly_sparks').insert({ id: materialId, owner_id: a.id, school_id:schoolA,teacher_subject_id:sa.id,
                title: 'Private reflection', spark_text: 'Read and reflect.', question: 'What did you learn?' }).throwOnError();
            const [assignment] = await a.repo.publishMaterial({ classIds: [ca.id], kind: 'spark', materialId,
                releaseAt: new Date(Date.now()-60000).toISOString(), publicationKey: crypto.randomUUID() });
            const first = await both.repo.saveResponse(assignment.id, 'I learned about cells.', 0);
            assert.equal(first.revision, 1);
            assert.deepEqual(await both.repo.saveResponse(assignment.id, 'I learned about cells.', 0), first);
            await assert.rejects(both.repo.saveResponse(assignment.id, 'An old edit', 0));
            assert.equal((await a.repo.listResponses(assignment.id)).length, 1);
            assert.equal((await b.repo.listResponses(assignment.id)).length, 0);
            assert.equal((await neither.repo.listResponses(assignment.id)).length, 0);
            await assert.rejects(b.repo.saveResponse(assignment.id, 'Impersonated', 0));
            await assert.rejects(neither.repo.saveResponse(assignment.id, 'Unenrolled', 0));
            assert.ok((await both.client.from('class_assignment_responses').update({ response: 'Bypass' })
                .eq('assignment_id', assignment.id)).error);
            await a.repo.setClassArchived(ca.id, true);
            await assert.rejects(both.repo.saveResponse(assignment.id, 'Archived', 1));
            assert.equal((await both.repo.listResponses(assignment.id)).length, 1);
            await a.repo.setClassArchived(ca.id, false);
            await a.repo.removeStudent(ca.id, both.id);
            assert.equal((await both.repo.listResponses(assignment.id)).length, 0);
            await assert.rejects(both.repo.saveResponse(assignment.id, 'Removed', 1));
            assert.equal((await a.repo.listResponses(assignment.id)).length, 1);
            await a.repo.inviteStudent(ca.id, both.email);
            await both.repo.acceptInvitation((await both.repo.listMyInvitations())[0].id);
            await admin.from('class_assignments').update({ close_at: new Date(Date.now()-30000).toISOString() }).eq('id', assignment.id).throwOnError();
            await assert.rejects(both.repo.saveResponse(assignment.id, 'Closed', 1));
            await a.repo.withdrawAssignment(assignment.id);
            assert.equal((await both.repo.listResponses(assignment.id)).length, 0);
            await assert.rejects(both.repo.saveResponse(assignment.id, 'I learned about cells.', 0));
        });
        await t.test('Spark checks use private immutable keys and keep shared-student results private', async () => {
            sparkCheckMaterialId = `private-check-${run}`; sparks.push(sparkCheckMaterialId);
            const questions = [{ id: 'choice', type: 'multiple_choice', prompt: 'Choose the spreadsheet cell.', options: ['A slide', 'A box'], correctOption: 1 },
                { id: 'explain', type: 'short_text', prompt: 'Explain your answer.', options: [] }];
            await admin.from('weekly_sparks').insert({ id: sparkCheckMaterialId, owner_id: a.id, school_id: schoolA, teacher_subject_id:sa.id, title: 'Private check',
                spark_type: 'trivia', spark_text: 'Cells store information.', question: '', check_mode: 'optional', questions }).throwOnError();
            const [assignment] = await a.repo.publishMaterial({ classIds: [ca.id], kind: 'spark', materialId: sparkCheckMaterialId,
                releaseAt: new Date(Date.now()-60000).toISOString(), publicationKey: crypto.randomUUID() });
            const detail = await both.repo.readAssignment(assignment.id);
            assert.equal(Object.hasOwn(detail.content.questions[0], 'correctOption'), false);
            await admin.from('weekly_sparks').update({ questions: [{ ...questions[0], correctOption: 0 }, questions[1]] }).eq('id', sparkCheckMaterialId).throwOnError();
            const wrong = await both.repo.checkSpark(assignment.id, { choice: 0, explain: 'A cell holds information.' }, 0);
            assert.equal(wrong.evaluation.correct, 0);
            assert.equal(wrong.evaluation.isComplete, false);
            await assert.rejects(both.repo.checkSpark(assignment.id, { choice: 1, explain: 'Short' }, 1));
            await assert.rejects(both.repo.checkSpark(assignment.id, { choice: 9, explain: 'A cell holds information.' }, 1));
            const answers = { choice: 1, explain: 'A cell holds information.' };
            await assert.rejects(neither.repo.checkSpark(assignment.id, answers, 0));
            await assert.rejects(b.repo.checkSpark(assignment.id, answers, 0));
            const correct = await both.repo.checkSpark(assignment.id, answers, 1);
            assert.equal(correct.evaluation.correct, 1);
            assert.equal(correct.evaluation.isComplete, true);
            assert.equal(correct.evaluation.needsTeacherReview, true);
            assert.equal(correct.revision, 2);
            assert.deepEqual(await both.repo.checkSpark(assignment.id, answers, 1), correct);
            assert.equal((await b.repo.listResponses(assignment.id)).length, 0);
            assert.equal((await a.repo.listResponses(assignment.id))[0].evaluation.correct, 1);
            const edited = await both.repo.saveResponse(assignment.id, 'A new written response.', 2);
            assert.equal(edited.evaluation, null, 'a plain-text edit cannot keep an earlier automatic grade');
            await a.repo.withdrawAssignment(assignment.id);
            await assert.rejects(both.repo.checkSpark(assignment.id, answers, 1));
        });
        await t.test('archive prevents enrollment and students cannot enumerate classmates', async () => {
            await a.repo.inviteStudent(club.id, both.email);
            const invite = (await both.repo.listMyInvitations())[0];
            await a.repo.setClassArchived(club.id, true);
            await assert.rejects(both.repo.acceptInvitation(invite.id));
            await assert.rejects(a.repo.inviteStudent(club.id, neither.email));
            await assert.rejects(both.repo.getRoster(cb.id));
            const { data } = await neither.client.from('class_memberships').select('*');
            assert.deepEqual(data, []);
        });
        runLocalAuditSql(`insert into public.school_memberships(school_id,user_id,grade,section) values('${schoolA}','${neither.id}','6','A'); insert into public.school_member_roles(school_id,user_id,role) values('${schoolA}','${neither.id}','student');`);
        await t.test('teacher and student class screens use the authenticated enrollment workflow', async () => {
            const { chromium } = await import('playwright');
            const { ensureViteServer } = await import('../scripts/lib/local-vite-server.mjs');
            const port = Number(process.env.PRIVATE_CLASSROOM_UI_PORT || 8016);
            const baseUrl = `http://127.0.0.1:${port}`;
            const server = await ensureViteServer({ cwd: fileURLToPath(new URL('..', import.meta.url)), baseUrl, probePath: '/', host: '127.0.0.1', port });
            const browser = await chromium.launch();
            try {
                async function localPage() {
                    const page = await browser.newPage();
                    if (new URL(config.url).port !== '54321') {
                        await page.context().grantPermissions(['local-network-access'], { origin: baseUrl });
                        // The disposable stack uses a different loopback port. Keep CSP,
                        // replacing only its fixed development-port allowlist in this test.
                        await page.route('**/*.html', async route => {
                            const response = await route.fetch();
                            const body = (await response.text()).replaceAll(':54321', ':' + new URL(config.url).port);
                            await route.fulfill({ response, body });
                        });
                    }
                    return page;
                }
                const teacherPage = await localPage();
                teacherPage.on('requestfailed', request => console.error('Browser request failed', new URL(request.url()).origin + new URL(request.url()).pathname, request.failure()?.errorText));
                teacherPage.on('response', async response => {
                    if (response.status() >= 400 && response.url().includes('/rest/v1/')) console.error('Database request failed', new URL(response.url()).pathname, await response.text());
                });
                await teacherPage.addInitScript(config => { window.SUPABASE_CONFIG = config; }, config);
                await teacherPage.goto(`${baseUrl}/teacher.html`);
                await teacherPage.locator('#teacher-email').fill(a.email);
                await teacherPage.locator('#teacher-password').fill(a.password);
                await teacherPage.locator('#teacher-login-form button[type=submit]').click();
                await teacherPage.locator('#tab-classes').waitFor({ state: 'visible', timeout: 10000 }).catch(async error => {
                    console.error(await teacherPage.locator('body').innerText()); throw error;
                });
                await teacherPage.locator('#tab-classes').click();
                const teacherView = teacherPage.locator('#teacher-classes-view');
                await teacherView.getByRole('heading', { name: 'Classes', exact: true }).waitFor();
                const classCard = teacherView.getByRole('article').filter({ has: teacherPage.getByRole('heading', { name: '6A', exact: true }) });
                await classCard.waitFor({ state: 'visible' });
                assert.equal(await classCard.count(), 1, 'Only this teacher’s matching class is listed');
                await classCard.getByText('Technology · 2026', { exact: true }).waitFor();
                await classCard.getByRole('button', { name: 'Open class', exact: true }).click();
                await teacherView.getByRole('button', { name: 'Invite students', exact: true }).click();
                const inviteDialog = teacherPage.getByRole('dialog', { name: 'Invite students', exact: true });
                await inviteDialog.getByLabel('Student emails', { exact: true }).fill(neither.email);
                await inviteDialog.getByRole('button', { name: 'Invite students', exact: true }).click();
                await inviteDialog.waitFor({ state: 'detached' });
                await teacherView.getByText(neither.email + ' · Invited', { exact: false }).waitFor();
                await teacherView.getByRole('button', { name: 'Work', exact: true }).click();
                const baseline = await a.repo.listAssignments(ca.id);
                async function publishSavedMaterial(label, source) {
                    await source.getByRole('button', { name: 'Assign material', exact: true }).click();
                    const dialog = teacherPage.getByRole('dialog', { name: 'Assign material', exact: true });
                    await dialog.locator('select[name=material]').selectOption({ label });
                    await dialog.locator(`input[name=classIds][value="${ca.id}"]`).check();
                    assert.equal(await dialog.locator('input[name=classIds]:checked').count(), 1);
                    await dialog.getByRole('button', { name: 'Assign material', exact: true }).click();
                    await dialog.waitFor({ state: 'detached' });
                    await teacherPage.locator('#teacher-assignments-view:not(.hidden)').waitFor();
                }
                await publishSavedMaterial('Vocabulary · Cell practice', teacherView);
                const assignmentView = teacherPage.locator('#teacher-assignments-view');
                await assignmentView.getByRole('heading', { name: 'Cell practice', exact: true }).first().waitFor();
                await publishSavedMaterial('Spark · Private reflection', assignmentView);
                const afterPublication = await a.repo.listAssignments(ca.id);
                assert.equal(afterPublication.filter(row => row.title === 'Cell practice').length,
                    baseline.filter(row => row.title === 'Cell practice').length + 1);
                assert.equal(afterPublication.filter(row => row.title === 'Private reflection').length,
                    baseline.filter(row => row.title === 'Private reflection').length + 1);
                const studentPage = await localPage();
                await studentPage.addInitScript(config => { window.SUPABASE_CONFIG = config; }, config);
                await studentPage.goto(`${baseUrl}/student.html`);
                await studentPage.locator('#login-email').fill(neither.email);
                await studentPage.locator('#login-password').fill(neither.password);
                await studentPage.locator('#student-login-form button[type=submit]').click();
                await studentPage.locator('#student-tab-classes').click();
                const studentView = studentPage.locator('#student-classes-view');
                await studentView.getByRole('button', { name: 'Join class' }).click();
                await studentPage.waitForFunction(() => document.querySelector('#student-classes-view [role=status]')?.textContent === ''
                    && ![...document.querySelectorAll('#student-classes-view button')].some(b => b.textContent === 'Join class'));
                assert.equal((await neither.repo.listMyClasses())[0].id, ca.id);
                await studentView.getByRole('button', { name: 'Cell practice', exact: true }).click();
                await studentPage.locator('#activity-menu-view').waitFor({ state: 'visible' });
                assert.equal(await studentPage.evaluate(() => studentApp.currentVocab.words[0].word), 'Changed');
                assert.equal(await studentView.getByLabel('School', { exact: true }).count(), 0, 'One school needs no chooser');
                await studentPage.locator('#student-tab-classes').click();
                await studentView.getByRole('button', { name: 'Private reflection', exact: true }).click();
                await studentView.getByLabel('Your written response').fill('My class response is private.');
                await studentView.getByRole('button', { name: 'Save response', exact: true }).click();
                await studentView.getByText('Response saved.', { exact: true }).waitFor();
                await teacherPage.locator('#tab-review').click();
                const reviewView = teacherPage.locator('#teacher-review-view');
                await reviewView.locator('select[name=class]').selectOption(ca.id);
                const activeSpark = reviewView.getByRole('article').filter({ has: teacherPage.getByRole('heading', { name: 'Private reflection', exact: true }) }).filter({ has: teacherPage.getByText('Available', { exact: true }) });
                await activeSpark.getByRole('button', { name: 'Review work', exact: true }).click();
                await reviewView.getByText('My class response is private.', { exact: true }).waitFor();
                await reviewView.getByRole('button', { name: 'Export results', exact: true }).click();
                await teacherPage.getByRole('dialog', { name: 'Export assignment results' }).getByRole('button', { name: 'Cancel', exact: true }).click();
                await a.repo.publishMaterial({ classIds: [ca.id], kind: 'spark', materialId: sparkCheckMaterialId,
                    releaseAt: new Date(Date.now()-60000).toISOString(), publicationKey: crypto.randomUUID() });
                await studentPage.locator('#student-tab-classes').click();
                await studentView.getByRole('button', { name: 'Private check', exact: true }).click();
                await studentView.getByLabel('Choose the spreadsheet cell.').selectOption('0');
                await studentView.getByLabel('Explain your answer.').fill('This answer is reviewed by my teacher.');
                await studentView.getByRole('button', { name: 'Check answers', exact: true }).click();
                await studentView.getByText('1 of 1 multiple-choice answers correct.', { exact: false }).waitFor();

                await studentView.getByRole('button', { name: 'Cell practice', exact: true }).click();
                await studentPage.locator('#activity-menu-view').waitFor({ state: 'visible' });
                await studentPage.locator('#back-to-vocab').click();
                const unitsView = studentPage.locator('#vocab-selection-view');
                await unitsView.waitFor({ state: 'visible' });
                await studentPage.waitForFunction(() => studentApp.activities.assignedVocabulary?.vocabs.some(v => v.name === 'Cell practice'));
                await studentPage.evaluate(async () => {
                    const vocab = studentApp.activities.assignedVocabulary.vocabs.find(v => v.name === 'Cell practice');
                    await studentApp.navigateTo({ view: 'units', trimester: studentApp.activities.schedule.getVocabTrimesterKey(vocab),
                        month: studentApp.activities.schedule.getVocabCalendarMonthKey(vocab) });
                });
                assert.match(studentPage.url(), /#\/units/);
                await unitsView.getByRole('button').filter({ hasText: 'Cell practice' }).first().click();
                await studentPage.locator('#activity-menu-view').waitFor({ state: 'visible' });
                assert.match(studentPage.url(), /unit\/assignment\./);
                const attemptResponse = studentPage.waitForResponse(r => r.url().includes('/rpc/start_student_activity_attempt'));
                await studentPage.locator('#activity-menu-view [data-activity="flashcards"]').click();
                assert.equal((await attemptResponse).status(), 200);
                await studentPage.locator('#activity-view').waitFor({ state: 'visible' });
                await studentPage.waitForFunction(() => studentApp.activityInstance?.constructor.name === 'FlashcardsActivity');
                const activityLink = studentPage.url();
                await studentPage.reload();
                await studentPage.waitForFunction(() => studentApp.activityInstance?.constructor.name === 'FlashcardsActivity');
                assert.equal(studentPage.url(), activityLink, 'Reload retains the selected assignment/activity');
                const unfinished = await admin.from('student_activity_progress').select('is_complete').eq('user_id', neither.id);
                assert.ifError(unfinished.error);
                assert.ok(!(unfinished.data || []).some(row => row.is_complete), 'Opening controllers does not complete student work');
                await teacherPage.evaluate(() => window.scrollTo(0, 0));
                await teacherPage.screenshot({ path: '/tmp/sparks-private-teacher-classes.png' });
                await studentPage.screenshot({ path: '/tmp/sparks-private-student-classes.png' });
            } finally { await browser.close(); server?.kill(); }
        });
    } finally {
        // Local test data only, in dependency order. Private invitation rows are
        // cleaned using the local database, never a hosted URL or token.
        const { execFileSync } = await import('node:child_process');
        if (classes.length) {
            const ids = classes.map(id => `'${id}'`).join(',');
            execFileSync('docker', ['exec', dbContainer, 'psql', '-U', 'postgres', '-d', 'postgres', '-v', 'ON_ERROR_STOP=1', '-c',
                `delete from public.student_xp_events where user_id in (${users.map(u => `'${u.id}'`).join(',')}); delete from public.student_unit_progress where assignment_id in (select id from public.class_assignments where class_id in (${ids})); delete from private.student_activity_attempts where assignment_id in (select id from public.class_assignments where class_id in (${ids})); delete from public.class_assignments where class_id in (${ids}); delete from private.class_material_versions where owner_id in (${users.map(u => `'${u.id}'`).join(',')}); delete from private.class_invitations where class_id in (${ids}); delete from public.class_memberships where class_id in (${ids}); delete from public.class_teachers where class_id in (${ids}); delete from public.teaching_classes where id in (${ids});`], { stdio: 'pipe' });
        }
        if (sparks.length) await admin.from('weekly_sparks').delete().in('id', sparks).throwOnError();
        if (materials.length) await admin.from('vocabularies').delete().in('id', materials).throwOnError();
        if (subjects.length) await admin.from('teacher_subjects').delete().in('id', subjects).throwOnError();
        execFileSync('docker',['exec',dbContainer,'psql','-U','postgres','-d','postgres','-v','ON_ERROR_STOP=1','-c',
            `delete from private.school_admin_events where school_id in ('${schoolA}','${schoolB}'); delete from private.school_invitations where school_id in ('${schoolA}','${schoolB}'); delete from public.school_settings where school_id in ('${schoolA}','${schoolB}'); delete from public.school_member_roles where school_id in ('${schoolA}','${schoolB}'); delete from public.school_memberships where school_id in ('${schoolA}','${schoolB}'); delete from public.school_academic_years where school_id in ('${schoolA}','${schoolB}'); delete from public.schools where id in ('${schoolA}','${schoolB}');`],{stdio:'pipe'});
        for (const user of users) {
            await admin.auth.admin.deleteUser(user.id);
            if (user.role === 'teacher') await admin.from('teacher_allowlist').delete().eq('email', user.email);
        }
        await Promise.all(clients.map(c => c.auth.signOut()));
    }
});
