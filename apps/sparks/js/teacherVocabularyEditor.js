import { installTeacherVocabularyActivityFlowMethods } from './teacherVocabularyActivityFlowMethods.js';
import { installTeacherVocabularyEditorCoreMethods } from './teacherVocabularyEditorCoreMethods.js';
import { installTeacherVocabularyWordEditorMethods } from './teacherVocabularyWordEditorMethods.js';

export function installTeacherVocabularyEditorMethods(TeacherManager) {
    installTeacherVocabularyEditorCoreMethods(TeacherManager);
    installTeacherVocabularyActivityFlowMethods(TeacherManager);
    installTeacherVocabularyWordEditorMethods(TeacherManager);
}
