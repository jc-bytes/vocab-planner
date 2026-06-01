import { $, closeModal as closeDialog, createElement, notifications, openModal } from './main.js';
import {
    DEFAULT_SUBJECT_SLUG,
    getVocabSubjectSlug
} from './services/vocabularyApi.js';

const VOCAB_ACTIVITY_OPTIONS = [
    { id: 'illustration', label: 'Word Hunt' },
    { id: 'matching', label: 'Matching' },
    { id: 'flashcards', label: 'Flashcards' },
    { id: 'quiz', label: 'Quiz' },
    { id: 'synonym-antonym', label: 'Synonym & Antonym' },
    { id: 'word-search', label: 'Word Search' },
    { id: 'crossword', label: 'Crossword' },
    { id: 'hangman', label: 'Hangman' },
    { id: 'scramble', label: 'Word Scramble' },
    { id: 'wordle', label: 'Vocabulary Wordle' },
    { id: 'speed-match', label: 'Speed Match' },
    { id: 'fill-in-blank', label: 'Fill in Blank' }
];
const VOCAB_ACTIVITY_IDS = VOCAB_ACTIVITY_OPTIONS.map(activity => activity.id);
const DEFAULT_REQUIRED_BY_PURPOSE = {
    summative: ['flashcards', 'matching', 'quiz'],
    practice: ['flashcards', 'matching'],
    default: ['flashcards', 'matching']
};

class TeacherVocabularyEditorMethods {
    startNewVocab() {
        if (!this.ensureAuthenticated()) return;
        this.vocabSet = { id: `custom_${Date.now()}`, name: 'New Vocabulary', description: '', subjectSlug: DEFAULT_SUBJECT_SLUG, grades: [], words: [] };
        this.updateFormUI();
        this.renderWords();
        this.triggerAutoSave(); // Save immediately so it appears in library
        this.showEditor();
    }

    updateFormUI() {
        this.applyAssignedDatePlacement(this.vocabSet);
        this.vocabSet.subjectSlug = getVocabSubjectSlug(this.vocabSet);
        $('#vocab-id').value = this.vocabSet.id || '';
        $('#vocab-name').value = this.vocabSet.name || '';
        $('#vocab-desc').value = this.vocabSet.description || '';
        this.updateSubjectSelect();
        $('#vocab-grade').value = this.vocabSet.grades ? this.vocabSet.grades.join(', ') : (this.vocabSet.grade || '');
        $('#vocab-assigned-date').value = this.vocabSet.assignedDate || '';
        $('#vocab-trimester').value = this.getTeacherTrimesterKey(this.vocabSet.trimester || this.vocabSet) === 'other'
            ? ''
            : this.getTeacherTrimesterKey(this.vocabSet.trimester || this.vocabSet);
        $('#vocab-month').value = this.getTeacherMonthKey(this.vocabSet) === 'other' ? '' : this.getTeacherMonthKey(this.vocabSet);
        $('#vocab-week').value = this.vocabSet.week || this.inferTeacherWeek(this.vocabSet) || '';
        this.updatePlacementControlState();

        // Load activity settings
        const settings = this.vocabSet.activitySettings || {};
        $('#setting-flashcards').value = settings.flashcards || '';
        $('#setting-matching').value = settings.matching || 10;
        $('#setting-quiz').value = settings.quiz || 10;
        $('#setting-synonym-antonym').value = settings.synonymAntonym || 10;
        $('#setting-word-search').value = settings.wordSearch || 10;
        $('#setting-illustration').value = settings.illustration || 5;
        $('#setting-crossword').value = settings.crossword || 10;
        $('#setting-hangman').value = settings.hangman || 10;
        $('#setting-scramble').value = settings.scramble || 10;
        $('#setting-wordle').value = settings.wordle || 10;
        $('#setting-speed-match').value = settings.speedMatch || 10;
        $('#setting-fill-in-blank').value = settings.fillInBlank || 10;

        // Gamification Settings
        $('#setting-completion-bonus').value = settings.completionBonus !== undefined ? settings.completionBonus : 50;
        $('#setting-exchange-rate').value = settings.exchangeRate !== undefined ? settings.exchangeRate : 10;
        $('#setting-progress-reward').value = settings.progressReward !== undefined ? settings.progressReward : 1;

        this.renderActivityFlowSettings();
        this.renderWords();
    }

    inferTeacherWeek(vocab) {
        if (vocab?.assignedDate) return '';
        const source = `${vocab?.week || ''} ${vocab?.id || ''} ${vocab?.name || ''} ${vocab?.path || ''}`;
        const match = source.match(/(?:^|[^a-z])week\s*([0-9]{1,2})(?=[^0-9]|$)/i);
        return match ? Number(match[1]) : '';
    }

    updatePlacementControlState() {
        const isDerived = Boolean(this.vocabSet.assignedDate);
        ['#vocab-trimester', '#vocab-month', '#vocab-week'].forEach(selector => {
            const field = $(selector);
            if (!field) return;
            field.disabled = isDerived;
            field.title = isDerived
                ? 'Derived from the assigned date and school calendar. Clear Assigned Date to edit manually.'
                : '';
        });
    }

    setVocabPlacementField(field, value) {
        const cleanedValue = String(value || '').trim();

        if (field === 'trimester') {
            const trimester = this.normalizeTeacherTrimester(cleanedValue);
            if (trimester === 'other') {
                delete this.vocabSet.trimester;
            } else {
                this.vocabSet.trimester = trimester;
            }
        } else if (field === 'month') {
            const month = this.normalizeTeacherMonth(cleanedValue);
            if (month === 'other') {
                delete this.vocabSet.month;
            } else {
                this.vocabSet.month = month;
            }
        } else if (field === 'week') {
            const week = Number(cleanedValue);
            if (Number.isInteger(week) && week > 0) {
                this.vocabSet.week = week;
            } else {
                delete this.vocabSet.week;
            }
        }

        this.triggerAutoSave();
    }

    setVocabAssignedDate(value) {
        const assignedDate = String(value || '').trim();

        if (!assignedDate) {
            this.vocabSet.assignedDate = '';
            this.updatePlacementControlState();
            this.triggerAutoSave();
            return;
        }

        Object.assign(this.vocabSet, this.buildPlacementPatch(assignedDate));
        $('#vocab-trimester').value = this.vocabSet.trimester || '';
        $('#vocab-month').value = this.vocabSet.month || '';
        $('#vocab-week').value = this.vocabSet.week || '';
        this.updatePlacementControlState();
        this.triggerAutoSave();
    }

    slugifyVocabPart(value) {
        return String(value || '')
            .toLowerCase()
            .replace(/&/g, 'and')
            .replace(/[^a-z0-9]+/g, '_')
            .replace(/^_+|_+$/g, '')
            .slice(0, 48);
    }

    createVocabIdSuggestion() {
        const subject = getVocabSubjectSlug(this.vocabSet);
        const grade = this.getVocabGrades(this.vocabSet)[0] || 'custom';
        const trimester = this.getTeacherTrimesterKey(this.vocabSet);
        const month = this.getTeacherMonthKey(this.vocabSet);
        const week = this.vocabSet.week || this.inferTeacherWeek(this.vocabSet);
        const title = this.slugifyVocabPart(this.vocabSet.name || this.vocabSet.id || 'vocabulary');
        const parts = [
            this.slugifyVocabPart(subject) || DEFAULT_SUBJECT_SLUG,
            `grade${this.slugifyVocabPart(grade) || 'custom'}`,
            trimester !== 'other' ? trimester.toLowerCase() : '',
            month !== 'other' ? month : '',
            week ? `week${week}` : '',
            title
        ].filter(Boolean);
        return parts.join('_') || `vocab_${Date.now()}`;
    }

    async publishVocabulary({ asNew = false } = {}) {
        if (!this.ensureAuthenticated()) return;
        this.applyAssignedDatePlacement(this.vocabSet);

        if (asNew) {
            const suggestedId = this.createVocabIdSuggestion();
            const newId = prompt('New vocabulary ID', suggestedId);
            if (!newId) return;
            this.vocabSet.id = this.slugifyVocabPart(newId) || suggestedId;
            $('#vocab-id').value = this.vocabSet.id;
            delete this.vocabSet.source;
        }

        this.normalizeActivityFlowSettings();
        const saved = await this.saveToCloud();

        if (saved) {
            notifications.success(asNew ? 'Saved as a new vocabulary.' : 'Vocabulary update saved.');
            this.loadLibrary();
        } else {
            this.saveToLocal(this.vocabSet);
        }
    }

    getDefaultRequiredActivities(vocab = this.vocabSet) {
        const purpose = String(vocab?.purpose || '').trim().toLowerCase();
        return DEFAULT_REQUIRED_BY_PURPOSE[purpose] || DEFAULT_REQUIRED_BY_PURPOSE.default;
    }

    getActivityFlowConfig(vocab = this.vocabSet) {
        const settings = vocab?.activitySettings || {};
        const validIds = new Set(VOCAB_ACTIVITY_IDS);
        const hasExplicitFlow = Array.isArray(settings.requiredActivities) || Array.isArray(settings.additionalActivities);
        const defaultRequired = this.getDefaultRequiredActivities(vocab).filter(id => validIds.has(id));
        const requestedRequired = hasExplicitFlow ? settings.requiredActivities : defaultRequired;
        const required = (Array.isArray(requestedRequired) ? requestedRequired : defaultRequired)
            .filter(id => validIds.has(id));
        const uniqueRequired = [...new Set(required)];
        const requiredSet = new Set(uniqueRequired);
        const requestedAdditional = hasExplicitFlow
            ? settings.additionalActivities
            : VOCAB_ACTIVITY_IDS.filter(id => !requiredSet.has(id));
        const additional = (Array.isArray(requestedAdditional) ? requestedAdditional : [])
            .filter(id => validIds.has(id) && !requiredSet.has(id));
        const uniqueAdditional = [...new Set(additional)];

        if (uniqueRequired.length === 0) {
            uniqueRequired.push('flashcards');
        }

        return {
            required: uniqueRequired,
            additional: uniqueAdditional,
            hidden: VOCAB_ACTIVITY_IDS.filter(id => !uniqueRequired.includes(id) && !uniqueAdditional.includes(id))
        };
    }

    normalizeActivityFlowSettings() {
        if (!this.vocabSet.activitySettings) this.vocabSet.activitySettings = {};
        const flow = this.getActivityFlowConfig(this.vocabSet);
        this.vocabSet.activitySettings.requiredActivities = flow.required;
        this.vocabSet.activitySettings.additionalActivities = flow.additional;
        return flow;
    }

    setActivityFlowChoice(activityId, choice) {
        if (!VOCAB_ACTIVITY_IDS.includes(activityId)) return;
        if (!['required', 'additional', 'hidden'].includes(choice)) return;
        if (!this.vocabSet.activitySettings) this.vocabSet.activitySettings = {};

        const flow = this.getActivityFlowConfig(this.vocabSet);
        let required = flow.required.filter(id => id !== activityId);
        let additional = flow.additional.filter(id => id !== activityId);

        if (choice === 'required') {
            required.push(activityId);
        } else if (choice === 'additional') {
            additional.push(activityId);
        }

        if (required.length === 0) {
            notifications.warning('At least one required activity is needed.');
            required = [activityId];
            additional = additional.filter(id => id !== activityId);
        }

        this.vocabSet.activitySettings.requiredActivities = [...new Set(required)];
        this.vocabSet.activitySettings.additionalActivities = [...new Set(additional)];
        this.renderActivityFlowSettings();
        this.triggerAutoSave();
    }

    renderActivityFlowSettings() {
        const container = $('#activity-flow-settings');
        if (!container) return;

        const flow = this.getActivityFlowConfig(this.vocabSet);
        container.innerHTML = '';

        VOCAB_ACTIVITY_OPTIONS.forEach(activity => {
            const currentValue = flow.required.includes(activity.id)
                ? 'required'
                : flow.additional.includes(activity.id)
                    ? 'additional'
                    : 'hidden';
            const group = createElement('div', 'form-group');
            group.style.cssText = 'background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.1); border-radius: 8px; padding: 0.75rem;';
            group.innerHTML = `
                <label for="flow-${activity.id}" style="display:block; margin-bottom:0.35rem;">${activity.label}</label>
                <select id="flow-${activity.id}" class="activity-flow-select" data-activity="${activity.id}">
                    <option value="required"${currentValue === 'required' ? ' selected' : ''}>Required</option>
                    <option value="additional"${currentValue === 'additional' ? ' selected' : ''}>Additional</option>
                    <option value="hidden"${currentValue === 'hidden' ? ' selected' : ''}>Hidden</option>
                </select>
            `;
            container.appendChild(group);
        });
    }
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

    exportJSON() {
        if (!this.vocabSet.id) {
            alert('Please provide a Vocabulary ID before exporting.');
            return;
        }

        this.normalizeActivityFlowSettings();
        const dataStr = JSON.stringify(this.vocabSet, null, 2);
        const blob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.href = url;
        a.download = `${this.vocabSet.id}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    importJSON(event) {
        const file = event.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = JSON.parse(e.target.result);
                data.subjectSlug = getVocabSubjectSlug(data);
                this.vocabSet = data;

                this.updateFormUI();
                this.renderWords();
                this.showEditor();
            } catch (err) {
                alert('Error parsing JSON file');
                console.error(err);
            }
        };
        reader.readAsText(file);
    }
}

export function installTeacherVocabularyEditorMethods(TeacherManager) {
    for (const name of Object.getOwnPropertyNames(TeacherVocabularyEditorMethods.prototype)) {
        if (name === 'constructor') continue;
        Object.defineProperty(
            TeacherManager.prototype,
            name,
            Object.getOwnPropertyDescriptor(TeacherVocabularyEditorMethods.prototype, name)
        );
    }
}
