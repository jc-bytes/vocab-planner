import { teacherSparkDataMethods } from './teacherSparks/teacherSparkDataMethods.js';
import { teacherSparkEditorMethods } from './teacherSparks/teacherSparkEditorMethods.js';
import { teacherSparkLibraryModelMethods } from './teacherSparks/teacherSparkLibraryModelMethods.js';
import { teacherSparkLibraryViewMethods } from './teacherSparks/teacherSparkLibraryViewMethods.js';
import { teacherSparkPersistenceMethods } from './teacherSparks/teacherSparkPersistenceMethods.js';

export { initTeacherSparksListeners } from './teacherSparks/teacherSparkListeners.js';

const teacherSparkMethodGroups = [
    teacherSparkDataMethods,
    teacherSparkLibraryModelMethods,
    teacherSparkLibraryViewMethods,
    teacherSparkEditorMethods,
    teacherSparkPersistenceMethods
];

/**
 * Installs the lazy Teacher Sparks feature without changing TeacherManager's
 * existing public interface.
 */
export function installTeacherSparkMethods(TeacherManager) {
    teacherSparkMethodGroups.forEach(methods => {
        Object.entries(Object.getOwnPropertyDescriptors(methods)).forEach(([name, descriptor]) => {
            Object.defineProperty(TeacherManager.prototype, name, {
                ...descriptor,
                enumerable: false
            });
        });
    });
}
