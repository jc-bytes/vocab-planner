import { $, createElement, escapeHtml } from '../main.js';
import { notifications } from '../notifications.js';
import { vocabularyRepository } from '../services/vocabularyRepository.js';
import {
    getVocabSubjectSlug,
    loadManifest,
    loadVocabularyFile
} from '../services/vocabularyApi.js';
import { requestWithTimeout } from '../services/requestReliability.js';
import { getStudentPageSkeleton, setStudentPageLoading } from './studentLoadingSkeletons.js';

export class StudentActivityVocabularyData {
    constructor(activities) {
        this.activities = activities;
        this.sm = activities.sm;
    }

    async loadManifest() {
        const data = await loadManifest();
        if (data) {
            this.activities.manifest = data;
        } else {
            // Fallback or error handling
            console.error('Could not load manifest');
            $('#vocab-list').innerHTML = '<p class="error">Failed to load vocabulary list.</p>';
        }
    }

    getAllVocabularySources() {
        let vocabs = [];

        if (this.activities.cloudVocabs.length > 0) {
            vocabs = vocabs.concat(this.activities.cloudVocabs);
        }

        if (Array.isArray(this.activities.manifest?.vocabularies)) {
            const manifestVocabs = this.activities.manifest.vocabularies.map(v => ({
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
            const currentTrimester = this.activities.calendar.getCurrentTrimesterKey();
            vocabs = vocabs.filter(
                vocab => this.activities.schedule.getVocabTrimesterKey(vocab) === currentTrimester
            );

            if (vocabs.length === 0) {
                const gradeContext = studentGrade ? ` for Grade ${studentGrade}` : '';
                return {
                    vocabs: [],
                    message: `No ${selectedSubject.name} ${this.activities.schedule.getTrimesterLabel(currentTrimester)} vocabularies found${gradeContext}.`
                };
            }
        }

        if (availableOnly) {
            vocabs = this.activities.schedule.filterStudentAvailableVocabulary(vocabs);

            if (vocabs.length === 0) {
                const gradeContext = studentGrade ? ` for Grade ${studentGrade}` : '';
                return {
                    vocabs: [],
                    message: `No ${selectedSubject.name} vocabularies are available yet${gradeContext}.`
                };
            }
        }

        this.activities.availableVocabs = vocabs;
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
        const pickerId = targetId.replace(/[^a-z0-9_-]/gi, '');
        const triggerId = `${pickerId}-class-select`;
        const labelId = `${pickerId}-class-label`;
        const valueId = `${pickerId}-class-value`;
        const listboxId = `${pickerId}-class-options`;

        container.innerHTML = '';
        container.style.setProperty('--subject-color', selectedSubject.color);

        const picker = createElement('div', 'student-class-picker');
        picker.innerHTML = `
            <span id="${escapeHtml(labelId)}" class="student-class-picker-label">Class</span>
            <span class="subject-color-dot" style="background:${escapeHtml(selectedSubject.color)};"></span>
            <button id="${escapeHtml(triggerId)}" class="student-subject-select student-subject-trigger" type="button"
                aria-labelledby="${escapeHtml(labelId)} ${escapeHtml(valueId)}" aria-haspopup="listbox"
                aria-expanded="false" aria-controls="${escapeHtml(listboxId)}">
                <span id="${escapeHtml(valueId)}" class="student-subject-value">${escapeHtml(selectedSubject.name)}</span>
                <span class="student-subject-chevron" aria-hidden="true"></span>
            </button>
            <div id="${escapeHtml(listboxId)}" class="student-subject-options" role="listbox"
                aria-labelledby="${escapeHtml(labelId)}" hidden>
                ${subjects.map(subject => {
                    const isSelected = subject.slug === selectedSubject.slug;
                    return `
                        <button class="student-subject-option" type="button" role="option"
                            data-subject-slug="${escapeHtml(subject.slug)}" aria-selected="${isSelected}">
                            <span class="subject-color-dot" style="background:${escapeHtml(subject.color)};"></span>
                            <span>${escapeHtml(subject.name)}</span>
                            <span class="student-subject-option-check" aria-hidden="true">✓</span>
                        </button>
                    `;
                }).join('')}
            </div>
        `;

        const trigger = picker.querySelector('.student-subject-trigger');
        const listbox = picker.querySelector('.student-subject-options');
        const options = [...picker.querySelectorAll('.student-subject-option')];
        const selectedOption = options.find(option => option.getAttribute('aria-selected') === 'true') || options[0];
        const closeOnOutsidePointer = event => {
            if (!picker.contains(event.target)) setOpen(false);
        };
        const setOpen = open => {
            trigger?.setAttribute('aria-expanded', String(open));
            if (listbox) listbox.hidden = !open;
            picker.classList.toggle('is-open', open);
            document.removeEventListener('pointerdown', closeOnOutsidePointer);
            if (open) document.addEventListener('pointerdown', closeOnOutsidePointer);
        };
        const focusOption = index => options[(index + options.length) % options.length]?.focus();

        trigger?.addEventListener('click', () => setOpen(trigger.getAttribute('aria-expanded') !== 'true'));
        trigger?.addEventListener('keydown', event => {
            if (!['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
            event.preventDefault();
            setOpen(true);
            const selectedIndex = Math.max(0, options.indexOf(selectedOption));
            focusOption(event.key === 'ArrowUp' || event.key === 'End' ? options.length - 1 : selectedIndex);
        });
        listbox?.addEventListener('keydown', event => {
            const currentIndex = options.indexOf(document.activeElement);
            if (event.key === 'Escape') {
                event.preventDefault();
                setOpen(false);
                trigger?.focus();
            } else if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
                event.preventDefault();
                focusOption(currentIndex + (event.key === 'ArrowDown' ? 1 : -1));
            } else if (event.key === 'Home' || event.key === 'End') {
                event.preventDefault();
                focusOption(event.key === 'Home' ? 0 : options.length - 1);
            }
        });
        options.forEach(option => option.addEventListener('click', () => {
            const subjectSlug = option.dataset.subjectSlug;
            setOpen(false);
            if (subjectSlug === this.sm.selectedSubjectSlug) {
                trigger?.focus();
                return;
            }
            this.sm.selectSubject(subjectSlug);
        }));
        container.appendChild(picker);
    }

    async loadVocabularyOverride(vocabMeta, options = {}) {
        if (this.sm.authDisabled || !vocabMeta?.id || !navigator.onLine) return null;

        try {
            const vocabulary = await requestWithTimeout(signal => (
                vocabularyRepository.get(vocabMeta.id, { signal })
            ), {
                signal: options.signal,
                timeoutMs: options.timeoutMs || 8000,
                label: 'Loading the latest vocabulary settings'
            });
            return vocabulary ? { ...vocabulary, __source: 'cloud' } : null;
        } catch (error) {
            if (!options.signal?.aborted) console.warn('Could not load live vocabulary settings:', error);
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
        const session = this.activities.session;
        const loadId = session.beginVocabularyLoad();
        const signal = session.vocabularyLoadController.signal;
        const isCurrentLoad = () => session.isVocabularyLoadCurrent(loadId) && !signal.aborted;
        this.renderVocabularyLoading(vocabMeta, options);

        const overridePromise = this.loadVocabularyOverride(vocabMeta, { signal });
        const fileData = vocabMeta.path
            ? await loadVocabularyFile(vocabMeta.path, { signal, timeoutMs: 8000 })
            : null;
        if (!isCurrentLoad()) return;

        let vocabData = this.mergeVocabularyData({ meta: vocabMeta, fileData });
        if (!vocabData.words?.length) {
            const override = await overridePromise;
            if (!isCurrentLoad()) return;
            vocabData = this.mergeVocabularyData({ meta: vocabMeta, fileData, override });
        }

        if (!vocabData?.words?.length) {
            console.error('Failed to load vocabulary data for:', vocabMeta);
            this.renderVocabularyLoadError(vocabMeta, options);
            return;
        }

        this.applyVocabularyData(vocabData);

        if (!options.fromRoute) {
            const unitId = this.sm.getCurrentVocabRouteId();
            if (unitId) {
                this.sm.setRoute({ view: 'unit', unitId });
            }
        }

        if (!options.deferActivityMenu) {
            this.activities.menu.showActivityMenu(options);
        }

        const pendingOverride = overridePromise
            .then(async override => {
                if (!isCurrentLoad()) return;
                if (override) {
                    const merged = this.mergeVocabularyData({ meta: vocabMeta, fileData, override });
                    this.applyVocabularyData(merged);
                    if (!options.deferActivityMenu && !this.sm.currentActivityType) {
                        this.activities.menu.showActivityMenu(options);
                    }
                }
                await this.activities.wordHunt.migrateLegacyWordHuntImages();
            })
            .catch(error => {
                if (!signal.aborted) console.warn('Could not finish loading live vocabulary settings:', error);
            })
            .finally(() => {
                if (session.pendingVocabularyOverride === pendingOverride) {
                    session.pendingVocabularyOverride = null;
                }
            });
        session.pendingVocabularyOverride = pendingOverride;
    }

    applyVocabularyData(vocabData) {
        this.sm.currentVocab = vocabData;
        const unitProgress = this.activities.progressFlow.ensureUnitProgress(vocabData);
        this.sm.unitScores = unitProgress.scores;
        this.sm.unitImages = unitProgress.images;
        this.sm.unitWordHunt = unitProgress.wordHunt;
        this.sm.unitStates = unitProgress.states;
        this.activities.coverage.initWordCoverage();
    }

    renderVocabularyLoading(vocabMeta = {}, options = {}) {
        if (options.deferActivityMenu) {
            const activityView = $('#activity-view');
            const activityContainer = $('#activity-container');
            setStudentPageLoading(activityView, true);
            if (activityContainer) {
                activityContainer.innerHTML = getStudentPageSkeleton('activity', 'Loading activity');
            }
            this.sm.switchView('activity-view');
            return;
        }

        const title = $('#current-unit-title');
        const description = $('#current-unit-description');
        const grid = $('#activity-menu-view .activities-grid');
        const view = $('#activity-menu-view');
        setStudentPageLoading(view, true);
        if (title) title.textContent = '';
        if (description) description.textContent = '';
        if (grid) {
            grid.querySelectorAll(':scope > .activity-flow-section').forEach(section => {
                section.hidden = true;
            });
            grid.querySelectorAll('.activity-card').forEach(card => {
                card.disabled = true;
            });
            let state = grid.querySelector(':scope > .unit-loading-state');
            if (!state) {
                state = createElement('div', 'unit-loading-state');
                state.setAttribute('role', 'status');
                grid.prepend(state);
            }
            state.classList.remove('unit-load-error');
            state.innerHTML = getStudentPageSkeleton('unit', 'Loading vocabulary unit');
        }
        this.sm.switchView('activity-menu-view');
    }

    renderVocabularyLoadError(vocabMeta = {}, options = {}) {
        if (options.deferActivityMenu) {
            const activityView = $('#activity-view');
            const activityContainer = $('#activity-container');
            const offline = !navigator.onLine;
            const message = offline
                ? 'This vocabulary has not been saved on this device yet. Reconnect once to download it.'
                : 'This vocabulary could not be loaded. Check the connection and try again.';
            setStudentPageLoading(activityView, false);
            if (activityContainer) {
                activityContainer.innerHTML = `
                    <div class="activity-load-error" role="alert">
                        <h2>Activity did not load</h2>
                        <p>${escapeHtml(message)}</p>
                        <div class="activity-load-error-actions">
                            <button type="button" class="btn primary-btn" data-retry-vocabulary>Try again</button>
                            <button type="button" class="btn secondary-btn" data-return-to-units>Back to Units</button>
                        </div>
                    </div>
                `;
                activityContainer.querySelector('[data-retry-vocabulary]')?.addEventListener('click', () => {
                    this.loadVocabulary(vocabMeta, options);
                }, { once: true });
                activityContainer.querySelector('[data-return-to-units]')?.addEventListener('click', () => {
                    this.sm.navigateTo({ view: 'units' });
                }, { once: true });
            }
            this.sm.switchView('activity-view');
            notifications.error(message);
            return;
        }

        const grid = $('#activity-menu-view .activities-grid');
        const view = $('#activity-menu-view');
        setStudentPageLoading(view, false);
        const title = $('#current-unit-title');
        if (title) title.textContent = vocabMeta.name || 'Vocabulary unit';
        const offline = !navigator.onLine;
        const message = offline
            ? 'This vocabulary has not been saved on this device yet. Reconnect once to download it.'
            : 'This vocabulary could not be loaded. Check the connection and try again.';

        if (grid) {
            let state = grid.querySelector(':scope > .unit-loading-state');
            if (!state) {
                state = createElement('div', 'unit-loading-state');
                grid.prepend(state);
            }
            state.classList.add('unit-load-error');
            state.setAttribute('role', 'alert');
            state.innerHTML = `
                <p>${escapeHtml(message)}</p>
                <button type="button" class="btn btn-primary" data-retry-vocabulary>Try again</button>
            `;
            state.querySelector('[data-retry-vocabulary]')?.addEventListener('click', () => {
                this.loadVocabulary(vocabMeta, options);
            }, { once: true });
        }

        notifications.error(message);
    }
}
