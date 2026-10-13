import { schoolRepository } from './services/schoolRepository.js';
import { schoolContext } from './services/schoolContext.js';
import '../css/school-admin.css';

function element(tag, text, className) {
    const node = document.createElement(tag);
    if (text !== undefined) node.textContent = text;
    if (className) node.className = className;
    return node;
}

export function createSchoolAdminView({ root, context = schoolContext, repository = schoolRepository }) {
    let generation = 0, controller, destroyed = false;
    let memberScope, memberSearch = '', memberOffset = 0, activeSection = 'members';
    const memberPageSize = 25;
    const status = element('p', '', 'inline-status');
    status.setAttribute('role', 'status');
    const current = (run, account, school) => !destroyed && generation === run && account === context.getAccountId() && school === context.getSchoolId();
    const unsubscribe = context.subscribe(() => { controller?.abort(); generation++; root.replaceChildren(); });
    function button(label, action) {
        const node = element('button', label, 'btn secondary-btn'); node.type = 'button';
        const run = generation, account = context.getAccountId(), school = context.getSchoolId();
        node.addEventListener('click', async () => {
            if (node.disabled || !current(run, account, school)) return;
            node.disabled = true;
            try { await action(); }
            catch (error) { if (current(run, account, school)) status.textContent = error.message || 'Could not complete this action.'; }
            finally { node.disabled = false; }
        });
        return node;
    }
    function field(form, label, value = '', type = 'text') {
        const wrapper = element('label', label, 'school-admin-field');
        const input = element('input'); input.type = type; input.value = value; input.required = true;
        wrapper.append(input); form.append(wrapper); return input;
    }
    function roleFields(form, initial = []) {
        const group = element('fieldset'); group.append(element('legend', 'School roles'));
        const controls = ['school_admin', 'teacher', 'student'].map(role => {
            const label = element('label', role === 'school_admin' ? 'School administrator' : role === 'teacher' ? 'Teacher' : 'Student');
            const input = element('input'); input.type = 'checkbox'; input.checked = initial.includes(role);
            label.prepend(input); group.append(label); return [role, input];
        });
        form.append(group); return () => controls.filter(([, input]) => input.checked).map(([role]) => role);
    }
    function form(title, submitLabel, build, { disclosure = false } = {}) {
        const node = element('form', undefined, 'school-admin-form'); node.append(element('h3', title));
        const run = generation, account = context.getAccountId(), school = context.getSchoolId();
        const action = build(node);
        const submit = element('button', submitLabel, 'btn primary-btn'); submit.type = 'submit'; node.append(submit);
        node.addEventListener('submit', async event => {
            event.preventDefault();
            if (submit.disabled || !current(run, account, school)) return;
            submit.disabled = true; status.textContent = 'Saving…';
            try { await action(); if (current(run, account, school)) { await context.load(account); await show(); } }
            catch (error) { if (current(run, account, school)) status.textContent = error.message || 'Could not save changes.'; }
            finally { submit.disabled = false; }
        });
        if (!disclosure) return node;
        const details = element('details', undefined, 'school-admin-editor');
        details.append(element('summary', title), node); return details;
    }
    async function refreshAfter(action) {
        const account = context.getAccountId(), school = context.getSchoolId(), run = generation;
        await action();
        if (!current(run, account, school)) return;
        await context.load(account); if (!destroyed && account === context.getAccountId()) await show();
    }
    async function show() {
        if (destroyed) return;
        controller?.abort(); controller = new AbortController();
        const run = ++generation, account = context.getAccountId(), schoolId = context.getSchoolId();
        const access = context.getAccess(), school = context.getSchool();
        const scope = JSON.stringify([account, schoolId]);
        if (memberScope !== scope) { memberScope = scope; memberSearch = ''; memberOffset = 0; activeSection = school?.onboardingPending ? 'invitations' : 'members'; }
        root.classList.add('school-admin'); root.replaceChildren(element('h2', 'Schools and administration'), status);
        status.textContent = 'Loading…';
        const chooser = element('label', 'School ', 'school-admin-field'), select = element('select');
        select.setAttribute('aria-label', 'School');
        for (const item of access.schools) {
            const option = element('option', `${item.name}${item.onboardingPending ? ' (awaiting administrator)' : item.active === false ? ' (suspended)' : ''}`); option.value = item.id; select.append(option);
        }
        select.value = schoolId || ''; select.disabled = access.schools.length === 0;
        select.addEventListener('change', () => { if (current(run, account, schoolId)) { context.select(select.value); void show(); } });
        chooser.append(select);
        const toolbar = element('div', undefined, 'school-admin-toolbar');
        toolbar.append(chooser, button('Refresh access', () => refreshAfter(() => Promise.resolve()))); root.append(toolbar);
        const content = element('div', undefined, 'school-admin-content'); root.append(content);
        const panels = new Map();
        function append(section, ...nodes) {
            if (!panels.has(section)) {
                const panel = element('section', undefined, 'school-admin-panel');
                panel.id = `school-admin-${section}`; panels.set(section, panel);
            }
            panels.get(section).append(...nodes);
        }
        function renderSections() {
            const labels = { members: 'Members', invitations: 'Invitations', years: 'Academic years', history: 'History', platform: 'Platform administration' };
            const keys = Object.keys(labels).filter(key => panels.has(key));
            if (!keys.length) return;
            if (!keys.includes(activeSection)) activeSection = keys[0];
            const nav = element('nav', undefined, 'secondary-tabs school-admin-sections');
            nav.setAttribute('role', 'tablist'); nav.setAttribute('aria-label', 'School administration sections');
            const tabs = new Map();
            function selectSection(key, focus = false) {
                activeSection = key;
                for (const [name, panel] of panels) {
                    panel.hidden = name !== key;
                    const tab = tabs.get(name); tab.classList.toggle('active', name === key);
                    tab.setAttribute('aria-selected', String(name === key)); tab.tabIndex = name === key ? 0 : -1;
                }
                if (focus) tabs.get(key).focus();
            }
            for (const key of keys) {
                const tab = button(labels[key], () => selectSection(key));
                tab.className = 'secondary-tab'; tab.id = `school-admin-tab-${key}`;
                tab.setAttribute('role', 'tab'); tab.setAttribute('aria-controls', panels.get(key).id);
                panels.get(key).setAttribute('role', 'tabpanel'); panels.get(key).setAttribute('aria-labelledby', tab.id);
                tab.addEventListener('keydown', event => {
                    const index = keys.indexOf(key);
                    const next = event.key === 'ArrowRight' ? keys[(index + 1) % keys.length]
                        : event.key === 'ArrowLeft' ? keys[(index + keys.length - 1) % keys.length]
                        : event.key === 'Home' ? keys[0] : event.key === 'End' ? keys.at(-1) : null;
                    if (next && current(run, account, schoolId)) { event.preventDefault(); selectSection(next, true); }
                });
                tabs.set(key, tab); nav.append(tab);
            }
            content.append(nav, ...keys.map(key => panels.get(key))); selectSection(activeSection);
        }
        try {
            const opts = { signal: controller.signal };
            const canManage = Boolean(school && (access.platformAdmin || school.roles.includes('school_admin')));
            const canManageYears = school?.active !== false && school?.roles.includes('school_admin');
            const [invitations, memberPage, pending, audit, admins, years] = await Promise.all([
                repository.listMyInvitations(opts), canManage ? repository.listMembersPage(schoolId, { ...opts, search: memberSearch, limit: memberPageSize, offset: memberOffset }) : { members: [], total: 0 },
                canManage ? repository.listInvitations(schoolId, opts) : [],
                canManage || access.platformAdmin ? repository.listAudit(canManage ? schoolId : null, opts) : [],
                access.platformAdmin ? repository.listPlatformAdmins(opts) : [],
                canManageYears ? repository.listYears(schoolId, opts) : []
            ]);
            if (!current(run, account, schoolId)) return;
            status.textContent = '';
            if (invitations.length) {
                const section = element('section'); section.append(element('h3', 'Your invitations'));
                for (const invitation of invitations) {
                    const row = element('p', `${invitation.school_name}: ${(invitation.roles || []).join(', ')} `);
                    row.append(button('Accept invitation', () => refreshAfter(() => repository.acceptInvitation(invitation.id)))); section.append(row);
                }
                append('invitations', section);
            }
            if (!school) append('members', element('p', 'You have no school memberships. A school administrator can invite your verified email address.'));
            if (access.platformAdmin) {
                append('platform', form('Create school and invite administrator', 'Create school and invite administrator', node => {
                    const name = field(node, 'School name'), timezone = field(node, 'Timezone', 'America/Panama');
                    const admin = field(node, 'First administrator email', '', 'email');
                    node.append(element('p', 'The school opens when its administrator verifies this email and accepts the invitation. Share the app link with them; this action does not send an invitation email.'));
                    let requestId, requestSignature;
                    return () => {
                        const signature = JSON.stringify([name.value.trim(), timezone.value, admin.value.trim().toLowerCase()]);
                        if (signature !== requestSignature) { requestSignature = signature; requestId = crypto.randomUUID(); }
                        return repository.createSchool({ name: name.value, timezone: timezone.value, adminEmail: admin.value, requestId });
                    };
                }));
                if (school?.onboardingPending) {
                    append('platform', element('p', 'Awaiting the first administrator. Membership and teaching remain unavailable until they accept.'));
                    append('platform', button('Cancel school onboarding', () => refreshAfter(() => repository.setSchoolActive(schoolId, false))));
                } else if (school) append('platform', button(school.active === false ? 'Reactivate school' : 'Suspend school', () => refreshAfter(() => repository.setSchoolActive(schoolId, school.active === false))));
                append('platform', form('Grant platform administration', 'Grant access', node => {
                    const user = field(node, 'Account ID'); return () => repository.setPlatformAdmin(user.value.trim(), true);
                }));
                const list = element('section'); list.append(element('h3', 'Platform administrators'));
                for (const admin of admins) {
                    const row = element('p', `${admin.display_name || admin.email || admin.user_id} `);
                    if (admin.active !== false) row.append(button('Revoke platform access', () => refreshAfter(() => repository.setPlatformAdmin(admin.user_id, false))));
                    list.append(row);
                }
                append('platform', list);
            }
            if (canManageYears) {
                append('years', form('Add academic year', 'Save academic year', node => {
                    const year = field(node, 'Year', String(new Date().getFullYear()), 'number'); year.min = '2020'; year.max = '2200';
                    const label = field(node, 'Year label', String(new Date().getFullYear()));
                    return () => repository.setYear(schoolId, Number(year.value), label.value, false);
                }));
                const yearList = element('section'); yearList.append(element('h3', 'Academic years'));
                if (!years.length) yearList.append(element('p', 'Add an academic year before creating classes.'));
                for (const year of years) {
                    const row = element('p', `${year.label} (${year.year})${year.archived ? ' · Archived' : ''} `);
                    row.append(button(year.archived ? 'Reopen academic year' : 'Archive academic year', () => refreshAfter(() => repository.setYear(schoolId, year.year, year.label, !year.archived))));
                    yearList.append(row);
                }
                append('years', yearList);
            }
            if (canManage) {
                if (school.onboardingPending) {
                    append('invitations', form('Replace first administrator invitation', 'Replace invitation', node => {
                        const email = field(node, 'Administrator email', '', 'email');
                        node.append(element('p', 'This revokes the previous invitation. Share the app link with the new administrator; no invitation email is sent.'));
                        return () => repository.replaceInitialAdminInvitation(schoolId, email.value);
                    }));
                } else {
                    append('invitations', form('Invite school member', 'Create invitation', node => {
                        const email = field(node, 'Email', '', 'email'), roles = roleFields(node, ['teacher']);
                        node.append(element('p', 'The invitation appears after the recipient signs in with this verified email.'));
                        return () => repository.inviteMember(schoolId, email.value, roles());
                    }));
                    append('members', form('Add an existing account', 'Save membership', node => {
                        const id = field(node, 'Account ID'), roles = roleFields(node, ['teacher']);
                        return () => repository.setMember(schoolId, id.value.trim(), roles(), true);
                    }, { disclosure: true }));
                }
                const list = element('section'); list.append(element('h3', 'School members'));
                const members = memberPage.members;
                const searchForm = element('form', undefined, 'school-admin-search');
                const search = field(searchForm, 'Search members by name or email', memberSearch, 'search');
                search.required = false; search.maxLength = 200;
                const searchButton = element('button', 'Search members', 'btn secondary-btn'); searchButton.type = 'submit'; searchForm.append(searchButton);
                searchForm.addEventListener('submit', event => {
                    event.preventDefault(); if (!current(run, account, schoolId)) return;
                    memberSearch = search.value.trim(); memberOffset = 0; void show();
                });
                list.append(searchForm);
                const start = members.length ? memberOffset + 1 : 0;
                list.append(element('p', `Members ${start}–${members.length ? memberOffset + members.length : 0} of ${memberPage.total}`));
                const previous = button('Previous members', () => { memberOffset = Math.max(0, memberOffset - memberPageSize); return show(); });
                previous.disabled = memberOffset === 0;
                const next = button('Next members', () => { memberOffset += memberPageSize; return show(); });
                next.disabled = memberOffset + members.length >= memberPage.total;
                const pagination = element('nav', undefined, 'school-admin-toolbar');
                pagination.setAttribute('aria-label', 'School member pages'); pagination.append(previous, next); list.append(pagination);
                if (!members.length) list.append(element('p', memberSearch ? 'No members match this search.' : 'No school members.'));
                for (const member of members) {
                    list.append(form(`${member.display_name || member.email || member.user_id}${member.active ? '' : ' (inactive)'}`, 'Save member', node => {
                        const roles = roleFields(node, member.roles);
                        const grade = field(node, 'Grade', member.grade || '');
                        const section = field(node, 'Section', member.section || '');
                        for (const input of [grade, section]) { input.required = false; input.maxLength = 50; }
                        const placement = () => ({ grade: grade.value.trim() || null, section: section.value.trim() || null });
                        node.append(button(member.active ? 'Remove from school' : 'Restore membership', () => refreshAfter(() => repository.setMember(schoolId, member.user_id, roles(), !member.active, placement()))));
                        return () => repository.setMember(schoolId, member.user_id, roles(), member.active, placement());
                    }, { disclosure: true }));
                }
                append('members', list);
                const inviteList = element('section'); inviteList.append(element('h3', 'School invitations'));
                for (const invite of pending) {
                    const row = element('p', `${invite.email} · ${(invite.roles || []).join(', ')} `);
                    if (!invite.revoked_at && !invite.accepted_at) row.append(button('Revoke invitation', () => refreshAfter(() => repository.revokeInvitation(invite.id))));
                    inviteList.append(row);
                }
                append('invitations', inviteList);
            }
            if (canManage || access.platformAdmin) {
                const events = element('section'); events.append(element('h3', 'Administration history'));
                if (!audit.length) events.append(element('p', 'No administrative events.'));
                for (const event of audit) {
                    const row = element('details', undefined, 'school-admin-editor');
                    row.append(element('summary', `${event.created_at ? new Date(event.created_at).toLocaleString() : 'Date unavailable'} · ${(event.action || 'Administrative change').replaceAll('.', ' ')}`), element('pre', JSON.stringify(event, null, 2)));
                    events.append(row);
                }
                append('history', events);
            }
            renderSections();
        } catch (error) { if (current(run, account, schoolId)) status.textContent = error.message || 'Could not load school administration.'; }
    }
    return Object.freeze({ show, destroy() { destroyed = true; generation++; controller?.abort(); unsubscribe(); root.replaceChildren(); } });
}
