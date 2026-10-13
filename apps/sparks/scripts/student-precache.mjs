export function collectStudentShellFiles(manifest, entryKey) {
    const files = new Set(['student.html']);
    const visitedChunks = new Set();

    function collectStaticChunk(key) {
        if (!key || visitedChunks.has(key)) return;
        visitedChunks.add(key);

        const chunk = manifest[key];
        if (!chunk) return;
        if (chunk.file) files.add(chunk.file);
        for (const cssFile of chunk.css || []) files.add(cssFile);
        for (const assetFile of chunk.assets || []) files.add(assetFile);
        for (const importedKey of chunk.imports || []) collectStaticChunk(importedKey);
    }

    collectStaticChunk(entryKey);
    return files;
}

// Download optional code for offline/version compatibility without executing it.
// Large game media and teacher-only chunks remain outside the student graph.
export function collectStudentPrecacheFiles(manifest, entryKey) {
    const files = collectStudentShellFiles(manifest, entryKey);
    const visited = new Set();
    function collect(key) {
        if (visited.has(key)) return;
        visited.add(key);
        const chunk = manifest[key];
        if (!chunk?.file) throw new Error(`Student code graph is missing ${key}.`);
        files.add(chunk.file);
        for (const file of chunk.css || []) files.add(file);
        for (const child of [...(chunk.imports || []), ...(chunk.dynamicImports || [])]) collect(child);
    }
    collect(entryKey);
    return files;
}
