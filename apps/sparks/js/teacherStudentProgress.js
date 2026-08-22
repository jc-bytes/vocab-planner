import { installTeacherStudentProgressCoinMethods } from './teacherStudentProgressCoinMethods.js';
import { installTeacherStudentProgressDataMethods } from './teacherStudentProgressDataMethods.js';
import { installTeacherStudentProgressRenderMethods } from './teacherStudentProgressRenderMethods.js';

export function installTeacherStudentProgressMethods(TeacherManager) {
    installTeacherStudentProgressDataMethods(TeacherManager);
    installTeacherStudentProgressRenderMethods(TeacherManager);
    installTeacherStudentProgressCoinMethods(TeacherManager);
}
