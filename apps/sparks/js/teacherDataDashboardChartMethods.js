let chartModulePromise = null;

const teacherDataDashboardChartMethods = {
    async ensureChartLibrary() {
        if (window.Chart) return window.Chart;

        chartModulePromise = chartModulePromise || import('chart.js/auto');
        const module = await chartModulePromise;
        window.Chart = window.Chart || module.default;

        return window.Chart;
    },

    async renderDashboardCharts() {
        const lifecycleGeneration = this.lifecycleGeneration;
        const dashboardGeneration = this.dashboardLoadGeneration;
        let Chart;
        try {
            Chart = await this.ensureChartLibrary();
        } catch (error) {
            console.error('Unable to load dashboard charts:', error);
            return;
        }
        if (this.destroyed
            || lifecycleGeneration !== this.lifecycleGeneration
            || dashboardGeneration !== this.dashboardLoadGeneration) return;

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
};

export function installTeacherDataDashboardChartMethods(TeacherManager) {
    Object.assign(TeacherManager.prototype, teacherDataDashboardChartMethods);
}
