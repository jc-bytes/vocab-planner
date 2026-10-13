export function readingReviewStatus(response, feedback) {
    if (!response) return 'Not started';
    const decision = feedback?.review_status;
    const sameSubmission = Number(feedback?.response_revision) > 0
        && Number(feedback.response_revision) === Number(response.revision);
    if (decision && decision !== 'unreviewed') {
        if (!sameSubmission) return 'Needs review';
        if (decision === 'needs_revision') return 'Needs revision';
        if (decision === 'reviewed') return response.evaluation?.isComplete === true ? 'Completed' : 'In progress';
    }
    if (response.evaluation?.needsTeacherReview !== false) return 'Needs review';
    return response.evaluation?.isComplete === true ? 'Completed' : 'In progress';
}
export function assignmentFeedback(assignment, activityType = '') {
    return (assignment.feedback || []).find(f => f.activity_type === activityType) || null;
}
