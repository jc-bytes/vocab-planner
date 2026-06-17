/**
 * Main JavaScript file for common utilities
 */

import { notifications } from './notifications.js';

// Helper to select elements
export const $ = (selector) => document.querySelector(selector);
export const $$ = (selector) => document.querySelectorAll(selector);

// Export notifications for convenience
export { notifications };

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
const focusableSelector = [
    'a[href]',
    'area[href]',
    'button:not([disabled])',
    'input:not([disabled])',
    'select:not([disabled])',
    'textarea:not([disabled])',
    'iframe',
    'object',
    'embed',
    '[contenteditable="true"]',
    '[tabindex]:not([tabindex="-1"])'
].join(',');

function resolveElement(elementOrSelector) {
    return typeof elementOrSelector === 'string'
        ? document.querySelector(elementOrSelector)
        : elementOrSelector;
}

function getFocusableElements(modal) {
    return Array.from(modal.querySelectorAll(focusableSelector))
        .filter((element) => element instanceof HTMLElement
            && !element.hidden
            && element.getAttribute('aria-hidden') !== 'true'
            && element.getClientRects().length > 0);
}

function getModalState(modal) {
    if (!modalState.has(modal)) {
        modalState.set(modal, {
            dismissible: true,
            onClose: null,
            previouslyFocused: null,
            managedTabIndex: false
        });
    }
    return modalState.get(modal);
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
            if (currentState.dismissible) {
                event.preventDefault();
                closeModal(modal);
            }
            return;
        }

        if (event.key !== 'Tab') return;

        const focusableElements = getFocusableElements(modal);
        if (focusableElements.length === 0) {
            event.preventDefault();
            content.focus({ preventScroll: true });
            return;
        }

        const first = focusableElements[0];
        const last = focusableElements[focusableElements.length - 1];
        if (event.shiftKey && document.activeElement === first) {
            event.preventDefault();
            last.focus({ preventScroll: true });
        } else if (!event.shiftKey && document.activeElement === last) {
            event.preventDefault();
            first.focus({ preventScroll: true });
        }
    });

    return modal;
}

export function openModal(elementOrSelector, options = {}) {
    const modal = setupModal(elementOrSelector, options);
    if (!modal) return null;

    const state = getModalState(modal);
    state.dismissible = options.dismissible ?? state.dismissible;
    state.onClose = typeof options.onClose === 'function' ? options.onClose : state.onClose;
    state.previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;

    modal.classList.remove('hidden');

    const content = modal.querySelector('.modal-content') || modal;
    const preferredFocus = options.initialFocus ? resolveElement(options.initialFocus) : null;
    const focusTarget = preferredFocus || getFocusableElements(modal)[0] || content;
    focusTarget?.focus?.({ preventScroll: true });
    window.requestAnimationFrame(() => {
        if (!modal.contains(document.activeElement)) {
            focusTarget?.focus?.({ preventScroll: true });
        }
    });

    return modal;
}

export function closeModal(elementOrSelector, options = {}) {
    const modal = resolveElement(elementOrSelector);
    if (!modal) return;

    const state = getModalState(modal);
    const wasOpen = !modal.classList.contains('hidden');
    modal.classList.add('hidden');

    if (wasOpen && options.restoreFocus !== false && state.previouslyFocused?.isConnected) {
        state.previouslyFocused.focus({ preventScroll: true });
    }

    if (wasOpen && typeof state.onClose === 'function') {
        state.onClose();
    }
}

// Simple state management
export const store = {
    vocabularies: [],
    currentVocab: null,
    studentProgress: {},
    
    saveProgress() {
        // TODO: Implement save logic
        // Progress saving is handled by backend/Drive services
    },
    
    loadProgress(json) {
        // TODO: Implement load logic
        // Progress loading is handled by backend/Drive services
    }
};

// Utility to fetch JSON
const jsonCache = new Map();

export async function fetchJSON(path, options = {}) {
    if (!options.fresh && jsonCache.has(path)) {
        return jsonCache.get(path);
    }

    try {
        const url = new URL(path, window.location.href);
        url.searchParams.set('_', Date.now().toString());
        const response = await fetch(url.toString(), { cache: 'no-store' });
        if (!response.ok) throw new Error(`Failed to load ${path}`);
        const data = await response.json();
        jsonCache.set(path, data);
        return data;
    } catch (error) {
        console.error('Error fetching JSON:', error);
        notifications.error(`Failed to load ${path}. Please check your connection.`);
        return null;
    }
}

function refreshLucideIcons(root = document) {
    if (window.lucide?.createIcons) {
        const iconRoot = root?.querySelectorAll ? root : document;
        window.lucide.createIcons({ root: iconRoot });
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
            refreshLucideIcons(button);
            input.focus({ preventScroll: true });
        });
    });

    refreshLucideIcons();
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initPasswordToggles);
} else {
    initPasswordToggles();
}

window.addEventListener('load', refreshLucideIcons);

// Consistent error handler utility
export function handleError(error, userMessage = null, context = '') {
    const message = userMessage || (error?.message || 'An unexpected error occurred');
    
    // Log error with context for debugging
    if (context) {
        console.error(`[${context}]`, error);
    } else {
        console.error(error);
    }
    
    // Show user-friendly notification
    notifications.error(message);
    
    // Return error for potential further handling
    return error;
}

// Safe async wrapper for operations that should never fail silently
export async function safeAsync(fn, errorMessage = 'Operation failed', context = '') {
    try {
        return await fn();
    } catch (error) {
        handleError(error, errorMessage, context);
        return null;
    }
}
