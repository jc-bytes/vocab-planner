export function createStudentFeatureStyleLoader(load = () => import('./studentFeatureStyles.js')) {
    // Retain rejection too: Vite may mark failed CSS as seen on a later import.
    let pending;
    return () => pending ||= Promise.resolve().then(load);
}

export const loadStudentFeatureStyles = createStudentFeatureStyleLoader();
