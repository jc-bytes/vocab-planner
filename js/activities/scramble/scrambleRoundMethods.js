import { MAX_SCRAMBLE_HINTS } from './scrambleConstants.js';

export const scrambleRoundMethods = {
startRound() {
        if (this.currentIndex >= this.words.length) {
            this.finish();
            return;
        }

        this.currentWord = this.words[this.currentIndex];
        this.targetAnswer = this.normalizeAnswer(this.currentWord.word);
        this.userAnswer = [];
        this.attempts = 0;
        this.hintsUsed = 0;
        this.feedback = '';
        this.feedbackState = 'muted';
        this.shuffledLetters = this.createScrambledLetters(this.targetAnswer);
        this.render();
        this.saveState();
    },

normalizeAnswer(value) {
        return String(value || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    },

createScrambledLetters(answer) {
        const letters = answer.split('');
        let shuffled = [...letters];

        for (let attempt = 0; attempt < 30; attempt++) {
            shuffled = this.shuffleArray([...letters]);
            const samePositionCount = shuffled.filter((letter, index) => letter === letters[index]).length;
            const isDifferent = shuffled.join('') !== answer;
            const hasGoodMix = letters.length < 4 || samePositionCount <= Math.ceil(letters.length * 0.55);
            if (isDifferent && hasGoodMix) break;
        }

        return shuffled.map((char, index) => ({
            char,
            id: `${Date.now()}-${index}-${Math.random().toString(36).slice(2, 8)}`
        }));
    },

shuffleArray(items) {
        for (let index = items.length - 1; index > 0; index--) {
            const swapIndex = Math.floor(Math.random() * (index + 1));
            [items[index], items[swapIndex]] = [items[swapIndex], items[index]];
        }
        return items;
    },

handlePoolClick(letterObj) {
        this.userAnswer.push(letterObj);
        this.shuffledLetters = this.shuffledLetters.filter(letter => letter.id !== letterObj.id);
        this.feedback = '';
        this.render();
        this.saveState();
        this.checkAnswer();
    },

handleAnswerClick(letterObj) {
        this.shuffledLetters.push(letterObj);
        this.userAnswer = this.userAnswer.filter(letter => letter.id !== letterObj.id);
        this.feedback = '';
        this.render();
        this.saveState();
    },

clearAnswer() {
        this.shuffledLetters = [...this.shuffledLetters, ...this.userAnswer];
        this.userAnswer = [];
        this.feedback = '';
        this.feedbackState = 'muted';
        this.render();
        this.saveState();
    },

useHint() {
        if (this.hintsUsed >= MAX_SCRAMBLE_HINTS) return;
        this.hintsUsed++;
        this.feedback = this.getHintText(this.hintsUsed);
        this.feedbackState = 'hint';
        this.render();
        this.saveState();
    },

getHintText(level) {
        if (level === 1) return `Definition: ${this.currentWord.definition || 'No definition available.'}`;
        if (level === 2) return `Starts with "${this.targetAnswer[0]?.toUpperCase() || ''}".`;
        return `Pattern: ${this.getWordPattern()}`;
    },

getWordPattern() {
        return this.targetAnswer
            .split('')
            .map((char, index, letters) => {
                if (index === 0 || index === letters.length - 1) return char.toUpperCase();
                return '_';
            })
            .join(' ');
    },

checkAnswer() {
        const currentString = this.userAnswer.map(letter => letter.char).join('');
        if (currentString.length !== this.targetAnswer.length) return;

        if (currentString === this.targetAnswer) {
            this.solveCurrent();
            return;
        }

        this.attempts++;
        this.answerAttempts++;
        const distance = this.getEditDistance(currentString, this.targetAnswer);
        this.feedback = distance <= 2 ? 'Almost. Check one or two letters.' : 'Not quite. Tap letters to move them back and try again.';
        this.feedbackState = 'error';
        this.render();
        this.saveState();
    },

solveCurrent() {
        const perfectSolve = this.attempts === 0 && this.hintsUsed === 0;
        this.answerAttempts++;
        this.completedCount++;
        this.correctCount++;
        this.streak++;
        this.bestStreak = Math.max(this.bestStreak, this.streak);
        this.feedback = perfectSolve ? 'Perfect solve! Streak bonus.' : 'Correct!';
        this.feedbackState = 'success';
        this.checkProgress();
        this.render();

        this.timeouts.schedule(() => {
            this.currentIndex++;
            this.startRound();
        }, 650);
    },

skipWord() {
        this.recordMissedWord('Skipped');
        this.answerAttempts++;
        this.completedCount++;
        this.streak = 0;
        this.currentIndex++;
        this.checkProgress();
        this.startRound();
    },

recordMissedWord(reason) {
        if (!this.currentWord) return;
        this.missedWords.push({
            word: this.currentWord.word,
            definition: this.currentWord.definition,
            answer: this.targetAnswer,
            reason
        });
    },

getEditDistance(a, b) {
        const rows = Array.from({ length: a.length + 1 }, () => []);
        for (let i = 0; i <= a.length; i++) rows[i][0] = i;
        for (let j = 0; j <= b.length; j++) rows[0][j] = j;

        for (let i = 1; i <= a.length; i++) {
            for (let j = 1; j <= b.length; j++) {
                rows[i][j] = a[i - 1] === b[j - 1]
                    ? rows[i - 1][j - 1]
                    : Math.min(rows[i - 1][j - 1], rows[i][j - 1], rows[i - 1][j]) + 1;
            }
        }

        return rows[a.length][b.length];
    }
};

