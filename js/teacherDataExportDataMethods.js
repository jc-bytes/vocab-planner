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

    const [studentProgress, scores, profiles] = await Promise.all([
        dataTypes.includes('studentProgress')
            ? teacherExportRepository.getStudentProgressBatch(studentIds)
            : [],
        dataTypes.includes('scores')
            ? teacherExportRepository.listScoresForUsers(studentIds)
            : [],
        dataTypes.includes('userRoles')
            ? teacherExportRepository.getProfiles(studentIds)
            : []
    ]);

    preview.studentProgress = studentProgress.map(progress => ({ studentId: progress.id, ...progress }));
    preview.summary.totalProgressRecords = preview.studentProgress.length;
    preview.studentProgress.forEach(data => {
        preview.summary.totalCoins += data.coinData?.balance || 0;
        const date = data.updatedAt?.toDate?.();
        if (!date) return;
        if (!preview.summary.dateRange.start || date < preview.summary.dateRange.start) {
            preview.summary.dateRange.start = date;
        }
        if (!preview.summary.dateRange.end || date > preview.summary.dateRange.end) {
            preview.summary.dateRange.end = date;
        }
    });

    preview.scores = scores.map(score => ({ scoreId: score.id, ...score }));
    preview.summary.totalScores = preview.scores.length;
    scores.forEach(score => {
        if (score.gameId) preview.summary.gamesPlayed.add(score.gameId);
    });

    preview.userRoles = profiles.map(profile => ({ userId: profile.userId, ...profile }));
    preview.summary.totalRoles = preview.userRoles.length;

    return preview;
}

export async function exportStudentProgress(studentIds) {
    const progressData = await teacherExportRepository.getStudentProgressBatch(studentIds);
    return progressData.map(progress => ({ studentId: progress.id, ...progress }));
}

export async function exportScores(studentIds) {
    const scores = await teacherExportRepository.listScoresForUsers(studentIds);
    return scores.map(score => ({ scoreId: score.id, ...score }));
}

export async function exportUserRoles(studentIds) {
    const profiles = await teacherExportRepository.getProfiles(studentIds);
    return profiles.map(profile => ({ userId: profile.userId, ...profile }));
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
