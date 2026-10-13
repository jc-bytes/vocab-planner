import { schoolContext } from './schoolContext.js';
import { QueryClient, QueryObserver, CancelledError, isCancelledError } from '@tanstack/query-core';

export const SERVER_STATE_STALE_TIME_MS = 60_000;
export const SERVER_STATE_GC_TIME_MS = 10 * 60_000;

function normalizeAccountId(accountId) {
    const normalized = String(accountId ?? '').trim();
    if (!normalized) throw new TypeError('Server-state queries require an account ID.');
    return normalized;
}

function normalizeKeyParts(key) {
    if (key === undefined) return [];
    if (!Array.isArray(key)) throw new TypeError('Server-state query keys must be arrays.');
    return key;
}

export function serverStateQueryKey(accountId, key = [], scope = 'school') {
    const parts = normalizeKeyParts(key);
    const school = schoolContext.getSchoolId();
    return ['server-state', normalizeAccountId(accountId), ...(scope !== 'account' && parts.length && school ? ['school', school] : []), ...parts];
}

function errorStatus(error) {
    const value = Number(error?.status ?? error?.statusCode);
    return Number.isFinite(value) ? value : null;
}

export function shouldRetryServerStateRead(failureCount, error) {
    if (failureCount >= 1 || isCancelledError(error) || error?.name === 'AbortError') return false;

    const status = errorStatus(error);
    if (status === null) return true;
    if (status === 408 || status === 429) return true;
    return status >= 500;
}

function createQueryClient() {
    return new QueryClient();
}

function captureQueryScope(options, accountTokens) {
    const account = normalizeAccountId(options?.accountId);
    if (!accountTokens.has(account)) accountTokens.set(account, {});
    const token = accountTokens.get(account);
    const schoolScoped = options?.scope !== 'account' && normalizeKeyParts(options?.key).length > 0;
    const generation = schoolContext.getGeneration();
    return () => {
        if (accountTokens.get(account) !== token || schoolScoped && generation !== schoolContext.getGeneration()) {
            throw new CancelledError({ revert: true });
        }
    };
}

function queryOptions(options, defaults = {}) {
    const {
        accountId,
        key,
        scope = 'school',
        queryFn,
        staleTime = SERVER_STATE_STALE_TIME_MS,
        gcTime = defaults.gcTime ?? SERVER_STATE_GC_TIME_MS,
        retry = shouldRetryServerStateRead,
        retryDelay = 500,
        enabled,
        refetchInterval,
        refetchIntervalInBackground,
        refetchOnWindowFocus,
        refetchOnReconnect
    } = options || {};

    if (typeof queryFn !== 'function') {
        throw new TypeError('Server-state queries require a query function.');
    }

    const assertCurrentScope = defaults.assertCurrentScope;
    return {
        queryKey: serverStateQueryKey(accountId, key, scope),
        queryFn: async context => {
            try {
                assertCurrentScope();
                if (context.signal.aborted) throw new CancelledError({ revert: true });
                const value = await queryFn(context);
                assertCurrentScope();
                if (context.signal.aborted) throw new CancelledError({ revert: true });
                return value;
            } catch (error) {
                if (isCancelledError(error) && !context.signal.aborted) {
                    // Use the retryer's cancellation path so observers also leave fetching state.
                    void defaults.queryClient.cancelQueries({ queryKey: context.queryKey, exact: true }, { revert: true });
                }
                throw error;
            }
        },
        staleTime,
        gcTime,
        retry: (failureCount, error) => {
            if (isCancelledError(error) || error?.name === 'AbortError') return false;
            return typeof retry === 'function' ? retry(failureCount, error)
                : retry === true || typeof retry === 'number' && failureCount < retry;
        },
        retryDelay,
        ...(enabled === undefined ? {} : { enabled }),
        ...(refetchInterval === undefined ? {} : { refetchInterval }),
        ...(refetchIntervalInBackground === undefined ? {} : { refetchIntervalInBackground }),
        ...(refetchOnWindowFocus === undefined ? {} : { refetchOnWindowFocus }),
        ...(refetchOnReconnect === undefined ? {} : { refetchOnReconnect })
    };
}

export function createServerStateQuery({
    queryClient = createQueryClient(),
    gcTime = SERVER_STATE_GC_TIME_MS
} = {}) {
    const accountTokens = new Map();

    async function ensure(options) {
        const assertCurrentScope = captureQueryScope(options, accountTokens);
        const result = await queryClient.query(queryOptions(options, { gcTime, assertCurrentScope, queryClient }));
        assertCurrentScope();
        return result;
    }

    async function refresh(options) {
        const assertCurrentScope = captureQueryScope(options, accountTokens);
        const resolved = queryOptions(options, { gcTime, assertCurrentScope, queryClient });
        const filters = { queryKey: resolved.queryKey, exact: true };
        await queryClient.cancelQueries(filters, { silent: true });
        assertCurrentScope();
        await queryClient.invalidateQueries({ ...filters, refetchType: 'none' });
        assertCurrentScope();
        const result = await queryClient.query(resolved);
        assertCurrentScope();
        return result;
    }

    function observe(options, listener) {
        if (typeof listener !== 'function') {
            throw new TypeError('Observed server-state queries require a listener.');
        }

        const observer = new QueryObserver(queryClient, queryOptions(options, { gcTime, queryClient, assertCurrentScope: captureQueryScope(options, accountTokens) }));
        queryClient.mount();
        const unsubscribe = observer.subscribe(listener);
        let active = true;

        return Object.freeze({
            getCurrentResult: () => observer.getCurrentResult(),
            refetch: refetchOptions => observer.refetch(refetchOptions),
            unsubscribe() {
                if (!active) return;
                active = false;
                unsubscribe();
                queryClient.unmount();
            }
        });
    }

    function setData({ accountId, key = [], scope = 'school', updater } = {}) {
        if (typeof updater !== 'function' && updater === undefined) {
            throw new TypeError('Setting server-state data requires a value or updater function.');
        }
        return queryClient.setQueryData(serverStateQueryKey(accountId, key, scope), updater);
    }

    function invalidate({ accountId, key = [], scope = 'school', exact = false } = {}) {
        return queryClient.invalidateQueries({
            queryKey: serverStateQueryKey(accountId, key, scope),
            exact,
            refetchType: 'none'
        });
    }

    async function clearAccount(accountId) {
        accountTokens.delete(normalizeAccountId(accountId));
        const filters = { queryKey: serverStateQueryKey(accountId) };
        const cancellation = queryClient.cancelQueries(filters, { silent: true });
        queryClient.removeQueries(filters);
        await cancellation;
    }

    function clear() {
        accountTokens.clear();
        queryClient.clear();
    }

    return Object.freeze({
        key: serverStateQueryKey,
        ensure,
        refresh,
        observe,
        setData,
        invalidate,
        clearAccount,
        clear
    });
}

export const serverStateQuery = createServerStateQuery();
