import test from 'node:test';
import assert from 'node:assert/strict';
import { showSectionLoadError } from '../js/ui/sectionRecovery.js';

class Node {
    constructor() { this.children = []; this.dataset = {}; this.attributes = {}; this.listeners = {}; this.isConnected = true; }
    append(...nodes) { for (const node of nodes) { node.parent = this; this.children.push(node); } }
    prepend(node) { node.parent = this; this.children.unshift(node); }
    replaceChildren(...nodes) { this.children = []; this.append(...nodes); }
    setAttribute(name, value) { this.attributes[name] = value; }
    addEventListener(name, fn) { this.listeners[name] = fn; }
    querySelector() { return this.children.find(node => Object.hasOwn(node.dataset, 'sectionRecovery')); }
    remove() { this.parent.children = this.parent.children.filter(node => node !== this); }
}
globalThis.document = {createElement: () => new Node()};

test('failed refresh keeps good content and permits only one retry at a time', async () => {
    const root = new Node(), content = new Node(); root.append(content);
    let calls = 0, release;
    const notice = showSectionLoadError(root, {keepContent:true, retry:() => { calls++; return new Promise(resolve => { release = resolve; }); }});
    assert.equal(root.children[1], content);
    assert.equal(root.attributes['aria-busy'], 'false');
    const button = notice.children[1];
    const pending = button.listeners.click();
    await button.listeners.click();
    assert.equal(calls, 1);
    release(); await pending;
    assert.equal(button.disabled, false);
});

test('stale account or navigation guards prevent rendering and retry', async () => {
    const root = new Node(); let active = true, calls = 0;
    const notice = showSectionLoadError(root, {current:() => active,retry:() => {calls++;}});
    active = false;
    await notice.children[1].listeners.click();
    assert.equal(calls, 0);
    assert.equal(showSectionLoadError(root, {current:() => false}), undefined);
    assert.equal(root.children.length, 1);
});

test('access denial clears stale content and repeated errors produce one recovery control', () => {
    const root = new Node(), content = new Node(); root.append(content);
    showSectionLoadError(root, {keepContent:true,error:{status:403}});
    showSectionLoadError(root, {keepContent:true,error:{code:'42501'}});
    assert.equal(root.children.length, 1);
    assert.match(root.children[0].children[0].textContent, /access may have changed/);
});
