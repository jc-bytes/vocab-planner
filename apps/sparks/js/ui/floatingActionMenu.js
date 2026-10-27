let nextMenuId = 0;

export function bindFloatingActionMenu({ trigger, menu }) {
    if (trigger.dataset.floatingActionMenu) return;
    trigger.dataset.floatingActionMenu = 'true';
    trigger.type = 'button';
    trigger.classList.add('floating-action-menu-trigger');
    trigger.textContent = '⋮';
    menu.classList.add('floating-action-menu');
    menu.popover = 'auto';
    menu.id ||= `floating-action-menu-${++nextMenuId}`;
    menu.setAttribute('role', 'menu');
    trigger.setAttribute('aria-haspopup', 'menu');
    trigger.setAttribute('aria-expanded', 'false');
    trigger.setAttribute('aria-controls', menu.id);
    // Native invokers are excluded from light dismissal, so a second click
    // toggles the open menu closed instead of dismissing and reopening it.
    trigger.popoverTargetElement = menu;
    trigger.popoverTargetAction = 'toggle';
    const items = () => [...menu.querySelectorAll('button:not(:disabled)')];
    const close = () => { if (menu.matches(':popover-open')) menu.hidePopover(); };
    let openListeners;
    let focusLast = false;
    function position() {
        const anchor = trigger.getBoundingClientRect(), size = menu.getBoundingClientRect();
        menu.style.left = `${Math.max(8, Math.min(anchor.right - size.width, innerWidth - size.width - 8))}px`;
        menu.style.top = `${Math.max(8, anchor.bottom + size.height + 8 <= innerHeight ? anchor.bottom + 4 : anchor.top - size.height - 4)}px`;
    }
    menu.addEventListener('beforetoggle', event => {
        openListeners?.abort();
        if (event.newState !== 'open') return;
        for (const item of items()) item.setAttribute('role', 'menuitem');
        menu.style.visibility = 'hidden';
    });
    menu.addEventListener('toggle', () => {
        const open = menu.matches(':popover-open');
        trigger.setAttribute('aria-expanded', String(open));
        if (open) {
            position(); menu.style.visibility = 'visible';
            (focusLast ? items().at(-1) : items()[0])?.focus({ preventScroll: true });
            focusLast = false;
            openListeners = new AbortController();
            const anchor = trigger.getBoundingClientRect();
            document.addEventListener('scroll', () => {
                const next = trigger.getBoundingClientRect();
                if (next.left !== anchor.left || next.top !== anchor.top) close();
            }, { capture: true, signal: openListeners.signal });
            window.addEventListener('resize', close, { signal: openListeners.signal });
        }
    });
    menu.addEventListener('click', event => {
        if (event.target.closest('button:not(:disabled)')) { close(); trigger.focus({ preventScroll: true }); }
    });
    trigger.addEventListener('keydown', event => {
        if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
            event.preventDefault();
            focusLast = event.key === 'ArrowUp';
            if (!menu.matches(':popover-open')) menu.showPopover();
            else (focusLast ? items().at(-1) : items()[0])?.focus();
        }
    });
    menu.addEventListener('keydown', event => {
        const controls = items(), index = controls.indexOf(document.activeElement);
        if (['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) {
            event.preventDefault();
            const next = event.key === 'Home' ? 0 : event.key === 'End' ? controls.length - 1 : (index + (event.key === 'ArrowDown' ? 1 : controls.length - 1)) % controls.length;
            controls[next]?.focus();
        } else if (event.key === 'Escape' || event.key === 'Tab') {
            if (event.key === 'Escape') event.preventDefault();
            close(); trigger.focus({ preventScroll: true });
        }
    });
}

export function upgradeActionMenu(details, label) {
    if (!details || details.tagName !== 'DETAILS') return;
    const summary = details.querySelector(':scope > summary');
    const menu = summary?.nextElementSibling;
    if (!menu) return;
    const wrapper = document.createElement('div');
    wrapper.className = details.className;
    wrapper.id = details.id;
    const trigger = document.createElement('button');
    trigger.setAttribute('aria-label', label);
    menu.setAttribute('aria-label', label);
    wrapper.append(trigger, menu); details.replaceWith(wrapper);
    bindFloatingActionMenu({trigger, menu});
}
