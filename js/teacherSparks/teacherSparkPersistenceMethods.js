import { closeModal as closeDialog, notifications } from '../main.js';
import { sparksRepository } from '../services/sparksRepository.js';
import { isDuplicateScheduledDateError } from './sparkSchedule.js';

export const teacherSparkPersistenceMethods = {
async saveSparkFromForm(statusOverride = null) {
        if (!this.ensureAuthenticated()) return;

        let spark;
        try {
            spark = this.readSparkForm(statusOverride);
        } catch (error) {
            this.setSparkModalStatus(error.message, 'error');
            notifications.warning(error.message);
            return;
        }

        this.setSparkModalStatus('Saving Spark...', 'info');
        try {
            await sparksRepository.save(spark.id, {
                ...spark,
                updatedAt: new Date().toISOString()
            });
            this.invalidateWeeklySparkCache();
            closeDialog('#spark-modal');
            notifications.success(spark.status === 'scheduled' ? 'Spark scheduled.' : 'Spark saved.');
            await this.loadWeeklySparks({ forceRefresh: true });
        } catch (error) {
            console.error('Failed to save Spark:', error);
            const message = isDuplicateScheduledDateError(error)
                ? 'A Spark with that exact schedule already exists. Check the date and try again.'
                : 'Could not save this Spark. Check the fields and try again.';
            this.setSparkModalStatus(message, 'error');
            notifications.error(message);
        }
    },

async archiveSpark(id) {
        if (!this.ensureAuthenticated()) return;
        const spark = this.findSparkById(id);
        if (!spark) return;

        try {
            await sparksRepository.save(id, {
                ...spark,
                status: 'archived',
                updatedAt: new Date().toISOString()
            });
            this.invalidateWeeklySparkCache();
            notifications.success('Spark archived.');
            await this.loadWeeklySparks({ forceRefresh: true });
        } catch (error) {
            console.error('Failed to archive Spark:', error);
            notifications.error('Could not archive this Spark.');
        }
    },
};

