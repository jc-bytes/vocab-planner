import { $, notifications } from './main.js';
import { teacherApi as supabaseService } from './services/teacherApi.js';

const teacherDataDashboardViewMethods = {
    async showDataManagementView(options = {}) {
        if (!this.ensureAuthenticated(false)) return;
        this.switchView('teacher-data-management-view');
        const settingsLoad = Promise.allSettled([
            this.loadSubjectSettings({ surfaceErrors: true }),
            this.loadGamificationSettings({ surfaceErrors: true }),
            this.loadSchoolCalendarSettings({ surfaceErrors: true })
        ]);
        // Initialize data viewer if not already done
        if (!this.dataViewerInitialized) {
            this.initDataViewer();
        }
        this.initExportListeners();
        this.switchDataTab(options.tab || 'subjects');

        const results = await settingsLoad;
        [
            { label: 'subjects', statusId: '#subjects-save-status' },
            { label: 'coin settings', statusId: '#gamification-save-status' },
            { label: 'school calendar', statusId: '#school-calendar-save-status' }
        ].forEach((section, index) => {
            const result = results[index];
            if (result.status !== 'rejected') return;
            console.error(`Unable to load ${section.label}:`, result.reason);
            const status = $(section.statusId);
            if (status) {
                status.style.color = 'var(--danger-color)';
                status.textContent = `Could not load ${section.label}. Try reopening this view.`;
            }
        });
    },

    async loadExportRosterData() {
        try {
            await this.getStudentProgressData({ showError: false });
            this.populateExportGradeSelect();
        } catch (error) {
            console.error('Unable to load the export roster:', error);
            notifications.error('The student list for exports is unavailable.');
        }
    },

    async loadDashboardData() {
        const grade = $('#dashboard-grade-filter')?.value || '';
        const generation = (this.dashboardLoadGeneration || 0) + 1;
        this.dashboardLoadGeneration = generation;
        const analyticsPromise = supabaseService.getTeacherDashboardAnalytics({ grade });
        const libraryPromise = this.getTeacherLibrary();

        try {
            const analytics = await analyticsPromise;
            if (generation !== this.dashboardLoadGeneration) return;
            this.dashboardAnalytics = analytics;
            this.populateDashboardGradeFilter();
            $('#dashboard-total-students').textContent = analytics.totalStudents;
            $('#dashboard-active-students').textContent = analytics.activeStudents;
            $('#dashboard-avg-coins').textContent = analytics.averageCoins.toLocaleString();
            await this.renderDashboardCharts();
            this.renderRecentActivity();
        } catch (error) {
            if (generation !== this.dashboardLoadGeneration) return;
            console.error('Unable to load dashboard analytics:', error);
            notifications.error('Dashboard analytics are unavailable right now.');
            ['dashboard-total-students', 'dashboard-active-students', 'dashboard-avg-coins']
                .forEach(id => { const element = $(`#${id}`); if (element) element.textContent = '--'; });
        }

        try {
            const { cloudVocabs, remoteVocabs, localVocabs } = await libraryPromise;
            if (generation !== this.dashboardLoadGeneration) return;
            $('#dashboard-vocab-count').textContent = cloudVocabs.length + remoteVocabs.length + localVocabs.length;
        } catch (err) {
            console.error('Error loading vocab count:', err);
            $('#dashboard-vocab-count').textContent = '--';
        }
    },

    populateDashboardGradeFilter() {
        const gradeFilter = $('#dashboard-grade-filter');
        if (!gradeFilter) return;

        const grades = new Set((this.dashboardAnalytics?.availableGrades || []).map(String));

        // Sort grades (handle both numeric and string grades)
        const sortedGrades = Array.from(grades).sort((a, b) => {
            const numA = parseInt(a);
            const numB = parseInt(b);
            if (!isNaN(numA) && !isNaN(numB)) return numA - numB;
            return String(a).localeCompare(String(b));
        });

        // Preserve current selection
        const currentValue = gradeFilter.value;

        // Clear and rebuild options
        gradeFilter.innerHTML = '<option value="">All Grades</option>';
        sortedGrades.forEach(grade => {
            const option = document.createElement('option');
            option.value = grade;
            option.textContent = `Grade ${grade}`;
            gradeFilter.appendChild(option);
        });

        // Restore selection if still valid
        if (currentValue && sortedGrades.includes(currentValue)) {
            gradeFilter.value = currentValue;
        }
    },
};

export function installTeacherDataDashboardViewMethods(TeacherManager) {
    Object.assign(TeacherManager.prototype, teacherDataDashboardViewMethods);
}
