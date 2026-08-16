import { installTeacherDataDashboardMethods } from './teacherDataDashboard.js';
import { installTeacherDataExportMethods } from './teacherDataExport.js';
import { installTeacherDataViewerMethods } from './teacherDataViewer.js';

export function installTeacherDataManagementMethods(TeacherManager) {
    installTeacherDataExportMethods(TeacherManager);
    installTeacherDataViewerMethods(TeacherManager);
    installTeacherDataDashboardMethods(TeacherManager);
}
