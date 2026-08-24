import { $, escapeHtml } from './main.js';

const teacherDataDashboardRecentActivityMethods = {
    renderRecentActivity() {
        const table = $('#recent-activity-table');
        if (!table) return;

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
        const recentActivities = (this.dashboardAnalytics?.recentActivities || []).map(activity => {
            const date = activity.occurredAt ? new Date(activity.occurredAt) : null;
            return {
                student: activity.student || 'Unknown',
                unit: String(activity.unit || '').replace(/_/g, ' '),
                activity: activityNames[activity.activityType] || activity.activityType || 'Activity',
                score: activity.score !== undefined && activity.score !== null
                    ? `${Math.round(Number(activity.score))}%`
                    : (activity.completed ? 'Complete' : '-'),
                dateStr: date && !Number.isNaN(date.getTime()) ? date.toLocaleDateString() : '-'
            };
        });


        if (recentActivities.length === 0) {
            table.innerHTML = '<p class="data-table__empty data-dashboard-empty">No vocabulary activity completed yet</p>';
            return;
        }

        table.innerHTML = `
            <table class="data-table data-dashboard-table">
                <thead>
                    <tr>
                        <th class="data-table__header-cell">Student</th>
                        <th class="data-table__header-cell">Vocabulary</th>
                        <th class="data-table__header-cell">Activity</th>
                        <th class="data-table__header-cell data-dashboard-table__numeric">Score</th>
                        <th class="data-table__header-cell data-dashboard-table__numeric">Date</th>
                    </tr>
                </thead>
                <tbody>
                    ${recentActivities.map(activity => `
                        <tr>
                            <td class="data-table__cell">${escapeHtml(activity.student)}</td>
                            <td class="data-table__cell data-table__secondary">${escapeHtml(activity.unit)}</td>
                            <td class="data-table__cell">${escapeHtml(activity.activity)}</td>
                            <td class="data-table__cell data-table__metric data-dashboard-table__numeric">${escapeHtml(activity.score)}</td>
                            <td class="data-table__cell data-table__secondary data-dashboard-table__numeric">${escapeHtml(activity.dateStr)}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        `;
    },
};

export function installTeacherDataDashboardRecentActivityMethods(TeacherManager) {
    Object.assign(TeacherManager.prototype, teacherDataDashboardRecentActivityMethods);
}
