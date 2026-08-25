import { $ } from './main.js';
import { supabaseService } from './supabaseService.js';
import { setInlineStatus } from './ui/inlineStatus.js';

class TeacherStudentProgressCoinMethods {
    updateCoinStatus(message, state = 'muted') {
        const el = $('#coin-adjust-status');
        if (!el) return;
        setInlineStatus(el, message, state);
    }

    async handleCoinAdjust() {
        if (!this.activeStudentId) return;
        const input = $('#coin-adjust-input');
        const amount = parseInt(input.value, 10) || 0;
        if (amount <= 0) {
            this.updateCoinStatus('Enter a positive number.', 'error');
            return;
        }
        this.updateCoinStatus('Saving...', 'muted');
        try {
            await this.adjustStudentCoins(this.activeStudentId, amount);
            this.updateCoinStatus(`Added ${amount} coins.`, 'success');
            $('#coin-adjust-input').value = '10';
        } catch (err) {
            console.error('Failed to adjust coins', err);
            this.updateCoinStatus('Failed to update coins.', 'error');
        }
    }

    async adjustStudentCoins(studentId, amount, message = '') {
        const student = this.allStudentData.find(s => s.id === studentId);
        if (!student) throw new Error('Student not found');

        const progress = await supabaseService.giftStudentCoins({
            studentId,
            amount,
            message: message || 'Gift from teacher'
        });

        // Update local student data (for display)
        student.coins = progress.coinData?.balance ?? progress.coins ?? student.coins ?? 0;
        student.coinData = progress.coinData || student.coinData;
        const filteredItem = this.filteredStudentData.find(s => s.id === studentId);
        if (filteredItem) {
            filteredItem.coins = student.coins;
            filteredItem.coinData = student.coinData;
        }

        $('#detail-student-coins').textContent = student.coins;
        this.renderProgressTable();
    }

    handleSelectAll(checked) {
        if (checked) {
            this.filteredStudentData.forEach(student => {
                this.selectedStudents.add(student.id);
            });
        } else {
            this.filteredStudentData.forEach(student => {
                this.selectedStudents.delete(student.id);
            });
        }
        this.updateStudentSelectionVisuals();
        this.updateBulkToolbar();
        this.updateSelectAllCheckbox();
    }

    clearSelection() {
        this.selectedStudents.clear();
        this.updateStudentSelectionVisuals();
        this.updateBulkToolbar();
        this.updateSelectAllCheckbox();
    }

    updateBulkToolbar() {
        const toolbar = $('#bulk-action-toolbar');
        const count = $('#bulk-selected-count');

        if (this.selectedStudents.size > 0) {
            toolbar?.classList.remove('hidden');
            if (count) {
                count.textContent = `${this.selectedStudents.size} student${this.selectedStudents.size > 1 ? 's' : ''} selected`;
            }
        } else {
            toolbar?.classList.add('hidden');
        }
    }

    updateSelectAllCheckbox() {
        const visibleStudentIds = this.filteredStudentData.map(s => s.id);
        const allVisibleSelected = visibleStudentIds.length > 0 &&
            visibleStudentIds.every(id => this.selectedStudents.has(id));
        const someVisibleSelected = visibleStudentIds.some(id => this.selectedStudents.has(id));

        ['#select-all-students', '#select-visible-students-mobile'].forEach(selector => {
            const checkbox = $(selector);
            if (!checkbox) return;
            checkbox.checked = allVisibleSelected;
            checkbox.indeterminate = !allVisibleSelected && someVisibleSelected;
        });
    }

    async handleBulkCoinAdjust() {
        if (this.selectedStudents.size === 0) {
            alert('Please select at least one student.');
            return;
        }

        const input = $('#bulk-coin-input');
        const amount = parseInt(input?.value, 10) || 0;

        if (amount <= 0) {
            alert('Please enter a positive number of coins.');
            return;
        }

        const confirmed = confirm(
            `Add ${amount} coins to ${this.selectedStudents.size} selected student${this.selectedStudents.size > 1 ? 's' : ''}?`
        );

        if (!confirmed) return;

        try {
            for (const studentId of this.selectedStudents) {
                const student = this.allStudentData.find(s => s.id === studentId);
                if (!student) continue;

                const progress = await supabaseService.giftStudentCoins({
                    studentId,
                    amount,
                    message: 'Bulk gift from teacher'
                });

                // Update local data
                student.coins = progress.coinData?.balance ?? progress.coins ?? student.coins ?? 0;
                student.coinData = progress.coinData || student.coinData;
                const filteredItem = this.filteredStudentData.find(s => s.id === studentId);
                if (filteredItem) {
                    filteredItem.coins = student.coins;
                    filteredItem.coinData = student.coinData;
                }
            }

            alert(`Successfully gifted ${amount} coins to ${this.selectedStudents.size} student${this.selectedStudents.size > 1 ? 's' : ''}! They will receive a notification when they log in.`);

            // Clear selection and refresh UI
            this.clearSelection();
            this.renderProgressTable();
        } catch (error) {
            console.error('Bulk coin adjustment failed:', error);
            alert('Failed to update coins. Please try again.');
        }
    }
}

export function installTeacherStudentProgressCoinMethods(TeacherManager) {
    for (const name of Object.getOwnPropertyNames(TeacherStudentProgressCoinMethods.prototype)) {
        if (name === 'constructor') continue;
        Object.defineProperty(
            TeacherManager.prototype,
            name,
            Object.getOwnPropertyDescriptor(TeacherStudentProgressCoinMethods.prototype, name)
        );
    }
}
