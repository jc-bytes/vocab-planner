import '@fontsource/inter/latin-400.css';
import '@fontsource/inter/latin-500.css';
import '@fontsource/inter/latin-600.css';
import '@fontsource/inter/latin-700.css';
import { createIcons as createLucideIcons, icons } from 'lucide';

function createIcons(options = {}) {
    return createLucideIcons({
        icons,
        ...options
    });
}

window.lucide = {
    ...(window.lucide || {}),
    createIcons,
    icons
};

function hydrateIcons() {
    createIcons();
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', hydrateIcons, { once: true });
} else {
    hydrateIcons();
}
