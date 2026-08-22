export const matchingRoundMethods = {
getAllIds() {
        return this.words.map((_, index) => index);
    },

getRoundSize() {
        return Math.min(this.roundSize, this.words.length);
    },

shuffleIds(ids) {
        return [...ids].sort(() => Math.random() - 0.5);
    },

sampleRoundIds() {
        return this.shuffleIds(this.getAllIds()).slice(0, this.getRoundSize());
    },

ensureActiveRound() {
        if (this.words.length === 0 || this.isSessionComplete()) return;

        this.currentRoundIds = this.sanitizeIds(this.currentRoundIds);
        this.matchedRoundIds = new Set(
            this.sanitizeIds(Array.from(this.matchedRoundIds))
                .filter(id => this.currentRoundIds.includes(id))
        );

        if (this.currentRoundIds.length !== this.getRoundSize()) {
            this.startNewRound();
            return;
        }

        this.termOrder = this.ensureOrderForRound(this.termOrder);
        this.definitionOrder = this.ensureOrderForRound(this.definitionOrder);
        this.rotateMatchingDefinitionOrder();
    },

ensureOrderForRound(order) {
        const roundIds = new Set(this.currentRoundIds);
        const cleanOrder = this.sanitizeIds(order).filter(id => roundIds.has(id));
        const included = new Set(cleanOrder);
        return [
            ...cleanOrder,
            ...this.currentRoundIds.filter(id => !included.has(id))
        ];
    },

rotateMatchingDefinitionOrder() {
        if (
            this.definitionOrder.length > 1 &&
            this.definitionOrder.every((id, index) => id === this.termOrder[index])
        ) {
            this.definitionOrder.push(this.definitionOrder.shift());
        }
    },

startNewRound() {
        this.currentRoundIds = this.sampleRoundIds();
        this.termOrder = this.shuffleIds(this.currentRoundIds);
        this.definitionOrder = this.shuffleIds(this.currentRoundIds);
        this.rotateMatchingDefinitionOrder();
        this.matchedRoundIds = new Set();
        this.roundAttempts = 0;
        this.roundStartedAt = Date.now();
        this.resetSelection();
    },

getCurrentRoundNumber() {
        return Math.min(this.targetRounds, this.roundsCompleted + 1);
    },

getCurrentRoundMatchedCount() {
        return this.matchedRoundIds.size;
    },

getCompletedPairCount() {
        return this.correctPairs + this.getCurrentRoundMatchedCount();
    },

getTargetPairCount() {
        return this.targetRounds * this.getRoundSize();
    },

getProgressPercent() {
        const targetPairs = this.getTargetPairCount();
        if (targetPairs === 0) return 0;
        return Math.min(100, Math.round((this.getCompletedPairCount() / targetPairs) * 100));
    },

getAccuracyPercent() {
        if (this.attempts === 0) return 0;
        return Math.round((this.getCompletedPairCount() / this.attempts) * 100);
    },

getCurrentRoundElapsedMs() {
        if (this.words.length === 0 || this.isSessionComplete()) return 0;
        return Math.max(0, Date.now() - this.roundStartedAt);
    },

getTimedPairsCount() {
        return this.roundStats.reduce((total, stat) => total + stat.size, 0);
    },

getTotalTimedMs() {
        return this.roundStats.reduce((total, stat) => total + stat.elapsedMs, 0);
    },

getFastestRound() {
        if (this.roundStats.length === 0) return null;
        return this.roundStats.reduce((fastest, stat) => (
            stat.elapsedMs < fastest.elapsedMs ? stat : fastest
        ));
    },

getAverageSecondsPerPair() {
        const timedPairs = this.getTimedPairsCount();
        if (timedPairs === 0) return null;
        return this.getTotalTimedMs() / timedPairs / 1000;
    },

formatDuration(ms) {
        const totalSeconds = Math.max(0, Math.floor(ms / 1000));
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;
        return `${minutes}:${String(seconds).padStart(2, '0')}`;
    },

getBestRoundLabel() {
        const fastest = this.getFastestRound();
        return fastest ? this.formatDuration(fastest.elapsedMs) : '--';
    },

getAverageSpeedLabel() {
        const averageSeconds = this.getAverageSecondsPerPair();
        return averageSeconds === null ? '--' : `${averageSeconds.toFixed(1)}s/pair`;
    },

isCurrentRoundComplete() {
        return this.currentRoundIds.length > 0 && this.currentRoundIds.every(id => this.matchedRoundIds.has(id));
    },

getCurrentRoundKey() {
        return `${this.roundsCompleted}:${this.currentRoundIds.join(',')}`;
    },

isSessionComplete() {
        return this.words.length > 0 && this.roundsCompleted >= this.targetRounds;
    },

getScore() {
        const progress = this.getProgressPercent();
        const accuracy = this.getAccuracyPercent();
        const completedPairs = this.getCompletedPairCount();
        const targetPairs = this.getTargetPairCount();
        const isComplete = this.isSessionComplete();
        const speedDetails = this.roundStats.length > 0
            ? ` Fastest set: ${this.getBestRoundLabel()}. Average: ${this.getAverageSpeedLabel()}.`
            : '';

        return {
            score: progress,
            details: `Matched ${completedPairs}/${targetPairs} round pairs. Completed ${this.roundsCompleted}/${this.targetRounds} sets. Accuracy: ${accuracy}% (${this.attempts} attempts).${speedDetails}`,
            evidence: {
                correctCount: completedPairs,
                totalCount: targetPairs,
                completedRounds: this.roundsCompleted,
                targetRounds: this.targetRounds,
                attemptedCount: this.attempts,
                accuracy
            },
            isComplete
        };
    },
};

