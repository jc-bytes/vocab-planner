import { imageDB } from '../db.js';
import { compressImageToWebp, dataUrlToBlob } from '../imageUtils.js';
import { studentApi as supabaseService } from '../services/studentApi.js';

class StudentActivityWordHuntMethods {
    async uploadWordHuntImage(word, blob, imageInfo = {}) {
        if (this.sm.authDisabled || !this.sm.currentUser) return null;

        const unitProgress = this.getCurrentUnitProgress();
        const path = supabaseService.buildWordHuntImagePath({
            userId: this.sm.currentUser.uid,
            schoolYear: unitProgress.schoolYear,
            trimesterKey: unitProgress.trimester,
            grade: unitProgress.grade,
            unitId: unitProgress.unitId,
            subjectSlug: unitProgress.subjectSlug,
            word
        });

        await supabaseService.uploadWordHuntImage({ path, blob });

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
        return supabaseService.downloadWordHuntImage(path);
    }

    async downloadWordHuntSubmission() {
        if (!this.sm.currentVocab) return;

        if (this.sm.activityInstance && typeof this.sm.activityInstance.getScore === 'function' && this.sm.currentActivityType) {
            this.sm.unitScores[this.sm.currentActivityType] = this.sm.activityInstance.getScore();
            this.sm.progress.saveLocalProgress();
        }

        const { ReportGenerator } = await import('../reportGenerator.js');
        await ReportGenerator.generateWordHuntReport(this.sm.studentProfile, this.sm.currentVocab, {
            wordHunt: this.sm.unitWordHunt || {},
            loadImage: path => this.loadWordHuntImage(path)
        });
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
                await imageDB.saveDrawing(unitName, word, imageData.blob);
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

export function installStudentActivityWordHuntMethods(StudentActivities) {
    for (const name of Object.getOwnPropertyNames(StudentActivityWordHuntMethods.prototype)) {
        if (name === 'constructor') continue;
        Object.defineProperty(
            StudentActivities.prototype,
            name,
            Object.getOwnPropertyDescriptor(StudentActivityWordHuntMethods.prototype, name)
        );
    }
}
