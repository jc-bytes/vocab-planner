const art = {
    step: '01-follow-this-step', example: '02-let-me-show-you', calm: '03-take-your-time',
    clue: '04-try-this-clue', correct: '05-you-got-it', complete: '06-activity-complete'
};

// Local experiment: native modal isolation keeps covered controls out of tab order.
export function openSpotlight({ steps, onFinish, onSkip }) {
    const previousFocus = document.activeElement;
    const dialog = document.createElement('dialog');
    dialog.className = 'ember-spotlight';
    dialog.setAttribute('aria-labelledby', 'ember-spotlight-title');
    dialog.setAttribute('aria-describedby', 'ember-spotlight-message');
    dialog.innerHTML = `<div class="ember-spotlight-hole" aria-hidden="true"></div>
      <section class="ember-spotlight-popup">
        <img alt="" width="88" height="88">
        <div><p class="ember-spotlight-count"></p><h2 id="ember-spotlight-title"></h2><p id="ember-spotlight-message"></p></div>
        <nav aria-label="Guide controls"><button type="button" class="btn secondary-btn" data-back>Back</button><button type="button" class="btn primary-btn" data-next>Next</button><button type="button" class="btn secondary-btn" data-skip>Skip guide</button></nav>
      </section>`;
    const hole = dialog.querySelector('.ember-spotlight-hole');
    const popup = dialog.querySelector('.ember-spotlight-popup');
    const back = dialog.querySelector('[data-back]');
    const next = dialog.querySelector('[data-next]');
    let index = 0;
    let closed = false;
    const oldPadding = document.body.style.paddingBottom;
    document.body.style.paddingBottom = '380px';
    document.body.append(dialog);
    function place() {
        if (closed) return;
        const rect = steps[index].target.getBoundingClientRect();
        Object.assign(hole.style, { left: `${rect.left - 8}px`, top: `${rect.top - 8}px`, width: `${rect.width + 16}px`, height: `${rect.height + 16}px` });
        const height = popup.getBoundingClientRect().height;
        const width = popup.getBoundingClientRect().width;
        const beside = rect.right + width + 40 < innerWidth;
        popup.style.left = `${beside ? rect.right + 24 : Math.max(12, (innerWidth - width) / 2)}px`;
        popup.style.top = `${beside ? Math.max(12, Math.min(rect.top, innerHeight - height - 12)) : Math.max(12, Math.min(rect.bottom + 24, innerHeight - height - 12))}px`;
    }
    function show() {
        const step = steps[index];
        dialog.dataset.pose = step.pose;
        dialog.querySelector('img').src = new URL(`../assets/ember/${art[step.pose]}.webp`, import.meta.url).href;
        dialog.querySelector('h2').textContent = step.title;
        dialog.querySelector('#ember-spotlight-message').textContent = step.message;
        dialog.querySelector('.ember-spotlight-count').textContent = steps.length > 1 ? `Step ${index + 1} of ${steps.length}` : 'Ember guide';
        back.disabled = index === 0;
        next.textContent = index === steps.length - 1 ? (step.action || 'Try it') : 'Next';
        const rect = step.target.getBoundingClientRect();
        if (!step.target.closest('header')) {
            const topBarBottom = document.querySelector('header').getBoundingClientRect().bottom;
            window.scrollTo({ top: Math.max(0, window.scrollY + rect.top - Math.max(topBarBottom + 24, innerWidth > 820 ? 180 : 80)), behavior: 'instant' });
        }
        place();
        next.focus({ preventScroll: true });
    }
    function close(callback) {
        if (closed) return;
        closed = true;
        window.removeEventListener('resize', place);
        window.removeEventListener('scroll', place);
        dialog.close();
        dialog.remove();
        document.body.style.paddingBottom = oldPadding;
        if (previousFocus?.isConnected) previousFocus.focus({preventScroll:true});
        callback?.();
    }
    back.onclick = () => { index--; show(); };
    next.onclick = () => index < steps.length - 1 ? (index++, show()) : close(onFinish);
    dialog.querySelector('[data-skip]').onclick = () => close(onSkip);
    dialog.addEventListener('cancel', event => { event.preventDefault(); close(onSkip); });
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place);
    dialog.addEventListener('keydown', event => {
        if (event.key !== 'Tab') return;
        const buttons = [...dialog.querySelectorAll('button:not(:disabled)')];
        const position = buttons.indexOf(document.activeElement);
        event.preventDefault();
        buttons[(position + (event.shiftKey ? -1 : 1) + buttons.length) % buttons.length].focus();
    });
    dialog.showModal();
    show();
    return () => close();
}
