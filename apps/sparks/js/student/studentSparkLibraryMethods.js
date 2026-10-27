import { $, createElement, escapeHtml, refreshIcons } from '../main.js';
import { imageDB } from '../db.js';
import {
    getActiveStudentStorageOwner,
    isActiveStudentStorageOwner
} from './persistence/studentStorage.js';
import { classifySyncError } from '../services/syncQueuePolicy.js';
import { getPanamaDateValue } from '../services/dateUtils.js';
import { sparkResponsesRepository } from '../services/sparkResponsesRepository.js';
import { sparksRepository } from '../services/sparksRepository.js';
import { serverStateQuery } from '../services/serverStateQuery.js';
import { normalizeSchoolCalendar } from '../services/vocabularyApi.js';
import {
    evaluateSparkAnswers,
    getSparkQuestionsForGrade,
    SPARK_CHECK_MODES
} from '../sparkCheckModel.js';
import {
    isAllGradeSpark,
    normalizeSparkRecord
} from '../sparkModel.js';
import { getStudentPageSkeleton, setStudentPageLoading } from './studentLoadingSkeletons.js';
import { loadStudentSparkStyles } from './studentLibraryStyleLoader.js';
import { requestWithTimeout } from '../services/requestReliability.js';

export const sparkLibraryMethods = {
async fetchAvailableSparks() {
        if (this.sm.authDisabled || !this.sm.currentUser) return [];
        const subjectSlug = this.sm.selectedSubjectSlug || 'technology';
        const dateValue = getPanamaDateValue();
        const dateRange = this.getCurrentSparkDateRange(dateValue);
        const grade = this.getStudentGradeLevel();
        const accountId = this.sm.currentUser.uid || this.sm.currentUser.id;
        return this.queryService.ensure({
            accountId,
            key: ['student', 'scheduled-sparks', 'library', subjectSlug, grade || 'all', dateRange],
            queryFn: async () => {
                const sparks = (await sparksRepository.listScheduledForStudent({
                    subjectSlug,
                    onOrAfter: dateRange.onOrAfter,
                    onOrBefore: dateRange.onOrBefore,
                    targetGrade: grade,
                    limit: 20
                })).map(spark => this.normalizeSpark(spark));
                return grade
                    ? sparks.filter(spark => spark.targetGrades.includes(grade) || isAllGradeSpark(spark))
                    : sparks.filter(isAllGradeSpark);
            }
        });
    },

async hydrateSparkLibraryProgress(sparkIds = [], { isCurrent = () => true } = {}) {
        if (!isCurrent()) return;
        const localProgress = this.loadSparkLibraryProgress();
        if (this.sm.authDisabled || !this.sm.currentUser || sparkIds.length === 0) return localProgress;
        try {
            const cloudResponses = await sparkResponsesRepository.listOwn(sparkIds);
            if (!isCurrent()) return;
            const merged = this.mergeSparkLibraryProgress(localProgress, cloudResponses);
            this.persistSparkLibraryProgress(merged);
            this.retryPendingSparkResponses(merged);
            return merged;
        } catch (error) {
            if (!isCurrent()) return;
            console.warn('Could not load saved Spark responses:', error);
            this.retryPendingSparkResponses(localProgress);
            return localProgress;
        }
    },

async syncSparkLibraryState(state, sequence) {
        const queueGeneration = this.sm.progress?.syncQueue?.cloud.cloudGeneration;
        const ownerUserId = this.sm.currentUser?.uid || getActiveStudentStorageOwner();
        try {
            const saved = await sparkResponsesRepository.submit(state, { ownerUserId });
            if (!isActiveStudentStorageOwner(ownerUserId) || this.sm.currentUser?.uid !== ownerUserId) return;
            if (this.sparkResponseSyncSequence.get(state.sparkId) !== sequence) return;
            const progress = this.loadSparkLibraryProgress();
            progress[state.sparkId] = saved;
            this.persistSparkLibraryProgress(progress);
            this.activities.updateArcadeGateDisplay();
            this.sm.setAuthStatus?.('Synced');
        } catch (error) {
            if (!isActiveStudentStorageOwner(ownerUserId) || this.sm.currentUser?.uid !== ownerUserId) return;
            if (this.sparkResponseSyncSequence.get(state.sparkId) !== sequence) return;
            const failure = classifySyncError(error, { online: navigator.onLine });
            if (failure.retryable) {
                try {
                    await imageDB.enqueueSyncAction('student-spark-response', {
                        sparkId: state.sparkId,
                        answers: state.answers || {},
                        storageKey: this.getSparkLibraryStorageKey()
                    }, { ownerUserId });
                    this.sm.progress?.syncQueue?.scheduleRetry({ ownerUserId, generation: queueGeneration });
                } catch (queueError) {
                    if (!isActiveStudentStorageOwner(ownerUserId) || this.sm.currentUser?.uid !== ownerUserId) return;
                    console.warn('Could not queue the Spark response for later sync:', queueError);
                    const message = queueError?.code === 'SYNC_QUEUE_FULL'
                        ? 'Local sync storage is full' : 'Could not save changes for sync';
                    const queue = this.sm.progress?.syncQueue;
                    if (queue) queue.setQueueStatus(message, ownerUserId, queue.cloud.cloudGeneration);
                    else this.sm.setAuthStatus?.(message);
                    this.sm.showToast?.('Your latest Spark answers could not be queued. Reconnect and save again.');
                    return;
                }
                this.sm.setAuthStatus?.(navigator.onLine ? 'Sync failed - saved locally' : 'Saved locally - offline');
            } else {
                this.sm.setAuthStatus?.('Spark response rejected');
            }
            console.warn('Could not sync Spark response:', error);
        }
    },

async renderSparkLibrary({ loadStyles = loadStudentSparkStyles, timeoutMs = 10000 } = {}) {
        const scope = this.captureCurrentSparkScope();
        const navigation = this.sm.routing?.arcadeReadController?.signal;
        const current = () => scope() && !navigation?.aborted && navigation === this.sm.routing?.arcadeReadController?.signal
            && (this.sm.parseRoute?.()?.view || 'sparks') === 'sparks';
        const container = $('#student-sparks-library');
        if (!container) return;
        const view = $('#student-sparks-view');
        setStudentPageLoading(view, true);
        container.innerHTML = getStudentPageSkeleton('sparks', 'Loading Sparks');
        try {
            await requestWithTimeout(() => loadStyles(), { signal: navigation, timeoutMs, label: 'Loading Sparks styles' });
            if (!current()) return;
            this.activities.renderSubjectPicker('#spark-subject-picker');
            const sparks = await this.fetchAvailableSparks();
            if (!current()) return;
            if (sparks.length === 0) {
                container.innerHTML = '<p class="teacher-empty-state">No Sparks are available for this class yet.</p>';
                return;
            }
            this.currentSpark = sparks[0];
            const progress = await this.hydrateSparkLibraryProgress(sparks.map(spark => spark.id));
            if (!current()) return;
            const dateRange = this.getCurrentSparkDateRange();
            const { SparkReadingActivity } = await import('../activities/sparkReading.js');
            if (!current()) return;
            new SparkReadingActivity(
                container,
                {
                    subjectSlug: this.sm.selectedSubjectSlug || 'technology',
                    grade: this.getStudentGradeLevel(),
                    scheduledDate: dateRange.onOrBefore,
                    onOrAfter: dateRange.onOrAfter,
                    loadSparks: async () => sparks,
                    getSparkState: sparkId => progress[sparkId] || null
                },
                null,
                state => this.saveSparkLibraryState(state),
                progress[sparks[0].id] || null
            );
        } catch (error) {
            if (!current()) return;
            console.error('Failed to render Spark library', error);
            container.innerHTML = '<p class="teacher-empty-state student-library-load-error" role="alert">Could not load Sparks. Please try again, or reload the page if the problem continues.</p>';
        } finally {
            if (current()) setStudentPageLoading(view, false);
        }
    }
,
async fetchCurrentSpark({ isCurrent = () => true } = {}) {
        if (!isCurrent()) return;
        if (this.sm.authDisabled || !this.sm.currentUser) return null;
        const subjectSlug = this.sm.selectedSubjectSlug || 'technology';
        const dateValue = getPanamaDateValue();
        const dateRange = this.getCurrentSparkDateRange(dateValue);
        const grade = this.getStudentGradeLevel();
        const accountId = this.sm.currentUser.uid || this.sm.currentUser.id;
        const currentSpark = await this.queryService.ensure({
            accountId,
            key: ['student', 'scheduled-sparks', 'current', subjectSlug, grade || 'all', dateRange],
            queryFn: async () => {
                const sparks = (await sparksRepository.listScheduledForStudent({
                    subjectSlug,
                    onOrAfter: dateRange.onOrAfter,
                    onOrBefore: dateRange.onOrBefore,
                    targetGrade: grade,
                    limit: 1
                })).map(spark => this.normalizeSpark(spark));
                if (grade) {
                    const gradeMatch = sparks.find(spark => spark.targetGrades.includes(grade));
                    if (gradeMatch) return gradeMatch;
                }
                return sparks.find(isAllGradeSpark) || null;
            }
        });
        if (!isCurrent()) return;
        this.currentSpark = currentSpark;
        return currentSpark;
    }
};
