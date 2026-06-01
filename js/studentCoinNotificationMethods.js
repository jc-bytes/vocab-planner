import { $ } from './main.js';

class StudentCoinNotificationMethods {
    showNotificationBadge() {
        // Only show if there are actually gift coins
        if (this.coinData.giftCoins <= 0) {
            this.hideNotificationBadge();
            return;
        }

        let badge = $('#coin-notification-badge');
        if (!badge) {
            // Create badge element
            const coinEl = $('#coin-balance');
            if (coinEl && coinEl.parentElement) {
                badge = document.createElement('div');
                badge.id = 'coin-notification-badge';
                badge.style.cssText = `
                    position: absolute;
                    top: -8px;
                    left: -8px;
                    background: #ef4444;
                    color: white;
                    border-radius: 50%;
                    width: 22px;
                    height: 22px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 11px;
                    font-weight: bold;
                    cursor: pointer;
                    box-shadow: 0 2px 4px rgba(0,0,0,0.2);
                    z-index: 100;
                    border: 2px solid white;
                `;
                badge.addEventListener('click', (e) => {
                    e.stopPropagation();
                    this.showNotificationPanel();
                });
                coinEl.parentElement.style.position = 'relative';
                coinEl.parentElement.appendChild(badge);
            }
        }
        if (badge) {
            badge.textContent = this.coinData.giftCoins > 99 ? '99+' : this.coinData.giftCoins;
            badge.style.display = 'flex';
        }
    }

    hideNotificationBadge() {
        const badge = $('#coin-notification-badge');
        if (badge) {
            badge.style.display = 'none';
        }
    }

    showNotificationPanel() {
        // Remove existing panel if any
        let panel = $('#coin-notification-panel');
        if (panel) {
            panel.remove();
        }

        if (this.coinData.giftCoins <= 0) {
            return;
        }

        // Create notification panel
        panel = document.createElement('div');
        panel.id = 'coin-notification-panel';
        panel.style.cssText = `
            position: fixed;
            top: 60px;
            right: 20px;
            background: white;
            border-radius: 12px;
            box-shadow: 0 10px 25px rgba(0,0,0,0.2);
            padding: 1.5rem;
            min-width: 300px;
            max-width: 400px;
            z-index: 10000;
            animation: slideIn 0.3s ease-out;
        `;

        panel.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
                <h3 style="margin: 0; color: var(--primary-color);">💰 Pending Coins</h3>
                <button id="close-notification-panel" style="background: none; border: none; font-size: 24px; cursor: pointer; color: #666;">&times;</button>
            </div>
            <div style="margin-bottom: 1rem; padding: 1rem; background: #f0f9ff; border-radius: 8px; border-left: 4px solid #3b82f6;">
                <div style="font-size: 18px; font-weight: bold; color: #1e40af; margin-bottom: 0.5rem;">
                    +${this.coinData.giftCoins} Coins
                </div>
                <div style="color: #64748b; font-size: 14px;">
                    From your teacher
                </div>
            </div>
            <button id="accept-gift-coins" class="btn primary-btn" style="width: 100%; padding: 0.75rem; font-size: 16px; font-weight: bold;">
                Accept ${this.coinData.giftCoins} Coins
            </button>
        `;

        // Add animation
        const style = document.createElement('style');
        style.textContent = `
            @keyframes slideIn {
                from {
                    opacity: 0;
                    transform: translateY(-20px);
                }
                to {
                    opacity: 1;
                    transform: translateY(0);
                }
            }
        `;
        document.head.appendChild(style);

        document.body.appendChild(panel);

        // Event listeners
        $('#close-notification-panel').addEventListener('click', () => panel.remove());
        $('#accept-gift-coins').addEventListener('click', async () => {
                    await this.progress.acceptGiftCoins();
            panel.remove();
        });

        // Close on outside click
        setTimeout(() => {
            document.addEventListener('click', function closePanel(e) {
                if (!panel.contains(e.target) && e.target.id !== 'coin-notification-badge') {
                    panel.remove();
                    document.removeEventListener('click', closePanel);
                }
            });
        }, 100);
    }
}

export function installStudentCoinNotificationMethods(StudentManager) {
    for (const name of Object.getOwnPropertyNames(StudentCoinNotificationMethods.prototype)) {
        if (name === 'constructor') continue;
        Object.defineProperty(
            StudentManager.prototype,
            name,
            Object.getOwnPropertyDescriptor(StudentCoinNotificationMethods.prototype, name)
        );
    }
}
