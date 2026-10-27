import { createStudentFeatureStyleLoader } from './studentFeatureStyleLoader.js';

// Both library renderers share rejection too: a failed Vite CSS import must
// never become a false successful retry through the other view.
export function createStudentLibraryStyleLoaders({
    loadLibrary = () => import('./studentLibraryStyles.js'),
    loadSpark = () => import('./studentClassSparkStyles.js')
} = {}) {
    const library = createStudentFeatureStyleLoader(loadLibrary);
    const spark = createStudentFeatureStyleLoader(loadSpark);
    return Object.freeze({ library, async spark() { await library(); await spark(); } });
}

const styles = createStudentLibraryStyleLoaders();
export const loadStudentLibraryStyles = styles.library;
export const loadStudentSparkStyles = styles.spark;
