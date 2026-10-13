// Small DOM primitives shared by the assignment tools; no retained account data.
export function node(tag, text, className) {
    const result = document.createElement(tag);
    if (text !== undefined) result.textContent = text;
    if (className) result.className = className;
    return result;
}
export function action(label, run, primary = false) {
    const result = node('button', label, `btn ${primary ? 'primary' : 'secondary'}-btn`);
    result.type = 'button'; result.addEventListener('click', run); return result;
}
export function inputField(form, label, name, type = 'text') {
    const wrapper = node('label', label, 'teacher-workspace-field'); const input = node('input');
    input.name = name; input.type = type; wrapper.append(input); form.append(wrapper); return input;
}
export function selectField(form, label, name, options) {
    const wrapper = node('label', label, 'teacher-workspace-field'); const select = node('select'); select.name = name;
    for (const [value, text] of options) { const option = node('option', text); option.value = value; select.append(option); }
    wrapper.append(select); form.append(wrapper); return select;
}
export function createAssignmentDialog(title, onClose = () => {}) {
    const previousFocus = document.activeElement;
    const dialog = node('dialog', undefined, 'teacher-assignment-dialog classrooms');
    const heading = node('h2', title); heading.id = `assignment-dialog-${crypto.randomUUID()}`;
    dialog.setAttribute('aria-labelledby', heading.id);
    const body = node('div'); const footer = node('div', undefined, 'modal-footer');
    let closed = false;
    function close() {
        if (closed) return; closed = true;
        if (dialog.open) dialog.close(); dialog.remove(); onClose();
        if (previousFocus?.isConnected) previousFocus.focus();
    }
    dialog.addEventListener('cancel', event => { event.preventDefault(); close(); });
    footer.append(action('Cancel', close)); dialog.append(heading, body, footer);
    document.body.append(dialog); dialog.showModal();
    return { dialog, body, footer, close };
}
