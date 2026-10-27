// Keep open classroom tabs current without reloading during student work.
export function installStudentAppUpdates({
    window: win = window,
    document: doc = document,
    navigator: nav = navigator,
    getApp = () => win.studentApp,
    intervalMs = 60000
} = {}) {
    let registration;
    let checking = false;
    let pending = false;
    let pendingPreload = false;
    let reloading = false;
    let stopped = false;
    let previousController = nav.serviceWorker?.controller;

    const launchOwnsRecovery = app => Boolean(app?.activities?.launcher?.isStarting
        || app?.activities?.menu?.isPreparing
        || app?.activities?.unitsPresentationPreparing && doc.querySelector?.('#vocab-selection-view:not(.hidden)')
        || doc.querySelector?.('#activity-view:not(.hidden) .activity-load-error, #activity-menu-view:not(.hidden) .unit-menu-load-error, #vocab-selection-view:not(.hidden) .student-library-load-error'));
    const claimPreloadReload = () => {
        // One automatic refresh per entry build survives the refresh itself.
        // A persistent missing asset must reach its caller instead of looping.
        const src = doc.querySelector?.('script[type="module"][src*="/assets/student-"]')?.getAttribute('src') || '';
        const build = String(src).match(/(?:^|\/)(student-[A-Za-z0-9_-]+\.js)(?:[?#].*)?$/)?.[1] || 'student';
        try {
            const key = 'sparks:last-preload-reload-build';
            if (!win.sessionStorage || win.sessionStorage.getItem(key) === build) return false;
            win.sessionStorage.setItem(key, build);
            return true;
        } catch { return false; }
    };
    const refreshWhenSafe = () => {
        if (stopped || !pending || reloading || doc.visibilityState === 'hidden' || nav.onLine === false) return;
        const app = getApp();
        const route = win.location.hash.split('?')[0];
        const atMenu = !route || route === '#/classes' || route === '#/units' || /^#\/unit\/[^/]+$/.test(route);
        if (!app || app.currentActivityType || launchOwnsRecovery(app) || !atMenu) return;
        try {
            // This is the same synchronous local save used throughout the student app.
            if (app.progress?.saveLocalProgress() === false) return;
        } catch (error) {
            console.warn('Update postponed because local progress could not be saved:', error);
            return;
        }
        if (pendingPreload && !claimPreloadReload()) return;
        reloading = true;
        win.location.reload();
    };
    const preloadFailed = event => {
        if (launchOwnsRecovery(getApp())) return;
        pending = true;
        pendingPreload = true;
        refreshWhenSafe();
        // Preserve the caller's recoverable error unless a refresh actually began.
        if (reloading) event.preventDefault();
    };
    const controllerChanged = () => {
        const controller = nav.serviceWorker.controller;
        if (previousController && controller && controller !== previousController) {
            pending = true;
            pendingPreload = false;
        }
        previousController = controller;
        refreshWhenSafe();
    };
    const check = async () => {
        refreshWhenSafe();
        if (stopped || reloading || checking || !registration || doc.visibilityState === 'hidden' || nav.onLine === false) return;
        checking = true;
        try {
            await registration.update();
        } catch (error) {
            console.warn('Could not check for a student app update:', error);
        } finally {
            checking = false;
        }
    };
    nav.serviceWorker?.addEventListener('controllerchange', controllerChanged);
    doc.addEventListener('visibilitychange', check);
    win.addEventListener('online', check);
    win.addEventListener('focus', check);
    win.addEventListener('hashchange', refreshWhenSafe);
    win.addEventListener('vite:preloadError', preloadFailed);
    const timer = win.setInterval(check, intervalMs);
    nav.serviceWorker?.register('./student-sw.js', { updateViaCache: 'none' }).then(value => {
        if (stopped) return;
        registration = value;
        void check();
    }).catch(error => console.warn('Offline support could not be enabled:', error));
    return () => {
        stopped = true;
        win.clearInterval(timer);
        nav.serviceWorker?.removeEventListener('controllerchange', controllerChanged);
        doc.removeEventListener('visibilitychange', check);
        win.removeEventListener('online', check);
        win.removeEventListener('focus', check);
        win.removeEventListener('hashchange', refreshWhenSafe);
        win.removeEventListener('vite:preloadError', preloadFailed);
    };
}
