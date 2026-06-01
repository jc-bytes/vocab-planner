import { installStudentActivityLauncherMethods } from './studentActivityLauncherMethods.js';
import { installStudentActivityMenuMethods } from './studentActivityMenuMethods.js';
import { installStudentActivityModuleLoaderMethods } from './studentActivityModuleLoaderMethods.js';
import { installStudentActivityProgressPersistenceMethods } from './studentActivityProgressPersistenceMethods.js';

export function installStudentActivityRuntimeMethods(StudentActivities) {
    installStudentActivityMenuMethods(StudentActivities);
    installStudentActivityModuleLoaderMethods(StudentActivities);
    installStudentActivityLauncherMethods(StudentActivities);
    installStudentActivityProgressPersistenceMethods(StudentActivities);
}
