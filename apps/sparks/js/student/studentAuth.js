import { applyStudentSchoolPlacement, bindStudentSchoolSession } from './studentSchoolSession.js';
import { schoolContext } from '../services/schoolContext.js';
/**
 * Student Authentication Module
 * Handles backend authentication, user profile, and auth state
 */

import { $, openModal } from '../main.js';
import { studentApi as supabaseService } from '../services/studentApi.js';
import { requestWithTimeout } from '../services/requestReliability.js';
import { SessionInitializationCoordinator } from '../services/sessionInitialization.js';
import { serverStateQuery } from '../services/serverStateQuery.js';
import { StudentAuthUi } from '../studentAuthUiMethods.js';
import {
    getActiveStudentStorageOwner,
    setActiveStudentStorageOwner
} from './persistence/studentStorage.js';

const AUTH_REQUEST_TIMEOUT_MS = 8000;

export class StudentAuth {
    constructor(studentManager) {
        this.sm = studentManager; // Reference to StudentManager instance
        this.ui = new StudentAuthUi(this);
        this.sessionCoordinator = new SessionInitializationCoordinator();
        this.authUnsubscribe = null;
    }

    normalizeStudentProfile(profile) {
        return this.ui.normalizeStudentProfile(profile);
    }

    mergeStudentProfile(primary, fallback) {
        return this.ui.mergeStudentProfile(primary, fallback);
    }

    hasCompleteStudentProfile(profile) {
        return this.ui.hasCompleteStudentProfile(profile);
    }

    handleStudentLogin(event) {
        return this.ui.handleStudentLogin(event);
    }

    showForcedPasswordChange() {
        return this.ui.showForcedPasswordChange();
    }

    handleForcedPasswordChange(event) {
        return this.ui.handleForcedPasswordChange(event);
    }

    async initBackendAuth() {
        if (this.sm.authDisabled) {
            setActiveStudentStorageOwner('local-dev');
            this.sm.currentUser = null;
            this.sm.currentRole = 'student';
            this.setAuthStatus('Local development');
            this.updateGuestStatus(true);
            await this.sm.restoreRouteOrDefault();
            return;
        }

        try {
            await supabaseService.init();
            void import('../schoolAccountAccess.js').then(({ mountSchoolAccountAccess }) => mountSchoolAccountAccess(document.getElementById('login-view'))).catch(error => console.warn('Account access unavailable:', error));

            this.authUnsubscribe?.();
            this.authUnsubscribe = supabaseService.onAuthStateChanged((user, event) => {
                this.sm.logStudentDomUpdate?.('auth-state', {
                    source: 'onAuthStateChanged',
                    event,
                    userId: user?.uid || ''
                });
                if (user) {
                    void this.handleBackendSignIn(user, { force: event === 'USER_UPDATED' })
                        .catch(error => {
                            console.error('Student session initialization failed:', error);
                            this.showLoginError(error?.message || 'Could not finish signing in.');
                        });
                } else if (
                    event === 'SIGNED_OUT'
                    || (event === 'INITIAL_SESSION' && !this.sm.currentUser)
                ) {
                    this.handleBackendSignOut();
                }
            });
        } catch (error) {
            console.error('backend auth init failed:', error);
            this.showLoginError(error.message || 'Authentication service unavailable.');
            this.sm.switchView('login-view');
        }
    }

    handleBackendSignIn(user, options = {}) {
        if (this.sm.currentUser?.uid !== user?.uid) {
            this.startupRecovery?.dispose();
            this.startupRecovery = null;
        }
        return this.sessionCoordinator.run(
            user?.uid,
            async context => {
                try {
                    return await this.initializeBackendSignIn(user, context);
                } catch (error) {
                    if (context.isCurrent()) await this.showStartupRecovery(user, context, error);
                    return false;
                }
            },
            options
        );
    }

    async showStartupRecovery(user, context, error) {
        return (await import('../services/startupRecovery.js')).showStudentStartupRecovery(
            this, user, context, error, () => supabaseService.signOut()
        );
    }

    async initializeBackendSignIn(user, context) {
        const sameUser = this.sm.currentUser?.uid === user.uid;
        const ownerChanged = getActiveStudentStorageOwner() !== user.uid;
        if (ownerChanged) {
            const previousOwner = getActiveStudentStorageOwner();
            if (previousOwner && previousOwner !== 'local-dev') {
                void serverStateQuery.clearAccount(previousOwner);
            }
            this.sm.progress.stopCoinSync();
            this.sm.progress.cancelScheduledCloudSync();
            this.sm.activities?.progressPersistence?.resetForSession?.();
            this.sm.cleanupActivity?.();
            this.sm.resetSessionRouting?.();
            this.sm.progress.resetSessionState();
        }
        setActiveStudentStorageOwner(user.uid);
        this.sm.currentUser = user;
        localStorage.setItem('was_logged_in', 'true');
        // Restore the last verified local snapshot before making any network call.
        // This keeps the signed-in shell useful when the device starts offline.
        if (!sameUser || ownerChanged) this.sm.progress.loadLocalProgress({ ownerUserId: user.uid });

        // Update UI immediately (works offline)
        this.setAuthStatus('Signed in');
        this.updateGuestStatus(false);

        // Class routes need verified membership. A network error must not be
        // memoized as a completed startup with an empty school context.
        if (!navigator.onLine) throw Object.assign(new Error('Offline'), { code: 'OFFLINE' });
        const role = await this.fetchAndSetRole(user, context);
        if (role === null || !context.isCurrent()) return false;

        if (!context.isCurrent()) return false;
        if (this.sm.currentRole !== 'student') {
            const message = this.sm.currentRole === 'teacher'
                ? 'This page is for student accounts. Please use the teacher dashboard.'
                : 'No student profile was found for this account. Please ask your teacher to check the account setup.';
            this.showLoginError(message);
            await supabaseService.signOut();
            return;
        }

        if (this.sm.mustChangePassword) {
            this.startupRecovery?.dispose();
            this.startupRecovery = null;
            this.sm.switchView('loading-view');
            this.showForcedPasswordChange();
            return;
        }

        const sessionFinished = await this.finishSignedInSession(user.uid, context);
        if (sessionFinished && context.isCurrent()) {
            this.startupRecovery?.dispose();
            this.startupRecovery = null;
            this.sm.authInitialized = true;
        }
        return sessionFinished;
    }

    isStillSignedIn(userId) {
        return Boolean(this.sm.currentUser?.uid && (!userId || this.sm.currentUser.uid === userId));
    }

    async finishSignedInSession(userId = this.sm.currentUser?.uid, context = null) {
        const isCurrent = () => this.isStillSignedIn(userId) && (!context || context.isCurrent());
        if (!isCurrent()) return false;

        document.querySelector('.app-container')?.classList.add('student-header-loading');
        // The requested route owns its view; startup only prepares shared data.
        this.updateHeader();
        const initialRoute = this.sm.parseRoute?.();
        if (!initialRoute || initialRoute.view === 'menu') {
            this.sm.switchView('main-menu-view');
        }

        if (!navigator.onLine) {
            this.sm.progress.loadLocalProgress({ ownerUserId: userId });
            this.setAuthStatus('Signed in (Offline - Using local data)');
        } else {
            // Try to load cloud progress without letting a slow connection hold the UI forever.
            try {
                await requestWithTimeout(
                    signal => this.sm.progress.loadCloudProgress({
                        signal,
                        ownerUserId: userId,
                        isCurrent
                    }),
                    {
                        signal: context?.signal,
                        timeoutMs: AUTH_REQUEST_TIMEOUT_MS,
                        label: 'Student progress'
                    }
                );
            } catch (error) {
                if (!isCurrent()) return false;
                console.error('Failed to load cloud progress (may be offline):', error);
                this.sm.progress.loadLocalProgress({ ownerUserId: userId });
                this.setAuthStatus(navigator.onLine
                    ? 'Cloud load failed - using local data'
                    : 'Signed in (Offline - Using local data)');
            }
        }

        if (!isCurrent()) return false;

        applyStudentSchoolPlacement(this.sm);
        bindStudentSchoolSession(this.sm);
        this.updateHeader();
        if (navigator.onLine) this.sm.progress.startCoinSync();
        await Promise.all([
            requestWithTimeout(
                signal => this.sm.loadSubjectSettings({ signal }),
                { signal: context?.signal, timeoutMs: AUTH_REQUEST_TIMEOUT_MS, label: 'Class subjects' }
            ).catch(error => console.warn('Using default subjects:', error)),
            requestWithTimeout(
                signal => this.sm.activities.loadSchoolCalendar({ signal }),
                { signal: context?.signal, timeoutMs: AUTH_REQUEST_TIMEOUT_MS, label: 'School calendar' }
            ).catch(error => console.warn('Using the default school calendar:', error))
        ]);
        if (!isCurrent()) return false;
        document.querySelector('.app-container')?.classList.remove('student-header-loading');
        // Populate the shared class selector without acquiring or painting Units.
        // Routes join this same class read and own their own loading/error UI.
        void this.sm.activities.vocabularyData.prepareClassData({ isCurrent }).then(prepared => {
            if (prepared?.isCurrent() && isCurrent()) this.sm.activities.renderSubjectPicker('#student-subject-picker');
        }).catch(error => { if (isCurrent()) console.warn('Class selector unavailable:', error); });
        await this.sm.restoreRouteOrDefault();
        if (!isCurrent()) return false;
        const requiresProfile = !this.hasCompleteStudentProfile();

        if (requiresProfile) {
            this.checkProfile(true);
        }

        return true;
    }

    handleBackendSignOut() {
        this.startupRecovery?.dispose();
        this.startupRecovery = null;
        this.sm.studentSchoolUnsubscribe?.();
        this.sm.studentSchoolUnsubscribe = null;
        schoolContext.clear();
        const accountId = this.sm.currentUser?.uid || this.sm.currentUser?.id;
        if (accountId) void serverStateQuery.clearAccount(accountId);
        this.sessionCoordinator.invalidate();
        this.sm.progress.stopCoinSync();
        this.sm.progress.cancelScheduledCloudSync();
        this.sm.activities?.progressPersistence?.resetForSession?.();
        this.sm.cleanupActivity?.();
        this.sm.resetSessionRouting?.();
        this.sm.currentUser = null;
        this.sm.studentProfile = {
            firstName: '',
            lastName: '',
            name: '',
            grade: '',
            group: '',
            studentId: '',
            email: ''
        };
        this.sm.progress.resetSessionState();
        setActiveStudentStorageOwner('local-dev');
        localStorage.removeItem('was_logged_in');
        this.updateGuestStatus(true);
        this.setAuthStatus('Signed out');
        this.sm.authInitialized = false;
        this.sm.switchView('login-view');
    }

    async fetchAndSetRole(user, context = null) {
        const profile = await requestWithTimeout(
            signal => supabaseService.getProfile(user.uid, { signal }),
            { signal: context?.signal, timeoutMs: AUTH_REQUEST_TIMEOUT_MS, label: 'Student profile' }
        );
        if (context && !context.isCurrent()) return null;
        const access = await requestWithTimeout(
            signal => schoolContext.load(user.uid, { signal }),
            { signal: context?.signal, timeoutMs: AUTH_REQUEST_TIMEOUT_MS, label: 'School access' }
        );
        if (context && !context.isCurrent()) return null;
        this.sm.currentRole = access?.schools.some(school => school.roles.includes('student'))
            ? 'student' : profile ? profile.role || 'unknown' : 'student';
        this.sm.mustChangePassword = Boolean(profile?.mustChangePassword);

        if (this.sm.currentRole === 'student') {
            const identity = profile || {
                firstName: user.user_metadata?.first_name, lastName: user.user_metadata?.last_name,
                name: user.displayName
            };
            this.sm.studentProfile = this.normalizeStudentProfile({
                firstName: identity.firstName || '',
                lastName: identity.lastName || '',
                name: identity.name || '',
                grade: '',
                group: '',
                email: identity.email || user.email || ''
            });
        }

        applyStudentSchoolPlacement(this.sm);
        return this.sm.currentRole;
    }

    updateHeader() {
        this.sm.logStudentDomUpdate?.('welcome-header', { source: 'updateHeader' });
        const headerTitle = $('#welcome-header');
        const profile = this.normalizeStudentProfile(this.sm.studentProfile);
        const studentName = profile.name || this.sm.currentUser?.displayName || 'Student';
        headerTitle.textContent = studentName;
        this.sm.updateLevelDisplay();
    }

    checkProfile(force = false) {
        this.sm.studentProfile = this.normalizeStudentProfile(this.sm.studentProfile);
        const isComplete = this.hasCompleteStudentProfile();

        if (isComplete) {
            return;
        }

        const modal = $('#profile-modal');

        if (this.sm.studentProfile.firstName) {
            $('#student-firstname').value = this.sm.studentProfile.firstName;
            $('#student-lastname').value = this.sm.studentProfile.lastName || '';
            $('#student-grade').value = this.sm.studentProfile.grade;
            $('#student-group').value = this.sm.studentProfile.group;
        } else if (this.sm.studentProfile.name) {
            const nameParts = this.sm.studentProfile.name.split(' ');
            $('#student-firstname').value = nameParts[0] || '';
            $('#student-lastname').value = nameParts.slice(1).join(' ') || '';
            $('#student-grade').value = this.sm.studentProfile.grade;
            $('#student-group').value = this.sm.studentProfile.group;
        } else {
            $('#student-firstname').value = '';
            $('#student-lastname').value = '';
            $('#student-grade').value = '';
            $('#student-group').value = '';
        }

        for (const id of ['#student-grade', '#student-group']) { const input = $(id); if (input) { input.disabled = !this.sm.authDisabled; input.readOnly = !this.sm.authDisabled; input.required = false; input.title = this.sm.authDisabled ? '' : 'Managed by your school administrator'; } }
        openModal(modal, {
            dismissible: false,
            initialFocus: '#student-firstname'
        });
    }

    setAuthStatus(text) {
        this.sm.logStudentDomUpdate?.('auth-status', { source: 'StudentAuth.setAuthStatus', text });
        const statusEl = $('#auth-status');
        if (!statusEl) return;
        const label = String(text || '').trim() || 'Status unknown';
        const normalized = label.toLowerCase();
        const state = !navigator.onLine || normalized.includes('offline')
            ? 'offline'
            : normalized.includes('failed') || normalized.includes('fail')
                ? 'error'
                : normalized.includes('syncing') || normalized.includes('saving') || normalized.includes('signed in') || normalized.includes('ready')
                    ? 'pending'
                    : normalized.includes('synced') || normalized.includes('saved locally') || normalized.includes('local development')
                        ? 'synced'
                        : 'pending';
        statusEl.textContent = '';
        statusEl.dataset.state = state;
        statusEl.title = label;
        statusEl.setAttribute('aria-label', label);
    }

    updateGuestStatus(isGuest) {
        const guestStatus = $('#guest-status');
        const userInfo = $('#user-info');
        if (guestStatus) {
            guestStatus.hidden = !isGuest;
            guestStatus.setAttribute('aria-hidden', String(!isGuest));
            guestStatus.style.display = isGuest ? 'flex' : 'none';
        }
        if (userInfo) {
            userInfo.hidden = isGuest;
            userInfo.setAttribute('aria-hidden', String(isGuest));
            userInfo.style.display = isGuest ? 'none' : 'flex';
        }

        if (this.sm.authDisabled) {
            const signInBtn = $('#guest-signin-btn');
            if (signInBtn) signInBtn.style.display = 'none';
            if (guestStatus) {
                const statusText = guestStatus.querySelector('span');
                if (statusText) statusText.textContent = 'Local development';
            }
        }
    }

    showLoginError(message) {
        const errorEl = $('#login-error');
        if (errorEl) {
            errorEl.textContent = message;
            errorEl.style.display = message ? 'block' : 'none';
        }
    }
}
