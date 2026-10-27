import { teacherVocabularyDataMethods } from './teacherVocabularyLibrary/teacherVocabularyDataMethods.js';
import { teacherVocabularyWorkflowMethods } from './teacherVocabularyLibrary/teacherVocabularyWorkflowMethods.js';
export function installTeacherVocabularyLibraryMethods(TeacherManager) {
 for (const methods of [teacherVocabularyWorkflowMethods, teacherVocabularyDataMethods]) {
  for (const [name, descriptor] of Object.entries(Object.getOwnPropertyDescriptors(methods))) Object.defineProperty(TeacherManager.prototype, name, { ...descriptor, enumerable: false });
 }
}
