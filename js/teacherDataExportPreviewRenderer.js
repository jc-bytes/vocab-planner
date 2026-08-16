import { escapeHtml } from './main.js';

export function renderPreview(preview, summaryEl, tablesEl) {
    const dateRange = preview.summary.dateRange;
    const dateStr = dateRange.start && dateRange.end
        ? `${dateRange.start.toLocaleDateString()} to ${dateRange.end.toLocaleDateString()}`
        : 'N/A';

    let totalVocabUnits = 0;
    if (preview.studentProgress.length > 0) {
        preview.studentProgress.forEach(item => {
            if (item.units) {
                totalVocabUnits += Object.keys(item.units).length;
            }
        });
    }

    summaryEl.innerHTML = `
            <div class="runtime-summary" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 1rem; padding: 1rem; background: rgba(15, 23, 42, 0.4); border-radius: 8px; border: 1px solid var(--border-color, rgba(255, 255, 255, 0.125));">
                <div>
                    <div class="runtime-summary__label" style="color: var(--text-muted, #cbd5f5);">Total Students</div>
                    <div class="runtime-summary__value" style="color: var(--text-main, #f8fafc);">${preview.summary.totalStudents}</div>
                </div>
                ${preview.summary.totalProgressRecords > 0 ? `
                <div>
                    <div class="runtime-summary__label" style="color: var(--text-muted, #cbd5f5);">Progress Records</div>
                    <div class="runtime-summary__value" style="color: var(--text-main, #f8fafc);">${preview.summary.totalProgressRecords}</div>
                </div>
                ${totalVocabUnits > 0 ? `
                <div>
                    <div class="runtime-summary__label" style="color: var(--text-muted, #cbd5f5);">Vocabulary Units</div>
                    <div class="runtime-summary__value" style="color: var(--text-main, #f8fafc);">${totalVocabUnits}</div>
                </div>
                ` : ''}
                <div>
                    <div class="runtime-summary__label" style="color: var(--text-muted, #cbd5f5);">Total Coins</div>
                    <div class="runtime-summary__value" style="color: var(--text-main, #f8fafc);">${preview.summary.totalCoins.toLocaleString()}</div>
                </div>
                ` : ''}
                ${preview.summary.totalScores > 0 ? `
                <div>
                    <div class="runtime-summary__label" style="color: var(--text-muted, #cbd5f5);">Game Scores</div>
                    <div class="runtime-summary__value" style="color: var(--text-main, #f8fafc);">${preview.summary.totalScores}</div>
                </div>
                ` : ''}
                <div>
                    <div class="runtime-summary__label" style="color: var(--text-muted, #cbd5f5);">Date Range</div>
                    <div class="runtime-summary__value runtime-summary__value--compact" style="color: var(--text-main, #f8fafc);">${dateStr}</div>
                </div>
            </div>
        `;

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
                                    <td style="padding: 0.75rem;">${escapeHtml(item.studentId)}</td>
                                    <td style="padding: 0.75rem;">${escapeHtml(name)}</td>
                                    <td style="padding: 0.75rem;">${escapeHtml(profile.grade || '-')}</td>
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
                                    <td style="padding: 0.75rem;">${escapeHtml(item.name || item.userId)}</td>
                                    <td style="padding: 0.75rem;">${escapeHtml(item.gameId || '-')}</td>
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
}
