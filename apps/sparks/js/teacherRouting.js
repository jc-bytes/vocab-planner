import { parseHashLocation, writeHashLocation } from './services/hashRouting.js';
import { teacherPageRegistry } from './teacherPageRegistry.js';

const OVERVIEW_PAGE = teacherPageRegistry.get('overview');
const VOCABULARY_PAGE = teacherPageRegistry.get('vocabulary');

export function installTeacherRoutingMethods(TeacherManager) {
    Object.assign(TeacherManager.prototype, {
        parseRoute(hash = window.location.hash) {
            const location = parseHashLocation(hash);
            if (!location) return null;
            const { parts, params } = location;

            if (parts[0] !== 'teacher') return null;
            if (!parts[1] || parts[1] === OVERVIEW_PAGE.id) return { view: OVERVIEW_PAGE.id };
            if (parts[1] === 'students') return { view: 'students' };
            if (parts[1] === 'groups') return { view: 'groups' };
            if (parts[1] === 'word-hunt') return { view: VOCABULARY_PAGE.id, mode: 'review' };
            if (parts[1] === 'sparks') return { view: 'sparks' };
            if (parts[1] === 'activities') return { view: OVERVIEW_PAGE.id };
            if (parts[1] === 'quizzes' && parts[2] === 'editor') return { view: 'quiz-editor' };
            if (parts[1] === 'quizzes') return { view: 'quizzes' };
            if (parts[1] === 'data') return { view: 'data', tab: params.get('tab') || undefined };
            if (parts[1] === 'settings') return { view: 'settings', tab: params.get('tab') || undefined };
            if (parts[1] === 'data-settings') {
                const tab = params.get('tab') || undefined;
                const view = ['dashboard', 'export', 'view', 'reset'].includes(tab) ? 'data' : 'settings';
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
            if (route.view === 'students') return '#/teacher/students';
            if (route.view === 'groups') return '#/teacher/groups';
            if (route.view === 'word-hunt-review') return `#/teacher/${VOCABULARY_PAGE.id}?mode=review`;
            if (route.view === 'sparks') return '#/teacher/sparks';
            if (route.view === 'quizzes') return `#/teacher/${VOCABULARY_PAGE.id}?mode=quizzes`;
            if (route.view === 'quiz-editor') return '#/teacher/quizzes/editor';
            if (route.view === 'editor') {
                return route.vocabularyId
                    ? `#/teacher/${VOCABULARY_PAGE.id}/editor/${encodeURIComponent(route.vocabularyId)}`
                    : `#/teacher/${VOCABULARY_PAGE.id}/editor`;
            }
            if (route.view === 'data' || route.view === 'settings') {
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
            if (viewId === 'teacher-sparks-view') return { view: 'sparks' };
            if (viewId === 'teacher-progress-view') return { view: 'students' };
            if (viewId === 'teacher-groups-view') return { view: 'groups' };
            if (viewId === 'quiz-maker-view') return { view: 'quiz-editor' };
            if (viewId === 'teacher-data-management-view') {
                const currentRoute = this.parseRoute();
                if (currentRoute?.view === 'data' || currentRoute?.view === 'settings') return currentRoute;
                return { view: 'settings', tab: 'subjects' };
            }
            return { view: OVERVIEW_PAGE.id };
        },

        setRoute(route, options = {}) {
            writeHashLocation(this.buildRoute(route), options);
        },

        updateTeacherRouteForView(viewId, options = {}) {
            if (this.isApplyingRoute || !this.isAuthenticated || viewId === 'teacher-login-view') return;
            this.setRoute(this.currentTeacherRouteForView(viewId), options);
        },

        updateVocabularyRoute(options = {}) {
            if (this.isApplyingRoute || !this.isAuthenticated) return;
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

        async applyRoute(route) {
            if (!route) return;
            if (this.isApplyingRoute) {
                this.pendingTeacherRoute = route;
                return;
            }
            this.isApplyingRoute = true;
            let routeToApply = route;
            try {
                while (routeToApply) {
                    this.pendingTeacherRoute = null;
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
                                await this.loadLibrary();
                            } else if (this.vocabularyMode !== 'quizzes' && !this.libraryItems?.length) {
                                this.getTeacherLibrary().then(({ items }) => {
                                    this.libraryItems = items;
                                }).catch(error => console.warn('Could not warm vocabulary library cache:', error));
                            }
                            break;
                        case 'editor':
                            if (routeToApply.vocabularyId && routeToApply.vocabularyId !== this.vocabSet?.id) {
                                await this.loadVocabularyById(routeToApply.vocabularyId);
                            } else {
                                this.showEditor();
                            }
                            break;
                        case 'students':
                            await this.showProgressView();
                            break;
                        case 'groups':
                            await this.showGroupsView();
                            break;
                        case 'word-hunt-review':
                            await this.showWordHuntReviewView();
                            break;
                        case 'sparks':
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
                        case 'data':
                        case 'settings':
                            await this.showDataManagementView({ area: routeToApply.view, tab: routeToApply.tab });
                            break;
                        case OVERVIEW_PAGE.id:
                        default:
                            this.switchView(OVERVIEW_PAGE.viewId);
                            this.loadTeacherOverview();
                            break;
                    }
                    routeToApply = this.pendingTeacherRoute;
                }
            } finally {
                this.isApplyingRoute = false;
                this.pendingTeacherRoute = null;
            }
        }
    });
}
