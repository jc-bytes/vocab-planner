// Scheduling is owner-local; the queue still owns transport, durable receipts,
// acknowledgements and status. Unit snapshots and activity writes share a lane.
const laneOf = record => record.payload?.unitKey
    && ['student-unit-work', 'student-activity-progress'].includes(record.type)
    ? `unit:${record.payload.unitKey}`
    : record.type === 'student-spark-response' && record.payload?.sparkId
        ? `spark:${record.payload.sparkId}` : `record:${record.id}`;
const dueAt = record => Math.max(Date.parse(record.nextAttemptAt) || 0,
    Number(record.payload?.retryNotBefore) || 0);
const headsOf = records => {
    const heads = new Map();
    for (const record of records) if (!heads.has(laneOf(record))) heads.set(laneOf(record), record);
    return heads;
};

export class StudentSyncDrainScheduler {
    constructor(isCurrent) {
        this.isCurrent = isCurrent;
        this.active = new Map();
        this.history = new Map();
    }

    cancelObsolete() {
        for (const [owner, state] of this.active) {
            if (!this.isCurrent(owner, state.request.generation)) state.controller?.abort();
        }
        for (const owner of this.history.keys()) {
            if (!this.isCurrent(owner)) this.history.delete(owner);
        }
    }

    run(owner, generation, runCycle) {
        this.cancelObsolete();
        const request = { generation, runCycle };
        const existing = this.active.get(owner);
        if (existing) {
            if (generation > Math.max(existing.request.generation, existing.next?.generation ?? -1)) {
                existing.next = request;
                existing.controller?.abort();
            }
            return existing.promise;
        }
        const state = { request, next: null };
        this.active.set(owner, state);
        state.promise = Promise.resolve().then(async () => {
            try {
                do {
                    state.controller = new AbortController();
                    let failure;
                    try { await state.request.runCycle(state.controller.signal); }
                    catch (error) { failure = error; }
                    if (!state.next) {
                        if (failure) throw failure;
                        break;
                    }
                    state.request = state.next;
                    state.next = null;
                } while (true);
            } finally {
                if (this.active.get(owner) === state) this.active.delete(owner);
                if (!this.isCurrent(owner)) this.history.delete(owner);
            }
        });
        return state.promise;
    }

    cycle(owner, records, { now, maxAttempts = 4, maxDurationMs = 30000 }) {
        const h = this.history.get(owner) || { seen: new Set(), fresh: new Set(), initialized: false };
        this.history.set(owner, h);
        const known = new Set(headsOf(records).keys());
        if (h.initialized) for (const lane of known) if (!h.seen.has(lane)) h.fresh.add(lane);
        h.seen = known;
        h.initialized = true;
        h.fresh = new Set([...h.fresh].filter(lane => known.has(lane)));
        const started = now(), blocked = new Set();
        let attempts = 0, freshCount = 0, oldCount = 0;
        return {
            next(pending) {
                if (attempts >= maxAttempts || now() - started >= maxDurationMs) return null;
                const all = [...headsOf(pending)];
                const ready = all.filter(([lane, record]) => !blocked.has(lane) && dueAt(record) <= now());
                const fresh = ready.filter(([lane]) => h.fresh.has(lane));
                const old = ready.filter(([lane]) => !h.fresh.has(lane));
                const cursor = all.findIndex(([lane]) => lane === h.cursor);
                const rotated = old.filter(([lane]) => all.findIndex(([key]) => key === lane) > cursor)
                    .concat(old.filter(([lane]) => all.findIndex(([key]) => key === lane) <= cursor));
                const selection = old.length && (h.oweOld || freshCount >= 2 || !fresh.length)
                    ? rotated[0] : fresh[0] || rotated[0];
                if (!selection) return null;
                const [lane, record] = selection;
                if (h.fresh.delete(lane)) freshCount++;
                else { oldCount++; h.oweOld = false; h.cursor = lane; }
                attempts++;
                return record;
            },
            block(record) { blocked.add(laneOf(record)); },
            finish(pending) {
                const heads = [...headsOf(pending)];
                h.oweOld = !oldCount && freshCount > 0
                    && heads.some(([lane, record]) => !h.fresh.has(lane) && dueAt(record) <= now());
                const live = new Set(heads.map(([lane]) => lane));
                h.fresh = new Set([...h.fresh].filter(lane => live.has(lane)));
                return heads.length ? Math.min(...heads.map(([, record]) => dueAt(record))) : null;
            }
        };
    }
}
