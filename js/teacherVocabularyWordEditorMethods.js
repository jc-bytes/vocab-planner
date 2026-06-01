import { $, closeModal as closeDialog, createElement, openModal } from './main.js';

class TeacherVocabularyWordEditorMethods {
    renderWords() {
        const container = $('#words-container');
        container.innerHTML = '';
        const selectedCount = this.vocabSet.words.filter(word => this.isWordHuntWord(word)).length;
        const summary = createElement('div', 'word-hunt-selection-summary');
        summary.innerHTML = `
            <strong>Word Hunt</strong>
            <span>${selectedCount} ${selectedCount === 1 ? 'word' : 'words'} selected</span>
        `;
        container.appendChild(summary);

        this.vocabSet.words.forEach((word, index) => {
            const card = createElement('div', 'word-card');
            const isWordHunt = this.isWordHuntWord(word);
            card.classList.toggle('word-hunt-selected', isWordHunt);
            card.innerHTML = `
                <div class="word-header" style="display:flex; justify-content:space-between; align-items:center;">
                    <h3>${word.word}</h3>
                    <div class="actions">
                        <button class="btn text-btn edit-btn" data-index="${index}" aria-label="Edit word"><i data-lucide="pencil"></i></button>
                        <button class="btn text-btn delete-btn" data-index="${index}" style="color:var(--danger-color)" aria-label="Delete word"><i data-lucide="trash-2"></i></button>
                    </div>
                </div>
                <span class="pos-tag">${word.part_of_speech}</span>
                ${isWordHunt ? '<span class="word-hunt-badge">Word Hunt</span>' : ''}
                <p>${word.definition}</p>
                <label class="word-hunt-card-toggle">
                    <input type="checkbox" class="word-hunt-toggle" data-index="${index}" ${isWordHunt ? 'checked' : ''}>
                    <span>Word Hunt</span>
                </label>
                ${word.image ? `<div style="margin-top:0.5rem; font-size:0.8rem; color:var(--text-muted)">${word.image}</div>` : ''}
            `;

            card.querySelector('.edit-btn').addEventListener('click', () => this.openWordModal(index));
            card.querySelector('.delete-btn').addEventListener('click', () => this.deleteWord(index));
            card.querySelector('.word-hunt-toggle').addEventListener('change', (event) => {
                this.vocabSet.words[index].wordHunt = event.target.checked;
                this.renderWords();
                this.triggerAutoSave();
            });

            container.appendChild(card);
        });
        this.refreshIcons();
    }

    isWordHuntWord(word = {}) {
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
            wordHunt: $('#word-hunt-input').checked,
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
            previewBox.innerHTML = `<span style="color:var(--danger-color)">Image not found at path</span>`;
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
