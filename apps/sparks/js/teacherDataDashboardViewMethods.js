import { $ } from './main.js';

const teacherDataDashboardViewMethods = {
    async showDataManagementView(options = {}) {
        if (this.destroyed || !this.ensureAuthenticated(false)) return false;
        const settingsTabs = ['subjects', 'gamification', 'calendar'];
        const dataTabs = ['dashboard', 'export', 'view', 'reset'];
        const requestedTab = String(options.tab || '');
        const inferredArea = dataTabs.includes(requestedTab) ? 'data' : 'settings';
        const area = options.area === 'data' || options.area === 'settings' ? options.area : inferredArea;
        const allowedTabs = area === 'data' ? dataTabs : settingsTabs;
        const activeTab = allowedTabs.includes(requestedTab) ? requestedTab : allowedTabs[0];

        if (options.updateRoute === false && !this.isDataRouteCurrent(area, activeTab)) return false;

        this.dataManagementArea = area;
        this.activeDataTab = activeTab;
        if (options.updateRoute !== false && !this.isRouteApplying()) {
            this.writeDataRoute(area, activeTab, { replace: options.replaceRoute === true });
        }
        this.activateDataManagement(area);
        this.configureDataManagementArea(area);

        if (!this.dataViewerInitialized) {
            this.initDataViewer();
        }
        this.initExportListeners();
        this.switchDataTab(activeTab, { updateRoute: false });

        if (area === 'data') return true;

        const lifecycleGeneration = this.lifecycleGeneration;
        const settingsLoad = Promise.allSettled([
            this.loadSubjectSettings({ surfaceErrors: true }),
            this.loadGamificationSettings({ surfaceErrors: true }),
            this.loadSchoolCalendarSettings({ surfaceErrors: true })
        ]);
        const results = await settingsLoad;
        if (this.destroyed || lifecycleGeneration !== this.lifecycleGeneration) return false;
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
        return true;
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
    },

    async loadExportRosterData() {
        const generation = ++this.rosterLoadGeneration;
        const lifecycleGeneration = this.lifecycleGeneration;
        try {
            await this.loadRoster();
            if (this.destroyed
                || lifecycleGeneration !== this.lifecycleGeneration
                || generation !== this.rosterLoadGeneration) return false;
            this.populateExportGradeSelect();
            return true;
        } catch (error) {
            if (this.destroyed
                || lifecycleGeneration !== this.lifecycleGeneration
                || generation !== this.rosterLoadGeneration) return false;
            console.error('Unable to load the export roster:', error);
            this.feedback.error('The student list for exports is unavailable.');
            return false;
        }
    },

    async loadDashboardData() {
        const grade = $('#dashboard-grade-filter')?.value || '';
        const generation = (this.dashboardLoadGeneration || 0) + 1;
        this.dashboardLoadGeneration = generation;
        const lifecycleGeneration = this.lifecycleGeneration;
        const analyticsPromise = this.loadDashboardAnalytics({ grade });
        const libraryPromise = this.loadLibrary()
            .then(value => ({ value, error: null }))
            .catch(error => ({ value: null, error }));

        try {
            const analytics = await analyticsPromise;
            if (this.destroyed
                || lifecycleGeneration !== this.lifecycleGeneration
                || generation !== this.dashboardLoadGeneration) return false;
            this.dashboardAnalytics = analytics;
            this.populateDashboardGradeFilter();
            $('#dashboard-total-students').textContent = analytics.totalStudents;
            $('#dashboard-active-students').textContent = analytics.activeStudents;
            $('#dashboard-avg-coins').textContent = analytics.averageCoins.toLocaleString();
            await this.renderDashboardCharts();
            if (this.destroyed
                || lifecycleGeneration !== this.lifecycleGeneration
                || generation !== this.dashboardLoadGeneration) return false;
            this.renderRecentActivity();
        } catch (error) {
            if (this.destroyed
                || lifecycleGeneration !== this.lifecycleGeneration
                || generation !== this.dashboardLoadGeneration) return false;
            console.error('Unable to load dashboard analytics:', error);
            this.feedback.error('Dashboard analytics are unavailable right now.');
            ['dashboard-total-students', 'dashboard-active-students', 'dashboard-avg-coins']
                .forEach(id => { const element = $(`#${id}`); if (element) element.textContent = '--'; });
        }

        try {
            const libraryResult = await libraryPromise;
            if (this.destroyed
                || lifecycleGeneration !== this.lifecycleGeneration
                || generation !== this.dashboardLoadGeneration) return false;
            if (libraryResult.error) throw libraryResult.error;
            const { cloudVocabs, remoteVocabs, localVocabs } = libraryResult.value;
            $('#dashboard-vocab-count').textContent = cloudVocabs.length + remoteVocabs.length + localVocabs.length;
        } catch (err) {
            if (this.destroyed
                || lifecycleGeneration !== this.lifecycleGeneration
                || generation !== this.dashboardLoadGeneration) return false;
            console.error('Error loading vocab count:', err);
            const count = $('#dashboard-vocab-count');
            if (count) count.textContent = '--';
        }
        return true;
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
