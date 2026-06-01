import { teacherGamificationSettingsMethods } from './teacherGamificationSettingsMethods.js';
import { teacherSchoolCalendarSettingsMethods } from './teacherSchoolCalendarSettingsMethods.js';
import { teacherSubjectSettingsMethods } from './teacherSubjectSettingsMethods.js';

function installMethods(targetPrototype, methods) {
    Object.keys(methods).forEach(name => {
        Object.defineProperty(
            targetPrototype,
            name,
            Object.getOwnPropertyDescriptor(methods, name)
        );
    });
}

export function installTeacherSettingsMethods(TeacherManager) {
    [
        teacherGamificationSettingsMethods,
        teacherSubjectSettingsMethods,
        teacherSchoolCalendarSettingsMethods
    ].forEach(methods => installMethods(TeacherManager.prototype, methods));
}
