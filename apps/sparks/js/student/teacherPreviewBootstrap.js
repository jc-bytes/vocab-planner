// Preview runs the real activities, with browser storage kept in this frame only.
function memoryStorage() {
    const values = new Map();
    return { get length() { return values.size; }, key: index => [...values.keys()][index] ?? null,
        getItem: key => values.get(String(key)) ?? null,
        setItem: (key, value) => values.set(String(key), String(value)),
        removeItem: key => values.delete(String(key)), clear: () => values.clear() };
}
let started = false;
async function start(payload) {
    if (started || !['teacher-unit-preview', 'teacher-spark-preview'].includes(payload?.type)) return;
    started = true;
    try {
        Object.defineProperty(window, 'localStorage', { value: memoryStorage(), configurable: true });
        Object.defineProperty(window, 'sessionStorage', { value: memoryStorage(), configurable: true });
        document.querySelector('[role="status"]').textContent = 'Loading activities…';
        if (payload.type === 'teacher-spark-preview') {
            const { mountTeacherSparkPreview } = await import('./teacherSparkPreviewRuntime.js');
            await mountTeacherSparkPreview(payload.spark, payload.grade);
        } else {
            const { mountTeacherUnitPreview } = await import('./teacherPreviewRuntime.js');
            await mountTeacherUnitPreview(payload.vocab, payload.subjects, payload.initialActivity);
        }
        parent.postMessage({ type: 'teacher-unit-preview-mounted' }, location.origin);
    } catch (error) {
        const message = `Student preview could not load. ${error.message}`;
        document.body.textContent = message;
        parent.postMessage({ type: 'teacher-unit-preview-error', message }, location.origin);
    }
}
if (window.parent !== window) {
    const payload = window.frameElement?.teacherPreviewPayload;
    if (payload) void start(payload);
    else {
        // Retain message startup for standalone integration harnesses.
        const receive = event => {
            if (event.source !== parent || event.origin !== location.origin) return;
            if (!['teacher-unit-preview', 'teacher-spark-preview'].includes(event.data?.type)) return;
            window.removeEventListener('message', receive); void start(event.data);
        };
        window.addEventListener('message', receive);
        parent.postMessage({ type: 'teacher-unit-preview-ready' }, location.origin);
    }
}
