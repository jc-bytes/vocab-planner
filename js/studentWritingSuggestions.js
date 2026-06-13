const MIN_CHECK_LENGTH = 3;
const MAX_VISIBLE_SUGGESTIONS = 3;
const CHECK_DELAY_MS = 450;

let harperLinterPromise = null;

function getHarperLinter() {
    if (!harperLinterPromise) {
        harperLinterPromise = (async () => {
            const [{ Dialect, LocalLinter }, { binary }] = await Promise.all([
                import('harper.js'),
                import('harper.js/binary')
            ]);
            const linter = new LocalLinter({
                binary,
                dialect: Dialect.American
            });
            await linter.setup();
            return linter;
        })();
    }
    return harperLinterPromise;
}

function readSuggestions(lint) {
    return lint.suggestions()
        .map(suggestion => suggestion.get_replacement_text())
        .filter(Boolean)
        .slice(0, 2);
}

function formatLints(lints = []) {
    return lints.slice(0, MAX_VISIBLE_SUGGESTIONS).map(lint => ({
        kind: lint.lint_kind_pretty(),
        message: lint.message(),
        problem: lint.get_problem_text(),
        suggestions: readSuggestions(lint)
    }));
}

function setPanelState(panel, state, suggestions = []) {
    panel.classList.toggle('has-suggestions', state === 'suggestions');
    panel.classList.toggle('is-loading', state === 'loading');
    panel.hidden = state === 'empty';
    panel.replaceChildren();

    if (state === 'loading') {
        const status = document.createElement('span');
        status.className = 'writing-suggestion-status';
        status.textContent = 'Checking writing...';
        panel.appendChild(status);
        return;
    }

    if (state === 'ready') {
        const status = document.createElement('span');
        status.className = 'writing-suggestion-status';
        status.textContent = 'No writing suggestions.';
        panel.appendChild(status);
        return;
    }

    if (state !== 'suggestions') return;

    const title = document.createElement('strong');
    title.textContent = 'Writing suggestions';
    panel.appendChild(title);

    const list = document.createElement('ul');
    suggestions.forEach(suggestion => {
        const item = document.createElement('li');
        const message = document.createElement('span');
        message.textContent = suggestion.message;
        item.appendChild(message);

        if (suggestion.suggestions.length) {
            const replacements = document.createElement('small');
            replacements.textContent = `Try: ${suggestion.suggestions.join(' or ')}`;
            item.appendChild(replacements);
        }
        list.appendChild(item);
    });
    panel.appendChild(list);
}

async function checkFieldWriting(field, panel, token) {
    const text = String(field.value || '').trim();
    if (text.length < MIN_CHECK_LENGTH) {
        setPanelState(panel, 'empty');
        return;
    }

    setPanelState(panel, 'loading');
    try {
        const linter = await getHarperLinter();
        const lints = await linter.lint(text, { language: 'plaintext' });
        if (field.dataset.writingCheckToken !== token) return;
        const suggestions = formatLints(lints);
        setPanelState(panel, suggestions.length ? 'suggestions' : 'ready', suggestions);
    } catch (error) {
        console.warn('Writing checker unavailable:', error);
        if (field.dataset.writingCheckToken === token) {
            setPanelState(panel, 'empty');
        }
    }
}

export function attachStructuredWritingChecker(root) {
    if (!root) return;
    root.querySelectorAll('[data-response-text]').forEach(field => {
        const panel = field.parentElement?.querySelector('[data-writing-suggestions]');
        if (!panel) return;

        let timer = null;
        const scheduleCheck = () => {
            window.clearTimeout(timer);
            const token = `${Date.now()}-${Math.random()}`;
            field.dataset.writingCheckToken = token;
            timer = window.setTimeout(() => {
                checkFieldWriting(field, panel, token);
            }, CHECK_DELAY_MS);
        };

        field.addEventListener('input', scheduleCheck);
        field.addEventListener('blur', scheduleCheck);
        if (String(field.value || '').trim()) scheduleCheck();
    });
}
