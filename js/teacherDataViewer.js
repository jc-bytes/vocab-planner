import { $, notifications } from './main.js';

const teacherDataViewerMethods = {

    initDataViewer() {
        // Check if already initialized to prevent duplicate listeners
        if (this.dataViewerInitialized) return;
        this.dataViewerInitialized = true;

        // Tab switching
        const tabButtons = document.querySelectorAll('.data-tab-btn');
        tabButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                const tab = btn.dataset.tab;
                this.switchDataTab(tab);
            });
            btn.addEventListener('keydown', (event) => {
                if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
                const tabs = Array.from(document.querySelectorAll('.data-tab-btn'));
                const currentIndex = tabs.indexOf(btn);
                let nextIndex = currentIndex;
                if (event.key === 'ArrowRight') nextIndex = (currentIndex + 1) % tabs.length;
                if (event.key === 'ArrowLeft') nextIndex = (currentIndex - 1 + tabs.length) % tabs.length;
                if (event.key === 'Home') nextIndex = 0;
                if (event.key === 'End') nextIndex = tabs.length - 1;
                event.preventDefault();
                tabs[nextIndex].focus();
                this.switchDataTab(tabs[nextIndex].dataset.tab);
            });
        });
        
        // Dashboard grade filter
        const dashboardGradeFilter = $('#dashboard-grade-filter');
        if (dashboardGradeFilter) {
            dashboardGradeFilter.addEventListener('change', () => {
                this.loadDashboardData();
            });
        }

        // File input
        const fileInput = $('#load-json-file');
        const chooseFileBtn = $('#choose-file-btn');
        const clearFileBtn = $('#clear-file-btn');
        
        if (chooseFileBtn && fileInput) {
            chooseFileBtn.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                if (fileInput) {
                    fileInput.click();
                }
            });
        }

        if (fileInput) {
            fileInput.addEventListener('change', (e) => {
                const file = e.target.files[0];
                if (file) {
                    this.loadJSONFile(file);
                    // Reset input so same file can be selected again
                    e.target.value = '';
                }
            });
        }

        if (clearFileBtn) {
            clearFileBtn.addEventListener('click', () => {
                this.clearLoadedData();
            });
        }

        // Drag and drop
        const fileLoader = $('#file-loader');
        if (fileLoader) {
            fileLoader.addEventListener('dragover', (e) => {
                e.preventDefault();
                e.stopPropagation();
                fileLoader.style.borderColor = 'var(--primary-color, #6366f1)';
                fileLoader.style.background = 'rgba(99, 102, 241, 0.2)';
            });

            fileLoader.addEventListener('dragleave', (e) => {
                e.preventDefault();
                e.stopPropagation();
                fileLoader.style.borderColor = 'var(--border-color, rgba(255, 255, 255, 0.125))';
                fileLoader.style.background = 'rgba(15, 23, 42, 0.3)';
            });

            fileLoader.addEventListener('drop', (e) => {
                e.preventDefault();
                e.stopPropagation();
                fileLoader.style.borderColor = 'var(--border-color, rgba(255, 255, 255, 0.125))';
                fileLoader.style.background = 'rgba(15, 23, 42, 0.3)';
                
                const file = e.dataTransfer.files[0];
                if (file && (file.type === 'application/json' || file.name.endsWith('.json'))) {
                    this.loadJSONFile(file);
                } else {
                    notifications.warning('Please drop a JSON file.');
                }
            });
        }
    },

    switchDataTab(tab) {
        const sections = {
            subjects: 'data-subjects-section',
            gamification: 'data-gamification-section',
            calendar: 'data-calendar-section',
            dashboard: 'data-dashboard-section',
            export: 'data-export-section',
            view: 'data-viewer-section',
            reset: 'data-reset-section'
        };
        const activeTab = sections[tab] ? tab : 'subjects';
        const activeSectionId = sections[activeTab];

        // Update tab buttons
        document.querySelectorAll('.data-tab-btn').forEach(btn => {
            const isActive = btn.dataset.tab === activeTab;
            btn.classList.toggle('active', isActive);
            btn.setAttribute('aria-selected', isActive ? 'true' : 'false');
            btn.tabIndex = isActive ? 0 : -1;
        });

        // Update tab content
        document.querySelectorAll('.data-tab-content').forEach(content => {
            const isActive = content.id === activeSectionId;
            content.classList.toggle('active', isActive);
            content.style.display = isActive ? 'block' : 'none';
            content.setAttribute('aria-hidden', isActive ? 'false' : 'true');
        });

        if (activeTab === 'dashboard') {
            this.loadDashboardData();
        }
    },

    async loadJSONFile(file) {
        // Hide previous errors
        const errorDiv = $('#file-error');
        if (errorDiv) errorDiv.style.display = 'none';

        // Show loading
        notifications.info('Loading file...');

        try {
            const text = await file.text();
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

            notifications.success('File loaded successfully!');
        } catch (error) {
            console.error('Error loading JSON file:', error);
            this.showFileError(error.message || 'Failed to load file. Please check the file format.');
            notifications.error('Failed to load file. Please check the file format.');
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
                totalCoins += student.coinData.balance || 0;
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
        this.loadedData = null;
        const fileInput = $('#load-json-file');
        if (fileInput) fileInput.value = '';

        $('#file-info').style.display = 'none';
        $('#file-error').style.display = 'none';
        $('#viewer-summary').style.display = 'none';
        $('#viewer-tables').style.display = 'none';
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
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 1rem; padding: 1rem; background: rgba(15, 23, 42, 0.4); border-radius: 8px; border: 1px solid var(--border-color, rgba(255, 255, 255, 0.125));">
                <div>
                    <div style="font-size: 0.8rem; color: var(--text-muted, #cbd5f5);">Total Students</div>
                    <div style="font-size: 1.5rem; font-weight: 600; color: var(--text-main, #f8fafc);">${summary.totalStudents}</div>
                </div>
                ${summary.totalProgressRecords > 0 ? `
                <div>
                    <div style="font-size: 0.8rem; color: var(--text-muted, #cbd5f5);">Progress Records</div>
                    <div style="font-size: 1.5rem; font-weight: 600; color: var(--text-main, #f8fafc);">${summary.totalProgressRecords}</div>
                </div>
                ${summary.totalVocabUnits > 0 ? `
                <div>
                    <div style="font-size: 0.8rem; color: var(--text-muted, #cbd5f5);">Vocabulary Units</div>
                    <div style="font-size: 1.5rem; font-weight: 600; color: var(--text-main, #f8fafc);">${summary.totalVocabUnits}</div>
                </div>
                ` : ''}
                <div>
                    <div style="font-size: 0.8rem; color: var(--text-muted, #cbd5f5);">Total Coins</div>
                    <div style="font-size: 1.5rem; font-weight: 600; color: var(--text-main, #f8fafc);">${summary.totalCoins.toLocaleString()}</div>
                </div>
                ` : ''}
                ${summary.totalScores > 0 ? `
                <div>
                    <div style="font-size: 0.8rem; color: var(--text-muted, #cbd5f5);">Game Scores</div>
                    <div style="font-size: 1.5rem; font-weight: 600; color: var(--text-main, #f8fafc);">${summary.totalScores}</div>
                </div>
                ` : ''}
                <div>
                    <div style="font-size: 0.8rem; color: var(--text-muted, #cbd5f5);">Date Range</div>
                    <div style="font-size: 0.9rem; font-weight: 600; color: var(--text-main, #f8fafc);">${dateStr}</div>
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
                <h5 style="margin: 0 0 1rem 0; font-size: 1.1rem; font-weight: 600; color: var(--text-main, #f8fafc);">Student Progress (${this.loadedData.students.length} records)</h5>
                <table style="width: 100%; border-collapse: collapse; margin-bottom: 1.5rem;">
                    <thead>
                        <tr style="border-bottom: 2px solid var(--border-color, rgba(255, 255, 255, 0.125));">
                            <th style="padding: 0.75rem; text-align: left; color: var(--text-main, #f8fafc);">Student ID</th>
                            <th style="padding: 0.75rem; text-align: left; color: var(--text-main, #f8fafc);">Name</th>
                            <th style="padding: 0.75rem; text-align: left; color: var(--text-main, #f8fafc);">Grade</th>
                            <th style="padding: 0.75rem; text-align: right; color: var(--text-main, #f8fafc);">Coins</th>
                            <th style="padding: 0.75rem; text-align: left; color: var(--text-main, #f8fafc);">Vocab Units</th>
                            <th style="padding: 0.75rem; text-align: left; color: var(--text-main, #f8fafc);">Last Active</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${this.loadedData.students.map(item => {
                            const profile = item.studentProfile || {};
                            const name = profile.firstName && profile.lastName
                                ? `${profile.firstName} ${profile.lastName}`
                                : (profile.name || 'Unknown');
                            const coins = (item.coinData || {}).balance || 0;
                            const vocabUnits = item.units ? Object.keys(item.units).length : 0;
                            const lastActive = item.updatedAt
                                ? (item.updatedAt.toDate ? item.updatedAt.toDate() : new Date(item.updatedAt.seconds * 1000)).toLocaleDateString()
                                : '-';
                            return `
                                <tr style="border-bottom: 1px solid var(--border-color, rgba(255, 255, 255, 0.125));">
                                    <td style="padding: 0.75rem; color: var(--text-main, #f8fafc);">${item.studentId}</td>
                                    <td style="padding: 0.75rem; color: var(--text-main, #f8fafc);">${name}</td>
                                    <td style="padding: 0.75rem; color: var(--text-main, #f8fafc);">${profile.grade || '-'}</td>
                                    <td style="padding: 0.75rem; text-align: right; color: var(--text-main, #f8fafc);">${coins}</td>
                                    <td style="padding: 0.75rem; color: var(--text-main, #f8fafc);">${vocabUnits}</td>
                                    <td style="padding: 0.75rem; color: var(--text-main, #f8fafc);">${lastActive}</td>
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
                <h5 style="margin: 1.5rem 0 1rem 0; font-size: 1.1rem; font-weight: 600; color: var(--text-main, #f8fafc);">Game Scores (${this.loadedData.scores.length} records)</h5>
                <table style="width: 100%; border-collapse: collapse;">
                    <thead>
                        <tr style="border-bottom: 2px solid var(--border-color, rgba(255, 255, 255, 0.125));">
                            <th style="padding: 0.75rem; text-align: left; color: var(--text-main, #f8fafc);">Student</th>
                            <th style="padding: 0.75rem; text-align: left; color: var(--text-main, #f8fafc);">Game</th>
                            <th style="padding: 0.75rem; text-align: right; color: var(--text-main, #f8fafc);">Score</th>
                            <th style="padding: 0.75rem; text-align: left; color: var(--text-main, #f8fafc);">Date</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${this.loadedData.scores.slice(0, 50).map(item => {
                            const date = item.timestamp
                                ? (item.timestamp.toDate ? item.timestamp.toDate() : new Date(item.timestamp.seconds * 1000)).toLocaleDateString()
                                : '-';
                            return `
                                <tr style="border-bottom: 1px solid var(--border-color, rgba(255, 255, 255, 0.125));">
                                    <td style="padding: 0.75rem; color: var(--text-main, #f8fafc);">${item.name || item.userId}</td>
                                    <td style="padding: 0.75rem; color: var(--text-main, #f8fafc);">${item.gameId || '-'}</td>
                                    <td style="padding: 0.75rem; text-align: right; color: var(--text-main, #f8fafc);">${(item.score || 0).toLocaleString()}</td>
                                    <td style="padding: 0.75rem; color: var(--text-main, #f8fafc);">${date}</td>
                                </tr>
                            `;
                        }).join('')}
                        ${this.loadedData.scores.length > 50 ? `
                            <tr>
                                <td colspan="4" style="padding: 0.75rem; text-align: center; color: var(--text-muted, #cbd5f5);">
                                    ... and ${this.loadedData.scores.length - 50} more records
                                </td>
                            </tr>
                        ` : ''}
                    </tbody>
                </table>
            `;
        }

        tablesContent.innerHTML = html || '<p style="color: var(--text-muted, #cbd5f5);">No data to display.</p>';
        $('#viewer-tables').style.display = 'block';
    }
};

export function installTeacherDataViewerMethods(TeacherManager) {
    Object.assign(TeacherManager.prototype, teacherDataViewerMethods);
}
