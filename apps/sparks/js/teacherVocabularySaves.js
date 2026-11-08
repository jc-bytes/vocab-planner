import { createTeacherVocabularySaveCoordinator } from './teacherVocabularySaveCoordinator.js';
import { vocabularyRepository } from './services/vocabularyRepository.js';
import { getVocabSubjectSlug } from './services/vocabularyApi.js';
import { notifications } from './main.js';

const coordinators = new WeakMap();

export function getTeacherVocabularySaves(owner) {
    if (coordinators.has(owner)) return coordinators.get(owner);
    const revisions = new Map();
    const requests = new Map();
    const coordinator = createTeacherVocabularySaveCoordinator({
        prepareSnapshot(vocab) {
            const snapshot = JSON.parse(JSON.stringify(vocab || {}));
            snapshot.subjectSlug = getVocabSubjectSlug(snapshot);
            owner.normalizeActivityFlowSettings(snapshot);
            return snapshot;
        },
        captureContext() {
            const session = owner.createTeacherVocabularyOperationGuard(), localMode = owner.authDisabled;
            const documentKey = owner.teacherVocabularyDocumentGeneration || 0;
            const navigation = owner.captureTeacherNavigation?.() || null;
            return Object.freeze({ documentKey, localMode, authenticated: owner.isAuthenticated,
                ownerId: owner.currentUser?.uid || owner.currentUser?.id || null,
                isCurrent: () => session() && localMode === owner.authDisabled,
                isDocumentCurrent: () => documentKey === (owner.teacherVocabularyDocumentGeneration || 0),
                isNavigationCurrent: () => !navigation || owner.isTeacherNavigationCurrent?.(navigation) });
        },
        authorize: showAlert => owner.ensureAuthenticated(showAlert),
        async writeCloud(snapshot, context) {
            const { __source, source, ...rest } = snapshot;
            const key = `${context.ownerId}:${context.documentKey}:${snapshot.id}`;
            const revision = revisions.get(key) ?? snapshot.contentRevision ?? 0;
            const fingerprint = JSON.stringify({ ...rest, contentRevision: revision });
            let request = requests.get(key);
            if (!request || request.fingerprint !== fingerprint) {
                request = { fingerprint, key: crypto.randomUUID(), updatedAt: new Date().toISOString() };
                requests.set(key, request);
            }
            const saved = await vocabularyRepository.save(snapshot.id, { ...rest, contentRevision: revision, ownerId: context.ownerId, updatedAt: request.updatedAt }, { requestKey: request.key });
            requests.delete(key);
            if (Number.isInteger(saved.contentRevision)) revisions.set(key, saved.contentRevision);
            if (Number.isInteger(saved.contentRevision) && context.isCurrent() && context.isDocumentCurrent() && owner.vocabSet?.id === snapshot.id) owner.vocabSet.contentRevision = saved.contentRevision;
            return saved;
        },
        writeDraft: snapshot => owner.saveToLocal(snapshot),
        removeDraft: id => owner.removeLocalVocab(id),
        invalidateCatalog: () => owner.invalidateTeacherLibraryCache(),
        markCloudSource(id) {
            if (owner.vocabSet?.id !== id) return;
            owner.vocabSet.source = 'cloud';
            if (owner.teacherVocabularyLocalCopyDocumentGeneration != null
                && owner.teacherVocabularyLocalCopyDocumentGeneration === owner.teacherVocabularyDocumentGeneration) {
                delete owner.teacherVocabularyLocalCopyDocumentGeneration;
                const route = owner.parseRoute?.();
                if (route?.view === 'editor' && route.vocabularyId === id && route.localCopy === true)
                    owner.setRoute({ view: 'editor', vocabularyId: id }, { replace: true });
            }
        },
        setStatus: (text, type) => owner.setCloudStatus(text, type),
        notifyFailure({ localOnly, localError, cloudError }) {
            notifications.error(cloudError?.code === '40001' ? cloudError.message : localOnly
                ? 'Local save failed. Keep this page open and free device storage before trying again.'
                : localError ? 'Cloud save failed and this device could not keep a draft. Keep this page open and try again.'
                : 'Cloud save failed. Check backend rules to ensure authenticated users can write to the vocabularies collection.');
        }
    });
    coordinators.set(owner, coordinator);
    return coordinator;
}

export function resetTeacherVocabularySaves(owner) {
    coordinators.get(owner)?.reset();
}
