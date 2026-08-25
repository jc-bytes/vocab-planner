import { installTeacherVocabularyEditorMethods } from './teacherVocabularyEditor.js';
import { installTeacherVocabularyLibraryMethods } from './teacherVocabularyLibrary.js';
import { installTeacherVocabularyPlacementMethods } from './teacherVocabularyPlacement.js';
import { installTeacherVocabularyStorageMethods } from './teacherVocabularyStorage.js';
import { installTeacherVocabularySessionMethods } from './teacherVocabularySession.js';

export function installTeacherVocabularyMethods(TeacherManager) {
    installTeacherVocabularySessionMethods(TeacherManager);
    installTeacherVocabularyPlacementMethods(TeacherManager);
    installTeacherVocabularyLibraryMethods(TeacherManager);
    installTeacherVocabularyStorageMethods(TeacherManager);
    installTeacherVocabularyEditorMethods(TeacherManager);
}
