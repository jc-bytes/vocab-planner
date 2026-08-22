import { teacherProgressDataMethods } from './teacherStudentProgress/teacherProgressDataMethods.js';
import { teacherProgressPageMethods } from './teacherStudentProgress/teacherProgressPageMethods.js';
import { teacherStudentCsvImportMethods } from './teacherStudentProgress/teacherStudentCsvImportMethods.js';
import { teacherStudentProvisioningMethods } from './teacherStudentProgress/teacherStudentProvisioningMethods.js';

const teacherStudentProgressMethodGroups = [
    teacherProgressDataMethods,
    teacherProgressPageMethods,
    teacherStudentProvisioningMethods,
    teacherStudentCsvImportMethods
];

export function installTeacherStudentProgressDataMethods(TeacherManager) {
    teacherStudentProgressMethodGroups.forEach(methods => {
        Object.entries(Object.getOwnPropertyDescriptors(methods)).forEach(([name, descriptor]) => {
            Object.defineProperty(TeacherManager.prototype, name, {
                ...descriptor,
                enumerable: false
            });
        });
    });
}
