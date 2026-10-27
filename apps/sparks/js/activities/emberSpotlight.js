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
    let trackingFrame;
    let lastGeometry;
    const oldPadding = document.body.style.paddingBottom;
    const documentLocked = () => ['hidden', 'clip'].includes(getComputedStyle(document.documentElement).overflowY);
    // A fixed desktop shell scrolls its active view. Extra body space would
    // create a second scroll area and move the shell itself off screen.
    if (!documentLocked()) document.body.style.paddingBottom = '380px';
    document.body.append(dialog);
    function place() {
        if (closed) return;
        const target = steps[index].target;
        if (!target.isConnected) { close(); return; }
        const rect = target.getBoundingClientRect();
        const height = popup.getBoundingClientRect().height;
        const width = popup.getBoundingClientRect().width;
        const geometry = [rect.left, rect.top, rect.width, rect.height, width, height, innerWidth, innerHeight].join(',');
        if (geometry === lastGeometry) return;
        lastGeometry = geometry;
        Object.assign(hole.style, { left: `${rect.left - 8}px`, top: `${rect.top - 8}px`, width: `${rect.width + 16}px`, height: `${rect.height + 16}px` });
        const beside = rect.right + width + 40 < innerWidth;
        popup.style.left = `${beside ? rect.right + 24 : Math.max(12, (innerWidth - width) / 2)}px`;
        popup.style.top = `${beside ? Math.max(12, Math.min(rect.top, innerHeight - height - 12)) : Math.max(12, Math.min(rect.bottom + 24, innerHeight - height - 12))}px`;
    }
    // Transitions, fonts, and async content can move a target without a scroll or
    // resize event. Track only while the modal is open; write styles only on change.
    function trackTarget() {
        place();
        if (!closed) trackingFrame = requestAnimationFrame(trackTarget);
    }
    function show() {
        const step = steps[index];
        dialog.dataset.pose = step.pose;
        dialog.querySelector('img').src = new URL(`../../assets/ember/${art[step.pose]}.webp`, import.meta.url).href;
        dialog.querySelector('h2').textContent = step.title;
        dialog.querySelector('#ember-spotlight-message').textContent = step.message;
        dialog.querySelector('.ember-spotlight-count').textContent = steps.length > 1 ? `Step ${index + 1} of ${steps.length}` : 'Ember guide';
        back.disabled = index === 0;
        next.textContent = index === steps.length - 1 ? (step.action || 'Try it') : 'Next';
        let scrollOwner = step.target.parentElement;
        while (scrollOwner && scrollOwner !== document.body
            && !(/auto|scroll/.test(getComputedStyle(scrollOwner).overflowY) && scrollOwner.clientHeight > 0)) {
            scrollOwner = scrollOwner.parentElement;
        }
        if (scrollOwner && scrollOwner !== document.body) {
            const targetRect = step.target.getBoundingClientRect();
            const ownerRect = scrollOwner.getBoundingClientRect();
            scrollOwner.scrollTo({ top: scrollOwner.scrollTop + targetRect.top - ownerRect.top
                - (scrollOwner.clientHeight - targetRect.height) / 2, behavior: 'instant' });
        } else if (!documentLocked()) {
            step.target.scrollIntoView({ block: 'center', behavior: 'instant' });
        }
        const rect = step.target.getBoundingClientRect();
        if (!documentLocked() && (!scrollOwner || scrollOwner === document.body) && !step.target.closest('.activity-header')) {
            const topBarBottom = document.querySelector('#activity-view .activity-header')?.getBoundingClientRect().bottom || 0;
            window.scrollTo({ top: Math.max(0, window.scrollY + rect.top - Math.max(topBarBottom + 24, innerWidth > 820 ? 180 : 80)), behavior: 'instant' });
        }
        place();
        next.focus({ preventScroll: true });
    }
    function close(callback) {
        if (closed) return;
        closed = true;
        cancelAnimationFrame(trackingFrame);
        window.removeEventListener('resize', place);
        window.removeEventListener('scroll', place, true);
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
    window.addEventListener('scroll', place, true);
    dialog.addEventListener('keydown', event => {
        event.stopPropagation();
        if (event.key !== 'Tab') return;
        const buttons = [...dialog.querySelectorAll('button:not(:disabled)')];
        const position = buttons.indexOf(document.activeElement);
        event.preventDefault();
        buttons[(position + (event.shiftKey ? -1 : 1) + buttons.length) % buttons.length].focus();
    });
    dialog.showModal();
    show();
    trackingFrame = requestAnimationFrame(trackTarget);
    return () => close();
}
