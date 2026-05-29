const DESKTOP_RELEASE_URL = 'https://github.com/';

export const desktopApp = {
    isDesktop() {
        return Boolean(window.__TAURI_INTERNALS__ || window.__TAURI__);
    },

    version() {
        if (typeof __APP_VERSION__ !== 'undefined') return __APP_VERSION__;
        return 'web';
    },

    init() {
        document.documentElement.dataset.runtime = this.isDesktop() ? 'desktop' : 'web';
        this.renderRuntimeBadges();
        this.updateNetworkStatus();
        window.addEventListener('online', () => this.updateNetworkStatus());
        window.addEventListener('offline', () => this.updateNetworkStatus());
    },

    renderRuntimeBadges() {
        document.querySelectorAll('[data-desktop-version]').forEach(element => {
            element.textContent = this.isDesktop() ? `Desktop v${this.version()}` : 'Web version';
        });

        document.querySelectorAll('[data-desktop-update-link]').forEach(link => {
            link.href = DESKTOP_RELEASE_URL;
            link.target = '_blank';
            link.rel = 'noopener noreferrer';
        });
    },

    updateNetworkStatus() {
        const label = navigator.onLine ? 'Online' : 'Offline';
        document.querySelectorAll('[data-network-status]').forEach(element => {
            element.textContent = label;
            element.dataset.state = navigator.onLine ? 'online' : 'offline';
        });
    }
};

desktopApp.init();
