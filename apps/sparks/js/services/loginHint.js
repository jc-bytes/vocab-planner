// This hint only selects the early loading presentation. Authentication and
// sign-out must complete even when the browser denies access to local storage.
export function setLoginHint(signedIn) {
    try {
        if (signedIn) globalThis.localStorage.setItem('was_logged_in', 'true');
        else globalThis.localStorage.removeItem('was_logged_in');
    } catch { /* Optional presentation state cannot block a session change. */ }
}
