import { studentApi } from '../services/studentApi.js';
import { ARCADE_MINUTE_SECONDS } from './studentArcadePolicy.js';
import { consumeLocalArcadeMinute, readLocalArcadeTime } from './studentArcadeTimeStorage.js';

export class StudentGameAccess {
    constructor(games) {
        this.games = games;
        this.sm = games.sm;
        this.arcadeTime = null;
    }

    getAvailableSeconds() {
        return Math.max(0, Number(this.arcadeTime?.availableSeconds) || 0);
    }

    async loadArcadeTime({ force = false } = {}) {
        if (this.arcadeTime && !force) return this.arcadeTime;
        if (this.sm.authDisabled) {
            this.arcadeTime = readLocalArcadeTime();
        } else if (this.sm.currentUser) {
            this.arcadeTime = await studentApi.getOwnArcadeTime();
        } else {
            this.arcadeTime = { availableSeconds: 0 };
        }
        return this.arcadeTime;
    }

    async startMinute(gameId) {
        if (this.sm.authDisabled) {
            if (this.getAvailableSeconds() < ARCADE_MINUTE_SECONDS) return null;
            const coinCost = this.games.getExchangeRate();
            if (!await this.sm.progress.deductCoins(coinCost)) return null;
            this.arcadeTime = consumeLocalArcadeMinute();
            return this.arcadeTime
                ? { arcadeTime: this.arcadeTime, minuteSeconds: ARCADE_MINUTE_SECONDS, coinCost }
                : null;
        }

        if (!this.sm.currentUser) return null;
        const result = await studentApi.startStudentArcadeMinute({
            gameId,
            clientId: this.sm.progress?.clientId || ''
        });
        if (result?.coinWallet) {
            this.sm.progress.cloud.applyRemoteCoinProgress(result.coinWallet);
        }
        this.arcadeTime = result?.arcadeTime || this.arcadeTime;
        return result;
    }
}
