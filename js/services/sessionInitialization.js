export class SessionInitializationCoordinator {
    constructor() {
        this.generation = 0;
        this.activeKey = '';
        this.inFlight = null;
        this.completedKey = '';
        this.completedResult = undefined;
        this.activeController = null;
    }

    run(key, initialize, options = {}) {
        const normalizedKey = String(key || '');
        if (!normalizedKey) return Promise.resolve(null);
        if (!options.force && this.activeKey === normalizedKey && this.inFlight) {
            return this.inFlight;
        }
        if (!options.force && this.completedKey === normalizedKey && !this.inFlight) {
            return Promise.resolve(this.completedResult);
        }

        this.activeController?.abort(new Error('A newer student session replaced this initialization.'));
        const controller = new AbortController();
        const generation = ++this.generation;
        this.activeKey = normalizedKey;
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
            if (context.isCurrent()) {
                this.completedKey = normalizedKey;
                this.completedResult = result;
            }
            return result;
        }).finally(() => {
            if (this.inFlight === promise) this.inFlight = null;
            if (this.activeController === controller && !context.isCurrent()) {
                this.activeController = null;
            }
        });
        this.inFlight = promise;
        return promise;
    }

    invalidate() {
        this.activeController?.abort(new Error('The student session ended.'));
        this.activeController = null;
        this.generation += 1;
        this.activeKey = '';
        this.inFlight = null;
        this.completedKey = '';
        this.completedResult = undefined;
    }
}
