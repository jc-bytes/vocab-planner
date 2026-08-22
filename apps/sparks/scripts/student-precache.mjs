export function collectStudentPrecacheFiles(manifest, entryKey) {
    const files = new Set(['student.html', 'vocabularies/manifest.json']);
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
