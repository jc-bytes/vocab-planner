import { renderArcadeHeader } from './studentArcadeHeader.js';
import { studentApi } from '../services/studentApi.js';
import { ARCADE_MINUTE_SECONDS } from './studentArcadePolicy.js';
import { consumeLocalArcadeMinute, readLocalArcadeTime } from './studentArcadeTimeStorage.js';

export function captureArcadeSession(games) {
    const { sm } = games;
    const owner = () => sm.currentUser?.uid || sm.currentUser?.id || (sm.authDisabled ? 'local-dev' : 'anonymous');
    const ownerId = owner();
    const progress = sm.progress;
    const cloud = progress?.cloud;
    const generation = cloud?.cloudGeneration;
    const local = sm.authDisabled;
    return () => !games.destroyed && ownerId === games.sessionOwnerId && owner() === ownerId
        && sm.authDisabled === local && sm.progress === progress && progress?.cloud === cloud
        && cloud?.cloudGeneration === generation;
}

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
        const isCurrent = captureArcadeSession(this.games);
        if (!isCurrent()) return null;
        if (this.arcadeTime && !force) return this.arcadeTime;
        const arcadeTime = this.sm.authDisabled ? readLocalArcadeTime()
            : this.sm.currentUser ? await studentApi.getOwnArcadeTime() : { availableSeconds: 0 };
        if (!isCurrent()) return null;
        this.arcadeTime = arcadeTime;
        renderArcadeHeader(this.getAvailableSeconds());
        return this.arcadeTime;
    }

    async startMinute(gameId) {
        const isCurrent = captureArcadeSession(this.games);
        if (!isCurrent()) return null;
        const progress = this.sm.progress;
        if (this.sm.authDisabled) {
            if (this.getAvailableSeconds() < ARCADE_MINUTE_SECONDS) return null;
            const coinCost = this.games.getExchangeRate();
            if (!await progress.deductCoins(coinCost) || !isCurrent()) return null;
            this.arcadeTime = consumeLocalArcadeMinute();
            renderArcadeHeader(this.getAvailableSeconds());
            return this.arcadeTime
                ? { arcadeTime: this.arcadeTime, minuteSeconds: ARCADE_MINUTE_SECONDS, coinCost }
                : null;
        }

        if (!this.sm.currentUser) return null;
        let result;
        try {
            result = await studentApi.startStudentArcadeMinute({
                gameId,
                clientId: progress?.clientId || ''
            }, { isCurrent });
        } catch (error) {
            if (!isCurrent()) return null;
            throw error;
        }
        if (!isCurrent()) return null;
        if (result?.coinWallet) {
            progress.cloud.applyRemoteCoinProgress(result.coinWallet);
        }
        this.arcadeTime = result?.arcadeTime || this.arcadeTime;
        renderArcadeHeader(this.getAvailableSeconds());
        return result;
    }
}
