import { $, notifications } from './main.js';
import {
    DEFAULT_SUBJECT_SLUG,
    getVocabSubjectSlug
} from './services/vocabularyApi.js';

class TeacherVocabularyEditorCoreMethods {
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

export function installTeacherVocabularyEditorCoreMethods(TeacherManager) {
    for (const name of Object.getOwnPropertyNames(TeacherVocabularyEditorCoreMethods.prototype)) {
        if (name === 'constructor') continue;
        Object.defineProperty(
            TeacherManager.prototype,
            name,
            Object.getOwnPropertyDescriptor(TeacherVocabularyEditorCoreMethods.prototype, name)
        );
    }
}
