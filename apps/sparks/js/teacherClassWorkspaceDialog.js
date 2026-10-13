let nextDialog = 0;

// Owns focus, validation, cancellation and pending-submit state. A closed dialog
// cannot submit again or repaint a screen after navigation/account replacement.
export function openClassWorkspaceDialog({ root, title, fields, help, isCurrent, save, onSaved }) {
    const opener = document.activeElement;
    const dialog = document.createElement('dialog');
    dialog.className = 'class-workspace-dialog';
    const heading = document.createElement('h2'); heading.id = `class-workspace-dialog-${++nextDialog}`; heading.textContent = title;
    dialog.setAttribute('aria-labelledby', heading.id);
    const form = document.createElement('form');
    const status = document.createElement('p'); status.setAttribute('role', 'status');
    let closed = false, pending = false;
    function close() {
        if (closed) return;
        closed = true; dialog.close(); dialog.remove();
        if (opener?.isConnected) opener.focus();
    }
    form.append(heading);
    if (help) { const description = document.createElement('p'); description.textContent = help; form.append(description); }
    for (const field of fields) {
        const label = document.createElement('label'); label.textContent = field.label;
        const input = document.createElement(field.options ? 'select' : field.type === 'textarea' ? 'textarea' : 'input');
        if (input.tagName === 'INPUT') input.type = field.type || 'text';
        input.name = field.name; input.required = true;
        if (field.maxLength) input.maxLength = field.maxLength;
        if (field.min) input.min = field.min;
        if (field.max) input.max = field.max;
        for (const choice of field.options || []) {
            const option = document.createElement('option'); option.value = choice.value; option.textContent = choice.label; input.append(option);
        }
        if (field.value) input.value = field.value;
        label.append(input); form.append(label);
    }
    const actions = document.createElement('div');
    const cancel = document.createElement('button'); cancel.type = 'button'; cancel.className = 'btn secondary-btn'; cancel.textContent = 'Cancel';
    cancel.addEventListener('click', close);
    const submit = document.createElement('button'); submit.type = 'submit'; submit.className = 'btn primary-btn'; submit.textContent = title;
    actions.append(cancel, submit); form.append(status, actions); dialog.append(form); root.append(dialog);
    dialog.addEventListener('cancel', event => { event.preventDefault(); close(); });
    dialog.addEventListener('close', close);
    form.addEventListener('submit', async event => {
        event.preventDefault();
        if (closed || pending || !isCurrent() || !form.reportValidity()) return;
        const data = new FormData(form);
        if (fields.some(field => !String(data.get(field.name) || '').trim())) { status.textContent = 'Complete every field.'; return; }
        pending = true; submit.disabled = true; status.textContent = 'Saving…';
        try {
            await save(data);
            if (!closed && isCurrent()) { close(); await onSaved?.(); }
        } catch (error) {
            if (!closed && isCurrent()) status.textContent = error.message || 'Could not save. Please try again.';
        } finally { if (!closed && isCurrent()) { pending = false; submit.disabled = false; } }
    });
    dialog.showModal();
    return close;
}
