import { runOwnedMutation, serviceMutationIdentity } from './ownedMutation.js';
import { schoolContext } from './schoolContext.js';
import { readAuthSessionId } from './supabaseValues.js';
import { requireSchoolId } from './schoolScope.js';
import { mapSubjectRow } from './subjectsRepository.js';
export async function saveTeacherSubjects(service, subjects, schoolId = requireSchoolId(), options = {}) {
        const identity = serviceMutationIdentity(service);
        const schoolGeneration = schoolContext.getGeneration();
        const sessionId = readAuthSessionId(identity.session);
        const assertCurrent = () => {
            options.signal?.throwIfAborted();
            const current = serviceMutationIdentity(service);
            if (schoolContext.getGeneration() !== schoolGeneration || current.userId !== identity.userId
                || current.generation !== identity.generation
                || sessionId && readAuthSessionId(current.session) !== sessionId
                || options.ownerUserId && options.ownerUserId !== identity.userId
                || options.isCurrent && !options.isCurrent()) throw new DOMException('Subject save session changed', 'AbortError');
        };
        assertCurrent();
        const snapshot = JSON.parse(JSON.stringify(subjects));
        const saved = [];
        // Earlier subjects may already be committed when cancellation stops this batch.
        for (const subject of snapshot) {
            assertCurrent();
            const payload = { name: subject.name, color: subject.color || '#2563eb',
                sort_order: Number(subject.sortOrder) || 0, archived: subject.active === false };
            const id = subject.id || subject.slug;
            const data = await runOwnedMutation(async () => {
                await service.init();
                assertCurrent();
                return service.getClient();
            }, client => {
            const query = /^[0-9a-f-]{36}$/.test(id || '')
                ? client.from('teacher_subjects').update(payload).eq('school_id', schoolId).eq('id', id)
                : client.from('teacher_subjects').insert({ ...payload, school_id: schoolId });
            return query.select('*').single();
            }, { ...options, ownerUserId: identity.userId, context: schoolContext,
                getIdentity: () => serviceMutationIdentity(service) });
            assertCurrent();
            saved.push(mapSubjectRow(data));
        }
        return saved;
}
