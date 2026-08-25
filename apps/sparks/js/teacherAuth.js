import { $ } from './main.js';
import { supabaseService } from './supabaseService.js';
import { SessionInitializationCoordinator } from './services/sessionInitialization.js';

export const DEV_AUTH_DISABLED = false;
export const DEV_TEACHER_USER = {
    uid: 'dev-teacher',
    displayName: 'Development Teacher',
    email: 'teacher@local.dev'
};

class TeacherAuthMethods {
    getAuthCoordinator() {
        this.authCoordinator ||= new SessionInitializationCoordinator();
        return this.authCoordinator;
    }

    async startDevelopmentSession() {
        this.isAuthenticated = true;
        this.currentUser = DEV_TEACHER_USER;
        this.currentRole = 'teacher';
        this.updateAuthUI(DEV_TEACHER_USER);
        await Promise.all([
            this.loadSubjectSettings(),
            this.loadSchoolCalendarSettings()
        ]);
        await this.restoreRouteOrDefault();
    }

    async initAuth() {
        try {
            await supabaseService.init();
            const restoredUser = supabaseService.getCurrentUser();
            let restoredUserHandled = false;

            if (restoredUser) {
                await this.handleAuthWithRole(restoredUser);
                restoredUserHandled = true;
            } else {
                this.showLoginView();
            }

            this.authUnsubscribe?.();
            this.authUnsubscribe = supabaseService.onAuthStateChanged((user, event) => {
                if (user) {
                    if (this.currentUser?.uid && this.currentUser.uid !== user.uid) {
                        this.disposeLoadedTeacherFeatures?.();
                        this.clearStudentProgressSessionState?.();
                    }
                    if (restoredUserHandled && this.isAuthenticated && this.currentUser?.uid === user.uid) {
                        restoredUserHandled = false;
                        return;
                    }
                    void this.handleAuthWithRole(user, { force: event === 'USER_UPDATED' });
                } else {
                    restoredUserHandled = false;
                    this.getAuthCoordinator().invalidate();
                    this.disposeLoadedTeacherFeatures?.();
                    this.clearStudentProgressSessionState?.();
                    this.isAuthenticated = false;
                    this.currentUser = null;
                    this.updateAuthUI(null);
                    this.showLoginView();
                }
            });
        } catch (error) {
            console.error('Failed to initialize teacher auth:', error);
            this.showAuthError(error.message || 'Authentication unavailable. Please refresh to try again.');
            this.showLoginView();
        }
    }
    
    // Show email confirmation prompt for cross-device sign-in
    showEmailConfirmPrompt() {
        const form = $('#email-signin-form');
        const sentConfirmation = $('#email-sent-confirmation');
        const confirmPrompt = $('#email-confirm-prompt');
        
        if (form) form.style.display = 'none';
        if (sentConfirmation) sentConfirmation.style.display = 'none';
        if (confirmPrompt) confirmPrompt.style.display = 'block';
    }
    
    // Handle email link sign-in with confirmed email (cross-device)
    async completeEmailSignInWithEmail(email) {
        try {
            const result = await supabaseService.completeEmailSignIn(email);
            console.log('Email link sign-in completed:', result.user.email);
            await this.handleAuthWithRole(result.user);
        } catch (error) {
            console.error('Email sign-in with confirmation failed:', error);
            this.showAuthError('Sign-in failed. The link may have expired. Please request a new one.');
            this.showLoginView();
            // Reset UI
            const form = $('#email-signin-form');
            const confirmPrompt = $('#email-confirm-prompt');
            if (form) form.style.display = 'block';
            if (confirmPrompt) confirmPrompt.style.display = 'none';
        }
    }

    handleAuthWithRole(user, options = {}) {
        return this.getAuthCoordinator().run(
            user?.uid,
            context => this.initializeAuthWithRole(user, context),
            options
        );
    }

    async initializeAuthWithRole(user, context) {
        try {
            const role = await this.fetchUserRole(user);
            if (!context.isCurrent()) return false;
            this.currentRole = role;
            if (role !== 'teacher') {
                await supabaseService.signOut();
                this.showAuthError(role === 'unknown'
                    ? 'No teacher profile was found for this account. Check the teacher allowlist and database sync.'
                    : 'Access restricted to allowlisted teacher emails.');
                this.showLoginView();
                return false;
            }
            this.isAuthenticated = true;
            this.currentUser = user;
            localStorage.setItem('was_logged_in', 'true');
            this.updateAuthUI(user);
            await Promise.all([
                this.loadSubjectSettings(),
                this.loadSchoolCalendarSettings()
            ]);
            if (!context.isCurrent()) return false;
            await this.restoreRouteOrDefault();
            return context.isCurrent();
        } catch (err) {
            if (!context.isCurrent()) return false;
            console.error('Role check failed:', err);
            this.showAuthError('Could not verify teacher role.');
            this.showLoginView();
            return false;
        }
    }

    async fetchUserRole(user) {
        try {
            const profile = await supabaseService.getProfile(user.uid);
            if (!profile || profile.role !== 'teacher') {
                if (typeof supabaseService.ensureAllowlistedTeacherProfile === 'function') {
                    try {
                        const repairedProfile = await supabaseService.ensureAllowlistedTeacherProfile();
                        const repairedRole = repairedProfile?.role || 'unknown';
                        localStorage.setItem(`userRole_${user.uid}`, repairedRole);
                        return repairedRole;
                    } catch (repairError) {
                        console.warn('Could not repair allowlisted teacher profile:', repairError);
                    }
                }
            }

            if (!profile) {
                localStorage.removeItem(`userRole_${user.uid}`);
                return 'unknown';
            }
            const role = profile.role || 'unknown';
            localStorage.setItem(`userRole_${user.uid}`, role);
            return role;
        } catch (err) {
            console.error('Failed to fetch role', err);
            const cachedRole = localStorage.getItem(`userRole_${user.uid}`);
            if (cachedRole) return cachedRole;
            throw err;
        }
    }
    updateAuthUI(user) {
        const headerLoginBtn = $('#teacher-login-btn');
        const signOutBtn = $('#teacher-sign-out-btn');
        const loginViewBtn = $('#teacher-login-view-btn');

        if (this.authDisabled) {
            if (headerLoginBtn) headerLoginBtn.style.display = 'none';
            if (signOutBtn) signOutBtn.style.display = 'none';
            if (loginViewBtn) loginViewBtn.style.display = 'none';
            this.showAuthError('');
            this.setCloudStatus('Local development', 'muted');
            return;
        }

        if (user) {
            if (headerLoginBtn) headerLoginBtn.style.display = 'none';
            if (signOutBtn) signOutBtn.style.display = 'inline-flex';
            if (loginViewBtn) {
                loginViewBtn.disabled = false;
                loginViewBtn.innerHTML = '<i data-lucide="scan-face" aria-hidden="true"></i><span>Sign in</span>';
                window.lucide?.createIcons({ root: loginViewBtn });
            }
            this.showAuthError('');
            this.setCloudStatus('Ready', 'info');
        } else {
            if (headerLoginBtn) headerLoginBtn.style.display = 'inline-flex';
            if (signOutBtn) signOutBtn.style.display = 'none';
            if (loginViewBtn) {
                loginViewBtn.disabled = false;
                loginViewBtn.innerHTML = '<i data-lucide="scan-face" aria-hidden="true"></i><span>Sign in</span>';
                window.lucide?.createIcons({ root: loginViewBtn });
            }
            this.setCloudStatus('Offline', 'muted');
        }
    }

    showAuthError(message) {
        const errorEl = $('#teacher-login-error');
        if (!errorEl) return;
        if (message) {
            errorEl.textContent = message;
            errorEl.style.display = 'block';
        } else {
            errorEl.textContent = '';
            errorEl.style.display = 'none';
        }
    }

    showTeacherAuthPanel(mode = 'login') {
        const isSignup = mode === 'signup';
        $('#teacher-login-panel')?.classList.toggle('hidden', isSignup);
        $('#teacher-signup-panel')?.classList.toggle('hidden', !isSignup);

        const loginBtn = $('#show-teacher-login-btn');
        const signupBtn = $('#show-teacher-signup-btn');
        loginBtn?.classList.toggle('active', !isSignup);
        signupBtn?.classList.toggle('active', isSignup);
        loginBtn?.classList.toggle('primary-btn', !isSignup);
        loginBtn?.classList.toggle('secondary-btn', isSignup);
        signupBtn?.classList.toggle('primary-btn', isSignup);
        signupBtn?.classList.toggle('secondary-btn', !isSignup);
        loginBtn?.setAttribute('aria-selected', isSignup ? 'false' : 'true');
        signupBtn?.setAttribute('aria-selected', isSignup ? 'true' : 'false');
        this.showAuthError('');
    }

    async handleTeacherLogin(event) {
        event.preventDefault();
        const email = $('#teacher-email')?.value.trim().toLowerCase() || '';
        const password = $('#teacher-password')?.value || '';

        if (!email || !password) {
            this.showAuthError('Enter your email and password.');
            return;
        }

        this.showAuthError('');
        try {
            const result = await supabaseService.signInWithPassword(email, password);
            await this.handleAuthWithRole(result.user);
        } catch (error) {
            console.error('Teacher login failed:', error);
            this.showAuthError(error.message || 'Could not sign in.');
            this.showLoginView();
        }
    }

    async handleTeacherSignup(event) {
        event.preventDefault();
        const email = $('#teacher-signup-email')?.value.trim().toLowerCase() || '';
        const password = $('#teacher-signup-password')?.value || '';
        const confirmPassword = $('#teacher-signup-confirm')?.value || '';

        if (!email || !password) {
            this.showAuthError('Enter your teacher email and password.');
            return;
        }

        if (password.length < 10 || !/[A-Za-z]/.test(password) || !/\d/.test(password)) {
            this.showAuthError('Password must be at least 10 characters and include a letter and number.');
            return;
        }

        if (password !== confirmPassword) {
            this.showAuthError('Passwords do not match.');
            return;
        }

        this.showAuthError('');
        try {
            const result = await supabaseService.signUpTeacher(email, password);
            await this.handleAuthWithRole(result.user);
        } catch (error) {
            console.error('Teacher signup failed:', error);
            this.showAuthError(error.message || 'Could not create teacher account.');
            this.showLoginView();
        }
    }

    // ========== EMAIL LINK AUTHENTICATION LISTENERS ==========
    initEmailLinkListeners() {
        // Send email sign-in link button
        const sendEmailBtn = $('#send-email-link-btn');
        const emailInput = $('#teacher-email-input');
        
        if (sendEmailBtn && emailInput) {
            sendEmailBtn.addEventListener('click', async (e) => {
                e.preventDefault();
                const email = emailInput.value.trim();
                
                if (!email) {
                    this.showAuthError('Please enter your email address.');
                    emailInput.focus();
                    return;
                }
                
                // Basic email validation
                const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                if (!emailRegex.test(email)) {
                    this.showAuthError('Please enter a valid email address.');
                    emailInput.focus();
                    return;
                }
                
                const originalText = sendEmailBtn.innerHTML;
                sendEmailBtn.disabled = true;
                sendEmailBtn.innerHTML = '⏳ Sending...';
                this.showAuthError('');
                
                try {
                    await supabaseService.sendEmailSignInLink(email);
                    
                    // Show success message
                    const form = $('#email-signin-form');
                    const sentConfirmation = $('#email-sent-confirmation');
                    const sentEmailDisplay = $('#sent-email-display');
                    
                    if (form) form.style.display = 'none';
                    if (sentConfirmation) sentConfirmation.style.display = 'block';
                    if (sentEmailDisplay) sentEmailDisplay.textContent = email;
                    
                } catch (error) {
                    console.error('Failed to send email link:', error);
                    let errorMessage = 'Failed to send sign-in link. Please try again.';
                    
                    if (error.code === 'auth/invalid-email') {
                        errorMessage = 'Invalid email address.';
                    } else if (error.code === 'auth/network-request-failed') {
                        errorMessage = 'Network error. Please check your connection.';
                    }
                    
                    this.showAuthError(errorMessage);
                    sendEmailBtn.innerHTML = originalText;
                    sendEmailBtn.disabled = false;
                }
            });
            
            // Allow pressing Enter to submit
            emailInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    sendEmailBtn.click();
                }
            });
        }
        
        // Resend email button
        const resendBtn = $('#resend-email-btn');
        if (resendBtn) {
            resendBtn.addEventListener('click', () => {
                // Show the form again
                const form = $('#email-signin-form');
                const sentConfirmation = $('#email-sent-confirmation');
                
                if (form) form.style.display = 'block';
                if (sentConfirmation) sentConfirmation.style.display = 'none';
            });
        }
        
        // Confirm email button (for cross-device sign-in)
        const confirmEmailBtn = $('#confirm-email-btn');
        const confirmEmailInput = $('#confirm-email-input');
        
        if (confirmEmailBtn && confirmEmailInput) {
            confirmEmailBtn.addEventListener('click', async (e) => {
                e.preventDefault();
                const email = confirmEmailInput.value.trim();
                
                if (!email) {
                    this.showAuthError('Please enter your email address.');
                    confirmEmailInput.focus();
                    return;
                }
                
                const originalText = confirmEmailBtn.innerHTML;
                confirmEmailBtn.disabled = true;
                confirmEmailBtn.innerHTML = '⏳ Signing in...';
                this.showAuthError('');
                
                await this.completeEmailSignInWithEmail(email);
                
                confirmEmailBtn.innerHTML = originalText;
                confirmEmailBtn.disabled = false;
            });
            
            // Allow pressing Enter to submit
            confirmEmailInput.addEventListener('keypress', (e) => {
                if (e.key === 'Enter') {
                    e.preventDefault();
                    confirmEmailBtn.click();
                }
            });
        }
    }
}

export function installTeacherAuthMethods(TeacherManager) {
    for (const name of Object.getOwnPropertyNames(TeacherAuthMethods.prototype)) {
        if (name === 'constructor') continue;
        Object.defineProperty(
            TeacherManager.prototype,
            name,
            Object.getOwnPropertyDescriptor(TeacherAuthMethods.prototype, name)
        );
    }
}
