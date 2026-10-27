// This registry exists before the write engine so reset/configuration and
// never-used pagehide paths do not acquire active-attempt code.
export function clearActivitySyncStates(states) {
    for (const state of states.values()) {
        if (state.timer) clearTimeout(state.timer);
        state.timer = null;
        state.pending = null;
        state.unsaved = null;
        state.waiters?.splice(0).forEach(waiter => waiter.resolve(null));
    }
    states.clear();
}
