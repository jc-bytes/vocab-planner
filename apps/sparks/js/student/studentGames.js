/**
 * Student Games & Arcade Module
 * Handles game lifecycle, leaderboards, timer management, and HTML game loading
 */

import { StudentGameHtmlLoader } from './studentGameHtmlLoaderMethods.js';
import { StudentGameLeaderboard } from './studentGameLeaderboardMethods.js';
import { StudentGameLifecycle } from './studentGameLifecycleMethods.js';
import { STUDENT_GAME_REGISTRY } from './studentGameRegistry.js';
import { StudentGameSettings } from './studentGameSettingsMethods.js';
import { StudentGameAccess } from './studentGameAccessMethods.js';
import { readLocalArcadeSession } from './studentArcadeTimeStorage.js';

export class StudentGames {
    constructor(studentManager) {
        this.sm = studentManager;
        this.sessionOwnerId = studentManager.currentUser?.uid || (studentManager.authDisabled ? 'local-dev' : 'anonymous');
        const savedSession = readLocalArcadeSession(this.sessionOwnerId);
        this.currentGame = null;
        this.gameTimeRemaining = savedSession.remainingSeconds;
        this.savedGameId = savedSession.gameId;
        this.gameTimerInterval = null;
        this.isHandlingGameMinute = false;
        this.isAddingGameTime = false;
        this.gamesList = STUDENT_GAME_REGISTRY;
        this.currentGameIndex = 0;
        this.currentGameScore = 0;
        this.currentGameMetadata = null;
        this.lastSavedScore = 0;
        this.isGamePaused = false;
        this.settings = new StudentGameSettings(this);
        this.access = new StudentGameAccess(this);
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

    loadArcadeTime(options = {}) {
        return this.access.loadArcadeTime(options);
    }

    getAvailableArcadeSeconds() {
        return this.access.getAvailableSeconds();
    }

    startArcadeMinute(gameId) {
        return this.access.startMinute(gameId);
    }

    updateArcadeUI(options = {}) {
        return this.settings.updateArcadeUI(options);
    }

    updateGameSelectionUI() {
        return this.settings.updateGameSelectionUI();
    }

    saveHighScore(gameId, score, metadata = null, options = {}) {
        return this.leaderboard.saveHighScore(gameId, score, metadata, options);
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

    exitToGameSelection() {
        return this.lifecycle.exitToGameSelection();
    }

    selectAdjacentGame(offset) {
        return this.lifecycle.selectAdjacentGame(offset);
    }

    requestAdditionalTime() {
        return this.lifecycle.requestAdditionalTime();
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

    addGameTime(seconds) {
        return this.lifecycle.addGameTime(seconds);
    }

    updateGameTimer() {
        return this.lifecycle.updateGameTimer();
    }
}
