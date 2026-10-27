import { teacherVocabularyBrowserViewMethods } from './teacherVocabularyLibrary/teacherVocabularyBrowserViewMethods.js';
import { teacherVocabularyRowViewMethods } from './teacherVocabularyLibrary/teacherVocabularyRowViewMethods.js';
import { createTeacherVocabularyBrowserModel } from './teacherVocabularyLibrary/teacherVocabularyBrowserModel.js';
import { showLibraryLoading } from './teacherLibraryControls.js';
import { renderLibraryViewToggle } from './learningLibraryView.js';
import { $, createElement } from './main.js';
import { requestWithTimeout } from './services/requestReliability.js';

export function createTeacherVocabularyBrowserFeature(dependencies) {
    let active = false, destroyed = false, generation = 0, currentScope = () => false, hasLoaded = false;
    const context = {
        ...createTeacherVocabularyBrowserModel(dependencies),
        ...teacherVocabularyBrowserViewMethods,
        ...teacherVocabularyRowViewMethods,
        libraryItems: [], libraryDrilldown: {}, librarySearchState: null, teacherVocabularyViewModes: {}, renderGeneration: 0,
        localCopyIds: new Set(),
        hasLocalCopy(id) { return this.localCopyIds.has(id); },
        refreshIcons: dependencies.refreshIcons,
        openTeacherVocabularyItem: dependencies.openItem,
        openAssignmentPublisher: dependencies.assignItem,
        removeLocalVocab: dependencies.removeDraft,
        deleteCloudVocab: dependencies.deleteSaved,
        captureTeacherNavigation: dependencies.captureNavigation,
        isTeacherNavigationCurrent: dependencies.isNavigationCurrent,
        isBrowserCurrent() { return active && !destroyed && currentScope() && dependencies.isActive(); },
        createTeacherVocabularyOperationGuard() {
            const run = generation, render = context.renderGeneration, scope = currentScope;
            return () => active && !destroyed && run === generation && render === context.renderGeneration
                && scope() && dependencies.isActive();
        },
        resetLibraryDrilldown() { this.libraryDrilldown = { subject: null, grade: null, trimester: null, month: null }; },
        updateVocabularyRoute() { dependencies.writeDrilldown(this.libraryDrilldown); },
        loadLibrary(options = {}) { return feature.refreshIfActive(options); },
        showMaterialRetry(mount) {
            const current = this.createTeacherVocabularyOperationGuard();
            if (!current() || !mount.isConnected) return;
            const retry = createElement('button', 'btn secondary-btn', 'Try loading material again');
            retry.type = 'button';
            retry.addEventListener('click', () => { if (current()) void feature.refreshIfActive(); });
            mount.replaceChildren(retry);
        }
    };
    try { context.teacherVocabularyViewModes = JSON.parse(localStorage.getItem('teacher_vocabulary_view_modes') || '{}') || {}; }
    catch { /* Optional device preference. */ }
    Object.assign(context, {
getTeacherVocabularyViewMode(drilldown = this.libraryDrilldown || {}) {
        const depth = this.getTeacherVocabularyViewDepth(drilldown);
        const savedMode = this.teacherVocabularyViewModes?.[depth];
        return savedMode === 'rows' || savedMode === 'cards'
            ? savedMode
            : this.getDefaultTeacherVocabularyViewMode(depth);
    },
setTeacherVocabularyViewMode(mode) {
        if (!this.isBrowserCurrent()) return;
        const depth = this.getTeacherVocabularyViewDepth();
        this.teacherVocabularyViewModes = {
            ...(this.teacherVocabularyViewModes || {}),
            [depth]: mode === 'rows' ? 'rows' : 'cards'
        };
        try { localStorage.setItem('teacher_vocabulary_view_modes', JSON.stringify(this.teacherVocabularyViewModes)); }
        catch { /* The in-memory choice still applies when preference storage is unavailable. */ }
        this.renderLibraryBrowser();
        this.refreshIcons();
    },
renderTeacherVocabularyViewControls() {
        const container = $('#teacher-vocab-view-toggle');
        if (!container) return;
        const current = this.createTeacherVocabularyOperationGuard();
        renderLibraryViewToggle(container, this.getTeacherVocabularyViewMode(), mode => { if (current()) this.setTeacherVocabularyViewMode(mode); }, 'data-teacher-vocab-view-mode');

    },
    createLibraryCard(container, vocab, type) {
        const mount = createElement('div', 'teacher-material-mount');
        container.appendChild(mount);
        const isCurrent = this.createTeacherVocabularyOperationGuard();
        void requestWithTimeout(() => import('./teacherUnitCard.js'), { timeoutMs: 10000, label: 'Loading vocabulary card' }).then(({ createTeacherUnitCard }) => {
            if (isCurrent() && mount.isConnected) {
                const card = createTeacherUnitCard(this, vocab, type);
                mount.replaceWith(card); this.refreshIcons(card);
            }
        }).catch(error => { if (isCurrent()) { console.warn('Could not load vocabulary card', error); this.showMaterialRetry(mount); } });
    }
    });
    const feature = Object.freeze({
        async show(options = {}) {
            if (destroyed || !dependencies.ensureAuthenticated(false) || !dependencies.isActive()) return;
            const keepContent = hasLoaded && active && currentScope() && dependencies.isActive();
            const run = ++generation;
            active = true;
            currentScope = dependencies.captureScope(options);
            const current = () => active && !destroyed && run === generation && currentScope() && dependencies.isActive();
            if (!current()) return;
            const list = $('#library-list');
            if (!list) return;
            context.libraryDrilldown = { ...dependencies.getDrilldown() };
            if (!keepContent) showLibraryLoading(list, 'Loading vocabulary materials...');
            list.setAttribute('aria-busy', 'true');
            try {
                const { items, stale, localCopyIds = [] } = await requestWithTimeout(() => dependencies.loadCatalog({ forceRefresh: options.forceRefresh === true }),
                    { timeoutMs: options.timeoutMs || 10000, label: 'Loading vocabulary materials' });
                if (!current() || stale || !list.isConnected) return;
                list.removeAttribute('aria-busy');
                hasLoaded = true;
                context.libraryItems = items;
                context.localCopyIds = new Set(localCopyIds);
                context.renderLibraryBrowser(list);
                context.refreshIcons();
            } catch (error) {
                if (!current()) return;
                console.error('Failed to load vocabularies:', error);
                const { showSectionLoadError } = await import('./ui/sectionRecovery.js');
                showSectionLoadError(list, { label: 'vocabulary materials', error, current, keepContent,
                    retry: () => feature.show({ forceRefresh: true }) });
            }
        },
        refreshIfActive(options = {}) {
            if (!active || destroyed || !currentScope() || !dependencies.isActive()) return;
            return feature.show(options);
        },
        deactivate() { active = false; generation++; },
        destroy() {
            feature.deactivate(); destroyed = true;
            hasLoaded = false;
            context.libraryItems = []; context.librarySearchState = null; context.localCopyIds.clear();
            for (const selector of ['#library-list', '#teacher-library-filters', '#teacher-library-result-count', '#teacher-vocab-breadcrumb', '#teacher-vocab-view-toggle']) {
                const node = $(selector);
                if (node) { node.replaceChildren(); delete node.libraryControlState; }
            }
        }
    });
    return feature;
}
