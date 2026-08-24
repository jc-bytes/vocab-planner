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
            <div class="runtime-summary data-export-runtime-summary">
                <div>
                    <div class="runtime-summary__label">Total Students</div>
                    <div class="runtime-summary__value">${preview.summary.totalStudents}</div>
                </div>
                ${preview.summary.totalProgressRecords > 0 ? `
                <div>
                    <div class="runtime-summary__label">Progress Records</div>
                    <div class="runtime-summary__value">${preview.summary.totalProgressRecords}</div>
                </div>
                ${totalVocabUnits > 0 ? `
                <div>
                    <div class="runtime-summary__label">Vocabulary Units</div>
                    <div class="runtime-summary__value">${totalVocabUnits}</div>
                </div>
                ` : ''}
                <div>
                    <div class="runtime-summary__label">Total Coins</div>
                    <div class="runtime-summary__value">${preview.summary.totalCoins.toLocaleString()}</div>
                </div>
                ` : ''}
                ${preview.summary.totalScores > 0 ? `
                <div>
                    <div class="runtime-summary__label">Game Scores</div>
                    <div class="runtime-summary__value">${preview.summary.totalScores}</div>
                </div>
                ` : ''}
                <div>
                    <div class="runtime-summary__label">Date Range</div>
                    <div class="runtime-summary__value runtime-summary__value--compact">${dateStr}</div>
                </div>
            </div>
        `;

    let tablesHTML = '';

    if (preview.studentProgress.length > 0) {
        tablesHTML += `
                <h5 class="data-export-table-caption">Student Progress (${preview.studentProgress.length} records)</h5>
                <table class="data-table data-export-table data-export-table--spaced">
                    <thead>
                        <tr class="data-export-table__header-row">
                            <th class="data-table__header-cell">Student ID</th>
                            <th class="data-table__header-cell">Name</th>
                            <th class="data-table__header-cell">Grade</th>
                            <th class="data-table__header-cell data-export-table__numeric">Coins</th>
                            <th class="data-table__header-cell">Last Active</th>
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
                                <tr class="data-export-table__row">
                                    <td class="data-table__cell">${escapeHtml(item.studentId)}</td>
                                    <td class="data-table__cell">${escapeHtml(name)}</td>
                                    <td class="data-table__cell">${escapeHtml(profile.grade || '-')}</td>
                                    <td class="data-table__cell data-table__metric">${coins}</td>
                                    <td class="data-table__cell">${lastActive}</td>
                                </tr>
                            `;
                        }).join('')}
                        ${preview.studentProgress.length > 10 ? `
                            <tr>
                                <td colspan="5" class="data-table__cell data-table__status">
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
                <h5 class="data-export-table-caption">Leaderboard Scores (${preview.scores.length} records)</h5>
                <table class="data-table data-export-table data-export-table--spaced">
                    <thead>
                        <tr class="data-export-table__header-row">
                            <th class="data-table__header-cell">Student</th>
                            <th class="data-table__header-cell">Game</th>
                            <th class="data-table__header-cell data-export-table__numeric">Score</th>
                            <th class="data-table__header-cell">Date</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${preview.scores.slice(0, 10).map(item => {
                            const date = item.timestamp
                                ? (item.timestamp.toDate ? item.timestamp.toDate() : new Date(item.timestamp.seconds * 1000)).toLocaleDateString()
                                : '-';
                            return `
                                <tr class="data-export-table__row">
                                    <td class="data-table__cell">${escapeHtml(item.name || item.userId)}</td>
                                    <td class="data-table__cell">${escapeHtml(item.gameId || '-')}</td>
                                    <td class="data-table__cell data-table__metric">${(item.score || 0).toLocaleString()}</td>
                                    <td class="data-table__cell">${date}</td>
                                </tr>
                            `;
                        }).join('')}
                        ${preview.scores.length > 10 ? `
                            <tr>
                                <td colspan="4" class="data-table__cell data-table__status">
                                    ... and ${preview.scores.length - 10} more records
                                </td>
                            </tr>
                        ` : ''}
                    </tbody>
                </table>
            `;
    }

    tablesEl.innerHTML = tablesHTML || '<p class="data-export-table-empty">No data to display.</p>';
}
