import { $, closeModal, notifications, openModal } from '../main.js';
import { supabaseService } from '../supabaseService.js';
import { setInlineStatus } from '../ui/inlineStatus.js';

const STUDENT_EMAIL_DOMAIN = '@aid.edu.pa';

export const teacherStudentProvisioningMethods = {
showAddStudentModal() {
        if (this.authDisabled) {
            notifications.warning('Student accounts can only be created when Supabase auth is enabled.');
            return;
        }

        const form = $('#add-student-form');
        form?.reset();
        this.updateAddStudentStatus('');
        openModal('#add-student-modal', { initialFocus: '#add-student-first-name' });
    },

updateAddStudentStatus(message, state = 'muted') {
        const status = $('#add-student-status');
        if (!status) return;

        setInlineStatus(status, message, state);
    },

validateAddStudentForm() {
        const firstName = $('#add-student-first-name')?.value.trim() || '';
        const lastName = $('#add-student-last-name')?.value.trim() || '';
        const email = $('#add-student-email')?.value.trim().toLowerCase() || '';
        const grade = $('#add-student-grade')?.value || '';
        const section = ($('#add-student-section')?.value || '').trim().toUpperCase();
        const password = $('#add-student-password')?.value || '';
        const confirmPassword = $('#add-student-confirm-password')?.value || '';

        if (!firstName || !lastName || !email || !grade || !section || !password) {
            throw new Error('Complete every student field.');
        }

        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            throw new Error('Enter a valid school email address.');
        }

        if (!email.endsWith(STUDENT_EMAIL_DOMAIN)) {
            throw new Error(`Use the ${STUDENT_EMAIL_DOMAIN} school email domain.`);
        }

        if (!/^[6-9]$/.test(grade)) {
            throw new Error('Choose grade 6, 7, 8, or 9.');
        }

        if (!/^[A-Z]$/.test(section)) {
            throw new Error('Section must be one letter.');
        }

        if (password.length < 10 || !/[A-Za-z]/.test(password) || !/\d/.test(password)) {
            throw new Error('Password must be at least 10 characters and include a letter and number.');
        }

        if (password !== confirmPassword) {
            throw new Error('Passwords do not match.');
        }

        return {
            profile: {
                firstName,
                lastName,
                email,
                grade,
                group: section
            },
            password
        };
    },

async handleAddStudentSubmit(event) {
        event.preventDefault();
        const generation = this.studentProgressSessionGeneration || 0;

        let payload;
        try {
            payload = this.validateAddStudentForm();
        } catch (error) {
            this.updateAddStudentStatus(error.message, 'error');
            return;
        }

        const submitButton = $('#create-student-account-btn');
        try {
            if (submitButton) submitButton.disabled = true;
            this.updateAddStudentStatus('Creating student account...', 'muted');

            await supabaseService.createStudentAccount(payload.profile, payload.password);
            if (generation !== (this.studentProgressSessionGeneration || 0)) return;

            await this.loadStudentRosterFilters({ forceRefresh: true });
            if (generation !== (this.studentProgressSessionGeneration || 0)) return;
            this.populateFilters();
            await this.fetchStudentProgressPage({ forceRefresh: true });
            if (generation !== (this.studentProgressSessionGeneration || 0)) return;
            this.populateFilters();
            this.applyFilters();
            closeModal('#add-student-modal');
            notifications.success(`Added ${payload.profile.firstName} ${payload.profile.lastName}.`);
        } catch (error) {
            if (generation !== (this.studentProgressSessionGeneration || 0)) return;
            console.error('Failed to create student account:', error);
            this.updateAddStudentStatus(error.message || 'Could not create student account.', 'error');
        } finally {
            if (generation === (this.studentProgressSessionGeneration || 0) && submitButton) {
                submitButton.disabled = false;
            }
        }
    }
};
