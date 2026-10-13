import { requireSchoolId } from './schoolScope.js';
import { mapSubjectRow } from './subjectsRepository.js';
export async function saveTeacherSubjects(service, subjects, schoolId = requireSchoolId(), options = {}) {
        const assertCurrent = () => {
            options.signal?.throwIfAborted();
            if (options.isCurrent && !options.isCurrent()) throw new DOMException('Subject save session changed', 'AbortError');
        };
        assertCurrent();
        await service.init();
        assertCurrent();
        const client = service.getClient();
        const saved = [];
        // Earlier subjects may already be committed when cancellation stops this batch.
        for (const subject of subjects) {
            assertCurrent();
            const payload = { name: subject.name, color: subject.color || '#2563eb',
                sort_order: Number(subject.sortOrder) || 0, archived: subject.active === false };
            const id = subject.id || subject.slug;
            const query = /^[0-9a-f-]{36}$/.test(id || '')
                ? client.from('teacher_subjects').update(payload).eq('school_id', schoolId).eq('id', id)
                : client.from('teacher_subjects').insert({ ...payload, school_id: schoolId });
            let request = query.select('*').single();
            if (options.signal && typeof request.abortSignal === 'function') request = request.abortSignal(options.signal);
            const { data, error } = await request;
            assertCurrent();
            if (error) throw error;
            saved.push(mapSubjectRow(data));
        }
        return saved;
}
