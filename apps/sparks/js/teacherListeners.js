import { initTeacherGlobalListeners } from './teacherGlobalListeners.js';
import { initTeacherProgressListeners } from './teacherProgressListeners.js';
import { initTeacherVocabularyEditorListeners } from './teacherVocabularyEditorListeners.js';

export function initTeacherListeners(manager) {
    initTeacherGlobalListeners(manager);
    initTeacherProgressListeners(manager);
    initTeacherVocabularyEditorListeners(manager);
}
