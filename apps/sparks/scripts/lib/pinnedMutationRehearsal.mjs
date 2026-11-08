import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';
import { supabaseService } from '../../js/supabaseService.js';
import { schoolContext } from '../../js/services/schoolContext.js';
import { classroomRepository } from '../../js/services/classroomRepository.js';
import { schoolRepository } from '../../js/services/schoolRepository.js';
import { vocabularyRepository } from '../../js/services/vocabularyRepository.js';
import { sparksRepository } from '../../js/services/sparksRepository.js';
import { subjectsRepository } from '../../js/services/subjectsRepository.js';
import { teacherGroupRestrictionsRepository } from '../../js/services/teacherGroupRestrictionsRepository.js';
import { teacherExportRepository } from '../../js/services/teacherExportRepository.js';
import { OWNED_RPC_PROBES } from '../verify-owned-rpc-readiness.mjs';

// Invoked only inside the existing disposable SQL/PostgREST rehearsal. All rows,
// JWTs and the shared authorized actors belong to that schema-only clone.
export async function rehearsePinnedMutations({ sql, base, jwt, teacher, studentA, studentB, school, subject, classId,
    vocabularyId, vocabularyAssignment, reflectionId, attemptId }) {
    const otherTeacher = randomUUID(), ticket = randomUUID(), email = `${otherTeacher}@pinned-rehearsal.invalid`;
    sql(`select public.issue_auth_user_provisioning_ticket('${email}','${ticket}');
        insert into auth.users(id,email,email_confirmed_at,raw_user_meta_data) values('${otherTeacher}','${email}',now(),'{"provisioning_token":"${ticket}"}');
        update public.profiles set role='teacher' where user_id='${otherTeacher}';
        insert into public.school_memberships(school_id,user_id) values('${school}','${otherTeacher}');
        insert into public.school_member_roles(school_id,user_id,role) values('${school}','${otherTeacher}','teacher'),('${school}','${otherTeacher}','school_admin'),('${school}','${teacher}','school_admin');
        insert into public.class_teachers(class_id,teacher_id,school_id) values('${classId}','${otherTeacher}','${school}') on conflict do nothing;
        update private.student_activity_attempts set late_at=now() where id='${attemptId}';`);
    assert.equal(sql(`begin;set local role authenticated;set local request.jwt.claim.sub='${otherTeacher}';
        select private.owns_teaching_class('${classId}') and private.has_school_role('${school}','school_admin');commit;`), 't');
    const session = id => ({ data: { session: { user: { id }, access_token: jwt(id) } }, error: null });
    const freshClient = () => createClient(base, 'test-key', {
        auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
        global: { fetch: (url, options) => fetch(String(url).replace('/rest/v1/', '/'), options) }
    });
    const originalInit = supabaseService.init, original = { client: supabaseService.client,
        currentUser: supabaseService.currentUser, currentSession: supabaseService.currentSession,
        authIdentityGeneration: supabaseService.authIdentityGeneration };
    supabaseService.init = async () => {};
    let incarnation = 100;
    async function prepare(actor = teacher) {
        const client = freshClient();
        await new Promise(resolve => setImmediate(resolve));
        client.auth.getSession = async () => session(actor);
        supabaseService.client = client; supabaseService.currentUser = { uid: actor };
        supabaseService.currentSession = session(actor).data.session; supabaseService.authIdentityGeneration = ++incarnation;
        await schoolContext.load(actor);
        return client;
    }
    async function race(label, call, verify, actor = teacher, replacement = otherTeacher) {
        const client = await prepare(actor);
        let reached, release, count = 0;
        const entered = new Promise(resolve => { reached = resolve; });
        const held = new Promise(resolve => { release = resolve; });
        client.auth.getSession = async () => {
            if (++count === 1) return session(actor);
            if (count === 2) { reached(); await held; }
            return session(replacement);
        };
        const pending = call();
        await entered;
        supabaseService.currentUser = { uid: replacement };
        supabaseService.currentSession = session(replacement).data.session;
        supabaseService.authIdentityGeneration = ++incarnation;
        release();
        await assert.rejects(pending, error => error.name === 'AbortError');
        verify();
        const unrelated = await client.rpc('my_school_access_v1');
        assert.equal(unrelated.error, null, 'replacement account retains an independent usable SDK session');
        console.log(`${label}: held SDK replacement token; real database retained original actor only.`);
    }
    try {
        for (const name of ['teacher_class_progress_v1', 'teacher_class_gradebook_v1', 'my_class_vocabulary_grades_v1']) {
            const response = await fetch(`${base}/rpc/${name}`, { method: 'POST',
                headers: { apikey: 'sb_publishable_local_probe', 'Content-Type': 'application/json' },
                body: JSON.stringify(OWNED_RPC_PROBES[name]), signal: AbortSignal.timeout(5000) });
            const result = await response.json();
            assert.ok([401, 403].includes(response.status));
            assert.equal(result.code, '42501');
            assert.equal(result.message, `permission denied for function ${name}`);
            console.log(`${name}: exact read signature returned anonymous 42501 ACL denial from real PostgREST.`);
        }
        await race('Teacher feedback', () => classroomRepository.saveStudentFeedback({ assignmentId: vocabularyAssignment,
            studentId: studentA, note: 'Original teacher note', expectedRevision: 0 }), () => {
            assert.equal(sql(`select updated_by from private.student_assignment_feedback where assignment_id='${vocabularyAssignment}' and student_id='${studentA}'`), teacher);
        });
        const key = randomUUID();
        await race('Class publication', () => classroomRepository.publishMaterial({ classIds: [classId], kind: 'vocabulary',
            materialId: vocabularyId, expectedRevision: Number(sql(`select content_revision from public.vocabularies where id='${vocabularyId}'`)), releaseAt: '2026-01-01T00:00:00Z', publicationKey: key }), () => {
            assert.equal(sql(`select owner_id from public.class_assignments where publication_key='${key}'`), teacher);
            assert.equal(sql(`select count(*) from public.class_assignments where publication_key='${key}' and owner_id='${otherTeacher}'`), '0');
        });
        await race('School role administration', () => schoolRepository.setMember(school, studentA, ['student'], true, { grade: '6', section: 'B' }), () => {
            assert.equal(sql(`select actor_id from private.school_admin_events where school_id='${school}' and target_user_id='${studentA}' and action='member.changed' order by created_at desc limit 1`), teacher);
        });
        await race('Vocabulary update', () => vocabularyRepository.update(vocabularyId, { name: 'Pinned vocabulary update', contentRevision: Number(sql(`select content_revision from public.vocabularies where id='${vocabularyId}'`)) }), () => {
            assert.equal(sql(`select name from public.vocabularies where id='${vocabularyId}'`), 'Pinned vocabulary update');
            assert.equal(sql(`select owner_id from public.vocabularies where id='${vocabularyId}'`), teacher);
        });
        await race('Spark update', () => sparksRepository.update(reflectionId, { title: 'Pinned Spark update' }), () => {
            assert.equal(sql(`select title from public.weekly_sparks where id='${reflectionId}'`), 'Pinned Spark update');
        });
        await race('Teacher subjects batch', () => subjectsRepository.saveAll([{ id: subject, name: 'Pinned subject update' }, { name: 'Must not be inserted' }]), () => {
            assert.equal(sql(`select name from public.teacher_subjects where id='${subject}'`), 'Pinned subject update');
            assert.equal(sql("select count(*) from public.teacher_subjects where name='Must not be inserted'"), '0');
        });
        await race('Personal group restrictions', () => teacherGroupRestrictionsRepository.create(studentA, studentB), () => {
            assert.equal(sql(`select teacher_id from public.teacher_group_pair_restrictions where school_id='${school}'`), teacher);
        });
        await race('Export audit', () => teacherExportRepository.logExport({ schoolId: school, teacherId: teacher, filename: 'pinned-fixture.json', timestamp: '2026-11-04T00:00:00Z' }), () => {
            assert.equal(sql("select teacher_id from public.export_logs where filename='pinned-fixture.json'"), teacher);
        });
        await race('Teacher late-work review', () => supabaseService.setStudentActivityLateOverride(attemptId, { excused: true, reason: 'Original teacher approval' }), () => {
            assert.equal(sql(`select late_override_by from private.student_activity_attempts where id='${attemptId}'`), teacher);
        });
        sql(`select private.ensure_student_progress_summary_v3('${studentA}'); select private.ensure_student_progress_summary_v3('${studentB}');
            update public.student_progress_summary set coins=100,coin_data='{"balance":100,"giftCoins":0,"totalEarned":100,"totalSpent":0,"totalGifted":0}' where user_id in ('${studentA}','${studentB}');`);
        const receipt = `pinned-spend-${randomUUID()}`;
        await race('Student coin debit', () => supabaseService.spendStudentCoins({ eventId: receipt, amount: 7, clientId: 'pinned-fixture' }), () => {
            assert.equal(sql(`select coins from public.student_progress_summary where user_id='${studentA}'`), '93');
            assert.equal(sql(`select coins from public.student_progress_summary where user_id='${studentB}'`), '100');
            assert.equal(sql(`select user_id from public.student_coin_ledger where event_key='spend:${receipt}'`), studentA);
        }, studentA, studentB);
        const client = await prepare();
        let reached, release;
        const entered = new Promise(resolve => { reached = resolve; });
        const held = new Promise(resolve => { release = resolve; });
        client.auth.getSession = async () => { reached(); await held; return session(otherTeacher); };
        const before = sql(`select count(*) from private.school_admin_events where school_id='${school}'`);
        const pending = schoolRepository.setMember(school, studentB, ['teacher'], true);
        await entered; supabaseService.currentUser = { uid: otherTeacher }; supabaseService.authIdentityGeneration = ++incarnation; release();
        await assert.rejects(pending, { name: 'AbortError' });
        assert.equal(sql(`select count(*) from private.school_admin_events where school_id='${school}'`), before);
        console.log('Session replacement during executor acquisition rejected before any school-role write.');
    } finally {
        schoolContext.clear(); Object.assign(supabaseService, original); supabaseService.init = originalInit;
    }
}
