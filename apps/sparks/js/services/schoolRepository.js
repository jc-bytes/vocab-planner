import { readSectionQuery } from './sectionRead.js';
// Every operation is authorized by the server. UI roles are never credentials.
import { requestWithTimeout } from './requestReliability.js';
import { schoolContext } from './schoolContext.js';
import { runOwnedMutation, serviceMutationIdentity } from './ownedMutation.js';
import { supabaseService } from '../supabaseService.js';
export function createSchoolRepository(getClient, getSession = () => null, ownership = {}) {
    const write = (name, args, options) => {
        const snapshot = JSON.parse(JSON.stringify(args));
        return runOwnedMutation(getClient, client => client.rpc(name, snapshot), { ...ownership, ...options });
    };
    function ownedSettingRpc(name, args, options = {}) {
        const snapshot = JSON.parse(JSON.stringify(args));
        const session = getSession();
        return requestWithTimeout(async signal => {
            if (!options.ownerUserId || (options.isCurrent && !options.isCurrent())) {
                throw new DOMException('The school settings account changed.', 'AbortError');
            }
            const { ownedSchoolSettingWrite } = await import('./schoolSettingWrites.js');
            signal.throwIfAborted();
            return ownedSchoolSettingWrite(getClient, name, snapshot, { ...options, signal, session, getSession });
        }, { signal: options.signal, timeoutMs: options.timeoutMs || 30000, label: 'Saving school settings' });
    }
    async function rpc(name, args = {}, { signal } = {}) {
        const client = await getClient();
        if (signal?.aborted) throw new DOMException('Request cancelled', 'AbortError');
        let query = client.rpc(name, args);
        // Mutation methods use the owned write paths above.
        const { data, error, status } = await readSectionQuery(query, { signal });
        if (error) {
            if (status && !error.status) error.status = status;
            throw error;
        }
        return data;
    }
    return Object.freeze({
        listYears: (schoolId, options) => rpc('list_school_years_v1', { p_school_id: schoolId }, options),
        setYear: (schoolId, year, label, archived = false, options) => ownedSettingRpc('set_school_year_owned_v1', { p_school_id: schoolId, p_year: Number(year), p_label: label.trim(), p_archived: archived }, options),
        getAccess: options => rpc('my_school_access_v1', {}, options),
        getSettings: (schoolId, options) => rpc('get_school_settings_v1', { p_school_id: schoolId }, options),
        setSetting: (schoolId, key, value, options) => ownedSettingRpc('set_school_setting_owned_v1', { p_school_id: schoolId, p_key: key, p_value: value }, options),
        setSettings: (schoolId, settings, options) => write('set_school_settings_v1', { p_school_id: schoolId, p_settings: settings }, options),
        createSchool: ({ name, timezone, adminEmail, requestId }, options) => write('create_school_with_admin_invitation_v1', { p_name: name.trim(), p_timezone: timezone, p_admin_email: adminEmail.trim().toLowerCase(), p_request_id: requestId }, options),
        setSchoolActive: (schoolId, active, options) => write('set_school_active_v1', { p_school_id: schoolId, p_active: active }, options),
        listMembersPage: (schoolId, { search = '', limit = 25, offset = 0, signal } = {}) => rpc('list_school_members_page_v1', { p_school_id: schoolId, p_search: search, p_limit: limit, p_offset: offset }, { signal }),
        listMembers: (schoolId, options) => rpc('list_school_members_v1', { p_school_id: schoolId }, options),
        setMember: (schoolId, userId, roles, active = true, placement, options) => write('set_school_member_v1', { p_school_id: schoolId, p_user_id: userId, p_roles: roles, p_active: active, ...(placement ? { p_grade: placement.grade ?? null, p_section: placement.section ?? null } : {}) }, options),
        replaceInitialAdminInvitation: (schoolId, email, options) => write('replace_initial_school_admin_invitation_v1', { p_school_id: schoolId, p_email: email.trim() }, options),
        inviteMember: (schoolId, email, roles, options) => write('invite_school_member_v1', { p_school_id: schoolId, p_email: email.trim(), p_roles: roles }, options),
        listMyInvitations: options => rpc('my_school_invitations_v1', {}, options),
        acceptInvitation: (invitationId, options) => write('accept_school_invitation_v1', { p_invitation_id: invitationId }, options),
        revokeInvitation: (invitationId, options) => write('revoke_school_invitation_v1', { p_invitation_id: invitationId }, options),
        listInvitations: (schoolId, options) => rpc('list_school_invitations_v1', { p_school_id: schoolId }, options),
        listAudit: (schoolId, options) => rpc('list_school_audit_v1', { p_school_id: schoolId }, options),
        setPlatformAdmin: (userId, active, options) => write('set_platform_admin_v1', { p_user_id: userId, p_active: active }, options),
        listPlatformAdmins: options => rpc('list_platform_admins_v1', {}, options)
    });
}
export const schoolRepository = createSchoolRepository(async () => {
    await supabaseService.init();
    return supabaseService.getClient();
}, () => supabaseService.currentSession, {
    getIdentity: () => serviceMutationIdentity(supabaseService),
    context: schoolContext
});
