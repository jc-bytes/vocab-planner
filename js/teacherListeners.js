import { initTeacherGlobalListeners } from './teacherGlobalListeners.js';
import { initTeacherProgressListeners } from './teacherProgressListeners.js';
import { initTeacherSettingsListeners } from './teacherSettingsListeners.js';
import { initTeacherSparksListeners } from './teacherSparks.js';
import { initTeacherVocabularyEditorListeners } from './teacherVocabularyEditorListeners.js';

export function initTeacherListeners(manager) {
    initTeacherGlobalListeners(manager);
    initTeacherSettingsListeners(manager);
    initTeacherSparksListeners(manager);
    initTeacherProgressListeners(manager);
    initTeacherVocabularyEditorListeners(manager);
}
