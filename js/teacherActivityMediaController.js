import { notifications } from './main.js';
import { teacherApi as supabaseService } from './services/teacherApi.js';
import { normalizeImageHotspotTemplate } from './activityImageHotspot.js';
import { compressImageToWebp } from './imageUtils.js';

export async function resolveTeacherActivityImageUrl(manager, path) {
    if (!path) return '';
    if (manager.activityImageUrlCache.has(path)) {
        return manager.activityImageUrlCache.get(path);
    }

    const url = await supabaseService.getClassroomActivityImageUrl(path);
    manager.activityImageUrlCache.set(path, url);
    return url;
}

export function hydrateTeacherImageHotspotImages(manager, root, template = {}) {
    const normalized = normalizeImageHotspotTemplate(
        template,
        template?.templateId || manager.activity?.activityData?.templateId || 'label-image-parts'
    );
    const path = normalized.image?.storagePath || '';
    if (!root || !path) return;

    manager.resolveActivityImageUrl(path)
        .then(url => {
            if (!url) return;
            root.querySelectorAll(`[data-image-hotspot-src="${CSS.escape(path)}"]`).forEach(image => {
                image.src = url;
                image.classList.remove('hidden');
            });
            root.querySelectorAll(`[data-image-hotspot-placeholder="${CSS.escape(path)}"]`).forEach(placeholder => {
                placeholder.classList.add('hidden');
            });
        })
        .catch(error => {
            console.warn('Could not load classroom activity image preview:', error);
        });
}

export async function handleTeacherImageHotspotImageUpload(manager, event) {
    const input = event.target;
    const file = input.files?.[0];
    if (!file || !manager.activity?.id) return;
    if (!manager.ensureAuthenticated(false)) {
        notifications.warning('Sign in as a teacher before uploading images.');
        input.value = '';
        return;
    }

    try {
        manager.setActivitySaveStatus('Preparing image...', 'info');
        manager.syncImageHotspotTemplate();
        const template = normalizeImageHotspotTemplate(
            manager.activity.activityData?.imageHotspotTemplate,
            manager.activity.activityData?.templateId || 'label-image-parts'
        );
        const previousPath = template.image.storagePath;
        const imageData = await compressImageToWebp(file, {
            maxWidth: 1600,
            maxHeight: 1200,
            initialQuality: 0.78,
            targetBytes: 700 * 1024,
            maxBytes: 950 * 1024
        });
        const path = supabaseService.buildClassroomActivityImagePath({
            teacherId: manager.currentUser?.uid,
            activityId: manager.activity.id,
            fileName: file.name
        });
        const metadata = await supabaseService.uploadClassroomActivityImage({ path, blob: imageData.blob });
        template.image = {
            storagePath: metadata.path,
            width: imageData.width,
            height: imageData.height,
            altText: template.image.altText || manager.activity.title || 'Activity image',
            sizeBytes: metadata.sizeBytes,
            uploadedAt: metadata.updatedAt
        };
        manager.activity.activityData.imageHotspotTemplate = normalizeImageHotspotTemplate(template, template.templateId);
        manager.activityImageUrlCache.delete(previousPath);
        manager.activityImageUrlCache.delete(metadata.path);
        manager.renderImageHotspotBuilder();
        manager.triggerActivityAutoSave({ readForm: false });
        manager.setActivitySaveStatus('Image uploaded.', 'success');

        if (previousPath && previousPath !== metadata.path) {
            supabaseService.deleteClassroomActivityImage(previousPath).catch(error => {
                console.warn('Could not delete previous classroom activity image:', error);
            });
        }
    } catch (error) {
        console.error('Failed to upload classroom activity image:', error);
        notifications.error('Could not upload image.');
        manager.setActivitySaveStatus('Image upload failed.', 'error');
    } finally {
        input.value = '';
    }
}
