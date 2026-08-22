const browserFetch = (...args) => globalThis.fetch(...args);

export const Headers = globalThis.Headers;
export default browserFetch;
