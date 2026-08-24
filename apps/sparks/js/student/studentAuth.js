/**
 * Student Authentication Module
 * Handles backend authentication, user profile, and auth state
 */

import { $, openModal } from '../main.js';
import { notifications } from '../notifications.js';
import { studentApi as supabaseService } from '../services/studentApi.js';
import { requestWithTimeout } from '../services/requestReliability.js';
import { SessionInitializationCoordinator } from '../services/sessionInitialization.js';
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

    getJoinGradeFromUrl() {
        return this.ui.getJoinGradeFromUrl();
    }

    prefillRegistrationFromJoinLink() {
        return this.ui.prefillRegistrationFromJoinLink();
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

    showAuthPanel(panel) {
        return this.ui.showAuthPanel(panel);
    }

    validateRegistrationForm() {
        return this.ui.validateRegistrationForm();
    }

    handleStudentLogin(event) {
        return this.ui.handleStudentLogin(event);
    }

    handleStudentRegister(event) {
        return this.ui.handleStudentRegister(event);
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
            
            // Check for redirect result (when using signInWithRedirect)
            // This must be called before onAuthStateChanged
            const redirectResult = await supabaseService.handleRedirectResult();
            if (redirectResult?.user) {
                console.log('Processing redirect sign-in result...');
                await this.handleBackendSignIn(redirectResult.user);
            }

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
                } else {
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
        return this.sessionCoordinator.run(
            user?.uid,
            context => this.initializeBackendSignIn(user, context),
            options
        );
    }

    async initializeBackendSignIn(user, context) {
        const ownerChanged = getActiveStudentStorageOwner() !== user.uid;
        if (ownerChanged) {
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
        this.sm.progress.loadLocalProgress({ ownerUserId: user.uid });
        
        // Update UI immediately (works offline)
        this.setAuthStatus('Signed in');
        this.updateGuestStatus(false);

        // A locally cached student role is enough to paint the non-sensitive
        // dashboard while the server revalidates the session and profile.
        // All progress writes still require the verified backend RPCs.
        if (localStorage.getItem(`userRole_${user.uid}`) === 'student') {
            this.restoreCachedStudentIdentity(user);
            this.updateHeader();
            const initialRoute = this.sm.parseRoute?.();
            if (!initialRoute || initialRoute.view === 'menu') {
                this.sm.renderDashboard();
                this.sm.switchView('main-menu-view');
            }
        }

        // Try to fetch role and profile.
        try {
            if (navigator.onLine) {
                const role = await this.fetchAndSetRole(user, context);
                if (role === null || !context.isCurrent()) return false;
            } else {
                this.restoreCachedStudentIdentity(user);
            }
        } catch (error) {
            if (!context.isCurrent()) return false;
            console.error('Failed to fetch role:', error);
            const cachedRole = localStorage.getItem(`userRole_${user.uid}`);
            this.sm.currentRole = cachedRole || 'student';
            this.setAuthStatus('Signed in');
        }

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
            this.sm.switchView('loading-view');
            this.showForcedPasswordChange();
            return;
        }

        const sessionFinished = await this.finishSignedInSession(user.uid, context);
        if (sessionFinished && context.isCurrent()) {
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

        // Paint the cached dashboard immediately on repeat visits. Cloud progress
        // remains authoritative and replaces this snapshot as soon as it arrives.
        this.updateHeader();
        const initialRoute = this.sm.parseRoute?.();
        if (!initialRoute || initialRoute.view === 'menu') {
            this.sm.renderDashboard();
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
        this.sm.renderDashboard();
        await this.sm.restoreRouteOrDefault();
        if (!isCurrent()) return false;
        const requiresProfile = !this.hasCompleteStudentProfile();

        if (requiresProfile) {
            this.checkProfile(true);
        }

        return true;
    }

    handleBackendSignOut() {
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
        try {
            const profile = await requestWithTimeout(
                signal => supabaseService.getProfile(user.uid, { signal }),
                { timeoutMs: AUTH_REQUEST_TIMEOUT_MS, label: 'Student profile' }
            );
            if (context && !context.isCurrent()) return null;
            if (!profile) {
                this.sm.currentRole = 'student';
                this.sm.mustChangePassword = false;
                this.sm.studentProfile = this.normalizeStudentProfile({
                    firstName: user.user_metadata?.first_name || '',
                    lastName: user.user_metadata?.last_name || '',
                    name: user.displayName || '',
                    email: user.email || ''
                });
                localStorage.setItem(`userRole_${user.uid}`, this.sm.currentRole);
                return this.sm.currentRole;
            }
            this.sm.currentRole = profile.role || 'unknown';
            this.sm.mustChangePassword = Boolean(profile?.mustChangePassword);

            if (profile && this.sm.currentRole === 'student') {
                this.sm.studentProfile = this.normalizeStudentProfile({
                    firstName: profile.firstName || '',
                    lastName: profile.lastName || '',
                    name: profile.name || `${profile.firstName || ''} ${profile.lastName || ''}`.trim(),
                    grade: profile.grade || '',
                    group: profile.group || profile.sectionLetter || profile.section_letter || '',
                    email: profile.email || user.email || ''
                });
            }

            localStorage.setItem(`userRole_${user.uid}`, this.sm.currentRole);
        } catch (error) {
            if (context && !context.isCurrent()) return null;
            console.error('Error fetching role:', error);
            // Try to use cached role if available
            const cachedRole = localStorage.getItem(`userRole_${user.uid}`);
            if (cachedRole) {
                this.sm.currentRole = cachedRole;
            } else {
                this.sm.currentRole = 'student';
            }
            throw error;
        }
        return this.sm.currentRole;
    }

    restoreCachedStudentIdentity(user) {
        this.sm.currentRole = localStorage.getItem(`userRole_${user.uid}`) || 'student';
        this.sm.mustChangePassword = false;
        this.sm.studentProfile = this.normalizeStudentProfile({
            ...(this.sm.studentProfile || {}),
            firstName: this.sm.studentProfile?.firstName || user.user_metadata?.first_name || '',
            lastName: this.sm.studentProfile?.lastName || user.user_metadata?.last_name || '',
            name: this.sm.studentProfile?.name || user.displayName || '',
            email: this.sm.studentProfile?.email || user.email || ''
        });
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
