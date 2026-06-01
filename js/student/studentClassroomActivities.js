import { installStudentClassroomActivityBrowserMethods } from './studentClassroomActivityBrowser.js';
import { installStudentClassroomActivityDataMethods } from './studentClassroomActivityData.js';
import { installStudentClassroomActivityMountMethods } from './studentClassroomActivityMounts.js';
import { installStudentClassroomActivityPersistenceMethods } from './studentClassroomActivityPersistence.js';
import { installStudentClassroomActivityResponseMethods } from './studentClassroomActivityResponses.js';

export class StudentClassroomActivities {
    constructor(studentManager) {
        this.sm = studentManager;
        this.assignments = [];
        this.submissions = [];
        this.currentAssignment = null;
        this.currentSubmission = null;
        this.editorHandle = null;
        this.autosaveTimeout = null;
        this.editorAutosaveReady = false;
        this.editorAutosaveReadyTimeout = null;
        this.pdfExportInProgress = false;
        this.selectedHotspotLabelId = '';
        this.draggingHotspotPinId = '';
        this.suppressNextHotspotClick = false;
    }

}


installStudentClassroomActivityDataMethods(StudentClassroomActivities);
installStudentClassroomActivityBrowserMethods(StudentClassroomActivities);
installStudentClassroomActivityMountMethods(StudentClassroomActivities);
installStudentClassroomActivityResponseMethods(StudentClassroomActivities);
installStudentClassroomActivityPersistenceMethods(StudentClassroomActivities);
