import { readSectionQuery } from './sectionRead.js';
// Every operation is authorized by the server. UI roles are never credentials.
export function createSchoolRepository(getClient) {
    async function rpc(name, args = {}, { signal } = {}) {
        const client = await getClient();
        if (signal?.aborted) throw new DOMException('Request cancelled', 'AbortError');
        let query = client.rpc(name, args);
        const readOnly = /^(list_|my_|get_)/.test(name);
        if (!readOnly && signal) query = query.abortSignal(signal);
        const { data, error, status } = await (readOnly ? readSectionQuery(query, { signal }) : query);
        if (error) {
            if (status && !error.status) error.status = status;
            throw error;
        }
        return data;
    }
    return Object.freeze({
        listYears: (schoolId, options) => rpc('list_school_years_v1', { p_school_id: schoolId }, options),
        setYear: (schoolId, year, label, archived = false) => rpc('set_school_year_v1', { p_school_id: schoolId, p_year: Number(year), p_label: label.trim(), p_archived: archived }),
        getAccess: options => rpc('my_school_access_v1', {}, options),
        getSettings: (schoolId, options) => rpc('get_school_settings_v1', { p_school_id: schoolId }, options),
        setSettings: (schoolId, settings) => rpc('set_school_settings_v1', { p_school_id: schoolId, p_settings: settings }),
        createSchool: ({ name, timezone, adminEmail, requestId }) => rpc('create_school_with_admin_invitation_v1', { p_name: name.trim(), p_timezone: timezone, p_admin_email: adminEmail.trim().toLowerCase(), p_request_id: requestId }),
        setSchoolActive: (schoolId, active) => rpc('set_school_active_v1', { p_school_id: schoolId, p_active: active }),
        listMembersPage: (schoolId, { search = '', limit = 25, offset = 0, signal } = {}) => rpc('list_school_members_page_v1', { p_school_id: schoolId, p_search: search, p_limit: limit, p_offset: offset }, { signal }),
        listMembers: (schoolId, options) => rpc('list_school_members_v1', { p_school_id: schoolId }, options),
        setMember: (schoolId, userId, roles, active = true, placement) => rpc('set_school_member_v1', { p_school_id: schoolId, p_user_id: userId, p_roles: roles, p_active: active, ...(placement ? { p_grade: placement.grade ?? null, p_section: placement.section ?? null } : {}) }),
        replaceInitialAdminInvitation: (schoolId, email) => rpc('replace_initial_school_admin_invitation_v1', { p_school_id: schoolId, p_email: email.trim() }),
        inviteMember: (schoolId, email, roles) => rpc('invite_school_member_v1', { p_school_id: schoolId, p_email: email.trim(), p_roles: roles }),
        listMyInvitations: options => rpc('my_school_invitations_v1', {}, options),
        acceptInvitation: invitationId => rpc('accept_school_invitation_v1', { p_invitation_id: invitationId }),
        revokeInvitation: invitationId => rpc('revoke_school_invitation_v1', { p_invitation_id: invitationId }),
        listInvitations: (schoolId, options) => rpc('list_school_invitations_v1', { p_school_id: schoolId }, options),
        listAudit: (schoolId, options) => rpc('list_school_audit_v1', { p_school_id: schoolId }, options),
        setPlatformAdmin: (userId, active) => rpc('set_platform_admin_v1', { p_user_id: userId, p_active: active }),
        listPlatformAdmins: options => rpc('list_platform_admins_v1', {}, options)
    });
}
export const schoolRepository = createSchoolRepository(async () => {
    const { supabaseService } = await import('../supabaseService.js');
    await supabaseService.init();
    return supabaseService.getClient();
});
