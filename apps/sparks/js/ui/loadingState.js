/**
 * Replaces a container's contents with the shared loading-state structure.
 * Feature code remains responsible for deciding when loading starts and ends.
 */
export function showLoadingState(container, message, { className = '' } = {}) {
    const state = document.createElement('div');
    state.className = ['loading-spinner', className].filter(Boolean).join(' ');
    state.setAttribute('role', 'status');
    state.setAttribute('aria-live', 'polite');
    state.textContent = String(message ?? 'Loading...');
    container.replaceChildren(state);
    return state;
}
