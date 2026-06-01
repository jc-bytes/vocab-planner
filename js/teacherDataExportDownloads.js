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

export function downloadCSV(data, filename) {
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
}
