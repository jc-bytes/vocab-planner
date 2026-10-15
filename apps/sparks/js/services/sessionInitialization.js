export class SessionInitializationCoordinator {
    constructor() {
        this.generation = 0;
        this.activeKey = '';
        this.inFlight = null;
        this.completedKey = '';
        this.activeController = null;
    }

    run(key, initialize, options = {}) {
        const normalizedKey = String(key || '');
        if (!normalizedKey) return Promise.resolve(null);
        if (!options.force && this.activeKey === normalizedKey && this.inFlight) {
            return this.inFlight;
        }
        if (!options.force && this.completedKey === normalizedKey) {
            return Promise.resolve(true);
        }

        this.activeController?.abort();
        const controller = new AbortController();
        const generation = ++this.generation;
        this.activeKey = normalizedKey;
        this.completedKey = '';
        this.activeController = controller;
        const context = {
            key: normalizedKey,
            generation,
            signal: controller.signal,
            isCurrent: () => (
                !controller.signal.aborted
                && this.generation === generation
                && this.activeKey === normalizedKey
            )
        };
        const initialization = Promise.resolve().then(() => initialize(context));
        const promise = initialization.then(result => {
            if (context.isCurrent() && result === true) {
                this.completedKey = normalizedKey;
            }
            return result;
        }).finally(() => {
            if (this.inFlight === promise) this.inFlight = null;
        });
        this.inFlight = promise;
        return promise;
    }

    invalidate() {
        this.activeController?.abort();
        this.activeController = null;
        this.generation += 1;
        this.activeKey = '';
        this.inFlight = null;
        this.completedKey = '';
    }
}
