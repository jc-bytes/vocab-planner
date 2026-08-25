import { isDuplicateScheduledDateError } from './sparkSchedule.js';

export const teacherSparkPersistenceMethods = {
async saveSparkFromForm(statusOverride = null) {
        if (!this.ensureAuthenticated()) return;

        let spark;
        try {
            spark = this.readSparkForm(statusOverride);
        } catch (error) {
            this.setSparkModalStatus(error.message, 'error');
            this.feedback.warning(error.message);
            return;
        }

        const lifecycleGeneration = this.weeklySparkLifecycleGeneration;
        this.setSparkModalStatus('Saving Spark...', 'info');
        try {
            await this.repository.save(spark.id, {
                ...spark,
                updatedAt: new Date().toISOString()
            });
            if (lifecycleGeneration !== this.weeklySparkLifecycleGeneration) return;
            this.invalidateWeeklySparkCache();
            this.closeDialog('#spark-modal');
            this.feedback.success(spark.status === 'scheduled' ? 'Spark scheduled.' : 'Spark saved.');
            await this.loadWeeklySparks({ forceRefresh: true });
        } catch (error) {
            if (lifecycleGeneration !== this.weeklySparkLifecycleGeneration) return;
            console.error('Failed to save Spark:', error);
            const message = isDuplicateScheduledDateError(error)
                ? 'A Spark with that exact schedule already exists. Check the date and try again.'
                : 'Could not save this Spark. Check the fields and try again.';
            this.setSparkModalStatus(message, 'error');
            this.feedback.error(message);
        }
    },

async archiveSpark(id) {
        if (!this.ensureAuthenticated()) return;
        const spark = this.findSparkById(id);
        if (!spark) return;

        const lifecycleGeneration = this.weeklySparkLifecycleGeneration;
        try {
            await this.repository.save(id, {
                ...spark,
                status: 'archived',
                updatedAt: new Date().toISOString()
            });
            if (lifecycleGeneration !== this.weeklySparkLifecycleGeneration) return;
            this.invalidateWeeklySparkCache();
            this.feedback.success('Spark archived.');
            await this.loadWeeklySparks({ forceRefresh: true });
        } catch (error) {
            if (lifecycleGeneration !== this.weeklySparkLifecycleGeneration) return;
            console.error('Failed to archive Spark:', error);
            this.feedback.error('Could not archive this Spark.');
        }
    },
};
