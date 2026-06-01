class StudentGameDelegateMethods {
    async formatTime(seconds) {
        return (await this.getGames()).formatTime(seconds);
    }

    async updateArcadeUI() {
        return (await this.getGames()).updateArcadeUI();
    }

    async updateGameSelectionUI() {
        return (await this.getGames()).updateGameSelectionUI();
    }

    async saveHighScore(gameId, score, metadata = null) {
        return (await this.getGames()).saveHighScore(gameId, score, metadata);
    }

    async updateLeaderboardGame() {
        return (await this.getGames()).updateLeaderboardGame();
    }

    async loadLeaderboard(gameId) {
        return (await this.getGames()).loadLeaderboard(gameId);
    }

    async loadHTMLGame(gameId, htmlFile, scoreMessageType, gameOverCallback, canvas, gameStage) {
        return (await this.getGames()).loadHTMLGame(gameId, htmlFile, scoreMessageType, gameOverCallback, canvas, gameStage);
    }

    async startGame(type) {
        return (await this.getGames()).startGame(type);
    }

    async stopCurrentGame() {
        return (await this.getGames()).stopCurrentGame();
    }

    async pauseGame() {
        return (await this.getGames()).pauseGame();
    }

    async addGameTime(seconds = 60) {
        return (await this.getGames()).addGameTime(seconds);
    }

    async updateGameTimer() {
        return (await this.getGames()).updateGameTimer();
    }
}

export function installStudentGameDelegateMethods(StudentManager) {
    for (const name of Object.getOwnPropertyNames(StudentGameDelegateMethods.prototype)) {
        if (name === 'constructor') continue;
        Object.defineProperty(
            StudentManager.prototype,
            name,
            Object.getOwnPropertyDescriptor(StudentGameDelegateMethods.prototype, name)
        );
    }
}
