import { captureStudentReport } from './studentReportSession.js';
import { $, notifications, refreshIcons } from '../main.js';
import { requestWithTimeout } from '../services/requestReliability.js';
import { schoolContext } from '../services/schoolContext.js';
import {
    getActiveStudentStorageOwner,
    readStudentJson
} from './persistence/studentStorage.js';

export class StudentActivityWordHunt {
    constructor(activities, { loadIO = () => import('./studentWordHuntEvidenceIO.js'), timeoutMs = 30000 } = {}) {
        this.activities = activities;
        this.sm = activities.sm;
        this.wordHuntExportInProgress = false;
        this.loadIO = loadIO;
        this.timeoutMs = timeoutMs;
        this.ioPromise = null;
    }

    captureEvidenceScope({ migration = false } = {}) {
        const sm = this.sm, user = sm.currentUser, vocab = sm.currentVocab;
        const unit = this.activities.progressFlow.getCurrentUnitProgress();
        const unitName = vocab ? this.activities.getUnitProgressKey(vocab) : null;
        const session = this.activities.session, load = session?.vocabularyLoadId;
        const cloud = sm.progress?.cloud, cloudGeneration = cloud?.cloudGeneration;
        const persistence = this.activities.progressPersistence, reset = persistence?.runtimeGeneration;
        const school = schoolContext.getGeneration(), mode = sm.authDisabled;
        const ownerUserId = user?.uid || user?.id;
        const pathContext = { userId: ownerUserId, assignmentId: vocab?.assignmentId,
            schoolYear: unit?.schoolYear, trimesterKey: unit?.trimester, grade: unit?.grade,
            unitId: unit?.unitId, subjectSlug: unit?.subjectSlug };
        const assertCurrent = () => {
            if (user !== sm.currentUser || ownerUserId !== (sm.currentUser?.uid || sm.currentUser?.id)
                || mode !== sm.authDisabled || vocab !== sm.currentVocab || pathContext.assignmentId !== sm.currentVocab?.assignmentId
                || unitName !== (sm.currentVocab ? this.activities.getUnitProgressKey(sm.currentVocab) : null)
                || session !== this.activities.session || load !== session?.vocabularyLoadId
                || cloud !== sm.progress?.cloud || cloudGeneration !== cloud?.cloudGeneration
                || reset !== persistence?.runtimeGeneration || school !== schoolContext.getGeneration()
                || (migration && sm.progressData?.units && (sm.progressData.units[unitName]?.images !== unit?.images
                    || sm.progressData.units[unitName]?.wordHunt !== unit?.wordHunt))) {
                throw new DOMException('The account, school, or assignment changed.', 'AbortError');
            }
        };
        return { ownerUserId, storageOwnerUserId: ownerUserId || getActiveStudentStorageOwner(), unit, unitName, pathContext, authDisabled: mode, assertCurrent,
            signal: persistence?.runtimeController?.signal,
            saveLocal: () => { assertCurrent(); sm.unitImages = unit.images; sm.unitWordHunt = unit.wordHunt; sm.progress.saveLocalProgress(); } };
    }

    async runEvidenceIO(scope, operation) {
        return requestWithTimeout(async signal => {
            const assertCurrent = () => { signal.throwIfAborted(); scope.assertCurrent(); };
            assertCurrent();
            if (!this.ioPromise) {
                const pending = Promise.resolve().then(() => this.loadIO())
                    .catch(error => { if (this.ioPromise === pending) this.ioPromise = null; throw error; });
                this.ioPromise = pending;
            }
            const pending = this.ioPromise;
            signal.addEventListener('abort', () => { if (this.ioPromise === pending) this.ioPromise = null; }, { once: true });
            const module = await pending;
            assertCurrent();
            this.io ||= module.createWordHuntEvidenceIO();
            return operation(this.io, { ...scope, signal, assertCurrent });
        }, { signal: scope.signal, timeoutMs: this.timeoutMs, label: 'Word Hunt evidence' });
    }

    async uploadWordHuntImage(word, blob, imageInfo = {}) {
        if (this.sm.authDisabled || !this.sm.currentUser) return null;
        const scope = this.captureEvidenceScope();
        return this.runEvidenceIO(scope, (io, owned) => io.uploadImage(owned, word, blob, imageInfo));
    }

    async loadWordHuntImage(path) {
        if (this.sm.authDisabled || !path) return null;
        const scope = this.captureEvidenceScope();
        return this.runEvidenceIO(scope, (io, owned) => io.loadImage(owned, path));
    }

    getLocalWordHuntEntries(vocab = this.sm.currentVocab) {
        if (!vocab?.name || !Array.isArray(vocab.words)) return {};

        try {
            return readStudentJson(`word-hunt:${vocab.name}:${vocab.words.length}`, {}, {
                owner: this.sm.currentUser?.uid || getActiveStudentStorageOwner(),
                legacyKeys: [`word_hunt_state_${vocab.name}_${vocab.words.length}`]
            });
        } catch (error) {
            console.warn('Could not read local Word Hunt draft entries:', error);
            return {};
        }
    }

    mergeWordHuntEntry(base = {}, next = {}) {
        const merged = { ...base };
        Object.entries(next || {}).forEach(([key, value]) => {
            if (value === '' || value === null || value === undefined) return;
            if (typeof value === 'boolean' && value === false && merged[key]) return;
            merged[key] = value;
        });
        return merged;
    }

    mergeWordHuntEntryMaps(...maps) {
        return maps.reduce((merged, map) => {
            Object.entries(map || {}).forEach(([word, entry]) => {
                merged[word] = this.mergeWordHuntEntry(merged[word], entry);
            });
            return merged;
        }, {});
    }

    getReportWordHuntEntries() {
        const unitProgress = this.activities.progressFlow.getCurrentUnitProgress();
        const progressEntries = unitProgress?.wordHunt || {};
        const localEntries = this.getLocalWordHuntEntries(this.sm.currentVocab);
        const liveEntries = this.sm.activityInstance && typeof this.sm.activityInstance.getWordHuntEntries === 'function'
            ? this.sm.activityInstance.getWordHuntEntries()
            : {};
        const merged = this.mergeWordHuntEntryMaps(progressEntries, localEntries, liveEntries);

        if (unitProgress) {
            unitProgress.wordHunt = merged;
            this.sm.unitWordHunt = merged;
            this.sm.progress.saveLocalProgress();
        }

        return merged;
    }

    setWordHuntExportButtonState(isExporting = false) {
        const button = $('#download-word-hunt-btn');
        if (!button) return;

        button.disabled = isExporting;
        button.setAttribute('aria-busy', isExporting ? 'true' : 'false');
        button.innerHTML = isExporting
            ? '<i data-lucide="loader-circle"></i><span>Generating PDF...</span>'
            : '<i data-lucide="file-down"></i><span>Word Hunt PDF</span>';
        refreshIcons(button);
    }

    async downloadWordHuntSubmission() {
        if (!this.sm.currentVocab) return;
        const scope = this.captureEvidenceScope();
        if (this.wordHuntExportInProgress) {
            try { this.exportScope?.assertCurrent(); return; } catch { /* The old export no longer owns this page. */ }
        }
        this.exportScope = scope;
        this.wordHuntExportInProgress = true;
        this.setWordHuntExportButtonState(true);

        try {
            if (this.sm.activityInstance && typeof this.sm.activityInstance.getScore === 'function' && this.sm.currentActivityType) {
                this.sm.unitScores[this.sm.currentActivityType] = this.sm.activityInstance.getScore();
                this.sm.progress.saveLocalProgress();
            }

            const report = captureStudentReport(this.sm, {
                wordHunt: this.getReportWordHuntEntries(),
                trimester: this.activities.progressFlow.getCurrentUnitProgress()?.trimester || ''
            });
            await this.runEvidenceIO(scope, (io, owned) => io.exportReport(owned, report, path => this.loadWordHuntImage(path)));
        } catch (error) {
            let current = true;
            try { scope.assertCurrent(); } catch { current = false; }
            if (current && error.name !== 'AbortError' && error.code !== 'REQUEST_ABORTED') {
                console.error('Failed to export Word Hunt PDF:', error);
                notifications.error('Could not export Word Hunt PDF.');
            }
        } finally {
            if (this.exportScope === scope) {
                this.wordHuntExportInProgress = false;
                this.exportScope = null;
                try { scope.assertCurrent(); this.setWordHuntExportButtonState(false); } catch { /* Stale exports cannot update replacement UI. */ }
            }
        }
    }

    async migrateLegacyWordHuntImages() {
        if (this.sm.authDisabled || !this.sm.currentUser || !this.sm.currentVocab) return;
        const scope = this.captureEvidenceScope({ migration: true });
        if (!Object.values(scope.unit.images || {}).some(value => typeof value === 'string' && value.startsWith('data:image/'))) return;
        if (this.migration?.scope.unitName === scope.unitName
            && this.migration.scope.unit.images === scope.unit.images
            && this.migration.scope.unit.wordHunt === scope.unit.wordHunt) {
            try { this.migration.scope.assertCurrent(); return this.migration.promise; } catch { /* New scope can retry independently. */ }
        }
        const record = { scope };
        record.promise = this.runEvidenceIO(scope, (io, owned) => io.migrateLegacyImages(owned)).catch(error => {
            if (error.name !== 'AbortError' && error.code !== 'REQUEST_ABORTED') {
                console.warn('Could not migrate legacy Word Hunt images:', error);
            }
        }).finally(() => { if (this.migration === record) this.migration = null; });
        this.migration = record;
        return record.promise;
    }

    handleIllustrationSave(vocabName, word, payload) {
        const unitName = vocabName || (this.sm.currentVocab ? this.activities.getUnitProgressKey(this.sm.currentVocab) : null);
        if (!unitName) return;
        const unitProgress = this.sm.currentVocab && this.activities.getUnitProgressKey(this.sm.currentVocab) === unitName
            ? this.activities.progressFlow.getCurrentUnitProgress()
            : (this.sm.progressData.units?.[unitName] || null);
        if (!unitProgress) return;

        if (!unitProgress.images) unitProgress.images = {};
        if (!unitProgress.wordHunt) unitProgress.wordHunt = {};

        if (typeof payload === 'string') {
            console.warn('Ignored legacy base64 Word Hunt image payload.');
        } else if (payload && typeof payload === 'object') {
            if (payload.entry) {
                unitProgress.wordHunt[word] = payload.entry;

                if (payload.entry.imagePath && typeof unitProgress.images[word] === 'string') {
                    delete unitProgress.images[word];
                }
            }
        }

        if (this.sm.currentVocab && this.activities.getUnitProgressKey(this.sm.currentVocab) === unitName) {
            this.sm.unitImages = unitProgress.images;
            this.sm.unitWordHunt = unitProgress.wordHunt;
        }
        this.sm.progress.saveLocalProgress();
    }
}
