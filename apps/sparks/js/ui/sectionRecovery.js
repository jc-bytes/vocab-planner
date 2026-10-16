// Section reads recover in place. Callers own their account/navigation guards and
// decide whether the currently displayed content belongs to the failed request.
export function isAccessFailure(error) {
    return [401, 403].includes(Number(error?.status ?? error?.statusCode)) || error?.code === '42501';
}

export function showSectionLoadError(container, { label = 'this section', retry, current = () => true, keepContent = false, hasPreviousContent = keepContent, error } = {}) {
    if (!container || !current()) return;
    container.querySelector('[data-section-recovery]')?.remove();
    const denied = isAccessFailure(error);
    const notice = document.createElement('div');
    notice.className = 'inline-status section-load-error';
    notice.dataset.sectionRecovery = '';
    notice.setAttribute('role', 'alert');
    const message = document.createElement('p');
    message.textContent = denied
        ? `Could not load ${label}. Your access may have changed. Try again to check.`
        : `Could not load ${label}. Check your connection and try again.${hasPreviousContent ? ' Previously loaded content is still shown.' : ''}`;
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'btn secondary-btn';
    button.textContent = 'Try again';
    button.addEventListener('click', async () => {
        if (!current() || button.disabled) return;
        button.disabled = true;
        button.textContent = 'Trying again…';
        try { await retry(); }
        catch { /* The section owns its failed retry state. Keep this control usable. */ }
        finally { if (button.isConnected) { button.disabled = false; button.textContent = 'Try again'; } }
    });
    notice.append(message, button);
    if (!keepContent || denied) container.replaceChildren(notice);
    else {
        const heading = container.querySelector(':scope > h1, :scope > h2');
        if (heading) heading.after(notice);
        else container.prepend(notice);
    }
    container.setAttribute('aria-busy', 'false');
    return notice;
}

export function showSectionCountError(count, options) {
    let host = count.parentElement.querySelector('[data-section-count-status]');
    if (!host) {
        host = document.createElement('div');
        host.dataset.sectionCountStatus = '';
        count.parentElement.append(host);
    }
    if (isAccessFailure(options.error)) count.textContent = '--';
    return showSectionLoadError(host, { ...options, hasPreviousContent: count.textContent !== '--' });
}
