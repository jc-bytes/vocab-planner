/**
 * Toast notification system for non-blocking user messages
 */

const NOTIFICATION_TYPES = new Set(['info', 'success', 'error', 'warning']);

class NotificationManager {
    constructor() {
        this.container = null;
        this.init();
    }

    init() {
        // Create container if it doesn't exist
        if (!document.getElementById('toast-container')) {
            this.container = document.createElement('div');
            this.container.id = 'toast-container';
            this.container.className = 'toast-container';
            document.body.appendChild(this.container);
        } else {
            this.container = document.getElementById('toast-container');
        }
    }

    show(message, type = 'info', duration = 4000) {
        const notificationType = NOTIFICATION_TYPES.has(type) ? type : 'info';
        const toast = document.createElement('div');
        toast.className = `toast toast-${notificationType}`;
        toast.setAttribute('role', notificationType === 'error' ? 'alert' : 'status');
        toast.setAttribute('aria-live', notificationType === 'error' ? 'assertive' : 'polite');
        toast.setAttribute('aria-atomic', 'true');

        const icons = {
            info: 'info',
            success: 'circle-check',
            error: 'circle-x',
            warning: 'triangle-alert'
        };

        const icon = document.createElement('span');
        icon.className = 'toast-icon';
        icon.setAttribute('aria-hidden', 'true');
        const iconGlyph = document.createElement('i');
        iconGlyph.setAttribute('data-lucide', icons[notificationType]);
        icon.appendChild(iconGlyph);

        const messageText = document.createElement('span');
        messageText.className = 'toast-message';
        messageText.textContent = String(message ?? '');

        const closeBtn = document.createElement('button');
        closeBtn.className = 'toast-close btn-icon-only';
        closeBtn.type = 'button';
        closeBtn.setAttribute('aria-label', 'Dismiss notification');
        const closeGlyph = document.createElement('i');
        closeGlyph.setAttribute('data-lucide', 'circle-x');
        closeGlyph.setAttribute('aria-hidden', 'true');
        closeBtn.appendChild(closeGlyph);
        toast.appendChild(icon);
        toast.appendChild(messageText);
        toast.appendChild(closeBtn);
        window.lucide?.createIcons?.({ root: toast });

        // Close button handler
        let isClosing = false;
        let autoRemoveTimer = null;
        const closeToast = () => {
            if (isClosing) return;
            isClosing = true;
            if (autoRemoveTimer !== null) {
                clearTimeout(autoRemoveTimer);
                autoRemoveTimer = null;
            }
            toast.classList.add('toast-closing');
            setTimeout(() => {
                if (toast.parentNode) {
                    toast.parentNode.removeChild(toast);
                }
            }, 300);
        };

        closeBtn.addEventListener('click', (event) => {
            event.stopPropagation();
            closeToast();
        });
        toast.addEventListener('click', closeToast);

        this.container.appendChild(toast);

        // Auto-remove after duration
        if (duration > 0) {
            autoRemoveTimer = setTimeout(closeToast, duration);
        }

        return toast;
    }

    info(message, duration) {
        return this.show(message, 'info', duration);
    }

    success(message, duration) {
        return this.show(message, 'success', duration);
    }

    error(message, duration) {
        return this.show(message, 'error', duration);
    }

    warning(message, duration) {
        return this.show(message, 'warning', duration);
    }
}

// Export singleton instance
export const notifications = new NotificationManager();
