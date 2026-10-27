import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const zero = '00000000-0000-0000-0000-000000000000';
export const OWNED_RPC_PROBES = Object.freeze({
    save_class_response_owned_v1: Object.freeze({ p_expected_user_id: zero, p_assignment_id: zero, p_response: '', p_expected_revision: 0 }),
    check_class_spark_owned_v1: Object.freeze({ p_expected_user_id: zero, p_assignment_id: zero, p_answers: {}, p_expected_revision: 0 }),
    start_student_activity_attempt_owned_v1: Object.freeze({ p_expected_user_id: zero, p_unit_key: 'readiness-probe', p_vocabulary_id: 'readiness-probe', p_activity_type: 'flashcards' }),
    submit_student_game_score_owned_v1: Object.freeze({ p_expected_user_id: zero, p_game_id: 'readiness-probe', p_score: 0, p_metadata: {} }),
    start_student_arcade_minute_owned_v1: Object.freeze({ p_expected_user_id: zero, p_event_id: 'readiness-probe', p_game_id: 'readiness-probe', p_client_id: 'readiness-probe' }),
    recover_student_arcade_minute_owned_v1: Object.freeze({ p_expected_user_id: zero, p_event_id: 'readiness-probe', p_game_id: 'readiness-probe', p_client_id: 'readiness-probe' }),
    list_student_identity_roster_by_ids_school_owned_v1: Object.freeze({ p_expected_user_id: zero, p_school_id: zero, p_user_ids: [] }),
    set_school_setting_owned_v1: Object.freeze({ p_expected_user_id: zero, p_school_id: zero, p_key: 'readiness-probe', p_value: {} }),
    set_school_year_owned_v1: Object.freeze({ p_expected_user_id: zero, p_school_id: zero, p_year: 2026, p_label: 'readiness-probe', p_archived: false })
});

function isAnonymousBrowserKey(key) {
    if (/^sb_publishable_[A-Za-z0-9_-]+$/.test(key)) return true;
    if (!/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(key)) return false;
    try {
        const [header, payload] = key.split('.').slice(0, 2)
            .map(part => JSON.parse(Buffer.from(part, 'base64url').toString('utf8')));
        return header && typeof header.alg === 'string' && header.alg.length > 0 && header.alg !== 'none'
            && payload?.role === 'anon';
    } catch { return false; }
}

function projectUrl(value) {
    try {
        const url = new URL(value);
        const loopback = ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
        if (url.username || url.password || url.search || url.hash || url.pathname !== '/'
            || url.protocol !== 'https:' && !(url.protocol === 'http:' && loopback)) throw new Error();
        return url;
    } catch { throw new Error('RPC readiness requires an HTTPS project URL or a loopback HTTP URL, without credentials, query or path.'); }
}

// This is a deployment compatibility check, not an authenticated acceptance test.
// Valid dummy arguments resolve each exact function signature. An ACL denial
// proves the endpoint exists and anon cannot enter its implementation.
export async function verifyOwnedRpcReadiness({ url, key, fetch: request = globalThis.fetch, timeoutMs = 5000 } = {}) {
    const browserKey = typeof key === 'string' ? key.trim() : '';
    if (!isAnonymousBrowserKey(browserKey)) {
        throw new Error('RPC readiness requires a publishable key or a legacy anon key. Secret, service-role and signed-in user keys are not allowed.');
    }
    const base = projectUrl(url);
    const timeout = Number.isFinite(timeoutMs) && timeoutMs > 0 ? Math.min(timeoutMs, 10000) : 5000;
    const verified = [];
    for (const [name, args] of Object.entries(OWNED_RPC_PROBES)) {
        const controller = new AbortController();
        let timer;
        try {
            const deadline = new Promise((_, reject) => {
                timer = setTimeout(() => { controller.abort(); reject(new Error('RPC readiness timeout')); }, timeout);
            });
            await Promise.race([deadline, (async () => {
                const response = await request(new URL(`/rest/v1/rpc/${name}`, base), {
                    method: 'POST', redirect: 'error', signal: controller.signal,
                    headers: { apikey: browserKey, 'Content-Type': 'application/json' },
                    body: JSON.stringify(args)
                });
                const result = await response.json();
                if (![401, 403].includes(response.status) || result?.code !== '42501'
                    || result.message !== `permission denied for function ${name}`) throw new Error();
            })()]);
            verified.push(name);
        } catch {
            // Never echo an untrusted response, request URL, key, or fetch error.
            throw new Error(`Required RPC ${name} did not return its anonymous execution denial. Apply the required database migrations and refresh the API schema cache before publishing.`);
        } finally { clearTimeout(timer); }
    }
    return { verified };
}

export async function runReadinessCli(env = process.env, output = console) {
    try {
        const { verified } = await verifyOwnedRpcReadiness({ url: env.SUPABASE_URL, key: env.SUPABASE_PUBLISHABLE_KEY });
        output.log(`Verified anonymous execution denial for ${verified.length} required owned RPCs.`);
        return 0;
    } catch (error) {
        output.error(error.message);
        return 1;
    }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    process.exitCode = await runReadinessCli();
}
