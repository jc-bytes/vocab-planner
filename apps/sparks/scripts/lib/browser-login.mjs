function loginState({ readySelector, errorSelector, formSelector, wait = false, allowForm = false }) {
    const visible = selector => {
        const element = document.querySelector(selector);
        return Boolean(element && [...element.getClientRects()].some(rect => rect.width > 0 && rect.height > 0)
            && getComputedStyle(element).visibility !== 'hidden');
    };
    const state = {
        ready: visible(readySelector),
        form: visible(formSelector),
        error: Boolean(document.querySelector(errorSelector)?.textContent.trim()),
        documentState: document.readyState
    };
    return wait ? state.ready || state.error || (allowForm && state.form) : state;
}

export async function login(page, { baseUrl, pagePath, form, email, password, ready, error }) {
    const selectors = { readySelector: ready, errorSelector: error, formSelector: form.selector };
    const network = [];
    const record = entry => { network.push(entry); if (network.length > 6) network.shift(); };
    const safePath = url => { try { return new URL(url).pathname.slice(0, 160); } catch { return 'unknown'; } };
    const onResponse = response => {
        if (response.status() >= 400) record({ path: safePath(response.url()), status: response.status() });
    };
    const onRequestFailed = request => record({ path: safePath(request.url()),
        failure: String(request.failure()?.errorText || '').match(/(?:ERR_|NS_ERROR_)[A-Z0-9_]+/)?.[0] || 'transport failure' });
    page.on('response', onResponse);
    page.on('requestfailed', onRequestFailed);
    const waitForState = async (phase, allowForm) => {
        try {
            await page.waitForFunction(loginState, { ...selectors, allowForm, wait: true }, { timeout: 30000 });
        } catch (cause) {
            const state = await page.evaluate(loginState, selectors).catch(() => ({ unavailable: true }));
            throw new Error(`${pagePath} login readiness failed (${phase}): ${JSON.stringify({ state, network })}`, { cause });
        }
    };
    try {
        await page.goto(`${baseUrl}${pagePath}`, { waitUntil: 'domcontentloaded' });
        await waitForState('bootstrap', true);
        const state = await page.evaluate(loginState, selectors);
        if (!state.ready && !state.error) {
            await page.fill(form.email, email);
            await page.fill(form.password, password);
            await page.locator(`${form.selector} button[type="submit"]`).click();
            await waitForState('after submit', false);
        }
        const errorText = await page.locator(error).textContent().catch(() => '');
        if (errorText?.trim()) throw new Error(`${pagePath} login failed: ${errorText.trim()}`);
    } finally {
        page.off('response', onResponse);
        page.off('requestfailed', onRequestFailed);
    }
}
