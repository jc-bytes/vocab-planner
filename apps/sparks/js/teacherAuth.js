import { schoolContext } from './services/schoolContext.js';
const bindTeacherSchoolSession = async manager => {
    const { bindTeacherSchoolSession: bind } = await import('./teacherSchoolSession.js');
    if (manager.isAuthenticated) bind(manager);
};
import { $, refreshIcons } from './main.js';
import { SessionInitializationCoordinator } from './services/sessionInitialization.js';
import { teacherAuthApi } from './services/teacherAuthApi.js';
import { serverStateQuery } from './services/serverStateQuery.js';
import { requestWithTimeout } from './services/requestReliability.js';

export const TEACHER_AUTH_REQUEST_TIMEOUT_MS = 8000;

export const DEV_AUTH_DISABLED = false;
export const DEV_TEACHER_USER = {
    uid: 'dev-teacher',
    displayName: 'Development Teacher',
    email: 'teacher@local.dev'
};

class TeacherAuthMethods {
    clearCurrentTeacherServerState() {
        const accountId = this.currentUser?.uid || this.currentUser?.id;
        if (accountId) void serverStateQuery.clearAccount(accountId);
        this.overviewAnalytics = null;
    }

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
            void import('./schoolAccountAccess.js').then(({ mountSchoolAccountAccess }) => mountSchoolAccountAccess(document.getElementById('teacher-login-view'))).catch(error => console.warn('Account access unavailable:', error));
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
                        this.clearCurrentTeacherServerState();
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
                } else if (event === 'SIGNED_OUT' || (event === 'INITIAL_SESSION' && !this.currentUser)) {
                    restoredUserHandled = false;
                    this.startupRecovery?.dispose();
                    this.startupRecovery = null;
                    this.getAuthCoordinator().invalidate();
                    this.clearCurrentTeacherServerState();
                    this.disposeLoadedTeacherFeatures?.();
                    this.clearStudentProgressSessionState?.();
                    this.clearTeacherSettingsSessionState?.();
                    this.clearTeacherVocabularySessionState?.();
                    this.schoolContextUnsubscribe?.();
                    this.schoolAccess.clear();
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
        if (this.currentUser?.uid !== user?.uid) {
            this.startupRecovery?.dispose();
            this.startupRecovery = null;
        }
        return this.getAuthCoordinator().run(
            user?.uid,
            context => this.initializeAuthWithRole(user, context),
            options
        );
    }

    async showStartupRecovery(user, context, error) {
        return (await import('./services/startupRecovery.js')).showTeacherStartupRecovery(this, user, context, error);
    }

    async initializeAuthWithRole(user, context) {
        try {
            const access = await this.teacherRequestWithTimeout(signal => this.schoolAccess.load(user.uid || user.id, { signal }), {
                signal: context.signal, timeoutMs: TEACHER_AUTH_REQUEST_TIMEOUT_MS, label: 'School access'
            });
            if (!context.isCurrent() || !access) return false;
            this.startupRecovery?.dispose();
            this.startupRecovery = null;
            this.currentRole = this.schoolAccess.hasRole('teacher') ? 'teacher' : 'school_member';
            this.isAuthenticated = true;
            this.currentUser = user;
            localStorage.setItem('was_logged_in', 'true');
            this.updateAuthUI(user);
            await this.bindSchoolSession(this);
            if (!context.isCurrent()) return false;
            if (!this.schoolAccess.hasRole('teacher') && !this.schoolAccess.hasRole('school_admin')) {
                this.setRoute({ view: 'administration' }, { replace: true });
                await this.showSchoolAdministration();
                return context.isCurrent();
            }
            const settingsResults = await Promise.allSettled([
                this.teacherRequestWithTimeout(
                    signal => this.loadSubjectSettings({
                        isCurrent: context.isCurrent,
                        signal,
                        surfaceErrors: true
                    }),
                    {
                        signal: context.signal,
                        timeoutMs: TEACHER_AUTH_REQUEST_TIMEOUT_MS,
                        label: 'Teacher subjects'
                    }
                ),
                this.teacherRequestWithTimeout(
                    signal => this.loadSchoolCalendarSettings({
                        isCurrent: context.isCurrent,
                        signal,
                        surfaceErrors: true
                    }),
                    {
                        signal: context.signal,
                        timeoutMs: TEACHER_AUTH_REQUEST_TIMEOUT_MS,
                        label: 'School calendar'
                    }
                )
            ]);
            if (!context.isCurrent()) return false;
            const settingsFailures = settingsResults.filter(result => result.status === 'rejected');
            if (settingsFailures.length) {
                console.warn('Teacher settings loaded with defaults:', settingsFailures.map(result => result.reason));
                this.showAuthError('Some teacher settings could not load. Using defaults.');
            }
            await this.restoreRouteOrDefault();
            return context.isCurrent();
        } catch (err) {
            if (!context.isCurrent()) return false;
            // Access failure is not an auth sign-out. Keep identity and drafts,
            // while blocking teaching tools until membership is verified again.
            this.isAuthenticated = false;
            this.currentUser = user;
            this.schoolContextUnsubscribe?.();
            this.currentRole = 'unknown';
            await this.showStartupRecovery(user, context, err);
            return false;
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
                refreshIcons(loginViewBtn);
            }
            this.showAuthError('');
            this.setCloudStatus('Ready', 'info');
        } else {
            if (headerLoginBtn) headerLoginBtn.style.display = 'inline-flex';
            if (signOutBtn) signOutBtn.style.display = 'none';
            if (loginViewBtn) {
                loginViewBtn.disabled = false;
                loginViewBtn.innerHTML = '<i data-lucide="scan-face" aria-hidden="true"></i><span>Sign in</span>';
                refreshIcons(loginViewBtn);
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

export function installTeacherAuthMethods(TeacherManager, {
    authApi = teacherAuthApi,
    schoolAccess = schoolContext,
    bindSchoolSession = bindTeacherSchoolSession,
    requestTimeout = requestWithTimeout
} = {}) {
    Object.defineProperty(TeacherManager.prototype, 'schoolAccess', { configurable: true, value: schoolAccess });
    Object.defineProperty(TeacherManager.prototype, 'bindSchoolSession', { configurable: true, value: bindSchoolSession });
    Object.defineProperty(TeacherManager.prototype, 'teacherAuthApi', {
        configurable: true,
        writable: true,
        value: authApi
    });
    Object.defineProperty(TeacherManager.prototype, 'teacherRequestWithTimeout', {
        configurable: true,
        writable: true,
        value: requestTimeout
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
