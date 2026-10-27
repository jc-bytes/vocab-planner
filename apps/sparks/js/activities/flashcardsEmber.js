import { openSpotlight } from './emberSpotlight.js';
import { watchEmberIdle } from './emberIdle.js';

export class FlashcardsEmber {
    updateEmber() {
        this.idleWatch?.reset();
        const complete = this.getScore().isComplete;
        const review = this.isCurrentCardReviewLocked();
        if (review) {
            const clue = document.createElement('button');
            clue.type = 'button';
            clue.className = 'btn secondary-btn';
            clue.textContent = 'Show a clue';
            clue.addEventListener('click', () => this.showGuide());
            this.container.querySelector('.flashcard-mastery-check').append(clue);
        }
        if (complete && !this.completionShown) {
            this.completionShown = true;
            this.saveState();
            this.showGuide();
        } else if (!this.guideSkipped) {
            if (!this.introductionShown) {
                this.introductionShown = true;
                this.saveState();
                this.showGuide();
            } else if (review && (this.attemptsByCard[this.currentIndex] || 0) === 2
                && this.lastAutoClueCard !== this.currentIndex) {
                this.lastAutoClueCard = this.currentIndex;
                this.saveState();
                this.showGuide();
            }
        }
    }
    showGuide() {
        this.idleWatch?.dismiss();
        this.closeSpotlight?.();
        const target = this.container.querySelector('.card-back .definition');
        const example = this.container.querySelector('.card-back .example');
        const complete = this.getScore().isComplete;
        const review = this.isCurrentCardReviewLocked();
        const answered = this.isCurrentCardAnswered() && !complete;
        if (!target) return;
        const answering = this.isCurrentQuestionReady() && !review && !complete && !this.isCurrentCardAnswered();
        const steps = [{ target, pose: review ? 'clue' : 'step',
            title: review ? 'Try this clue' : 'Learn its meaning',
            message: review ? 'Read the meaning again. Then try the question.' : `Read what “${this.words[this.currentIndex].word}” means.` }];
        if (!review) steps.unshift({ target: this.container.querySelector('.card-back .flashcard-definition-term'), pose: 'step', title: 'Read the word', message: 'Read this word before you learn its meaning.' });
        if (example) steps.push({ target: example, pose: 'example', title: 'Read the example', message: 'Read this example. How is the word used?' });
        if (answering) steps.splice(0, steps.length, { target: this.container.querySelector('.flashcard-mastery-check h3'), pose: 'calm', title: 'Take your time', message: 'Read the choices. Choose the meaning that fits.', action: 'Continue' });
        if (answered) steps.splice(0, steps.length, { target: this.container.querySelector('#next-card'), pose: 'correct', title: 'You got it', message: 'Choose Next to study the next word.', action: 'Got it' });
        if (complete) steps.splice(0, steps.length, { target: document.getElementById('back-to-menu-btn'), pose: 'complete', title: 'Activity complete', message: 'You answered every card! Choose Back to see your activities.', action: 'Done' });
        this.closeSpotlight = openSpotlight({ steps,
            onSkip: () => { this.guideSkipped = true; this.saveState(); this.focusAction(); },
            onFinish: () => {
                if (complete || answering || answered) { this.focusAction(); return; }
                if (review) this.completeAnswerReview();
                else if (!this.isCurrentCardAnswered()) this.handleStartQuestion();
                this.focusAction();
            }
        });
    }
    focusAction() {
        this.idleWatch?.reset();
        const action = this.getScore().isComplete ? document.getElementById('back-to-menu-btn')
            : this.isCurrentCardAnswered() ? this.container.querySelector('#next-card')
            : this.container.querySelector('.flashcard-answer-option, .flashcard-start-question');
        (action || this.emberHelpButton).focus();
    }
    setupEmber() {
        const header = document.querySelector('.student-top-bar .student-sidebar-context');
        if (!header || !this.words.length) return;
        this.emberHelpButton = document.createElement('button');
        this.emberHelpButton.type = 'button';
        this.emberHelpButton.className = 'btn secondary-btn ember-help-button';
        this.emberHelpButton.textContent = 'What’s next?';
        this.emberHelpButton.setAttribute('aria-haspopup', 'dialog');
        this.emberHelpButton.addEventListener('click', () => this.showGuide());
        header.prepend(this.emberHelpButton);
        this.idleWatch = watchEmberIdle(this);
    }
    destroyEmber() {
        cancelAnimationFrame(this.emberFrame);
        this.idleWatch?.destroy();
        this.closeSpotlight?.();
        this.emberHelpButton?.remove();
    }
}
