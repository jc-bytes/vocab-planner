import { schoolContext } from './schoolContext.js';

// Capture before the first await. Initialization may discover a cached account;
// subsequent imports and requests must retain that initialized identity.
export function captureSupabaseOperation(service, { signal, isCurrent, context = schoolContext } = {}) {
    const authGeneration = service.authIdentityGeneration || 0;
    const schoolGeneration = context.getGeneration();
    let owner = service.currentUser;
    let initialized = false;
    const assertCurrent = () => {
        signal?.throwIfAborted();
        if ((isCurrent && !isCurrent())
            || authGeneration !== (service.authIdentityGeneration || 0)
            || schoolGeneration !== context.getGeneration()
            || ((initialized || owner) && owner !== service.currentUser)) {
            throw new DOMException('The account or school changed.', 'AbortError');
        }
        return true;
    };
    return {
        assertCurrent,
        async initialize() {
            assertCurrent();
            await service.init();
            assertCurrent();
            owner = service.currentUser;
            initialized = true;
        }
    };
}
