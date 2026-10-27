import { getStudentRouteLoadingSkeleton } from './student/studentLoadingSkeletons.js';
import { $, closeModal as closeDialog, notifications, openModal } from './main.js';
import { studentApi as supabaseService } from './services/studentApi.js';

export class StudentAuthUi {
    constructor(auth) {
        this.auth = auth;
        this.sm = auth.sm;
    }

    normalizeStudentProfile(profile = {}) {
        const firstName = String(profile.firstName || profile.first_name || '').trim();
        const lastName = String(profile.lastName || profile.last_name || '').trim();
        const grade = profile.grade ?? profile.gradeLevel ?? profile.grade_level ?? '';
        const group = profile.group ?? profile.sectionLetter ?? profile.section_letter ?? '';
        const normalizedGroup = group ? String(group).trim().toUpperCase() : '';
        const name = String(profile.name || `${firstName} ${lastName}`.trim()).trim();

        return {
            firstName,
            lastName,
            name,
            grade: grade === null || grade === undefined ? '' : String(grade).trim(),
            group: normalizedGroup,
            sectionLetter: normalizedGroup,
            studentId: profile.studentId || profile.student_id || '',
            email: String(profile.email || '').trim().toLowerCase()
        };
    }

    mergeStudentProfile(primary = {}, fallback = {}) {
        const normalizedPrimary = this.normalizeStudentProfile(primary);
        const normalizedFallback = this.normalizeStudentProfile(fallback);

        return {
            ...normalizedFallback,
            ...normalizedPrimary,
            firstName: normalizedPrimary.firstName || normalizedFallback.firstName,
            lastName: normalizedPrimary.lastName || normalizedFallback.lastName,
            name: normalizedPrimary.name || normalizedFallback.name,
            grade: normalizedPrimary.grade || normalizedFallback.grade,
            group: normalizedPrimary.group || normalizedFallback.group,
            sectionLetter: normalizedPrimary.sectionLetter || normalizedFallback.sectionLetter,
            studentId: normalizedPrimary.studentId || normalizedFallback.studentId,
            email: normalizedPrimary.email || normalizedFallback.email
        };
    }

    hasCompleteStudentProfile(profile = this.sm.studentProfile) {
        const normalized = this.normalizeStudentProfile(profile);
        return Boolean(
            normalized.firstName &&
            normalized.lastName
        );
    }

    async handleStudentLogin(event) {
        event.preventDefault();
        const email = $('#login-email')?.value.trim().toLowerCase() || '';
        const password = $('#login-password')?.value || '';

        if (!email || !password) {
            this.auth.showLoginError('Enter your email and password.');
            return;
        }

        this.auth.showLoginError('');
        const view = $('#loading-view');
        if (view) view.innerHTML = getStudentRouteLoadingSkeleton(window.location.hash);
        this.sm.switchView('loading-view');

        try {
            const result = await supabaseService.signInWithPassword(email, password);
            await this.auth.handleBackendSignIn(result.user);
        } catch (error) {
            console.error('Student login failed:', error);
            this.sm.switchView('login-view');
            this.auth.showLoginError(error.message || 'Could not sign in.');
        }
    }

    showForcedPasswordChange() {
        const ownerUserId = this.sm.currentUser?.uid;
        this.passwordIntent?.dispose();
        if (!ownerUserId) throw new DOMException('The account changed.', 'AbortError');
        const intent = this.passwordIntent = supabaseService.capturePasswordChangeIntent({ ownerUserId });
        this.passwordOwner = ownerUserId;
        this.passwordChangePending = false;
        const modal = $('#force-password-modal');
        const status = $('#change-password-status');
        for (const id of ['#change-password-new', '#change-password-confirm']) { const field = $(id); if (field) field.value = ''; }
        intent.signal.addEventListener('abort', () => {
            for (const id of ['#change-password-new', '#change-password-confirm']) { const field = $(id); if (field) field.value = ''; }
            if (this.passwordIntent === intent) {
                this.passwordIntent = null;
                this.passwordChangePending = false;
                closeDialog('#force-password-modal', { restoreFocus: false });
            }
        }, { once: true });
        if (status) status.textContent = '';
        if (modal) openModal(modal, { dismissible: false, initialFocus: '#change-password-new' });
    }

    async handleForcedPasswordChange(event) {
        event.preventDefault();
        const intent = this.passwordIntent, owner = this.passwordOwner;
        const current = () => this.passwordIntent === intent && intent?.isCurrent() && this.sm.currentUser?.uid === owner;
        if (this.passwordChangePending || !current()) return;
        const password = $('#change-password-new')?.value || '';
        const confirmPassword = $('#change-password-confirm')?.value || '';
        const status = $('#change-password-status');

        if (password.length < 10 || !/[A-Za-z]/.test(password) || !/\d/.test(password)) {
            if (status) status.textContent = 'Use at least 10 characters with a letter and number.';
            return;
        }

        if (password !== confirmPassword) {
            if (status) status.textContent = 'Passwords do not match.';
            return;
        }

        try {
            this.passwordChangePending = true;
            if (status) status.textContent = 'Updating password...';
            await supabaseService.updatePasswordAndClearFlag(password, { intent });
            if (!current()) return;
            this.sm.mustChangePassword = false;
            closeDialog('#force-password-modal', { restoreFocus: false });
            const finished = await this.auth.finishSignedInSession(owner, { isCurrent: current, signal: intent.signal });
            if (current() && finished) {
                this.sm.authInitialized = true;
                notifications.success('Password updated.');
                intent.dispose();
            }
        } catch (error) {
            if (current() && status) status.textContent = error.message || 'Could not update password.';
        } finally {
            if (this.passwordIntent === intent) this.passwordChangePending = false;
        }
    }

}
