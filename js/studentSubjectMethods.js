import { studentApi as supabaseService } from './services/studentApi.js';
import {
    DEFAULT_SUBJECT_SLUG,
    getSubjectBySlug,
    getVocabSubjectSlug,
    loadSubjects
} from './services/vocabularyApi.js';

class StudentSubjectMethods {
    async loadSubjectSettings() {
        this.subjects = await loadSubjects(this.authDisabled || !this.currentUser ? null : supabaseService);
        this.ensureSelectedSubject();
    }

    getActiveSubjects() {
        return (this.subjects || []).filter(subject => subject.active !== false);
    }

    getSelectedSubject() {
        return getSubjectBySlug(this.subjects, this.selectedSubjectSlug);
    }

    selectSubject(subjectSlug) {
        this.selectedSubjectSlug = getVocabSubjectSlug({ subjectSlug });
        localStorage.setItem('student_selected_subject', this.selectedSubjectSlug);
        this.resetStudentVocabularyDrilldown();
        this.activities.renderDashboard();
        this.activities.renderStudentHome();
    }

    ensureSelectedSubject(vocabs = null) {
        const activeSubjects = this.getActiveSubjects();
        const subjectSlugs = new Set(activeSubjects.map(subject => subject.slug));
        if (Array.isArray(vocabs) && vocabs.length > 0) {
            const availableSubjectSlugs = new Set(vocabs.map(vocab => getVocabSubjectSlug(vocab)));
            if (!availableSubjectSlugs.has(this.selectedSubjectSlug)) {
                const firstAvailable = activeSubjects.find(subject => availableSubjectSlugs.has(subject.slug));
                if (firstAvailable) this.selectedSubjectSlug = firstAvailable.slug;
            }
        }
        if (!subjectSlugs.has(this.selectedSubjectSlug)) {
            this.selectedSubjectSlug = activeSubjects[0]?.slug || DEFAULT_SUBJECT_SLUG;
        }
        localStorage.setItem('student_selected_subject', this.selectedSubjectSlug);
        return this.selectedSubjectSlug;
    }

    resetStudentVocabularyDrilldown() {
        this.studentVocabularyDrilldown = {
            trimester: null,
            month: null
        };
    }

    setStudentVocabularyDrilldownToCurrentTrimester() {
        this.studentVocabularyDrilldown = {
            trimester: this.activities.getCurrentTrimesterKey(),
            month: null
        };
    }
}

export function installStudentSubjectMethods(StudentManager) {
    for (const name of Object.getOwnPropertyNames(StudentSubjectMethods.prototype)) {
        if (name === 'constructor') continue;
        Object.defineProperty(
            StudentManager.prototype,
            name,
            Object.getOwnPropertyDescriptor(StudentSubjectMethods.prototype, name)
        );
    }
}
