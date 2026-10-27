// A quiet offer of help after two visible, inactive minutes. Never infer confusion.
export function watchEmberIdle(activity) {
    const delay = 120000;
    const offeredCards = new Set();
    let timer;
    let prompt;
    function dismiss() { prompt?.remove(); prompt = null; }
    function reset() {
        clearTimeout(timer);
        if (!document.hidden) timer = setTimeout(offer, delay);
    }
    function offer() {
        if (document.hidden || activity.guideSkipped || activity.getScore().isComplete
            || offeredCards.has(activity.currentIndex)) return;
        if (document.querySelector('.ember-spotlight[open]')) { reset(); return; }
        offeredCards.add(activity.currentIndex);
        prompt = document.createElement('aside');
        prompt.className = 'ember-idle-prompt';
        prompt.setAttribute('aria-label', 'Ember help');
        prompt.innerHTML = `<img src="${new URL('../../assets/ember/03-take-your-time.webp', import.meta.url).href}" alt="" width="56" height="56"><p role="status">Take your time. Need help with the next step?</p><button class="btn primary-btn" type="button" data-help>Show me</button><button class="btn secondary-btn" type="button" data-dismiss>Keep thinking</button>`;
        prompt.querySelector('[data-help]').onclick = () => { dismiss(); activity.showGuide(); };
        prompt.querySelector('[data-dismiss]').onclick = () => { dismiss(); activity.emberHelpButton?.focus({preventScroll:true}); };
        activity.container.prepend(prompt);
    }
    function activityEvent() { reset(); }
    const events = ['pointerdown', 'pointermove', 'keydown', 'input', 'scroll'];
    events.forEach(event => document.addEventListener(event, activityEvent, {passive:true, capture:true}));
    document.addEventListener('visibilitychange', reset);
    reset();
    return {
        reset() { dismiss(); reset(); }, dismiss,
        destroy() {
            clearTimeout(timer); dismiss();
            events.forEach(event => document.removeEventListener(event, activityEvent, true));
            document.removeEventListener('visibilitychange', reset);
        }
    };
}
