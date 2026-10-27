import { StudentActivities } from './studentActivities.js';
import { getStudentActivity } from './studentActivityRegistry.js';
import { imageDB } from '../db.js';
import { setActiveStudentStorageOwner, setStudentActivityAssignment } from './persistence/studentStorage.js';
import { refreshIcons, notifications } from '../main.js';
import { captureStudentReport } from './studentReportSession.js';
import { mountPreviewDocument } from './teacherPreviewDocument.js';

export async function mountTeacherUnitPreview(vocab, subjects = [], initialActivity) {
    await mountPreviewDocument(['activity-menu-view', 'activity-view']);
    const owner = `teacher-preview-${crypto.randomUUID()}`;
    setActiveStudentStorageOwner(owner);
    setStudentActivityAssignment(owner);
    const drawings = new Map();
    imageDB.saveDrawing = async (unit, word, blob) => { drawings.set(`${unit}_${word}`, blob); };
    imageDB.getDrawing = async (unit, word) => drawings.get(`${unit}_${word}`) || null;
    imageDB.deleteDrawing = async (unit, word) => { drawings.delete(`${unit}_${word}`); };
    imageDB.getAllKeys = async () => [...drawings.keys()];

    const sm = {
        currentUser: null, authDisabled: false, isTeacherUnitPreview: true, subjects, progressData: { units: {} },
        studentProfile: { firstName: 'Teacher', name: 'Teacher preview', section: vocab.activitySettings?.sections?.[0] || '', grade: String(vocab.grades?.[0] || vocab.grade || '') },
        getVocabRouteId: value => value.id || value.name,
        getCurrentVocabRouteId: () => sm.getVocabRouteId(sm.currentVocab),
        isKnownActivityType: type => Boolean(getStudentActivity(type)),
        setRoute() {},
        progress: { saveLocalProgress() {} },
        switchView(id) {
            document.querySelectorAll('.view').forEach(view => view.classList.toggle('hidden', view.id !== id));
            window.scrollTo(0, 0);
        },
        async navigateTo(route) {
            if (initialActivity === 'quiz' && route.view !== 'activity') {
                parent.postMessage({ type: 'teacher-unit-preview-close' }, location.origin); return;
            }
            if (route.view === 'activity') return activities.startActivity(route.activityType, { fromRoute: true });
            activities.session.cancelActivityLaunch();
            activities.session.destroyActivityInstance();
            await activities.showActivityMenu({ fromRoute: true });
        }
    };
    const activities = sm.activities = new StudentActivities(sm);
    for (const key of ['currentVocab', 'currentActivityType', 'activityInstance', 'unitScores', 'unitStates', 'unitImages', 'unitWordHunt']) {
        Object.defineProperty(sm, key, { get: () => activities.session[key], set: value => { activities.session[key] = value; } });
    }
    sm.currentVocab = structuredClone(vocab);
    const unit = activities.getCurrentUnitProgress();
    sm.unitScores = unit.scores; sm.unitStates = unit.states;
    sm.unitImages = unit.images; sm.unitWordHunt = unit.wordHunt;
    // Keep the real scoring, gating, state restoration and UI, replacing only writes.
    activities.progressPersistence.startVerifiedActivityAttempt = async () => null;
    activities.progressPersistence.reportActiveTime = async () => null;
    activities.progressPersistence.syncActivityProgressToCloud = async () => null;
    activities.uploadWordHuntImage = async () => null;
    activities.loadWordHuntImage = async () => null;
    activities.updateArcadeGateDisplay = () => {};
    activities.coverage.initWordCoverage();
    document.querySelector('#activity-menu-view .activities-grid').addEventListener('click', event => {
        const card = event.target.closest('[data-activity]');
        if (card && !card.disabled) activities.startActivity(card.dataset.activity);
    });
    for (const id of ['back-to-menu-btn', 'close-activity-btn']) {
        document.getElementById(id)?.addEventListener('click', () => sm.navigateTo({ view: 'unit' }));
    }
    document.getElementById('back-to-vocab')?.addEventListener('click', () => parent.postMessage({ type: 'teacher-unit-preview-close' }, location.origin));
    document.getElementById('download-word-hunt-btn')?.addEventListener('click', () => activities.downloadWordHuntSubmission());
    document.getElementById('generate-final-report-btn')?.addEventListener('click', async event => {
        const button = event.currentTarget;
        if (button.disabled) return;
        button.disabled = true;
        try {
            const report = captureStudentReport(sm, { scores: sm.unitScores,
                wordHunt: activities.getReportWordHuntEntries(), trimester: unit.trimester });
            const { ReportGenerator } = await import('../reportGenerator.js');
            report.assertCurrent();
            await ReportGenerator.generateReport(report.profile, report.vocabulary, report.scores, {
                wordHunt: report.wordHunt, trimester: report.trimester, ownerUserId: owner,
                assertCurrent: report.assertCurrent, loadImage: async () => null
            });
        } catch (error) { notifications.error(error.message || 'Could not export preview.'); }
        finally { button.disabled = false; }
    });
    document.getElementById('completed-activity-export-options')?.addEventListener('click', event => {
        const button = event.target.closest('[data-activity-pdf-export]');
        if (button) activities.downloadCompletedActivityReport(button.dataset.activityPdfExport);
    });
    window.addEventListener('pagehide', () => {
        activities.session.cancelActivityLaunch(); activities.session.destroyActivityInstance();
    }, { once: true });
    if (initialActivity === 'quiz') {
        // A quiz preview opens the exercise directly; it has no unit prerequisites.
        const unlocked = activities.isActivityUnlocked.bind(activities);
        activities.isActivityUnlocked = type => type === 'quiz' || unlocked(type);
        await activities.startActivity('quiz', { fromRoute: true });
    } else await activities.showActivityMenu({ fromRoute: true });
    refreshIcons();
    window.teacherUnitPreview = sm;
}
