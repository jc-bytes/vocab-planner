import { $ } from './main.js';
import { SessionInitializationCoordinator } from './services/sessionInitialization.js';
import { teacherAuthApi } from './services/teacherAuthApi.js';

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
            await this.teacherAuthApi.init();
            const restoredUser = this.teacherAuthApi.getCurrentUser();
            let restoredUserHandled = false;

            if (restoredUser) {
                await this.handleAuthWithRole(restoredUser);
                restoredUserHandled = true;
            } else {
                this.showLoginView();
            }

            this.authUnsubscribe?.();
            this.authUnsubscribe = this.teacherAuthApi.onAuthStateChanged((user, event) => {
                if (user) {
                    if (this.currentUser?.uid && this.currentUser.uid !== user.uid) {
                        this.disposeLoadedTeacherFeatures?.();
                        this.clearStudentProgressSessionState?.();
                        this.clearTeacherSettingsSessionState?.();
                        this.clearTeacherVocabularySessionState?.();
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
                    this.clearTeacherSettingsSessionState?.();
                    this.clearTeacherVocabularySessionState?.();
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
                this.disposeLoadedTeacherFeatures?.();
                this.clearStudentProgressSessionState?.();
                this.clearTeacherSettingsSessionState?.();
                this.clearTeacherVocabularySessionState?.();
                this.isAuthenticated = false;
                this.currentUser = null;
                this.updateAuthUI(null);
                try {
                    await this.teacherAuthApi.signOut();
                } catch (signOutError) {
                    console.warn('Could not clear the rejected teacher session:', signOutError);
                }
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
                this.loadSubjectSettings({ isCurrent: context.isCurrent }),
                this.loadSchoolCalendarSettings({ isCurrent: context.isCurrent })
            ]);
            if (!context.isCurrent()) return false;
            await this.restoreRouteOrDefault();
            return context.isCurrent();
        } catch (err) {
            if (!context.isCurrent()) return false;
            console.error('Role check failed:', err);
            this.getAuthCoordinator().invalidate();
            this.disposeLoadedTeacherFeatures?.();
            this.clearStudentProgressSessionState?.();
            this.clearTeacherSettingsSessionState?.();
            this.clearTeacherVocabularySessionState?.();
            this.isAuthenticated = false;
            this.currentUser = null;
            this.currentRole = 'unknown';
            this.updateAuthUI(null);
            this.showAuthError('Could not verify teacher role.');
            this.showLoginView();
            return false;
        }
    }

    async fetchUserRole(user) {
        try {
            const profile = await this.teacherAuthApi.getProfile(user.uid);
            if (!profile || profile.role !== 'teacher') {
                if (typeof this.teacherAuthApi.ensureAllowlistedTeacherProfile === 'function') {
                    try {
                        const repairedProfile = await this.teacherAuthApi.ensureAllowlistedTeacherProfile();
                        return repairedProfile?.role || 'unknown';
                    } catch (repairError) {
                        console.warn('Could not repair allowlisted teacher profile:', repairError);
                    }
                }
            }

            if (!profile) {
                return 'unknown';
            }
            return profile.role || 'unknown';
        } catch (err) {
            console.error('Failed to fetch role', err);
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
            const result = await this.teacherAuthApi.signInWithPassword(email, password);
            await this.handleAuthWithRole(result.user);
        } catch (error) {
            console.error('Teacher login failed:', error);
            this.showAuthError(error.message || 'Could not sign in.');
            this.showLoginView();
        }
    }

}

export function installTeacherAuthMethods(TeacherManager, { authApi = teacherAuthApi } = {}) {
    Object.defineProperty(TeacherManager.prototype, 'teacherAuthApi', {
        configurable: true,
        writable: true,
        value: authApi
    });
    for (const name of Object.getOwnPropertyNames(TeacherAuthMethods.prototype)) {
        if (name === 'constructor') continue;
        Object.defineProperty(
            TeacherManager.prototype,
            name,
            Object.getOwnPropertyDescriptor(TeacherAuthMethods.prototype, name)
        );
    }
}
