class StudentRoutingMethods {
    slugifyRouteId(value) {
        return String(value || '')
            .trim()
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '');
    }

    getVocabRouteId(vocab) {
        return String(vocab?.id || this.slugifyRouteId(vocab?.name) || '').trim();
    }

    getCurrentVocabRouteId() {
        return this.getVocabRouteId(this.currentVocab);
    }

    async getGames() {
        if (this.games) return this.games;

        if (!this.gamesPromise) {
            this.gamesPromise = import('./student/studentGames.js')
                .then(({ StudentGames }) => {
                    this.games = new StudentGames(this);
                    return this.games;
                })
                .finally(() => {
                    this.gamesPromise = null;
                });
        }

        return this.gamesPromise;
    }

    safeDecodeRoutePart(value) {
        try {
            return decodeURIComponent(value);
        } catch {
            return value;
        }
    }

    parseRoute(hash = window.location.hash) {
        const rawHash = String(hash || '');
        if (!rawHash || rawHash === '#') return null;

        const routeText = rawHash.startsWith('#') ? rawHash.slice(1) : rawHash;
        const [rawPath, rawQuery = ''] = routeText.split('?');
        const path = rawPath.startsWith('/') ? rawPath.slice(1) : rawPath;
        const parts = path.split('/').filter(Boolean).map(part => this.safeDecodeRoutePart(part));

        if (parts.length === 1 && parts[0] === 'menu') {
            return { view: 'menu' };
        }

        if (parts.length === 1 && parts[0] === 'units') {
            const params = new URLSearchParams(rawQuery);
            return {
                view: 'units',
                all: params.get('all') === '1',
                trimester: params.get('trimester') || null,
                month: params.get('month') || null
            };
        }

        if (parts.length === 1 && parts[0] === 'arcade') {
            return { view: 'arcade' };
        }

        if (parts.length === 1 && parts[0] === 'classroom-activities') {
            const params = new URLSearchParams(rawQuery);
            return {
                view: 'classroom-activities',
                section: params.get('section') || null,
                trimester: params.get('trimester') || null,
                month: params.get('month') || null,
                week: params.get('week') || null
            };
        }

        if (parts[0] === 'classroom-activities' && parts[1]) {
            return { view: 'classroom-activity', assignmentId: parts[1] };
        }

        if (parts[0] === 'unit' && parts[1]) {
            if (parts.length === 2) {
                return { view: 'unit', unitId: parts[1] };
            }

            if (parts.length === 4 && parts[2] === 'activity' && parts[3]) {
                const params = new URLSearchParams(rawQuery);
                const wordParam = params.get('word');
                let word = null;
                let wordWasInvalid = false;

                if (wordParam !== null) {
                    const parsedWord = Number.parseInt(wordParam, 10);
                    if (Number.isFinite(parsedWord) && parsedWord >= 1) {
                        word = parsedWord;
                    } else {
                        word = 1;
                        wordWasInvalid = true;
                    }
                }

                return {
                    view: 'activity',
                    unitId: parts[1],
                    activityType: parts[3],
                    word,
                    hasWordParam: wordParam !== null,
                    wordWasInvalid
                };
            }
        }

        return { view: 'invalid' };
    }

    buildRoute(route) {
        if (!route || !route.view) return '#/menu';

        if (route.view === 'menu') return '#/menu';
        if (route.view === 'classroom-activities') {
            const params = new URLSearchParams();
            if (route.section) params.set('section', route.section);
            if (route.trimester) params.set('trimester', route.trimester);
            if (route.month) params.set('month', route.month);
            if (route.week) params.set('week', route.week);
            const query = params.toString();
            return query ? `#/classroom-activities?${query}` : '#/classroom-activities';
        }
        if (route.view === 'classroom-activity' && route.assignmentId) {
            return `#/classroom-activities/${encodeURIComponent(route.assignmentId)}`;
        }
        if (route.view === 'units') {
            const params = new URLSearchParams();
            if (route.all) params.set('all', '1');
            if (route.trimester) params.set('trimester', route.trimester);
            if (route.month) params.set('month', route.month);
            const query = params.toString();
            return query ? `#/units?${query}` : '#/units';
        }
        if (route.view === 'arcade') return '#/arcade';

        if (route.view === 'unit' && route.unitId) {
            return `#/unit/${encodeURIComponent(route.unitId)}`;
        }

        if (route.view === 'activity' && route.unitId && route.activityType) {
            let hash = `#/unit/${encodeURIComponent(route.unitId)}/activity/${encodeURIComponent(route.activityType)}`;
            if (route.activityType === 'illustration') {
                const word = Number.isFinite(route.word) && route.word >= 1 ? Math.floor(route.word) : 1;
                hash += `?word=${word}`;
            }
            return hash;
        }

        return '#/menu';
    }

    setRoute(route, options = {}) {
        const hash = this.buildRoute(route);
        if (window.location.hash === hash) return;

        const nextUrl = `${window.location.pathname}${window.location.search}${hash}`;
        const method = options.replace ? 'replaceState' : 'pushState';
        window.history[method](null, '', nextUrl);
    }

    async navigateTo(route, options = {}) {
        this.setRoute(route, options);
        await this.applyRoute(route);
    }

    async restoreRouteOrDefault(defaultRoute = { view: 'menu' }) {
        this.routeReady = true;
        const route = this.parseRoute();

        if (!route) {
            this.setRoute(defaultRoute, { replace: true });
            await this.applyRoute(defaultRoute);
            return;
        }

        await this.applyRoute(route);
    }

    handleRouteChange() {
        if (!this.routeReady || this.isApplyingRoute) return;
        if (!this.authDisabled && !this.currentUser) return;
        this.applyRoute(this.parseRoute());
    }

    findVocabByRouteId(unitId) {
        const normalized = String(unitId || '').trim();
        if (!normalized) return null;

        if (!Array.isArray(this.availableVocabs) || this.availableVocabs.length === 0) {
            this.activities.renderDashboard();
        }

        return (this.availableVocabs || []).find(vocab => this.getVocabRouteId(vocab) === normalized) || null;
    }

    isKnownActivityType(activityType) {
        return this.activityRouteTypes.includes(activityType);
    }

    showUnitsView(route = {}) {
        this.cleanupActivity();
        this.currentVocab = null;
        if (route.all) {
            this.resetStudentVocabularyDrilldown();
        } else if (route.trimester) {
            this.studentVocabularyDrilldown = {
                trimester: route.trimester,
                month: route.month || null
            };
        } else if (!this.studentVocabularyDrilldown?.trimester) {
            this.setStudentVocabularyDrilldownToCurrentTrimester();
        }
        this.activities.renderDashboard();
        this.switchView('vocab-selection-view');
    }

    async showArcadeView() {
        this.cleanupActivity();
        this.currentVocab = null;
        this.switchView('arcade-view');
        const games = await this.getGames();
        games.updateArcadeUI();
        games.updateGameSelectionUI();
        games.updateLeaderboardGame();
    }

    async applyRoute(route) {
        const targetRoute = route && route.view ? route : { view: 'menu' };
        this.isApplyingRoute = true;

        try {
            if (targetRoute.view === 'invalid') {
                this.setRoute({ view: 'units' }, { replace: true });
                this.showUnitsView();
                return;
            }

            if (targetRoute.view === 'menu') {
                this.cleanupActivity();
                this.currentVocab = null;
                this.activities.renderStudentHome();
                this.switchView('main-menu-view');
                return;
            }

            if (targetRoute.view === 'units') {
                this.showUnitsView(targetRoute);
                return;
            }

            if (targetRoute.view === 'arcade') {
                await this.showArcadeView();
                return;
            }

            if (targetRoute.view === 'classroom-activities') {
                this.cleanupActivity();
                this.currentVocab = null;
                await this.classroomActivities.renderList(targetRoute);
                return;
            }

            if (targetRoute.view === 'classroom-activity') {
                this.cleanupActivity();
                this.currentVocab = null;
                await this.classroomActivities.showAssignment(targetRoute.assignmentId);
                return;
            }

            if (targetRoute.view === 'unit' || targetRoute.view === 'activity') {
                const vocab = this.findVocabByRouteId(targetRoute.unitId);
                if (!vocab) {
                    this.setRoute({ view: 'units' }, { replace: true });
                    this.showUnitsView();
                    return;
                }

                await this.activities.loadVocabulary(vocab, { fromRoute: true });

                if (targetRoute.view === 'unit') {
                    return;
                }

                if (!this.isKnownActivityType(targetRoute.activityType)) {
                    this.setRoute({ view: 'unit', unitId: this.getCurrentVocabRouteId() }, { replace: true });
                    return;
                }

                const requestedWord = targetRoute.activityType === 'illustration'
                    ? (Number.isFinite(targetRoute.word) ? targetRoute.word : 1)
                    : null;

                await this.activities.startActivity(targetRoute.activityType, {
                    fromRoute: true,
                    initialWordIndex: requestedWord ? requestedWord - 1 : 0,
                    requestedWord,
                    hasWordParam: targetRoute.hasWordParam,
                    wordWasInvalid: targetRoute.wordWasInvalid
                });

                if (targetRoute.activityType === 'illustration') {
                    const restoredWord = (this.activityInstance?.currentIndex || 0) + 1;
                    if (targetRoute.wordWasInvalid || !targetRoute.hasWordParam || requestedWord !== restoredWord) {
                        this.setRoute({
                            view: 'activity',
                            unitId: this.getCurrentVocabRouteId(),
                            activityType: 'illustration',
                            word: restoredWord
                        }, { replace: true });
                    }
                }
            }
        } finally {
            this.isApplyingRoute = false;
        }
    }
}

export function installStudentRoutingMethods(StudentManager) {
    for (const name of Object.getOwnPropertyNames(StudentRoutingMethods.prototype)) {
        if (name === 'constructor') continue;
        Object.defineProperty(
            StudentManager.prototype,
            name,
            Object.getOwnPropertyDescriptor(StudentRoutingMethods.prototype, name)
        );
    }
}
