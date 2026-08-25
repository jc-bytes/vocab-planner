import { $, escapeHtml } from './main.js';

function finiteNumber(value) {
    const number = Number(value);
    return Number.isFinite(number) ? number : 0;
}

const teacherDataViewerMethods = {

    initDataViewer() {
        if (this.dataViewerInitialized) return;
        const tabList = document.getElementById('data-settings-tab-list');
        if (!tabList) return;
        this.dataViewerInitialized = true;

        const tabButtons = Array.from(tabList.querySelectorAll('.data-tab-btn[data-tab]'));
        tabButtons.forEach(btn => {
            this.addOwnedListener(btn, 'click', () => this.switchDataTab(btn.dataset.tab));
            this.addOwnedListener(btn, 'keydown', event => {
                if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
                const visibleTabButtons = tabButtons.filter(button => !button.hidden);
                if (!visibleTabButtons.length) return;
                const currentIndex = visibleTabButtons.indexOf(btn);
                let nextIndex = currentIndex;
                if (event.key === 'ArrowRight') nextIndex = (currentIndex + 1) % visibleTabButtons.length;
                if (event.key === 'ArrowLeft') nextIndex = (currentIndex - 1 + visibleTabButtons.length) % visibleTabButtons.length;
                if (event.key === 'Home') nextIndex = 0;
                if (event.key === 'End') nextIndex = visibleTabButtons.length - 1;
                event.preventDefault();
                visibleTabButtons[nextIndex].focus();
                this.switchDataTab(visibleTabButtons[nextIndex].dataset.tab);
            });
        });

        const dashboardGradeFilter = $('#dashboard-grade-filter');
        this.addOwnedListener(dashboardGradeFilter, 'change', () => this.loadDashboardData());

        const fileInput = $('#load-json-file');
        const chooseFileBtn = $('#choose-file-btn');
        const clearFileBtn = $('#clear-file-btn');

        if (fileInput) {
            this.addOwnedListener(chooseFileBtn, 'click', event => {
                event.preventDefault();
                event.stopPropagation();
                fileInput.click();
            });
            this.addOwnedListener(fileInput, 'change', event => {
                const file = event.target.files[0];
                if (file) this.loadJSONFile(file);
                event.target.value = '';
            });
        }
        this.addOwnedListener(clearFileBtn, 'click', () => this.clearLoadedData());

        const fileLoader = $('#file-loader');
        this.addOwnedListener(fileLoader, 'dragover', event => {
            event.preventDefault();
            event.stopPropagation();
            fileLoader.style.borderColor = 'var(--color-brand)';
            fileLoader.style.background = 'rgba(99, 102, 241, 0.2)';
        });
        this.addOwnedListener(fileLoader, 'dragleave', event => {
            event.preventDefault();
            event.stopPropagation();
            fileLoader.style.borderColor = 'var(--border-color, rgba(255, 255, 255, 0.125))';
            fileLoader.style.background = 'rgba(15, 23, 42, 0.3)';
        });
        this.addOwnedListener(fileLoader, 'drop', event => {
            event.preventDefault();
            event.stopPropagation();
            fileLoader.style.borderColor = 'var(--border-color, rgba(255, 255, 255, 0.125))';
            fileLoader.style.background = 'rgba(15, 23, 42, 0.3)';
            const file = event.dataTransfer.files[0];
            if (file && (file.type === 'application/json' || file.name.endsWith('.json'))) {
                this.loadJSONFile(file);
            } else {
                this.feedback.warning('Please drop a JSON file.');
            }
        });
    },

    switchDataTab(tab, options = {}) {
        const sections = {
            subjects: 'data-subjects-section',
            gamification: 'data-gamification-section',
            calendar: 'data-calendar-section',
            dashboard: 'data-dashboard-section',
            export: 'data-export-section',
            view: 'data-viewer-section',
            reset: 'data-reset-section'
        };
        const allowedTabs = this.dataManagementArea === 'data'
            ? ['dashboard', 'export', 'view', 'reset']
            : ['subjects', 'gamification', 'calendar'];
        const activeTab = allowedTabs.includes(tab) ? tab : allowedTabs[0];
        const activeSectionId = sections[activeTab];
        const dataView = document.getElementById('teacher-data-management-view');
        const tabList = dataView?.querySelector('#data-settings-tab-list');

        // Update tab buttons
        tabList?.querySelectorAll('.data-tab-btn[data-tab]').forEach(btn => {
            const isActive = btn.dataset.tab === activeTab;
            btn.classList.toggle('active', isActive);
            btn.classList.toggle('secondary-tab--active', isActive);
            btn.setAttribute('aria-selected', isActive ? 'true' : 'false');
            btn.tabIndex = isActive ? 0 : -1;
        });

        // Update tab content
        dataView?.querySelectorAll('.data-tab-content').forEach(content => {
            const isActive = content.id === activeSectionId;
            content.classList.toggle('active', isActive);
            content.style.display = isActive ? 'block' : 'none';
            content.setAttribute('aria-hidden', isActive ? 'false' : 'true');
        });

        this.activeDataTab = activeTab;
        if (options.updateRoute !== false && !this.isRouteApplying()) {
            this.writeDataRoute(this.dataManagementArea, activeTab);
        }

        if (activeTab === 'dashboard') {
            this.loadDashboardData();
        } else if (activeTab === 'export') {
            this.loadExportRosterData();
        }
    },

    async loadJSONFile(file) {
        const generation = ++this.fileLoadGeneration;
        const lifecycleGeneration = this.lifecycleGeneration;
        // Hide previous errors
        const errorDiv = $('#file-error');
        if (errorDiv) errorDiv.style.display = 'none';

        // Show loading
        this.feedback.info('Loading file...');

        try {
            const text = await file.text();
            if (this.destroyed
                || lifecycleGeneration !== this.lifecycleGeneration
                || generation !== this.fileLoadGeneration) return false;
            const data = JSON.parse(text);

            // Validate structure
            this.validateJSONStructure(data);

            // Store loaded data
            this.loadedData = this.processLoadedData(data);

            // Show file info
            this.showFileInfo(file);

            // Render summary and tables
            this.renderViewerSummary();
            this.renderViewerTables();

            this.feedback.success('File loaded successfully!');
            return true;
        } catch (error) {
            if (this.destroyed
                || lifecycleGeneration !== this.lifecycleGeneration
                || generation !== this.fileLoadGeneration) return false;
            console.error('Error loading JSON file:', error);
            this.showFileError(error.message || 'Failed to load file. Please check the file format.');
            this.feedback.error('Failed to load file. Please check the file format.');
            return false;
        }
    },

    validateJSONStructure(data) {
        if (!data) {
            throw new Error('File is empty or invalid JSON');
        }

        if (!data.studentProgress && !data.scores && !data.userRoles) {
            throw new Error('Invalid export format: file must contain studentProgress, scores, or userRoles');
        }

        if (data.studentProgress && !Array.isArray(data.studentProgress)) {
            throw new Error('Invalid format: studentProgress must be an array');
        }

        if (data.scores && !Array.isArray(data.scores)) {
            throw new Error('Invalid format: scores must be an array');
        }
    },

    processLoadedData(data) {
        return {
            students: data.studentProgress || [],
            scores: data.scores || [],
            roles: data.userRoles || [],
            metadata: data.metadata || {},
            summary: this.calculateViewerSummary(data)
        };
    },

    calculateViewerSummary(data) {
        const students = data.studentProgress || [];
        let totalVocabUnits = 0;
        let totalCoins = 0;
        let dateRange = { start: null, end: null };

        students.forEach(student => {
            if (student.units) {
                totalVocabUnits += Object.keys(student.units).length;
            }
            if (student.coinData) {
                totalCoins += finiteNumber(student.coinData.balance);
            }
            if (student.updatedAt) {
                const date = student.updatedAt.toDate ? student.updatedAt.toDate() : new Date(student.updatedAt.seconds * 1000);
                if (!dateRange.start || date < dateRange.start) {
                    dateRange.start = date;
                }
                if (!dateRange.end || date > dateRange.end) {
                    dateRange.end = date;
                }
            }
        });

        return {
            totalStudents: students.length,
            totalProgressRecords: students.length,
            totalVocabUnits,
            totalCoins,
            totalScores: (data.scores || []).length,
            dateRange
        };
    },

    showFileInfo(file) {
        const fileInfo = $('#file-info');
        const fileName = $('#file-name');
        const fileSize = $('#file-size');

        if (fileInfo && fileName && fileSize) {
            fileName.textContent = file.name;
            fileSize.textContent = `Size: ${(file.size / 1024).toFixed(2)} KB`;
            fileInfo.style.display = 'block';
        }
    },

    showFileError(message) {
        const errorDiv = $('#file-error');
        const errorMessage = $('#error-message');

        if (errorDiv && errorMessage) {
            errorMessage.textContent = message;
            errorDiv.style.display = 'block';
        }
    },

    clearLoadedData() {
        this.fileLoadGeneration += 1;
        this.loadedData = null;
        const fileInput = $('#load-json-file');
        if (fileInput) fileInput.value = '';

        ['#file-info', '#file-error', '#viewer-summary', '#viewer-tables'].forEach(selector => {
            const element = $(selector);
            if (element) element.style.display = 'none';
        });
        $('#viewer-summary-stats')?.replaceChildren();
        $('#viewer-tables-content')?.replaceChildren();
    },

    renderViewerSummary() {
        if (!this.loadedData) return;

        const summary = this.loadedData.summary;
        const dateRange = summary.dateRange;
        const dateStr = dateRange.start && dateRange.end
            ? `${dateRange.start.toLocaleDateString()} to ${dateRange.end.toLocaleDateString()}`
            : 'N/A';

        const summaryEl = $('#viewer-summary-stats');
        if (!summaryEl) return;

        summaryEl.innerHTML = `
            <div class="runtime-summary data-viewer-runtime-summary">
                <div>
                    <div class="runtime-summary__label">Total Students</div>
                    <div class="runtime-summary__value">${summary.totalStudents}</div>
                </div>
                ${summary.totalProgressRecords > 0 ? `
                <div>
                    <div class="runtime-summary__label">Progress Records</div>
                    <div class="runtime-summary__value">${summary.totalProgressRecords}</div>
                </div>
                ${summary.totalVocabUnits > 0 ? `
                <div>
                    <div class="runtime-summary__label">Vocabulary Units</div>
                    <div class="runtime-summary__value">${summary.totalVocabUnits}</div>
                </div>
                ` : ''}
                <div>
                    <div class="runtime-summary__label">Total Coins</div>
                    <div class="runtime-summary__value">${summary.totalCoins.toLocaleString()}</div>
                </div>
                ` : ''}
                ${summary.totalScores > 0 ? `
                <div>
                    <div class="runtime-summary__label">Game Scores</div>
                    <div class="runtime-summary__value">${summary.totalScores}</div>
                </div>
                ` : ''}
                <div>
                    <div class="runtime-summary__label">Date Range</div>
                    <div class="runtime-summary__value runtime-summary__value--compact">${dateStr}</div>
                </div>
            </div>
        `;

        $('#viewer-summary').style.display = 'block';
    },

    renderViewerTables() {
        if (!this.loadedData || !this.loadedData.students.length) return;

        const tablesContent = $('#viewer-tables-content');
        if (!tablesContent) return;

        let html = '';

        // Student Progress Table
        if (this.loadedData.students.length > 0) {
            html += `
                <h5 class="data-table__caption data-viewer-table-caption data-viewer-table-caption--first">Student Progress (${this.loadedData.students.length} records)</h5>
                <table class="data-table data-viewer-table data-viewer-table--spaced">
                    <thead>
                        <tr class="data-viewer-table__header-row">
                            <th class="data-table__header-cell">Student ID</th>
                            <th class="data-table__header-cell">Name</th>
                            <th class="data-table__header-cell">Grade</th>
                            <th class="data-table__header-cell data-viewer-table__numeric">Coins</th>
                            <th class="data-table__header-cell">Vocab Units</th>
                            <th class="data-table__header-cell">Last Active</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${this.loadedData.students.map(item => {
                            const profile = item.studentProfile || {};
                            const name = profile.firstName && profile.lastName
                                ? `${profile.firstName} ${profile.lastName}`
                                : (profile.name || 'Unknown');
                            const coins = finiteNumber((item.coinData || {}).balance);
                            const vocabUnits = item.units ? Object.keys(item.units).length : 0;
                            const lastActive = item.updatedAt
                                ? (item.updatedAt.toDate ? item.updatedAt.toDate() : new Date(item.updatedAt.seconds * 1000)).toLocaleDateString()
                                : '-';
                            return `
                                <tr class="data-viewer-table__row">
                                    <td class="data-table__cell">${escapeHtml(item.studentId)}</td>
                                    <td class="data-table__cell">${escapeHtml(name)}</td>
                                    <td class="data-table__cell">${escapeHtml(profile.grade || '-')}</td>
                                    <td class="data-table__cell data-table__metric data-viewer-table__numeric">${coins}</td>
                                    <td class="data-table__cell data-table__metric">${vocabUnits}</td>
                                    <td class="data-table__cell data-table__secondary">${lastActive}</td>
                                </tr>
                            `;
                        }).join('')}
                    </tbody>
                </table>
            `;
        }

        // Game Scores Table
        if (this.loadedData.scores.length > 0) {
            html += `
                <h5 class="data-table__caption data-viewer-table-caption">Game Scores (${this.loadedData.scores.length} records)</h5>
                <table class="data-table data-viewer-table">
                    <thead>
                        <tr class="data-viewer-table__header-row">
                            <th class="data-table__header-cell">Student</th>
                            <th class="data-table__header-cell">Game</th>
                            <th class="data-table__header-cell data-viewer-table__numeric">Score</th>
                            <th class="data-table__header-cell">Date</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${this.loadedData.scores.slice(0, 50).map(item => {
                            const date = item.timestamp
                                ? (item.timestamp.toDate ? item.timestamp.toDate() : new Date(item.timestamp.seconds * 1000)).toLocaleDateString()
                                : '-';
                            return `
                                <tr class="data-viewer-table__row">
                                    <td class="data-table__cell">${escapeHtml(item.name || item.userId)}</td>
                                    <td class="data-table__cell">${escapeHtml(item.gameId || '-')}</td>
                                    <td class="data-table__cell data-table__metric data-viewer-table__numeric">${finiteNumber(item.score).toLocaleString()}</td>
                                    <td class="data-table__cell data-table__secondary">${date}</td>
                                </tr>
                            `;
                        }).join('')}
                        ${this.loadedData.scores.length > 50 ? `
                            <tr>
                                <td class="data-table__cell data-table__status data-viewer-table__status" colspan="4">
                                    ... and ${this.loadedData.scores.length - 50} more records
                                </td>
                            </tr>
                        ` : ''}
                    </tbody>
                </table>
            `;
        }

        tablesContent.innerHTML = html || '<p class="data-table__empty data-viewer-table__empty">No data to display.</p>';
        $('#viewer-tables').style.display = 'block';
    }
};

export function installTeacherDataViewerMethods(TeacherManager) {
    Object.assign(TeacherManager.prototype, teacherDataViewerMethods);
}
