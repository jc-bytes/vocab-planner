import { DEFAULT_SUBJECT_SLUG, getSubjectBySlug } from '../services/vocabularyApi.js';
import {
    WORD_HUNT_REVIEW_STORAGE_KEY,
    WORD_HUNT_REVIEW_VIEW_MODE_KEY
} from './wordHuntReviewModel.js';

export const teacherWordHuntReviewStateMethods = {
getWordHuntReviewNotes() {
        try {
            return JSON.parse(this.storage.getItem(WORD_HUNT_REVIEW_STORAGE_KEY) || '{}');
        } catch (error) {
            console.warn('Could not read Word Hunt review notes:', error);
            return {};
        }
    },

saveWordHuntReviewNote(key, patch = {}) {
        if (!key) return;
        const notes = this.getWordHuntReviewNotes();
        notes[key] = {
            ...(notes[key] || {}),
            ...patch,
            updatedAt: new Date().toISOString()
        };
        this.storage.setItem(WORD_HUNT_REVIEW_STORAGE_KEY, JSON.stringify(notes));
        this.wordHuntReviewRows = this.wordHuntReviewRows.map(row => (
            row.key === key ? { ...row, note: notes[key] } : row
        ));
        this.renderWordHuntReviewBrowser({ preserveSelection: true });
    },

getWordHuntReviewStoredViewModes() {
        try {
            const saved = JSON.parse(this.storage.getItem(WORD_HUNT_REVIEW_VIEW_MODE_KEY) || '{}');
            if (saved && typeof saved === 'object' && !Array.isArray(saved)) return saved;
        } catch (error) {
            const legacyMode = this.storage.getItem(WORD_HUNT_REVIEW_VIEW_MODE_KEY);
            if (legacyMode === 'rows') return { subjects: 'rows' };
        }
        return {};
    },

getWordHuntReviewDepth(drilldown = this.wordHuntReviewDrilldown || {}) {
        if (drilldown.unitId) return 'students';
        if (drilldown.group) return 'vocabularies';
        if (drilldown.grade) return 'groups';
        if (drilldown.subject) return 'grades';
        return 'subjects';
    },

getWordHuntReviewViewMode(drilldown = this.wordHuntReviewDrilldown || {}) {
        const depth = this.getWordHuntReviewDepth(drilldown);
        return this.wordHuntReviewViewModes?.[depth] === 'rows' ? 'rows' : 'cards';
    },

setWordHuntReviewViewMode(mode) {
        const depth = this.getWordHuntReviewDepth();
        this.wordHuntReviewViewModes = {
            ...(this.wordHuntReviewViewModes || {}),
            [depth]: mode === 'rows' ? 'rows' : 'cards'
        };
        this.storage.setItem(WORD_HUNT_REVIEW_VIEW_MODE_KEY, JSON.stringify(this.wordHuntReviewViewModes));
    },

getWordHuntRowsForDrilldown(drilldown = this.wordHuntReviewDrilldown || {}) {
        return this.wordHuntReviewRows.filter(row => {
            if (drilldown.subject && row.subjectSlug !== drilldown.subject) return false;
            if (drilldown.grade === '__other__' && row.grade) return false;
            if (drilldown.grade && drilldown.grade !== '__other__' && row.grade !== drilldown.grade) return false;
            if (drilldown.group === '__other__' && row.group) return false;
            if (drilldown.group && drilldown.group !== '__other__' && row.group !== drilldown.group) return false;
            if (drilldown.unitId && row.unitId !== drilldown.unitId) return false;
            return true;
        });
    },

summarizeWordHuntRows(rows = []) {
        return {
            rowCount: rows.length,
            reviewed: rows.filter(row => row.note.reviewed).length,
            students: new Set(rows.map(row => row.studentId || row.email || row.studentName)).size,
            vocabularies: new Set(rows.map(row => row.unitId)).size
        };
    },

getWordHuntSubjectSummaries() {
        const map = new Map();
        this.wordHuntReviewRows.forEach(row => {
            const key = row.subjectSlug || DEFAULT_SUBJECT_SLUG;
            if (!map.has(key)) {
                const subject = getSubjectBySlug(this.getSubjects(), key);
                map.set(key, { key, label: subject.name, color: subject.color, rows: [] });
            }
            map.get(key).rows.push(row);
        });
        return Array.from(map.values())
            .map(item => ({ ...item, summary: this.summarizeWordHuntRows(item.rows) }))
            .sort((a, b) => {
                const subjectA = getSubjectBySlug(this.getSubjects(), a.key);
                const subjectB = getSubjectBySlug(this.getSubjects(), b.key);
                if (subjectA.sortOrder !== subjectB.sortOrder) return subjectA.sortOrder - subjectB.sortOrder;
                return subjectA.name.localeCompare(subjectB.name);
            });
    },

getWordHuntGradeSummaries() {
        const map = new Map();
        this.getWordHuntRowsForDrilldown({ subject: this.wordHuntReviewDrilldown.subject }).forEach(row => {
            const key = row.grade || '__other__';
            if (!map.has(key)) {
                map.set(key, { key, label: row.grade ? `Grade ${row.grade}` : 'Other', rows: [] });
            }
            map.get(key).rows.push(row);
        });
        return Array.from(map.values())
            .map(item => ({ ...item, summary: this.summarizeWordHuntRows(item.rows) }))
            .sort((a, b) => a.label.localeCompare(b.label, undefined, { numeric: true }));
    },

getWordHuntGroupSummaries() {
        const map = new Map();
        this.getWordHuntRowsForDrilldown({
            subject: this.wordHuntReviewDrilldown.subject,
            grade: this.wordHuntReviewDrilldown.grade
        }).forEach(row => {
            const key = row.group || '__other__';
            if (!map.has(key)) {
                map.set(key, { key, label: row.group ? `Group ${row.group}` : 'No Group', rows: [] });
            }
            map.get(key).rows.push(row);
        });
        return Array.from(map.values())
            .map(item => ({ ...item, summary: this.summarizeWordHuntRows(item.rows) }))
            .sort((a, b) => a.label.localeCompare(b.label, undefined, { numeric: true }));
    },

getWordHuntUnitSummaries() {
        const map = new Map();
        this.getWordHuntRowsForDrilldown({
            subject: this.wordHuntReviewDrilldown.subject,
            grade: this.wordHuntReviewDrilldown.grade,
            group: this.wordHuntReviewDrilldown.group
        }).forEach(row => {
            const key = row.unitId || 'vocabulary';
            if (!map.has(key)) {
                map.set(key, { key, label: row.unitLabel, rows: [] });
            }
            map.get(key).rows.push(row);
        });
        return Array.from(map.values())
            .map(item => ({ ...item, summary: this.summarizeWordHuntRows(item.rows) }))
            .sort((a, b) => a.label.localeCompare(b.label, undefined, { numeric: true }));
    },
};
