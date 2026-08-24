export function attachWritingChecker(root, selector = '[data-writing-check]') {
    if (!root) return () => {};

    root.querySelectorAll(selector).forEach(field => {
        field.spellcheck = true;
        field.setAttribute('spellcheck', 'true');
        field.setAttribute('autocapitalize', 'sentences');

        const panel = field.parentElement?.querySelector('[data-writing-suggestions]');
        if (panel) {
            panel.hidden = true;
            panel.replaceChildren();
        }
    });

    // Keep a cleanup-compatible interface for activity lifecycle code. Native
    // spellcheck does not create timers, listeners, workers, or network requests.
    return () => {};
}
