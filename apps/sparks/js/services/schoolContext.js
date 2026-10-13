const schoolRepository = { getAccess: options => import('./schoolRepository.js').then(module => module.schoolRepository.getAccess(options)) };

const emptyAccess = () => Object.freeze({ platformAdmin: false, schools: Object.freeze([]) });
// Selected school is a routing preference. All permissions remain server enforced.
export function createSchoolContext({ repository = schoolRepository, storage } = {}) {
    let accountId = null, schoolId = null, access = emptyAccess(), generation = 0, controller;
    const listeners = new Set();
    const key = id => `sparks:school:${id}`;
    const read = id => { try { return storage?.getItem(key(id)); } catch { return null; } };
    const save = () => { try { if (accountId) { if (schoolId) storage?.setItem(key(accountId), schoolId); else storage?.removeItem(key(accountId)); } } catch { /* Storage is optional. */ } };
    const notify = () => { for (const listener of listeners) listener(api); };
    const invalidate = () => { generation++; controller?.abort(); controller = null; };
    const api = Object.freeze({
        async load(id = accountId) {
            invalidate();
            const run = generation;
            const preferred = id === accountId ? schoolId || read(id) : read(id);
            accountId = id || null; schoolId = null; access = emptyAccess(); notify();
            if (!accountId) return access;
            controller = new AbortController();
            try {
                const result = await repository.getAccess({ signal: controller.signal });
                if (run !== generation || id !== accountId) return null;
                access = Object.freeze({ platformAdmin: result?.platformAdmin === true,
                    schools: Object.freeze((result?.schools || []).map(s => Object.freeze({ ...s, roles: Object.freeze([...(s.roles || [])]) }))) });
                schoolId = access.schools.find(s => s.id === preferred)?.id || access.schools[0]?.id || null;
                save(); notify(); return access;
            } catch (error) {
                if (run !== generation || id !== accountId) return null;
                save(); notify(); throw error;
            }
        },
        select(id) {
            if (!access.schools.some(s => s.id === id)) throw new Error('You do not have access to this school.');
            if (id === schoolId) return;
            invalidate(); schoolId = id; save(); notify();
        },
        getSchoolId: () => schoolId,
        getSchool: () => access.schools.find(s => s.id === schoolId) || null,
        getAccess: () => access,
        getAccountId: () => accountId,
        getGeneration: () => generation,
        hasRole: role => api.getSchool()?.active !== false && Boolean(api.getSchool()?.roles.includes(role)),
        subscribe(listener) { listeners.add(listener); return () => listeners.delete(listener); },
        clear() { invalidate(); accountId = null; schoolId = null; access = emptyAccess(); notify(); }
    });
    return api;
}
let browserStorage;
try { browserStorage = globalThis.localStorage; } catch { /* Private browser mode. */ }
export const schoolContext = createSchoolContext({ storage: browserStorage });
