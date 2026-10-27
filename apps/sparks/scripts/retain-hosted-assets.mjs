import { mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const immutableName = /^[^/]+-[\w-]{8,}\.[a-z0-9]+$/i;

// A validated artifact may already contain assets retained during validation.
// Keep every emitted entry, lazy chunk and asset in its own build manifest first.
export async function pruneCandidateAssets(outputDirectory) {
  const manifest = JSON.parse(await readFile(resolve(outputDirectory, '.vite/manifest.json'), 'utf8'));
  const keep = new Set();
  for (const entry of Object.values(manifest)) {
    for (const path of [entry.file, ...entry.css || [], ...entry.assets || []]) {
      if (path) keep.add(path);
    }
  }
  if (!Object.keys(manifest).length || ![...keep].some(path => path.startsWith('assets/'))) {
    throw new Error('Candidate build manifest contains no immutable assets.');
  }
  let removed = 0;
  for (const entry of await readdir(resolve(outputDirectory, 'assets'), { withFileTypes: true })) {
    if (!entry.isFile() || !immutableName.test(entry.name) || keep.has(`assets/${entry.name}`)) continue;
    await rm(resolve(outputDirectory, 'assets', entry.name));
    removed++;
  }
  return { removed };
}

// Always recover the actual currently published graph, never a workflow artifact
// that may have passed validation without being deployed.
export async function retainHostedAssets(siteUrl, outputDirectory = 'dist-desktop') {
  const base = new URL(siteUrl.endsWith('/') ? siteUrl : `${siteUrl}/`);
  const assetPrefix = `${base.pathname}assets/`;
  const preview = new URL('student-preview.html', base).href;
  const pending = ['index.html', 'student.html', 'teacher.html', 'student-preview.html', 'student-sw.js'].map(path => new URL(path, base));
  const seen = new Set();
  let copied = 0;
  while (pending.length) {
    const batch = pending.splice(0, 6).filter(url => {
      if (seen.has(url.href)) return false;
      seen.add(url.href);
      return true;
    });
    await Promise.all(batch.map(async url => {
      const asset = url.pathname.startsWith(assetPrefix);
      const target = asset ? resolve(outputDirectory, url.pathname.slice(base.pathname.length)) : null;
      let contents;
      if (asset) {
        try { contents = await readFile(target); }
        catch (error) { if (error.code !== 'ENOENT') throw error; }
      }
      if (!contents) {
        const response = await fetch(url, { headers: { 'Cache-Control': 'no-cache' }, signal: AbortSignal.timeout(30000) });
        // Older releases did not publish a separate preview entry.
        if (url.href === preview && response.status === 404) return;
        if (!response.ok) throw new Error(`Could not retain published asset ${url.pathname}: HTTP ${response.status}`);
        contents = Buffer.from(await response.arrayBuffer());
        if (asset) {
          await mkdir(dirname(target), { recursive: true });
          await writeFile(target, contents, { flag: 'wx' });
          copied++;
        }
      }
      if (!/\.(?:html|js|css)$/.test(url.pathname)) return;
      const source = contents.toString('utf8');
      const references = [...source.matchAll(/["'`]([^"'`\s<>]+?\.(?:js|css|woff2?|png|svg|jpe?g|webp|ico|gif|mp3|ogg|wav))(?:\?[^"'`\s<>]*)?["'`]/g),
        ...source.matchAll(/url\(\s*([^\s"')]+)\s*\)/g)];
      for (const [, reference] of references) {
        let dependency;
        try { dependency = new URL(reference, reference.startsWith('assets/') ? base : url); }
        catch { continue; }
        // Only Vite's immutable assets belong here, never app data, external URLs,
        // or arbitrary paths found in a JavaScript string.
        if (dependency.origin !== base.origin || !dependency.pathname.startsWith(assetPrefix)
          || !immutableName.test(dependency.pathname.slice(assetPrefix.length))) continue;
        dependency.search = ''; dependency.hash = '';
        if (!seen.has(dependency.href)) pending.push(dependency);
      }
    }));
    if (seen.size > 2000) throw new Error('Published asset graph exceeds the retention safety limit.');
  }
  if (![...seen].some(path => new URL(path).pathname.startsWith(assetPrefix))) throw new Error('No published immutable assets were found.');
  console.log(`Retained ${copied} hosted assets; checked ${seen.size} published resources.`);
  return { copied, checked: seen.size };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  await pruneCandidateAssets(process.argv[3] || 'dist-desktop');
  await retainHostedAssets(process.argv[2], process.argv[3]);
}
