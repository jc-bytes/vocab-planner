import { schoolContext } from '../services/schoolContext.js';

export function studentSchoolScope(manager) {
    const accountId = manager.currentUser?.uid || manager.currentUser?.id;
    let schoolId = schoolContext.getAccountId() === accountId ? schoolContext.getSchoolId() : null;
    if (!schoolId && globalThis.navigator?.onLine === false && accountId) {
        try { schoolId = localStorage.getItem(`sparks:school:${accountId}`); } catch { /* Optional offline display cache. */ }
    }
    return { accountId, schoolId, key: accountId && schoolId ? `sparks:student-school:${accountId}:${schoolId}` : null };
}

export function applyStudentSchoolPlacement(manager) {
    if (manager.authDisabled) return;
    const scope = studentSchoolScope(manager);
    let placement = { grade: '', section: '' };
    const school = schoolContext.getAccountId() === scope.accountId ? schoolContext.getSchool() : null;
    if (school) {
        placement = { grade: school.grade || '', section: school.section || '' };
        try { if (scope.key) localStorage.setItem(`${scope.key}:placement`, JSON.stringify(placement)); } catch { /* Optional cache. */ }
    } else if (scope.key && globalThis.navigator?.onLine === false) {
        try { placement = JSON.parse(localStorage.getItem(`${scope.key}:placement`) || 'null') || placement; } catch { /* Ignore invalid cache. */ }
    }
    manager.studentProfile = { ...manager.studentProfile, grade: String(placement.grade || ''), group: String(placement.section || ''), sectionLetter: String(placement.section || '') };
}

export function bindStudentSchoolSession(manager) {
    manager.studentSchoolUnsubscribe?.();
    const refresh = () => {
        applyStudentSchoolPlacement(manager);
        const calendar = manager.activities?.calendar;
        if (calendar) calendar.schoolCalendar = null;
        manager.studentSchoolReady = Promise.resolve(calendar?.loadSchoolCalendar()).catch(error => { console.warn('School calendar unavailable:', error); });
    };
    manager.studentSchoolUnsubscribe = schoolContext.subscribe(refresh);
    refresh();
}

export async function waitStudentSchoolReady(manager, { signal } = {}) {
    if (!signal) return manager.studentSchoolReady;
    if (signal.aborted) throw new DOMException('School loading cancelled', 'AbortError');
    let cancel;
    const cancelled = new Promise((_, reject) => { cancel = () => reject(new DOMException('School loading cancelled', 'AbortError')); signal.addEventListener('abort', cancel, { once: true }); });
    try { return await Promise.race([manager.studentSchoolReady, cancelled]); }
    finally { signal.removeEventListener('abort', cancel); }
}

export async function selectStudentAssignmentSchool(manager, detail, { isCurrent = () => true, signal } = {}) {
    const schoolId = detail.school_id || detail.schoolId;
    if (!schoolId) throw new Error('This assignment has no school.');
    const accountId = manager.currentUser?.uid || manager.currentUser?.id;
    const current = () => !signal?.aborted && isCurrent() && accountId === (manager.currentUser?.uid || manager.currentUser?.id);
    if (!current() || !accountId) throw new DOMException('Account or assignment changed', 'AbortError');
    // Auth/classes load membership before opening work. A delayed assignment must
    // never start a second global membership load behind a newer navigation.
    if (schoolContext.getAccountId() !== accountId || !schoolContext.getAccess().schools.some(school => school.id === schoolId)) {
        throw new Error('Refresh your school access before opening this assignment.');
    }
    schoolContext.select(schoolId);
    applyStudentSchoolPlacement(manager);
    if (!manager.studentSchoolReady) manager.studentSchoolReady = manager.activities?.calendar?.loadSchoolCalendar();
    await waitStudentSchoolReady(manager, { signal });
    if (!current() || schoolContext.getSchoolId() !== schoolId) throw new DOMException('School or assignment changed', 'AbortError');
}
