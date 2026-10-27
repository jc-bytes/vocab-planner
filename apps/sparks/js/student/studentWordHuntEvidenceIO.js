import { imageDB } from '../db.js';
import { studentApi } from '../services/studentApi.js';

// All operations receive a captured scope; none resolve their owner/unit from live UI state.
export function createWordHuntEvidenceIO({ imageStore = imageDB, api = studentApi,
    loadImages = () => import('../imageUtils.js'), loadReports = () => import('../reportGenerator.js') } = {}) {
    const storageOptions = scope => ({ ownerUserId: scope.ownerUserId, signal: scope.signal,
        isCurrent: () => { scope.assertCurrent(); return true; } });
    const uploadImage = async (scope, word, blob, imageInfo = {}) => {
        scope.assertCurrent();
        const path = api.buildWordHuntImagePath({ ...scope.pathContext, word });
        const saved = await api.uploadWordHuntImage({ path, blob }, storageOptions(scope));
        scope.assertCurrent();
        if (saved !== path) throw new Error('Word Hunt image upload was not confirmed.');
        const now = new Date().toISOString();
        return { hasImage: true, imagePath: path, imageSizeBytes: imageInfo.sizeBytes || blob.size,
            imageWidth: imageInfo.width || null, imageHeight: imageInfo.height || null,
            imageUpdatedAt: now, updatedAt: now, pendingImageUpload: false };
    };
    return Object.freeze({
        uploadImage,
        async loadImage(scope, path) {
            scope.assertCurrent();
            const blob = await api.downloadWordHuntImage(path, storageOptions(scope));
            scope.assertCurrent();
            return blob;
        },
        async exportReport(scope, report, loadImage) {
            const { ReportGenerator } = await loadReports();
            scope.assertCurrent(); report.assertCurrent();
            await ReportGenerator.generateWordHuntReport(report.profile, report.vocabulary, {
                wordHunt: report.wordHunt, trimester: report.trimester, ownerUserId: scope.storageOwnerUserId,
                assertCurrent: () => { scope.assertCurrent(); report.assertCurrent(); },
                loadImage: path => { scope.assertCurrent(); report.assertCurrent(); return loadImage(path); }
            });
            scope.assertCurrent();
        },
        async migrateLegacyImages(scope) {
            const unit = scope.unit, images = unit.images || {}, entries = unit.wordHunt ||= {};
            for (const [word, dataUrl] of Object.entries(images)) {
                scope.assertCurrent();
                if (typeof dataUrl !== 'string' || !dataUrl.startsWith('data:image/')) continue;
                const entry = entries[word];
                const revision = value => JSON.stringify([value?.imagePath, value?.imageUpdatedAt, value?.updatedAt, value?.hasImage, value?.pendingImageUpload]);
                const entryRevision = revision(entry);
                const imageScope = { ...scope, assertCurrent() {
                    scope.assertCurrent();
                    if (unit.images !== images || images[word] !== dataUrl || unit.wordHunt !== entries
                        || entries[word] !== entry || revision(entries[word]) !== entryRevision) {
                        throw new DOMException('A newer Word Hunt image or entry replaced this migration.', 'AbortError');
                    }
                } };
                try {
                    let image;
                    if (entry?.imagePath) {
                        // Confirm the captured remote image instead of overwriting it with older base64.
                        if (entry.imagePath !== api.buildWordHuntImagePath({ ...scope.pathContext, word })) continue;
                        const blob = await api.downloadWordHuntImage(entry.imagePath, storageOptions(imageScope));
                        imageScope.assertCurrent();
                        if (!blob) continue;
                        await imageStore.saveDrawing(scope.unitName, word, blob, storageOptions(imageScope));
                        imageScope.assertCurrent();
                    } else {
                        const { compressImageToWebp, dataUrlToBlob } = await loadImages();
                        imageScope.assertCurrent();
                        const source = await dataUrlToBlob(dataUrl);
                        imageScope.assertCurrent();
                        image = await compressImageToWebp(source);
                        imageScope.assertCurrent();
                        await imageStore.saveDrawing(scope.unitName, word, image.blob, storageOptions(imageScope));
                        imageScope.assertCurrent();
                        const metadata = await uploadImage(imageScope, word, image.blob, image);
                        imageScope.assertCurrent();
                        entries[word] = { ...(entries[word] || {}), ...metadata };
                    }
                    delete images[word];
                    scope.saveLocal();
                } catch (error) {
                    scope.assertCurrent();
                    if (error.name !== 'AbortError') console.warn('Could not migrate legacy Word Hunt image:', scope.unitName, word, error);
                }
            }
        }
    });
}
