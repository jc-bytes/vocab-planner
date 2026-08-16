export class SessionInitializationCoordinator {
    constructor() {
        this.generation = 0;
        this.activeKey = '';
        this.inFlight = null;
        this.completedKey = '';
        this.completedResult = undefined;
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

        const generation = ++this.generation;
        this.activeKey = normalizedKey;
        const context = {
            key: normalizedKey,
            generation,
            isCurrent: () => this.generation === generation && this.activeKey === normalizedKey
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
        });
        this.inFlight = promise;
        return promise;
    }

    invalidate() {
        this.generation += 1;
        this.activeKey = '';
        this.inFlight = null;
        this.completedKey = '';
        this.completedResult = undefined;
    }
}
