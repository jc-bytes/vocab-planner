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

const loadedScripts = new Map();

export function loadScript(src) {
    if (loadedScripts.has(src)) return loadedScripts.get(src);

    const promise = new Promise((resolve, reject) => {
        const existing = document.querySelector(`script[src="${src}"]`);
        if (existing) {
            if (existing.dataset.loaded === 'true') {
                resolve();
                return;
            }
            existing.addEventListener('load', resolve, { once: true });
            existing.addEventListener('error', reject, { once: true });
            return;
        }

        const script = document.createElement('script');
        script.src = src;
        script.async = true;
        script.dataset.loaded = 'false';
        script.addEventListener('load', () => {
            script.dataset.loaded = 'true';
            resolve();
        }, { once: true });
        script.addEventListener('error', reject, { once: true });
        document.head.appendChild(script);
    });

    loadedScripts.set(src, promise);
    return promise;
}

function refreshLucideIcons() {
    if (window.lucide?.createIcons) {
        window.lucide.createIcons();
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
            refreshLucideIcons();
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
