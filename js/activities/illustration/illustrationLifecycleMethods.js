import { createElement } from '../../main.js';

export const illustrationLifecycleMethods = {
async init() {
        this.destroyPasteListener();
        this.container.innerHTML = '';

        if (this.words.length === 0) {
            const emptyState = createElement('div', 'matching-empty-state');
            emptyState.innerHTML = '<h2>Word Hunt</h2><p>No words are available for this unit.</p>';
            this.container.appendChild(emptyState);
            this.checkProgress();
            return;
        }

        await this.refreshImageStatus();
        this.renderWord();
        this.checkProgress();
    },

navigate(direction) {
        const entry = this.getEntry();
        if (direction > 0 && !this.isEntryComplete(entry)) return;

        const newIndex = this.currentIndex + direction;
        if (newIndex >= this.words.length) {
            this.renderCompletion();
            return;
        }

        if (newIndex >= 0) {
            this.setCurrentIndex(newIndex);
        }
    },

destroyPasteListener() {
        if (this.pasteHandler) {
            window.removeEventListener('paste', this.pasteHandler);
            this.pasteHandler = null;
        }
    },

destroyWritingChecker() {
        this.writingCheckerCleanup?.();
        this.writingCheckerCleanup = null;
    },

destroy() {
        this.destroyPasteListener();
        this.destroyWritingChecker();
        if (this.previewUrl) {
            URL.revokeObjectURL(this.previewUrl);
            this.previewUrl = null;
        }
    },
};

