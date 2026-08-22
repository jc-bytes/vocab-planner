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
            table.innerHTML = '<p class="data-table__empty" style="color: var(--text-muted); text-align: center; padding: 2rem;">No vocabulary activity completed yet</p>';
            return;
        }

        table.innerHTML = `
            <table class="data-table" style="width: 100%; border-collapse: collapse;">
                <thead>
                    <tr style="border-bottom: 1px solid var(--border-color);">
                        <th class="data-table__header-cell" style="padding: 0.75rem; text-align: left; color: var(--text-muted);">Student</th>
                        <th class="data-table__header-cell" style="padding: 0.75rem; text-align: left; color: var(--text-muted);">Vocabulary</th>
                        <th class="data-table__header-cell" style="padding: 0.75rem; text-align: left; color: var(--text-muted);">Activity</th>
                        <th class="data-table__header-cell" style="padding: 0.75rem; text-align: right; color: var(--text-muted);">Score</th>
                        <th class="data-table__header-cell" style="padding: 0.75rem; text-align: right; color: var(--text-muted);">Date</th>
                    </tr>
                </thead>
                <tbody>
                    ${recentActivities.map(activity => `
                        <tr style="border-bottom: 1px solid rgba(255, 255, 255, 0.05);">
                            <td class="data-table__cell" style="padding: 0.75rem;">${escapeHtml(activity.student)}</td>
                            <td class="data-table__cell data-table__secondary" style="padding: 0.75rem; color: var(--text-muted);">${escapeHtml(activity.unit)}</td>
                            <td class="data-table__cell" style="padding: 0.75rem;">${escapeHtml(activity.activity)}</td>
                            <td class="data-table__cell data-table__metric" style="padding: 0.75rem; text-align: right; color: var(--primary-color);">${escapeHtml(activity.score)}</td>
                            <td class="data-table__cell data-table__secondary" style="padding: 0.75rem; text-align: right; color: var(--text-muted);">${escapeHtml(activity.dateStr)}</td>
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
