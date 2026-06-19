class StudentProgressDelegateMethods {
    migrateCoinData(data) {
        return this.progress.migrateCoinData(data);
    }

    loadLocalProgress() {
        return this.progress.loadLocalProgress();
    }

    saveLocalProgress(skipCloud = false) {
        return this.progress.saveLocalProgress(skipCloud);
    }

    getExperience() {
        return this.progress.getExperience();
    }

    updateLevelDisplay() {
        return this.progress.updateLevelDisplay();
    }

    async loadCloudProgress() {
        return this.progress.loadCloudProgress();
    }

    scheduleCloudSync() {
        if (!this.currentUser) return;
        this.auth.setAuthStatus('☁️ Saving...');
        clearTimeout(this.cloudSaveTimeout);
        this.cloudSaveTimeout = setTimeout(() => this.progress.saveProgressToCloud(), 1000);
    }

    addCoinHistory(type, amount, source, description = '') {
        return this.progress.addCoinHistory(type, amount, source, description);
    }

    async saveProgressToCloud() {
        return this.progress.saveProgressToCloud();
    }

    async restoreImagesFromProgress() {
        return this.progress.restoreImagesFromProgress();
    }

    dataURLToBlob(dataUrl) {
        return this.progress.dataURLToBlob(dataUrl);
    }

    handleAutoSave(scoreData) {
        return this.activities.handleAutoSave(scoreData);
    }

    handleIllustrationSave(vocabName, word, dataUrl) {
        return this.activities.handleIllustrationSave(vocabName, word, dataUrl);
    }

    handleStateSave(stateData) {
        return this.activities.handleStateSave(stateData);
    }

    addCoins(amount, source = 'activity', description = '') {
        return this.progress.addCoins(amount, source, description);
    }

    async deductCoins(amount) {
        return this.progress.deductCoins(amount);
    }

    async acceptGiftCoins() {
        return this.progress.acceptGiftCoins();
    }

    updateCoinDisplay() {
        return this.progress.updateCoinDisplay();
    }
}

export function installStudentProgressDelegateMethods(StudentManager) {
    for (const name of Object.getOwnPropertyNames(StudentProgressDelegateMethods.prototype)) {
        if (name === 'constructor') continue;
        Object.defineProperty(
            StudentManager.prototype,
            name,
            Object.getOwnPropertyDescriptor(StudentProgressDelegateMethods.prototype, name)
        );
    }
}
