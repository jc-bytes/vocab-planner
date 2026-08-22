import { $, notifications } from '../main.js';
import { toDate } from '../services/dateUtils.js';
import { teacherApi as supabaseService } from '../services/teacherApi.js';
import { getWordHuntQuality } from '../services/wordHuntQuality.js';
import {
    getWordHuntReviewStudentName as getStudentName,
    getWordHuntReviewSubjectSlug as getWordHuntSubjectSlug,
    getWordHuntReviewUnitLabel as getUnitLabel
} from './wordHuntReviewModel.js';

export const teacherWordHuntReviewDataMethods = {
async showWordHuntReviewView(options = {}) {
        if (!this.ensureAuthenticated(false)) return;
        this.vocabularyMode = 'review';
        this.switchView('teacher-dashboard-view');
        this.setVocabularyWorkflowTab('review', {
            loadReview: false,
            updateRoute: options.updateRoute !== false,
            replace: options.replace === true
        });
        await this.loadWordHuntReview(options);
    },

initWordHuntReview() {
        if (this.wordHuntReviewInitialized) return;
        this.wordHuntReviewInitialized = true;
        this.wordHuntReviewRows = [];
        this.filteredWordHuntReviewRows = [];
        this.activeWordHuntReviewKey = '';
        this.wordHuntReviewImageUrls = [];
        this.wordHuntReviewDrilldown = { subject: '', grade: '', group: '', unitId: '' };
        this.wordHuntReviewFilters = { status: '', search: '' };
        this.wordHuntReviewViewModes = this.getWordHuntReviewStoredViewModes();

        $('#word-hunt-review-content')?.addEventListener('click', (event) => {
            const action = event.target.closest('[data-word-hunt-review-action]');
            if (!action) return;
            this.handleWordHuntReviewAction(action);
        });

        document.addEventListener('keydown', (event) => this.handleWordHuntReviewKeyboardNavigation(event));
    },

async loadWordHuntReview(options = {}) {
        if (!this.ensureAuthenticated(false)) return;
        this.initWordHuntReview();

        const content = $('#word-hunt-review-content');
        if (content) content.innerHTML = '<div class="loading-spinner">Loading Word Hunt work...</div>';

        try {
            const forceRefresh = options.forceRefresh === true;
            if (forceRefresh) this.wordHuntReviewDataCache = null;
            const students = this.wordHuntReviewDataCache || await supabaseService.getWordHuntReviewData();
            this.wordHuntReviewDataCache = students;
            this.wordHuntReviewRows = this.buildWordHuntReviewRows(students);
            this.renderWordHuntReviewBrowser({ preserveSelection: true });
        } catch (error) {
            console.error('Failed to load Word Hunt review:', error);
            if (content) content.innerHTML = '<p class="teacher-empty-state">Could not load Word Hunt responses.</p>';
            notifications.error('Could not load Word Hunt review.');
        }
    },

buildWordHuntReviewRows(students = []) {
        const reviewNotes = this.getWordHuntReviewNotes();
        const subjects = this.getSubjects?.() || [];
        const rows = [];

        students.forEach(student => {
            const profile = student.studentProfile || {};
            const units = student.units || {};

            Object.entries(units).forEach(([unitId, unitData = {}]) => {
                const wordHunt = unitData.wordHunt || {};
                const words = Object.entries(wordHunt)
                    .filter(([word]) => String(word || '').trim())
                    .map(([word, entry]) => {
                        const quality = getWordHuntQuality(entry || {});
                        const complete = quality.complete;
                        return {
                            word,
                            entry: entry || {},
                            quality,
                            complete
                        };
                    })
                    .sort((a, b) => a.word.localeCompare(b.word));

                if (words.length === 0) return;

                const completeWords = words.filter(word => word.complete).length;
                const key = `${student.id || student.userId || student.email || 'student'}::${unitId}`;
                const note = reviewNotes[key] || {};
                const lastUpdatedDates = words
                    .map(word => toDate(word.entry.updatedAt || word.entry.imageUpdatedAt))
                    .filter(Boolean);
                const lastUpdated = lastUpdatedDates.length
                    ? new Date(Math.max(...lastUpdatedDates.map(date => date.getTime())))
                    : toDate(unitData.updatedAt || student.updatedAt);

                rows.push({
                    key,
                    studentId: student.id || student.userId || '',
                    student,
                    studentName: getStudentName(student),
                    email: student.email || profile.email || '',
                    subjectSlug: getWordHuntSubjectSlug(unitId, subjects),
                    grade: String(profile.grade || ''),
                    group: String(profile.group || ''),
                    unitId,
                    unitLabel: getUnitLabel(unitId),
                    wordHunt,
                    words,
                    totalWords: words.length,
                    completeWords,
                    missingWords: words.length - completeWords,
                    complete: words.length > 0 && completeWords === words.length,
                    hasSavedWork: words.some(word => (
                        String(word.entry.definition || '').trim() ||
                        String(word.entry.exampleOne || '').trim() ||
                        String(word.entry.exampleTwo || '').trim() ||
                        word.entry.hasImage ||
                        word.entry.imagePath
                    )),
                    score: unitData.scores?.illustration?.score,
                    lastUpdated,
                    note
                });
            });
        });

        return rows.sort((a, b) => {
            const gradeCompare = a.grade.localeCompare(b.grade, undefined, { numeric: true });
            if (gradeCompare) return gradeCompare;
            const groupCompare = a.group.localeCompare(b.group);
            if (groupCompare) return groupCompare;
            return a.studentName.localeCompare(b.studentName);
        });
    },
};
