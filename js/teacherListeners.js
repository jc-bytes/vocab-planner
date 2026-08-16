import { initTeacherGlobalListeners } from './teacherGlobalListeners.js';
import { initTeacherProgressListeners } from './teacherProgressListeners.js';
import { initTeacherSettingsListeners } from './teacherSettingsListeners.js';
import { initTeacherVocabularyEditorListeners } from './teacherVocabularyEditorListeners.js';

export function initTeacherListeners(manager) {
    initTeacherGlobalListeners(manager);
    initTeacherSettingsListeners(manager);
    initTeacherProgressListeners(manager);
    initTeacherVocabularyEditorListeners(manager);
}
