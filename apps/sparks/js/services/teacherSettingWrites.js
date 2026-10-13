import { requireSchoolId } from './schoolScope.js';
export async function saveTeacherSetting(service, key, values, schoolId = requireSchoolId()) {
    const { id: _id, key: _key, createdAt: _createdAt, ...value } = values;
    await service.init();
    const { error } = await service.getClient().rpc('set_school_setting_v1', {
        p_school_id: schoolId, p_key: key, p_value: value
    });
    if (error) throw error;
    return { key, ...value };
}
