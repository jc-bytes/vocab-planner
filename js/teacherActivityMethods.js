import { installTeacherActivityAssignmentMethods } from './teacherActivityAssignmentMethods.js';
import { installTeacherActivityEditorMethods } from './teacherActivityEditorMethods.js';
import { installTeacherActivityLibraryMethods } from './teacherActivityLibraryMethods.js';
import { installTeacherActivityStudentPreviewMethods } from './teacherActivityStudentPreviewMethods.js';

export function installTeacherActivityMethods(TeacherManager) {
    installTeacherActivityLibraryMethods(TeacherManager);
    installTeacherActivityAssignmentMethods(TeacherManager);
    installTeacherActivityEditorMethods(TeacherManager);
    installTeacherActivityStudentPreviewMethods(TeacherManager);
}
