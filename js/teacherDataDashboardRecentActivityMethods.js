import { $ } from './main.js';

const teacherDataDashboardRecentActivityMethods = {
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

export function installTeacherDataDashboardRecentActivityMethods(TeacherManager) {
    Object.assign(TeacherManager.prototype, teacherDataDashboardRecentActivityMethods);
}
