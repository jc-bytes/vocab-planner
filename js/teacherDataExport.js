import { $, createElement, notifications } from './main.js';
import {
    teacherApi as supabaseService,
    addDoc,
    collection,
    doc,
    getDoc,
    getDocs,
    query,
    serverTimestamp,
    where
} from './services/teacherApi.js';

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
        // Student selection radio buttons
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

        // Preview button
        const previewBtn = $('#preview-data-btn');
        if (previewBtn) {
            previewBtn.addEventListener('click', () => this.previewData());
        }

        // Export buttons
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
        previewSummary.innerHTML = '<div class="loading-spinner">Loading preview...</div>';
        previewTables.innerHTML = '';

        try {
            const preview = await this.fetchPreviewData(studentIds, dataTypes);
            this.renderPreview(preview, previewSummary, previewTables);
        } catch (error) {
            console.error('Error previewing data:', error);
            notifications.error('Failed to load preview. Please try again.');
            previewSummary.innerHTML = '<p style="color: var(--danger-color);">Error loading preview.</p>';
        }
    },

    async fetchPreviewData(studentIds, dataTypes) {
        const db = supabaseService.getDatabase();
        const preview = {
            studentProgress: [],
            scores: [],
            userRoles: [],
            summary: {
                totalStudents: studentIds.length,
                totalProgressRecords: 0,
                totalScores: 0,
                totalRoles: 0,
                dateRange: { start: null, end: null },
                totalCoins: 0,
                gamesPlayed: new Set()
            }
        };

        if (dataTypes.includes('studentProgress')) {
            for (const studentId of studentIds) {
                try {
                    const docRef = doc(db, 'studentProgress', studentId);
                    const docSnap = await getDoc(docRef);
                    if (docSnap.exists()) {
                        const data = { studentId, ...docSnap.data() };
                        preview.studentProgress.push(data);
                        preview.summary.totalProgressRecords++;
                        
                        // Calculate statistics
                        const coinData = data.coinData || {};
                        preview.summary.totalCoins += (coinData.balance || 0);
                        
                        if (data.updatedAt) {
                            const date = data.updatedAt.toDate ? data.updatedAt.toDate() : new Date(data.updatedAt.seconds * 1000);
                            if (!preview.summary.dateRange.start || date < preview.summary.dateRange.start) {
                                preview.summary.dateRange.start = date;
                            }
                            if (!preview.summary.dateRange.end || date > preview.summary.dateRange.end) {
                                preview.summary.dateRange.end = date;
                            }
                        }
                    }
                } catch (error) {
                    console.error(`Error fetching progress for ${studentId}:`, error);
                }
            }
        }

        if (dataTypes.includes('scores')) {
            const scoresRef = collection(db, 'scores');
            for (const studentId of studentIds) {
                try {
                    const q = query(scoresRef, where('userId', '==', studentId));
                    const snapshot = await getDocs(q);
                    snapshot.forEach(doc => {
                        preview.scores.push({ scoreId: doc.id, ...doc.data() });
                        preview.summary.totalScores++;
                        if (doc.data().gameId) {
                            preview.summary.gamesPlayed.add(doc.data().gameId);
                        }
                    });
                } catch (error) {
                    console.error(`Error fetching scores for ${studentId}:`, error);
                }
            }
        }

        if (dataTypes.includes('userRoles')) {
            for (const studentId of studentIds) {
                try {
                    const docRef = doc(db, 'userRoles', studentId);
                    const docSnap = await getDoc(docRef);
                    if (docSnap.exists()) {
                        preview.userRoles.push({ userId: studentId, ...docSnap.data() });
                        preview.summary.totalRoles++;
                    }
                } catch (error) {
                    console.error(`Error fetching role for ${studentId}:`, error);
                }
            }
        }

        return preview;
    },

    renderPreview(preview, summaryEl, tablesEl) {
        // Render summary
        const dateRange = preview.summary.dateRange;
        const dateStr = dateRange.start && dateRange.end
            ? `${dateRange.start.toLocaleDateString()} to ${dateRange.end.toLocaleDateString()}`
            : 'N/A';

        // Count vocabulary units
        let totalVocabUnits = 0;
        if (preview.studentProgress.length > 0) {
            preview.studentProgress.forEach(item => {
                if (item.units) {
                    totalVocabUnits += Object.keys(item.units).length;
                }
            });
        }

        summaryEl.innerHTML = `
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 1rem; padding: 1rem; background: rgba(15, 23, 42, 0.4); border-radius: 8px; border: 1px solid var(--border-color, rgba(255, 255, 255, 0.125));">
                <div>
                    <div style="font-size: 0.8rem; color: var(--text-muted, #cbd5f5);">Total Students</div>
                    <div style="font-size: 1.5rem; font-weight: 600; color: var(--text-main, #f8fafc);">${preview.summary.totalStudents}</div>
                </div>
                ${preview.summary.totalProgressRecords > 0 ? `
                <div>
                    <div style="font-size: 0.8rem; color: var(--text-muted, #cbd5f5);">Progress Records</div>
                    <div style="font-size: 1.5rem; font-weight: 600; color: var(--text-main, #f8fafc);">${preview.summary.totalProgressRecords}</div>
                </div>
                ${totalVocabUnits > 0 ? `
                <div>
                    <div style="font-size: 0.8rem; color: var(--text-muted, #cbd5f5);">Vocabulary Units</div>
                    <div style="font-size: 1.5rem; font-weight: 600; color: var(--text-main, #f8fafc);">${totalVocabUnits}</div>
                </div>
                ` : ''}
                <div>
                    <div style="font-size: 0.8rem; color: var(--text-muted, #cbd5f5);">Total Coins</div>
                    <div style="font-size: 1.5rem; font-weight: 600; color: var(--text-main, #f8fafc);">${preview.summary.totalCoins.toLocaleString()}</div>
                </div>
                ` : ''}
                ${preview.summary.totalScores > 0 ? `
                <div>
                    <div style="font-size: 0.8rem; color: var(--text-muted, #cbd5f5);">Game Scores</div>
                    <div style="font-size: 1.5rem; font-weight: 600; color: var(--text-main, #f8fafc);">${preview.summary.totalScores}</div>
                </div>
                ` : ''}
                <div>
                    <div style="font-size: 0.8rem; color: var(--text-muted, #cbd5f5);">Date Range</div>
                    <div style="font-size: 0.9rem; font-weight: 600; color: var(--text-main, #f8fafc);">${dateStr}</div>
                </div>
            </div>
        `;

        // Render tables
        let tablesHTML = '';
        
        if (preview.studentProgress.length > 0) {
            tablesHTML += `
                <h5 style="margin-top: 1.5rem; margin-bottom: 0.5rem;">Student Progress (${preview.studentProgress.length} records)</h5>
                <table style="width: 100%; border-collapse: collapse; margin-bottom: 1.5rem;">
                    <thead>
                        <tr style="border-bottom: 2px solid var(--border-color);">
                            <th style="padding: 0.75rem; text-align: left;">Student ID</th>
                            <th style="padding: 0.75rem; text-align: left;">Name</th>
                            <th style="padding: 0.75rem; text-align: left;">Grade</th>
                            <th style="padding: 0.75rem; text-align: right;">Coins</th>
                            <th style="padding: 0.75rem; text-align: left;">Last Active</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${preview.studentProgress.slice(0, 10).map(item => {
                            const profile = item.studentProfile || {};
                            const name = profile.firstName && profile.lastName
                                ? `${profile.firstName} ${profile.lastName}`
                                : (profile.name || 'Unknown');
                            const coins = (item.coinData || {}).balance || 0;
                            const lastActive = item.updatedAt
                                ? (item.updatedAt.toDate ? item.updatedAt.toDate() : new Date(item.updatedAt.seconds * 1000)).toLocaleDateString()
                                : '-';
                            return `
                                <tr style="border-bottom: 1px solid var(--border-color);">
                                    <td style="padding: 0.75rem;">${item.studentId}</td>
                                    <td style="padding: 0.75rem;">${name}</td>
                                    <td style="padding: 0.75rem;">${profile.grade || '-'}</td>
                                    <td style="padding: 0.75rem; text-align: right;">${coins}</td>
                                    <td style="padding: 0.75rem;">${lastActive}</td>
                                </tr>
                            `;
                        }).join('')}
                        ${preview.studentProgress.length > 10 ? `
                            <tr>
                                <td colspan="5" style="padding: 0.75rem; text-align: center; color: var(--text-muted);">
                                    ... and ${preview.studentProgress.length - 10} more records
                                </td>
                            </tr>
                        ` : ''}
                    </tbody>
                </table>
            `;
        }

        if (preview.scores.length > 0) {
            tablesHTML += `
                <h5 style="margin-top: 1.5rem; margin-bottom: 0.5rem;">Leaderboard Scores (${preview.scores.length} records)</h5>
                <table style="width: 100%; border-collapse: collapse; margin-bottom: 1.5rem;">
                    <thead>
                        <tr style="border-bottom: 2px solid var(--border-color);">
                            <th style="padding: 0.75rem; text-align: left;">Student</th>
                            <th style="padding: 0.75rem; text-align: left;">Game</th>
                            <th style="padding: 0.75rem; text-align: right;">Score</th>
                            <th style="padding: 0.75rem; text-align: left;">Date</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${preview.scores.slice(0, 10).map(item => {
                            const date = item.timestamp
                                ? (item.timestamp.toDate ? item.timestamp.toDate() : new Date(item.timestamp.seconds * 1000)).toLocaleDateString()
                                : '-';
                            return `
                                <tr style="border-bottom: 1px solid var(--border-color);">
                                    <td style="padding: 0.75rem;">${item.name || item.userId}</td>
                                    <td style="padding: 0.75rem;">${item.gameId || '-'}</td>
                                    <td style="padding: 0.75rem; text-align: right;">${(item.score || 0).toLocaleString()}</td>
                                    <td style="padding: 0.75rem;">${date}</td>
                                </tr>
                            `;
                        }).join('')}
                        ${preview.scores.length > 10 ? `
                            <tr>
                                <td colspan="4" style="padding: 0.75rem; text-align: center; color: var(--text-muted);">
                                    ... and ${preview.scores.length - 10} more records
                                </td>
                            </tr>
                        ` : ''}
                    </tbody>
                </table>
            `;
        }

        tablesEl.innerHTML = tablesHTML || '<p style="color: var(--text-muted);">No data to display.</p>';
    },

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

        // Show loading indicator
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

            // Mark export as complete
            await this.markExportComplete(dataTypes, studentIds, format);
            
            updateProgress(100, 'Export complete!');
            
            // Hide loading after a brief delay to show completion
            setTimeout(() => {
                if (loadingEl) loadingEl.style.display = 'none';
                if (jsonBtn) jsonBtn.disabled = false;
                if (csvBtn) csvBtn.disabled = false;
            }, 500);
            
            notifications.success('Data exported successfully!');
        } catch (error) {
            console.error('Error exporting data:', error);
            
            // Hide loading on error
            if (loadingEl) loadingEl.style.display = 'none';
            if (jsonBtn) jsonBtn.disabled = false;
            if (csvBtn) csvBtn.disabled = false;
            
            notifications.error('Failed to export data. Please try again.');
        }
    },

    async exportStudentProgress(studentIds) {
        const db = supabaseService.getDatabase();
        const progressData = [];
        
        for (const studentId of studentIds) {
            try {
                const docRef = doc(db, 'studentProgress', studentId);
                const docSnap = await getDoc(docRef);
                if (docSnap.exists()) {
                    progressData.push({
                        studentId: studentId,
                        ...docSnap.data()
                    });
                }
            } catch (error) {
                console.error(`Error exporting progress for ${studentId}:`, error);
            }
        }
        
        return progressData;
    },

    async exportScores(studentIds) {
        const db = supabaseService.getDatabase();
        const scoresRef = collection(db, 'scores');
        const allScores = [];
        
        for (const studentId of studentIds) {
            try {
                const q = query(scoresRef, where('userId', '==', studentId));
                const snapshot = await getDocs(q);
                snapshot.forEach(doc => {
                    allScores.push({
                        scoreId: doc.id,
                        ...doc.data()
                    });
                });
            } catch (error) {
                console.error(`Error exporting scores for ${studentId}:`, error);
            }
        }
        
        return allScores;
    },

    async exportUserRoles(studentIds) {
        const db = supabaseService.getDatabase();
        const rolesData = [];
        
        for (const studentId of studentIds) {
            try {
                const docRef = doc(db, 'userRoles', studentId);
                const docSnap = await getDoc(docRef);
                if (docSnap.exists()) {
                    rolesData.push({
                        userId: studentId,
                        ...docSnap.data()
                    });
                }
            } catch (error) {
                console.error(`Error exporting role for ${studentId}:`, error);
            }
        }
        
        return rolesData;
    },

    downloadJSON(data, filename) {
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    },

    downloadCSV(data, filename) {
        // Convert to CSV format
        let csv = '';
        
        if (data.studentProgress && data.studentProgress.length > 0) {
            csv += 'Student Progress (includes vocabulary progress, scores, coins, images)\n';
            csv += 'Student ID,Name,Grade,Coins,Total Earned,Vocab Units,Last Active\n';
            data.studentProgress.forEach(item => {
                const profile = item.studentProfile || {};
                const name = profile.firstName && profile.lastName
                    ? `${profile.firstName} ${profile.lastName}`
                    : (profile.name || 'Unknown');
                const coins = (item.coinData || {}).balance || 0;
                const totalEarned = (item.coinData || {}).totalEarned || 0;
                const vocabUnits = item.units ? Object.keys(item.units).length : 0;
                const lastActive = item.updatedAt
                    ? (item.updatedAt.toDate ? item.updatedAt.toDate() : new Date(item.updatedAt.seconds * 1000)).toISOString()
                    : '';
                csv += `"${item.studentId}","${name}","${profile.grade || ''}",${coins},${totalEarned},${vocabUnits},"${lastActive}"\n`;
            });
            csv += '\n';
            
            // Add vocabulary progress details
            csv += 'Vocabulary Progress Details\n';
            csv += 'Student ID,Vocabulary Name,Activity,Score,Last Updated\n';
            data.studentProgress.forEach(item => {
                if (item.units) {
                    Object.entries(item.units).forEach(([vocabName, unitData]) => {
                        if (unitData.scores) {
                            Object.entries(unitData.scores).forEach(([activity, scoreData]) => {
                                const score = scoreData.score || 0;
                                const updated = scoreData.updatedAt
                                    ? (scoreData.updatedAt.toDate ? scoreData.updatedAt.toDate() : new Date(scoreData.updatedAt.seconds * 1000)).toISOString()
                                    : '';
                                csv += `"${item.studentId}","${vocabName}","${activity}",${score},"${updated}"\n`;
                            });
                        }
                    });
                }
            });
            csv += '\n';
        }
        
        if (data.scores && data.scores.length > 0) {
            csv += 'Leaderboard Scores\n';
            csv += 'Student,Game,Score,Grade,Date\n';
            data.scores.forEach(item => {
                const date = item.timestamp
                    ? (item.timestamp.toDate ? item.timestamp.toDate() : new Date(item.timestamp.seconds * 1000)).toISOString()
                    : '';
                csv += `"${item.name || item.userId}","${item.gameId || ''}",${item.score || 0},"${item.grade || ''}","${date}"\n`;
            });
            csv += '\n';
        }
        
        if (data.userRoles && data.userRoles.length > 0) {
            csv += 'User Roles\n';
            csv += 'User ID,Role,Email\n';
            data.userRoles.forEach(item => {
                csv += `"${item.userId}","${item.role || ''}","${item.email || ''}"\n`;
            });
        }
        
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    },

    async markExportComplete(dataTypes, studentIds, exportFormat) {
        const exportRecord = {
            timestamp: new Date().toISOString(),
            teacherId: this.currentUser?.uid || '',
            dataTypes: dataTypes,
            studentCount: studentIds.length,
            format: exportFormat,
            filename: `export-${Date.now()}.${exportFormat}`
        };
        
        // Store in localStorage
        localStorage.setItem('lastExport', JSON.stringify(exportRecord));
        
        // Update UI
        const exportStatus = $('#export-status');
        const exportStatusText = $('#export-status-text');
        if (exportStatus && exportStatusText) {
            exportStatus.style.display = 'block';
            exportStatusText.textContent = `Export completed: ${exportRecord.filename}`;
        }
        
        // Enable reset section
        this.enableResetSection();
        
        // Log to Supabase (optional audit)
        try {
            const db = supabaseService.getDatabase();
            await addDoc(collection(db, 'exportLogs'), {
                ...exportRecord,
                timestamp: serverTimestamp()
            });
        } catch (error) {
            console.error('Error logging export:', error);
            // Don't fail if audit logging fails
        }
    },

    enableResetSection() {
        const resetSection = $('#data-reset-section');
        const resetBtn = $('#reset-data-btn');
        const resetStatus = $('#reset-export-status');
        
        if (resetSection && resetBtn && resetStatus) {
            resetSection.style.opacity = '1';
            resetSection.style.pointerEvents = 'auto';
            resetBtn.disabled = false;
            resetStatus.innerHTML = '<span style="color: var(--success-color);">Export completed. Reset is now enabled.</span>';
        }
    },
};

export function installTeacherDataExportMethods(TeacherManager) {
    Object.assign(TeacherManager.prototype, teacherDataExportMethods);
}
