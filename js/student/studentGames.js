/**
 * Student Games & Arcade Module
 * Handles game lifecycle, leaderboards, timer management, and HTML game loading
 */

import { StudentGameHtmlLoader } from './studentGameHtmlLoaderMethods.js';
import { StudentGameLeaderboard } from './studentGameLeaderboardMethods.js';
import { StudentGameLifecycle } from './studentGameLifecycleMethods.js';
import { StudentGameSettings } from './studentGameSettingsMethods.js';

export class StudentGames {
    constructor(studentManager) {
        this.sm = studentManager;
        this.settings = new StudentGameSettings(this);
        this.leaderboard = new StudentGameLeaderboard(this);
        this.htmlLoader = new StudentGameHtmlLoader(this);
        this.lifecycle = new StudentGameLifecycle(this);
    }

    formatTime(seconds) {
        return this.settings.formatTime(seconds);
    }

    loadGlobalSettings() {
        return this.settings.loadGlobalSettings();
    }

    getExchangeRate() {
        return this.settings.getExchangeRate();
    }

    updateArcadeUI() {
        return this.settings.updateArcadeUI();
    }

    updateGameSelectionUI() {
        return this.settings.updateGameSelectionUI();
    }

    saveHighScore(gameId, score, metadata = null) {
        return this.leaderboard.saveHighScore(gameId, score, metadata);
    }

    updateLeaderboardGame() {
        return this.leaderboard.updateLeaderboardGame();
    }

    showLeaderboardModal() {
        return this.leaderboard.showLeaderboardModal();
    }

    hideLeaderboardModal() {
        return this.leaderboard.hideLeaderboardModal();
    }

    loadLeaderboard(gameId) {
        return this.leaderboard.loadLeaderboard(gameId);
    }

    loadHTMLGame(gameId, htmlFile, scoreMessageType, gameOverCallback, canvas, gameStage) {
        return this.htmlLoader.loadHTMLGame(
            gameId,
            htmlFile,
            scoreMessageType,
            gameOverCallback,
            canvas,
            gameStage
        );
    }

    getScoreMonitoringScript(gameId, messageType) {
        return this.htmlLoader.getScoreMonitoringScript(gameId, messageType);
    }

    showGameSelection() {
        return this.lifecycle.showGameSelection();
    }

    startGame(type) {
        return this.lifecycle.startGame(type);
    }

    restartCurrentGame(type) {
        return this.lifecycle.restartCurrentGame(type);
    }

    launchGame(type, options = {}) {
        return this.lifecycle.launchGame(type, options);
    }

    clearGameTimer() {
        return this.lifecycle.clearGameTimer();
    }

    startGameTimer() {
        return this.lifecycle.startGameTimer();
    }

    cleanupCurrentGame(options = {}) {
        return this.lifecycle.cleanupCurrentGame(options);
    }

    stopCurrentGame() {
        return this.lifecycle.stopCurrentGame();
    }

    pauseGame() {
        return this.lifecycle.pauseGame();
    }

    addGameTime(seconds = 60) {
        return this.lifecycle.addGameTime(seconds);
    }

    updateGameTimer() {
        return this.lifecycle.updateGameTimer();
    }
}
