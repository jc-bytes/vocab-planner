import Papa from 'papaparse';

export function downloadJSON(data, filename) {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

export function serializeCSV(data) {
    const sections = [];

    if (data.studentProgress && data.studentProgress.length > 0) {
        const progressRows = [[
            'Student ID', 'Name', 'Grade', 'Coins', 'Total Earned', 'Vocab Units', 'Last Active'
        ]];
        data.studentProgress.forEach(item => {
            const profile = item.studentProfile || {};
            const name = profile.firstName && profile.lastName
                ? `${profile.firstName} ${profile.lastName}`
                : (profile.name || 'Unknown');
            const coins = (item.coinData || {}).balance || 0;
            const totalEarned = (item.coinData || {}).totalEarned || 0;
            const vocabUnits = item.units ? Object.keys(item.units).length : 0;
            progressRows.push([
                item.studentId || '', name, profile.grade || '', coins, totalEarned,
                vocabUnits, toIsoTimestamp(item.updatedAt)
            ]);
        });
        sections.push(`Student Progress (includes vocabulary progress, scores, coins, images)\r\n${serializeSection(progressRows)}`);

        const vocabularyRows = [['Student ID', 'Vocabulary Name', 'Activity', 'Score', 'Last Updated']];
        data.studentProgress.forEach(item => {
            if (item.units) {
                Object.entries(item.units).forEach(([vocabName, unitData]) => {
                    if (unitData.scores) {
                        Object.entries(unitData.scores).forEach(([activity, scoreData]) => {
                            const score = scoreData.score || 0;
                            vocabularyRows.push([
                                item.studentId || '', vocabName, activity, score,
                                toIsoTimestamp(scoreData.updatedAt)
                            ]);
                        });
                    }
                });
            }
        });
        sections.push(`Vocabulary Progress Details\r\n${serializeSection(vocabularyRows)}`);
    }

    if (data.scores && data.scores.length > 0) {
        const scoreRows = [['Student', 'Game', 'Score', 'Grade', 'Date']];
        data.scores.forEach(item => {
            scoreRows.push([
                item.name || item.userId || '', item.gameId || '', item.score || 0,
                item.grade || '', toIsoTimestamp(item.timestamp)
            ]);
        });
        sections.push(`Leaderboard Scores\r\n${serializeSection(scoreRows)}`);
    }

    if (data.userRoles && data.userRoles.length > 0) {
        const roleRows = [['User ID', 'Role', 'Email']];
        data.userRoles.forEach(item => {
            roleRows.push([item.userId || '', item.role || '', item.email || '']);
        });
        sections.push(`User Roles\r\n${serializeSection(roleRows)}`);
    }

    return sections.join('\r\n\r\n');
}

export function downloadCSV(data, filename) {
    const csv = serializeCSV(data);

    const blob = new Blob(['\uFEFF', csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

function toIsoTimestamp(value) {
    if (!value) return '';
    const date = value.toDate
        ? value.toDate()
        : new Date(value.seconds !== undefined ? value.seconds * 1000 : value);
    return Number.isNaN(date.getTime()) ? '' : date.toISOString();
}

function serializeSection(rows) {
    return Papa.unparse(rows, {
        escapeFormulae: true,
        newline: '\r\n'
    });
}
