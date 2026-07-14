/**
 * Student Authentication Module
 * Handles backend authentication, user profile, and auth state
 */

import { $, openModal } from '../main.js';
import { notifications } from '../notifications.js';
import { studentApi as supabaseService } from '../services/studentApi.js';
import { StudentAuthUi } from '../studentAuthUiMethods.js';

export class StudentAuth {
    constructor(studentManager) {
        this.sm = studentManager; // Reference to StudentManager instance
        this.ui = new StudentAuthUi(this);
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

    showElectronAuthMessage(loginBtn) {
        return this.ui.showElectronAuthMessage(loginBtn);
    }

    async initBackendAuth() {
        if (this.sm.authDisabled) {
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
            let redirectProcessed = false;
            if (redirectResult?.user) {
                console.log('Processing redirect sign-in result...');
                await this.handleBackendSignIn(redirectResult.user);
                redirectProcessed = true;
            }
            
            supabaseService.onAuthStateChanged(async (user, event) => {
                this.sm.logStudentDomUpdate?.('auth-state', {
                    source: 'onAuthStateChanged',
                    event,
                    userId: user?.uid || ''
                });
                if (user) {
                    const isSameUser = this.sm.currentUser?.uid === user.uid;
                    const isAlreadyInitialized = Boolean(this.sm.authInitialized);
                    const isRedirectUser = redirectProcessed && redirectResult?.user?.uid === user.uid;
                    if (isSameUser && isAlreadyInitialized && event !== 'USER_UPDATED') {
                        return;
                    }
                    // Only handle if we didn't already process redirect result
                    if (!isRedirectUser) {
                        await this.handleBackendSignIn(user);
                    }
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

    async handleBackendSignIn(user) {
        this.sm.currentUser = user;
        localStorage.setItem('was_logged_in', 'true');
        
        // Update UI immediately (works offline)
        this.setAuthStatus('🔐 Signed in');
        this.updateGuestStatus(false);

        // Try to fetch role and profile.
        try {
            await this.fetchAndSetRole(user);
        } catch (error) {
            console.error('Failed to fetch role:', error);
            const cachedRole = localStorage.getItem(`userRole_${user.uid}`);
            this.sm.currentRole = cachedRole || 'student';
            this.setAuthStatus('Signed in');
        }

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

        const sessionFinished = await this.finishSignedInSession(user.uid);
        if (sessionFinished) {
            this.sm.authInitialized = true;
        }
    }

    isStillSignedIn(userId) {
        return Boolean(this.sm.currentUser?.uid && (!userId || this.sm.currentUser.uid === userId));
    }

    async finishSignedInSession(userId = this.sm.currentUser?.uid) {
        if (!this.isStillSignedIn(userId)) return false;

        // Try to load cloud progress (may fail offline)
        try {
            await this.sm.progress.loadCloudProgress();
        } catch (error) {
            console.error('Failed to load cloud progress (may be offline):', error);
            // Use local progress instead
            this.sm.progress.loadLocalProgress();
            this.setAuthStatus('🔐 Signed in (Offline - Using local data)');
        }

        if (!this.isStillSignedIn(userId)) return false;

        this.updateHeader();
        this.sm.progress.startCoinSync();
        await this.sm.loadSubjectSettings();
        if (!this.isStillSignedIn(userId)) return false;
        await this.sm.activities.loadSchoolCalendar();
        if (!this.isStillSignedIn(userId)) return false;
        this.sm.renderDashboard();
        await this.sm.restoreRouteOrDefault();
        if (!this.isStillSignedIn(userId)) return false;
        const requiresProfile = !this.hasCompleteStudentProfile();

        if (requiresProfile) {
            this.checkProfile(true);
        }

        return true;
    }

    handleBackendSignOut() {
        this.sm.progress.stopCoinSync();
        this.sm.currentUser = null;
        localStorage.removeItem('was_logged_in');
        this.sm.progress.cancelScheduledCloudSync();
        this.updateGuestStatus(true);
        this.setAuthStatus('Signed out');
        this.sm.authInitialized = false;
        this.sm.resetRouteState();
        this.sm.switchView('login-view');
    }

    async fetchAndSetRole(user) {
        try {
            const profile = await supabaseService.getProfile(user.uid);
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

    updateHeader() {
        this.sm.logStudentDomUpdate?.('welcome-header', { source: 'updateHeader' });
        const headerTitle = $('.header-left h1');
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
        const label = String(text || '').replace(/[☁️🔐⚠️✅]/g, '').trim() || 'Status unknown';
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
