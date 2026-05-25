/**
 * Student Authentication Module
 * Handles backend authentication, user profile, and auth state
 */

import { $ } from '../main.js';
import { notifications } from '../notifications.js';
import { supabaseService } from '../supabaseService.js';

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
            
            supabaseService.onAuthStateChanged(async (user) => {
                if (user) {
                    // Only handle if we didn't already process redirect result
                    if (!redirectProcessed || !redirectResult?.user || redirectResult.user.uid !== user.uid) {
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

        const name = user.displayName || user.email || 'Signed in';
        const nameEl = $('#user-name');
        if (nameEl) {
            nameEl.textContent = name;
        }

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
        const headerTitle = $('.header-left h1');
        const fullName = this.sm.studentProfile.firstName && this.sm.studentProfile.lastName
            ? `${this.sm.studentProfile.firstName} ${this.sm.studentProfile.lastName}`
            : this.sm.studentProfile.name || 'Student';
        headerTitle.textContent = `Welcome, ${fullName}`;

        const editButton = $('#edit-profile-btn');
        if (editButton) {
            editButton.style.display = 'inline-flex';
        }
    }

    checkProfile(force = false) {
        this.sm.studentProfile = this.sm.normalizeStudentProfile(this.sm.studentProfile);
        const isComplete = this.sm.hasCompleteStudentProfile();

        if (isComplete && !force) {
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

        modal.classList.remove('hidden');
    }

    setAuthStatus(text) {
        const statusEl = $('#auth-status');
        if (statusEl) {
            statusEl.textContent = text;
        }
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
            errorEl.style.display = 'block';
            setTimeout(() => {
                errorEl.style.display = 'none';
            }, 5000);
        }
    }
}
