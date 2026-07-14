import { $, createElement, escapeHtml } from '../main.js';
import { notifications } from '../notifications.js';
import { studentApi } from '../services/studentApi.js';
import { vocabularyRepository } from '../services/vocabularyRepository.js';
import {
    getVocabSubjectSlug,
    loadCloudVocabularyList,
    loadManifest,
    loadVocabularyFile
} from '../services/vocabularyApi.js';

export class StudentActivityVocabularyData {
    constructor(activities) {
        this.activities = activities;
        this.sm = activities.sm;
    }

    getCurrentTrimesterKey(...args) {
        return this.activities.getCurrentTrimesterKey(...args);
    }

    getVocabTrimesterKey(...args) {
        return this.activities.getVocabTrimesterKey(...args);
    }

    getTrimesterLabel(...args) {
        return this.activities.getTrimesterLabel(...args);
    }

    filterStudentAvailableVocabulary(...args) {
        return this.activities.filterStudentAvailableVocabulary(...args);
    }

    ensureUnitProgress(...args) {
        return this.activities.ensureUnitProgress(...args);
    }

    initWordCoverage(...args) {
        return this.activities.initWordCoverage(...args);
    }

    migrateLegacyWordHuntImages(...args) {
        return this.activities.migrateLegacyWordHuntImages(...args);
    }

    showActivityMenu(...args) {
        return this.activities.showActivityMenu(...args);
    }

    async loadManifest() {
        const data = await loadManifest();
        if (data) {
            this.sm.manifest = data;
        } else {
            // Fallback or error handling
            console.error('Could not load manifest');
            $('#vocab-list').innerHTML = '<p class="error">Failed to load vocabulary list.</p>';
        }
    }

    getAllVocabularySources() {
        let vocabs = [];

        if (Array.isArray(this.sm.cloudVocabs) && this.sm.cloudVocabs.length > 0) {
            vocabs = vocabs.concat(this.sm.cloudVocabs);
        }

        if (this.sm.manifest && Array.isArray(this.sm.manifest.vocabularies)) {
            const manifestVocabs = this.sm.manifest.vocabularies.map(v => ({
                ...v,
                subjectSlug: getVocabSubjectSlug(v),
                __source: 'manifest'
            }));
            vocabs = vocabs.concat(manifestVocabs);
        }

        try {
            const localStored = localStorage.getItem('teacher_vocab_library');
            if (localStored) {
                const localVocabs = JSON.parse(localStored);
                if (Array.isArray(localVocabs)) {
                    const normalized = localVocabs.map(v => ({
                        ...v,
                        subjectSlug: getVocabSubjectSlug(v),
                        __source: 'local'
                    }));
                    vocabs = vocabs.concat(normalized);
                }
            }
        } catch (e) {
            console.error("Error loading local vocabularies", e);
        }

        return this.dedupeVocabularySources(vocabs);
    }

    dedupeVocabularySources(vocabs = []) {
        const priority = {
            cloud: 3,
            local: 2,
            manifest: 1
        };
        const byKey = new Map();

        vocabs.forEach(vocab => {
            const key = vocab.id || vocab.path || vocab.name;
            if (!key) return;

            const current = byKey.get(key);
            const currentPriority = priority[current?.__source] || 0;
            const nextPriority = priority[vocab.__source] || 0;

            if (!current || nextPriority >= currentPriority) {
                byKey.set(key, {
                    ...(current || {}),
                    ...vocab
                });
            }
        });

        return Array.from(byKey.values());
    }

    getVisibleVocabularyList(options = {}) {
        const { availableOnly = false, currentTrimesterOnly = false } = options;
        let vocabs = this.getAllVocabularySources();

        if (vocabs.length === 0) {
            return { vocabs: [], message: 'No vocabularies found.' };
        }

        const studentGrade = this.sm.studentProfile.grade ? String(this.sm.studentProfile.grade).trim() : '';

        if (studentGrade) {
            vocabs = vocabs.filter(v => {
                if (v.grades && Array.isArray(v.grades)) {
                    return v.grades.some(g => String(g).trim() === studentGrade);
                }
                if (v.grade) {
                    return String(v.grade).trim() === studentGrade;
                }
                return true;
            });
        }

        if (vocabs.length === 0) {
            return {
                vocabs: [],
                message: `No vocabularies found for Grade ${studentGrade}.`
            };
        }

        this.sm.ensureSelectedSubject(vocabs);
        const selectedSubject = this.sm.getSelectedSubject();
        vocabs = vocabs.filter(vocab => getVocabSubjectSlug(vocab) === this.sm.selectedSubjectSlug);

        if (vocabs.length === 0) {
            const gradeContext = studentGrade ? ` for Grade ${studentGrade}` : '';
            return {
                vocabs: [],
                message: `No ${selectedSubject.name} vocabularies found${gradeContext}.`
            };
        }

        if (currentTrimesterOnly) {
            const currentTrimester = this.getCurrentTrimesterKey();
            vocabs = vocabs.filter(v => this.getVocabTrimesterKey(v) === currentTrimester);

            if (vocabs.length === 0) {
                const gradeContext = studentGrade ? ` for Grade ${studentGrade}` : '';
                return {
                    vocabs: [],
                    message: `No ${selectedSubject.name} ${this.getTrimesterLabel(currentTrimester)} vocabularies found${gradeContext}.`
                };
            }
        }

        if (availableOnly) {
            vocabs = this.filterStudentAvailableVocabulary(vocabs);

            if (vocabs.length === 0) {
                const gradeContext = studentGrade ? ` for Grade ${studentGrade}` : '';
                return {
                    vocabs: [],
                    message: `No ${selectedSubject.name} vocabularies are available yet${gradeContext}.`
                };
            }
        }

        this.sm.availableVocabs = vocabs;
        return { vocabs, message: '' };
    }

    getGradeMatchedVocabularySources() {
        let vocabs = this.getAllVocabularySources();
        const studentGrade = this.sm.studentProfile.grade ? String(this.sm.studentProfile.grade).trim() : '';

        if (studentGrade) {
            vocabs = vocabs.filter(v => {
                if (v.grades && Array.isArray(v.grades)) {
                    return v.grades.some(g => String(g).trim() === studentGrade);
                }
                if (v.grade) {
                    return String(v.grade).trim() === studentGrade;
                }
                return true;
            });
        }

        return vocabs;
    }

    renderSubjectPicker(targetId) {
        const container = $(targetId);
        if (!container) return;

        const gradeVocabs = this.getGradeMatchedVocabularySources();
        this.sm.ensureSelectedSubject(gradeVocabs);
        const counts = gradeVocabs.reduce((map, vocab) => {
            const subjectSlug = getVocabSubjectSlug(vocab);
            map.set(subjectSlug, (map.get(subjectSlug) || 0) + 1);
            return map;
        }, new Map());

        const subjects = this.sm.getActiveSubjects().filter(subject => counts.has(subject.slug));
        if (subjects.length === 0) {
            container.innerHTML = '';
            return;
        }

        const selectedSubject = subjects.find(subject => subject.slug === this.sm.selectedSubjectSlug) || subjects[0];
        const selectId = `${targetId.replace(/[^a-z0-9_-]/gi, '')}-class-select`;

        container.innerHTML = '';
        container.style.setProperty('--subject-color', selectedSubject.color);

        const picker = createElement('label', 'student-class-picker');
        picker.setAttribute('for', selectId);
        picker.innerHTML = `
            <span class="student-class-picker-label">Class</span>
            <span class="subject-color-dot" style="background:${escapeHtml(selectedSubject.color)};"></span>
            <select id="${escapeHtml(selectId)}" class="student-subject-select" aria-label="Choose class">
                ${subjects.map(subject => {
                    return `<option value="${escapeHtml(subject.slug)}"${subject.slug === selectedSubject.slug ? ' selected' : ''}>${escapeHtml(subject.name)}</option>`;
                }).join('')}
            </select>
        `;

        picker.querySelector('select')?.addEventListener('change', event => this.sm.selectSubject(event.target.value));
        container.appendChild(picker);
    }

    async loadCloudVocabularies() {
        if (this.sm.authDisabled) {
            this.sm.cloudVocabs = [];
            return;
        }

        try {
            this.sm.cloudVocabs = await loadCloudVocabularyList(studentApi);
        } catch (error) {
            console.error('Failed to load cloud vocabularies:', error);
            const isOffline = !navigator.onLine;
            if (isOffline) {
                // Silently fail offline - we'll use local/manifest vocabularies
                this.sm.cloudVocabs = [];
            } else {
                notifications.warning('Could not load cloud vocabularies. Using local versions.');
                this.sm.cloudVocabs = [];
            }
            // Re-throw to let caller know we failed
            throw error;
        }
    }

    async loadVocabularyOverride(vocabMeta) {
        if (this.sm.authDisabled || !vocabMeta?.id) return null;

        try {
            const vocabulary = await vocabularyRepository.get(vocabMeta.id);
            return vocabulary ? { ...vocabulary, __source: 'cloud' } : null;
        } catch (error) {
            console.warn('Could not load live vocabulary settings:', error);
            return null;
        }
    }

    mergeVocabularyData({ meta = {}, fileData = null, override = null } = {}) {
        const merged = {
            ...meta,
            ...(fileData || {}),
            ...(override || {})
        };

        merged.id = override?.id || fileData?.id || meta.id;
        merged.path = meta.path || override?.path || fileData?.path;
        merged.subjectSlug = getVocabSubjectSlug(merged);
        merged.grades = override?.grades?.length ? override.grades : (fileData?.grades || meta.grades);
        merged.assignedDate = override?.assignedDate || fileData?.assignedDate || meta.assignedDate;
        merged.trimester = override?.trimester || fileData?.trimester || meta.trimester;
        merged.month = override?.month || fileData?.month || meta.month;
        merged.week = override?.week || fileData?.week || meta.week;
        merged.words = Array.isArray(override?.words) && override.words.length > 0
            ? override.words
            : (Array.isArray(fileData?.words) ? fileData.words : (meta.words || []));
        merged.activitySettings = {
            ...(fileData?.activitySettings || {}),
            ...(meta.activitySettings || {}),
            ...(override?.activitySettings || {})
        };
        merged.__source = override?.__source || meta.__source;

        return merged;
    }

    async loadVocabulary(vocabMeta, options = {}) {
        let vocabData = null;
        const override = await this.loadVocabularyOverride(vocabMeta);

        if (vocabMeta.path) {
            const fetched = await loadVocabularyFile(vocabMeta.path);
            if (fetched) {
                vocabData = this.mergeVocabularyData({ meta: vocabMeta, fileData: fetched, override });
            } else if (override) {
                vocabData = this.mergeVocabularyData({ meta: vocabMeta, override });
            }
        } else {
            vocabData = this.mergeVocabularyData({ meta: vocabMeta, override });
        }

        if (!vocabData) {
            console.error('Failed to load vocabulary data for:', vocabMeta);
            notifications.error('Failed to load vocabulary data. Please try again or contact your teacher.');
            return;
        }

        this.sm.currentVocab = vocabData;

        const unitProgress = this.ensureUnitProgress(this.sm.currentVocab);

        // Load scores into current session (reference to the stored object)
        this.sm.unitScores = unitProgress.scores;
        this.sm.unitImages = unitProgress.images;
        this.sm.unitWordHunt = unitProgress.wordHunt;
        this.sm.unitStates = unitProgress.states;
        
        // Initialize word coverage tracking
        this.initWordCoverage();
        await this.migrateLegacyWordHuntImages();

        if (!options.fromRoute) {
            const unitId = this.sm.getCurrentVocabRouteId();
            if (unitId) {
                this.sm.setRoute({ view: 'unit', unitId });
            }
        }

        this.showActivityMenu(options);
    }
}
