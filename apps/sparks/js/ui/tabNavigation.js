export function getKeyboardNavigatedTab(tabs, currentTab, key, { vertical = false } = {}) {
    const availableTabs = Array.from(tabs || []);
    const currentIndex = availableTabs.indexOf(currentTab);
    if (currentIndex < 0) return null;

    if (key === 'Home') return availableTabs[0];
    if (key === 'End') return availableTabs.at(-1);
    const movesForward = key === 'ArrowRight' || (vertical && key === 'ArrowDown');
    const movesBackward = key === 'ArrowLeft' || (vertical && key === 'ArrowUp');
    if (!movesForward && !movesBackward) return null;

    const direction = movesForward ? 1 : -1;
    const nextIndex = (currentIndex + direction + availableTabs.length) % availableTabs.length;
    return availableTabs[nextIndex];
}
