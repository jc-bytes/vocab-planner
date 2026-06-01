import {
    CLASSROOM_ACTIVITY_IMAGE_BUCKET,
    CLASSROOM_ACTIVITY_IMAGE_MAX_BYTES,
    CLASSROOM_SCENE_BUCKET,
    CLASSROOM_SCENE_MAX_BYTES,
    EXTERNAL_ARTIFACT_ALLOWED_MIME_TYPES,
    EXTERNAL_ARTIFACT_BUCKET,
    EXTERNAL_ARTIFACT_MAX_BYTES,
    WORD_HUNT_IMAGE_BUCKET,
    getCurrentSchoolYear,
    slugifyStoragePart
} from './supabaseServiceHelpers.js';

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

    buildClassroomScenePath({
        studentId = this.currentUser?.uid,
        assignmentId = 'assignment',
        submissionId = 'submission'
    } = {}) {
        if (!studentId) {
            throw new Error('A signed-in student is required to save classroom activity scenes.');
        }

        return [
            studentId,
            'classroom-activities',
            slugifyStoragePart(assignmentId, 'assignment'),
            `${slugifyStoragePart(submissionId, 'submission')}.json`
        ].join('/');
    },

    buildClassroomActivityImagePath({
        teacherId = this.currentUser?.uid,
        activityId = 'activity',
        fileName = 'image'
    } = {}) {
        if (!teacherId) {
            throw new Error('A signed-in teacher is required to save classroom activity images.');
        }

        const baseName = String(fileName || 'image')
            .replace(/\.[^.]+$/, '')
            .trim() || 'image';

        return [
            teacherId,
            'classroom-activity-images',
            slugifyStoragePart(activityId, 'activity'),
            `${Date.now()}-${slugifyStoragePart(baseName, 'image')}.webp`
        ].join('/');
    },

    buildExternalArtifactPath({
        studentId = this.currentUser?.uid,
        assignmentId = 'assignment',
        submissionId = 'submission',
        fileName = 'artifact'
    } = {}) {
        if (!studentId) {
            throw new Error('A signed-in student is required to upload classroom evidence.');
        }

        const name = String(fileName || 'artifact').trim() || 'artifact';
        const extension = name.includes('.') ? name.slice(name.lastIndexOf('.') + 1).toLowerCase() : '';
        const baseName = name.replace(/\.[^.]+$/, '') || 'artifact';
        const safeExtension = ['png', 'jpg', 'jpeg', 'webp', 'pdf'].includes(extension) ? extension : 'bin';

        return [
            studentId,
            slugifyStoragePart(assignmentId, 'assignment'),
            slugifyStoragePart(submissionId, 'submission'),
            `${Date.now()}-${slugifyStoragePart(baseName, 'artifact')}.${safeExtension}`
        ].join('/');
    },

    serializeClassroomScene(scene) {
        const text = JSON.stringify(scene || null);
        const blob = new Blob([text], { type: 'application/json' });
        if (blob.size > CLASSROOM_SCENE_MAX_BYTES) {
            throw new Error('Classroom activity scenes must be under 1 MB.');
        }
        return { blob, sizeBytes: blob.size };
    },

    async uploadClassroomScene({ path, scene }) {
        await this.init();
        if (!this.currentUser) {
            throw new Error('You must be signed in to upload classroom activity scenes.');
        }
        if (!path) {
            throw new Error('A Storage path is required for classroom activity scene upload.');
        }

        const { blob, sizeBytes } = this.serializeClassroomScene(scene);
        const { data, error } = await this.client
            .storage
            .from(CLASSROOM_SCENE_BUCKET)
            .upload(path, blob, {
                cacheControl: '3600',
                contentType: 'application/json',
                upsert: true
            });

        if (error) throw error;
        return {
            path: data?.path || path,
            sizeBytes,
            updatedAt: new Date().toISOString()
        };
    },

    async downloadClassroomScene(path) {
        await this.init();
        if (!path) return null;

        const { data, error } = await this.client
            .storage
            .from(CLASSROOM_SCENE_BUCKET)
            .download(path);

        if (error) {
            const message = String(error.message || '').toLowerCase();
            if (error.statusCode === 404 || message.includes('not found')) {
                return null;
            }
            throw error;
        }

        const text = await data.text();
        return text ? JSON.parse(text) : null;
    },

    async deleteClassroomScene(path) {
        await this.init();
        if (!path) return;

        const { error } = await this.client
            .storage
            .from(CLASSROOM_SCENE_BUCKET)
            .remove([path]);

        if (error) throw error;
    },

    async uploadClassroomActivityImage({ path, blob }) {
        await this.init();
        if (!this.currentUser) {
            throw new Error('You must be signed in to upload classroom activity images.');
        }
        if (!path) {
            throw new Error('A Storage path is required for classroom activity image upload.');
        }
        if (!blob || blob.size > CLASSROOM_ACTIVITY_IMAGE_MAX_BYTES) {
            throw new Error('Classroom activity images must be WebP files under 1 MB.');
        }

        const { data, error } = await this.client
            .storage
            .from(CLASSROOM_ACTIVITY_IMAGE_BUCKET)
            .upload(path, blob, {
                cacheControl: '3600',
                contentType: 'image/webp',
                upsert: true
            });

        if (error) throw error;
        return {
            path: data?.path || path,
            sizeBytes: blob.size,
            updatedAt: new Date().toISOString()
        };
    },

    async getClassroomActivityImageUrl(path, expiresIn = 60 * 60) {
        await this.init();
        if (!path) return '';

        const { data, error } = await this.client
            .storage
            .from(CLASSROOM_ACTIVITY_IMAGE_BUCKET)
            .createSignedUrl(path, expiresIn);

        if (error) throw error;
        return data?.signedUrl || data?.signedURL || '';
    },

    async deleteClassroomActivityImage(path) {
        await this.init();
        if (!path) return;

        const { error } = await this.client
            .storage
            .from(CLASSROOM_ACTIVITY_IMAGE_BUCKET)
            .remove([path]);

        if (error) throw error;
    },

    async uploadExternalArtifact({ path, file }) {
        await this.init();
        if (!this.currentUser) {
            throw new Error('You must be signed in to upload classroom evidence.');
        }
        if (!path) {
            throw new Error('A Storage path is required for classroom evidence upload.');
        }
        if (!file || file.size > EXTERNAL_ARTIFACT_MAX_BYTES) {
            throw new Error('Evidence files must be 5 MB or smaller.');
        }
        const mimeType = String(file.type || '').toLowerCase();
        if (!EXTERNAL_ARTIFACT_ALLOWED_MIME_TYPES.includes(mimeType)) {
            throw new Error('Evidence must be a PNG, JPG, WebP, or PDF file.');
        }

        const { data, error } = await this.client
            .storage
            .from(EXTERNAL_ARTIFACT_BUCKET)
            .upload(path, file, {
                cacheControl: '3600',
                contentType: mimeType,
                upsert: true
            });

        if (error) throw error;
        return {
            storagePath: data?.path || path,
            fileName: file.name || 'Uploaded artifact',
            mimeType,
            sizeBytes: file.size,
            uploadedAt: new Date().toISOString()
        };
    },

    async getExternalArtifactUrl(path, expiresIn = 60 * 60) {
        await this.init();
        if (!path) return '';

        const { data, error } = await this.client
            .storage
            .from(EXTERNAL_ARTIFACT_BUCKET)
            .createSignedUrl(path, expiresIn);

        if (error) throw error;
        return data?.signedUrl || data?.signedURL || '';
    },

    async deleteExternalArtifact(path) {
        await this.init();
        if (!path) return;

        const { error } = await this.client
            .storage
            .from(EXTERNAL_ARTIFACT_BUCKET)
            .remove([path]);

        if (error) throw error;
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

    async deleteWordHuntImage(path) {
        await this.init();
        if (!path) return;

        const { error } = await this.client
            .storage
            .from(WORD_HUNT_IMAGE_BUCKET)
            .remove([path]);

        if (error) throw error;
    },
    });
}
