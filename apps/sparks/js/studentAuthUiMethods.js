import { $, closeModal as closeDialog, notifications, openModal } from './main.js';
import { studentApi as supabaseService } from './services/studentApi.js';

const STUDENT_EMAIL_DOMAIN = '@aid.edu.pa';

export class StudentAuthUi {
    constructor(auth) {
        this.auth = auth;
        this.sm = auth.sm;
        this.joinGrade = this.getJoinGradeFromUrl();
    }

    getJoinGradeFromUrl() {
        const params = new URLSearchParams(window.location.search);
        const grade = params.get('grade') || params.get('join');
        return /^[6-9]$/.test(String(grade || '')) ? String(grade) : '';
    }

    prefillRegistrationFromJoinLink() {
        if (!this.joinGrade) return;
        const gradeSelect = $('#register-grade');
        if (gradeSelect) gradeSelect.value = this.joinGrade;
        this.showAuthPanel('register');
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
            normalized.lastName &&
            normalized.grade &&
            normalized.group
        );
    }

    showAuthPanel(panel) {
        const loginPanel = $('#student-login-panel');
        const registerPanel = $('#student-register-panel');
        const loginBtn = $('#show-login-btn');
        const registerBtn = $('#show-register-btn');

        if (loginPanel) loginPanel.style.display = panel === 'login' ? 'block' : 'none';
        if (registerPanel) registerPanel.style.display = panel === 'register' ? 'block' : 'none';
        if (loginBtn) {
            loginBtn.classList.toggle('primary-btn', panel === 'login');
            loginBtn.classList.toggle('secondary-btn', panel !== 'login');
        }
        if (registerBtn) {
            registerBtn.classList.toggle('primary-btn', panel === 'register');
            registerBtn.classList.toggle('secondary-btn', panel !== 'register');
        }
    }

    validateRegistrationForm() {
        const firstName = $('#register-first-name')?.value.trim() || '';
        const lastName = $('#register-last-name')?.value.trim() || '';
        const email = $('#register-email')?.value.trim().toLowerCase() || '';
        const grade = $('#register-grade')?.value || '';
        const section = ($('#register-section')?.value || '').trim().toUpperCase();
        const password = $('#register-password')?.value || '';
        const confirmPassword = $('#register-confirm-password')?.value || '';

        if (!firstName || !lastName || !email || !grade || !section || !password) {
            throw new Error('Complete every registration field.');
        }

        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            throw new Error('Enter a valid school email address.');
        }

        if (!email.endsWith(STUDENT_EMAIL_DOMAIN)) {
            throw new Error(`Use your ${STUDENT_EMAIL_DOMAIN} school email address.`);
        }

        if (!/^[6-9]$/.test(grade)) {
            throw new Error('Choose grade 6, 7, 8, or 9.');
        }

        if (!/^[A-Z]$/.test(section)) {
            throw new Error('Section letter must be one uppercase letter.');
        }

        if (password.length < 10 || !/[A-Za-z]/.test(password) || !/\d/.test(password)) {
            throw new Error('Password must be at least 10 characters and include a letter and number.');
        }

        if (password !== confirmPassword) {
            throw new Error('Passwords do not match.');
        }

        return {
            firstName,
            lastName,
            email,
            grade,
            group: section
        };
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
        this.sm.switchView('loading-view');

        try {
            const result = await supabaseService.signInWithPassword(email, password);
            await this.auth.handleBackendSignIn(result.user);
        } catch (error) {
            console.error('Student login failed:', error);
            this.sm.switchView('login-view');
            this.showAuthPanel('login');
            this.auth.showLoginError(error.message || 'Could not sign in.');
        }
    }

    async handleStudentRegister(event) {
        event.preventDefault();

        let profile;
        try {
            profile = this.validateRegistrationForm();
        } catch (error) {
            this.auth.showLoginError(error.message);
            return;
        }

        this.auth.showLoginError('');
        this.sm.switchView('loading-view');

        try {
            const result = await supabaseService.signUpStudent(profile, $('#register-password').value);
            await this.auth.handleBackendSignIn(result.user);
            notifications.success('Registration complete. Welcome!');
        } catch (error) {
            console.error('Student registration failed:', error);
            this.sm.switchView('login-view');
            this.showAuthPanel('register');
            this.auth.showLoginError(error.message || 'Could not register.');
        }
    }

    showForcedPasswordChange() {
        const modal = $('#force-password-modal');
        const status = $('#change-password-status');
        if (status) status.textContent = '';
        if (modal) openModal(modal, { dismissible: false, initialFocus: '#change-password-new' });
    }

    async handleForcedPasswordChange(event) {
        event.preventDefault();
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
            if (status) status.textContent = 'Updating password...';
            await supabaseService.updatePasswordAndClearFlag(password);
            this.sm.mustChangePassword = false;
            closeDialog('#force-password-modal', { restoreFocus: false });
            await this.auth.finishSignedInSession();
            notifications.success('Password updated.');
        } catch (error) {
            console.error('Password change failed:', error);
            if (status) status.textContent = error.message || 'Could not update password.';
        }
    }

    showElectronAuthMessage(loginBtn) {
        // Hide the regular login button
        if (loginBtn) {
            loginBtn.style.display = 'none';
        }
        
        // Check if message already exists
        let electronMsg = $('#electron-auth-message');
        if (electronMsg) {
            electronMsg.style.display = 'block';
            return;
        }
        
        // Create a helpful message for Electron/Cursor users
        electronMsg = document.createElement('div');
        electronMsg.id = 'electron-auth-message';
        electronMsg.style.cssText = `
            background: linear-gradient(135deg, rgba(99, 102, 241, 0.15), rgba(139, 92, 246, 0.15));
            border: 1px solid rgba(99, 102, 241, 0.3);
            border-radius: 12px;
            padding: 1.5rem;
            margin: 1rem 0;
            text-align: center;
            max-width: 400px;
        `;
        
        // Get the current URL (works for both localhost and deployed)
        const deployedUrl = window.location.href.split('?')[0]; // Remove query params if any
        
        electronMsg.innerHTML = `
            <div style="display: flex; justify-content: center; margin-bottom: 0.5rem;" aria-hidden="true">
                <i data-lucide="compass" style="width: 2rem; height: 2rem;"></i>
            </div>
            <h3 class="card-title" style="margin: 0 0 0.75rem 0; color: var(--text-main, #f8fafc);">Sign In via Browser</h3>
            <p class="card-secondary" style="margin: 0 0 1rem 0; color: var(--text-muted, #94a3b8);">
                External sign-in doesn't work in the Cursor browser. Please use one of these options:
            </p>
            <div style="display: flex; flex-direction: column; gap: 0.75rem;">
                <a class="card-action" href="${deployedUrl}" target="_blank"
                   style="display: inline-flex; align-items: center; justify-content: center; gap: 0.5rem; 
                          background: var(--color-brand); color: white; padding: 0.75rem 1.5rem;
                          border-radius: 8px; text-decoration: none; transition: all 0.2s;">
                    <i data-lucide="arrow-right" aria-hidden="true"></i>
                    <span>Open in Browser</span>
                </a>
                <button id="copy-url-btn" class="card-action"
                        style="display: inline-flex; align-items: center; justify-content: center; gap: 0.5rem;
                               background: transparent; border: 1px solid var(--border-color, rgba(255,255,255,0.2)); 
                               color: var(--text-main, #f8fafc); padding: 0.75rem 1.5rem; border-radius: 8px; 
                               cursor: pointer; transition: all 0.2s;">
                    <i data-lucide="copy" aria-hidden="true"></i>
                    <span>Copy URL</span>
                </button>
            </div>
            <p class="card-caption" style="margin: 1rem 0 0 0; color: var(--text-muted, #94a3b8);">
                Or continue as guest below
            </p>
        `;
        
        // Insert after login button's parent
        const loginSection = loginBtn?.closest('.login-section') || loginBtn?.parentNode;
        if (loginSection) {
            loginSection.appendChild(electronMsg);
        }
        window.lucide?.createIcons({ root: electronMsg });
        
        // Add copy URL functionality
        setTimeout(() => {
            const copyBtn = $('#copy-url-btn');
            if (copyBtn) {
                copyBtn.addEventListener('click', async () => {
                    try {
                        await navigator.clipboard.writeText(deployedUrl);
                        copyBtn.innerHTML = '<i data-lucide="check" aria-hidden="true"></i><span>Copied!</span>';
                        window.lucide?.createIcons({ root: copyBtn });
                        setTimeout(() => {
                            copyBtn.innerHTML = '<i data-lucide="copy" aria-hidden="true"></i><span>Copy URL</span>';
                            window.lucide?.createIcons({ root: copyBtn });
                        }, 2000);
                    } catch (err) {
                        // Fallback for older browsers
                        const textArea = document.createElement('textarea');
                        textArea.value = deployedUrl;
                        document.body.appendChild(textArea);
                        textArea.select();
                        document.execCommand('copy');
                        document.body.removeChild(textArea);
                        copyBtn.innerHTML = '<i data-lucide="check" aria-hidden="true"></i><span>Copied!</span>';
                        window.lucide?.createIcons({ root: copyBtn });
                        setTimeout(() => {
                            copyBtn.innerHTML = '<i data-lucide="copy" aria-hidden="true"></i><span>Copy URL</span>';
                            window.lucide?.createIcons({ root: copyBtn });
                        }, 2000);
                    }
                });
            }
        }, 0);
        
        // Clear any error message
        this.auth.showLoginError('');
    }
}
