export function createFeatureContext(manager, methods) {
    const boundMethods = new Map();
    return new Proxy(manager, {
        get(target, property, receiver) {
            const descriptor = methods[property];
            if (!descriptor || property === 'constructor') {
                return Reflect.get(target, property, receiver);
            }
            if (descriptor.get) return descriptor.get.call(receiver);
            if (typeof descriptor.value !== 'function') return descriptor.value;
            if (!boundMethods.has(property)) {
                boundMethods.set(property, descriptor.value.bind(receiver));
            }
            return boundMethods.get(property);
        },
        set(target, property, value, receiver) {
            const descriptor = methods[property];
            if (descriptor?.set) {
                descriptor.set.call(receiver, value);
                return true;
            }
            return Reflect.set(target, property, value, target);
        }
    });
}
