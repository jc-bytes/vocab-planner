import { $, notifications } from './main.js';
import { settingsRepository } from './services/settingsRepository.js';

const DEV_GAMIFICATION_SETTINGS_KEY = 'dev_gamification_settings';
const DEV_TEACHER_USER = { email: 'teacher@local.dev' };

function readGamificationInputs() {
    return {
        exchangeRate: parseInt($('#global-exchange-rate')?.value) || 10,
        completionBonus: parseInt($('#global-completion-bonus')?.value) || 50,
        progressReward: parseInt($('#global-progress-reward')?.value) || 1
    };
}

function applyGamificationSettings(settings = {}) {
    const exchangeRateInput = $('#global-exchange-rate');
    const completionBonusInput = $('#global-completion-bonus');
    const progressRewardInput = $('#global-progress-reward');

    if (exchangeRateInput && settings.exchangeRate !== undefined) {
        exchangeRateInput.value = settings.exchangeRate;
    }
    if (completionBonusInput && settings.completionBonus !== undefined) {
        completionBonusInput.value = settings.completionBonus;
    }
    if (progressRewardInput && settings.progressReward !== undefined) {
        progressRewardInput.value = settings.progressReward;
    }
}

function showTransientGamificationStatus(statusEl, text, colorVar) {
    if (!statusEl) return;
    statusEl.style.color = colorVar;
    statusEl.textContent = text;
    setTimeout(() => {
        statusEl.textContent = '';
        statusEl.style.color = 'var(--text-muted)';
    }, 3000);
}

export const teacherGamificationSettingsMethods = {
    async loadGamificationSettings(options = {}) {
        if (this.gamificationSettingsLoaded && options.forceRefresh !== true) return;

        if (this.authDisabled) {
            try {
                const settings = JSON.parse(localStorage.getItem(DEV_GAMIFICATION_SETTINGS_KEY) || '{}');
                applyGamificationSettings(settings);
                this.gamificationSettingsLoaded = true;
            } catch (error) {
                console.error('Error loading local gamification settings:', error);
                this.gamificationSettingsLoaded = false;
                if (options.surfaceErrors) throw error;
            }
            return;
        }

        try {
            const settings = await settingsRepository.get('gamification');
            if (settings) applyGamificationSettings(settings);
            this.gamificationSettingsLoaded = true;
        } catch (error) {
            console.error('Error loading gamification settings:', error);
            this.gamificationSettingsLoaded = false;
            if (options.surfaceErrors) throw error;
        }
    },

    async saveGamificationSettings() {
        const { exchangeRate, completionBonus, progressReward } = readGamificationInputs();

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
                    completionBonus,
                    progressReward,
                    updatedAt: new Date().toISOString(),
                    updatedBy: DEV_TEACHER_USER.email
                }));
                this.gamificationSettingsLoaded = true;

                showTransientGamificationStatus(statusEl, 'Settings saved locally.', 'var(--success-color)');
                this.setCloudStatus('Saved locally', 'success');
                notifications.success('Gamification settings saved locally.');
                return;
            }

            await settingsRepository.save('gamification', {
                exchangeRate,
                completionBonus,
                progressReward,
                updatedAt: new Date().toISOString(),
                updatedBy: this.currentUser?.email || 'unknown'
            });

            this.gamificationSettingsLoaded = true;

            showTransientGamificationStatus(statusEl, 'Settings saved successfully.', 'var(--success-color)');
            notifications.success('Gamification settings saved!');
        } catch (error) {
            console.error('Error saving gamification settings:', error);
            if (statusEl) {
                statusEl.style.color = 'var(--danger-color)';
                statusEl.textContent = 'Failed to save settings. Check permissions.';
            }
            notifications.error('Failed to save settings.');
        } finally {
            if (saveBtn) {
                saveBtn.disabled = false;
                saveBtn.innerHTML = '<i data-lucide="save"></i> Save Settings';
                this.refreshIcons();
            }
        }
    }
};
