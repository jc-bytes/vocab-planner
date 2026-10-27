import { initTeacherGlobalListeners } from './teacherGlobalListeners.js';
import { initTeacherVocabularyEditorListeners } from './teacherVocabularyEditorListeners.js';

export function initTeacherListeners(manager) {
    initTeacherGlobalListeners(manager);
    initTeacherVocabularyEditorListeners(manager);
}
