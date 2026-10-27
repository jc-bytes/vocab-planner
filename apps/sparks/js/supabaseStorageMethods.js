import {
    WORD_HUNT_IMAGE_BUCKET,
    getCurrentSchoolYear,
    slugifyStoragePart
} from './services/supabaseValues.js';

export function installSupabaseStorageMethods(supabaseService) {
    Object.assign(supabaseService, {
    buildWordHuntImagePath({
        assignmentId,
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

        if (!/^[0-9a-f-]{36}$/.test(assignmentId || '')) throw new Error('Open Word Hunt from a class assignment.');
        return `${assignmentId}/${userId}/${slugifyStoragePart(word, 'word')}.webp`;

    },

    async uploadWordHuntImage({ path, blob }, options = {}) {
        const owner = options.ownerUserId || this.currentUser?.uid;
        const assertCurrent = () => {
            options.signal?.throwIfAborted();
            if ((options.ownerUserId && owner !== this.currentUser?.uid) || (options.isCurrent && !options.isCurrent())) {
                throw new DOMException('Image owner changed.', 'AbortError');
            }
        };
        assertCurrent();
        await this.init();
        assertCurrent();
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
        assertCurrent();
        if (!data?.path) throw new Error('Word Hunt image upload was not confirmed.');
        return data.path;
    },

    async downloadWordHuntImage(path, options = {}) {
        options.signal?.throwIfAborted();
        await this.init();
        options.signal?.throwIfAborted();
        if (options.isCurrent && !options.isCurrent()) throw new DOMException('Image owner changed.', 'AbortError');
        if (!path) return null;

        const { data, error } = await this.client
            .storage
            .from(WORD_HUNT_IMAGE_BUCKET)
            .download(path, {}, { signal: options.signal });

        options.signal?.throwIfAborted();
        if (options.isCurrent && !options.isCurrent()) throw new DOMException('Image owner changed.', 'AbortError');
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
