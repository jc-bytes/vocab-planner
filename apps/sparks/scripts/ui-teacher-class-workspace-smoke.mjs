import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { ensureViteServer } from './lib/local-vite-server.mjs';
const port = Number(process.env.UI_TEACHER_CLASS_WORKSPACE_PORT || 8043);
const baseUrl = `http://127.0.0.1:${port}`;
let server, browser;
try {
    server = await ensureViteServer({ baseUrl, probePath: '/', host: '127.0.0.1', port });
    browser = await chromium.launch();
    const page = await browser.newPage();
    await page.goto(baseUrl);
    await page.evaluate(async () => {
        document.body.replaceChildren();
        const root = document.createElement('main'); document.body.append(root);
        window.classOwner = 'teacher-a'; window.calls = [];
        const repository = {
            async listClasses() { return [{ id: 'class-a', canTeach: true, name: '6A', school_year: 2026, subject: { name: 'Technology' } }]; },
            async listSubjects() { return [{ id: 'subject-a', name: 'Technology' }]; },
            async getRoster(id) { window.calls.push(['roster', id]); return [{ studentId: 'one', name: 'Student One', email: 'one@example.org' }]; },
            async listInvitations() { return []; },
            async listAssignments(id) { window.calls.push(['assignments', id]); return [{ id: 'work-one', title: 'Vocabulary One', release_at: '2026-09-01T00:00:00Z' }]; },
            async inviteStudents(id, emails) { window.calls.push(['invite', id, emails]); },
            async createClass(data) { window.calls.push(['create', data]); },
            async createSubject(name) { window.calls.push(['subject', name]); }
        };
        const { createTeacherClassWorkspace } = await import('/js/teacherClassWorkspace.js');
        window.workspace = createTeacherClassWorkspace({ schoolRepository: { listYears: async () => [{ year: 2026, label: '2026', archived: false }] }, root, getUserId: () => window.classOwner, repository,
            onPublish: data => window.calls.push(['publish', data]), onReview: data => window.calls.push(['review', data]), onGroups: data => window.calls.push(['groups', data]) });
        await window.workspace.show();
    });
    assert.equal(await page.locator('form').count(), 0);
    await page.getByRole('button', { name: 'Create class', exact: true }).click();
    await page.getByLabel('Class name').fill('6B');
    await page.getByRole('dialog').getByRole('button', { name: 'Create class' }).click();
    await page.getByRole('dialog').waitFor({ state: 'detached' });
    assert.equal((await page.evaluate(() => window.calls.find(call => call[0] === 'create')))[1].name, '6B');
    await page.getByRole('button', { name: 'Open class' }).click();
    await page.getByText('Student One', { exact: true }).waitFor();
    assert.equal(await page.getByText('Vocabulary One', { exact: true }).count(), 0);
    assert.equal(await page.evaluate(() => window.calls.filter(call => call[0] === 'assignments').length), 0);
    await page.getByRole('button', { name: 'Invite students' }).click();
    await page.getByLabel('Student emails').fill('ONE@example.org, two@example.org ONE@example.org');
    await page.getByRole('dialog').getByRole('button', { name: 'Invite students' }).click();
    await page.getByRole('dialog').waitFor({ state: 'detached' });
    assert.deepEqual(await page.evaluate(() => window.calls.find(call => call[0] === 'invite')), ['invite', 'class-a', ['one@example.org', 'two@example.org']]);
    await page.getByRole('button', { name: 'Work', exact: true }).click();
    await page.getByText('Vocabulary One', { exact: true }).waitFor();
    assert.equal(await page.getByRole('button', { name: 'Invite students' }).count(), 0);
    await page.getByRole('button', { name: 'Assign material' }).click();
    await page.getByRole('button', { name: 'Review work' }).click();
    assert.deepEqual(await page.evaluate(() => window.calls.filter(call => ['publish', 'review'].includes(call[0]))), [
        ['publish', { classId: 'class-a' }], ['review', { classId: 'class-a', assignmentId: 'work-one' }]
    ]);
    await page.evaluate(() => window.workspace.show({ classId: 'missing' }));
    await page.getByText('This class is unavailable. Choose another class.').waitFor();
    await page.evaluate(() => window.workspace.show());
    await page.getByRole('button', { name: 'Add subject' }).click();
    await page.getByLabel('Subject name').fill('Do not save');
    await page.keyboard.press('Escape');
    assert.equal(await page.getByRole('dialog').count(), 0);
    assert.equal(await page.evaluate(() => window.calls.filter(call => call[0] === 'subject').length), 0);
    await page.getByRole('button', { name: 'Add subject' }).click();
    await page.evaluate(() => window.workspace.hide());
    assert.equal(await page.getByRole('dialog').count(), 0);
    assert.equal(await page.locator('main').textContent(), '');
    await page.evaluate(() => window.workspace.show({ classId: 'class-a', tab: 'work' }));
    await page.getByText('Vocabulary One', { exact: true }).waitFor();
    await page.evaluate(async () => {
        window.workspace.destroy();
        const root = document.querySelector('main');
        const { createTeacherClassWorkspace } = await import('/js/teacherClassWorkspace.js');
        let resolve;
        const pending = new Promise(done => { resolve = done; });
        const feature = createTeacherClassWorkspace({ schoolRepository: { listYears: async () => [{ year: 2026, label: '2026', archived: false }] }, root, getUserId: () => window.classOwner,
            repository: { listClasses: () => pending, listSubjects: async () => [] } });
        const result = feature.show(); window.classOwner = 'teacher-b';
        resolve([{ id: 'private-a', name: 'Private teacher A', subject: {} }]); await result;
        if (root.textContent.includes('Private teacher A')) throw new Error('Stale account data was rendered');
        feature.destroy();
        if (root.childNodes.length) throw new Error('Destroy retained content');
    });
    console.log('Teacher class workspace smoke passed: focused tabs, dialogs, callbacks, missing class and account isolation.');
} finally { await browser?.close(); server?.kill(); }
