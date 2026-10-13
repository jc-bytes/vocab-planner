/**
 * Main JavaScript file for common utilities
 */

import { notifications } from './notifications.js';
import { createFocusTrap } from 'focus-trap';

// Helper to select elements
export const $ = (selector) => document.querySelector(selector);
export const $$ = (selector) => document.querySelectorAll(selector);

// Export notifications for convenience
export { notifications };

export function refreshIcons(root = document) {
    const iconRoot = root?.querySelectorAll ? root : document;
    window.lucide?.createIcons?.({ root: iconRoot });
}

// Helper to create elements
export const createElement = (tag, className, text) => {
    const el = document.createElement(tag);
    if (className) el.className = className;
    if (text) el.textContent = text;
    return el;
};

export const escapeHtml = (value = '') => String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const modalState = new WeakMap();
const managedModals = new Set();
const modalTrapStack = [];

function resolveElement(elementOrSelector) {
    return typeof elementOrSelector === 'string'
        ? document.querySelector(elementOrSelector)
        : elementOrSelector;
}

function getModalState(modal) {
    if (!modalState.has(modal)) {
        modalState.set(modal, {
            dismissible: true,
            onClose: null,
            previouslyFocused: null,
            initialFocus: null,
            managedTabIndex: false,
            trap: null,
            visibilityObserver: null
        });
    }
    return modalState.get(modal);
}

function pruneDisconnectedModalTraps() {
    for (const modal of managedModals) {
        if (modal.isConnected) continue;

        const state = modalState.get(modal);
        state?.trap?.deactivate({ returnFocus: false });
        state?.visibilityObserver?.disconnect();
        if (state) state.visibilityObserver = null;
        managedModals.delete(modal);
    }
}

function createModalTrap(modal, content, state) {
    return createFocusTrap(modal, {
        trapStack: modalTrapStack,
        isolateSubtrees: 'inert',
        escapeDeactivates: false,
        clickOutsideDeactivates: false,
        returnFocusOnDeactivate: true,
        delayInitialFocus: false,
        delayReturnFocus: false,
        initialFocus: () => resolveElement(state.initialFocus) || undefined,
        fallbackFocus: () => content,
        setReturnFocus: () => state.previouslyFocused?.isConnected
            ? state.previouslyFocused
            : false
    });
}

if (typeof MutationObserver !== 'undefined' && document.documentElement) {
    const modalRemovalObserver = new MutationObserver(pruneDisconnectedModalTraps);
    modalRemovalObserver.observe(document.documentElement, { childList: true, subtree: true });
}

function ensureModalLabel(modal) {
    if (modal.hasAttribute('aria-labelledby')) return;

    const heading = modal.querySelector('.modal-header h1, .modal-header h2, .modal-header h3, .modal-header h4');
    if (!heading) return;

    if (!heading.id) {
        heading.id = `${modal.id || 'app-modal'}-title`;
    }
    modal.setAttribute('aria-labelledby', heading.id);
}

export function setupModal(elementOrSelector, options = {}) {
    const modal = resolveElement(elementOrSelector);
    if (!modal) return null;

    const state = getModalState(modal);
    state.dismissible = options.dismissible ?? state.dismissible;
    state.onClose = typeof options.onClose === 'function' ? options.onClose : state.onClose;

    modal.setAttribute('role', modal.getAttribute('role') || 'dialog');
    modal.setAttribute('aria-modal', 'true');
    if (state.dismissible) {
        modal.removeAttribute('data-modal-required');
    } else {
        modal.setAttribute('data-modal-required', 'true');
    }
    ensureModalLabel(modal);

    const content = modal.querySelector('.modal-content') || modal;
    if (!content.hasAttribute('tabindex')) {
        content.setAttribute('tabindex', '-1');
        state.managedTabIndex = true;
    }

    if (!state.trap) {
        state.trap = createModalTrap(modal, content, state);
    }
    if (!state.visibilityObserver && typeof MutationObserver !== 'undefined') {
        state.visibilityObserver = new MutationObserver(() => {
            if (modal.classList.contains('hidden') && state.trap?.active) {
                state.trap.deactivate({ returnFocus: false });
            }
        });
        state.visibilityObserver.observe(modal, { attributes: true, attributeFilter: ['class'] });
    }
    managedModals.add(modal);

    if (modal.dataset.modalReady === 'true') return modal;
    modal.dataset.modalReady = 'true';

    modal.addEventListener('click', (event) => {
        const currentState = getModalState(modal);
        if (event.target === modal && currentState.dismissible) {
            closeModal(modal);
        }
    });

    modal.addEventListener('keydown', (event) => {
        if (modal.classList.contains('hidden')) return;

        const currentState = getModalState(modal);
        if (event.key === 'Escape') {
            const isTopTrap = modalTrapStack.at(-1) === currentState.trap;
            if (isTopTrap && currentState.dismissible) {
                event.preventDefault();
                event.stopPropagation();
                closeModal(modal);
            }
        }
    });

    return modal;
}

export function openModal(elementOrSelector, options = {}) {
    pruneDisconnectedModalTraps();
    const modal = setupModal(elementOrSelector, options);
    if (!modal) return null;

    const state = getModalState(modal);
    state.dismissible = options.dismissible ?? state.dismissible;
    state.onClose = typeof options.onClose === 'function' ? options.onClose : state.onClose;
    state.previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    state.initialFocus = options.initialFocus || null;

    modal.classList.remove('hidden');
    state.trap.activate();

    return modal;
}

export function closeModal(elementOrSelector, options = {}) {
    const modal = resolveElement(elementOrSelector);
    if (!modal) return;

    const state = getModalState(modal);
    const wasOpen = !modal.classList.contains('hidden');
    modal.classList.add('hidden');

    if (wasOpen) {
        state.trap?.deactivate({ returnFocus: options.restoreFocus !== false });
    }

    if (wasOpen && typeof state.onClose === 'function') {
        state.onClose();
    }
}

function initPasswordToggles() {
    document.querySelectorAll('.password-toggle').forEach((button) => {
        const inputId = button.getAttribute('aria-controls');
        const input = inputId ? document.getElementById(inputId) : button.closest('.password-field')?.querySelector('input');
        if (!input || button.dataset.passwordToggleReady === 'true') return;

        button.dataset.passwordToggleReady = 'true';
        button.setAttribute('aria-pressed', 'false');

        button.addEventListener('click', () => {
            const shouldShow = input.type === 'password';
            input.type = shouldShow ? 'text' : 'password';
            button.setAttribute('aria-pressed', shouldShow ? 'true' : 'false');
            button.setAttribute('aria-label', shouldShow ? 'Hide password' : 'Show password');
            button.title = shouldShow ? 'Hide password' : 'Show password';
            button.innerHTML = `<i data-lucide="${shouldShow ? 'eye-off' : 'eye'}"></i>`;
            refreshIcons(button);
            input.focus({ preventScroll: true });
        });
    });

    refreshIcons();
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initPasswordToggles);
} else {
    initPasswordToggles();
}

window.addEventListener('load', refreshIcons);
