const INLINE_STATUS_STATES = new Set(['muted', 'info', 'success', 'error']);

/**
 * Updates a persistent inline status without owning feature-specific timing or copy.
 */
export function setInlineStatus(element, message, state = 'muted') {
    const statusState = INLINE_STATUS_STATES.has(state) ? state : 'muted';
    element.textContent = String(message ?? '');
    element.dataset.state = statusState;
    element.setAttribute('role', 'status');
    element.setAttribute('aria-live', 'polite');
    element.setAttribute('aria-atomic', 'true');
    return element;
}
