export function installTeacherRoutingMethods(TeacherManager) {
    Object.assign(TeacherManager.prototype, {
        safeDecodeRoutePart(value) {
            try {
                return decodeURIComponent(value);
            } catch {
                return value;
            }
        },

        parseRoute(hash = window.location.hash) {
            const rawHash = String(hash || '');
            if (!rawHash || rawHash === '#') return null;

            const routeText = rawHash.startsWith('#') ? rawHash.slice(1) : rawHash;
            const [rawPath, rawQuery = ''] = routeText.split('?');
            const path = rawPath.startsWith('/') ? rawPath.slice(1) : rawPath;
            const parts = path.split('/').filter(Boolean).map(part => this.safeDecodeRoutePart(part));
            const params = new URLSearchParams(rawQuery);

            if (parts[0] !== 'teacher') return null;
            if (!parts[1] || parts[1] === 'overview') return { view: 'overview' };
            if (parts[1] === 'students') return { view: 'students' };
            if (parts[1] === 'groups') return { view: 'groups' };
            if (parts[1] === 'word-hunt') return { view: 'vocabulary', mode: 'review' };
            if (parts[1] === 'sparks') return { view: 'sparks' };
            if (parts[1] === 'activities') return { view: 'overview' };
            if (parts[1] === 'quizzes' && parts[2] === 'editor') return { view: 'quiz-editor' };
            if (parts[1] === 'quizzes') return { view: 'quizzes' };
            if (parts[1] === 'data') return { view: 'data', tab: params.get('tab') || undefined };
            if (parts[1] === 'settings') return { view: 'settings', tab: params.get('tab') || undefined };
            if (parts[1] === 'data-settings') {
                const tab = params.get('tab') || undefined;
                const view = ['dashboard', 'export', 'view', 'reset'].includes(tab) ? 'data' : 'settings';
                return { view, tab };
            }
            if (parts[1] === 'vocabulary' && parts[2] === 'editor') {
                return {
                    view: 'editor',
                    vocabularyId: parts[3] || params.get('id') || null
                };
            }
            if (parts[1] === 'vocabulary') {
                return {
                    view: 'vocabulary',
                    subject: params.get('subject') || null,
                    grade: params.get('grade') || null,
                    trimester: params.get('trimester') || null,
                    month: params.get('month') || null,
                    mode: ['review', 'quizzes'].includes(params.get('mode')) ? params.get('mode') : 'assign'
                };
            }

            return { view: 'overview' };
        },

        buildRoute(route) {
            if (!route || !route.view) return '#/teacher/overview';
            if (route.view === 'overview') return '#/teacher/overview';
            if (route.view === 'students') return '#/teacher/students';
            if (route.view === 'groups') return '#/teacher/groups';
            if (route.view === 'word-hunt-review') return '#/teacher/vocabulary?mode=review';
            if (route.view === 'sparks') return '#/teacher/sparks';
            if (route.view === 'quizzes') return '#/teacher/vocabulary?mode=quizzes';
            if (route.view === 'quiz-editor') return '#/teacher/quizzes/editor';
            if (route.view === 'editor') {
                return route.vocabularyId
                    ? `#/teacher/vocabulary/editor/${encodeURIComponent(route.vocabularyId)}`
                    : '#/teacher/vocabulary/editor';
            }
            if (route.view === 'data' || route.view === 'settings') {
                const params = new URLSearchParams();
                if (route.tab) params.set('tab', route.tab);
                const query = params.toString();
                return `#/teacher/${route.view}${query ? `?${query}` : ''}`;
            }
            if (route.view === 'vocabulary') {
                const params = new URLSearchParams();
                if (route.subject) params.set('subject', route.subject);
                if (route.grade) params.set('grade', route.grade);
                if (route.trimester) params.set('trimester', route.trimester);
                if (route.month) params.set('month', route.month);
                if (route.mode === 'review' || route.mode === 'quizzes') params.set('mode', route.mode);
                const query = params.toString();
                return `#/teacher/vocabulary${query ? `?${query}` : ''}`;
            }
            return '#/teacher/overview';
        },

        currentTeacherRouteForView(viewId) {
            if (viewId === 'teacher-dashboard-view') {
                return {
                    view: 'vocabulary',
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
                return {
                    view: this.dataManagementArea === 'data' ? 'data' : 'settings',
                    tab: this.activeDataTab || undefined
                };
            }
            return { view: 'overview' };
        },

        setRoute(route, options = {}) {
            const hash = this.buildRoute(route);
            if (window.location.hash === hash) return;
            const nextUrl = `${window.location.pathname}${window.location.search}${hash}`;
            const method = options.replace ? 'replaceState' : 'pushState';
            window.history[method](null, '', nextUrl);
        },

        updateTeacherRouteForView(viewId, options = {}) {
            if (this.isApplyingRoute || !this.isAuthenticated || viewId === 'teacher-login-view') return;
            this.setRoute(this.currentTeacherRouteForView(viewId), options);
        },

        updateVocabularyRoute(options = {}) {
            if (this.isApplyingRoute || !this.isAuthenticated) return;
            this.lastVocabularyRoute = {
                view: 'vocabulary',
                subject: this.libraryDrilldown.subject,
                grade: this.libraryDrilldown.grade,
                trimester: this.libraryDrilldown.trimester,
                month: this.libraryDrilldown.month,
                mode: this.vocabularyMode
            };
            this.setRoute(this.lastVocabularyRoute, options);
        },

        async restoreRouteOrDefault(defaultRoute = { view: 'overview' }) {
            this.routeReady = true;
            const route = this.parseRoute() || defaultRoute;
            if (!this.parseRoute()) {
                this.setRoute(route, { replace: true });
            }
            await this.applyRoute(route);
        },

        async handleRouteChange() {
            if (!this.isAuthenticated) return;
            const route = this.parseRoute() || { view: 'overview' };
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
                        case 'vocabulary':
                            this.libraryDrilldown = {
                                subject: routeToApply.subject || null,
                                grade: routeToApply.grade || null,
                                trimester: routeToApply.trimester || null,
                                month: routeToApply.month || null
                            };
                            this.vocabularyMode = ['review', 'quizzes'].includes(routeToApply.mode) ? routeToApply.mode : 'assign';
                            this.lastVocabularyRoute = { ...routeToApply };
                            this.switchView('teacher-dashboard-view');
                            this.setVocabularyWorkflowTab(this.vocabularyMode, {
                                updateRoute: false,
                                replace: true,
                                loadReview: this.vocabularyMode === 'review',
                                loadQuizzes: this.vocabularyMode === 'quizzes'
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
                            await this.showQuizzesView({ replaceRoute: true });
                            break;
                        case 'quiz-editor':
                            await this.openQuizMaker({ returnTo: 'quizzes', restoreDraft: true });
                            break;
                        case 'data':
                        case 'settings':
                            await this.showDataManagementView({ area: routeToApply.view, tab: routeToApply.tab });
                            break;
                        case 'overview':
                        default:
                            this.switchView('teacher-overview-view');
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
