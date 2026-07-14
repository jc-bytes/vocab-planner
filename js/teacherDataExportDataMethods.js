import { $ } from './main.js';
import { teacherExportRepository } from './services/teacherExportRepository.js';

export async function fetchPreviewData(studentIds, dataTypes) {
    const preview = {
        studentProgress: [],
        scores: [],
        userRoles: [],
        summary: {
            totalStudents: studentIds.length,
            totalProgressRecords: 0,
            totalScores: 0,
            totalRoles: 0,
            dateRange: { start: null, end: null },
            totalCoins: 0,
            gamesPlayed: new Set()
        }
    };

    if (dataTypes.includes('studentProgress')) {
        for (const studentId of studentIds) {
            try {
                const progress = await teacherExportRepository.getStudentProgress(studentId);
                if (progress) {
                    const data = { studentId, ...progress };
                    preview.studentProgress.push(data);
                    preview.summary.totalProgressRecords++;

                    const coinData = data.coinData || {};
                    preview.summary.totalCoins += (coinData.balance || 0);

                    if (data.updatedAt) {
                        const date = data.updatedAt.toDate ? data.updatedAt.toDate() : new Date(data.updatedAt.seconds * 1000);
                        if (!preview.summary.dateRange.start || date < preview.summary.dateRange.start) {
                            preview.summary.dateRange.start = date;
                        }
                        if (!preview.summary.dateRange.end || date > preview.summary.dateRange.end) {
                            preview.summary.dateRange.end = date;
                        }
                    }
                }
            } catch (error) {
                console.error(`Error fetching progress for ${studentId}:`, error);
            }
        }
    }

    if (dataTypes.includes('scores')) {
        for (const studentId of studentIds) {
            try {
                const scores = await teacherExportRepository.listScores(studentId);
                scores.forEach(score => {
                    preview.scores.push({ scoreId: score.id, ...score });
                    preview.summary.totalScores++;
                    if (score.gameId) {
                        preview.summary.gamesPlayed.add(score.gameId);
                    }
                });
            } catch (error) {
                console.error(`Error fetching scores for ${studentId}:`, error);
            }
        }
    }

    if (dataTypes.includes('userRoles')) {
        for (const studentId of studentIds) {
            try {
                const profile = await teacherExportRepository.getProfile(studentId);
                if (profile) {
                    preview.userRoles.push({ userId: studentId, ...profile });
                    preview.summary.totalRoles++;
                }
            } catch (error) {
                console.error(`Error fetching role for ${studentId}:`, error);
            }
        }
    }

    return preview;
}

export async function exportStudentProgress(studentIds) {
    const progressData = [];

    for (const studentId of studentIds) {
        try {
            const progress = await teacherExportRepository.getStudentProgress(studentId);
            if (progress) {
                progressData.push({
                    studentId: studentId,
                    ...progress
                });
            }
        } catch (error) {
            console.error(`Error exporting progress for ${studentId}:`, error);
        }
    }

    return progressData;
}

export async function exportScores(studentIds) {
    const allScores = [];

    for (const studentId of studentIds) {
        try {
            const scores = await teacherExportRepository.listScores(studentId);
            scores.forEach(score => {
                allScores.push({
                    scoreId: score.id,
                    ...score
                });
            });
        } catch (error) {
            console.error(`Error exporting scores for ${studentId}:`, error);
        }
    }

    return allScores;
}

export async function exportUserRoles(studentIds) {
    const rolesData = [];

    for (const studentId of studentIds) {
        try {
            const profile = await teacherExportRepository.getProfile(studentId);
            if (profile) {
                rolesData.push({
                    userId: studentId,
                    ...profile
                });
            }
        } catch (error) {
            console.error(`Error exporting role for ${studentId}:`, error);
        }
    }

    return rolesData;
}

export async function markExportComplete(dataTypes, studentIds, exportFormat) {
    const exportRecord = {
        timestamp: new Date().toISOString(),
        teacherId: this.currentUser?.uid || '',
        dataTypes: dataTypes,
        studentCount: studentIds.length,
        format: exportFormat,
        filename: `export-${Date.now()}.${exportFormat}`
    };

    localStorage.setItem('lastExport', JSON.stringify(exportRecord));

    const exportStatus = $('#export-status');
    const exportStatusText = $('#export-status-text');
    if (exportStatus && exportStatusText) {
        exportStatus.style.display = 'block';
        exportStatusText.textContent = `Export completed: ${exportRecord.filename}`;
    }

    this.enableResetSection();

    try {
        await teacherExportRepository.logExport({
            ...exportRecord,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('Error logging export:', error);
    }
}
