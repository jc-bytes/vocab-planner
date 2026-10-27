import { schoolContext } from './services/schoolContext.js';

export function createTeacherUnitActions(owner, vocab, type) {
    const current = owner.createTeacherVocabularyOperationGuard?.() || (() => true);
    const actions = {
        onPreview: async () => {
            const navigation = owner.captureTeacherNavigation?.();
            const isCurrent = () => current() && (!navigation || owner.isTeacherNavigationCurrent(navigation));
            const { previewTeacherUnit } = await import('./teacherStudentPreview.js');
            if (isCurrent()) previewTeacherUnit(owner, vocab, type, isCurrent);
        },
        onEdit: () => { if (current()) owner.openTeacherVocabularyItem(vocab, type); }
    };
    if (type === 'cloud' && owner.hasLocalCopy?.(vocab.id)) {
        actions.contextLabel = 'Local copy available';
        actions.onReviewLocalCopy = () => {
            if (!current() || !confirm('Open the local copy for review? The cloud version may have changed. Editing or saving this copy can update the cloud version.')) return;
            if (current()) owner.openTeacherVocabularyItem({ id: vocab.id }, 'local-copy');
        };
    }
    if (type === 'cloud' && schoolContext.hasRole('teacher')) actions.onAssign = () => {
        if (current()) owner.openAssignmentPublisher({ materialId: vocab.id, kind: 'vocabulary' });
    };
    if (type === 'local' || type === 'cloud') actions.onDelete = async () => {
        if (!current() || !confirm(`Delete ${type === 'cloud' ? 'cloud' : 'draft'} vocabulary "${vocab.name}"? This cannot be undone.`) || !current()) return;
        if (type === 'local') { owner.removeLocalVocab(vocab.id); if (current()) owner.loadLibrary(); }
        else if (await owner.deleteCloudVocab(vocab.id) && current()) owner.loadLibrary();
    };
    return actions;
}
