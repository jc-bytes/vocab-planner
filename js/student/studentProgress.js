/**
 * Student Progress & Coin Management Module
 * Handles progress saving/loading (local & cloud) and coin operations
 */

import { StudentProgressCloud } from './studentProgressCloudMethods.js';
import { StudentProgressCoins } from './studentProgressCoinMethods.js';
import { StudentProgressCore } from './studentProgressCoreMethods.js';
import { StudentCoinNotifications } from './studentCoinNotifications.js';

export class StudentProgress {
    constructor(studentManager) {
        this.sm = studentManager;
        this.clientId = sessionStorage.getItem('student_coin_client_id') ||
            (crypto.randomUUID ? crypto.randomUUID() : `client-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`);
        sessionStorage.setItem('student_coin_client_id', this.clientId);
        this.scheduledCloudSaveTimeout = null;
        this.core = new StudentProgressCore(this);
        this.cloud = new StudentProgressCloud(this);
        this.coins = new StudentProgressCoins(this);
        this.notifications = new StudentCoinNotifications(this);
    }

    getExperience() {
        return this.core.getExperience();
    }

    updateLevelDisplay() {
        return this.core.updateLevelDisplay();
    }

    migrateCoinData(data) {
        return this.core.migrateCoinData(data);
    }

    normalizeCoinData(coinData = {}) {
        return this.core.normalizeCoinData(coinData);
    }

    normalizeTimestamp(timestamp) {
        return this.core.normalizeTimestamp(timestamp);
    }

    coinHistoryFingerprint(entry = {}) {
        return this.core.coinHistoryFingerprint(entry);
    }

    normalizeCoinHistory(history = []) {
        return this.core.normalizeCoinHistory(history);
    }

    mergeCoinHistories(...histories) {
        return this.core.mergeCoinHistories(...histories);
    }

    timestampMs(value) {
        return this.core.timestampMs(value);
    }

    latestCoinHistoryMs(history = this.sm.coinHistory) {
        return this.core.latestCoinHistoryMs(history);
    }

    getUnsyncedLocalCoinHistory(cloudHistory = []) {
        return this.core.getUnsyncedLocalCoinHistory(cloudHistory);
    }

    hasAuthoritativeLocalCoinActivity(cloudHistory = [], cloudUpdatedAt = null) {
        return this.core.hasAuthoritativeLocalCoinActivity(cloudHistory, cloudUpdatedAt);
    }

    loadLocalProgress() {
        return this.core.loadLocalProgress();
    }

    saveLocalProgress(skipCloud = false) {
        return this.core.saveLocalProgress(skipCloud);
    }

    scheduleCloudSync() {
        if (!this.sm.currentUser) return;
        this.sm.setAuthStatus('☁️ Saving...');
        this.cancelScheduledCloudSync();
        this.scheduledCloudSaveTimeout = setTimeout(() => {
            this.scheduledCloudSaveTimeout = null;
            this.saveProgressToCloud();
        }, 1000);
    }

    cancelScheduledCloudSync() {
        if (!this.scheduledCloudSaveTimeout) return;
        clearTimeout(this.scheduledCloudSaveTimeout);
        this.scheduledCloudSaveTimeout = null;
    }

    applyCoinSnapshot(coinData, coinHistory, options = {}) {
        return this.core.applyCoinSnapshot(coinData, coinHistory, options);
    }

    applyProgressSnapshot(progress, options = {}) {
        return this.core.applyProgressSnapshot(progress, options);
    }

    shouldApplyIncomingLocalCoins(data) {
        return this.core.shouldApplyIncomingLocalCoins(data);
    }

    applyLocalProgressFromStorage(rawValue) {
        return this.core.applyLocalProgressFromStorage(rawValue);
    }

    startCoinSync() {
        return this.cloud.startCoinSync();
    }

    stopCoinSync() {
        return this.cloud.stopCoinSync();
    }

    scheduleCoinRefresh(options = {}) {
        return this.cloud.scheduleCoinRefresh(options);
    }

    applyRemoteCoinProgress(progress) {
        return this.cloud.applyRemoteCoinProgress(progress);
    }

    refreshCoinsFromCloud(options = {}) {
        return this.cloud.refreshCoinsFromCloud(options);
    }

    loadCloudProgress() {
        return this.cloud.loadCloudProgress();
    }

    saveProgressToCloud() {
        return this.cloud.saveProgressToCloud();
    }

    buildUnitWorkSyncPayload() {
        return this.cloud.buildUnitWorkSyncPayload();
    }

    enqueueProgressSync() {
        return this.cloud.enqueueProgressSync();
    }

    flushLocalSyncQueue(options = {}) {
        return this.cloud.flushLocalSyncQueue(options);
    }

    restoreImagesFromProgress() {
        return this.cloud.restoreImagesFromProgress();
    }

    dataURLToBlob(dataUrl) {
        return this.cloud.dataURLToBlob(dataUrl);
    }

    addCoinHistory(type, amount, source, description = '') {
        return this.coins.addCoinHistory(type, amount, source, description);
    }

    addCoins(amount, source = 'activity', description = '') {
        return this.coins.addCoins(amount, source, description);
    }

    deductCoins(amount) {
        return this.coins.deductCoins(amount);
    }

    acceptGiftCoins() {
        return this.coins.acceptGiftCoins();
    }

    updateCoinDisplay() {
        return this.coins.updateCoinDisplay();
    }

    showNotificationBadge() {
        return this.notifications.showNotificationBadge();
    }

    hideNotificationBadge() {
        return this.notifications.hideNotificationBadge();
    }

    showNotificationPanel() {
        return this.notifications.showNotificationPanel();
    }
}
