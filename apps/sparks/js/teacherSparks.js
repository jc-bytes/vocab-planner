import { teacherSparkDataMethods } from './teacherSparks/teacherSparkDataMethods.js';
import { teacherSparkEditorMethods } from './teacherSparks/teacherSparkEditorMethods.js';
import { teacherSparkLibraryModelMethods } from './teacherSparks/teacherSparkLibraryModelMethods.js';
import { teacherSparkLibraryViewMethods } from './teacherSparks/teacherSparkLibraryViewMethods.js';
import { teacherSparkPersistenceMethods } from './teacherSparks/teacherSparkPersistenceMethods.js';
import { bindTeacherSparksListeners } from './teacherSparks/teacherSparkListeners.js';
import { sparksRepository } from './services/sparksRepository.js';

const teacherSparkMethodGroups = [
    teacherSparkDataMethods,
    teacherSparkLibraryModelMethods,
    teacherSparkLibraryViewMethods,
    teacherSparkEditorMethods,
    teacherSparkPersistenceMethods
];

function installInternalMethods(target) {
    teacherSparkMethodGroups.forEach(methods => {
        Object.entries(Object.getOwnPropertyDescriptors(methods)).forEach(([name, descriptor]) => {
            Object.defineProperty(target, name, {
                ...descriptor,
                enumerable: false
            });
        });
    });
}

export function createTeacherSparksFeature({
    ensureAuthenticated,
    showView,
    isAuthenticationDisabled,
    getCurrentUser,
    refreshIcons,
    repository = sparksRepository,
    feedback,
    setupDialog,
    openDialog,
    closeDialog,
    documentTarget = globalThis.document,
    query = selector => documentTarget?.querySelector(selector) || null,
    queryAll = selector => Array.from(documentTarget?.querySelectorAll(selector) || [])
}) {
    const context = {
        ensureAuthenticated,
        showView,
        isAuthenticationDisabled,
        getCurrentUser,
        refreshIcons,
        repository,
        feedback,
        setupDialog,
        openDialog,
        closeDialog,
        documentTarget,
        query,
        queryAll,
        weeklySparkItems: [],
        weeklySparkCache: null,
        weeklySparkPromise: null,
        weeklySparkActiveView: 'week',
        weeklySparkTypeFilter: 'all',
        weeklySparkMonth: null,
        weeklySparkLoadGeneration: 0,
        weeklySparkLifecycleGeneration: 0,
        editingSparkId: null,
        sparkModalMode: 'create',
    };
    installInternalMethods(context);

    setupDialog('#spark-modal', {
        dismissible: true,
        onClose: () => {
            context.editingSparkId = null;
            context.sparkModalMode = 'create';
            context.setSparkModalStatus('');
        }
    });
    const removeListeners = bindTeacherSparksListeners(context);

    function destroy() {
        context.weeklySparkLoadGeneration += 1;
        context.weeklySparkLifecycleGeneration += 1;
        context.weeklySparkCache = null;
        context.weeklySparkPromise = null;
        context.weeklySparkItems = [];
        context.editingSparkId = null;
        context.sparkModalMode = 'create';
        removeListeners();
        closeDialog('#spark-modal');
        const list = query('#spark-library-list');
        if (list) {
            list.innerHTML = '';
            list.removeAttribute('aria-busy');
        }
    }

    return Object.freeze({
        show: context.showSparksView.bind(context),
        destroy
    });
}
