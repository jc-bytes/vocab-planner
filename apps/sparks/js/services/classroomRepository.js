import { readSectionQuery } from './sectionRead.js';
import { requireSchoolId } from './schoolScope.js';
import { supabaseService } from '../supabaseService.js';
import { readCollection } from './readCollection.js';
import { requestWithTimeout } from './requestReliability.js';
import { schoolContext } from './schoolContext.js';
import { runOwnedMutation, serviceMutationIdentity } from './ownedMutation.js';

// RLS/RPCs derive the owner from auth.uid(). Callers never supply a teacher ID.
export function createClassroomRepository(getClient, getSchoolId = requireSchoolId, ownership = {}) {
    const write = (build, options) => runOwnedMutation(getClient, build, { ...ownership, ...options });
    const writeRpc = (name, args, options) => {
        const snapshot = JSON.parse(JSON.stringify(args));
        return write(client => client.rpc(name, snapshot), options);
    };
    const collection = (build, signal, client) => readCollection(getClient, build, signal, client);
    async function result(query, signal) {
        const { data, error } = await (signal ? query.abortSignal(signal) : query);
        if (error) throw error;
        return data;
    }
    async function rpc(name, args = {}, options = {}) {
        // All mutations use writeRpc or studentWrite. This path only reads,
        // including the class progress and gradebook additions.
        const query = (await getClient()).rpc(name, args);
        return result(readSectionQuery(query, options));
    }
    function studentWrite(name, args, options = {}) {
        const snapshot = JSON.parse(JSON.stringify(args));
        // UI callers provide their captured owner. CLI/custom repositories resolve
        // identity from their own client, never the application's mutable singleton.
        const ownerUserId = String(options.ownerUserId || '').trim();
        return requestWithTimeout(async signal => {
            const { ownedClassroomWrite } = await import('./classroomStudentWrites.js');
            signal.throwIfAborted();
            return ownedClassroomWrite(getClient, name, snapshot, ownerUserId, signal);
        }, { signal: options.signal, timeoutMs: options.timeoutMs || 30000, label: 'Saving student work' });
    }
    return Object.freeze({
        assignmentFeedback: (assignmentId, options) => rpc('assignment_student_feedback_v1', {
            p_school_id: getSchoolId(), p_assignment_id: assignmentId
        }, options),
        saveStudentFeedback: ({ assignmentId, studentId, activityType = '', note, reviewStatus = 'unreviewed', responseRevision = null, expectedRevision = 0 }, options) => writeRpc('save_student_assignment_feedback_v1', {
            p_school_id: getSchoolId(), p_assignment_id: assignmentId, p_student_id: studentId,
            p_activity_type: activityType, p_note: note, p_review_status: reviewStatus,
            p_response_revision: responseRevision, p_expected_revision: expectedRevision
        }, options),
        studentFeedbackHistory: (studentId, assignmentId, activityType = '', offset = 0, options) => rpc('student_feedback_history_v1', {
            p_school_id: getSchoolId(), p_assignment_id: assignmentId, p_student_id: studentId,
            p_activity_type: activityType, p_offset: offset
        }, options),
        classProgress: (classId, from, to, options) => rpc('teacher_class_progress_v1', {
            p_school_id: getSchoolId(), p_class_id: classId, p_from: from, p_to: to
        }, options),
        classGradebook: (classId, from, to, options) => rpc('teacher_class_gradebook_v1', {
            p_school_id: getSchoolId(), p_class_id: classId, p_from: from, p_to: to
        }, options),
        setAssignmentGrading: (assignmentId, config, expectedRevision, options) => studentWrite('teacher_set_assignment_grading_v1', {
            p_school_id: getSchoolId(), p_assignment_id: assignmentId, p_config: config, p_expected_revision: expectedRevision
        }, options),
        publishVocabularyGrades: (assignmentId, expectedRevision, options) => studentWrite('teacher_publish_vocabulary_grades_v1', {
            p_school_id: getSchoolId(), p_assignment_id: assignmentId, p_expected_revision: expectedRevision
        }, options),
        myVocabularyGrades: (classId, options) => rpc('my_class_vocabulary_grades_v1', {
            p_school_id: getSchoolId(), p_class_id: classId
        }, options),
        studentInsight: (studentId, schoolYear, options) => rpc('teacher_student_insight_v1', {
            p_school_id: getSchoolId(), p_student_id: studentId, p_school_year: schoolYear
        }, options),
        studentAttempts: (studentId, assignmentId, activityType, offset = 0, options) => rpc('teacher_student_attempts_v1', {
            p_school_id: getSchoolId(), p_student_id: studentId, p_assignment_id: assignmentId,
            p_activity_type: activityType, p_offset: offset, p_limit: 20
        }, options),
        async listSubjects(options = {}) {
            const schoolId = getSchoolId();
            return collection((client, count) => client.from('teacher_subjects').select('*', count)
                .eq('school_id', schoolId).order('name').order('id'), options.signal);
        },
        async createSubject(name, options) {
            const schoolId = getSchoolId();
            const payload = { name: String(name).trim(), school_id: schoolId };
            return write(client => client.from('teacher_subjects').insert(payload).select('*').single(), options);
        },
        async listClasses(options = {}) {
            const schoolId = getSchoolId();
            return rpc('list_teaching_classes_v1', { p_school_id: schoolId }, options);
        },
        async listOwnMaterials(options = {}) {
            const schoolId = getSchoolId();
            options.signal?.throwIfAborted();
            const client = await getClient();
            options.signal?.throwIfAborted();
            const { data: { user }, error } = await client.auth.getUser();
            options.signal?.throwIfAborted();
            if (error) throw error;
            if (!user) throw new Error('Sign in to assign materials.');
            const [vocabulary, sparks] = await Promise.all([
                collection((client, count) => client.from('vocabularies').select('id,name,content_revision', count)
                    .eq('school_id', schoolId).is('archived_at', null).order('name').order('id'), options.signal, client),
                collection((client, count) => client.from('weekly_sparks').select('id,title', count)
                    .eq('school_id', schoolId).order('title').order('id'), options.signal, client)
            ]);
            return [...vocabulary.map(v => ({ id: v.id, title: v.name, revision: v.content_revision, kind: 'vocabulary' })),
                ...sparks.map(s => ({ id: s.id, title: s.title, kind: 'spark' }))];
        },
        async createClass({ name, subjectId, schoolYear }, options) {
            const schoolId = getSchoolId();
            return writeRpc('create_teaching_class_v1', { p_school_id: schoolId, p_name: String(name).trim(),
                p_subject_id: subjectId, p_school_year: Number(schoolYear) }, options);
        },
        async setClassArchived(classId, archived, options) {
            const value = Boolean(archived);
            return write(client => client.from('teaching_classes').update({ archived: value })
                .eq('id', classId).select('*').single(), options);
        },
        listClassTeachers: (classId, options) => rpc('get_class_teachers_v1', { p_class_id: classId }, options),
        setClassTeacher: (classId, teacherId, active, options) => writeRpc('set_class_teacher_v1', { p_class_id: classId, p_teacher_id: teacherId, p_active: active }, options),
        getResults: (assignmentId, options) => rpc('assignment_results_v1', { p_assignment_id: assignmentId }, options),
        listInvitations: (classId, options) => rpc('list_class_invitations_v1', { p_class_id: classId }, options),
        revokeInvitation: (invitationId, options) => writeRpc('revoke_class_invitation_v1', { p_invitation_id: invitationId }, options),
        inviteStudents: (classId, emails, options) => writeRpc('invite_class_students_v1', { p_class_id: classId, p_emails: emails }, options),
        getRoster: (classId, options) => rpc('class_roster_v1', { p_class_id: classId }, options),
        inviteStudent: (classId, email, options) => writeRpc('invite_class_student_v1', { p_class_id: classId, p_email: email }, options),
        removeStudent: (classId, studentId, options) => writeRpc('remove_class_student_v1', { p_class_id: classId, p_student_id: studentId }, options),
        listMyClasses: options => rpc('my_teaching_classes_v1', {}, options),
        listMyInvitations: options => rpc('my_class_invitations_v1', {}, options),
        acceptInvitation: (invitationId, options) => writeRpc('accept_class_invitation_v1', { p_invitation_id: invitationId }, options),
        async listAssignments(classId, options = {}) {
            const schoolId = classId ? null : getSchoolId();
            return collection((client, count) => client.from('class_assignments').select('*', count)
                .eq(classId ? 'class_id' : 'school_id', classId || schoolId)
                .order('release_at', { ascending: false }).order('id', { ascending: false }), options.signal);
        },
        async listResponses(assignmentId, options = {}) {
            return collection((client, count) => client.from('class_assignment_responses').select('*', count)
                .eq('assignment_id', assignmentId).order('submitted_at').order('student_id'), options.signal);
        },
        async listReviewResponses(assignmentIds, options = {}) {
            const rows = [], ids = [...new Set(assignmentIds)];
            for (let offset = 0; offset < ids.length; offset += 50) {
                rows.push(...await collection((client, count) => client.from('class_assignment_responses')
                    .select('assignment_id,student_id,revision,evaluation', count)
                    .in('assignment_id', ids.slice(offset, offset + 50))
                    .order('assignment_id').order('student_id'), options.signal));
            }
            return rows;
        },
        checkSpark: (assignmentId, answers, expectedRevision, options = {}) => studentWrite('check_class_spark_owned_v1', {
            p_assignment_id: assignmentId, p_answers: answers, p_expected_revision: expectedRevision
        }, options),
        saveResponse: (assignmentId, response, expectedRevision, options = {}) => studentWrite('save_class_response_owned_v1', {
            p_assignment_id: assignmentId, p_response: response, p_expected_revision: expectedRevision
        }, options),
        readAssignment: (assignmentId, options) => rpc('read_class_assignment_v1', { p_assignment_id: assignmentId }, options),
        publishMaterial: ({ classIds, kind, materialId, releaseAt, publicationKey, expectedRevision = null, dueAt = null, closeAt = null }, options) =>
            writeRpc('publish_class_material_v2', { p_class_ids: classIds, p_kind: kind, p_material_id: materialId,
                p_release_at: releaseAt, p_expected_revision: expectedRevision, p_publication_key: publicationKey, p_due_at: dueAt, p_close_at: closeAt }, options),
        vocabularyPublicationState: (materialId, options) => rpc('vocabulary_publication_state_v1', { p_school_id: getSchoolId(), p_material_id: materialId }, options),
        previewVocabularyChange: (materialId, request, options) => rpc('preview_vocabulary_change_v1', { p_school_id: getSchoolId(), p_material_id: materialId, p_request: request }, options),
        applyVocabularyChange: (materialId, request, token, requestKey, options) => writeRpc('apply_vocabulary_change_v1', { p_school_id: getSchoolId(), p_material_id: materialId, p_request: request, p_preview_token: token, p_request_key: requestKey }, options),
        auditVocabularyPublications: options => rpc('audit_vocabulary_publications_v1', { p_school_id: getSchoolId() }, options),
        withdrawAssignment: (assignmentId, options) => writeRpc('withdraw_class_assignment_v1', { p_assignment_id: assignmentId }, options)
    });
}

export const classroomRepository = createClassroomRepository(async () => {
    await supabaseService.init();
    return supabaseService.getClient();
}, requireSchoolId, { getIdentity: () => serviceMutationIdentity(supabaseService), context: schoolContext });

export function assignmentVocabulary(detail) {
    if (detail.kind !== 'vocabulary') throw new Error('This assignment is not a vocabulary activity.');
    return { ...detail.content, ...(detail.vocabularyPlacement || {}), id: detail.materialId, assignmentId: detail.id, contentRevision: detail.content_revision, contentVersionId: detail.version_id,
        releaseAt: detail.release_at, closeAt: detail.close_at, withdrawn: Boolean(detail.withdrawn),
        name: detail.title, subjectSlug: 'assignment', className: detail.className, classId: detail.classId || detail.class_id,
        __source: 'assignment', path: null };
}
