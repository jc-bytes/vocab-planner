import { parseHashLocation, writeHashLocation } from './services/hashRouting.js';
import { teacherPageRegistry } from './teacherPageRegistry.js';

const OVERVIEW_PAGE = teacherPageRegistry.get('overview');
const VOCABULARY_PAGE = teacherPageRegistry.get('vocabulary');
const SPARKS_PAGE = teacherPageRegistry.get('sparks');
const STUDENTS_PAGE = teacherPageRegistry.get('students');
const GROUPS_PAGE = teacherPageRegistry.get('groups');
const DATA_PAGE = teacherPageRegistry.get('data');
const SETTINGS_PAGE = teacherPageRegistry.get('settings');

export function installTeacherRoutingMethods(TeacherManager) {
    Object.assign(TeacherManager.prototype, {
        parseRoute(hash = window.location.hash) {
            const location = parseHashLocation(hash);
            if (!location) return null;
            const { parts, params } = location;

            if (parts[0] !== 'teacher') return null;
            if (!parts[1] || parts[1] === OVERVIEW_PAGE.id) return { view: OVERVIEW_PAGE.id };
            if (parts[1] === STUDENTS_PAGE.id) return { view: STUDENTS_PAGE.id };
            if (parts[1] === GROUPS_PAGE.id) return { view: GROUPS_PAGE.id };
            if (parts[1] === 'word-hunt') return { view: VOCABULARY_PAGE.id, mode: 'review' };
            if (parts[1] === SPARKS_PAGE.id) return { view: SPARKS_PAGE.id };
            if (parts[1] === 'activities') return { view: OVERVIEW_PAGE.id };
            if (parts[1] === 'quizzes' && parts[2] === 'editor') return { view: 'quiz-editor' };
            if (parts[1] === 'quizzes') return { view: 'quizzes' };
            if (parts[1] === DATA_PAGE.id) return { view: DATA_PAGE.id, tab: params.get('tab') || undefined };
            if (parts[1] === SETTINGS_PAGE.id) return { view: SETTINGS_PAGE.id, tab: params.get('tab') || undefined };
            if (parts[1] === 'data-settings') {
                const tab = params.get('tab') || undefined;
                const view = ['dashboard', 'export', 'view', 'reset'].includes(tab) ? DATA_PAGE.id : SETTINGS_PAGE.id;
                return { view, tab };
            }
            if (parts[1] === VOCABULARY_PAGE.id && parts[2] === 'editor') {
                return {
                    view: 'editor',
                    vocabularyId: parts[3] || params.get('id') || null
                };
            }
            if (parts[1] === VOCABULARY_PAGE.id) {
                return {
                    view: VOCABULARY_PAGE.id,
                    subject: params.get('subject') || null,
                    grade: params.get('grade') || null,
                    trimester: params.get('trimester') || null,
                    month: params.get('month') || null,
                    mode: ['review', 'quizzes'].includes(params.get('mode')) ? params.get('mode') : 'assign'
                };
            }

            return { view: OVERVIEW_PAGE.id };
        },

        buildRoute(route) {
            if (!route || !route.view) return `#/teacher/${OVERVIEW_PAGE.id}`;
            if (route.view === OVERVIEW_PAGE.id) return `#/teacher/${OVERVIEW_PAGE.id}`;
            if (route.view === STUDENTS_PAGE.id) return `#/teacher/${STUDENTS_PAGE.id}`;
            if (route.view === GROUPS_PAGE.id) return `#/teacher/${GROUPS_PAGE.id}`;
            if (route.view === 'word-hunt-review') return `#/teacher/${VOCABULARY_PAGE.id}?mode=review`;
            if (route.view === SPARKS_PAGE.id) return `#/teacher/${SPARKS_PAGE.id}`;
            if (route.view === 'quizzes') return `#/teacher/${VOCABULARY_PAGE.id}?mode=quizzes`;
            if (route.view === 'quiz-editor') return '#/teacher/quizzes/editor';
            if (route.view === 'editor') {
                return route.vocabularyId
                    ? `#/teacher/${VOCABULARY_PAGE.id}/editor/${encodeURIComponent(route.vocabularyId)}`
                    : `#/teacher/${VOCABULARY_PAGE.id}/editor`;
            }
            if (route.view === DATA_PAGE.id || route.view === SETTINGS_PAGE.id) {
                const params = new URLSearchParams();
                if (route.tab) params.set('tab', route.tab);
                const query = params.toString();
                return `#/teacher/${route.view}${query ? `?${query}` : ''}`;
            }
            if (route.view === VOCABULARY_PAGE.id) {
                const params = new URLSearchParams();
                if (route.subject) params.set('subject', route.subject);
                if (route.grade) params.set('grade', route.grade);
                if (route.trimester) params.set('trimester', route.trimester);
                if (route.month) params.set('month', route.month);
                if (route.mode === 'review' || route.mode === 'quizzes') params.set('mode', route.mode);
                const query = params.toString();
                return `#/teacher/${VOCABULARY_PAGE.id}${query ? `?${query}` : ''}`;
            }
            return `#/teacher/${OVERVIEW_PAGE.id}`;
        },

        currentTeacherRouteForView(viewId) {
            if (viewId === VOCABULARY_PAGE.viewId) {
                if (this.vocabularyMode === 'quizzes') {
                    const currentRoute = this.parseRoute();
                    if (currentRoute?.view === VOCABULARY_PAGE.id && currentRoute.mode === 'quizzes') {
                        return currentRoute;
                    }
                    return { view: VOCABULARY_PAGE.id, mode: 'quizzes' };
                }
                return {
                    view: VOCABULARY_PAGE.id,
                    subject: this.libraryDrilldown.subject,
                    grade: this.libraryDrilldown.grade,
                    trimester: this.libraryDrilldown.trimester,
                    month: this.libraryDrilldown.month,
                    mode: this.vocabularyMode
                };
            }
            if (viewId === 'teacher-editor-view') {
                return {
                    view: 'editor',
                    vocabularyId: this.vocabSet?.id || null
                };
            }
            if (viewId === 'quiz-maker-view') return { view: 'quiz-editor' };
            if (viewId === DATA_PAGE.viewId) {
                const currentRoute = this.parseRoute();
                if (currentRoute?.view === DATA_PAGE.id || currentRoute?.view === SETTINGS_PAGE.id) return currentRoute;
                return { view: SETTINGS_PAGE.id, tab: 'subjects' };
            }
            const page = teacherPageRegistry.pages.find(candidate => candidate.viewId === viewId);
            return { view: page?.id || OVERVIEW_PAGE.id };
        },

        setRoute(route, options = {}) {
            writeHashLocation(this.buildRoute(route), options);
        },

        getTeacherNavigationOwnerId() {
            return this.currentUser?.uid || this.currentUser?.id || null;
        },

        beginTeacherNavigation() {
            this.teacherNavigationGeneration = (this.teacherNavigationGeneration || 0) + 1;
            return Object.freeze({
                generation: this.teacherNavigationGeneration,
                ownerId: this.getTeacherNavigationOwnerId()
            });
        },

        captureTeacherNavigation() {
            return Object.freeze({
                generation: this.teacherNavigationGeneration || 0,
                ownerId: this.getTeacherNavigationOwnerId()
            });
        },

        isTeacherNavigationCurrent(navigation) {
            return Boolean(navigation)
                && navigation.generation === (this.teacherNavigationGeneration || 0)
                && navigation.ownerId === this.getTeacherNavigationOwnerId();
        },

        invalidateTeacherNavigation() {
            this.teacherNavigationGeneration = (this.teacherNavigationGeneration || 0) + 1;
            this.pendingTeacherRoute = null;
            this.pendingTeacherNavigation = null;
        },

        updateTeacherRouteForView(viewId, options = {}) {
            if (this.isApplyingRoute || !this.isAuthenticated || viewId === 'teacher-login-view') return;
            this.setRoute(this.currentTeacherRouteForView(viewId), options);
        },

        updateVocabularyRoute(options = {}) {
            if ((this.isApplyingRoute && options.navigationIntent !== true) || !this.isAuthenticated) return;
            this.lastVocabularyRoute = {
                view: VOCABULARY_PAGE.id,
                subject: this.libraryDrilldown.subject,
                grade: this.libraryDrilldown.grade,
                trimester: this.libraryDrilldown.trimester,
                month: this.libraryDrilldown.month,
                mode: this.vocabularyMode
            };
            this.setRoute(this.lastVocabularyRoute, options);
        },

        async restoreRouteOrDefault(defaultRoute = { view: OVERVIEW_PAGE.id }) {
            this.routeReady = true;
            const route = this.parseRoute() || defaultRoute;
            if (!this.parseRoute()) {
                this.setRoute(route, { replace: true });
            }
            await this.applyRoute(route);
        },

        async handleRouteChange() {
            if (!this.isAuthenticated) return;
            const route = this.parseRoute() || { view: OVERVIEW_PAGE.id };
            await this.applyRoute(route);
        },

        async applyRoute(route, navigation = this.beginTeacherNavigation()) {
            if (!route) return;
            if (this.isApplyingRoute) {
                this.pendingTeacherRoute = route;
                this.pendingTeacherNavigation = navigation;
                return;
            }
            this.isApplyingRoute = true;
            let routeToApply = route;
            let navigationToApply = navigation;
            try {
                while (routeToApply) {
                    this.pendingTeacherRoute = null;
                    this.pendingTeacherNavigation = null;
                    if (!this.isTeacherNavigationCurrent(navigationToApply)) {
                        routeToApply = this.pendingTeacherRoute;
                        navigationToApply = this.pendingTeacherNavigation;
                        continue;
                    }
                    switch (routeToApply.view) {
                        case VOCABULARY_PAGE.id:
                            const routeDrilldown = {
                                subject: routeToApply.subject || null,
                                grade: routeToApply.grade || null,
                                trimester: routeToApply.trimester || null,
                                month: routeToApply.month || null
                            };
                            this.vocabularyMode = ['review', 'quizzes'].includes(routeToApply.mode) ? routeToApply.mode : 'assign';
                            if (this.vocabularyMode !== 'quizzes') {
                                this.libraryDrilldown = routeDrilldown;
                            }
                            this.lastVocabularyRoute = { ...routeToApply };
                            this.switchView(VOCABULARY_PAGE.viewId);
                            this.setVocabularyWorkflowTab(this.vocabularyMode, {
                                updateRoute: false,
                                replace: true,
                                loadReview: this.vocabularyMode === 'review',
                                loadQuizzes: this.vocabularyMode === 'quizzes',
                                drilldown: routeDrilldown
                            });
                            if (this.vocabularyMode === 'assign') {
                                await this.loadLibrary({
                                    isCurrent: () => this.isTeacherNavigationCurrent(navigationToApply)
                                });
                            } else if (this.vocabularyMode !== 'quizzes' && !this.libraryItems?.length) {
                                this.getTeacherLibrary().then(({ items, stale }) => {
                                    if (!stale && this.isTeacherNavigationCurrent(navigationToApply)) {
                                        this.libraryItems = items;
                                    }
                                }).catch(error => console.warn('Could not warm vocabulary library cache:', error));
                            }
                            break;
                        case 'editor':
                            if (routeToApply.vocabularyId && routeToApply.vocabularyId !== this.vocabSet?.id) {
                                await this.loadVocabularyById(routeToApply.vocabularyId, {
                                    isCurrent: () => this.isTeacherNavigationCurrent(navigationToApply)
                                });
                            } else {
                                this.showEditor();
                            }
                            break;
                        case STUDENTS_PAGE.id:
                            await this.showProgressView();
                            break;
                        case GROUPS_PAGE.id:
                            await this.showGroupsView();
                            break;
                        case 'word-hunt-review':
                            await this.showWordHuntReviewView();
                            break;
                        case SPARKS_PAGE.id:
                            await this.showSparksView();
                            break;
                        case 'quizzes':
                            await this.showQuizzesView({
                                replaceRoute: true,
                                drilldown: { subject: null, grade: null, trimester: null, month: null }
                            });
                            break;
                        case 'quiz-editor':
                            await this.openQuizMaker({ returnTo: 'quizzes', restoreDraft: true });
                            break;
                        case DATA_PAGE.id:
                        case SETTINGS_PAGE.id:
                            await this.showDataManagementView({ area: routeToApply.view, tab: routeToApply.tab });
                            break;
                        case OVERVIEW_PAGE.id:
                        default:
                            this.switchView(OVERVIEW_PAGE.viewId);
                            this.loadTeacherOverview();
                            break;
                    }
                    routeToApply = this.pendingTeacherRoute;
                    navigationToApply = this.pendingTeacherNavigation;
                }
            } finally {
                this.isApplyingRoute = false;
                this.pendingTeacherRoute = null;
                this.pendingTeacherNavigation = null;
            }
        }
    });
}
