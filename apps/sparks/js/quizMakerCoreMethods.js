import { cleanQuizTitle } from './quizMakerTitle.js';

class QuizMakerCoreMethods {
    init(options = {}) {
        this.renderEditor();
        this.attachGlobalListeners();
        if (options.shouldGenerate !== false) {
            this.generateQuizFromSections();
        }
        this.suppressStateSave = false;
        this.notifyStateChange();
    }

    restoreState(state) {
        if (!state || typeof state !== 'object') return false;

        try {
            if (state.meta && typeof state.meta === 'object') {
                this.meta = {
                    ...this.meta,
                    ...JSON.parse(JSON.stringify(state.meta)),
                    rubric: Array.isArray(state.meta.rubric)
                        ? JSON.parse(JSON.stringify(state.meta.rubric))
                        : this.meta.rubric
                };
                this.meta.title = cleanQuizTitle(this.meta.title);
            }

            if (Array.isArray(state.quizSections)) {
                this.quizSections = JSON.parse(JSON.stringify(state.quizSections));
            }

            if (Array.isArray(state.questions)) {
                this.questions = JSON.parse(JSON.stringify(state.questions));
            }

            const maxSectionId = this.quizSections.reduce((max, section) => {
                const match = String(section.id || '').match(/section-(\d+)/);
                return match ? Math.max(max, parseInt(match[1], 10) || 0) : max;
            }, 0);
            this.sectionIdCounter = Math.max(parseInt(state.sectionIdCounter, 10) || 0, maxSectionId, this.sectionIdCounter);

            return Array.isArray(state.quizSections) || Array.isArray(state.questions);
        } catch (error) {
            console.warn('Could not restore quiz draft state:', error);
            return false;
        }
    }

    serializeState() {
        return JSON.parse(JSON.stringify({
            version: 1,
            meta: this.meta,
            quizSections: this.quizSections,
            questions: this.questions,
            sectionIdCounter: this.sectionIdCounter
        }));
    }

    notifyStateChange() {
        if (this.suppressStateSave || !this.onStateChange) return;
        this.syncSectionsFromInputs();
        this.onStateChange(this.serializeState());
    }

    createQuizSection(type, overrides = {}) {
        const defaults = this.sectionTypes?.[type]?.defaults || {};
        this.sectionIdCounter += 1;
        return {
            id: `section-${this.sectionIdCounter}`,
            type,
            ...defaults,
            ...overrides
        };
    }

    syncSectionsFromInputs() {
        const rows = Array.from(document.querySelectorAll('.quiz-section-card'));
        rows.forEach(row => {
            const section = this.quizSections.find(item => item.id === row.dataset.sectionId);
            if (!section) return;
            section.count = parseInt(row.querySelector('[data-field="count"]')?.value) || 0;
            section.points = parseInt(row.querySelector('[data-field="points"]')?.value) || 0;
            section.choices = parseInt(row.querySelector('[data-field="choices"]')?.value) || section.choices;
            section.correct = parseInt(row.querySelector('[data-field="correct"]')?.value) || section.correct;
        });
    }

    async ensureHtml2Canvas() {
        if (typeof window.html2canvas === 'function') return window.html2canvas;
        const module = await import('html2canvas');
        return module.default || module;
    }

    async ensureJSZip() {
        if (typeof window.JSZip === 'function') return window.JSZip;
        const module = await import('jszip');
        return module.default || module;
    }

    escapeHtml(value = '') {
        return String(value)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }

    generateQuizFromSections() {
        this.syncSectionsFromInputs();
        this.questions = [];
        this.quizSections.forEach(section => {
            const count = parseInt(section.count) || 0;
            if (count > 0) {
                this.addQuestions(section.type, count, parseInt(section.points) || 1, section);
            }
        });
        this.renderEditor();
    }

    scheduleAutoGenerate() {
        window.clearTimeout(this.autoGenerateTimer);
        this.autoGenerateTimer = window.setTimeout(() => this.generateQuizFromSections(), 350);
    }
}

export function installQuizMakerCoreMethods(QuizMaker) {
    for (const name of Object.getOwnPropertyNames(QuizMakerCoreMethods.prototype)) {
        if (name === 'constructor') continue;
        Object.defineProperty(
            QuizMaker.prototype,
            name,
            Object.getOwnPropertyDescriptor(QuizMakerCoreMethods.prototype, name)
        );
    }
}
