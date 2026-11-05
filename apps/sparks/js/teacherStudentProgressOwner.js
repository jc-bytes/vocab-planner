import { schoolContext } from './services/schoolContext.js';

// Capture before confirmation or prompting. Repository ownership starts when a
// request is invoked and cannot identify a stale UI action from an earlier user.
export function captureTeacherProgressOwner(manager) {
    const user = manager.currentUser, generation = manager.studentProgressSessionGeneration || 0;
    const schoolGeneration = schoolContext.getGeneration(), localMode = manager.authDisabled;
    return () => user === manager.currentUser && generation === (manager.studentProgressSessionGeneration || 0)
        && schoolGeneration === schoolContext.getGeneration() && localMode === manager.authDisabled;
}
