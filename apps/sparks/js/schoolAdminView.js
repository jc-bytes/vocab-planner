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
    let memberScope, memberSearch = '', memberOffset = 0;
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
    function form(title, submitLabel, build) {
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
        return node;
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
        if (memberScope !== scope) { memberScope = scope; memberSearch = ''; memberOffset = 0; }
        root.classList.add('school-admin'); root.replaceChildren(element('h2', 'Schools and administration'), status);
        status.textContent = 'Loading…';
        const chooser = element('label', 'School ', 'school-admin-field'), select = element('select');
        select.setAttribute('aria-label', 'School');
        for (const item of access.schools) {
            const option = element('option', `${item.name}${item.onboardingPending ? ' (awaiting administrator)' : item.active === false ? ' (suspended)' : ''}`); option.value = item.id; select.append(option);
        }
        select.value = schoolId || ''; select.disabled = access.schools.length === 0;
        select.addEventListener('change', () => { if (current(run, account, schoolId)) { context.select(select.value); void show(); } });
        chooser.append(select); root.append(chooser);
        root.append(button('Refresh access', () => refreshAfter(() => Promise.resolve())));
        const content = element('div', undefined, 'school-admin-content'); root.append(content);
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
                content.append(section);
            }
            if (!school) content.append(element('p', 'You have no school memberships. A school administrator can invite your verified email address.'));
            if (access.platformAdmin) {
                content.append(form('Create school and invite administrator', 'Create school and invite administrator', node => {
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
                    content.append(element('p', 'Awaiting the first administrator. Membership and teaching remain unavailable until they accept.'));
                    content.append(button('Cancel school onboarding', () => refreshAfter(() => repository.setSchoolActive(schoolId, false))));
                } else if (school) content.append(button(school.active === false ? 'Reactivate school' : 'Suspend school', () => refreshAfter(() => repository.setSchoolActive(schoolId, school.active === false))));
                content.append(form('Grant platform administration', 'Grant access', node => {
                    const user = field(node, 'Account ID'); return () => repository.setPlatformAdmin(user.value.trim(), true);
                }));
                const list = element('section'); list.append(element('h3', 'Platform administrators'));
                for (const admin of admins) {
                    const row = element('p', `${admin.display_name || admin.email || admin.user_id} `);
                    if (admin.active !== false) row.append(button('Revoke platform access', () => refreshAfter(() => repository.setPlatformAdmin(admin.user_id, false))));
                    list.append(row);
                }
                content.append(list);
            }
            if (canManageYears) {
                content.append(form('Add academic year', 'Save academic year', node => {
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
                content.append(yearList);
            }
            if (canManage) {
                if (school.onboardingPending) {
                    content.append(form('Replace first administrator invitation', 'Replace invitation', node => {
                        const email = field(node, 'Administrator email', '', 'email');
                        node.append(element('p', 'This revokes the previous invitation. Share the app link with the new administrator; no invitation email is sent.'));
                        return () => repository.replaceInitialAdminInvitation(schoolId, email.value);
                    }));
                } else {
                    content.append(form('Invite school member', 'Create invitation', node => {
                        const email = field(node, 'Email', '', 'email'), roles = roleFields(node, ['teacher']);
                        node.append(element('p', 'The invitation appears after the recipient signs in with this verified email.'));
                        return () => repository.inviteMember(schoolId, email.value, roles());
                    }));
                    content.append(form('Add an existing account', 'Save membership', node => {
                        const id = field(node, 'Account ID'), roles = roleFields(node, ['teacher']);
                        return () => repository.setMember(schoolId, id.value.trim(), roles(), true);
                    }));
                }
                const list = element('section'); list.append(element('h3', 'School members'));
                const members = memberPage.members;
                const searchForm = element('form');
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
                list.append(previous, next);
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
                    }));
                }
                content.append(list);
                const inviteList = element('section'); inviteList.append(element('h3', 'School invitations'));
                for (const invite of pending) {
                    const row = element('p', `${invite.email} · ${(invite.roles || []).join(', ')} `);
                    if (!invite.revoked_at && !invite.accepted_at) row.append(button('Revoke invitation', () => refreshAfter(() => repository.revokeInvitation(invite.id))));
                    inviteList.append(row);
                }
                content.append(inviteList);
            }
            if (canManage || access.platformAdmin) {
                const events = element('section'); events.append(element('h3', 'Administration history'));
                if (!audit.length) events.append(element('p', 'No administrative events.'));
                for (const event of audit) events.append(element('p', `${event.created_at || ''} · ${event.action || ''} · ${event.target_user_id || event.target_id || ''}`));
                content.append(events);
            }
        } catch (error) { if (current(run, account, schoolId)) status.textContent = error.message || 'Could not load school administration.'; }
    }
    return Object.freeze({ show, destroy() { destroyed = true; generation++; controller?.abort(); unsubscribe(); root.replaceChildren(); } });
}
