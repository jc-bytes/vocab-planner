import { AUDIT_STUDENT_EMAIL, AUDIT_TEACHER_EMAIL, createLocalAdminClient, readLocalSupabaseStatus, runLocalAuditSql } from './local-supabase-audit.mjs';
import { isDeepStrictEqual } from 'node:util';

// Only the authenticated local audit fixture is eligible for this temporary
// state change. This helper never changes client gates or real learner records.
export async function prepareResponsiveArcadeFixture({ studentId, assignmentId, classId, fixture = 'august' }) {
    const expected = {
        august: { title: 'Cross-browser Audit Vocabulary', material: 'audit-private-vocabulary', publication: '6b47ab0a-2026-4000-8000-000000000001' },
        current: { title: 'Current class unit', material: 'audit-current-class-vocabulary', publication: '6b47ab0a-2026-4000-8000-000000000004' }
    }[fixture];
    if (!expected) throw new Error('Unknown local Arcade fixture.');
    const uuid = /^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
    if (![studentId, assignmentId, classId].every(value => uuid.test(value || ''))) throw new Error('Responsive Arcade fixture IDs are required.');
    const status = await readLocalSupabaseStatus({ startIfStopped: false });
    const admin = createLocalAdminClient(status);
    for (const value of [status.API_URL, admin.supabaseUrl]) {
        const url = new URL(value);
        if (url.protocol !== 'http:' || !['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname)) throw new Error('Responsive Arcade fixtures require the local API.');
    }
    const identity = await admin.auth.admin.getUserById(studentId);
    if (identity.error || identity.data.user?.email !== AUDIT_STUDENT_EMAIL) throw new Error('Responsive fixture must use the dedicated audit student.');
    const assignment = await admin.from('class_assignments').select('id,title,owner_id,publication_key,version_id').eq('id', assignmentId)
        .eq('class_id', classId).eq('school_id', '6b47ab0a-2026-4000-8000-000000000010').eq('kind', 'vocabulary').single();
    if (assignment.error || assignment.data?.title !== expected.title || assignment.data.publication_key !== expected.publication
        || !uuid.test(assignment.data.owner_id) || !uuid.test(assignment.data.version_id)) throw new Error('Arcade fixture must use its exact seeded publication.');
    const teacher = await admin.auth.admin.getUserById(assignment.data.owner_id);
    const classroom = await admin.from('teaching_classes').select('name,owner_id').eq('id', classId)
        .eq('school_id', '6b47ab0a-2026-4000-8000-000000000010').single();
    if (teacher.error || teacher.data.user?.email !== AUDIT_TEACHER_EMAIL || classroom.error
        || classroom.data.name !== 'Audit 6A' || classroom.data.owner_id !== assignment.data.owner_id) throw new Error('Arcade fixture must use the dedicated audit teacher and class.');
    runLocalAuditSql(`do $$ begin if not exists (
        select 1 from private.class_material_versions v where v.id='${assignment.data.version_id}'
        and v.owner_id='${assignment.data.owner_id}' and v.vocabulary_id='${expected.material}'
    ) then raise exception 'Arcade fixture material identity does not match'; end if; end $$;`);
    const unitKey = `assignment:${assignmentId}`;
    const unitQuery = () => admin.from('student_unit_progress').select('*').eq('user_id', studentId).eq('unit_key', unitKey).maybeSingle();
    const scoreQuery = () => admin.from('student_activity_progress').select('*').eq('user_id', studentId).eq('unit_key', unitKey).eq('activity_type', 'flashcards').maybeSingle();
    const [{ data: oldUnit, error: unitError }, { data: oldScore, error: scoreError }] = await Promise.all([unitQuery(), scoreQuery()]);
    if (unitError || scoreError) throw new Error('Could not snapshot the responsive audit fixture.');
    let unitCreated = false;
    const restore = async () => {
        if (oldUnit) await admin.from('student_unit_progress').upsert(oldUnit, { onConflict: 'user_id,unit_key' }).throwOnError();
        if (oldScore) await admin.from('student_activity_progress').upsert(oldScore, { onConflict: 'user_id,unit_key,activity_type' }).throwOnError();
        else await admin.from('student_activity_progress').delete().eq('user_id', studentId).eq('unit_key', unitKey).eq('activity_type', 'flashcards').throwOnError();
        if (unitCreated) await admin.from('student_unit_progress').delete().eq('user_id', studentId).eq('unit_key', unitKey).throwOnError();
        const [unit, score] = await Promise.all([unitQuery(), scoreQuery()]);
        const state = row => row && Object.fromEntries(Object.entries(row).filter(([name]) => name !== 'updated_at'));
        if (unit.error || score.error || !isDeepStrictEqual(state(unit.data), state(oldUnit)) || !isDeepStrictEqual(state(score.data), state(oldScore))) {
            throw new Error('Responsive audit fixture restoration did not match its snapshot.');
        }
    };
    async function setComplete(complete) {
        await admin.from('student_activity_progress').upsert({
            user_id: studentId, unit_key: unitKey, activity_type: 'flashcards',
            score: complete ? 100 : 0, is_complete: complete, verified: true,
            plays: complete ? 1 : 0, details: { fixture: 'responsive-arcade' }
        }, { onConflict: 'user_id,unit_key,activity_type' }).throwOnError();
    }
    try {
        if (!oldUnit) {
            await admin.from('student_unit_progress').insert({ user_id: studentId, unit_key: unitKey, unit_name: assignment.data.title }).throwOnError();
            unitCreated = true;
        }
        await setComplete(false);
        return { unitKey, assignmentId, complete: () => setComplete(true), restore };
    } catch (error) { await restore(); throw error; }
}
