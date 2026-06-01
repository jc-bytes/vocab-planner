import { studentClassroomActivityEditorMountMethods } from './studentClassroomActivityEditorMountMethods.js';
import { studentClassroomActivityMountDetailsMethods } from './studentClassroomActivityMountDetails.js';
import { studentClassroomActivityTypeMountMethods } from './studentClassroomActivityTypeMountMethods.js';

function installMethods(targetPrototype, methods) {
    Object.keys(methods).forEach(name => {
        Object.defineProperty(
            targetPrototype,
            name,
            Object.getOwnPropertyDescriptor(methods, name)
        );
    });
}

export function installStudentClassroomActivityMountMethods(StudentClassroomActivities) {
    [
        studentClassroomActivityMountDetailsMethods,
        studentClassroomActivityEditorMountMethods,
        studentClassroomActivityTypeMountMethods
    ].forEach(methods => installMethods(StudentClassroomActivities.prototype, methods));
}
