import '../css/auth-access.css';
import { supabaseService } from './supabaseService.js';

function node(tag, text) {
    const element = document.createElement(tag);
    if (text) element.textContent = text;
    return element;
}

// School invitations grant membership only after Auth verifies the email address.
export async function mountSchoolAccountAccess(root) {
    if (!root || root.querySelector('[data-school-account-access]')) return;
    await supabaseService.init();
    if (!root.isConnected || root.querySelector('[data-school-account-access]')) return;
    const client = supabaseService.getClient();
    const panel = node('section'); panel.dataset.schoolAccountAccess = ''; panel.className = 'school-account-access';
    const register = node('button', 'Create invited account'); register.type = 'button'; register.className = 'auth-account-link';
    const recover = node('button', 'Forgot password?'); recover.type = 'button'; recover.className = 'auth-account-link';
    const invitation = node('p', 'Have a school invitation?'); invitation.className = 'school-account-access__invitation';
    invitation.append(' ', register); panel.append(invitation);
    const card = root.querySelector('.teacher-login-card, .login-container') || root;
    card.append(panel);
    const passwordLabel = card.querySelector('label[for="teacher-password"], label[for="login-password"]');
    if (passwordLabel) {
        const row = node('div'); row.className = 'auth-password-label';
        passwordLabel.replaceWith(row); row.append(passwordLabel, recover);
    } else { panel.append(recover); }
    let activeDialog = null, activeMode = null;
    function open(mode) {
        if (!root.isConnected) return;
        if (activeDialog?.open && activeMode === mode) return;
        activeDialog?.close();
        const dialog = node('dialog'); dialog.className = 'card';
        activeDialog = dialog; activeMode = mode;
        const title = node('h2', mode === 'register' ? 'Create your invited account' : mode === 'password' ? 'Choose a new password' : 'Recover your account');
        title.id = `school-account-${mode}`; dialog.setAttribute('aria-labelledby', title.id);
        const form = node('form'), status = node('p'); status.setAttribute('role', 'status');
        const fields = {};
        function field(name, label, type) {
            const wrapper = node('label', label), input = node('input');
            input.name = name; input.type = type; input.required = true;
            input.autocomplete = type === 'password' ? 'new-password' : name === 'email' ? 'email' : name === 'firstName' ? 'given-name' : 'family-name';
            if (type === 'password') input.minLength = 10;
            wrapper.append(input); form.append(wrapper); fields[name] = input;
        }
        if (mode !== 'password') field('email', 'Invited email address', 'email');
        if (mode === 'register') { field('firstName', 'First name', 'text'); field('lastName', 'Last name', 'text'); }
        if (mode !== 'recover') field('password', 'Password, at least 10 characters', 'password');
        const submit = node('button', mode === 'register' ? 'Create account' : mode === 'password' ? 'Save password' : 'Send recovery link');
        submit.type = 'submit'; submit.className = 'btn primary-btn';
        const close = node('button', 'Close'); close.type = 'button'; close.className = 'btn secondary-btn';
        close.addEventListener('click', () => dialog.close());
        dialog.addEventListener('close', () => { dialog.remove(); if (activeDialog === dialog) { activeDialog = null; activeMode = null; } }, { once: true });
        form.append(submit, close, status); dialog.append(title, form); document.body.append(dialog); dialog.showModal();
        form.addEventListener('submit', async event => {
            event.preventDefault(); if (submit.disabled) return; submit.disabled = true; status.textContent = 'Please wait…';
            try {
                const redirectTo = `${window.location.origin}${window.location.pathname}`;
                let result;
                if (mode === 'register') result = await client.auth.signUp({ email: fields.email.value.trim(), password: fields.password.value,
                    options: { emailRedirectTo: redirectTo, data: { first_name: fields.firstName.value.trim(), last_name: fields.lastName.value.trim() } } });
                else if (mode === 'recover') result = await client.auth.resetPasswordForEmail(fields.email.value.trim(), { redirectTo });
                else result = await client.auth.updateUser({ password: fields.password.value });
                if (result.error) throw result.error;
                status.textContent = mode === 'register' ? 'Check your email to verify your account. Then sign in and accept your school invitation.'
                    : mode === 'recover' ? 'If this account can receive recovery email, a link has been requested. Check your inbox.' : 'Password saved.';
                if (mode === 'password') fields.password.value = '';
            } catch (error) { status.textContent = error.message || 'Could not complete this request.'; }
            finally { submit.disabled = false; }
        });
    }
    register.addEventListener('click', () => open('register'));
    recover.addEventListener('click', () => open('recover'));
    client.auth.onAuthStateChange(event => { if (event === 'PASSWORD_RECOVERY') open('password'); });
    // Auth may consume the recovery URL before this lazy feature subscribes.
    if (window.__sparksPasswordRecoveryPending) { window.__sparksPasswordRecoveryPending = false; open('password'); }
}
