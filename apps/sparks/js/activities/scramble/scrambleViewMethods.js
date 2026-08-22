import { createElement } from '../../main.js';
import { MAX_SCRAMBLE_HINTS } from './scrambleConstants.js';

export const scrambleViewMethods = {
render() {
        if (this.isFinished) {
            this.renderSummary();
            return;
        }

        this.container.innerHTML = '';

        const wrapper = createElement('div', 'scramble-wrapper');

        const header = createElement('div', 'scramble-header');
        header.innerHTML = `
            <div>
                <div class="scramble-kicker">Word ${this.currentIndex + 1} of ${this.words.length}</div>
                <h2>Unscramble the word</h2>
            </div>
            <div class="scramble-stats">
                <span>Streak ${this.streak}</span>
                <span>Best ${this.bestStreak}</span>
            </div>
        `;
        wrapper.appendChild(header);

        const progress = createElement('div', 'scramble-progress');
        const progressFill = createElement('div', 'scramble-progress-fill');
        progressFill.style.width = `${this.words.length ? (this.completedCount / this.words.length) * 100 : 0}%`;
        progress.appendChild(progressFill);
        wrapper.appendChild(progress);

        const clue = createElement('div', 'scramble-clue');
        clue.innerHTML = this.renderHintHtml();
        wrapper.appendChild(clue);

        const answerArea = createElement('div', `scramble-answer-area ${this.feedbackState === 'error' ? 'is-shaking' : ''}`);
        for (let i = 0; i < this.targetAnswer.length; i++) {
            const slot = createElement('div', 'scramble-slot');
            if (this.userAnswer[i]) {
                const tile = createElement('button', 'scramble-tile in-answer', this.userAnswer[i].char.toUpperCase());
                tile.type = 'button';
                tile.setAttribute('aria-label', `Remove ${this.userAnswer[i].char}`);
                tile.addEventListener('click', () => this.handleAnswerClick(this.userAnswer[i]));
                slot.appendChild(tile);
            }
            answerArea.appendChild(slot);
        }
        wrapper.appendChild(answerArea);

        const poolArea = createElement('div', 'scramble-pool-area');
        this.shuffledLetters.forEach(letter => {
            const tile = createElement('button', 'scramble-tile', letter.char.toUpperCase());
            tile.type = 'button';
            tile.setAttribute('aria-label', `Use ${letter.char}`);
            tile.addEventListener('click', () => this.handlePoolClick(letter));
            poolArea.appendChild(tile);
        });
        wrapper.appendChild(poolArea);

        const feedback = createElement('div', `scramble-feedback ${this.feedbackState}`, this.feedback);
        wrapper.appendChild(feedback);

        const actions = createElement('div', 'scramble-actions');
        const hintBtn = createElement('button', 'btn secondary-btn', this.hintsUsed >= MAX_SCRAMBLE_HINTS ? 'No More Hints' : `Hint ${this.hintsUsed + 1}`);
        hintBtn.type = 'button';
        hintBtn.disabled = this.hintsUsed >= MAX_SCRAMBLE_HINTS;
        hintBtn.addEventListener('click', () => this.useHint());
        actions.appendChild(hintBtn);

        const clearBtn = createElement('button', 'btn secondary-btn', 'Clear');
        clearBtn.type = 'button';
        clearBtn.disabled = this.userAnswer.length === 0;
        clearBtn.addEventListener('click', () => this.clearAnswer());
        actions.appendChild(clearBtn);

        const skipBtn = createElement('button', 'btn text-btn', 'Skip');
        skipBtn.type = 'button';
        skipBtn.addEventListener('click', () => this.skipWord());
        actions.appendChild(skipBtn);

        wrapper.appendChild(actions);
        this.container.appendChild(wrapper);
    },

renderHintHtml() {
        const hints = [];
        if (this.hintsUsed >= 1) hints.push(`<li>${this.escapeHtml(this.currentWord.definition || 'No definition available.')}</li>`);
        if (this.hintsUsed >= 2) hints.push(`<li>First letter: <strong>${this.escapeHtml(this.targetAnswer[0]?.toUpperCase() || '')}</strong></li>`);
        if (this.hintsUsed >= 3) hints.push(`<li>${this.escapeHtml(this.getWordPattern())}</li>`);

        if (!hints.length) {
            return `<div class="scramble-clue-empty">Use the letters below. Hints reveal the definition, first letter, and pattern.</div>`;
        }

        return `<ul>${hints.join('')}</ul>`;
    },

renderSummary() {
        const accuracy = this.answerAttempts ? Math.round((this.correctCount / this.answerAttempts) * 100) : 0;
        this.container.innerHTML = `
            <div class="completion-screen scramble-summary">
                <h2>All Words Unscrambled!</h2>
                <div class="scramble-summary-grid">
                    <div><strong>${this.correctCount}</strong><span>Correct</span></div>
                    <div><strong>${accuracy}%</strong><span>Accuracy</span></div>
                    <div><strong>${this.bestStreak}</strong><span>Best Streak</span></div>
                </div>
                ${this.renderMissedReview()}
                <div class="scramble-actions">
                    <button id="replay-scramble" class="btn primary-btn" type="button">Play Again</button>
                    <button id="retry-missed-scramble" class="btn secondary-btn" type="button" ${this.missedWords.length ? '' : 'disabled'}>Retry Missed</button>
                </div>
            </div>
        `;

        this.container.querySelector('#replay-scramble')?.addEventListener('click', () => this.restart());
        this.container.querySelector('#retry-missed-scramble')?.addEventListener('click', () => this.retryMissed());
    },

renderMissedReview() {
        if (!this.missedWords.length) {
            return '<p class="scramble-review-empty">Perfect run. Nice work.</p>';
        }

        return `
            <div class="scramble-review">
                <h3>Review</h3>
                ${this.missedWords.map(item => `
                    <div class="scramble-review-item">
                        <strong>${this.escapeHtml(item.word)}</strong>
                        <span>${this.escapeHtml(item.definition || 'No definition available.')}</span>
                    </div>
                `).join('')}
            </div>
        `;
    },

escapeHtml(value) {
        return String(value ?? '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }
};

