import assert from 'node:assert/strict';
import test from 'node:test';

class Element {
    constructor(tag) {
        this.tagName = tag.toUpperCase(); this.className = ''; this.textContent = '';
        this.children = []; this.attributes = new Map(); this.dataset = {}; this.style = {};
        this.listeners = new Map(); this.disabled = false;
        this.classList = {
            add: (...names) => { this.className = [...new Set([...this.className.split(/\s+/), ...names])].filter(Boolean).join(' '); },
            contains: name => this.className.split(/\s+/).includes(name)
        };
    }
    append(...nodes) { for (const node of nodes) { node.remove?.(); node.parentNode = this; this.children.push(node); } }
    appendChild(node) { this.append(node); return node; }
    remove() { if (this.parentNode) this.parentNode.children = this.parentNode.children.filter(node => node !== this); this.parentNode = null; }
    setAttribute(key, value) { this.attributes.set(key, String(value)); }
    getAttribute(key) { return this.attributes.get(key) ?? null; }
    addEventListener(type, handler) { const handlers = this.listeners.get(type) || []; handlers.push(handler); this.listeners.set(type, handlers); }
    dispatch(type, details = {}) {
        const event = { target: this, preventDefault() {}, stopPropagation() {}, ...details };
        for (const handler of this.listeners.get(type) || []) handler(event);
        return event;
    }
    click() { const event = this.dispatch('click'); this.parentNode?.dispatch('click', event); }
    focus() { document.activeElement = this; }
    matches(selector) {
        if (selector === ':popover-open') return this.open === true;
        if (selector === 'button:not(:disabled)') return this.tagName === 'BUTTON' && !this.disabled;
        if (selector.startsWith('.')) return this.classList.contains(selector.slice(1));
        if (selector === '[role="menu"]') return this.getAttribute('role') === 'menu';
        return this.tagName.toLowerCase() === selector;
    }
    closest(selector) { return this.matches(selector) ? this : this.parentNode?.closest(selector) || null; }
    querySelectorAll(selector) { return this.children.flatMap(child => [ ...(child.matches?.(selector) ? [child] : []), ...(child.querySelectorAll?.(selector) || []) ]); }
    querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
    getBoundingClientRect() { return { left: 100, right: 300, top: 100, bottom: 140, width: 200, height: 40 }; }
    showPopover() { this.dispatch('beforetoggle', { newState: 'open' }); this.open = true; this.dispatch('toggle'); }
    hidePopover() { this.dispatch('beforetoggle', { newState: 'closed' }); this.open = false; this.dispatch('toggle'); }
}
globalThis.document = { readyState: 'loading', body: new Element('body'), activeElement: null,
    createElement: tag => new Element(tag), addEventListener() {}, getElementById() { return null; }, querySelectorAll() { return []; } };
globalThis.window = { addEventListener() {}, removeEventListener() {} };
globalThis.innerWidth = 1280; globalThis.innerHeight = 800;
const { createTeacherMaterialItem } = await import('../js/teacherMaterialItem.js');

function fixture(optional = {}) {
    const face = new Element('button'), calls = [];
    face.textContent = 'Prepared row or card';
    // The frame accepts an already prepared face, not a face-specific DOM contract.
    face.querySelector = face.querySelectorAll = () => { throw new Error('The action frame cannot inspect or reconstruct its face'); };
    const wrapper = createTeacherMaterialItem({ face, title: '<img src=x onerror=alert(1)>',
        onPreview: () => calls.push('preview'), onEdit: () => calls.push('edit'), ...optional });
    return { face, wrapper, calls, actions: wrapper.children[1] };
}

test('frame retains the prepared face and established action wrapper without reconstructing it', () => {
    const { face, wrapper, actions } = fixture();
    assert.equal(wrapper.tagName, 'ARTICLE');
    assert.equal(wrapper.className, 'teacher-material-item');
    assert.equal(wrapper.children[0], face);
    assert.equal(actions.className, 'teacher-material-actions');
    assert.equal(face.textContent, 'Prepared row or card');
});

test('preview/edit are named callbacks and optional Assign/Delete appear only when supplied', () => {
    for (const [assign, remove] of [[false, false], [true, false], [false, true], [true, true]]) {
        const calls = [];
        const { actions } = fixture({ ...(assign ? { onAssign: () => calls.push('assign') } : {}),
            ...(remove ? { onDelete: () => calls.push('delete') } : {}) });
        const menu = actions.querySelector('.floating-action-menu');
        const buttons = menu.querySelectorAll('button');
        assert.deepEqual(buttons.map(button => button.textContent), ['Student preview', 'Edit', ...(assign ? ['Assign'] : []), ...(remove ? ['Delete'] : [])]);
        assert.ok(buttons.every(button => button.type === 'button' && button.getAttribute('role') === 'menuitem'));
        if (assign) menu.querySelector('.assign-vocab-btn').click();
        if (remove) menu.querySelector('.delete-vocab-btn').click();
        assert.deepEqual(calls, [...(assign ? ['assign'] : []), ...(remove ? ['delete'] : [])]);
    }
});

test('frame wires each callback once and leaves face activation to its caller', () => {
    const { face, actions, calls } = fixture();
    face.click();
    assert.deepEqual(calls, [], 'the frame cannot add a second face preview handler');
    actions.querySelector('.preview-vocab-btn').click();
    actions.querySelector('.edit-vocab-btn').click();
    assert.deepEqual(calls, ['preview', 'edit']);
});

test('native action menu keeps title labels, popover ownership and keyboard focus behavior', () => {
    const { actions } = fixture({ onDelete() {} });
    const trigger = actions.querySelector('.floating-action-menu-trigger');
    const menu = actions.querySelector('.floating-action-menu');
    assert.equal(trigger.getAttribute('aria-label'), 'More actions for <img src=x onerror=alert(1)>');
    assert.equal(menu.getAttribute('aria-label'), 'Actions for <img src=x onerror=alert(1)>');
    assert.equal(menu.getAttribute('role'), 'menu');
    assert.equal(trigger.getAttribute('aria-controls'), menu.id);
    assert.equal(trigger.popoverTargetElement, menu);
    trigger.dispatch('keydown', { key: 'ArrowDown' });
    assert.equal(trigger.getAttribute('aria-expanded'), 'true');
    assert.equal(document.activeElement, menu.querySelector('.preview-vocab-btn'));
    menu.dispatch('keydown', { key: 'End' });
    assert.equal(document.activeElement, menu.querySelector('.delete-vocab-btn'));
    menu.dispatch('keydown', { key: 'Escape' });
    assert.equal(trigger.getAttribute('aria-expanded'), 'false');
    assert.equal(document.activeElement, trigger);
});

test('optional recovery notice stays outside the prepared face and its action preserves menu order', () => {
    const calls = [];
    const { face, wrapper } = fixture({ contextLabel: 'Local copy available', onReviewLocalCopy: () => calls.push('review'), onAssign() {}, onDelete() {} });
    assert.equal(wrapper.children[0], face);
    assert.equal(wrapper.children[1].className, 'teacher-material-context');
    assert.equal(wrapper.children[1].textContent, 'Local copy available');
    const actions = wrapper.children[2], menu = actions.querySelector('.floating-action-menu');
    assert.deepEqual(menu.querySelectorAll('button').map(button => button.textContent), ['Student preview', 'Edit', 'Review local copy', 'Assign', 'Delete']);
    menu.querySelector('.review-local-copy-btn').click();
    assert.deepEqual(calls, ['review']);
});
