export const matchingInteractionMethods = {
handleCardClick(card) {
        if (this.lockBoard || card.disabled) return;

        const id = parseInt(card.dataset.id, 10);
        const type = card.dataset.type;

        if (this.matchedRoundIds.has(id)) return;

        if (type === 'term') {
            this.selectTerm(card, id);
        } else {
            this.selectDefinition(card, id);
        }

        if (this.selectedTerm && this.selectedDefinition) {
            this.resolveSelection();
        }
    },

selectTerm(card, id) {
        if (this.selectedTerm?.card === card) {
            this.clearSelectedCard(this.selectedTerm.card);
            this.selectedTerm = null;
            return;
        }

        if (this.selectedTerm) this.clearSelectedCard(this.selectedTerm.card);
        this.selectedTerm = { card, id };
        this.markSelectedCard(card);
    },

selectDefinition(card, id) {
        if (this.selectedDefinition?.card === card) {
            this.clearSelectedCard(this.selectedDefinition.card);
            this.selectedDefinition = null;
            return;
        }

        if (this.selectedDefinition) this.clearSelectedCard(this.selectedDefinition.card);
        this.selectedDefinition = { card, id };
        this.markSelectedCard(card);
    },

markSelectedCard(card) {
        card.classList.add('selected');
        card.setAttribute('aria-pressed', 'true');
    },

clearSelectedCard(card) {
        card.classList.remove('selected');
        card.setAttribute('aria-pressed', 'false');
    },

resolveSelection() {
        this.lockBoard = true;
        this.attempts++;
        this.roundAttempts++;

        const isMatch = this.selectedTerm.id === this.selectedDefinition.id;

        if (isMatch) {
            this.handleCorrectMatch(this.selectedTerm.id);
        } else {
            this.handleWrongMatch();
        }
    },

handleCorrectMatch(id) {
        this.matchedRoundIds.add(id);
        this.selectedTerm.card.classList.add('correct');
        this.selectedDefinition.card.classList.add('correct');
        this.selectedTerm.card.disabled = true;
        this.selectedDefinition.card.disabled = true;

        this.saveState();
        this.updateHud();

        if (!this.isCurrentRoundComplete()) {
            this.notifyProgress();
        }

        const completedRoundKey = this.getCurrentRoundKey();
        this.roundCompletionDueAt = this.isCurrentRoundComplete() ? Date.now() + 1000 : 0;
        this.scheduleTimeout(() => {
            if (completedRoundKey !== this.getCurrentRoundKey()) return;

            this.resetSelection();
            this.lockBoard = false;

            if (this.isCurrentRoundComplete()) {
                this.completeCurrentRound(completedRoundKey);
            } else {
                this.render();
            }
        }, 350);
    },

handleWrongMatch() {
        this.selectedTerm.card.classList.add('wrong');
        this.selectedDefinition.card.classList.add('wrong');

        this.saveState();
        this.updateHud();
        this.notifyProgress();

        this.scheduleTimeout(() => {
            this.selectedTerm?.card.classList.remove('selected', 'wrong');
            this.selectedDefinition?.card.classList.remove('selected', 'wrong');
            this.selectedTerm?.card?.setAttribute('aria-pressed', 'false');
            this.selectedDefinition?.card?.setAttribute('aria-pressed', 'false');
            this.resetSelection();
            this.lockBoard = false;
        }, 650);
    },

completeCurrentRound(expectedRoundKey = null) {
        if (!this.isCurrentRoundComplete()) return false;
        if (expectedRoundKey && expectedRoundKey !== this.getCurrentRoundKey()) return false;

        this.roundCompletionDueAt = 0;
        const elapsedMs = this.getCurrentRoundElapsedMs();
        const roundSize = this.currentRoundIds.length;
        const roundAccuracy = this.roundAttempts === 0
            ? 100
            : Math.round((roundSize / this.roundAttempts) * 100);

        this.roundStats.push({
            roundNumber: this.roundsCompleted + 1,
            size: roundSize,
            elapsedMs,
            attempts: this.roundAttempts,
            accuracy: roundAccuracy
        });

        this.roundsCompleted++;
        this.correctPairs += roundSize;
        this.matchedRoundIds = new Set();
        this.saveState();
        this.notifyProgress();

        if (this.isSessionComplete()) {
            this.showCompletionScreen();
            return true;
        }

        this.startNewRound();
        this.saveState();
        this.render();
        return true;
    },

resetSelection() {
        this.selectedTerm = null;
        this.selectedDefinition = null;
    },

requestRestart() {
        const shouldRestart = typeof window?.confirm !== 'function' || window.confirm(
            'Start a new matching game? Your progress in this matching game will be reset.'
        );
        if (shouldRestart) this.restart();
    },
};

