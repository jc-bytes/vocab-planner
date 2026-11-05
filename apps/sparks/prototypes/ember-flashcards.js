import { watchEmberIdle } from './ember-idle.js';
import { openSpotlight } from './ember-spotlight.js';
import { FlashcardsActivity } from '../js/activities/flashcards.js';

const words = [
    { word: 'Privacy', definition: 'Keeping personal information protected.', example: 'I protect my privacy by keeping my password secret.' },
    { word: 'Password', definition: 'A secret set of characters used to sign in.', example: 'I use a strong password for my account.' },
    { word: 'Permission', definition: 'Being allowed to do something.' }
];
// Use the real activity without writing sample attempts into student storage.
class PreviewFlashcards extends FlashcardsActivity {
    saveState() {}
    render() {
        this.closeSpotlight?.();
        super.render();
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
            this.showGuide();
        } else if (!this.guideSkipped) {
            if (!this.introductionShown) {
                this.introductionShown = true;
                this.showGuide();
            } else if (review && (this.attemptsByCard[this.currentIndex] || 0) === 2
                && this.lastAutoClueCard !== this.currentIndex) {
                this.lastAutoClueCard = this.currentIndex;
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
        if (complete) steps.splice(0, steps.length, { target: document.getElementById('restart'), pose: 'complete', title: 'Activity complete', message: 'You finished these flashcards! Choose Start again to practise the sample words again.', action: 'Done' });
        this.closeSpotlight = openSpotlight({ steps,
            onSkip: () => { this.guideSkipped = true; this.focusAction(); },
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
        const action = this.getScore().isComplete ? document.getElementById('restart')
            : this.isCurrentCardAnswered() ? this.container.querySelector('#next-card')
            : this.container.querySelector('.flashcard-answer-option, .flashcard-start-question');
        (action || document.getElementById('show-guide')).focus();
    }
    destroy() { this.idleWatch?.destroy(); this.closeSpotlight?.(); super.destroy(); }
}
function start() {
    window.emberPreview?.destroy();
    window.emberPreview = new PreviewFlashcards(
        document.getElementById('activity-container'), words, () => {}, () => {},
        { masteryVersion: 3, answeredCards: [], currentIndex: 0 }
    );
    window.emberPreview.idleWatch = watchEmberIdle(window.emberPreview);
}
document.getElementById('restart').addEventListener('click', start);
start();

document.getElementById('show-guide').addEventListener('click', () => { window.emberPreview.showGuide(); });
