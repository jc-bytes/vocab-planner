import { $, closeModal as closeDialog, createElement, openModal } from './main.js';

class TeacherVocabularyWordEditorMethods {
    renderWords() {
        const container = $('#words-container');
        container.innerHTML = '';
        const wordHuntRequired = this.isWordHuntRequired();
        const customWordHunt = this.isWordHuntCustomSelection();
        const showWordHuntSelection = !wordHuntRequired || customWordHunt;
        const wordHuntCount = this.getWordHuntWordCount();
        const filter = String($('#vocab-word-filter')?.value || '').trim().toLowerCase();
        const words = this.vocabSet.words
            .map((word, index) => ({ word, index }))
            .filter(({ word }) => {
                if (!filter) return true;
                return [
                    word.word,
                    word.definition,
                    word.part_of_speech
                ].some(value => String(value || '').toLowerCase().includes(filter));
            });

        if (wordHuntRequired && this.vocabSet.words.length > 0) {
            const summary = createElement('div', 'word-hunt-selection-summary');
            summary.innerHTML = customWordHunt ? `
                <div>
                    <strong>Word Hunt: ${wordHuntCount} of ${this.vocabSet.words.length} words</strong>
                    <span>Custom selection</span>
                </div>
                <button class="btn secondary-btn word-hunt-use-all-btn" type="button">Use All Words</button>
            ` : `
                <div>
                    <strong>Word Hunt: all ${this.vocabSet.words.length} words</strong>
                    <span>Required activity</span>
                </div>
                <button class="btn secondary-btn word-hunt-customize-btn" type="button">Customize</button>
            `;
            summary.querySelector('.word-hunt-customize-btn')?.addEventListener('click', () => {
                this.setWordHuntCustomSelection(true);
            });
            summary.querySelector('.word-hunt-use-all-btn')?.addEventListener('click', () => {
                this.setWordHuntCustomSelection(false);
            });
            container.appendChild(summary);
        }

        words.forEach(({ word, index }) => {
            const card = createElement('div', 'word-card');
            const isWordHunt = this.isWordHuntWord(word);
            const partOfSpeech = word.part_of_speech ? `<span class="pos-tag">${word.part_of_speech}</span>` : '';
            card.classList.toggle('word-hunt-selected', isWordHunt);
            card.classList.toggle('word-hunt-controls-hidden', !showWordHuntSelection);
            card.innerHTML = `
                <div class="word-header">
                    <h3>${word.word}</h3>
                    ${partOfSpeech}
                </div>
                <p class="word-definition">${word.definition}</p>
                ${showWordHuntSelection ? `
                    <label class="word-hunt-card-toggle" title="Include this word in Word Hunt" aria-label="Include ${word.word} in Word Hunt">
                        <input type="checkbox" class="word-hunt-toggle" data-index="${index}" ${isWordHunt ? 'checked' : ''}>
                        <span>Word Hunt</span>
                    </label>
                ` : ''}
                <div class="actions">
                    <button class="btn text-btn edit-btn" data-index="${index}" aria-label="Edit ${word.word}"><i data-lucide="pencil"></i></button>
                    <button class="btn text-btn delete-btn" data-index="${index}" aria-label="Delete ${word.word}"><i data-lucide="trash-2"></i></button>
                </div>
                ${word.image ? `<div class="word-image-path">${word.image}</div>` : ''}
            `;

            card.querySelector('.edit-btn').addEventListener('click', () => this.openWordModal(index));
            card.querySelector('.delete-btn').addEventListener('click', () => this.deleteWord(index));
            card.querySelector('.word-hunt-toggle')?.addEventListener('change', (event) => {
                if (wordHuntRequired) this.setWordHuntCustomSelection(true, { render: false });
                this.vocabSet.words[index].wordHunt = event.target.checked;
                this.renderWords();
                this.triggerAutoSave();
            });

            container.appendChild(card);
        });

        if (!this.vocabSet.words.length || !words.length) {
            const empty = createElement('div', 'vocab-words-empty');
            empty.innerHTML = !this.vocabSet.words.length ? `
                <i data-lucide="book-open"></i>
                <strong>No words yet</strong>
                <span>Add the first word to start building this vocabulary set.</span>
            ` : `
                <i data-lucide="search"></i>
                <strong>No matching words</strong>
                <span>Clear the search to see the full vocabulary list.</span>
            `;
            container.appendChild(empty);
        }

        this.updateVocabularyEditorSummary();
        this.refreshIcons();
    }

    isWordHuntRequired(vocab = this.vocabSet) {
        return this.getActivityFlowConfig(vocab).required.includes('illustration');
    }

    isWordHuntCustomSelection(vocab = this.vocabSet) {
        return vocab?.activitySettings?.wordHuntSelectionMode === 'custom';
    }

    getWordHuntWordCount(vocab = this.vocabSet) {
        const words = Array.isArray(vocab?.words) ? vocab.words : [];
        if (this.isWordHuntRequired(vocab) && !this.isWordHuntCustomSelection(vocab)) {
            return words.length;
        }
        return words.filter(word => this.isWordHuntWord(word)).length;
    }

    setWordHuntCustomSelection(enabled, options = {}) {
        if (!this.vocabSet.activitySettings) this.vocabSet.activitySettings = {};

        if (enabled) {
            this.vocabSet.activitySettings.wordHuntSelectionMode = 'custom';
            this.vocabSet.words.forEach(word => {
                if (word.wordHunt === undefined && word.word_hunt === undefined) {
                    word.wordHunt = true;
                }
            });
        } else {
            delete this.vocabSet.activitySettings.wordHuntSelectionMode;
            this.vocabSet.words.forEach(word => {
                word.wordHunt = true;
                delete word.word_hunt;
            });
        }

        if (options.render !== false) this.renderWords();
        this.triggerAutoSave();
        this.updateVocabularyEditorSummary();
    }

    prepareWordHuntWordsForSave(vocab = this.vocabSet) {
        if (!Array.isArray(vocab?.words)) return vocab;
        if (this.isWordHuntRequired(vocab) && !this.isWordHuntCustomSelection(vocab)) {
            vocab.words.forEach(word => {
                word.wordHunt = true;
                delete word.word_hunt;
            });
        }
        return vocab;
    }

    isWordHuntWord(word = {}) {
        if (this.isWordHuntRequired() && !this.isWordHuntCustomSelection()) {
            return true;
        }
        return word.wordHunt === true || word.wordHunt === 'true' || word.word_hunt === true;
    }

    openWordModal(index = -1) {
        this.editingWordIndex = index;
        const modal = $('#word-modal');
        const title = $('#modal-title');

        // Reset fields
        $('#word-input').value = '';
        $('#pos-input').value = 'noun';
        $('#def-input').value = '';
        $('#example-input').value = '';
        $('#image-input').value = '';
        $('#word-hunt-input').checked = false;
        const wordHuntModalToggle = document.querySelector('.word-hunt-modal-toggle');
        if (wordHuntModalToggle) {
            wordHuntModalToggle.classList.toggle(
                'hidden',
                this.isWordHuntRequired() && !this.isWordHuntCustomSelection()
            );
        }
        this.updateImagePreview('');

        if (index > -1) {
            const word = this.vocabSet.words[index];
            title.textContent = 'Edit Word';
            $('#word-input').value = word.word;
            $('#pos-input').value = word.part_of_speech;
            $('#def-input').value = word.definition;
            $('#example-input').value = word.example || '';
            $('#image-input').value = word.image || '';
            $('#word-hunt-input').checked = this.isWordHuntWord(word);
            this.updateImagePreview(word.image || '');
        } else {
            title.textContent = 'Add New Word';
        }

        openModal(modal, { initialFocus: '#word-input' });
    }

    closeModal() {
        closeDialog('#word-modal');
    }

    saveWord() {
        const existingWord = this.editingWordIndex > -1
            ? this.vocabSet.words[this.editingWordIndex]
            : {};
        const newWord = {
            ...existingWord,
            word: $('#word-input').value.trim(),
            part_of_speech: $('#pos-input').value,
            definition: $('#def-input').value.trim(),
            example: $('#example-input').value.trim(),
            image: $('#image-input').value.trim(),
            wordHunt: this.isWordHuntRequired() && !this.isWordHuntCustomSelection()
                ? true
                : $('#word-hunt-input').checked,
            difficulty: existingWord.difficulty || 1,
            synonyms: existingWord.synonyms || [],
            antonyms: existingWord.antonyms || []
        };
        delete newWord.word_hunt;

        if (!newWord.word || !newWord.definition) {
            alert('Word and Definition are required!');
            return;
        }

        if (this.editingWordIndex > -1) {
            this.vocabSet.words[this.editingWordIndex] = newWord;
        } else {
            this.vocabSet.words.push(newWord);
        }

        this.closeModal();
        this.renderWords();
        this.triggerAutoSave();
    }

    deleteWord(index) {
        if (confirm('Are you sure you want to delete this word?')) {
            this.vocabSet.words.splice(index, 1);
            this.renderWords();
            this.triggerAutoSave();
        }
    }

    updateImagePreview(path) {
        const previewBox = $('#image-preview');
        if (!path) {
            previewBox.textContent = 'No Image';
            previewBox.innerHTML = 'No Image';
            return;
        }

        // In a real repo, this would point to the relative path
        // We can try to load it. If it fails, show error.
        const img = document.createElement('img');
        img.src = path;
        img.onerror = () => {
            previewBox.innerHTML = '<span class="vocab-image-error">Image not found at path</span>';
        };
        img.onload = () => {
            previewBox.innerHTML = '';
            previewBox.appendChild(img);
        };
    }
}

export function installTeacherVocabularyWordEditorMethods(TeacherManager) {
    for (const name of Object.getOwnPropertyNames(TeacherVocabularyWordEditorMethods.prototype)) {
        if (name === 'constructor') continue;
        Object.defineProperty(
            TeacherManager.prototype,
            name,
            Object.getOwnPropertyDescriptor(TeacherVocabularyWordEditorMethods.prototype, name)
        );
    }
}
