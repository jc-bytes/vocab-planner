import { studentClassroomActivityBrowserListMethods } from './studentClassroomActivityBrowserListMethods.js';
import { studentClassroomActivityBrowserRenderMethods } from './studentClassroomActivityBrowserRenderMethods.js';
import { studentClassroomActivityDateMethods } from './studentClassroomActivityDateMethods.js';
import { studentClassroomActivityPlanningMethods } from './studentClassroomActivityPlanningMethods.js';

function installMethods(targetPrototype, methods) {
    Object.keys(methods).forEach(name => {
        Object.defineProperty(
            targetPrototype,
            name,
            Object.getOwnPropertyDescriptor(methods, name)
        );
    });
}

export function installStudentClassroomActivityBrowserMethods(StudentClassroomActivities) {
    [
        studentClassroomActivityDateMethods,
        studentClassroomActivityPlanningMethods,
        studentClassroomActivityBrowserRenderMethods,
        studentClassroomActivityBrowserListMethods
    ].forEach(methods => installMethods(StudentClassroomActivities.prototype, methods));
}
