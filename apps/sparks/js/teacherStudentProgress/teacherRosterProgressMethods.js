import { supabaseService } from '../supabaseService.js';
import { classroomRepository } from '../services/classroomRepository.js';
import { releasedVocabularyAssignments, buildStudentRosterProgress } from '../teacherStudentRosterProgress.js';
import { getTeacherProgressAccountId, getTeacherProgressQueryKey, getTeacherProgressQueryService } from './teacherProgressDataMethods.js';

export const teacherRosterProgressMethods = {
    async loadStudentRosterProgress({ generation, forceRefresh = false } = {}) {
        const service = getTeacherProgressQueryService(this);
        const query = options => (forceRefresh ? service.refresh(options) : service.ensure(options));
        const accountId = getTeacherProgressAccountId(this);
        const students = [...this.allStudentData];
        const ids = students.map(s => s.id);
        if (!ids.length) return;
        const repository = this.classroomRepository || classroomRepository;
        const now = Date.now();
        try {
            const [details, context] = await Promise.all([
                query({ accountId, key: getTeacherProgressQueryKey(this, 'roster-progress', ids),
                    queryFn: ({ signal }) => supabaseService.getStudentsProgressForTeacher(ids, { signal }) }),
                query({ accountId, key: getTeacherProgressQueryKey(this, 'roster-assignments'), queryFn: async ({ signal }) => {
                    const [classes, all] = await Promise.all([repository.listClasses({ signal }), repository.listAssignments(null, { signal })]);
                    const assigned = releasedVocabularyAssignments(all, classes, now);
                    const rosters = Object.fromEntries(await Promise.all([...new Set(assigned.map(a => a.class_id))]
                        .map(async id => [id, await repository.getRoster(id, { signal })])));
                    const assignments = [];
                    // Bound parallel reads of immutable published content.
                    for (let i = 0; i < assigned.length; i += 4) {
                        assignments.push(...await Promise.all(assigned.slice(i, i + 4).map(async a => {
                            const detail = await repository.readAssignment(a.id, { signal });
                            if (!detail?.content) throw new Error('Assigned vocabulary content is unavailable.');
                            return { ...a, content: detail.content };
                        })));
                    }
                    return { assignments, rosters };
                } })
            ]);
            if (generation !== this.studentProgressPageGeneration) return;
            const byId = new Map(details.map(d => [d.id, d]));
            for (const student of students) {
                const detail = byId.get(student.id);
                this.studentRosterProgressById.set(student.id, detail
                    ? { state: 'ready', progress: buildStudentRosterProgress({ ...student, units: detail.units || {} }, { ...context, now }) }
                    : { state: 'error' });
            }
        } catch (error) {
            if (generation !== this.studentProgressPageGeneration) return;
            for (const student of students) this.studentRosterProgressById.set(student.id, { state: 'error' });
            console.error('Could not load roster learning progress:', error);
        }
        if (generation === this.studentProgressPageGeneration) this.renderProgressTable();
    }
};
