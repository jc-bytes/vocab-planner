import { installTeacherDataDashboardChartMethods } from './teacherDataDashboardChartMethods.js';
import { installTeacherDataDashboardMetricMethods } from './teacherDataDashboardMetricMethods.js';
import { installTeacherDataDashboardRecentActivityMethods } from './teacherDataDashboardRecentActivityMethods.js';
import { installTeacherDataDashboardViewMethods } from './teacherDataDashboardViewMethods.js';

export function installTeacherDataDashboardMethods(TeacherManager) {
    installTeacherDataDashboardViewMethods(TeacherManager);
    installTeacherDataDashboardChartMethods(TeacherManager);
    installTeacherDataDashboardMetricMethods(TeacherManager);
    installTeacherDataDashboardRecentActivityMethods(TeacherManager);
}
