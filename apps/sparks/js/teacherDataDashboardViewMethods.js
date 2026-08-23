import { $, notifications } from './main.js';
import { supabaseService } from './supabaseService.js';

const teacherDataDashboardViewMethods = {
    async showDataManagementView(options = {}) {
        if (!this.ensureAuthenticated(false)) return;
        const settingsTabs = ['subjects', 'gamification', 'calendar'];
        const dataTabs = ['dashboard', 'export', 'view', 'reset'];
        const requestedTab = String(options.tab || '');
        const inferredArea = dataTabs.includes(requestedTab) ? 'data' : 'settings';
        const area = options.area === 'data' || options.area === 'settings' ? options.area : inferredArea;
        const allowedTabs = area === 'data' ? dataTabs : settingsTabs;
        const activeTab = allowedTabs.includes(requestedTab) ? requestedTab : allowedTabs[0];

        this.dataManagementArea = area;
        this.activeDataTab = activeTab;
        this.switchView('teacher-data-management-view');
        this.configureDataManagementArea(area);

        if (!this.dataViewerInitialized) {
            this.initDataViewer();
        }
        this.initExportListeners();
        this.switchDataTab(activeTab, { updateRoute: false });

        if (area === 'data') return;

        const settingsLoad = Promise.allSettled([
            this.loadSubjectSettings({ surfaceErrors: true }),
            this.loadGamificationSettings({ surfaceErrors: true }),
            this.loadSchoolCalendarSettings({ surfaceErrors: true })
        ]);
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

    configureDataManagementArea(area) {
        const normalizedArea = area === 'data' ? 'data' : 'settings';
        const dataView = document.getElementById('teacher-data-management-view');
        const tabList = document.getElementById('data-settings-tab-list');
        const title = document.getElementById('data-management-title');
        const eyebrow = document.getElementById('data-management-eyebrow');

        this.dataManagementArea = normalizedArea;
        dataView?.setAttribute('aria-labelledby', normalizedArea === 'data' ? 'tab-data' : 'tab-settings');
        if (title) title.textContent = normalizedArea === 'data' ? 'Data' : 'Settings';
        if (eyebrow) eyebrow.textContent = normalizedArea === 'data' ? 'Student records' : 'Classroom setup';
        if (tabList) tabList.setAttribute('aria-label', normalizedArea === 'data' ? 'Data sections' : 'Settings sections');
        tabList?.querySelectorAll('.data-tab-btn[data-area]').forEach(button => {
            button.hidden = button.dataset.area !== normalizedArea;
        });
        this.setActiveTeacherTab(normalizedArea);
    },

    async loadExportRosterData() {
        try {
            await this.getStudentRosterData();
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
