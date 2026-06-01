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
            if (parts[1] === 'activities' && parts[2] === 'assignment' && parts[3]) {
                return { view: 'activity-assignment', assignmentId: parts[3] };
            }
            if (parts[1] === 'activities' && parts[2] === 'editor') return { view: 'activity-editor' };
            if (parts[1] === 'activities') {
                return {
                    view: 'activities',
                    subject: params.get('subject') || null,
                    grade: params.get('grade') || null,
                    month: params.get('month') || null,
                    week: params.get('week') || null,
                    mode: params.get('mode') === 'review' ? 'review' : 'assign'
                };
            }
            if (parts[1] === 'quizzes' && parts[2] === 'editor') return { view: 'quiz-editor' };
            if (parts[1] === 'quizzes') return { view: 'quizzes' };
            if (parts[1] === 'data-settings') return { view: 'data-settings', tab: params.get('tab') || undefined };
            if (parts[1] === 'vocabulary' && parts[2] === 'editor') return { view: 'editor' };
            if (parts[1] === 'vocabulary') {
                return {
                    view: 'vocabulary',
                    subject: params.get('subject') || null,
                    grade: params.get('grade') || null,
                    trimester: params.get('trimester') || null,
                    month: params.get('month') || null
                };
            }

            return { view: 'overview' };
        },

        buildRoute(route) {
            if (!route || !route.view) return '#/teacher/overview';
            if (route.view === 'overview') return '#/teacher/overview';
            if (route.view === 'students') return '#/teacher/students';
            if (route.view === 'activities') {
                const params = new URLSearchParams();
                if (route.subject) params.set('subject', route.subject);
                if (route.grade) params.set('grade', route.grade);
                if (route.mode !== 'review' && route.month) params.set('month', route.month);
                if (route.mode !== 'review' && route.week) params.set('week', route.week);
                if (route.mode === 'review') params.set('mode', 'review');
                const query = params.toString();
                return `#/teacher/activities${query ? `?${query}` : ''}`;
            }
            if (route.view === 'activity-editor') return '#/teacher/activities/editor';
            if (route.view === 'activity-assignment' && route.assignmentId) {
                return `#/teacher/activities/assignment/${encodeURIComponent(route.assignmentId)}`;
            }
            if (route.view === 'quizzes') return '#/teacher/quizzes';
            if (route.view === 'quiz-editor') return '#/teacher/quizzes/editor';
            if (route.view === 'editor') return '#/teacher/vocabulary/editor';
            if (route.view === 'data-settings') {
                const params = new URLSearchParams();
                if (route.tab) params.set('tab', route.tab);
                const query = params.toString();
                return `#/teacher/data-settings${query ? `?${query}` : ''}`;
            }
            if (route.view === 'vocabulary') {
                const params = new URLSearchParams();
                if (route.subject) params.set('subject', route.subject);
                if (route.grade) params.set('grade', route.grade);
                if (route.trimester) params.set('trimester', route.trimester);
                if (route.month) params.set('month', route.month);
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
                    month: this.libraryDrilldown.month
                };
            }
            if (viewId === 'teacher-editor-view') return { view: 'editor' };
            if (viewId === 'teacher-activities-view') {
                return {
                    view: 'activities',
                    subject: this.activityDrilldown.subject,
                    grade: this.activityDrilldown.grade,
                    month: this.activityDrilldown.month,
                    week: this.activityDrilldown.week,
                    mode: this.activityMode
                };
            }
            if (viewId === 'teacher-activity-editor-view') return { view: 'activity-editor' };
            if (viewId === 'teacher-activity-assignment-view' && this.activeActivityAssignment?.id) {
                return { view: 'activity-assignment', assignmentId: this.activeActivityAssignment.id };
            }
            if (viewId === 'teacher-progress-view') return { view: 'students' };
            if (viewId === 'teacher-quizzes-view') return { view: 'quizzes' };
            if (viewId === 'quiz-maker-view') return { view: 'quiz-editor' };
            if (viewId === 'teacher-data-management-view') return { view: 'data-settings' };
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
                month: this.libraryDrilldown.month
            };
            this.setRoute(this.lastVocabularyRoute, options);
        },

        updateActivityRoute(options = {}) {
            if (this.isApplyingRoute || !this.isAuthenticated) return;
            this.lastActivitiesRoute = {
                view: 'activities',
                subject: this.activityDrilldown.subject,
                grade: this.activityDrilldown.grade,
                month: this.activityDrilldown.month,
                week: this.activityDrilldown.week,
                mode: this.activityMode
            };
            this.setRoute(this.lastActivitiesRoute, options);
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
            if (!route || this.isApplyingRoute) return;
            this.isApplyingRoute = true;
            try {
                switch (route.view) {
                    case 'vocabulary':
                        this.libraryDrilldown = {
                            subject: route.subject || null,
                            grade: route.grade || null,
                            trimester: route.trimester || null,
                            month: route.month || null
                        };
                        this.lastVocabularyRoute = { ...route };
                        this.switchView('teacher-dashboard-view');
                        await this.loadLibrary();
                        break;
                    case 'editor':
                        this.showEditor();
                        break;
                    case 'activities':
                        this.activityDrilldown = {
                            subject: route.subject || null,
                            grade: route.grade || null,
                            month: route.month ? this.normalizeTeacherMonth(route.month) : null,
                            week: route.week ? this.normalizeActivityWeekKey(route.week) : null
                        };
                        this.activityMode = route.mode || 'assign';
                        this.lastActivitiesRoute = { ...route };
                        await this.showActivityLibrary();
                        break;
                    case 'activity-editor':
                        await this.showActivityEditor();
                        break;
                    case 'activity-assignment':
                        await this.showActivityAssignmentReview(route.assignmentId);
                        break;
                    case 'students':
                        await this.showProgressView();
                        break;
                    case 'quizzes':
                        await this.showQuizzesView();
                        break;
                    case 'quiz-editor':
                        await this.openQuizMaker({ returnTo: 'quizzes', restoreDraft: true });
                        break;
                    case 'data-settings':
                        await this.showDataManagementView({ tab: route.tab });
                        break;
                    case 'overview':
                    default:
                        this.switchView('teacher-overview-view');
                        this.loadTeacherOverview();
                        break;
                }
            } finally {
                this.isApplyingRoute = false;
            }
        }
    });
}
