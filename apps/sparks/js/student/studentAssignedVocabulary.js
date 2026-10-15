import { classroomRepository, assignmentVocabulary } from '../services/classroomRepository.js';
import { schoolContext } from '../services/schoolContext.js';
import { studentSchoolScope, waitStudentSchoolReady } from './studentSchoolSession.js';

// Published class snapshots are the only authenticated vocabulary source.
export async function loadAssignedVocabulary(activities, { force = false } = {}) {
    const sm = activities.sm, owner = sm.currentUser?.uid || sm.currentUser?.id;
    if (!owner) throw new Error('Sign in to see your assigned vocabulary.');
    const sameOwner = () => owner === (sm.currentUser?.uid || sm.currentUser?.id);
    try { if (schoolContext.getAccountId() !== owner) await schoolContext.load(owner); }
    catch (error) { if (!sameOwner()) throw new DOMException('Vocabulary account changed', 'AbortError'); throw error; }
    if (!sameOwner()) throw new DOMException('Vocabulary account changed', 'AbortError');
    await waitStudentSchoolReady(sm);
    if (!sameOwner()) throw new DOMException('Vocabulary account changed', 'AbortError');
    const key = studentSchoolScope(sm).key;
    const generation = schoolContext.getGeneration();
    if (!key) throw new Error('Choose a school in My classes to see your vocabulary.');
    if (!force && activities.assignedVocabulary?.key === key && activities.assignedVocabulary.isCurrent?.()
        && Date.now() - activities.assignedVocabulary.loadedAt < 60000) return activities.assignedVocabulary.vocabs;
    if (!force && activities.assignedVocabularyLoad?.key === key && activities.assignedVocabularyLoad.generation === generation) return activities.assignedVocabularyLoad.promise;
    activities.assignedVocabularyLoad?.controller.abort();
    const controller = new AbortController(), signal = controller.signal;
    const current = () => !signal.aborted && owner === (sm.currentUser?.uid || sm.currentUser?.id)
        && key === studentSchoolScope(sm).key && generation === schoolContext.getGeneration();
    const check = () => { if (!current()) throw new DOMException('Vocabulary scope changed', 'AbortError'); };
    const promise = (async () => {
        const classes = (await classroomRepository.listMyClasses({ signal })).filter(item => item.schoolId === schoolContext.getSchoolId() && !item.archived);
        check();
        const assignments = (await Promise.all(classes.map(item => classroomRepository.listAssignments(item.id, { signal })))).flat()
            .filter(item => item.kind === 'vocabulary' && !item.withdrawn && Number.isFinite(Date.parse(item.release_at)) && Date.parse(item.release_at) <= Date.now());
        check();
        const vocabs = [];
        for (let start = 0; start < assignments.length; start += 4) {
            const batch = await Promise.all(assignments.slice(start, start + 4).map(async assignment => {
                const detail = await classroomRepository.readAssignment(assignment.id, { signal }); check();
                const vocab = assignmentVocabulary(detail);
                return { ...vocab, subjectSlug: detail.content.subjectSlug || 'assignment',
                    month: detail.content.month || new Date(assignment.release_at).toLocaleString('en-US', { month: 'long', timeZone: 'America/Panama' }).toLowerCase(),
                    releaseAt: assignment.release_at, dueAt: assignment.due_at, closeAt: assignment.close_at };
            }));
            check(); vocabs.push(...batch);
        }
        check(); activities.assignedVocabulary = { key, vocabs, loadedAt: Date.now(), isCurrent: current }; return vocabs;
    })();
    activities.assignedVocabularyLoad = { key, promise, controller, generation };
    try { return await promise; }
    catch (error) { check(); throw error; }
    finally { if (activities.assignedVocabularyLoad?.promise === promise) activities.assignedVocabularyLoad = null; }
}
