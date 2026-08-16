import { notifications } from './notifications.js';
import { setStudentPageLoading } from './student/studentLoadingSkeletons.js';

export class StudentRouting {
    constructor(studentManager) {
        this.sm = studentManager;
        this.routeReady = false;
        this.isApplyingRoute = false;
        this.pendingRoute = null;
        this.games = null;
        this.gamesPromise = null;
    }

    reset() {
        this.routeReady = false;
        this.isApplyingRoute = false;
        this.pendingRoute = null;
    }

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
        return this.getVocabRouteId(this.sm.currentVocab);
    }

    async getGames() {
        if (this.games) return this.games;

        if (!this.gamesPromise) {
            this.gamesPromise = import('./student/studentGames.js')
                .then(({ StudentGames }) => {
                    this.games = new StudentGames(this.sm);
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

        if (parts.length === 1 && parts[0] === 'sparks') {
            return { view: 'sparks' };
        }

        if (parts.length === 1 && parts[0] === 'arcade') {
            return { view: 'arcade' };
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
        if (route.view === 'units') {
            const params = new URLSearchParams();
            if (route.all) params.set('all', '1');
            if (route.trimester) params.set('trimester', route.trimester);
            if (route.month) params.set('month', route.month);
            const query = params.toString();
            return query ? `#/units?${query}` : '#/units';
        }
        if (route.view === 'sparks') return '#/sparks';
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
        if (!this.routeReady) return;
        if (!this.sm.authDisabled && !this.sm.currentUser) return;
        const route = this.parseRoute();
        if (this.isApplyingRoute) {
            this.pendingRoute = route;
            return;
        }
        this.applyRoute(route);
    }

    findVocabByRouteId(unitId) {
        const normalized = String(unitId || '').trim();
        if (!normalized) return null;

        if (this.sm.activities.availableVocabs.length === 0) {
            this.sm.activities.renderDashboard();
        }

        return this.sm.activities.availableVocabs.find(vocab => this.getVocabRouteId(vocab) === normalized) || null;
    }

    isKnownActivityType(activityType) {
        return this.sm.activities.activityRouteTypes.includes(activityType);
    }

    showUnitsView(route = {}) {
        this.sm.cleanupActivity();
        this.sm.currentVocab = null;
        this.sm.studentVocabularyAutoSelect = !route.all && !route.trimester;
        if (route.all) {
            this.sm.resetStudentVocabularyDrilldown();
        } else if (route.trimester) {
            this.sm.studentVocabularyDrilldown = {
                trimester: route.trimester,
                month: route.month || null
            };
        } else {
            this.sm.resetStudentVocabularyDrilldown();
        }
        this.sm.activities.renderDashboard();
        this.sm.switchView('vocab-selection-view');
    }

    async showSparksView() {
        this.sm.cleanupActivity();
        this.sm.currentVocab = null;
        this.sm.switchView('student-sparks-view');
        await this.sm.activities.renderSparkLibrary();
    }

    async showArcadeView() {
        const access = this.sm.activities.getPendingRequiredWork();
        this.sm.activities.updateArcadeGateDisplay(access);
        if (access.isBlocked) {
            await this.redirectToPendingRequiredWork(access);
            return false;
        }

        this.sm.cleanupActivity();
        this.sm.currentVocab = null;
        await import('./student/studentFeatureStyles.js');
        this.sm.switchView('arcade-view');
        const arcadeView = document.getElementById('arcade-view');
        setStudentPageLoading(arcadeView, true);
        try {
            const games = await this.getGames();
            await Promise.all([
                games.updateArcadeUI(),
                games.updateGameSelectionUI()
            ]);
            games.updateLeaderboardGame();
            return true;
        } finally {
            setStudentPageLoading(arcadeView, false);
        }
    }

    async redirectToPendingRequiredWork(access = this.sm.activities.getPendingRequiredWork()) {
        const next = access.next;
        if (!next?.vocab) {
            this.setRoute({ view: 'menu' }, { replace: true });
            this.sm.activities.renderStudentHome();
            this.sm.switchView('main-menu-view');
            return;
        }

        const activityLabel = access.remainingActivities === 1 ? 'activity' : 'activities';
        notifications.warning(
            `Arcade is locked. Complete ${access.remainingActivities} required ${activityLabel} first.`
        );
        this.setRoute({ view: 'unit', unitId: next.routeId }, { replace: true });
        await this.sm.activities.loadVocabulary(next.vocab, { fromRoute: true });
    }

    async applyRoute(route) {
        const targetRoute = route && route.view ? route : { view: 'menu' };
        if (this.isApplyingRoute) {
            this.pendingRoute = targetRoute;
            return;
        }

        this.isApplyingRoute = true;

        try {
            let nextRoute = targetRoute;
            while (nextRoute) {
                this.pendingRoute = null;
                await this.applyRouteTarget(nextRoute);
                nextRoute = this.pendingRoute;
            }
        } finally {
            this.isApplyingRoute = false;
        }
    }

    async applyRouteTarget(targetRoute) {
        try {
            if (targetRoute.view === 'invalid') {
                this.setRoute({ view: 'units' }, { replace: true });
                this.showUnitsView();
                return;
            }

            if (targetRoute.view === 'menu') {
                this.sm.cleanupActivity();
                this.sm.currentVocab = null;
                this.sm.activities.renderStudentHome();
                this.sm.switchView('main-menu-view');
                return;
            }

            if (targetRoute.view === 'units') {
                this.showUnitsView(targetRoute);
                return;
            }

            if (targetRoute.view === 'sparks') {
                await this.showSparksView();
                return;
            }

            if (targetRoute.view === 'arcade') {
                await this.showArcadeView();
                return;
            }

            if (targetRoute.view === 'unit' || targetRoute.view === 'activity') {
                const vocab = this.findVocabByRouteId(targetRoute.unitId);
                if (!vocab) {
                    this.setRoute({ view: 'units' }, { replace: true });
                    this.showUnitsView();
                    return;
                }

                await this.sm.activities.loadVocabulary(vocab, {
                    fromRoute: true,
                    skipActivityPreload: targetRoute.view === 'activity'
                });

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

                await this.sm.activities.startActivity(targetRoute.activityType, {
                    fromRoute: true,
                    initialWordIndex: requestedWord ? requestedWord - 1 : 0,
                    requestedWord,
                    hasWordParam: targetRoute.hasWordParam,
                    wordWasInvalid: targetRoute.wordWasInvalid
                });

                if (targetRoute.activityType === 'illustration') {
                    const restoredWord = (this.sm.activityInstance?.currentIndex || 0) + 1;
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
        } catch (error) {
            console.error('Could not apply student route:', error);
            notifications.error('This page could not load. Please try again.');
        }
    }
}
