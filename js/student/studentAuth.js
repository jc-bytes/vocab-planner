/**
 * Student Authentication Module
 * Handles backend authentication, user profile, and auth state
 */

import { $, openModal } from '../main.js';
import { notifications } from '../notifications.js';
import { studentApi as supabaseService } from '../services/studentApi.js';

export class StudentAuth {
    constructor(studentManager) {
        this.sm = studentManager; // Reference to StudentManager instance
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
            this.sm.showLoginError(error.message || 'Authentication service unavailable.');
            this.sm.switchView('login-view');
        }
    }

    async handleBackendSignIn(user) {
        this.sm.currentUser = user;
        localStorage.setItem('was_logged_in', 'true');
        
        // Update UI immediately (works offline)
        this.sm.setAuthStatus('🔐 Signed in');
        this.sm.updateGuestStatus(false);

        // Try to fetch role and profile.
        try {
            await this.fetchAndSetRole(user);
        } catch (error) {
            console.error('Failed to fetch role:', error);
            const cachedRole = localStorage.getItem(`userRole_${user.uid}`);
            this.sm.currentRole = cachedRole || 'student';
            this.sm.setAuthStatus('Signed in');
        }

        if (this.sm.currentRole !== 'student') {
            this.sm.showLoginError('This page is for student accounts. Please use the teacher dashboard.');
            await supabaseService.signOut();
            return;
        }

        if (this.sm.mustChangePassword) {
            this.sm.switchView('loading-view');
            this.sm.showForcedPasswordChange();
            return;
        }

        await this.finishSignedInSession();
        this.sm.authInitialized = true;
    }

    async finishSignedInSession() {
        // Try to load cloud progress (may fail offline)
        try {
            await this.sm.progress.loadCloudProgress();
        } catch (error) {
            console.error('Failed to load cloud progress (may be offline):', error);
            // Use local progress instead
            this.sm.progress.loadLocalProgress();
            this.sm.setAuthStatus('🔐 Signed in (Offline - Using local data)');
        }

        this.sm.updateHeader();
        this.sm.progress.startCoinSync();
        await this.sm.loadSubjectSettings();
        await this.sm.activities.loadSchoolCalendar();
        this.sm.renderDashboard();
        await this.sm.restoreRouteOrDefault();
        const requiresProfile = !this.sm.hasCompleteStudentProfile();

        if (requiresProfile) {
            this.sm.checkProfile(true);
        }
    }

    handleBackendSignOut() {
        this.sm.progress.stopCoinSync();
        this.sm.currentUser = null;
        localStorage.removeItem('was_logged_in');
        if (this.sm.cloudSaveTimeout) {
            clearTimeout(this.sm.cloudSaveTimeout);
            this.sm.cloudSaveTimeout = null;
        }
        this.sm.updateGuestStatus(true);
        this.sm.setAuthStatus('Signed out');
        this.sm.routeReady = false;
        this.sm.switchView('login-view');
    }

    async fetchAndSetRole(user) {
        try {
            const profile = await supabaseService.getProfile(user.uid);
            this.sm.currentRole = profile?.role || 'student';
            this.sm.mustChangePassword = Boolean(profile?.mustChangePassword);

            if (profile && this.sm.currentRole === 'student') {
                this.sm.studentProfile = this.sm.normalizeStudentProfile({
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
        const profile = this.sm.normalizeStudentProfile(this.sm.studentProfile);
        const studentName = profile.name || this.sm.currentUser?.displayName || 'Student';
        headerTitle.textContent = studentName;
    }

    checkProfile(force = false) {
        this.sm.studentProfile = this.sm.normalizeStudentProfile(this.sm.studentProfile);
        const isComplete = this.sm.hasCompleteStudentProfile();

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
        if (guestStatus) guestStatus.style.display = isGuest ? 'flex' : 'none';
        if (userInfo) userInfo.style.display = isGuest ? 'none' : 'flex';

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
