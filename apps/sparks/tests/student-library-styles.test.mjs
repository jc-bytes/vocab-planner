import assert from 'node:assert/strict';
import test from 'node:test';
import { createStudentLibraryStyleLoaders } from '../js/student/studentLibraryStyleLoader.js';

const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };
test('both real library consumers retain the same failed shared stylesheet', async () => {
    let shared = 0, spark = 0;
    const styles = createStudentLibraryStyleLoaders({ loadLibrary: async () => { shared++; throw new Error('Shared CSS unavailable'); }, loadSpark: async () => { spark++; } });
    await assert.rejects(styles.spark(), /Shared CSS unavailable/);
    await assert.rejects(styles.library(), /Shared CSS unavailable/);
    await assert.rejects(styles.spark(), /Shared CSS unavailable/);
    assert.equal(shared, 1); assert.equal(spark, 0);
});
test('specialized Spark style failure never poisons healthy Units styles', async () => {
    let shared = 0, spark = 0;
    const styles = createStudentLibraryStyleLoaders({ loadLibrary: async () => { shared++; }, loadSpark: async () => { spark++; throw new Error('Spark CSS unavailable'); } });
    await assert.rejects(styles.spark(), /Spark CSS unavailable/);
    await styles.library();
    await assert.rejects(styles.spark(), /Spark CSS unavailable/);
    assert.equal(shared, 1); assert.equal(spark, 1);
});
for (const first of ['library', 'spark']) test(`${first} first preserves shared-before-specialized order and one successful application`, async () => {
    const hold = deferred(), applied = [];
    const styles = createStudentLibraryStyleLoaders({ loadLibrary: async () => { await hold.promise; applied.push('shared'); }, loadSpark: async () => { applied.push('spark'); } });
    const pending = styles[first](), both = styles.spark();
    await Promise.resolve(); assert.deepEqual(applied, []);
    hold.resolve(); await Promise.all([pending, both]); await styles.library(); await styles.spark();
    assert.deepEqual(applied, ['shared', 'spark']);
});
