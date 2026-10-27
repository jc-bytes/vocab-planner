import { requestWithTimeout } from '../services/requestReliability.js';
import { studentApi } from '../services/studentApi.js';
import { createUniqueId } from '../randomUtils.js';
import { ARCADE_MINUTE_SECONDS, MAX_QUEUED_ARCADE_SECONDS } from './studentArcadePolicy.js';
import { readLocalArcadeSession, writeLocalArcadeSession } from './studentArcadeSessionStorage.js';
import { prepareArcadeEligibility } from './studentArcadeEligibility.js';

// A purchase remains the same event until its paid minute is stored atomically.
// This module belongs to the lazy Arcade feature, not account startup.
export class StudentArcadePurchase {
    constructor(games, { timeoutMs = 30000 } = {}) {
        this.games = games;
        this.inFlight = null;
        this.timeoutMs = timeoutMs;
    }

    hasPending() {
        return Boolean(readLocalArcadeSession(this.games.sessionOwnerId, { strict: true }).pendingPurchase);
    }

    run(gameId, isCurrent) {
        if (this.inFlight) return this.inFlight;
        const operation = requestWithTimeout(signal => {
            const execute = () => {
                signal.throwIfAborted();
                return this.perform(gameId, isCurrent, signal);
            };
            const locks = globalThis.navigator?.locks;
            return locks?.request
                ? locks.request(`sparks-arcade-purchase:${this.games.sessionOwnerId}`, { signal }, execute)
                : execute();
        }, { timeoutMs: this.timeoutMs, label: 'Checking the Arcade purchase' });
        this.inFlight = Promise.resolve(operation).finally(() => { this.inFlight = null; });
        return this.inFlight;
    }

    async perform(gameId, isCurrent, signal) {
        signal.throwIfAborted();
        if (!isCurrent()) return null;
        const ownerId = this.games.sessionOwnerId;
        let saved = readLocalArcadeSession(ownerId, { strict: true });
        let pending = saved.pendingPurchase;
        let authorization;
        let result;
        let needsSpend = !pending;
        if (!pending && !gameId) {
            this.games.gameTimeRemaining = saved.remainingSeconds;
            this.games.savedGameId = saved.gameId;
            this.games.arcadeSessionEventId = saved.lastAppliedEventId;
            return null;
        }
        if (pending) {
            const recovery = await studentApi.recoverStudentArcadeMinute({ ...pending }, {
                signal, ownerUserId: ownerId, isCurrent: () => !signal.aborted && isCurrent()
            });
            signal.throwIfAborted();
            if (!isCurrent()) return null;
            if (!recovery || Array.isArray(recovery) || typeof recovery.receiptFound !== 'boolean'
                || recovery.receiptFound && (!recovery.purchase || typeof recovery.purchase !== 'object' || Array.isArray(recovery.purchase))
                || !recovery.receiptFound && recovery.purchase != null) {
                throw new Error('The Arcade receipt could not be checked. Try again to check the same receipt.');
            }
            if (recovery.receiptFound) result = recovery.purchase;
            else needsSpend = true;
        }
        if (needsSpend) {
            if (saved.remainingSeconds > MAX_QUEUED_ARCADE_SECONDS - ARCADE_MINUTE_SECONDS) {
                throw new Error('Use some of your saved Arcade time before adding another minute.');
            }
            authorization = await prepareArcadeEligibility(this.games.sm, { isCurrent });
            if (!authorization?.isCurrent()) return null;
            if (authorization.access.isBlocked) {
                const error = new Error('Complete your required activities before playing Arcade games.');
                error.code = 'ARCADE_REQUIRED_WORK';
                throw error;
            }
            if (!pending) {
                pending = { eventId: createUniqueId('arcade-minute:'), gameId,
                    clientId: this.games.sm.progress?.clientId || '' };
                // A quota/storage failure must stop the request before a debit.
                writeLocalArcadeSession(ownerId, { pendingPurchase: pending }, { strict: true });
            }
        }
        signal.throwIfAborted();
        try {
            if (needsSpend) result = await studentApi.startStudentArcadeMinute({ ...pending }, {
                signal, ownerUserId: ownerId,
                isCurrent: () => !signal.aborted && isCurrent() && (!authorization || authorization.isCurrent())
            });
        } catch (error) {
            // These checks run after receipt replay on the server, so they prove
            // this event never purchased a minute. Other failures stay uncertain.
            const rejected = error?.code === 'P0001' && [
                'Not enough coins.', 'Complete another formative activity before continuing the Arcade.'
            ].includes(error.message);
            if (!signal.aborted && isCurrent() && rejected) {
                const current = readLocalArcadeSession(ownerId, { strict: true });
                if (current.pendingPurchase?.eventId === pending.eventId) {
                    writeLocalArcadeSession(ownerId, { pendingPurchase: null }, { strict: true });
                }
            }
            throw error;
        }
        signal.throwIfAborted();
        if (!isCurrent()) return null;
        if (Number(result?.minuteSeconds) !== ARCADE_MINUTE_SECONDS) {
            throw new Error('The Arcade server did not confirm the purchased minute. Try again to check the same receipt.');
        }
        saved = readLocalArcadeSession(ownerId, { strict: true });
        if (saved.pendingPurchase?.eventId !== pending.eventId) {
            // A different tab may already have reconciled this same receipt.
            if (saved.lastAppliedEventId !== pending.eventId) throw new Error('Arcade purchase state changed. Reload to check your saved receipt.');
        } else {
            saved = writeLocalArcadeSession(ownerId, {
                remainingSeconds: saved.lastAppliedEventId === pending.eventId ? saved.remainingSeconds
                    : saved.remainingSeconds + ARCADE_MINUTE_SECONDS,
                gameId: this.games.currentGame?.gameType || this.games.savedGameId || pending.gameId,
                lastAppliedEventId: pending.eventId,
                pendingPurchase: null
            }, { strict: true });
        }
        this.games.gameTimeRemaining = saved.remainingSeconds;
        this.games.savedGameId = saved.gameId;
        this.games.arcadeSessionEventId = saved.lastAppliedEventId;
        return { ...result, localCreditApplied: true };
    }
}
