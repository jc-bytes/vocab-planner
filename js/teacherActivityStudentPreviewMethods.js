import {
    closeTeacherActivityStudentPreview,
    initTeacherActivityStudentPreview,
    openTeacherActivityStudentPreview
} from './teacherActivityStudentPreviewController.js';

const teacherActivityStudentPreviewMethods = {
    initActivityStudentPreview() {
        initTeacherActivityStudentPreview(this);
    },

    async openActivityStudentPreview(source = null, options = {}) {
        await openTeacherActivityStudentPreview(this, source, options);
    },

    closeActivityStudentPreview() {
        closeTeacherActivityStudentPreview(this);
    }
};

export function installTeacherActivityStudentPreviewMethods(TeacherManager) {
    Object.assign(TeacherManager.prototype, teacherActivityStudentPreviewMethods);
}
