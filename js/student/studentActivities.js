/**
 * Student Activities Module
 * Handles vocabulary loading, activity management, and progress tracking
 */

import { installStudentActivityBrowserMethods } from './studentActivityBrowserMethods.js';
import { installStudentActivityCalendarMethods } from './studentActivityCalendarMethods.js';
import { installStudentActivityCoverageMethods } from './studentActivityCoverageMethods.js';
import { installStudentActivityHomeMethods } from './studentActivityHomeMethods.js';
import { installStudentActivityProgressFlowMethods } from './studentActivityProgressFlowMethods.js';
import { installStudentActivityRuntimeMethods } from './studentActivityRuntimeMethods.js';
import { installStudentActivityScheduleMethods } from './studentActivityScheduleMethods.js';
import { installStudentActivityVocabularyDataMethods } from './studentActivityVocabularyDataMethods.js';
import { installStudentActivityWordHuntMethods } from './studentActivityWordHuntMethods.js';

export class StudentActivities {
    constructor(studentManager) {
        this.sm = studentManager; // Reference to StudentManager instance
        this.wordCoverage = {}; // Track which words have been used in each activity
        this.activityModulePromises = new Map();
        this.activityPreloadKeys = new Set();
        this.wordHuntExportInProgress = false;
    }

}

installStudentActivityBrowserMethods(StudentActivities);
installStudentActivityCalendarMethods(StudentActivities);
installStudentActivityCoverageMethods(StudentActivities);
installStudentActivityHomeMethods(StudentActivities);
installStudentActivityProgressFlowMethods(StudentActivities);
installStudentActivityRuntimeMethods(StudentActivities);
installStudentActivityScheduleMethods(StudentActivities);
installStudentActivityVocabularyDataMethods(StudentActivities);
installStudentActivityWordHuntMethods(StudentActivities);
