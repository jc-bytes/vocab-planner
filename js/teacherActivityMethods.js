import { installTeacherActivityAssignmentMethods } from './teacherActivityAssignmentMethods.js';
import { installTeacherActivityEditorMethods } from './teacherActivityEditorMethods.js';
import { installTeacherActivityLibraryMethods } from './teacherActivityLibraryMethods.js';

export function installTeacherActivityMethods(TeacherManager) {
    installTeacherActivityLibraryMethods(TeacherManager);
    installTeacherActivityAssignmentMethods(TeacherManager);
    installTeacherActivityEditorMethods(TeacherManager);
}
