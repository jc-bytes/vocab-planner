import { $, loadScript } from './main.js';

const CHART_JS_CDN = 'https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js';

const teacherDataDashboardMethods = {

    async showDataManagementView(options = {}) {
        if (!this.ensureAuthenticated(false)) return;
        this.switchView('teacher-data-management-view');
        this.loadSubjectSettings();
        this.loadGamificationSettings();
        this.loadSchoolCalendarSettings();
        if (this.allStudentData.length === 0) {
            await this.fetchAllStudentProgress();
        }
        // Initialize data viewer if not already done
        if (!this.dataViewerInitialized) {
            this.initDataViewer();
        }
        this.initExportListeners();
        this.populateExportGradeSelect();
        this.switchDataTab(options.tab || 'subjects');
    },

    async loadDashboardData() {
        // Ensure student data is loaded
        if (this.allStudentData.length === 0) {
            await this.fetchAllStudentProgress();
        }
        
        // Populate grade filter dropdown
        this.populateDashboardGradeFilter();
        
        // Get filtered data based on selected grade
        const filteredData = this.getDashboardFilteredData();
        
        // Load summary stats
        const totalStudents = filteredData.length;
        const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
        const activeStudents = filteredData.filter(s => {
            const lastActive = this.getStudentUpdatedTime(s);
            return lastActive > sevenDaysAgo;
        }).length;
        
        const totalCoins = filteredData.reduce((sum, s) => {
            const coins = s.coinData?.balance || s.coins || 0;
            return sum + coins;
        }, 0);
        const avgCoins = totalStudents > 0 ? Math.round(totalCoins / totalStudents) : 0;

        // Update summary cards
        $('#dashboard-total-students').textContent = totalStudents;
        $('#dashboard-active-students').textContent = activeStudents;
        $('#dashboard-avg-coins').textContent = avgCoins.toLocaleString();
        
        // Load vocabulary count
        try {
            const { cloudVocabs, remoteVocabs, localVocabs } = await this.getTeacherLibrary();
            $('#dashboard-vocab-count').textContent = cloudVocabs.length + remoteVocabs.length + localVocabs.length;
        } catch (err) {
            console.error('Error loading vocab count:', err);
            $('#dashboard-vocab-count').textContent = '--';
        }

        // Load charts
        await this.renderDashboardCharts();
        this.renderRecentActivity();
    },
    
    populateDashboardGradeFilter() {
        const gradeFilter = $('#dashboard-grade-filter');
        if (!gradeFilter) return;
        
        // Get unique grades from student data (grade is in studentProfile.grade)
        const grades = new Set();
        this.allStudentData.forEach(student => {
            const profile = student.studentProfile || {};
            const grade = profile.grade || '';
            if (grade) grades.add(grade);
        });
        
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
    
    getDashboardFilteredData() {
        const gradeFilter = $('#dashboard-grade-filter');
        const selectedGrade = gradeFilter?.value || '';
        
        if (!selectedGrade) {
            return this.allStudentData;
        }
        
        return this.allStudentData.filter(student => {
            const profile = student.studentProfile || {};
            const studentGrade = profile.grade || '';
            return String(studentGrade) === String(selectedGrade);
        });
    },

    async ensureChartLibrary() {
        if (window.Chart) return window.Chart;

        if (window.__TAURI_INTERNALS__ || window.__TAURI__) {
            const module = await import('chart.js/auto');
            window.Chart = window.Chart || module.default;
            return window.Chart;
        }

        await loadScript(CHART_JS_CDN);
        if (!window.Chart) {
            throw new Error('Chart.js library not loaded');
        }

        return window.Chart;
    },

    async renderDashboardCharts() {
        let Chart;
        try {
            Chart = await this.ensureChartLibrary();
        } catch (error) {
            console.error('Unable to load dashboard charts:', error);
            return;
        }

        // Activity Completion Chart
        const activityCtx = document.getElementById('activity-chart')?.getContext('2d');
        if (activityCtx) {
            const activityData = this.calculateActivityCompletion();
            if (this.activityChart) this.activityChart.destroy();
            this.activityChart = new Chart(activityCtx, {
                type: 'bar',
                data: {
                    labels: Object.keys(activityData),
                    datasets: [{
                        label: 'Completion Rate (%)',
                        data: Object.values(activityData),
                        backgroundColor: 'rgba(99, 102, 241, 0.6)',
                        borderColor: 'rgba(99, 102, 241, 1)',
                        borderWidth: 1
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                        y: {
                            beginAtZero: true,
                            max: 100,
                            ticks: { color: '#cbd5f5' },
                            grid: { color: 'rgba(255, 255, 255, 0.1)' }
                        },
                        x: {
                            ticks: { color: '#cbd5f5' },
                            grid: { color: 'rgba(255, 255, 255, 0.1)' }
                        }
                    },
                    plugins: {
                        legend: { labels: { color: '#cbd5f5' } }
                    }
                }
            });
        }

        // Progress by Grade Chart
        const gradeCtx = document.getElementById('grade-progress-chart')?.getContext('2d');
        if (gradeCtx) {
            const gradeData = this.calculateGradeProgress();
            if (this.gradeChart) this.gradeChart.destroy();
            this.gradeChart = new Chart(gradeCtx, {
                type: 'doughnut',
                data: {
                    labels: Object.keys(gradeData),
                    datasets: [{
                        data: Object.values(gradeData),
                        backgroundColor: [
                            'rgba(99, 102, 241, 0.6)',
                            'rgba(16, 185, 129, 0.6)',
                            'rgba(251, 191, 36, 0.6)',
                            'rgba(239, 68, 68, 0.6)',
                            'rgba(139, 92, 246, 0.6)'
                        ]
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { labels: { color: '#cbd5f5' }, position: 'bottom' }
                    }
                }
            });
        }

        // Coin Distribution Chart
        const coinCtx = document.getElementById('coin-distribution-chart')?.getContext('2d');
        if (coinCtx) {
            const coinData = this.calculateCoinDistribution();
            if (this.coinChart) this.coinChart.destroy();
            this.coinChart = new Chart(coinCtx, {
                type: 'line',
                data: {
                    labels: coinData.labels,
                    datasets: [{
                        label: 'Students',
                        data: coinData.data,
                        borderColor: 'rgba(99, 102, 241, 1)',
                        backgroundColor: 'rgba(99, 102, 241, 0.1)',
                        tension: 0.4
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    scales: {
                        y: {
                            beginAtZero: true,
                            ticks: { color: '#cbd5f5' },
                            grid: { color: 'rgba(255, 255, 255, 0.1)' }
                        },
                        x: {
                            ticks: { color: '#cbd5f5' },
                            grid: { color: 'rgba(255, 255, 255, 0.1)' }
                        }
                    },
                    plugins: {
                        legend: { labels: { color: '#cbd5f5' } }
                    }
                }
            });
        }

        // Activity Usage Chart
        const usageCtx = document.getElementById('activity-usage-chart')?.getContext('2d');
        if (usageCtx) {
            const usageData = this.calculateActivityUsage();
            if (this.usageChart) this.usageChart.destroy();
            this.usageChart = new Chart(usageCtx, {
                type: 'pie',
                data: {
                    labels: Object.keys(usageData),
                    datasets: [{
                        data: Object.values(usageData),
                        backgroundColor: [
                            'rgba(99, 102, 241, 0.6)',
                            'rgba(16, 185, 129, 0.6)',
                            'rgba(251, 191, 36, 0.6)',
                            'rgba(239, 68, 68, 0.6)',
                            'rgba(139, 92, 246, 0.6)',
                            'rgba(236, 72, 153, 0.6)'
                        ]
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: {
                        legend: { labels: { color: '#cbd5f5' }, position: 'bottom' }
                    }
                }
            });
        }
    },

    calculateActivityCompletion() {
        const filteredData = this.getDashboardFilteredData();
        const activityLabels = {
            matching: 'Matching',
            flashcards: 'Flashcards',
            quiz: 'Quiz',
            hangman: 'Hangman',
            fillInBlank: 'Fill in Blank',
            wordSearch: 'Word Search',
            crossword: 'Crossword',
            scramble: 'Word Scramble',
            wordle: 'Vocabulary Wordle'
        };
        const completion = {};
        
        Object.entries(activityLabels).forEach(([activityKey, activityLabel]) => {
            let completed = 0;
            let total = 0;
            
            filteredData.forEach(student => {
                const units = student.units || {};
                Object.values(units).forEach(unit => {
                    // Scores are stored in unit.scores[activityKey]
                    const scores = unit.scores || {};
                    const activityData = scores[activityKey];
                    if (activityData) {
                        total++;
                        if (activityData.completed || activityData.score > 0) {
                            completed++;
                        }
                    }
                });
            });
            
            completion[activityLabel] = total > 0 ? Math.round((completed / total) * 100) : 0;
        });
        
        console.log('Activity Completion Data:', completion);
        return completion;
    },

    calculateGradeProgress() {
        const filteredData = this.getDashboardFilteredData();
        const gradeCounts = {};
        filteredData.forEach(student => {
            const grade = student.studentProfile?.grade || student.grade || 'Unknown';
            gradeCounts[grade] = (gradeCounts[grade] || 0) + 1;
        });
        return gradeCounts;
    },

    calculateCoinDistribution() {
        const filteredData = this.getDashboardFilteredData();
        const ranges = [
            { label: '0-100', min: 0, max: 100 },
            { label: '101-500', min: 101, max: 500 },
            { label: '501-1000', min: 501, max: 1000 },
            { label: '1001-5000', min: 1001, max: 5000 },
            { label: '5000+', min: 5001, max: Infinity }
        ];
        
        const distribution = ranges.map(range => {
            return filteredData.filter(student => {
                const coins = student.coinData?.balance || student.coins || 0;
                return coins >= range.min && coins <= range.max;
            }).length;
        });
        
        return {
            labels: ranges.map(r => r.label),
            data: distribution
        };
    },

    calculateActivityUsage() {
        const filteredData = this.getDashboardFilteredData();
        const activityLabels = {
            matching: 'Matching',
            flashcards: 'Flashcards',
            quiz: 'Quiz',
            hangman: 'Hangman',
            fillInBlank: 'Fill in Blank',
            wordSearch: 'Word Search',
            crossword: 'Crossword',
            scramble: 'Word Scramble',
            wordle: 'Vocabulary Wordle'
        };
        const usage = {};
        
        Object.values(activityLabels).forEach(label => {
            usage[label] = 0;
        });
        
        filteredData.forEach(student => {
            const units = student.units || {};
            Object.values(units).forEach(unit => {
                // Scores are stored in unit.scores[activityKey]
                const scores = unit.scores || {};
                Object.entries(activityLabels).forEach(([activityKey, activityLabel]) => {
                    const activityData = scores[activityKey];
                    if (activityData && (activityData.completed || activityData.score > 0)) {
                        usage[activityLabel] = (usage[activityLabel] || 0) + 1;
                    }
                });
            });
        });
        
        console.log('Activity Usage Data:', usage);
        return usage;
    },

    renderRecentActivity() {
        const filteredData = this.getDashboardFilteredData();
        const table = $('#recent-activity-table');
        if (!table) return;
        
        // Get recent vocabulary activity completions (not coin history)
        const recentActivities = [];
        const activityNames = {
            matching: 'Matching',
            flashcards: 'Flashcards',
            quiz: 'Quiz',
            hangman: 'Hangman',
            fillInBlank: 'Fill in Blank',
            wordSearch: 'Word Search',
            crossword: 'Crossword',
            scramble: 'Word Scramble',
            wordle: 'Vocabulary Wordle',
            speedMatch: 'Speed Match',
            synonymAntonym: 'Synonym/Antonym',
            illustration: 'Word Hunt'
        };
        
        filteredData.forEach(student => {
            const profile = student.studentProfile || {};
            const studentName = profile.firstName && profile.lastName 
                ? `${profile.firstName} ${profile.lastName}` 
                : (profile.name || student.email || 'Unknown');
            
            const units = student.units || {};
            Object.entries(units).forEach(([unitId, unitData]) => {
                // Scores are stored in unitData.scores[activityKey]
                const scores = unitData.scores || {};
                Object.entries(activityNames).forEach(([activityKey, activityLabel]) => {
                    const activityData = scores[activityKey];
                    if (activityData && (activityData.completed || activityData.score > 0)) {
                        const timestamp = activityData.completedAt || activityData.lastAttempt || activityData.timestamp || student.updatedAt;
                        let date = null;
                        if (timestamp) {
                            // Handle Supabase timestamp or regular timestamp
                            if (timestamp.toDate) {
                                date = timestamp.toDate();
                            } else if (timestamp.toMillis) {
                                date = new Date(timestamp.toMillis());
                            } else if (typeof timestamp === 'number') {
                                date = new Date(timestamp);
                            } else {
                                date = new Date(timestamp);
                            }
                        }
                        
                        recentActivities.push({
                            student: studentName,
                            unit: unitId.replace(/_/g, ' '),
                            activity: activityLabel,
                            score: activityData.score !== undefined ? `${activityData.score}%` : (activityData.completed ? '✓' : '-'),
                            date: date,
                            dateStr: date && !isNaN(date) ? date.toLocaleDateString() : '-'
                        });
                    }
                });
            });
        });
        
        // Sort by date (most recent first)
        recentActivities.sort((a, b) => {
            if (!a.date) return 1;
            if (!b.date) return -1;
            return b.date - a.date;
        });
        recentActivities.splice(30); // Keep only 30 most recent
        
        if (recentActivities.length === 0) {
            table.innerHTML = '<p style="color: var(--text-muted); text-align: center; padding: 2rem;">No vocabulary activity completed yet</p>';
            return;
        }
        
        table.innerHTML = `
            <table style="width: 100%; border-collapse: collapse;">
                <thead>
                    <tr style="border-bottom: 1px solid var(--border-color);">
                        <th style="padding: 0.75rem; text-align: left; color: var(--text-muted);">Student</th>
                        <th style="padding: 0.75rem; text-align: left; color: var(--text-muted);">Vocabulary</th>
                        <th style="padding: 0.75rem; text-align: left; color: var(--text-muted);">Activity</th>
                        <th style="padding: 0.75rem; text-align: right; color: var(--text-muted);">Score</th>
                        <th style="padding: 0.75rem; text-align: right; color: var(--text-muted);">Date</th>
                    </tr>
                </thead>
                <tbody>
                    ${recentActivities.map(activity => `
                        <tr style="border-bottom: 1px solid rgba(255, 255, 255, 0.05);">
                            <td style="padding: 0.75rem;">${activity.student}</td>
                            <td style="padding: 0.75rem; color: var(--text-muted); font-size: 0.9rem;">${activity.unit}</td>
                            <td style="padding: 0.75rem;">${activity.activity}</td>
                            <td style="padding: 0.75rem; text-align: right; color: var(--primary-color);">${activity.score}</td>
                            <td style="padding: 0.75rem; text-align: right; color: var(--text-muted);">${activity.dateStr}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
    },
};

export function installTeacherDataDashboardMethods(TeacherManager) {
    Object.assign(TeacherManager.prototype, teacherDataDashboardMethods);
}
