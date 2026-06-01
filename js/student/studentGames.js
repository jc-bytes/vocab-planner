/**
 * Student Games & Arcade Module
 * Handles game lifecycle, leaderboards, timer management, and HTML game loading
 */

import { installStudentGameHtmlLoaderMethods } from './studentGameHtmlLoaderMethods.js';
import { installStudentGameLeaderboardMethods } from './studentGameLeaderboardMethods.js';
import { installStudentGameLifecycleMethods } from './studentGameLifecycleMethods.js';
import { installStudentGameSettingsMethods } from './studentGameSettingsMethods.js';

export class StudentGames {
    constructor(studentManager) {
        this.sm = studentManager; // Reference to StudentManager instance
        this.globalSettings = null; // Cache for global gamification settings
    }
}

installStudentGameHtmlLoaderMethods(StudentGames);
installStudentGameLeaderboardMethods(StudentGames);
installStudentGameLifecycleMethods(StudentGames);
installStudentGameSettingsMethods(StudentGames);
