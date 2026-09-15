// Keep open classroom tabs current without reloading during student work.
export function installStudentAppUpdates({
    window: win = window,
    document: doc = document,
    navigator: nav = navigator,
    getApp = () => win.studentApp,
    intervalMs = 60000
} = {}) {
    if (!nav.serviceWorker) return () => {};
    let registration;
    let checking = false;
    let pending = false;
    let reloading = false;
    let stopped = false;
    let previousController = nav.serviceWorker.controller;

    const refreshWhenSafe = () => {
        if (stopped || !pending || reloading || doc.visibilityState === 'hidden' || nav.onLine === false) return;
        const app = getApp();
        const route = win.location.hash.split('?')[0];
        const atMenu = !route || route === '#/units' || /^#\/unit\/[^/]+$/.test(route);
        if (!app || app.currentActivityType || !atMenu) return;
        try {
            // This is the same synchronous local save used throughout the student app.
            app.progress?.saveLocalProgress();
        } catch (error) {
            console.warn('Update postponed because local progress could not be saved:', error);
            return;
        }
        reloading = true;
        win.location.reload();
    };
    const controllerChanged = () => {
        const controller = nav.serviceWorker.controller;
        if (previousController && controller && controller !== previousController) pending = true;
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
    nav.serviceWorker.addEventListener('controllerchange', controllerChanged);
    doc.addEventListener('visibilitychange', check);
    win.addEventListener('online', check);
    win.addEventListener('focus', check);
    win.addEventListener('hashchange', refreshWhenSafe);
    const timer = win.setInterval(check, intervalMs);
    nav.serviceWorker.register('./student-sw.js', { updateViaCache: 'none' }).then(value => {
        if (stopped) return;
        registration = value;
        void check();
    }).catch(error => console.warn('Offline support could not be enabled:', error));
    return () => {
        stopped = true;
        win.clearInterval(timer);
        nav.serviceWorker.removeEventListener('controllerchange', controllerChanged);
        doc.removeEventListener('visibilitychange', check);
        win.removeEventListener('online', check);
        win.removeEventListener('focus', check);
        win.removeEventListener('hashchange', refreshWhenSafe);
    };
}
