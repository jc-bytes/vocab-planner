// Existing repository doubles model table/result shapes. Supply the authenticated
// per-query header interface separately; real SDK header isolation has its own tests.
export function mutationClient(client, userId = 'teacher-test') {
    const cache = new WeakMap();
    function wrap(value) {
        if (!value || !['object', 'function'].includes(typeof value)) return value;
        if (cache.has(value)) return cache.get(value);
        const proxy = new Proxy(value, { get(target, key) {
            if (key === 'setHeader') return () => proxy;
            if (key === 'then' && typeof target.then === 'function') return target.then.bind(target);
            const item = Reflect.get(target, key, target);
            return typeof item === 'function' ? (...args) => wrap(item.apply(target, args)) : item;
        } });
        cache.set(value, proxy); return proxy;
    }
    return { ...client, auth: { ...client.auth, getSession: async () => ({ data: { session: { user: { id: userId }, access_token: `fixture-${userId}` } }, error: null }) },
        ...(client.from ? { from: (...args) => wrap(client.from(...args)) } : {}),
        ...(client.rpc ? { rpc: (...args) => wrap(client.rpc(...args)) } : {}) };
}
