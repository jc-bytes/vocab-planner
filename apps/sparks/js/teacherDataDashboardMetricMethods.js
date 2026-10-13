import { ACTIVITY_DEFINITIONS } from './activityMetadata.js';

function getActivityMetrics(analytics, metricIds) {
    return metricIds
        .map(metricId => analytics?.activities?.[metricId])
        .filter(Boolean);
}

const teacherDataDashboardMetricMethods = {
    calculateActivityCompletion() {
        const completion = {};

        ACTIVITY_DEFINITIONS.forEach(({ metricIds, label }) => {
            const metrics = getActivityMetrics(this.dashboardAnalytics, metricIds);
            const attempted = metrics.reduce((total, metric) => total + (Number(metric.attempted) || 0), 0);
            const completed = metrics.reduce((total, metric) => total + (Number(metric.completed) || 0), 0);
            completion[label] = attempted > 0
                ? Math.round((completed / attempted) * 100)
                : (Number(metrics[0]?.completionRate) || 0);
        });
        return completion;
    },

    calculateGradeProgress() {
        return this.dashboardAnalytics?.gradeCounts || {};
    },

    calculateCoinDistribution() {
        return {
            labels: ['0-100', '101-500', '501-1000', '1001-5000', '5000+'],
            data: this.dashboardAnalytics?.coinDistribution || [0, 0, 0, 0, 0]
        };
    },

    calculateActivityUsage() {
        const usage = {};

        ACTIVITY_DEFINITIONS.forEach(({ label }) => {
            usage[label] = 0;
        });

        ACTIVITY_DEFINITIONS.forEach(({ metricIds, label }) => {
            usage[label] = getActivityMetrics(this.dashboardAnalytics, metricIds)
                .reduce((total, metric) => total + (Number(metric.completed) || 0), 0);
        });
        return usage;
    },
};

export function installTeacherDataDashboardMetricMethods(TeacherManager) {
    Object.assign(TeacherManager.prototype, teacherDataDashboardMetricMethods);
}
