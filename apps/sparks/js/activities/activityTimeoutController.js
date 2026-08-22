export class ActivityTimeoutController {
    constructor() {
        this.pending = new Set();
        this.destroyed = false;
    }

    schedule(callback, delay) {
        const timeoutId = setTimeout(() => {
            this.pending.delete(timeoutId);
            if (!this.destroyed) callback();
        }, delay);
        this.pending.add(timeoutId);
        return timeoutId;
    }

    clear() {
        this.destroyed = true;
        this.pending.forEach(timeoutId => clearTimeout(timeoutId));
        this.pending.clear();
    }
}
