import { normalizeProgressContext, readProgressContext, writeProgressContext } from './teacherClassProgressModel.js';

export function readGradebookContext(params) {
    if (params.get('display') !== 'grades') return {};
    const adapted = new URLSearchParams(params); adapted.set('display', 'progress');
    const { progressContext } = readProgressContext(adapted);
    return { gradebookContext: { ...progressContext, studentId: String(params.get('student') || '').slice(0, 100) } };
}
export function writeGradebookContext(params, context) {
    if (!context) return;
    writeProgressContext(params, normalizeProgressContext(context));
    params.set('display', 'grades');
    if (context.studentId) params.set('student', String(context.studentId).slice(0, 100));
}
