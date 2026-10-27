import { bindFloatingActionMenu } from './ui/floatingActionMenu.js';

export function renderPlatformAdministration({ schoolsPanel, administratorsPanel, schools, admins, repository, element, button, form, field, refreshAfter, openDialog, openSchool, registerPanelAction }) {
    function rowMenu(cell, label, items) {
        const trigger = element('button'); trigger.setAttribute('aria-label', label);
        const menu = element('div'); menu.setAttribute('aria-label', label);
        menu.append(...items);
        bindFloatingActionMenu({ trigger, menu });
        cell.append(trigger, menu);
        return trigger;
    }
    function pagedTable(root, title, columns, records, rowFor, newLabel, create) {
        const add = button(newLabel, () => create(add)); add.className = 'btn primary-btn';
        registerPanelAction(root, add);
        const wrap = element('div', undefined, 'school-admin-table-wrap'); wrap.tabIndex = 0; wrap.setAttribute('role', 'region'); wrap.setAttribute('aria-label', `${title} table`);
        const table = element('table', undefined, 'school-admin-table school-admin-platform-table'); table.setAttribute('aria-label', title);
        const head = element('thead'), headings = element('tr'), body = element('tbody');
        for (const label of columns) { const cell = element('th', label); cell.scope = 'col'; headings.append(cell); }
        head.append(headings); table.append(head, body); wrap.append(table); root.append(wrap);
        let page = 0;
        const previous = button('Previous', () => { page--; render(); }, () => page === 0);
        const next = button('Next', () => { page++; render(); }, () => (page + 1) * 10 >= records.length);
        previous.setAttribute('aria-label', `Previous ${title.toLowerCase()} page`); next.setAttribute('aria-label', `Next ${title.toLowerCase()} page`);
        const count = element('span', '', 'school-admin-member-count'); count.setAttribute('role', 'status');
        const footer = element('div', undefined, 'school-admin-pagination'), controls = element('div', undefined, 'school-admin-actions');
        controls.append(previous, next); footer.append(controls, count); root.append(footer);
        function render() {
            const start = page * 10, visible = records.slice(start, start + 10);
            body.replaceChildren(...visible.map(rowFor)); previous.disabled = page === 0; next.disabled = start + visible.length >= records.length;
            count.textContent = `${visible.length ? start + 1 : 0}–${start + visible.length} of ${records.length}`;
        }
        if (!records.length) root.append(element('p', `No ${title.toLowerCase()}.`));
        render();
    }
    function popupForm(title, submit, build, opener) {
        const content = form(title, submit, node => {
            const save = build(node);
            const status = element('p', '', 'school-admin-form-status'); status.setAttribute('role', 'status'); node.append(status);
            return save;
        });
        openDialog(title, content, opener);
    }
    pagedTable(schoolsPanel, 'Schools', ['School', 'Timezone', 'Status', 'Actions'], schools, school => {
        const row = element('tr');
        const name = element('th', school.name); name.scope = 'row';
        row.append(name, element('td', school.timezone || '—'), element('td', school.onboardingPending ? 'Awaiting administrator' : school.active === false ? 'Suspended' : 'Active'));
        const cell = element('td'), actions = element('div', undefined, 'school-admin-actions');
        if (school.onboardingPending) {
            const replace = button('Replace invitation', () => popupForm('Replace first administrator invitation', 'Replace invitation', node => {
                const email = field(node, 'Administrator email', '', 'email');
                node.append(element('p', 'This replaces the previous invitation. Share the app link with the administrator; no email is sent.'));
                return () => repository.replaceInitialAdminInvitation(school.id, email.value);
            }, trigger));
            replace.setAttribute('aria-label', `Replace administrator invitation for ${school.name}`);
            const cancel = button('Cancel onboarding', () => popupForm('Cancel school onboarding', 'Cancel onboarding', node => {
                node.append(element('p', `Cancel onboarding for ${school.name}? The school will be marked inactive.`));
                return () => repository.setSchoolActive(school.id, false);
            }, trigger));
            cancel.setAttribute('aria-label', `Cancel onboarding for ${school.name}`); actions.append(replace, cancel);
        } else {
            if (school.active !== false) {
                const settings = button('School settings', () => openSchool(school.id)); settings.setAttribute('aria-label', `School settings for ${school.name}`); actions.append(settings);
            }
            const toggle = button(school.active === false ? 'Reactivate' : 'Suspend', () => popupForm(school.active === false ? 'Reactivate school' : 'Suspend school', school.active === false ? 'Reactivate school' : 'Suspend school', node => {
                node.append(element('p', `${school.active === false ? 'Reactivate' : 'Suspend'} ${school.name}? This changes the school's active status. Saved records remain in the system.`));
                return () => repository.setSchoolActive(school.id, school.active === false);
            }, trigger));
            toggle.setAttribute('aria-label', `${school.active === false ? 'Reactivate' : 'Suspend'} ${school.name}`); actions.append(toggle);
        }
        const trigger = rowMenu(cell, `Actions for ${school.name}`, [...actions.children]);
        row.append(cell); return row;
    }, 'New school', opener => popupForm('Create school and invite administrator', 'Create school', node => {
        const name = field(node, 'School name'), timezone = field(node, 'Timezone', 'America/Panama'), email = field(node, 'First administrator email', '', 'email');
        node.append(element('p', 'The school opens after the administrator verifies their email and accepts. Share the app link with them; this does not send an email.'));
        let requestId, requestSignature;
        return () => {
            const signature = JSON.stringify([name.value.trim(), timezone.value, email.value.trim().toLowerCase()]);
            if (signature !== requestSignature) { requestSignature = signature; requestId = crypto.randomUUID(); }
            return repository.createSchool({ name: name.value, timezone: timezone.value, adminEmail: email.value, requestId });
        };
    }, opener));
    pagedTable(administratorsPanel, 'Platform administrators', ['Administrator', 'Status', 'Actions'], admins, admin => {
        const row = element('tr'), name = element('th', admin.display_name || admin.email || 'Name unavailable'); name.scope = 'row';
        row.append(name, element('td', admin.active === false ? 'Inactive' : 'Active'));
        const cell = element('td');
        if (admin.active !== false) {
            let trigger;
            const revoke = button('Revoke access', () => popupForm('Revoke platform administration', 'Revoke access', node => {
                node.append(element('p', `Revoke platform administration from ${admin.display_name || admin.email || admin.user_id}? This removes their platform administrator access.`));
                return () => repository.setPlatformAdmin(admin.user_id, false);
            }, trigger));
            revoke.setAttribute('aria-label', `Revoke platform access for ${admin.display_name || admin.email || 'administrator'}`);
            trigger = rowMenu(cell, `Actions for ${admin.display_name || admin.email || 'administrator'}`, [revoke]);
        }
        row.append(cell); return row;
    }, 'Add administrator', opener => popupForm('Grant platform administration', 'Grant access', node => {
        const id = field(node, 'Account ID');
        node.append(element('p', 'This account will be able to administer all schools.'));
        return () => repository.setPlatformAdmin(id.value.trim(), true);
    }, opener));
}
