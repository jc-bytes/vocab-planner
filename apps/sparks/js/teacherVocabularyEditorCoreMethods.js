import { $, notifications } from './main.js';
import {
    DEFAULT_SUBJECT_SLUG,
    getVocabSubjectSlug
} from './services/vocabularyApi.js';

class TeacherVocabularyEditorCoreMethods {
    startNewVocab() {
        if (!this.ensureAuthenticated()) return;
        this.beginTeacherNavigation();
        this.autoGenerateVocabId = true;
        this.vocabSet = { id: '', name: 'New Vocabulary', description: '', subjectSlug: DEFAULT_SUBJECT_SLUG, grades: [], words: [] };
        this.updateGeneratedVocabId();
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

        this.renderActivityFlowSettings();
        this.renderWords();
        this.updateVocabularyEditorSummary();
    }

    getVocabularyPlacementSummary() {
        const trimester = this.getTeacherTrimesterKey(this.vocabSet);
        const month = this.getTeacherMonthKey(this.vocabSet);
        const week = this.vocabSet.week || this.inferTeacherWeek(this.vocabSet);
        const parts = [
            trimester !== 'other' ? trimester : '',
            month !== 'other' ? month.charAt(0).toUpperCase() + month.slice(1) : '',
            week ? `Week ${week}` : ''
        ].filter(Boolean);

        return parts.length ? parts.join(' / ') : 'Not set';
    }

    updateVocabularyEditorSummary() {
        const words = Array.isArray(this.vocabSet?.words) ? this.vocabSet.words : [];
        const wordHuntRequired = this.isWordHuntRequired();
        const customWordHunt = this.isWordHuntCustomSelection();
        const wordHuntCount = this.getWordHuntWordCount();
        const flow = this.getActivityFlowConfig(this.vocabSet);
        const requiredCount = flow.required.length;
        const wordCountLabel = `${words.length} ${words.length === 1 ? 'word' : 'words'}`;
        const wordHuntLabel = wordHuntRequired && !customWordHunt
            ? 'All words'
            : `${wordHuntCount} selected`;
        const requiredLabel = requiredCount
            ? `${requiredCount} required`
            : 'None required';

        const subtitle = $('#vocab-editor-subtitle');
        const wordCount = $('#vocab-word-count');
        const wordHunt = $('#vocab-word-hunt-count');
        const placement = $('#vocab-placement-summary');
        const required = $('#vocab-required-summary');
        const wordsSummary = $('#vocab-words-summary');

        if (subtitle) {
            const name = String(this.vocabSet?.name || '').trim();
            subtitle.textContent = name && name !== 'New Vocabulary' ? name : '';
        }
        if (wordCount) wordCount.textContent = String(words.length);
        if (wordHunt) wordHunt.textContent = wordHuntRequired && !customWordHunt ? 'All' : String(wordHuntCount);
        if (placement) placement.textContent = this.getVocabularyPlacementSummary();
        if (required) required.textContent = requiredLabel;
        if (wordsSummary) wordsSummary.textContent = wordHuntRequired && !customWordHunt
            ? `${wordCountLabel} / all included in required Word Hunt.`
            : `${wordCountLabel} / ${wordHuntLabel} for Word Hunt.`;
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

        this.updateGeneratedVocabId();
        this.triggerAutoSave();
        this.updateVocabularyEditorSummary();
    }

    setVocabAssignedDate(value) {
        const assignedDate = String(value || '').trim();

        if (!assignedDate) {
            this.vocabSet.assignedDate = '';
            this.updatePlacementControlState();
            this.updateGeneratedVocabId();
            this.triggerAutoSave();
            this.updateVocabularyEditorSummary();
            return;
        }

        Object.assign(this.vocabSet, this.buildPlacementPatch(assignedDate));
        $('#vocab-trimester').value = this.vocabSet.trimester || '';
        $('#vocab-month').value = this.vocabSet.month || '';
        $('#vocab-week').value = this.vocabSet.week || '';
        this.updatePlacementControlState();
        this.updateGeneratedVocabId();
        this.triggerAutoSave();
        this.updateVocabularyEditorSummary();
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

    updateGeneratedVocabId({ force = false } = {}) {
        if (!force && !this.autoGenerateVocabId) return;
        const generatedId = this.createVocabIdSuggestion();
        this.vocabSet.id = generatedId;
        const idField = $('#vocab-id');
        if (idField) idField.value = generatedId;
        if (this.routeReady && document.getElementById('teacher-editor-view')?.classList.contains('active')) {
            this.updateTeacherRouteForView('teacher-editor-view', { replace: true });
        }
    }

    async publishVocabulary({ asNew = false } = {}) {
        if (!this.ensureAuthenticated()) return;
        this.applyAssignedDatePlacement(this.vocabSet);

        if (asNew) {
            const currentId = this.vocabSet.id;
            const generatedId = this.createVocabIdSuggestion();
            this.vocabSet.id = generatedId === currentId
                ? `${generatedId}_${Date.now().toString(36)}`
                : generatedId;
            $('#vocab-id').value = this.vocabSet.id;
            delete this.vocabSet.source;
        } else {
            this.updateGeneratedVocabId();
        }

        this.prepareWordHuntWordsForSave(this.vocabSet);
        this.normalizeActivityFlowSettings();
        const saved = await this.saveToCloud();

        if (saved) {
            this.autoGenerateVocabId = false;
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

        this.prepareWordHuntWordsForSave(this.vocabSet);
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
        if (!this.ensureAuthenticated()) {
            event.target.value = '';
            return;
        }
        const file = event.target.files[0];
        if (!file) return;

        const navigation = this.beginTeacherNavigation();
        const reader = new FileReader();
        reader.onload = (e) => {
            if (!this.isTeacherNavigationCurrent(navigation)) return;
            try {
                const data = JSON.parse(e.target.result);
                data.subjectSlug = getVocabSubjectSlug(data);
                this.vocabSet = data;
                this.autoGenerateVocabId = false;

                this.updateFormUI();
                this.renderWords();
                this.triggerAutoSave();
                this.showEditor();
            } catch (err) {
                if (!this.isTeacherNavigationCurrent(navigation)) return;
                alert('Error parsing JSON file');
                console.error(err);
            }
        };
        reader.readAsText(file);
        event.target.value = '';
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
