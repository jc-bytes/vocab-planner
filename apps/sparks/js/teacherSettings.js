import { teacherGamificationSettingsMethods } from './teacherGamificationSettingsMethods.js';
import { teacherSubjectSettingsMethods } from './teacherSubjectSettingsMethods.js';
import { clearTeacherSettingsSessionState } from './teacherSettingsSession.js';

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
        teacherSubjectSettingsMethods
    ].forEach(methods => installMethods(TeacherManager.prototype, methods));
    TeacherManager.prototype.loadSchoolCalendarSettings = async function (...args) {
        const { teacherSchoolCalendarSettingsMethods } = await import('./teacherSchoolCalendarSettingsMethods.js');
        installMethods(TeacherManager.prototype, teacherSchoolCalendarSettingsMethods);
        return this.loadSchoolCalendarSettings(...args);
    };
    Object.defineProperty(TeacherManager.prototype, 'clearTeacherSettingsSessionState', {
        configurable: true,
        writable: true,
        value() {
            clearTeacherSettingsSessionState(this);
        }
    });
}
