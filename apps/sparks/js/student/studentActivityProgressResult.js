// Both active saves and offline replay require a real JSON result from the RPC.
export function requireActivityProgressResult(result) {
    if (!result || typeof result !== 'object' || Array.isArray(result) || !Object.keys(result).length) {
        const error = new Error('The activity server returned an empty response.');
        error.code = 'EMPTY_ACTIVITY_RESPONSE';
        throw error;
    }
    return result;
}
