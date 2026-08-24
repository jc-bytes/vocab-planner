export const GAMIFICATION_SETTINGS_KEY = 'gamification';
export const DEV_GAMIFICATION_SETTINGS_KEY = 'dev_gamification_settings';

export const ARCADE_ECONOMY = Object.freeze({
    defaultExchangeRate: 10,
    minimumExchangeRate: 1,
    maximumExchangeRate: 10000
});

export const ACTIVITY_REWARD_DEFAULTS = Object.freeze({
    completionBonus: 50,
    progressReward: 1
});

export function normalizeExchangeRate(value) {
    const parsed = Number.parseInt(value, 10);
    if (!Number.isFinite(parsed)) return ARCADE_ECONOMY.defaultExchangeRate;
    return Math.min(
        ARCADE_ECONOMY.maximumExchangeRate,
        Math.max(ARCADE_ECONOMY.minimumExchangeRate, parsed)
    );
}

export function resolveArcadeEconomySettings(settings = {}) {
    return Object.freeze({
        exchangeRate: normalizeExchangeRate(settings?.exchangeRate)
    });
}

export function resolveActivityCoinRewards(settings = {}, activityType) {
    const activityRewards = settings.activityRewards?.[activityType] || {};
    return {
        completionBonus: activityRewards.completionBonus !== undefined
            ? activityRewards.completionBonus
            : (settings.completionBonus !== undefined
                ? settings.completionBonus
                : ACTIVITY_REWARD_DEFAULTS.completionBonus),
        progressReward: activityRewards.progressReward !== undefined
            ? activityRewards.progressReward
            : (settings.progressReward !== undefined
                ? settings.progressReward
                : ACTIVITY_REWARD_DEFAULTS.progressReward)
    };
}

export function normalizeActivityRewardSetting(field, value) {
    const fallback = ACTIVITY_REWARD_DEFAULTS[field];
    if (fallback === undefined) {
        throw new TypeError(`Unknown activity reward setting: ${field}`);
    }
    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}
