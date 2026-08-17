import { teacherVocabularyBrowserViewMethods } from './teacherVocabularyLibrary/teacherVocabularyBrowserViewMethods.js';
import { teacherVocabularyDataMethods } from './teacherVocabularyLibrary/teacherVocabularyDataMethods.js';
import { teacherVocabularyRowViewMethods } from './teacherVocabularyLibrary/teacherVocabularyRowViewMethods.js';
import { teacherVocabularyWorkflowMethods } from './teacherVocabularyLibrary/teacherVocabularyWorkflowMethods.js';

const teacherVocabularyLibraryMethodGroups = [
    teacherVocabularyWorkflowMethods,
    teacherVocabularyDataMethods,
    teacherVocabularyRowViewMethods,
    teacherVocabularyBrowserViewMethods
];

export function installTeacherVocabularyLibraryMethods(TeacherManager) {
    teacherVocabularyLibraryMethodGroups.forEach(methods => {
        Object.entries(Object.getOwnPropertyDescriptors(methods)).forEach(([name, descriptor]) => {
            Object.defineProperty(TeacherManager.prototype, name, {
                ...descriptor,
                enumerable: false
            });
        });
    });
}
