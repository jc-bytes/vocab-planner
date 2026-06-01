import { $, notifications } from './main.js';
import {
    teacherApi as supabaseService,
    collection,
    deleteDoc,
    doc,
    getDocs,
    serverTimestamp,
    setDoc
} from './services/teacherApi.js';
import { DEFAULT_SUBJECT_SLUG } from './services/vocabularyApi.js';

const TEACHER_ACTIVITY_LOCAL_KEY = 'teacher_activity_library';

export function isTeacherActivityCloudSetupPending(error) {
    const code = String(error?.code || '');
    const message = String(error?.message || error || '').toLowerCase();
    return code === 'PGRST205'
        || (message.includes('classroom_activities') && message.includes('could not find the table'));
}

export function cancelTeacherActivityAutoSave(manager, id = null) {
    if (id && manager.activity?.id && manager.activity.id !== id) return;
    clearTimeout(manager.activityLocalSaveTimeout);
    clearTimeout(manager.activityCloudSaveTimeout);
    manager.activityLocalSaveTimeout = null;
    manager.activityCloudSaveTimeout = null;
}

export function markTeacherActivityDeleted(manager, id) {
    if (!id) return;
    manager.deletedActivityIds.add(id);
    manager.cancelActivityAutoSave(id);
}

export function isTeacherActivityDeleted(manager, id) {
    return Boolean(id && manager.deletedActivityIds.has(id));
}

export function getLocalTeacherActivities(manager) {
    try {
        const stored = JSON.parse(localStorage.getItem(TEACHER_ACTIVITY_LOCAL_KEY) || '[]');
        return Array.isArray(stored)
            ? stored.map(activity => manager.normalizeActivity({ ...activity, source: 'local' }))
            : [];
    } catch (error) {
        console.warn('Could not read local activities:', error);
        return [];
    }
}

export function saveTeacherActivityToLocal(manager, activity = manager.activity) {
    if (!activity?.id) return;
    if (manager.isActivityDeleted(activity.id)) return;
    const { __source, source, ...rest } = manager.normalizeActivity(activity);
    let activities = manager.getLocalActivities();
    const index = activities.findIndex(item => item.id === rest.id);

    if (index >= 0) {
        activities[index] = rest;
    } else {
        activities.push(rest);
    }

    localStorage.setItem(TEACHER_ACTIVITY_LOCAL_KEY, JSON.stringify(activities));
    manager.invalidateActivityLibraryCache();
}

export function removeLocalTeacherActivity(manager, id) {
    if (!id) return false;
    const before = manager.getLocalActivities();
    const after = before.filter(activity => activity.id !== id);
    if (after.length === before.length) return false;
    localStorage.setItem(TEACHER_ACTIVITY_LOCAL_KEY, JSON.stringify(after));
    manager.invalidateActivityLibraryCache();
    return true;
}

export async function fetchCloudTeacherActivities(manager) {
    manager.activityLibraryLastFetchFailed = false;
    if (manager.authDisabled) return [];
    if (!manager.ensureAuthenticated(false)) return [];

    try {
        const db = supabaseService.getDatabase();
        const snapshot = await getDocs(collection(db, manager.ACTIVITY_COLLECTION));
        manager.setCloudStatus('Ready', 'info');
        manager.activityLibraryLastFetchFailed = false;
        return snapshot.docs.map(docSnap => manager.normalizeActivity({
            id: docSnap.id,
            ...docSnap.data(),
            source: 'cloud'
        }));
    } catch (error) {
        console.error('Failed to fetch classroom activities:', error);
        manager.activityLibraryLastFetchFailed = true;
        if (manager.isActivityCloudSetupPending(error)) {
            manager.setCloudStatus('Activities cloud setup pending', 'muted');
        } else {
            manager.setCloudStatus('Activity load failed', 'error');
        }
        return [];
    }
}

export async function getTeacherActivityLibrary(manager, { forceRefresh = false } = {}) {
    if (!forceRefresh && manager.activityLibraryCache) {
        return manager.activityLibraryCache;
    }

    if (!forceRefresh && manager.activityLibraryPromise) {
        return manager.activityLibraryPromise;
    }

    manager.activityLibraryPromise = manager.fetchCloudActivities().then(cloudActivities => {
        const cloudIds = new Set(cloudActivities.map(activity => activity.id).filter(Boolean));
        const localActivities = manager.getLocalActivities().filter(activity => !cloudIds.has(activity.id));
        const rawItems = [
            ...cloudActivities.map(activity => ({ activity, type: 'cloud' })),
            ...localActivities.map(activity => ({ activity, type: 'local' }))
        ];
        const items = manager.collapseDuplicateActivityItems(rawItems);
        const visibleCloudActivities = items
            .filter(item => item.type === 'cloud')
            .map(item => item.activity);
        const visibleLocalActivities = items
            .filter(item => item.type === 'local')
            .map(item => item.activity);

        manager.activityLibraryCache = {
            cloudActivities: visibleCloudActivities,
            localActivities: visibleLocalActivities,
            items,
            loadedAt: Date.now()
        };
        return manager.activityLibraryCache;
    }).finally(() => {
        manager.activityLibraryPromise = null;
    });

    return manager.activityLibraryPromise;
}

export async function deleteCloudTeacherActivity(manager, id) {
    if (!manager.ensureAuthenticated()) return;
    manager.markActivityDeleted(id);
    try {
        const db = supabaseService.getDatabase();
        const ref = doc(db, manager.ACTIVITY_COLLECTION, id);
        await deleteDoc(ref);
        manager.removeLocalActivity(id);
        manager.invalidateActivityLibraryCache();
        notifications.success('Activity deleted.');
    } catch (error) {
        manager.deletedActivityIds.delete(id);
        console.error('Failed to delete classroom activity:', error);
        notifications.error('Could not delete classroom activity.');
    }
}

export function triggerTeacherActivityAutoSave(manager, options = {}) {
    if (!manager.activity?.id) return;
    if (manager.isActivityDeleted(manager.activity.id)) return;
    if (options.syncEditor) manager.syncActivityWorkspace();
    if (options.readForm !== false) manager.readActivityFormIntoModel();

    if (manager.authDisabled) {
        manager.queueActivityLocalSave();
        manager.setCloudStatus('Saved locally', 'success');
        return;
    }

    if (manager.activity.source !== 'cloud') {
        manager.queueActivityLocalSave();
        manager.setCloudStatus('Draft saved locally', 'success');
        return;
    }

    manager.queueActivityCloudSave();
}

export function queueTeacherActivityLocalSave(manager) {
    clearTimeout(manager.activityLocalSaveTimeout);
    manager.activityLocalSaveTimeout = setTimeout(() => {
        if (manager.isActivityDeleted(manager.activity?.id)) return;
        manager.saveActivityToLocal(manager.activity);
        manager.setActivitySaveStatus('Draft saved locally.', 'success');
    }, 500);
}

export function queueTeacherActivityCloudSave(manager) {
    if (manager.authDisabled) return;
    if (!manager.isAuthenticated || !manager.activity?.id) return;
    clearTimeout(manager.activityCloudSaveTimeout);
    manager.setCloudStatus('Saving...', 'info');
    manager.setActivitySaveStatus('Saving activity...', 'info');
    manager.activityCloudSaveTimeout = setTimeout(() => {
        if (manager.isActivityDeleted(manager.activity?.id)) return;
        manager.saveActivityToCloud({ notifyOnError: false });
    }, 1200);
}

export async function saveTeacherActivityToCloud(manager, options = {}) {
    if (manager.authDisabled) return false;
    if (!manager.ensureAuthenticated(false)) return false;
    if (!manager.activity?.id) return false;
    if (manager.isActivityDeleted(manager.activity.id)) return false;

    manager.syncActivityWorkspace();
    manager.readActivityFormIntoModel();
    if (manager.isActivityDeleted(manager.activity.id)) return false;

    try {
        manager.validateActivityClass(manager.activity);
    } catch (error) {
        manager.saveActivityToLocal(manager.activity);
        manager.setCloudStatus('Activity needs class', 'muted');
        manager.setActivitySaveStatus(`${error.message} Draft saved locally.`, 'error');
        if (options.notifyOnError !== false) {
            notifications.warning(error.message);
        }
        return false;
    }

    try {
        const db = supabaseService.getDatabase();
        const docRef = doc(db, manager.ACTIVITY_COLLECTION, manager.activity.id);
        const { __source, source, ...rest } = manager.activity;
        const payload = {
            ...rest,
            ownerId: manager.currentUser ? manager.currentUser.uid : null,
            updatedAt: serverTimestamp()
        };
        await setDoc(docRef, payload);
        manager.activity.source = 'cloud';
        manager.removeLocalActivity(manager.activity.id);
        manager.invalidateActivityLibraryCache();
        manager.setCloudStatus('Saved to cloud', 'success');
        manager.setActivitySaveStatus('Saved to cloud.', 'success');
        setTimeout(() => manager.setCloudStatus('Ready', 'info'), 1500);
        return true;
    } catch (error) {
        console.error('Failed to save classroom activity:', error);
        if (!manager.isActivityDeleted(manager.activity?.id)) {
            manager.saveActivityToLocal(manager.activity);
            if (manager.isActivityCloudSetupPending(error)) {
                manager.setCloudStatus('Activities cloud setup pending', 'muted');
                manager.setActivitySaveStatus('Draft saved locally. Cloud sync pending setup.', 'info');
            } else {
                manager.setCloudStatus('Activity save failed', 'error');
                manager.setActivitySaveStatus('Cloud save failed. Draft saved locally.', 'error');
            }
        }
        if (options.notifyOnError !== false) {
            if (manager.isActivityCloudSetupPending(error)) {
                notifications.info('Activity draft saved locally. Cloud sync will work after setup.');
            } else {
                notifications.error('Cloud save failed. Activity draft saved locally.');
            }
        }
        return false;
    }
}

export function createTeacherActivityIdSuggestion(manager, activity = manager.activity) {
    const normalized = manager.normalizeActivity(activity);
    const grade = normalized.grades[0] || 'custom';
    const title = manager.slugifyVocabPart(normalized.title || 'activity');
    const parts = [
        'activity',
        manager.slugifyVocabPart(normalized.subjectSlug) || DEFAULT_SUBJECT_SLUG,
        `grade${manager.slugifyVocabPart(grade) || 'custom'}`,
        manager.slugifyVocabPart(normalized.activityType) || 'map',
        title
    ].filter(Boolean);
    return parts.join('_') || `activity_${Date.now()}`;
}

export async function publishTeacherActivity(manager, { asNew = false } = {}) {
    if (!manager.ensureAuthenticated()) return;
    manager.syncActivityWorkspace();
    manager.readActivityFormIntoModel();

    if (asNew) {
        const suggestedId = manager.createActivityIdSuggestion();
        const newId = prompt('New activity ID', suggestedId);
        if (!newId) return;
        manager.activity.id = manager.slugifyVocabPart(newId) || suggestedId;
        $('#activity-id').value = manager.activity.id;
        manager.deletedActivityIds.delete(manager.activity.id);
        delete manager.activity.source;
    }

    const saved = await manager.saveActivityToCloud({ notifyOnError: true });

    if (saved) {
        notifications.success(asNew ? 'Saved as a new activity.' : 'Activity update saved.');
        await manager.loadActivityLibrary();
    } else {
        manager.saveActivityToLocal(manager.activity);
    }
}

export function exportTeacherActivityJson(manager) {
    if (!manager.ensureAuthenticated()) return;
    manager.syncActivityWorkspace();
    manager.readActivityFormIntoModel();
    const activity = manager.normalizeActivity(manager.activity);
    const dataStr = `data:text/json;charset=utf-8,${encodeURIComponent(JSON.stringify(activity, null, 2))}`;
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute('href', dataStr);
    downloadAnchorNode.setAttribute('download', `${activity.id || 'classroom-activity'}.json`);
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
}
