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
    await page.addStyleTag({ url: `${baseUrl}/css/floating-action-menu.css` });
    await page.evaluate(async () => {
        document.body.replaceChildren();
        const root = document.createElement('main'); document.body.append(root);
        window.classOwner = 'teacher-a'; window.calls = [];
        const repository = {
            async listClasses() { return window.directoryClasses || [{ id: 'class-a', canTeach: true, name: '6A', school_year: 2026, subject: { name: 'Technology' } }]; },
            async listSubjects() { return [{ id: 'subject-a', name: 'Technology' }]; },
            async getRoster(id) { window.calls.push(['roster', id]); return window.classRoster || [{ studentId: 'one', name: 'Student One', email: 'one@example.org' }]; },
            async listInvitations() { return window.classInvitations || []; },
            async listClassTeachers() { return [{ user_id: 'teacher-a', active: true }]; },
            async setClassTeacher(id, userId, active) { window.calls.push(['teacher', id, userId, active]); },
            async setClassArchived(id, archived) { window.calls.push(['archive', id, archived]); },
            async removeStudent(id, studentId) { window.calls.push(['remove', id, studentId]); },
            async listAssignments(id) { window.calls.push(['assignments', id]); return window.classWork || [{ id: 'work-one', title: 'Vocabulary One', release_at: '2026-09-01T00:00:00Z' }]; },
            async inviteStudents(id, emails) { window.calls.push(['invite', id, emails]); },
            async createClass(data) { window.calls.push(['create', data]); },
            async createSubject(name) { window.calls.push(['subject', name]); }
        };
        const { createTeacherClassWorkspace } = await import('/js/teacherClassWorkspace.js');
        window.workspace = createTeacherClassWorkspace({ schoolRepository: { listYears: async () => [{ year: 2026, label: '2026', archived: false }], listMembers: async () => [{ user_id: 'teacher-a', active: true, display_name: 'Teacher Alice', roles: ['teacher'] }] }, root, getUserId: () => window.classOwner, repository,
            getSchoolCalendar: async () => ({schoolYear:'2026',trimesters:{IT:{startDate:'2026-01-01',endDate:'2026-04-30'},IIT:{startDate:'2026-05-01',endDate:'2026-08-31'},IIIT:{startDate:'2026-09-01',endDate:'2026-12-31'}}}),
            onPublish: data => window.calls.push(['publish', data]), onReview: data => window.calls.push(['review', data]), onGroups: data => window.calls.push(['groups', data]),
            onStudent: data => window.calls.push(['student', data]) });
        await window.workspace.show();
    });
    assert.equal(await page.locator('form').count(), 0);
    await page.evaluate(async () => {
        window.directoryClasses = Array.from({ length: 23 }, (_, i) => ({ id: `class-${i}`, name: `Class ${String(i + 1).padStart(2, '0')}`,
            school_year: i < 12 ? 2026 : 2025, subject: { name: i % 2 ? 'Science' : 'Technology' }, archived: i > 19 }));
        await window.workspace.show();
    });
    await page.getByLabel('Statuses', { exact: true }).selectOption('');
    const cards = page.locator('.teacher-class-card');
    assert.equal(await cards.count(), 12);
    await page.getByRole('button', { name: 'Next classes page' }).click();
    await page.getByText('Classes 13–23 of 23', { exact: true }).waitFor();
    assert.equal(await cards.getByText('Class 01', { exact: true }).count(), 0);
    assert.equal(await cards.count(), 11);
    await page.getByLabel('Subjects', { exact: true }).selectOption('Science');
    await page.getByText('Classes 1–11 of 11', { exact: true }).waitFor();
    await page.getByLabel('Years', { exact: true }).selectOption('2025');
    await page.getByText('Classes 1–5 of 5', { exact: true }).waitFor();
    await page.getByLabel('Statuses', { exact: true }).selectOption('archived');
    await page.getByText('Classes 1–1 of 1', { exact: true }).waitFor();
    await page.getByRole('searchbox', { name: 'Search classes' }).fill('missing');
    await page.getByText('No classes match these filters.').waitFor();
    await page.getByText('Classes 0–0 of 0', { exact: true }).waitFor();
    await page.evaluate(async () => { window.directoryClasses = null; await window.workspace.show(); });
    for (const width of [1440, 768, 390]) {
        await page.setViewportSize({ width, height: 900 });
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `Classes overflow at ${width}px`);
    }
    await page.getByRole('button', { name: 'Create class', exact: true }).click();
    await page.getByLabel('Class name').fill('6B');
    await page.getByRole('dialog').getByRole('button', { name: 'Create class' }).click();
    await page.getByRole('dialog').waitFor({ state: 'detached' });
    assert.equal((await page.evaluate(() => window.calls.find(call => call[0] === 'create')))[1].name, '6B');
    await page.getByRole('button', { name: /^Open class / }).click();
    await page.getByRole('tab', { name: 'Students', exact: true }).click();
    await page.getByText('Student One', { exact: true }).waitFor();
    assert.equal(await page.getByText('Vocabulary One', { exact: true }).count(), 0);
    assert.equal(await page.evaluate(() => window.calls.filter(call => call[0] === 'assignments').length), 1);
    await page.getByRole('button', { name: 'Invite students' }).click();
    await page.getByLabel('Student emails').fill('ONE@example.org, two@example.org ONE@example.org');
    await page.getByRole('dialog').getByRole('button', { name: 'Invite students' }).click();
    await page.getByRole('dialog').waitFor({ state: 'detached' });
    assert.deepEqual(await page.evaluate(() => window.calls.find(call => call[0] === 'invite')), ['invite', 'class-a', ['one@example.org', 'two@example.org']]);
    await page.evaluate(async () => {
        const { schoolContext } = await import('/js/services/schoolContext.js');
        const { supabaseService } = await import('/js/supabaseService.js');
        window.originalGetClient = supabaseService.getClient;
        supabaseService.getClient = () => ({rpc: () => {const q = {abortSignal(){return q;},then(resolve){return Promise.resolve({data:{schools:[{id:'school-a',roles:['school_admin'],active:true}]},error:null}).then(resolve);}};return q;}});
        await schoolContext.load('teacher-a');
        window.classRoster = Array.from({length: 23}, (_, i) => ({studentId: `student-${i}`, name: `Student ${String(i + 1).padStart(2, '0')}`, email: `student${i + 1}@example.org`}));
        window.classInvitations = [{ id: 'invite', email: 'pending@example.org', expiresAt: '2099-01-01' }];
        await window.workspace.show({classId: 'class-a'});
    });
    const roster = page.getByRole('table', {name: 'Class students', exact: true});
    assert.equal(await roster.locator('tbody tr').count(), 10);
    for (const width of [1440,390,320]) {
        await page.setViewportSize({width,height:900});
        for (const student of ['Student 01','Student 10']) {
            const trigger = page.getByRole('button',{name:`Actions for ${student}`,exact:true});
            await trigger.scrollIntoViewIfNeeded();
            const before = await roster.locator('tbody tr').evaluateAll(rows => rows.map(row => ({height:row.getBoundingClientRect().height,width:row.getBoundingClientRect().width})));
            await trigger.click();
            const menu = page.getByRole('menu',{name:`Actions for ${student}`,exact:true});
            await menu.waitFor();
            await trigger.click();
            assert.equal(await page.locator('.class-student-menu:popover-open').count(),0);
            await trigger.click();
            await menu.waitFor();
            assert.deepEqual(await roster.locator('tbody tr').evaluateAll(rows => rows.map(row => ({height:row.getBoundingClientRect().height,width:row.getBoundingClientRect().width}))),before);
            const bounds = await menu.boundingBox();
            assert.ok(bounds.x >= 0 && bounds.x + bounds.width <= width && bounds.y >= 0 && bounds.y + bounds.height <= 900);
            await page.keyboard.press('ArrowDown');
            assert.equal(await page.getByRole('menuitem',{name:'Assigned work',exact:true}).evaluate(el=>el===document.activeElement),true);
            await page.keyboard.press('Escape');
            assert.equal(await page.locator('.class-student-menu:popover-open').count(),0);
            assert.equal(await trigger.evaluate(el=>el===document.activeElement),true);
            await trigger.click();
            await page.getByRole('menuitem',{name:'View profile',exact:true}).click();
            assert.deepEqual(await page.evaluate(()=>window.calls.at(-1)),['student',{classId:'class-a',studentId:student === 'Student 01' ? 'student-0' : 'student-9',tab:'overview'}]);
            await trigger.click();
            await page.getByRole('searchbox',{name:'Search students'}).click();
            assert.equal(await page.locator('.class-student-menu:popover-open').count(),0);
        }
    }
    await page.setViewportSize({width:1440,height:900});
    await page.getByRole('button', {name: 'Next students page'}).click();
    await page.getByText('Students 11–20 of 23', {exact: true}).waitFor();
    assert.equal(await roster.getByText('Student 01', {exact: true}).count(), 0);
    await page.getByRole('button', {name: 'Next students page'}).click();
    await page.getByText('Students 21–23 of 23', {exact: true}).waitFor();
    assert.equal(await roster.locator('tbody tr').count(), 3);
    await page.getByRole('searchbox', {name: 'Search students'}).fill('student1@example.org');
    await page.getByText('Students 1–1 of 1', {exact: true}).waitFor();
    for (const [label, tab] of [['View profile','overview'], ['Assigned work','assigned'], ['Activity history','activity'], ['Account and coins','account']]) {
        await page.getByRole('button', {name:'Actions for Student 01', exact:true}).click();
        await page.getByRole('menuitem', {name: label, exact: true}).click();
        assert.deepEqual(await page.evaluate(() => window.calls.at(-1)), ['student', {classId:'class-a',studentId:'student-0', tab}]);
        assert.equal(await page.locator('.class-student-menu:popover-open').count(),0);
    }
    await page.getByRole('button', {name:'Actions for Student 01', exact:true}).click();
    await page.getByRole('menuitem', {name: 'Remove from class', exact: true}).click();
    await page.getByRole('dialog', {name: 'Remove student'}).getByRole('button', {name: 'Cancel'}).click();
    assert.equal(await page.evaluate(() => window.calls.some(call => call[0] === 'remove')), false);
    await page.getByRole('button', {name:'Actions for Student 01', exact:true}).click();
    await page.getByRole('menuitem', {name: 'Remove from class', exact: true}).click();
    await page.getByRole('dialog', {name: 'Remove student'}).getByRole('button', {name: 'Remove student'}).click();
    await page.getByRole('dialog').waitFor({state:'detached'});
    assert.deepEqual(await page.evaluate(() => window.calls.find(call => call[0] === 'remove')), ['remove', 'class-a', 'student-0']);
    assert.equal(await page.getByText('pending@example.org', {exact:false}).isVisible(), false);
    await page.getByText('Invitations (1)', {exact:true}).click();
    assert.equal(await page.getByText('pending@example.org', {exact:false}).isVisible(), true);
    await page.getByRole('tab', {name: 'Class settings', exact:true}).click();
    const settings = page.getByRole('tabpanel', {name:'Class settings', exact:true});
    await settings.getByText('Teacher Alice', {exact:true}).waitFor();
    await settings.getByRole('button', {name:'Remove teacher Teacher Alice'}).click();
    await page.getByRole('tab', {name:'Class settings', exact:true}).waitFor();
    assert.deepEqual(await page.evaluate(() => window.calls.find(call => call[0] === 'teacher')), ['teacher', 'class-a', 'teacher-a', false]);
    await page.getByRole('tab', {name: 'Class settings', exact:true}).click();
    await settings.getByRole('button', {name:'Archive class', exact:true}).click();
    await page.getByRole('dialog', {name:'Archive class'}).getByRole('button', {name:'Archive class'}).click();
    await page.getByRole('dialog').waitFor({state:'detached'});
    assert.deepEqual(await page.evaluate(() => window.calls.find(call => call[0] === 'archive')), ['archive', 'class-a', true]);
    for (const width of [1440, 768, 390]) {
        await page.setViewportSize({width,height:900});
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true, `Roster overflow at ${width}px`);
    }
    await page.evaluate(async () => {
        const {schoolContext} = await import('/js/services/schoolContext.js'); schoolContext.clear(); const {supabaseService} = await import('/js/supabaseService.js'); supabaseService.getClient = window.originalGetClient;
        window.classRoster = null; window.classInvitations = null;
        await window.workspace.show({classId:'class-a'});
    });
    await page.getByRole('tab', { name: 'Classwork', exact: true }).click();
    await page.getByText('Vocabulary One', { exact: true }).waitFor();
    assert.equal(await page.getByRole('button', { name: 'Invite students' }).count(), 0);
    await page.getByRole('button', { name: 'Assign material' }).click();
    await page.getByRole('button', { name: 'Review work Vocabulary One' }).click();
    assert.deepEqual(await page.evaluate(() => window.calls.filter(call => ['publish', 'review'].includes(call[0]))), [
        ['publish', { classId: 'class-a' }], ['review', { classId: 'class-a', assignmentId: 'work-one' }]
    ]);
    await page.evaluate(async () => {
        window.classWork = Array.from({length:23}, (_,i) => ({id:`work-${i}`,kind:i%2?'spark':'vocabulary',title:`Work ${String(i+1).padStart(2,'0')}`,release_at:i===0?'2099-01-01T00:00:00Z':'2026-09-01T00:00:00Z',due_at:i===0?null:'2026-10-20T12:00:00Z',withdrawn:i===1}));
        await window.workspace.show({classId:'class-a',tab:'work'});
    });
    const workTable = page.getByRole('table', {name:'Class work',exact:true});
    assert.equal(await workTable.locator('tbody tr').count(),10);
    await workTable.getByText('Scheduled',{exact:false}).waitFor();
    assert.equal(await workTable.getByText('Withdrawn',{exact:true}).count(),0);
    assert.equal(await workTable.getByRole('columnheader',{name:'When',exact:true}).count(),1);
    assert.equal(await workTable.locator('tbody tr').filter({hasText:'Work 02'}).locator('td').nth(1).textContent(),'Due Oct 20');
    await page.getByLabel('Trimester',{exact:true}).selectOption('3');
    await page.getByText('Work 1–10 of 22',{exact:true}).waitFor();
    assert.equal(await workTable.getByText('Scheduled',{exact:false}).count(),0);
    await page.getByLabel('Trimester',{exact:true}).selectOption('outside');
    await page.getByText('Work 1–1 of 1',{exact:true}).waitFor();
    await page.getByLabel('Trimester',{exact:true}).selectOption('all');

    await page.getByLabel('Type',{exact:true}).selectOption('spark');
    await page.getByText('Work 1–10 of 11',{exact:true}).waitFor();
    await page.getByLabel('Sort',{exact:true}).selectOption('title-desc');
    assert.equal(await workTable.locator('tbody th').first().textContent(),'Work 22');
    await page.getByLabel('Status',{exact:true}).selectOption('Withdrawn');
    await page.getByText('Work 1–1 of 1',{exact:true}).waitFor();
    await page.getByLabel('Status',{exact:true}).selectOption('all');
    await page.getByLabel('Type',{exact:true}).selectOption('all');
    await page.getByLabel('Sort',{exact:true}).selectOption('release-desc');

    await page.getByRole('button',{name:'Next work page'}).click();
    await page.getByText('Work 11–20 of 23',{exact:true}).waitFor();
    assert.equal(await workTable.getByText('Work 01',{exact:true}).count(),0);
    await page.getByRole('button',{name:'Next work page'}).click();
    await page.getByText('Work 21–23 of 23',{exact:true}).waitFor();
    assert.equal(await workTable.locator('tbody tr').count(),3);
    await page.getByRole('searchbox',{name:'Search work'}).fill('Work 02');
    await page.getByText('Work 1–1 of 1',{exact:true}).waitFor();
    await page.getByRole('button',{name:'Review work Work 02',exact:true}).click();
    assert.deepEqual(await page.evaluate(()=>window.calls.filter(call=>call[0]==='review').at(-1)),['review',{classId:'class-a',assignmentId:'work-1'}]);
    await page.getByRole('searchbox',{name:'Search work'}).fill('missing');
    await page.getByText('No work matches your search.').waitFor();
    await page.getByRole('tab',{name:'Classwork',exact:true}).focus();
    await page.keyboard.press('ArrowRight');
    assert.equal(await page.getByRole('tab',{name:'Students',exact:true}).evaluate(n=>n===document.activeElement),true);
    await page.keyboard.press('Enter');
    await page.getByRole('table',{name:'Class students',exact:true}).waitFor();
    assert.equal(await page.getByRole('tab',{name:'Students',selected:true}).count(),1);
    await page.evaluate(()=>{window.classWork=null;});
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
    await page.evaluate(async () => {
        const {createTeacherClassWorkspace} = await import('/js/teacherClassWorkspace.js');
        const {schoolContext} = await import('/js/services/schoolContext.js');
        const {supabaseService} = await import('/js/supabaseService.js');
        window.savedClient = supabaseService.getClient;
        supabaseService.getClient = () => ({rpc: () => {const q = {abortSignal(){return q;},then(resolve){return Promise.resolve({data:{schools:[{id:'school-a',roles:['school_admin'],active:true}]},error:null}).then(resolve);}};return q;}});
        await schoolContext.load('teacher-b');
        window.loadingResolvers = {};
        const delayed = key => new Promise((resolve,reject) => {window.loadingResolvers[key] = {resolve,reject};});
        window.loadingWorkspace = createTeacherClassWorkspace({root:document.querySelector('main'),getUserId:()=>window.classOwner,
            repository:{listClasses:()=>delayed('classes'),listSubjects:async()=>[],getRoster:()=>delayed('students'),listInvitations:async()=>[],listAssignments:()=>delayed('work'),listClassTeachers:async()=>[]},
            schoolRepository:{listYears:async()=>[],listMembers:()=>delayed('settings')}});
        window.loadingWorkspace.show();
    });
    await page.locator('.class-workspace-loading[data-loading-section="classes"] .class-loading-skeleton').waitFor();
    assert.equal(await page.getByText('Loading classes…',{exact:true}).count(),0);
    assert.equal(await page.locator('main').getAttribute('aria-busy'),'true');
    await page.evaluate(()=>window.loadingResolvers.classes.resolve([{id:'loading-class',name:'Loading test',school_year:2026}]));
    await page.getByText('Classes 1–1 of 1',{exact:true}).waitFor();
    assert.equal(await page.locator('main').getAttribute('aria-busy'),'false');
    await page.evaluate(()=>{window.loadingWorkspace.show({classId:'loading-class'});});
    await page.locator('.class-workspace-loading[data-loading-section="students"] .class-loading-skeleton').waitFor();
    assert.equal(await page.getByText('Loading students…',{exact:true}).count(),0);
    assert.equal(await page.getByRole('tab',{name:'Students',selected:true}).count(),1);
    await page.getByRole('tab',{name:'Classwork',exact:true}).click();
    await page.locator('.class-workspace-loading[data-loading-section="work"] .class-loading-skeleton').waitFor();
    assert.equal(await page.getByText('Loading work…',{exact:true}).count(),0);
    await page.evaluate(()=>window.loadingResolvers.students.resolve([{studentId:'stale',name:'Stale student',email:'stale@example.org'}]));
    assert.equal(await page.getByText('Stale student',{exact:true}).count(),0);
    await page.evaluate(()=>window.loadingResolvers.work.reject(new Error('Work request failed')));
    await page.getByText('Work request failed',{exact:true}).waitFor();
    assert.equal(await page.locator('.class-workspace-loading').count(),0);
    assert.equal(await page.locator('main').getAttribute('aria-busy'),'false');
    await page.getByRole('button',{name:'Try again',exact:true}).click();
    await page.locator('.class-workspace-loading[data-loading-section="work"] .class-loading-skeleton').waitFor();
    await page.evaluate(()=>window.loadingResolvers.classes.resolve([{id:'loading-class',name:'Loading test',school_year:2026}]));
    await page.locator('.class-workspace-loading[data-loading-section="work"] .class-loading-skeleton').waitFor();
    await page.evaluate(()=>window.loadingResolvers.work.resolve([]));
    await page.getByText('No work has been assigned to this class.',{exact:true}).waitFor();
    await page.getByRole('tab',{name:'Class settings',exact:true}).click();
    await page.locator('.class-workspace-loading[data-loading-section="settings"] .class-loading-skeleton').waitFor();
    assert.equal(await page.getByText('Loading class settings…',{exact:true}).count(),0);
    assert.equal(await page.getByRole('tab',{name:'Classwork',exact:true}).isEnabled(),true);
    await page.evaluate(()=>window.loadingWorkspace.hide());
    await page.evaluate(()=>window.loadingResolvers.settings.resolve([{user_id:'private',display_name:'Private teacher',active:true,roles:['teacher']}]));
    assert.equal(await page.locator('main').textContent(),'');
    await page.evaluate(async()=>{const {schoolContext}=await import('/js/services/schoolContext.js');schoolContext.clear();const {supabaseService}=await import('/js/supabaseService.js');supabaseService.getClient=window.savedClient;window.loadingWorkspace.destroy();});
    console.log('Teacher class workspace smoke passed: focused tabs, dialogs, callbacks, missing class and account isolation.');
} finally { await browser?.close(); server?.kill(); }
