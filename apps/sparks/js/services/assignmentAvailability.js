// Presentation checks mirror assignment dates; the server still authorizes every write.
export function assignmentUnavailableMessage(assignment, now = Date.now()) {
    if (assignment.withdrawn) return 'This unit has been withdrawn. Go back to Units and choose an available vocabulary.';
    const release = Date.parse(assignment.releaseAt ?? assignment.release_at);
    const close = Date.parse(assignment.closeAt ?? assignment.close_at);
    if (Number.isFinite(close) && close <= Number(now)) return 'This unit is closed. Go back to Units and choose an available vocabulary.';
    if (Number.isFinite(release) && release > Number(now)) return 'This unit is not available yet. Go back to Units and choose an available vocabulary.';
    return '';
}
