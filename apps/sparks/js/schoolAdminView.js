import { createSchoolAdminLoading } from './schoolAdminLoading.js';
import { schoolRepository } from './services/schoolRepository.js';
import { schoolContext } from './services/schoolContext.js';
import { ACADEMIC_TRIMESTERS, getAcademicYearCalendar, withAcademicYearCalendar } from './services/academicYearCalendar.js';
import { calculateCalendarWeekCount } from './services/schoolCalendar.js';
import { parseUtcDateOnly } from './services/dateOnly.js';
import { renderPlatformAdministration } from './platformAdministrationView.js';
import '../css/school-admin.css';

function element(tag, text, className) {
    const node = document.createElement(tag);
    if (text !== undefined) node.textContent = text;
    if (className) node.className = className;
    return node;
}

export function createSchoolAdminView({ root, context = schoolContext, repository = schoolRepository, mode = 'school', onCalendarSaved, onOpenSchool, getCurrentUser = () => null }) {
    const platformMode = mode === 'platform';
    let generation = 0, controller, destroyed = false, closeDialog, refreshTicket;
    let memberScope, memberSearch = '', memberRole = '', activeSection = 'members';
    const memberPageSize = 10;
    const status = element('p', '', 'inline-status');
    status.setAttribute('role', 'status');
    const current = (run, account, school) => !destroyed && generation === run && account === context.getAccountId() && school === context.getSchoolId();
    const clearLoading = () => { root.removeAttribute('aria-busy'); root.querySelector('.school-admin-loading')?.remove(); };
    const showRefreshLoading = () => {
        status.textContent = '';
        root.setAttribute('aria-busy', 'true');
        root.replaceChildren(status, createSchoolAdminLoading({ platform: platformMode, section: activeSection }));
    };
    const unsubscribe = context.subscribe(() => {
        closeDialog?.(); controller?.abort(); generation++; clearLoading(); root.replaceChildren();
        if (refreshTicket && !destroyed && refreshTicket.account === context.getAccountId()) showRefreshLoading();
    });
    function button(label, action, isDisabled = () => false) {
        const node = element('button', label, 'btn secondary-btn'); node.type = 'button';
        const run = generation, account = context.getAccountId(), school = context.getSchoolId();
        node.addEventListener('click', async () => {
            if (node.disabled || !current(run, account, school)) return;
            node.disabled = true;
            try { await action(); }
            catch (error) { if (current(run, account, school)) status.textContent = error.message || 'Could not complete this action.'; }
            finally { node.disabled = isDisabled(); }
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
        const submit = element('button', submitLabel, 'btn primary-btn'); submit.type = 'submit';
        const actions = element('div', undefined, 'school-admin-actions');
        actions.append(submit, ...node.querySelectorAll(':scope > button')); node.append(actions);
        node.addEventListener('submit', async event => {
            event.preventDefault();
            if (!node.isConnected || submit.disabled || !current(run, account, school)) return;
            const feedback = node.querySelector('.school-admin-form-status') || status;
            submit.disabled = true; feedback.textContent = 'Saving…';
            try { await action(); if (current(run, account, school)) { await context.load(account); await show(); } }
            catch (error) { if (node.isConnected && current(run, account, school)) feedback.textContent = error.message || 'Could not save changes.'; }
            finally { submit.disabled = false; }
        });
        return node;
    }
    function openFormDialog(title, content, opener) {
        closeDialog?.();
        const dialog = element('dialog', undefined, 'school-admin-invite-dialog'); dialog.setAttribute('aria-label', title);
        const close = () => {
            if (!dialog.isConnected) return;
            dialog.close(); dialog.remove();
            if (opener?.isConnected) opener.focus();
        };
        closeDialog = close;
        const cancel = element('button', 'Cancel', 'btn secondary-btn'); cancel.type = 'button'; cancel.addEventListener('click', close);
        content.querySelector('.school-admin-actions').prepend(cancel);
        dialog.addEventListener('cancel', event => { event.preventDefault(); close(); });
        dialog.append(content); root.append(dialog); dialog.showModal();
    }
    async function refreshAfter(action) {
        const account = context.getAccountId(), school = context.getSchoolId(), run = generation;
        await action();
        if (!current(run, account, school)) return;
        const ticket = refreshTicket = { account };
        showRefreshLoading();
        try {
            await context.load(account);
            if (!destroyed && refreshTicket === ticket && account === context.getAccountId()) await show();
        } catch (error) {
            if (!destroyed && refreshTicket === ticket && account === context.getAccountId()) {
                clearLoading();
                status.textContent = error.message || 'Could not refresh access. Please try again.';
                root.replaceChildren(status, button('Retry', () => refreshAfter(() => Promise.resolve())));
            }
        } finally { if (refreshTicket === ticket) refreshTicket = null; }
    }
    async function show() {
        if (destroyed) return;
        closeDialog?.();
        refreshTicket = null;
        clearLoading();
        controller?.abort(); controller = new AbortController();
        const run = ++generation, account = context.getAccountId(), schoolId = context.getSchoolId();
        const access = context.getAccess(), school = context.getSchool();
        const scope = JSON.stringify([account, schoolId]);
        if (memberScope !== scope) { memberScope = scope; memberSearch = ''; memberRole = ''; activeSection = 'members'; }
        root.classList.add('school-admin'); root.classList.toggle('school-admin--school', !platformMode); root.classList.toggle('school-admin--platform', platformMode);
        const heading = element('h2', platformMode ? 'Platform administration' : 'School settings', 'school-admin-control-label');
        const header = element('div', undefined, 'school-admin-header school-admin-header--compact'); header.append(heading);
        root.replaceChildren(header, status);
        if (platformMode && !access.platformAdmin) { status.textContent = 'Platform administration access denied.'; return; }
        status.textContent = '';
        root.setAttribute('aria-busy', 'true');
        const toolbar = element('div', undefined, 'school-admin-toolbar');
        const refreshAccess = button('Refresh access', () => refreshAfter(() => Promise.resolve()));
        if (!platformMode) toolbar.append(refreshAccess);
        header.append(toolbar);
        const content = element('div', undefined, 'school-admin-content'); root.append(content);
        const loading = createSchoolAdminLoading({ platform: platformMode, section: activeSection, toolbar });
        refreshAccess.disabled = true;
        content.append(loading);
        try {
            const opts = { signal: controller.signal };
            const canManage = Boolean(!platformMode && school && (access.platformAdmin || school.roles.includes('school_admin')));
            const canManageYears = !platformMode && school?.active !== false && school?.roles.includes('school_admin');
            const filters = { search: memberSearch, role: memberRole };
            let rosterPromise;
            const loadRoster = () => rosterPromise ||= repository.listMembers(schoolId, opts);
            let filteredMembers;
            const readMembersPage = async offset => {
                if (!filters.role) return repository.listMembersPage(schoolId, { ...opts, search: filters.search, limit: memberPageSize, offset });
                // The existing full-roster API enforces the same school authorization.
                // Filter before slicing so a role search includes members beyond the first page.
                if (!filteredMembers) filteredMembers = loadRoster().then(members => {
                    const query = filters.search.toLowerCase();
                    return members.filter(member => (member.roles || []).includes(filters.role)
                        && (!query || (member.display_name || '').toLowerCase().includes(query) || (member.email || '').toLowerCase().includes(query)));
                });
                const matched = await filteredMembers;
                return { members: matched.slice(offset, offset + memberPageSize), total: matched.length };
            };
            const [invitations, memberPage, pending, audit, admins, years, schoolSettings] = await Promise.all([
                platformMode ? [] : repository.listMyInvitations(opts), canManage ? readMembersPage(0) : { members: [], total: 0 },
                canManage ? repository.listInvitations(schoolId, opts) : [],
                canManage || platformMode ? repository.listAudit(platformMode ? null : schoolId, opts) : [],
                platformMode ? repository.listPlatformAdmins(opts) : [],
                canManageYears ? repository.listYears(schoolId, opts) : [],
                canManageYears ? repository.getSettings(schoolId, opts) : {}
            ]);
            if (!current(run, account, schoolId)) return;
            status.textContent = '';
            content.replaceChildren();
            const navigation = element('div', undefined, 'school-admin-navigation');
            navigation.setAttribute('role', 'tablist');
            navigation.setAttribute('aria-label', 'School administration sections');
            const panels = new Map();
            const panelActions = new Map();
            let loadHistoryPeople;
            const panelPrefix = platformMode ? 'platform-admin' : 'school-admin';
            const addPanel = (id, label) => {
                const tab = element('button', label, 'school-admin-tab');
                tab.type = 'button'; tab.id = `${panelPrefix}-tab-${id}`;
                tab.setAttribute('role', 'tab'); tab.setAttribute('aria-controls', `${panelPrefix}-panel-${id}`);
                const panel = element('section', undefined, 'school-admin-panel');
                panel.id = `${panelPrefix}-panel-${id}`;
                panel.setAttribute('role', 'tabpanel'); panel.setAttribute('aria-labelledby', tab.id);
                panels.set(id, { tab, panel });
                tab.addEventListener('click', () => selectPanel(id));
                tab.addEventListener('keydown', event => {
                    const keys = ['ArrowLeft', 'ArrowRight', 'Home', 'End'];
                    if (!keys.includes(event.key)) return;
                    event.preventDefault();
                    const ids = [...panels.keys()], index = ids.indexOf(id);
                    const next = event.key === 'Home' ? 0 : event.key === 'End' ? ids.length - 1 : (index + (event.key === 'ArrowRight' ? 1 : ids.length - 1)) % ids.length;
                    selectPanel(ids[next]); panels.get(ids[next]).tab.focus();
                });
                navigation.append(tab); content.append(panel);
                return panel;
            };
            const selectPanel = id => {
                activeSection = id;
                for (const [key, { tab, panel }] of panels) {
                    const selected = key === id;
                    tab.setAttribute('aria-selected', String(selected)); tab.tabIndex = selected ? 0 : -1;
                    panel.hidden = !selected;
                }
                if (platformMode) {
                    const action = panelActions.get(panels.get(id)?.panel);
                    toolbar.replaceChildren(...(action ? [action] : []));
                    toolbar.hidden = !action;
                }
                if (id === 'history') void loadHistoryPeople?.();
            };
            const navigationRow = element('div', undefined, 'school-admin-navigation-row');
            navigationRow.append(navigation, toolbar); content.append(navigationRow);
            const membersPanel = canManage ? addPanel('members', 'Members') : null;
            const invitationsPanel = canManage || invitations.length ? addPanel('invitations', 'Invitations') : null;
            const yearsPanel = canManageYears ? addPanel('years', 'Academic years') : null;
            const platformPanel = platformMode ? addPanel('schools', 'Schools') : null;
            const administratorsPanel = platformMode ? addPanel('administrators', 'Administrators') : null;
            const historyPanel = canManage || platformMode ? addPanel('history', 'History') : null;
            const schoolInvitations = invitations.filter(invitation => !school || invitation.school_id === schoolId);
            if (schoolInvitations.length) {
                const section = element('section'); section.append(element('h3', 'Your invitations'));
                for (const invitation of schoolInvitations) {
                    const row = element('p', `${invitation.school_name}: ${(invitation.roles || []).join(', ')} `);
                    row.append(button('Accept invitation', () => refreshAfter(() => repository.acceptInvitation(invitation.id)))); section.append(row);
                }
                invitationsPanel.append(section);
            }
            if (!school && !platformMode) content.append(element('p', 'You have no school memberships. A school administrator can invite your verified email address.'));
            if (platformMode) renderPlatformAdministration({
                schoolsPanel: platformPanel, administratorsPanel, schools: access.schools, admins,
                repository, element, button, form, field, refreshAfter,
                openDialog: openFormDialog,
                registerPanelAction(panel, action) { panelActions.set(panel, action); },
                async openSchool(id) { context.select(id); if (onOpenSchool) onOpenSchool(); else await show(); }
            });
            if (canManageYears) {
                const savedCalendar = schoolSettings?.schoolCalendar || {};
                const openYearDialog = (existing, opener) => {
                    closeDialog?.();
                    const dialog = element('dialog', undefined, 'school-admin-invite-dialog school-admin-year-dialog');
                    dialog.setAttribute('aria-label', existing ? 'Edit academic year' : 'New academic year');
                    const yearForm = form(existing ? 'Edit academic year' : 'New academic year', 'Save academic year', node => {
                        const suggestedYear = Math.max(new Date().getFullYear(), ...years.map(year => Number(year.year) + 1));
                        const yearInput = field(node, 'Year', String(existing?.year || suggestedYear), 'number');
                        yearInput.min = '2020'; yearInput.max = '2200'; yearInput.readOnly = Boolean(existing);
                        const label = field(node, 'Year label', existing?.label || String(suggestedYear));
                        const selected = existing ? getAcademicYearCalendar(savedCalendar, existing.year) : null;
                        const ranges = new Map();
                        for (const [key, title] of ACADEMIC_TRIMESTERS) {
                            const range = element('fieldset', undefined, 'school-admin-trimester-range'); range.append(element('legend', title));
                            const start = field(range, 'Start date', selected?.trimesters?.[key]?.startDate || '', 'date');
                            const end = field(range, 'End date', selected?.trimesters?.[key]?.endDate || '', 'date');
                            start.setAttribute('aria-label', `${title} start`); end.setAttribute('aria-label', `${title} end`);
                            const weeks = element('output', '', 'school-admin-trimester-weeks');
                            const updateWeeks = () => { const count = calculateCalendarWeekCount(start.value, end.value); weeks.textContent = count ? `${count} weeks` : 'Set start and end dates'; };
                            start.addEventListener('input', updateWeeks); end.addEventListener('input', updateWeeks); updateWeeks();
                            range.append(weeks); node.append(range); ranges.set(key, { start, end });
                        }
                        if (savedCalendar.schoolYear) node.append(element('p', `Active calendar: ${savedCalendar.schoolYear}. Dates for other years are stored separately.`));
                        const feedback = element('p', '', 'school-admin-form-status'); feedback.setAttribute('role', 'status'); node.append(feedback);
                        let yearSaved = false;
                        return async () => {
                            if (!current(run, account, schoolId)) return;
                            const writeOptions = { ...opts, ownerUserId: account,
                                isCurrent: () => current(run, account, schoolId) };
                            const year = Number(yearInput.value);
                            if (!existing && !yearSaved && years.some(item => Number(item.year) === year)) throw new Error('This academic year already exists. Use Edit to change it.');
                            if (!label.value.trim()) throw new Error('Enter a year label.');
                            const dates = Object.fromEntries([...ranges].map(([key, { start, end }]) => [key, { startDate: start.value, endDate: end.value }]));
                            const calendar = withAcademicYearCalendar(savedCalendar, year, dates);
                            await repository.setYear(schoolId, year, label.value.trim(), existing?.archived || false, writeOptions);
                            yearSaved = true; yearInput.readOnly = true;
                            if (!current(run, account, schoolId)) return;
                            try { await repository.setSetting(schoolId, 'schoolCalendar', calendar, writeOptions); }
                            catch { throw new Error('The year was saved, but its trimester dates were not saved. Retry to finish saving.'); }
                            if (current(run, account, schoolId)) await onCalendarSaved?.(calendar, { isCurrent: () => current(run, account, schoolId), activeChanged: !savedCalendar.schoolYear || String(savedCalendar.schoolYear) === String(year) });
                        };
                    });
                    const close = () => {
                        if (!dialog.isConnected) return;
                        dialog.close(); dialog.remove();
                        if (opener?.isConnected) opener.focus();
                    };
                    closeDialog = close;
                    const cancel = element('button', 'Cancel', 'btn secondary-btn'); cancel.type = 'button'; cancel.addEventListener('click', close);
                    yearForm.querySelector('.school-admin-actions').prepend(cancel);
                    dialog.addEventListener('cancel', event => { event.preventDefault(); close(); });
                    dialog.append(yearForm); root.append(dialog); dialog.showModal();
                };
                const header = element('div', undefined, 'school-admin-invitation-header');
                const create = button('New year', () => openYearDialog(null, create)); create.className = 'btn primary-btn';
                header.append(element('h3', 'Academic years'), create); yearsPanel.append(header);
                const wrap = element('div', undefined, 'school-admin-table-wrap'); wrap.tabIndex = 0; wrap.setAttribute('role', 'region'); wrap.setAttribute('aria-label', 'Academic years table');
                const table = element('table', undefined, 'school-admin-table school-admin-years-table'); table.setAttribute('aria-label', 'Academic years');
                const head = element('thead'), headingRow = element('tr'), body = element('tbody');
                for (const title of ['Year', 'Label', 'Trimester 1', 'Trimester 2', 'Trimester 3', 'Status', 'Actions']) { const cell = element('th', title); cell.scope = 'col'; headingRow.append(cell); }
                head.append(headingRow);
                const dateFormat = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });
                for (const year of years) {
                    const row = element('tr', undefined, 'school-admin-year-row');
                    const yearCell = element('th', String(year.year)); yearCell.scope = 'row'; row.append(yearCell, element('td', year.label));
                    const calendar = getAcademicYearCalendar(savedCalendar, year.year);
                    for (const [key] of ACADEMIC_TRIMESTERS) {
                        const range = calendar?.trimesters?.[key];
                        const start = parseUtcDateOnly(range?.startDate), end = parseUtcDateOnly(range?.endDate);
                        const dateLabel = start && end ? `${dateFormat.format(start)} – ${dateFormat.format(end)}` : 'Not set';
                        row.append(element('td', dateLabel));
                    }
                    row.append(element('td', year.archived ? 'Archived' : String(savedCalendar.schoolYear) === String(year.year) ? 'Active calendar' : 'Open'));
                    const actions = element('td'), actionRow = element('div', undefined, 'school-admin-actions');
                    const edit = button('Edit', () => openYearDialog(year, edit)); edit.setAttribute('aria-label', `Edit academic year ${year.year}`);
                    const archive = button(year.archived ? 'Reopen' : 'Archive', () => {
                        if (!current(run, account, schoolId)) return;
                        return refreshAfter(() => repository.setYear(schoolId, year.year, year.label, !year.archived,
                            { ...opts, ownerUserId: account, isCurrent: () => current(run, account, schoolId) }));
                    });
                    archive.setAttribute('aria-label', `${year.archived ? 'Reopen' : 'Archive'} academic year ${year.year}`);
                    actionRow.append(edit, archive); actions.append(actionRow); row.append(actions); body.append(row);
                }
                table.append(head, body); wrap.append(table); yearsPanel.append(wrap);
                if (!years.length) yearsPanel.append(element('p', 'No academic years. Select New year to add one.'));
            }
            let invitationButton;
            if (canManage) {
                if (school.onboardingPending) {
                    membersPanel.append(element('p', 'Awaiting the first school administrator.'));
                } else {
                    invitationButton = button('New invitation', () => {
                        closeDialog?.();
                        const opener = invitationButton;
                        const dialog = element('dialog', undefined, 'school-admin-invite-dialog');
                        dialog.setAttribute('aria-label', 'New invitation');
                        const inviteForm = form('Invite school member', 'Create invitation', node => {
                            const email = field(node, 'Email', '', 'email'), roles = roleFields(node, ['teacher']);
                            node.append(element('p', 'The invitation appears after the recipient signs in with this verified email.'));
                            const feedback = element('p', '', 'school-admin-form-status'); feedback.setAttribute('role', 'status'); node.append(feedback);
                            return () => repository.inviteMember(schoolId, email.value, roles());
                        });
                        closeDialog = () => {
                            if (!dialog.isConnected) return;
                            dialog.close(); dialog.remove();
                            if (opener?.isConnected) opener.focus();
                        };
                        const cancel = element('button', 'Cancel', 'btn secondary-btn'); cancel.type = 'button';
                        cancel.addEventListener('click', () => closeDialog?.());
                        inviteForm.querySelector('.school-admin-actions').prepend(cancel);
                        dialog.addEventListener('cancel', event => { event.preventDefault(); closeDialog?.(); });
                        dialog.append(inviteForm); root.append(dialog); dialog.showModal();
                    });
                    invitationButton.className = 'btn primary-btn';
                }
                const list = element('section'); list.append(element('h3', 'School members'));
                const members = memberPage.members;
                const searchForm = element('form', undefined, 'school-admin-search');
                const search = field(searchForm, 'Search members by name or email', memberSearch, 'search');
                search.required = false; search.maxLength = 200;
                search.placeholder = 'Search name or email';
                search.parentElement.firstChild.replaceWith(element('span', 'Search members by name or email', 'school-admin-control-label'));
                const roleLabel = element('label', undefined, 'school-admin-field school-admin-role-filter');
                roleLabel.append(element('span', 'Role', 'school-admin-control-label'));
                const roleSelect = element('select');
                roleSelect.setAttribute('aria-label', 'Role');
                for (const [value, label] of [['', 'All roles'], ['school_admin', 'School administrator'], ['teacher', 'Teacher'], ['student', 'Student']]) {
                    const option = element('option', label); option.value = value; roleSelect.append(option);
                }
                roleSelect.value = memberRole; roleLabel.append(roleSelect); searchForm.append(roleLabel);
                roleSelect.addEventListener('change', () => {
                    if (!current(run, account, schoolId)) return;
                    memberSearch = search.value.trim(); memberRole = roleSelect.value; void show();
                });
                const searchButton = element('button', 'Search', 'btn secondary-btn'); searchButton.setAttribute('aria-label', 'Search members'); searchButton.type = 'submit'; searchForm.append(searchButton);
                searchForm.addEventListener('submit', event => {
                    event.preventDefault(); if (!current(run, account, schoolId)) return;
                    memberSearch = search.value.trim(); memberRole = roleSelect.value; void show();
                });
                list.append(searchForm);
                const count = element('p', '', 'school-admin-member-count');
                count.setAttribute('role', 'status');
                const tableWrap = element('div', undefined, 'school-admin-table-wrap');
                tableWrap.tabIndex = 0; tableWrap.setAttribute('role', 'region'); tableWrap.setAttribute('aria-label', 'School members table');
                const table = element('table', undefined, 'school-admin-table');
                const caption = element('caption', 'School members'); caption.className = 'school-admin-table-caption';
                const head = element('thead'), headings = element('tr'), body = element('tbody');
                for (const label of ['Name', 'Roles', 'Grade', 'Section', 'Status', 'Actions']) {
                    const cell = element('th', label); cell.scope = 'col'; headings.append(cell);
                }
                head.append(headings); table.append(caption, head, body); tableWrap.append(table);
                let offset = 0, visibleCount = 0, total = memberPage.total, paging = false;
                const appendMember = member => {
                    const name = member.display_name || member.email || member.user_id;
                    const row = element('tr', undefined, 'school-admin-member-row');
                    const identity = element('th', name); identity.scope = 'row';
                    identity.title = member.email && member.email !== name ? `${name} · ${member.email}` : name;
                    const roles = (member.roles || []).map(role => role === 'school_admin' ? 'School administrator' : role === 'teacher' ? 'Teacher' : 'Student').join(', ');
                    row.append(identity, element('td', roles), element('td', member.grade || '—'), element('td', member.section || '—'), element('td', member.active ? 'Active' : 'Inactive'));
                    const actions = element('td'), editorRow = element('tr', undefined, 'school-admin-member-editor');
                    editorRow.id = `school-admin-member-editor-${member.user_id}`;
                    editorRow.hidden = true;
                    const editorCell = element('td'); editorCell.colSpan = 6; editorRow.append(editorCell);
                    const edit = button('Edit', () => {
                        if (!editorCell.childElementCount) editorCell.append(form(`${name}${member.active ? '' : ' (inactive)'}`, 'Save member', node => {
                            const selectedRoles = roleFields(node, member.roles);
                            const grade = field(node, 'Grade', member.grade || '');
                            const section = field(node, 'Section', member.section || '');
                            for (const input of [grade, section]) { input.required = false; input.maxLength = 50; }
                            const placement = () => ({ grade: grade.value.trim() || null, section: section.value.trim() || null });
                            node.append(button(member.active ? 'Remove from school' : 'Restore membership', () => refreshAfter(() => repository.setMember(schoolId, member.user_id, selectedRoles(), !member.active, placement()))));
                            return () => repository.setMember(schoolId, member.user_id, selectedRoles(), member.active, placement());
                        }));
                        editorRow.hidden = !editorRow.hidden;
                        edit.setAttribute('aria-expanded', String(!editorRow.hidden));
                        if (!editorRow.hidden && window.matchMedia('(max-width: 600px)').matches) tableWrap.scrollLeft = 0;
                    });
                    edit.setAttribute('aria-label', `Edit ${name}`); edit.setAttribute('aria-expanded', 'false');
                    edit.setAttribute('aria-controls', editorRow.id);
                    actions.append(edit); row.append(actions); body.append(row, editorRow); visibleCount++;
                };
                for (const member of members) appendMember(member);
                const updateCount = () => { count.textContent = `Members ${visibleCount ? offset + 1 : 0}–${visibleCount ? offset + visibleCount : 0} of ${total}`; };
                updateCount(); list.append(tableWrap);
                if (!members.length) list.append(element('p', memberSearch ? 'No members match this search.' : 'No school members.'));
                const previous = button('Previous', () => loadPage(Math.max(0, offset - memberPageSize)), () => paging || offset === 0);
                const next = button('Next', () => loadPage(offset + memberPageSize), () => paging || offset + visibleCount >= total);
                previous.setAttribute('aria-label', 'Previous members page'); next.setAttribute('aria-label', 'Next members page');
                const updateButtons = () => { previous.disabled = paging || offset === 0; next.disabled = paging || offset + visibleCount >= total; };
                const loadPage = async nextOffset => {
                    paging = true; updateButtons(); table.setAttribute('aria-busy', 'true');
                    try {
                        const page = await readMembersPage(nextOffset);
                        if (!current(run, account, schoolId)) return;
                        status.textContent = '';
                        body.replaceChildren(); offset = nextOffset; visibleCount = 0; total = page.total;
                        for (const member of page.members) appendMember(member);
                        updateCount();
                    } finally { paging = false; updateButtons(); table.removeAttribute('aria-busy'); }
                };
                updateButtons();
                const pagination = element('div', undefined, 'school-admin-pagination');
                const controls = element('div', undefined, 'school-admin-actions'); controls.append(previous, next);
                pagination.append(controls, count); list.append(pagination);
                membersPanel.append(list);
                const inviteList = element('section');
                const invitationHeader = element('div', undefined, 'school-admin-invitation-header');
                invitationHeader.append(element('h3', 'School invitations'));
                if (invitationButton) invitationHeader.append(invitationButton);
                inviteList.append(invitationHeader);
                for (const invite of pending) {
                    const row = element('p', `${invite.email} · ${(invite.roles || []).join(', ')} · ${invite.revoked_at ? 'Revoked' : invite.accepted_at ? 'Accepted' : 'Pending'} `);
                    if (!invite.revoked_at && !invite.accepted_at) row.append(button('Revoke invitation', () => refreshAfter(() => repository.revokeInvitation(invite.id))));
                    inviteList.append(row);
                }
                if (!pending.length) inviteList.append(element('p', 'No school invitations.'));
                invitationsPanel.append(inviteList);
            }
            if (canManage || platformMode) {
                const events = element('section', undefined, 'school-admin-history');
                if (!platformMode) events.append(element('h3', 'Administration history'));
                const people = new Map();
                const remember = person => {
                    const id = person?.user_id || person?.uid || person?.id;
                    const name = String(person?.display_name || person?.displayName || '').trim() || person?.email;
                    if (id && name) people.set(id, name);
                };
                memberPage.members.forEach(remember); admins.forEach(remember); remember(getCurrentUser());
                let peopleLoaded = false;
                loadHistoryPeople = async () => {
                    if (peopleLoaded || !audit.some(event => event.actor_id && !event.actor_name && !event.actor_email && !people.has(event.actor_id))) return;
                    peopleLoaded = true;
                    const allowedSchools = new Set(access.schools.map(item => item.id));
                    const actorSchools = platformMode ? [...new Set(audit.filter(event => event.actor_id && !people.has(event.actor_id) && allowedSchools.has(event.school_id)).map(event => event.school_id))] : [];
                    const results = await Promise.allSettled([
                        ...(canManage ? [loadRoster()] : actorSchools.map(id => repository.listMembers(id, opts))),
                        access.platformAdmin && !platformMode ? repository.listPlatformAdmins(opts) : []
                    ]);
                    if (!current(run, account, schoolId)) return;
                    for (const result of results) if (result.status === 'fulfilled' && Array.isArray(result.value)) result.value.forEach(remember);
                    renderPage();
                };
                const zone = school?.timezone || 'America/Panama';
                let dateFormat;
                try { dateFormat = new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short', timeZone: zone }); }
                catch { dateFormat = new Intl.DateTimeFormat('en-GB', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'America/Panama' }); }
                const wrap = element('div', undefined, 'school-admin-table-wrap');
                wrap.tabIndex = 0; wrap.setAttribute('role', 'region'); wrap.setAttribute('aria-label', 'Administration history table');
                const table = element('table', undefined, 'school-admin-table school-admin-history-table'); table.setAttribute('aria-label', 'Administration history');
                const head = element('thead'), headings = element('tr'), body = element('tbody');
                for (const label of ['Date and time', 'Action', 'Changed by', 'Target']) { const cell = element('th', label); cell.scope = 'col'; headings.append(cell); }
                head.append(headings); table.append(head, body); wrap.append(table); events.append(wrap);
                let page = 0;
                const pageSize = 10;
                const count = element('span', '', 'school-admin-member-count'); count.setAttribute('role', 'status');
                const previous = button('Previous', () => { page--; renderPage(); }, () => page === 0);
                const next = button('Next', () => { page++; renderPage(); }, () => (page + 1) * pageSize >= audit.length);
                previous.setAttribute('aria-label', 'Previous history page'); next.setAttribute('aria-label', 'Next history page');
                const renderPage = () => {
                    const start = page * pageSize, visible = audit.slice(start, start + pageSize);
                    body.replaceChildren();
                    for (const event of visible) {
                        const row = element('tr', undefined, 'school-admin-history-row');
                        const date = new Date(event.created_at);
                        const timestamp = element('td', Number.isNaN(date.getTime()) ? event.created_at || '—' : dateFormat.format(date)); timestamp.title = event.created_at || '';
                        const rawAction = String(event.action || '');
                        const action = element('td', rawAction.replace(/[._]/g, ' ').replace(/^./, letter => letter.toUpperCase())); action.title = rawAction;
                        const actor = event.actor_name || people.get(event.actor_id) || event.actor_email || (event.actor_id ? 'Unknown person' : 'System');
                        const target = event.target_name || event.target_email || event.target_user_id || event.target_id || '—';
                        const actorCell = element('td', actor, 'school-admin-history-identity'); actorCell.title = actor;
                        const targetCell = element('td', target, 'school-admin-history-identity'); targetCell.title = target;
                        row.append(timestamp, action, actorCell, targetCell); body.append(row);
                    }
                    previous.disabled = page === 0;
                    next.disabled = start + visible.length >= audit.length;
                    count.textContent = `Events ${visible.length ? start + 1 : 0}–${start + visible.length} of ${audit.length}`;
                };
                const footer = element('div', undefined, 'school-admin-pagination');
                const controls = element('div', undefined, 'school-admin-actions'); controls.append(previous, next);
                footer.append(controls, count); events.append(footer);
                if (!audit.length) events.append(element('p', 'No administrative events.'));
                if (audit.length === 200) events.append(element('small', 'Showing the latest 200 events.'));
                renderPage(); historyPanel.append(events);
            }
            if (panels.size) {
                selectPanel(panels.has(activeSection) ? activeSection : panels.keys().next().value);
            }
        } catch (error) { if (current(run, account, schoolId)) status.textContent = error.message || 'Could not load school administration.'; }
        finally { if (current(run, account, schoolId)) { clearLoading(); refreshAccess.disabled = false; if (!toolbar.isConnected) header.append(toolbar); } }
    }
    return Object.freeze({ show, deactivate() { refreshTicket = null; closeDialog?.(); controller?.abort(); generation++; clearLoading(); }, destroy() { closeDialog?.(); destroyed = true; refreshTicket = null; generation++; controller?.abort(); clearLoading(); unsubscribe(); root.replaceChildren(); } });
}
