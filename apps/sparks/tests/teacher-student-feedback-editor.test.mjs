import test from 'node:test';
import assert from 'node:assert/strict';
import { createStudentFeedbackEditor } from '../js/teacherStudentFeedbackEditor.js';
class Element {
    constructor(tag) { this.tag = tag; this.children = []; this.listeners = {}; this.value = ''; this.disabled = false; this.isConnected = false; }
    append(...children) { this.children.push(...children); }
    setAttribute() {}
    addEventListener(type, listener) { this.listeners[type] = listener; }
    reportValidity() { return true; }
}
const walk = element => [element, ...element.children.flatMap(walk)];
function fixture() {
    globalThis.document = { createElement: tag => new Element(tag) };
    let current = true, resolve, reject; const saved = [], calls = [];
    const repository = { saveStudentFeedback(input) {
        calls.push(input); return new Promise((a, b) => { resolve = a; reject = b; });
    } };
    const host = createStudentFeedbackEditor({ repository, assignmentId: 'assignment', studentId: 'student', kind: 'spark', responseRevision: 3,
    isCurrent: () => current, onSaved: record => saved.push(record) });
    host.isConnected = true;
    const elements = walk(host), note = elements.find(el => el.tag === 'textarea'), review = elements.find(el => el.tag === 'select');
    const save = elements.find(el => el.textContent === 'Save teacher note');
    return { host, note, review, save, saved, calls, repository, click: () => save.listeners.click(),
        resolve: (revision = 1) => resolve({ revision, note: calls.at(-1).note, review_status: calls.at(-1).reviewStatus,
            response_revision: 3, updated_at: '2026-10-07' }), reject: error => reject(error), replaceOwner: () => { current = false; } };
}
test('detached editors reconcile successful saves and remain ready after reattachment', async () => {
    const f = fixture(); f.note.value = 'Saved while filtered away';
    const pending = f.click(); f.host.isConnected = false; f.resolve(); await pending;
    assert.equal(f.saved.length, 1); assert.equal(f.save.disabled, false);
    f.host.isConnected = true; const next = f.click(); assert.equal(f.calls[1].expectedRevision, 1); f.resolve(2); await next;
});
test('filter away and back before completion retains pending controls and advances revision', async () => {
    const f = fixture(); f.note.value = 'Pending note'; const pending = f.click();
    f.host.isConnected = false; f.host.isConnected = true; assert.equal(f.save.disabled, true);
    f.resolve(); await pending; assert.equal(f.note.value, 'Pending note');
    const next = f.click(); assert.equal(f.calls[1].expectedRevision, 1); f.resolve(2); await next;
});
test('typing and changing review after clicking save preserve newer unsaved edits', async () => {
    const f = fixture(); f.note.value = 'Submitted draft'; f.review.value = 'reviewed'; const pending = f.click();
    f.note.value = 'Newer unsaved draft'; f.review.value = 'needs_revision'; f.resolve(); await pending;
    assert.equal(f.note.value, 'Newer unsaved draft'); assert.equal(f.review.value, 'needs_revision');
    assert.equal(f.saved[0].note, 'Submitted draft'); assert.equal(f.saved[0].review_status, 'reviewed');
    assert.ok(walk(f.host).some(el => el.textContent?.includes('newer edits are not saved')));
    const next = f.click(); assert.equal(f.calls[1].expectedRevision, 1); f.resolve(2); await next;
});
test('owner replacement suppresses successful save callbacks and old editor updates', async () => {
    const f = fixture(); f.note.value = 'Old account'; const pending = f.click(); f.replaceOwner(); f.resolve(); await pending;
    assert.equal(f.saved.length, 0); assert.equal(f.save.disabled, true);
});
test('detached save errors retain drafts and re-enable controls for retry', async () => {
    const f = fixture(); f.note.value = 'Keep this draft'; const pending = f.click(); f.host.isConnected = false;
    f.reject(new Error('Conflict')); await pending;
    assert.equal(f.note.value, 'Keep this draft'); assert.equal(f.save.disabled, false); assert.equal(f.saved.length, 0);
});
test('reload preserves edits made after clicking load and advances the saved revision', async () => {
    const f = fixture(); let resolve;
    f.repository.assignmentFeedback = () => new Promise(done => { resolve = done; });
    const reload = walk(f.host).find(el => el.textContent === 'Load saved note');
    f.note.value = 'Draft to replace'; f.review.value = 'unreviewed'; const pending = reload.listeners.click();
    f.note.value = 'Typed while loading'; f.review.value = 'needs_revision'; f.host.isConnected = false;
    resolve([{ student_id: 'student', activity_type: '', note: 'Persisted note', revision: 9,
        review_status: 'reviewed', response_revision: 3, updated_at: '2026-10-07' }]); await pending;
    assert.equal(f.note.value, 'Typed while loading'); assert.equal(f.review.value, 'needs_revision');
    assert.equal(f.save.disabled, false); assert.ok(walk(f.host).some(el => el.textContent?.includes('newer edits are not saved')));
    const next = f.click(); assert.equal(f.calls[0].expectedRevision, 9); f.resolve(10); await next;
});
