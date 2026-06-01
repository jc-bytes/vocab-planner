import { $ } from './main.js';
import {
    teacherApi as supabaseService,
    addDoc,
    collection,
    doc,
    getDoc,
    getDocs,
    query,
    serverTimestamp,
    where
} from './services/teacherApi.js';

export async function fetchPreviewData(studentIds, dataTypes) {
    const db = supabaseService.getDatabase();
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
                const docRef = doc(db, 'studentProgress', studentId);
                const docSnap = await getDoc(docRef);
                if (docSnap.exists()) {
                    const data = { studentId, ...docSnap.data() };
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
        const scoresRef = collection(db, 'scores');
        for (const studentId of studentIds) {
            try {
                const q = query(scoresRef, where('userId', '==', studentId));
                const snapshot = await getDocs(q);
                snapshot.forEach(doc => {
                    preview.scores.push({ scoreId: doc.id, ...doc.data() });
                    preview.summary.totalScores++;
                    if (doc.data().gameId) {
                        preview.summary.gamesPlayed.add(doc.data().gameId);
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
                const docRef = doc(db, 'userRoles', studentId);
                const docSnap = await getDoc(docRef);
                if (docSnap.exists()) {
                    preview.userRoles.push({ userId: studentId, ...docSnap.data() });
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
    const db = supabaseService.getDatabase();
    const progressData = [];

    for (const studentId of studentIds) {
        try {
            const docRef = doc(db, 'studentProgress', studentId);
            const docSnap = await getDoc(docRef);
            if (docSnap.exists()) {
                progressData.push({
                    studentId: studentId,
                    ...docSnap.data()
                });
            }
        } catch (error) {
            console.error(`Error exporting progress for ${studentId}:`, error);
        }
    }

    return progressData;
}

export async function exportScores(studentIds) {
    const db = supabaseService.getDatabase();
    const scoresRef = collection(db, 'scores');
    const allScores = [];

    for (const studentId of studentIds) {
        try {
            const q = query(scoresRef, where('userId', '==', studentId));
            const snapshot = await getDocs(q);
            snapshot.forEach(doc => {
                allScores.push({
                    scoreId: doc.id,
                    ...doc.data()
                });
            });
        } catch (error) {
            console.error(`Error exporting scores for ${studentId}:`, error);
        }
    }

    return allScores;
}

export async function exportUserRoles(studentIds) {
    const db = supabaseService.getDatabase();
    const rolesData = [];

    for (const studentId of studentIds) {
        try {
            const docRef = doc(db, 'userRoles', studentId);
            const docSnap = await getDoc(docRef);
            if (docSnap.exists()) {
                rolesData.push({
                    userId: studentId,
                    ...docSnap.data()
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
        const db = supabaseService.getDatabase();
        await addDoc(collection(db, 'exportLogs'), {
            ...exportRecord,
            timestamp: serverTimestamp()
        });
    } catch (error) {
        console.error('Error logging export:', error);
    }
}
