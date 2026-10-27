import { requireSchoolId } from './schoolScope.js';
import { ownedSchoolSettingWrite } from './schoolSettingWrites.js';
import { readAuthSessionId } from './supabaseValues.js';
export async function saveTeacherSetting(service, key, values, schoolId = requireSchoolId(), options = {}) {
    const user = service.currentUser;
    const generation = service.authIdentityGeneration || 0;
    const session = service.currentSession;
    const sessionId = readAuthSessionId(session);
    const ownerUserId = options.ownerUserId || user?.uid;
    const isCurrent = () => user && user.uid === ownerUserId && service.currentUser?.uid === ownerUserId
        && (sessionId ? readAuthSessionId(service.currentSession) === sessionId
            : service.currentUser === user && generation === (service.authIdentityGeneration || 0))
        && (!options.isCurrent || options.isCurrent());
    const { id: _id, key: _key, createdAt: _createdAt, ...value } = values;
    await ownedSchoolSettingWrite(async () => {
        await service.init();
        return service.getClient();
    }, 'set_school_setting_owned_v1', {
        p_school_id: schoolId, p_key: key, p_value: value
    }, { ...options, ownerUserId, isCurrent, session });
    return { key, ...value };
}
