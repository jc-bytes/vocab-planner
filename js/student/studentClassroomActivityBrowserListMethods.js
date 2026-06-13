import { $, notifications } from '../main.js';

export const studentClassroomActivityBrowserListMethods = {
    async renderList(route = {}) {
        this.sm.cleanupActivity();
        this.sm.currentVocab = null;
        this.sm.switchView('student-classroom-activities-view');
        const list = $('#student-classroom-activities-list');
        if (!list) return;

        this.sm.activities?.renderSubjectPicker?.('#classroom-subject-picker');
        this.renderClassroomViewControls();
        this.sm.logStudentDomUpdate?.('student-classroom-activities-list', { source: 'renderList:loading' });
        list.innerHTML = '<div class="loading-spinner">Loading activities...</div>';
        try {
            const [assignments] = await Promise.all([
                this.loadAssignments(),
                this.loadSubmissions()
            ]);
            this.sm.logStudentDomUpdate?.('student-classroom-activities-list', { source: 'renderList:clear' });
            list.innerHTML = '';

            if (assignments.length === 0) {
                list.innerHTML = '<p class="student-empty-state">No classroom activities assigned yet.</p>';
                return;
            }

            this.renderClassroomActivityBrowser(list, assignments, route);
            this.sm.updateHeader();
            if (window.lucide) window.lucide.createIcons();
        } catch (error) {
            console.error('Failed to load classroom activities:', error);
            list.innerHTML = '<p class="student-empty-state">Could not load classroom activities.</p>';
            notifications.error('Could not load classroom activities.');
        }
    }
};
