import { schoolContext } from '../services/schoolContext.js';

// Take report data before any lazy import or image request can yield to navigation.
export function captureStudentReport(sm, data = {}, context = schoolContext) {
    const account = sm.currentUser?.uid || sm.currentUser?.id;
    const vocabulary = sm.currentVocab;
    const session = sm.activities?.session;
    const load = session?.vocabularyLoadId;
    const generation = context.getGeneration();
    const snapshot = JSON.parse(JSON.stringify({ profile: sm.studentProfile, vocabulary, ...data }));
    return {
        ...snapshot,
        ownerUserId: account,
        assertCurrent() {
            if (account !== (sm.currentUser?.uid || sm.currentUser?.id)
                || vocabulary !== sm.currentVocab || load !== session?.vocabularyLoadId
                || generation !== context.getGeneration()) {
                throw new DOMException('The account, school, or assignment changed. Start the export again.', 'AbortError');
            }
        }
    };
}
