import { schoolContext } from './services/schoolContext.js';
import { serverStateQuery } from './services/serverStateQuery.js';

export function clearTeacherSchoolState(manager) {
    manager.disposeLoadedTeacherFeatures?.({ preserveAdministration: true });
    manager.clearStudentProgressSessionState?.();
    manager.clearTeacherSettingsSessionState?.();
    manager.clearTeacherVocabularySessionState?.();
    manager.overviewAnalytics = null;
    void serverStateQuery.clearAccount(manager.currentUser?.uid || manager.currentUser?.id || 'signed-out');
}

export function bindTeacherSchoolSession(manager) {
    manager.schoolContextUnsubscribe?.();
    let scope = `${schoolContext.getSchoolId()}:${schoolContext.getGeneration()}`;
    manager.schoolContextUnsubscribe = schoolContext.subscribe(() => {
        const next = `${schoolContext.getSchoolId()}:${schoolContext.getGeneration()}`;
        if (scope === next) return;
        scope = next;
        clearTeacherSchoolState(manager);
        updateSchoolNavigation(manager);
        if (manager.isAuthenticated) {
            const platform = manager.parseRoute()?.view === 'platform' && schoolContext.getAccess().platformAdmin;
            manager.setRoute({ view: platform ? 'platform' : 'administration' }, { replace: true });
            if (platform) void manager.showPlatformAdministration();
            else void manager.showSchoolAdministration();
            const generation = schoolContext.getGeneration();
            const isCurrent = () => generation === schoolContext.getGeneration();
            if (schoolContext.hasRole('teacher') || schoolContext.hasRole('school_admin')) {
                void Promise.allSettled([manager.loadSubjectSettings({ isCurrent }), manager.loadSchoolCalendarSettings({ isCurrent })]);
            }
        }
    });
    updateSchoolNavigation(manager);
}

export function updateSchoolNavigation(manager) {
    const staff = schoolContext.hasRole('teacher') || schoolContext.hasRole('school_admin');
    document.querySelectorAll('#teacher-tabs [data-section]').forEach(button => {
        const section = button.dataset.section;
        button.hidden = section === 'platform' ? !schoolContext.getAccess().platformAdmin
            : section !== 'administration' && (!staff || (section === 'settings' && !schoolContext.hasRole('school_admin')));
    });
    document.querySelectorAll('[data-publish-material]').forEach(button => { button.hidden = !schoolContext.hasRole('teacher'); button.classList.toggle('hidden', button.hidden); });
    const label = document.getElementById('teacher-school-name');
    if (label) label.textContent = schoolContext.getSchool()?.name || 'Choose a school';
}
