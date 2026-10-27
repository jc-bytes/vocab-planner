import { StudentActivityAttemptService } from './studentActivityAttemptService.js';
import { StudentActivityAutoSave } from './studentActivityAutoSave.js';
import { StudentActivityStateStore } from './studentActivityStateStore.js';
import { StudentActivitySyncCoordinator } from './studentActivitySyncCoordinator.js';
import { StudentActivityWorkTimer } from './studentActivityWorkTimer.js';

export function createStudentActiveRuntime(persistence) {
    return Object.freeze({
        attemptService: new StudentActivityAttemptService(persistence),
        autoSave: new StudentActivityAutoSave(persistence),
        stateStore: new StudentActivityStateStore(persistence.activities),
        syncCoordinator: new StudentActivitySyncCoordinator(persistence),
        workTimer: new StudentActivityWorkTimer({ onReport: snapshot => persistence.reportActiveTime(snapshot) })
    });
}
