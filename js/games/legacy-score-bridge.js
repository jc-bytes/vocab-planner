(function installLegacyScoreBridge() {
    const script = document.currentScript;
    const gameId = script?.dataset.gameId || '';
    const messageType = script?.dataset.messageType || '';
    if (!gameId || !messageType) return;

    let lastScore = -1;
    let lastState = '';
    let lastLevel = -1;
    let lastMenuMode = true;

    const report = (payload) => {
        window.parent.postMessage({ type: messageType, ...payload }, '*');
    };

    const readRadiusRaid = () => {
        if (typeof window.$ === 'undefined' || window.$.score === undefined) return;
        const score = Number(window.$.score) || 0;
        const state = window.$.state || '';
        if (score !== lastScore) report({ score, gameOver: false });
        if (state === 'gameover' && lastState !== 'gameover') {
            const storedScore = Number(window.$.storage?.score) || 0;
            report({ score: Math.max(storedScore, score), gameOver: true });
        }
        lastScore = score;
        lastState = state;
    };

    const findSpacePiGame = () => {
        if (window.sp?.levelStats) return window.sp;
        return Object.values(window).find(value => value && typeof value === 'object' && value.levelStats) || null;
    };

    const readSpacePi = () => {
        const game = findSpacePiGame();
        if (!game?.levelStats) return;
        const score = Math.round(Number(game.levelStats.score) || 0);
        const level = Number(game.level ?? -1);
        const menuMode = game.menuMode !== undefined ? Boolean(game.menuMode) : true;
        if (!menuMode && game.levelPlaying && score !== lastScore) {
            report({ score, level: level + 1, gameOver: false });
        }
        if (!lastMenuMode && menuMode && lastLevel >= 0) {
            report({ score: Math.max(0, lastScore, score), level: lastLevel + 1, gameOver: false });
        }
        lastScore = score;
        lastLevel = level;
        lastMenuMode = menuMode;
    };

    const readPackabunchas = () => {
        const game = window.game?.score !== undefined
            ? window.game
            : (window.Game?.score !== undefined
                ? window.Game
                : Object.values(window).find(value => value && typeof value === 'object' && value.score !== undefined));
        const score = Number(game?.score) || 0;
        if (score !== lastScore) report({ score, gameOver: false });
        lastScore = score;
    };

    const readers = {
        'radius-raid': readRadiusRaid,
        spacepi: readSpacePi,
        packabunchas: readPackabunchas
    };
    const reader = readers[gameId];
    if (!reader) return;

    const interval = window.setInterval(() => {
        try {
            reader();
        } catch (error) {
            console.warn('Game score bridge error:', error);
        }
    }, gameId === 'packabunchas' ? 1000 : 500);
    window.addEventListener('beforeunload', () => window.clearInterval(interval), { once: true });
})();
