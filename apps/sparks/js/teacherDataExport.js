import { $, createElement, notifications } from './main.js';
import {
    exportScores,
    exportStudentProgress,
    exportUserRoles,
    fetchPreviewData,
    markExportComplete
} from './teacherDataExportDataMethods.js';
import {
    downloadCSV,
    downloadJSON
} from './teacherDataExportDownloads.js';
import { renderPreview } from './teacherDataExportPreviewRenderer.js';

const teacherDataExportMethods = {
    populateExportGradeSelect() {
        const gradeSelect = $('#export-grade-select');
        if (!gradeSelect) return;

        const grades = new Set();
        this.allStudentData.forEach(student => {
            const profile = student.studentProfile || {};
            if (profile.grade) grades.add(profile.grade);
        });

        gradeSelect.innerHTML = '<option value="">Select grade...</option>';
        Array.from(grades).sort().forEach(g => {
            const opt = createElement('option');
            opt.value = g;
            opt.textContent = g;
            gradeSelect.appendChild(opt);
        });
    },

    initExportListeners() {
        if (this.exportListenersInitialized) return;
        this.exportListenersInitialized = true;
        const studentSelectionRadios = document.querySelectorAll('input[name="student-selection"]');
        studentSelectionRadios.forEach(radio => {
            radio.addEventListener('change', () => {
                const gradeSelect = $('#export-grade-select');
                if (radio.value === 'grade') {
                    if (gradeSelect) gradeSelect.disabled = false;
                } else {
                    if (gradeSelect) gradeSelect.disabled = true;
                }
            });
        });

        const previewBtn = $('#preview-data-btn');
        if (previewBtn) {
            previewBtn.addEventListener('click', () => this.previewData());
        }

        const exportJsonBtn = $('#export-json-btn');
        if (exportJsonBtn) {
            exportJsonBtn.addEventListener('click', () => this.exportData('json'));
        }

        const exportCsvBtn = $('#export-csv-btn');
        if (exportCsvBtn) {
            exportCsvBtn.addEventListener('click', () => this.exportData('csv'));
        }
    },

    getSelectedStudentIds() {
        const selection = document.querySelector('input[name="student-selection"]:checked')?.value || 'all';

        if (selection === 'all') {
            return this.allStudentData.map(s => s.id);
        } else if (selection === 'grade') {
            const grade = $('#export-grade-select')?.value;
            if (!grade) return [];
            return this.allStudentData
                .filter(s => (s.studentProfile || {}).grade === grade)
                .map(s => s.id);
        } else if (selection === 'specific') {
            return Array.from(this.selectedStudents);
        }
        return [];
    },

    getSelectedDataTypes() {
        const types = [];
        if ($('#export-progress')?.checked) types.push('studentProgress');
        if ($('#export-scores')?.checked) types.push('scores');
        if ($('#export-roles')?.checked) types.push('userRoles');
        return types;
    },

    async previewData() {
        const studentIds = this.getSelectedStudentIds();
        const dataTypes = this.getSelectedDataTypes();

        if (studentIds.length === 0) {
            notifications.warning('Please select at least one student.');
            return;
        }

        if (dataTypes.length === 0) {
            notifications.warning('Please select at least one data type to preview.');
            return;
        }

        const previewSection = $('#data-preview-section');
        const previewSummary = $('#preview-summary');
        const previewTables = $('#preview-tables');

        if (!previewSection || !previewSummary || !previewTables) return;

        previewSection.style.display = 'block';
        previewSummary.innerHTML = '<div class="loading-spinner runtime-status">Loading preview...</div>';
        previewTables.innerHTML = '';

        try {
            const preview = await this.fetchPreviewData(studentIds, dataTypes);
            this.renderPreview(preview, previewSummary, previewTables);
        } catch (error) {
            console.error('Error previewing data:', error);
            notifications.error('Failed to load preview. Please try again.');
            previewSummary.innerHTML = '<p class="runtime-status data-export-preview-error">Error loading preview.</p>';
        }
    },

    fetchPreviewData,
    renderPreview,

    async exportData(format) {
        const studentIds = this.getSelectedStudentIds();
        const dataTypes = this.getSelectedDataTypes();

        if (studentIds.length === 0) {
            notifications.warning('Please select at least one student.');
            return;
        }

        if (dataTypes.length === 0) {
            notifications.warning('Please select at least one data type to export.');
            return;
        }

        const loadingEl = $('#export-loading');
        const loadingText = $('#export-loading-text');
        const progressBar = $('#export-progress-bar');
        const jsonBtn = $('#export-json-btn');
        const csvBtn = $('#export-csv-btn');

        if (loadingEl) loadingEl.style.display = 'block';
        if (jsonBtn) jsonBtn.disabled = true;
        if (csvBtn) csvBtn.disabled = true;

        const updateProgress = (percent, text) => {
            if (progressBar) progressBar.style.width = `${percent}%`;
            if (loadingText) loadingText.textContent = text;
        };

        try {
            updateProgress(5, 'Starting export...');

            const exportData = {};
            const totalSteps = dataTypes.length;
            let currentStep = 0;

            if (dataTypes.includes('studentProgress')) {
                updateProgress(10 + (currentStep / totalSteps) * 70, `Exporting student progress (${studentIds.length} students)...`);
                exportData.studentProgress = await this.exportStudentProgress(studentIds);
                currentStep++;
            }

            if (dataTypes.includes('scores')) {
                updateProgress(10 + (currentStep / totalSteps) * 70, 'Exporting leaderboard scores...');
                exportData.scores = await this.exportScores(studentIds);
                currentStep++;
            }

            if (dataTypes.includes('userRoles')) {
                updateProgress(10 + (currentStep / totalSteps) * 70, 'Exporting user roles...');
                exportData.userRoles = await this.exportUserRoles(studentIds);
                currentStep++;
            }

            updateProgress(85, 'Preparing download...');

            if (format === 'json') {
                this.downloadJSON(exportData, `data-export-${Date.now()}.json`);
            } else if (format === 'csv') {
                this.downloadCSV(exportData, `data-export-${Date.now()}.csv`);
            }

            updateProgress(95, 'Finalizing...');

            await this.markExportComplete(dataTypes, studentIds, format);

            updateProgress(100, 'Export complete!');

            setTimeout(() => {
                if (loadingEl) loadingEl.style.display = 'none';
                if (jsonBtn) jsonBtn.disabled = false;
                if (csvBtn) csvBtn.disabled = false;
            }, 500);

            notifications.success('Data exported successfully!');
        } catch (error) {
            console.error('Error exporting data:', error);

            if (loadingEl) loadingEl.style.display = 'none';
            if (jsonBtn) jsonBtn.disabled = false;
            if (csvBtn) csvBtn.disabled = false;

            notifications.error('Failed to export data. Please try again.');
        }
    },

    exportStudentProgress,
    exportScores,
    exportUserRoles,
    downloadJSON,
    downloadCSV,
    markExportComplete,

    enableResetSection() {
        const resetSection = $('#data-reset-section');
        const resetBtn = $('#reset-data-btn');
        const resetStatus = $('#reset-export-status');

        if (resetSection && resetBtn && resetStatus) {
            resetSection.style.opacity = '1';
            resetSection.style.pointerEvents = 'auto';
            resetBtn.disabled = false;
            resetStatus.innerHTML = '<span class="runtime-status data-export-reset-enabled">Export completed. Reset is now enabled.</span>';
        }
    },
};

export function installTeacherDataExportMethods(TeacherManager) {
    Object.assign(TeacherManager.prototype, teacherDataExportMethods);
}
