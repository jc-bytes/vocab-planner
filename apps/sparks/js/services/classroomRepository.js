import { requireSchoolId } from './schoolScope.js';
import { supabaseService } from '../supabaseService.js';

// RLS/RPCs derive the owner from auth.uid(). Callers never supply a teacher ID.
export function createClassroomRepository(getClient, getSchoolId = requireSchoolId) {
    // Count the first page so a server row cap below our page size cannot truncate a collection.
    async function collection(build, signal, client) {
        signal?.throwIfAborted();
        client ||= await getClient();
        signal?.throwIfAborted();
        const rows = [];
        let total = null;
        do {
            signal?.throwIfAborted();
            let query = build(client, rows.length ? undefined : { count: 'exact' }).range(rows.length, rows.length + 499);
            if (signal) query = query.abortSignal(signal);
            const { data, error, count } = await query;
            signal?.throwIfAborted();
            if (error) throw error;
            if (count != null) total = count;
            if (!data?.length) break;
            rows.push(...data);
        } while (total === null || rows.length < total);
        return rows;
    }
    async function result(query, signal) {
        const { data, error } = await (signal ? query.abortSignal(signal) : query);
        if (error) throw error;
        return data;
    }
    async function rpc(name, args = {}, options = {}) {
        return result((await getClient()).rpc(name, args), options.signal);
    }
    return Object.freeze({
        assignmentFeedback: (assignmentId, options) => rpc('assignment_student_feedback_v1', {
            p_school_id: getSchoolId(), p_assignment_id: assignmentId
        }, options),
        saveStudentFeedback: ({ assignmentId, studentId, activityType = '', note, reviewStatus = 'unreviewed', responseRevision = null, expectedRevision = 0 }) => rpc('save_student_assignment_feedback_v1', {
            p_school_id: getSchoolId(), p_assignment_id: assignmentId, p_student_id: studentId,
            p_activity_type: activityType, p_note: note, p_review_status: reviewStatus,
            p_response_revision: responseRevision, p_expected_revision: expectedRevision
        }),
        studentFeedbackHistory: (studentId, assignmentId, activityType = '', offset = 0, options) => rpc('student_feedback_history_v1', {
            p_school_id: getSchoolId(), p_assignment_id: assignmentId, p_student_id: studentId,
            p_activity_type: activityType, p_offset: offset
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
        async createSubject(name) {
            const schoolId = getSchoolId();
            return result((await getClient()).from('teacher_subjects').insert({ name: String(name).trim(), school_id: schoolId }).select('*').single());
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
                collection((client, count) => client.from('vocabularies').select('id,name', count)
                    .eq('school_id', schoolId).order('name').order('id'), options.signal, client),
                collection((client, count) => client.from('weekly_sparks').select('id,title', count)
                    .eq('school_id', schoolId).order('title').order('id'), options.signal, client)
            ]);
            return [...vocabulary.map(v => ({ id: v.id, title: v.name, kind: 'vocabulary' })),
                ...sparks.map(s => ({ id: s.id, title: s.title, kind: 'spark' }))];
        },
        async createClass({ name, subjectId, schoolYear }) {
            const schoolId = getSchoolId();
            return rpc('create_teaching_class_v1', { p_school_id: schoolId, p_name: String(name).trim(),
                p_subject_id: subjectId, p_school_year: Number(schoolYear) });
        },
        async setClassArchived(classId, archived) {
            return result((await getClient()).from('teaching_classes').update({ archived: Boolean(archived) })
                .eq('id', classId).select('*').single());
        },
        listClassTeachers: (classId, options) => rpc('get_class_teachers_v1', { p_class_id: classId }, options),
        setClassTeacher: (classId, teacherId, active) => rpc('set_class_teacher_v1', { p_class_id: classId, p_teacher_id: teacherId, p_active: active }),
        getResults: (assignmentId, options) => rpc('assignment_results_v1', { p_assignment_id: assignmentId }, options),
        listInvitations: (classId, options) => rpc('list_class_invitations_v1', { p_class_id: classId }, options),
        revokeInvitation: invitationId => rpc('revoke_class_invitation_v1', { p_invitation_id: invitationId }),
        inviteStudents: (classId, emails) => rpc('invite_class_students_v1', { p_class_id: classId, p_emails: emails }),
        getRoster: (classId, options) => rpc('class_roster_v1', { p_class_id: classId }, options),
        inviteStudent: (classId, email) => rpc('invite_class_student_v1', { p_class_id: classId, p_email: email }),
        removeStudent: (classId, studentId) => rpc('remove_class_student_v1', { p_class_id: classId, p_student_id: studentId }),
        listMyClasses: options => rpc('my_teaching_classes_v1', {}, options),
        listMyInvitations: options => rpc('my_class_invitations_v1', {}, options),
        acceptInvitation: invitationId => rpc('accept_class_invitation_v1', { p_invitation_id: invitationId }),
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
        checkSpark: (assignmentId, answers, expectedRevision) => rpc('check_class_spark_v1', {
            p_assignment_id: assignmentId, p_answers: answers, p_expected_revision: expectedRevision
        }),
        saveResponse: (assignmentId, response, expectedRevision) => rpc('save_class_response_v1', {
            p_assignment_id: assignmentId, p_response: response, p_expected_revision: expectedRevision
        }),
        readAssignment: (assignmentId, options) => rpc('read_class_assignment_v1', { p_assignment_id: assignmentId }, options),
        publishMaterial: ({ classIds, kind, materialId, releaseAt, publicationKey, dueAt = null, closeAt = null }) =>
            rpc('publish_class_material_v1', { p_class_ids: classIds, p_kind: kind, p_material_id: materialId,
                p_release_at: releaseAt, p_publication_key: publicationKey, p_due_at: dueAt, p_close_at: closeAt }),
        withdrawAssignment: assignmentId => rpc('withdraw_class_assignment_v1', { p_assignment_id: assignmentId })
    });
}

export const classroomRepository = createClassroomRepository(async () => {
    await supabaseService.init();
    return supabaseService.getClient();
});

export function assignmentVocabulary(detail) {
    if (detail.kind !== 'vocabulary') throw new Error('This assignment is not a vocabulary activity.');
    return { ...detail.content, id: detail.materialId, assignmentId: detail.id,
        name: detail.title, subjectSlug: 'assignment', className: detail.className,
        __source: 'assignment', path: null };
}
