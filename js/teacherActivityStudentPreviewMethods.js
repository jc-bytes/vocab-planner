import {
    closeTeacherActivityStudentPreview,
    initTeacherActivityStudentPreview,
    openTeacherActivityStudentPreview
} from './teacherActivityStudentPreviewController.js';

const teacherActivityStudentPreviewMethods = {
    initActivityStudentPreview() {
        initTeacherActivityStudentPreview(this);
    },

    async openActivityStudentPreview(source = null) {
        await openTeacherActivityStudentPreview(this, source);
    },

    closeActivityStudentPreview() {
        closeTeacherActivityStudentPreview(this);
    }
};

export function installTeacherActivityStudentPreviewMethods(TeacherManager) {
    Object.assign(TeacherManager.prototype, teacherActivityStudentPreviewMethods);
}
