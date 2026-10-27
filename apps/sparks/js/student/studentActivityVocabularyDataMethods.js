import { schoolContext } from '../services/schoolContext.js';
import { selectStudentAssignmentSchool, waitStudentSchoolReady } from './studentSchoolSession.js';
import { weeklyVocabularyVisible } from './weeklyVocabularyPolicy.js';
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

    async loadClassSelection(options = {}) {
        if (this.sm.authDisabled) return;
        const user = this.sm.currentUser;
        const owner = user?.uid || user?.id;
        const cloud = this.sm.progress?.cloud;
        const generation = cloud?.cloudGeneration;
        const current = () => user === this.sm.currentUser && cloud === this.sm.progress?.cloud
            && generation === cloud?.cloudGeneration && !options.signal?.aborted
            && (options.isCurrent?.() ?? true);
        const { StudentClassSelection } = await import('./studentClassSelection.js');
        if (!owner || !current()) return false;
        this.classSelection ||= new StudentClassSelection(this.sm);
        await this.classSelection.load(options);
        if (!current()) return false;
        await waitStudentSchoolReady(this.sm, options);
        return current();
    }

    async prepareClassData(options = {}) {
        const user = this.sm.currentUser;
        const mode = this.sm.authDisabled;
        const cloud = this.sm.progress?.cloud;
        const generation = cloud?.cloudGeneration;
        const current = () => this.sm.authDisabled === mode && this.sm.currentUser === user && this.sm.progress?.cloud === cloud
            && cloud?.cloudGeneration === generation && !options.signal?.aborted && (options.isCurrent?.() ?? true);
        if (!current()) return null;
        if (!this.sm.authDisabled) {
            let classRead;
            let loaded;
            try {
                loaded = await requestWithTimeout(signal => this.loadClassSelection({
                    ...options, signal, isCurrent: () => current() && !signal.aborted,
                    onPending: (selection, read) => { classRead = { selection, read }; options.onPending?.(selection, read); }
                }), { signal: options.signal, timeoutMs: options.timeoutMs || 10000, label: 'Loading class assignments' });
            } catch (error) {
                if (error.code === 'REQUEST_TIMEOUT') classRead?.selection.cancelRead(classRead.read);
                throw error;
            }
            if (loaded === false || !current()) return null;
            const selection = this.classSelection;
            if (!selection?.ready || selection.owner !== (user?.uid || user?.id)
                || selection.readySchoolGeneration !== schoolContext.getGeneration()) {
                throw new Error('Class assignments are not ready. Please try again.');
            }
        }
        if (!current()) return null;
        const selection = this.classSelection;
        const classGeneration = selection?.generation;
        const schoolGeneration = schoolContext.getGeneration();
        return { isCurrent: () => current() && schoolGeneration === schoolContext.getGeneration()
            && (this.sm.authDisabled || selection === this.classSelection && selection.ready
                && selection.generation === classGeneration) };
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
        if (!this.sm.authDisabled) return this.classSelection?.owner === (this.sm.currentUser?.uid || this.sm.currentUser?.id) ? this.classSelection?.vocabs || [] : [];
        let vocabs = [];

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
        let vocabs = this.getAllVocabularySources().filter(vocab => weeklyVocabularyVisible(vocab, this.sm.studentProfile));

        if (vocabs.length === 0) {
            return { vocabs: [], message: 'No vocabularies found.' };
        }

        const studentGrade = this.sm.authDisabled && this.sm.studentProfile.grade ? String(this.sm.studentProfile.grade).trim() : '';

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

        if (this.sm.authDisabled) this.sm.ensureSelectedSubject(vocabs);
        const selectedSubject = this.sm.getSelectedSubject();
        if (this.sm.authDisabled) vocabs = vocabs.filter(vocab => getVocabSubjectSlug(vocab) === this.sm.selectedSubjectSlug);

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

        return { vocabs, message: '' };
    }

    getGradeMatchedVocabularySources() {
        let vocabs = this.getAllVocabularySources().filter(vocab => weeklyVocabularyVisible(vocab, this.sm.studentProfile));
        const studentGrade = this.sm.authDisabled && this.sm.studentProfile.grade ? String(this.sm.studentProfile.grade).trim() : '';

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

    async renderSubjectPicker(targetId) {
        const container = $(targetId);
        if (!container) return;
        if (!this.sm.authDisabled) {
            this.classSelection?.render(container);
            return;
        }
        const { renderDemoSubjectPicker } = await import('./studentSubjectPicker.js');
        if (this.sm.authDisabled) renderDemoSubjectPicker.call(this, targetId);
    }

    async loadVocabularyOverride(vocabMeta, options = {}) {
        if (vocabMeta?.assignmentId || this.sm.authDisabled || !vocabMeta?.id || !navigator.onLine) return null;

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
        if (!this.sm.authDisabled && !vocabMeta?.assignmentId) {
            this.sm.navigateTo({ view: 'classes' });
            return;
        }
        const session = this.activities.session;
        const loadId = session.beginVocabularyLoad();
        const signal = session.vocabularyLoadController.signal;
        const user = this.sm.currentUser, mode = this.sm.authDisabled;
        const cloud = this.sm.progress?.cloud, cloudGeneration = cloud?.cloudGeneration;
        let navigation = this.sm.routing?.arcadeReadController?.signal;
        const isCurrentLoad = () => session.isVocabularyLoadCurrent(loadId) && !signal.aborted
            && user === this.sm.currentUser && mode === this.sm.authDisabled
            && cloud === this.sm.progress?.cloud && cloudGeneration === cloud?.cloudGeneration
            && !navigation?.aborted && navigation === this.sm.routing?.arcadeReadController?.signal;
        this.renderVocabularyLoading(vocabMeta, options);

        if (vocabMeta.assignmentId) {
            try {
                const { classroomRepository, assignmentVocabulary } = await import('../services/classroomRepository.js');
                if (!isCurrentLoad()) return;
                const detail = await classroomRepository.readAssignment(vocabMeta.assignmentId, { signal });
                if (!isCurrentLoad()) return;
                await selectStudentAssignmentSchool(this.sm, detail, { isCurrent: isCurrentLoad, signal });
                if (!isCurrentLoad()) return;
                vocabMeta = assignmentVocabulary(detail);
            } catch (error) {
                if (!isCurrentLoad()) return;
                console.warn('Could not load the class assignment:', error);
                this.renderVocabularyLoadError(vocabMeta, options);
                return;
            }
        }
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
                // Only this current load's deliberate unit normalization renews
                // its lease; an external away/back navigation never does.
                navigation = this.sm.routing?.arcadeReadController?.signal;
            }
        }

        if (!options.deferActivityMenu) {
            await this.activities.menu.showActivityMenu(options);
        }
        if (!isCurrentLoad()) return;

        const pendingOverride = overridePromise
            .then(async override => {
                if (!isCurrentLoad()) return;
                if (override) {
                    const merged = this.mergeVocabularyData({ meta: vocabMeta, fileData, override });
                    this.applyVocabularyData(merged);
                    if (!options.deferActivityMenu && !this.sm.currentActivityType) {
                        await this.activities.menu.showActivityMenu(options);
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
                activityContainer.innerHTML = getStudentPageSkeleton('activity', 'Loading activity', options);
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
