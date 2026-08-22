import { imageDB } from '../db.js';
import { compressImageToWebp, dataUrlToBlob } from '../imageUtils.js';
import { $, notifications } from '../main.js';
import { studentApi } from '../services/studentApi.js';
import {
    getActiveStudentStorageOwner,
    readStudentJson
} from './persistence/studentStorage.js';

export class StudentActivityWordHunt {
    constructor(activities) {
        this.activities = activities;
        this.sm = activities.sm;
        this.wordHuntExportInProgress = false;
    }

    getCurrentUnitProgress(...args) {
        return this.activities.getCurrentUnitProgress(...args);
    }

    async uploadWordHuntImage(word, blob, imageInfo = {}) {
        if (this.sm.authDisabled || !this.sm.currentUser) return null;

        const unitProgress = this.getCurrentUnitProgress();
        const path = studentApi.buildWordHuntImagePath({
            userId: this.sm.currentUser.uid,
            schoolYear: unitProgress.schoolYear,
            trimesterKey: unitProgress.trimester,
            grade: unitProgress.grade,
            unitId: unitProgress.unitId,
            subjectSlug: unitProgress.subjectSlug,
            word
        });

        await studentApi.uploadWordHuntImage({ path, blob });

        const now = new Date().toISOString();
        return {
            hasImage: true,
            imagePath: path,
            imageSizeBytes: imageInfo.sizeBytes || blob.size,
            imageWidth: imageInfo.width || null,
            imageHeight: imageInfo.height || null,
            imageUpdatedAt: now,
            updatedAt: now,
            pendingImageUpload: false
        };
    }

    async loadWordHuntImage(path) {
        if (this.sm.authDisabled || !path) return null;
        return studentApi.downloadWordHuntImage(path);
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
        const unitProgress = this.getCurrentUnitProgress();
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
        if (window.lucide?.createIcons) window.lucide.createIcons({ root: button });
    }

    async downloadWordHuntSubmission() {
        if (!this.sm.currentVocab) return;
        if (this.wordHuntExportInProgress) return;

        this.wordHuntExportInProgress = true;
        this.setWordHuntExportButtonState(true);

        try {
            if (this.sm.activityInstance && typeof this.sm.activityInstance.getScore === 'function' && this.sm.currentActivityType) {
                this.sm.unitScores[this.sm.currentActivityType] = this.sm.activityInstance.getScore();
                this.sm.progress.saveLocalProgress();
            }

            const wordHunt = this.getReportWordHuntEntries();
            const unitProgress = this.getCurrentUnitProgress();
            const { ReportGenerator } = await import('../reportGenerator.js');
            await ReportGenerator.generateWordHuntReport(this.sm.studentProfile, this.sm.currentVocab, {
                wordHunt,
                trimester: unitProgress?.trimester || '',
                ownerUserId: this.sm.currentUser?.uid || getActiveStudentStorageOwner(),
                loadImage: path => this.loadWordHuntImage(path)
            });
        } catch (error) {
            console.error('Failed to export Word Hunt PDF:', error);
            notifications.error('Could not export Word Hunt PDF.');
        } finally {
            this.wordHuntExportInProgress = false;
            this.setWordHuntExportButtonState(false);
        }
    }

    async migrateLegacyWordHuntImages() {
        if (this.sm.authDisabled || !this.sm.currentUser || !this.sm.currentVocab) return;

        const unitName = this.sm.currentVocab.name;
        const unitProgress = this.getCurrentUnitProgress();
        const images = unitProgress.images || {};
        const wordHunt = unitProgress.wordHunt || {};
        let changed = false;

        for (const [word, dataUrl] of Object.entries(images)) {
            if (typeof dataUrl !== 'string' || !dataUrl.startsWith('data:image/')) continue;

            const existingEntry = wordHunt[word] || {};
            if (existingEntry.imagePath) {
                delete images[word];
                changed = true;
                continue;
            }

            try {
                const sourceBlob = await dataUrlToBlob(dataUrl);
                const imageData = await compressImageToWebp(sourceBlob);
                await imageDB.saveDrawing(unitName, word, imageData.blob, {
                    ownerUserId: this.sm.currentUser.uid
                });
                const metadata = await this.uploadWordHuntImage(word, imageData.blob, imageData);
                wordHunt[word] = {
                    ...existingEntry,
                    ...metadata,
                    hasImage: true,
                    updatedAt: metadata?.updatedAt || new Date().toISOString()
                };
                delete images[word];
                changed = true;
            } catch (error) {
                console.warn('Could not migrate legacy Word Hunt image:', unitName, word, error);
            }
        }

        if (changed) {
            unitProgress.images = images;
            unitProgress.wordHunt = wordHunt;
            this.sm.unitImages = images;
            this.sm.unitWordHunt = wordHunt;
            this.sm.progress.saveLocalProgress();
        }
    }

    handleIllustrationSave(vocabName, word, payload) {
        const unitName = vocabName || (this.sm.currentVocab ? this.sm.currentVocab.name : null);
        if (!unitName) return;
        const unitProgress = this.sm.currentVocab && this.sm.currentVocab.name === unitName
            ? this.getCurrentUnitProgress()
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

        if (this.sm.currentVocab && this.sm.currentVocab.name === unitName) {
            this.sm.unitImages = unitProgress.images;
            this.sm.unitWordHunt = unitProgress.wordHunt;
        }
        this.sm.progress.saveLocalProgress();
    }
}
