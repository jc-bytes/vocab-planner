import { notifications } from './main.js';
import { supabaseService } from './supabaseService.js';
import { teacherWordHuntReviewDataMethods } from './teacherWordHuntReview/teacherWordHuntReviewDataMethods.js';
import { teacherWordHuntReviewImageMethods } from './teacherWordHuntReview/teacherWordHuntReviewImageMethods.js';
import { teacherWordHuntReviewInteractionMethods } from './teacherWordHuntReview/teacherWordHuntReviewInteractionMethods.js';
import { teacherWordHuntReviewStateMethods } from './teacherWordHuntReview/teacherWordHuntReviewStateMethods.js';
import { teacherWordHuntReviewViewMethods } from './teacherWordHuntReview/teacherWordHuntReviewViewMethods.js';

const teacherWordHuntReviewMethodGroups = [
    teacherWordHuntReviewDataMethods,
    teacherWordHuntReviewStateMethods,
    teacherWordHuntReviewViewMethods,
    teacherWordHuntReviewInteractionMethods,
    teacherWordHuntReviewImageMethods
];

function installInternalMethods(target) {
    teacherWordHuntReviewMethodGroups.forEach(methods => {
        Object.entries(Object.getOwnPropertyDescriptors(methods)).forEach(([name, descriptor]) => {
            Object.defineProperty(target, name, {
                ...descriptor,
                enumerable: false
            });
        });
    });
}

export function createTeacherWordHuntReviewFeature({
    root,
    ensureAuthenticated,
    activateReview,
    isReviewActive,
    isAuthenticationDisabled,
    getSubjects,
    refreshIcons,
    repository = {
        loadReviewData: () => supabaseService.getWordHuntReviewData(),
        downloadImage: path => supabaseService.downloadWordHuntImage(path)
    },
    feedback = notifications,
    storage = globalThis.localStorage,
    objectUrls = {
        create: blob => globalThis.URL.createObjectURL(blob),
        revoke: url => globalThis.URL.revokeObjectURL(url)
    },
    documentTarget = globalThis.document,
    escapeSelector = value => globalThis.CSS.escape(value),
    query = selector => root?.querySelector(selector) || null,
    queryAll = selector => Array.from(root?.querySelectorAll(selector) || [])
}) {
    const listenerDisposers = [];
    const context = {
        root,
        documentTarget,
        ensureAuthenticated,
        activateReview,
        isReviewActive,
        isAuthenticationDisabled,
        getSubjects,
        refreshIcons,
        repository,
        feedback,
        storage,
        objectUrls,
        escapeSelector,
        query,
        queryAll,
        wordHuntReviewInitialized: false,
        wordHuntReviewRows: [],
        filteredWordHuntReviewRows: [],
        activeWordHuntReviewKey: '',
        wordHuntReviewImageUrls: [],
        wordHuntReviewDrilldown: { subject: '', grade: '', group: '', unitId: '' },
        wordHuntReviewFilters: { status: '', search: '' },
        wordHuntReviewViewModes: {},
        wordHuntReviewDataCache: null,
        wordHuntReviewDataPromise: null,
        wordHuntReviewLoadGeneration: 0,
        wordHuntReviewImageGeneration: 0,
        addPersistentListener(element, type, handler) {
            if (!element) return;
            element.addEventListener(type, handler);
            listenerDisposers.push(() => element.removeEventListener(type, handler));
        }
    };
    installInternalMethods(context);

    function destroy() {
        context.wordHuntReviewLoadGeneration += 1;
        context.wordHuntReviewDataCache = null;
        context.wordHuntReviewDataPromise = null;
        context.revokeWordHuntReviewImageUrls();
        listenerDisposers.splice(0).forEach(dispose => dispose());
        context.wordHuntReviewRows = [];
        context.filteredWordHuntReviewRows = [];
        context.activeWordHuntReviewKey = '';
        context.wordHuntReviewDrilldown = { subject: '', grade: '', group: '', unitId: '' };
        context.wordHuntReviewFilters = { status: '', search: '' };
        context.wordHuntReviewInitialized = false;
    }

    return Object.freeze({
        show: context.showWordHuntReviewView.bind(context),
        load: context.loadWordHuntReview.bind(context),
        destroy
    });
}
