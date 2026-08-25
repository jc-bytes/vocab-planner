import {
    WORD_HUNT_IMAGE_BUCKET,
    getCurrentSchoolYear,
    slugifyStoragePart
} from './services/supabaseValues.js';

export function installSupabaseStorageMethods(supabaseService) {
    Object.assign(supabaseService, {
    buildWordHuntImagePath({
        userId = this.currentUser?.uid,
        schoolYear = getCurrentSchoolYear(),
        trimesterKey = 'other',
        grade = 'unknown',
        unitId = 'unit',
        subjectSlug = 'technology',
        word = 'word'
    } = {}) {
        if (!userId) {
            throw new Error('A signed-in student is required to save Word Hunt images.');
        }

        return [
            userId,
            slugifyStoragePart(schoolYear, 'year'),
            slugifyStoragePart(trimesterKey, 'trimester'),
            `subject-${slugifyStoragePart(subjectSlug, 'technology')}`,
            `grade-${slugifyStoragePart(grade, 'unknown')}`,
            slugifyStoragePart(unitId, 'unit'),
            `${slugifyStoragePart(word, 'word')}.webp`
        ].join('/');
    },

    async uploadWordHuntImage({ path, blob }) {
        await this.init();
        if (!this.currentUser) {
            throw new Error('You must be signed in to upload a Word Hunt image.');
        }
        if (!path) {
            throw new Error('A Storage path is required for Word Hunt image upload.');
        }
        if (!blob || blob.size > 65536) {
            throw new Error('Word Hunt images must be WebP thumbnails under 64 KB.');
        }

        const { data, error } = await this.client
            .storage
            .from(WORD_HUNT_IMAGE_BUCKET)
            .upload(path, blob, {
                cacheControl: '3600',
                contentType: 'image/webp',
                upsert: true
            });

        if (error) throw error;
        return data?.path || path;
    },

    async downloadWordHuntImage(path) {
        await this.init();
        if (!path) return null;

        const { data, error } = await this.client
            .storage
            .from(WORD_HUNT_IMAGE_BUCKET)
            .download(path);

        if (error) {
            const message = String(error.message || '').toLowerCase();
            if (error.statusCode === 404 || message.includes('not found')) {
                return null;
            }
            throw error;
        }

        return data;
    },
    });
}
