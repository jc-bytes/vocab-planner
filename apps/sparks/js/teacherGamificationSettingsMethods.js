import { $, notifications } from './main.js';
import {
    DEV_GAMIFICATION_SETTINGS_KEY,
    GAMIFICATION_SETTINGS_KEY,
    normalizeExchangeRate,
    resolveArcadeEconomySettings
} from './gamificationConfig.js';
import { settingsRepository } from './services/settingsRepository.js';
import { createTeacherSettingsOperationGuard } from './teacherSettingsSession.js';

const DEV_TEACHER_USER = { email: 'teacher@local.dev' };

function readGamificationInputs() {
    return resolveArcadeEconomySettings({
        exchangeRate: $('#global-exchange-rate')?.value
    });
}

function applyGamificationSettings(settings = {}) {
    const exchangeRateInput = $('#global-exchange-rate');
    if (exchangeRateInput) exchangeRateInput.value = normalizeExchangeRate(settings.exchangeRate);
}

function showTransientGamificationStatus(statusEl, text, colorVar, isCurrent) {
    if (!statusEl) return;
    statusEl.style.color = colorVar;
    statusEl.textContent = text;
    return setTimeout(() => {
        if (!isCurrent()) return;
        statusEl.textContent = '';
        statusEl.style.color = 'var(--text-muted)';
    }, 3000);
}

export const teacherGamificationSettingsMethods = {
    async loadGamificationSettings(options = {}) {
        const isCurrent = createTeacherSettingsOperationGuard(this, options);
        if (!isCurrent()) return false;
        if (this.gamificationSettingsLoaded && options.forceRefresh !== true) return true;

        if (this.authDisabled) {
            try {
                const settings = JSON.parse(localStorage.getItem(DEV_GAMIFICATION_SETTINGS_KEY) || '{}');
                if (!isCurrent()) return false;
                applyGamificationSettings(settings);
                this.gamificationSettingsLoaded = true;
            } catch (error) {
                if (!isCurrent()) return false;
                console.error('Error loading local gamification settings:', error);
                this.gamificationSettingsLoaded = false;
                if (options.surfaceErrors) throw error;
            }
            return true;
        }

        try {
            const settings = await settingsRepository.get(GAMIFICATION_SETTINGS_KEY);
            if (!isCurrent()) return false;
            applyGamificationSettings(settings || {});
            this.gamificationSettingsLoaded = true;
            return true;
        } catch (error) {
            if (!isCurrent()) return false;
            console.error('Error loading gamification settings:', error);
            this.gamificationSettingsLoaded = false;
            if (options.surfaceErrors) throw error;
            return false;
        }
    },

    async saveGamificationSettings(options = {}) {
        const isCurrent = createTeacherSettingsOperationGuard(this, options);
        if (!isCurrent()) return false;
        clearTimeout(this.gamificationStatusTimer);
        this.gamificationStatusTimer = null;
        const { exchangeRate } = readGamificationInputs();

        const statusEl = $('#gamification-save-status');
        const saveBtn = $('#save-gamification-btn');

        try {
            if (saveBtn) {
                saveBtn.disabled = true;
                saveBtn.innerHTML = '<i data-lucide="loader-circle"></i> Saving...';
                this.refreshIcons();
            }
            if (statusEl) statusEl.textContent = 'Saving settings...';

            if (this.authDisabled) {
                localStorage.setItem(DEV_GAMIFICATION_SETTINGS_KEY, JSON.stringify({
                    exchangeRate,
                    updatedAt: new Date().toISOString(),
                    updatedBy: DEV_TEACHER_USER.email
                }));
                if (!isCurrent()) return false;
                this.gamificationSettingsLoaded = true;

                this.gamificationStatusTimer = showTransientGamificationStatus(
                    statusEl,
                    'Settings saved locally.',
                    'var(--success-color)',
                    isCurrent
                );
                this.setCloudStatus('Saved locally', 'success');
                notifications.success('Gamification settings saved locally.');
                return true;
            }

            await settingsRepository.save(GAMIFICATION_SETTINGS_KEY, {
                exchangeRate,
                updatedAt: new Date().toISOString(),
                updatedBy: this.currentUser?.email || 'unknown'
            });
            if (!isCurrent()) return false;

            this.gamificationSettingsLoaded = true;

            this.gamificationStatusTimer = showTransientGamificationStatus(
                statusEl,
                'Settings saved successfully.',
                'var(--success-color)',
                isCurrent
            );
            notifications.success('Gamification settings saved!');
            return true;
        } catch (error) {
            if (!isCurrent()) return false;
            console.error('Error saving gamification settings:', error);
            if (statusEl) {
                statusEl.style.color = 'var(--danger-color)';
                statusEl.textContent = 'Failed to save settings. Check permissions.';
            }
            notifications.error('Failed to save settings.');
            return false;
        } finally {
            if (isCurrent() && saveBtn) {
                saveBtn.disabled = false;
                saveBtn.innerHTML = '<i data-lucide="save"></i> Save Settings';
                this.refreshIcons();
            }
        }
    }
};
