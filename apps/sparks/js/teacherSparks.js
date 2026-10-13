import { teacherSparkDataMethods } from './teacherSparks/teacherSparkDataMethods.js';
import { teacherSparkEditorMethods } from './teacherSparks/teacherSparkEditorMethods.js';
import { teacherSparkLibraryModelMethods } from './teacherSparks/teacherSparkLibraryModelMethods.js';
import { teacherSparkLibraryViewMethods } from './teacherSparks/teacherSparkLibraryViewMethods.js';
import { teacherSparkPersistenceMethods } from './teacherSparks/teacherSparkPersistenceMethods.js';
import { bindTeacherSparksListeners } from './teacherSparks/teacherSparkListeners.js';
import { serverStateQuery } from './services/serverStateQuery.js';
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
    showEditorView,
    publishMaterial,
    isAuthenticationDisabled,
    getCurrentUser,
    refreshIcons,
    queryService = serverStateQuery,
    repository = sparksRepository,
    feedback,
    documentTarget = globalThis.document,
    query = selector => documentTarget?.querySelector(selector) || null,
    queryAll = selector => Array.from(documentTarget?.querySelectorAll(selector) || [])
}) {
    const context = {
        ensureAuthenticated,
        showView,
        showEditorView,
        publishMaterial,
        isAuthenticationDisabled,
        getCurrentUser,
        refreshIcons,
        queryService,
        repository,
        feedback,
                    documentTarget,
        query,
        queryAll,
        weeklySparkItems: [],
        weeklySparkActiveView: 'types',
        weeklySparkTypeFilter: 'all',
        weeklySparkMonth: null,
        weeklySparkLoadGeneration: 0,
        weeklySparkEditorGeneration: 0,
        weeklySparkLifecycleGeneration: 0,
        editingSparkId: null,
        sparkModalMode: 'create',
    };
    installInternalMethods(context);

    const removeListeners = bindTeacherSparksListeners(context);

    function destroy() {
        context.weeklySparkLoadGeneration += 1;
        context.weeklySparkLifecycleGeneration += 1;
        void context.invalidateWeeklySparks().catch(error => {
            console.warn('Could not invalidate the Teacher Sparks query during cleanup:', error);
        });
        context.weeklySparkItems = [];
        context.editingSparkId = null;
        context.sparkModalMode = 'create';
        removeListeners();
        query('#spark-form')?.reset?.();
        const list = query('#spark-library-list');
        if (list) {
            list.innerHTML = '';
            list.removeAttribute('aria-busy');
        }
    }

    return Object.freeze({
        show: context.showSparksView.bind(context),
        edit: context.showSparkEditor.bind(context),
        destroy
    });
}
