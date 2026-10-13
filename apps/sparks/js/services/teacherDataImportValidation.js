import {
    array,
    check,
    looseObject,
    optional,
    parse,
    pipe,
    unknown
} from 'valibot';

const exportCollectionSchema = array(looseObject({}));

const teacherDataExportSchema = pipe(
    looseObject({
        studentProgress: optional(exportCollectionSchema),
        scores: optional(exportCollectionSchema),
        userRoles: optional(exportCollectionSchema),
        metadata: optional(unknown())
    }),
    check(
        data => ['studentProgress', 'scores', 'userRoles']
            .some(field => Object.hasOwn(data, field)),
        'File must contain studentProgress, scores, or userRoles'
    )
);

function validationMessage(error) {
    const issue = error?.issues?.[0];
    const field = issue?.path?.[0]?.key;
    if (field && issue?.message) return `${field}: ${issue.message}`;
    return issue?.message || 'File does not match the Sparks export format';
}

export function parseTeacherDataExport(text) {
    let data;
    try {
        data = JSON.parse(text);
    } catch (_error) {
        throw new Error('File contains invalid JSON');
    }

    try {
        return parse(teacherDataExportSchema, data);
    } catch (error) {
        throw new Error(`Invalid export format: ${validationMessage(error)}`);
    }
}
