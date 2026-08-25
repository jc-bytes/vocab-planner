import { installTeacherDataDashboardMethods } from './teacherDataDashboard.js';
import { installTeacherDataExportMethods } from './teacherDataExport.js';
import { installTeacherDataViewerMethods } from './teacherDataViewer.js';
import { initTeacherSettingsListeners } from './teacherSettingsListeners.js';
import { resetTeacherSettingsView } from './teacherSettingsSession.js';

class TeacherDataManagementContext {}
installTeacherDataExportMethods(TeacherDataManagementContext);
installTeacherDataViewerMethods(TeacherDataManagementContext);
installTeacherDataDashboardMethods(TeacherDataManagementContext);

const REQUIRED_CAPABILITIES = [
    'ensureAuthenticated', 'activateDataManagement', 'writeDataRoute', 'isRouteApplying',
    'isDataRouteCurrent',
    'loadSubjectSettings', 'loadGamificationSettings', 'loadSchoolCalendarSettings',
    'saveGamificationSettings', 'saveSchoolCalendarSettings', 'bindSchoolCalendarInputs',
    'addSubjectFromForm', 'saveSubjectSettings', 'loadRoster', 'getRoster',
    'getExplicitSelectedStudentIds', 'loadLibrary', 'loadDashboardAnalytics', 'getCurrentUser',
    'refreshIcons'
];

function clearElement(selector) {
    document.querySelector(selector)?.replaceChildren();
}

function resetSelect(selector, optionHtml, { disabled = false } = {}) {
    const select = document.querySelector(selector);
    if (!select) return;
    select.innerHTML = optionHtml;
    select.value = '';
    select.disabled = disabled;
}

function destroyDataManagement(context) {
    if (context.destroyed) return;
    context.destroyed = true;
    context.lifecycleGeneration += 1;
    context.dashboardLoadGeneration += 1;
    context.previewGeneration += 1;
    context.exportGeneration += 1;
    context.fileLoadGeneration += 1;
    context.rosterLoadGeneration += 1;
    context.listenerDisposers.splice(0).forEach(dispose => dispose());
    if (context.exportCompletionTimer) clearTimeout(context.exportCompletionTimer);
    context.exportCompletionTimer = null;
    ['activityChart', 'gradeChart', 'coinChart', 'usageChart'].forEach(name => {
        context[name]?.destroy?.();
        context[name] = null;
    });
    context.dashboardAnalytics = null;
    context.loadedData = null;
    context.dataManagementArea = 'settings';
    context.activeDataTab = 'subjects';
    context.dataViewerInitialized = false;
    context.exportListenersInitialized = false;
    resetTeacherSettingsView(root => context.refreshIcons(root));
    [
        '#preview-summary', '#preview-tables', '#viewer-summary-stats',
        '#viewer-tables-content', '#recent-activity-table', '#subjects-manager-list'
    ].forEach(clearElement);
    ['#data-preview-section', '#file-info', '#file-error', '#viewer-summary', '#viewer-tables', '#export-status', '#export-loading']
        .forEach(selector => {
            const element = document.querySelector(selector);
            if (element) element.style.display = 'none';
        });
    ['dashboard-total-students', 'dashboard-active-students', 'dashboard-avg-coins', 'dashboard-vocab-count']
        .forEach(id => {
            const element = document.getElementById(id);
            if (element) element.textContent = '--';
        });
    resetSelect('#dashboard-grade-filter', '<option value="">All Grades</option>');
    resetSelect('#export-grade-select', '<option value="">Select grade...</option>', { disabled: true });
    document.querySelectorAll('input[name="student-selection"]').forEach(radio => {
        radio.checked = radio.value === 'all';
    });
    const exportLoadingText = document.getElementById('export-loading-text');
    if (exportLoadingText) exportLoadingText.textContent = 'Preparing your data for download';
    const exportProgressBar = document.getElementById('export-progress-bar');
    if (exportProgressBar) exportProgressBar.style.width = '0%';
    const exportStatusText = document.getElementById('export-status-text');
    if (exportStatusText) exportStatusText.textContent = 'Ready to proceed with reset';
    const resetSection = document.getElementById('data-reset-section');
    const resetButton = document.getElementById('reset-data-btn');
    if (resetSection) {
        resetSection.style.opacity = '0.5';
        resetSection.style.pointerEvents = 'none';
    }
    if (resetButton) resetButton.disabled = true;
    const resetStatus = document.getElementById('reset-export-status');
    if (resetStatus) {
        resetStatus.innerHTML = `
            <div class="data-reset-export-status__row">
                <i data-lucide="triangle-alert"></i>
                <span class="runtime-status__description data-reset-export-status__text">Export required before reset</span>
            </div>
        `;
        context.refreshIcons(resetStatus);
    }
    const fileInput = document.getElementById('load-json-file');
    if (fileInput) fileInput.value = '';
    ['export-json-btn', 'export-csv-btn'].forEach(id => {
        const button = document.getElementById(id);
        if (button) button.disabled = false;
    });
    ['subjects-save-status', 'gamification-save-status', 'school-calendar-save-status']
        .forEach(id => {
            const status = document.getElementById(id);
            if (status) status.textContent = '';
        });
}

export function createTeacherDataManagementFeature(dependencies = {}) {
    const missingCapability = REQUIRED_CAPABILITIES.find(name => typeof dependencies[name] !== 'function');
    if (missingCapability) {
        throw new TypeError(`Teacher Data Management requires ${missingCapability}().`);
    }
    if (!dependencies.feedback || !dependencies.storage) {
        throw new TypeError('Teacher Data Management requires feedback and storage capabilities.');
    }
    const context = new TeacherDataManagementContext();
    Object.assign(context, dependencies, {
        destroyed: false,
        lifecycleGeneration: 0,
        dashboardLoadGeneration: 0,
        previewGeneration: 0,
        exportGeneration: 0,
        fileLoadGeneration: 0,
        rosterLoadGeneration: 0,
        listenerDisposers: [],
        exportCompletionTimer: null,
        dataManagementArea: 'settings',
        activeDataTab: 'subjects',
        dataViewerInitialized: false,
        exportListenersInitialized: false,
        dashboardAnalytics: null,
        loadedData: null,
        activityChart: null,
        gradeChart: null,
        coinChart: null,
        usageChart: null
    });
    context.addOwnedListener = (target, type, handler, options) => {
        if (!target || context.destroyed) return;
        target.addEventListener(type, handler, options);
        context.listenerDisposers.push(() => target.removeEventListener(type, handler, options));
    };
    initTeacherSettingsListeners(context);

    return Object.freeze({
        show(options = {}) {
            return context.showDataManagementView(options);
        },
        destroy() {
            destroyDataManagement(context);
        }
    });
}
