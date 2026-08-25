import { collectStaticImportKeys } from './deliverySizeBudgets.mjs';

export const REQUIRED_LAZY_EDGES = Object.freeze([
  Object.freeze({ parent: 'student', children: Object.freeze(['studentGames', 'reportGenerator']) }),
  Object.freeze({
    parent: 'teacher',
    children: Object.freeze([
      'teacherSparks',
      'teacherGroups',
      'teacherDataManagement',
      'teacherWordHuntReview',
      'teacherQuiz'
    ])
  }),
  Object.freeze({ parent: 'teacherDataManagement', children: Object.freeze(['teacher-charts']) }),
  Object.freeze({ parent: 'teacherQuiz', children: Object.freeze(['quizMaker']) })
]);

const OPTIONAL_FEATURE_NAMES = Object.freeze([
  ...new Set(REQUIRED_LAZY_EDGES.flatMap(edge => edge.children))
]);

const REQUIRED_DEFERRED_KEYS = Object.freeze([
  'js/student/studentFeatureStyles.js'
]);

function indexManifestByName(manifest) {
  const byName = new Map();
  for (const [key, entry] of Object.entries(manifest)) {
    if (!entry?.name) continue;
    if (byName.has(entry.name)) {
      throw new Error(`Production manifest has duplicate entries named ${entry.name}.`);
    }
    byName.set(entry.name, { key, entry });
  }
  return byName;
}

export function validateLazyBuildContracts(manifest, { precacheFiles = null } = {}) {
  const byName = indexManifestByName(manifest);

  for (const { parent, children } of REQUIRED_LAZY_EDGES) {
    const parentRecord = byName.get(parent);
    if (!parentRecord) throw new Error(`Production manifest is missing ${parent}.`);
    const dynamicImports = new Set(parentRecord.entry.dynamicImports || []);
    const staticImports = collectStaticImportKeys(manifest, parentRecord.key);
    for (const child of children) {
      const childRecord = byName.get(child);
      if (!childRecord) throw new Error(`Production manifest is missing ${child}.`);
      if (childRecord.entry.isDynamicEntry !== true) {
        throw new Error(`${child} must remain a dynamic production entry.`);
      }
      if (staticImports.has(childRecord.key)) {
        throw new Error(`${parent} loads ${child} through its static graph.`);
      }
      if (!dynamicImports.has(childRecord.key)) {
        throw new Error(`${parent} must load ${child} through a dynamic import.`);
      }
    }
  }

  for (const entryName of ['student', 'teacher']) {
    const entryRecord = byName.get(entryName);
    if (!entryRecord) throw new Error(`Production manifest is missing ${entryName}.`);
    const staticKeys = collectStaticImportKeys(manifest, entryRecord.key);
    const staticNames = new Set(
      [...staticKeys].map(key => manifest[key]?.name).filter(Boolean)
    );
    const eagerFeature = OPTIONAL_FEATURE_NAMES.find(name => staticNames.has(name));
    if (eagerFeature) {
      throw new Error(`${entryName} loads optional feature ${eagerFeature} eagerly.`);
    }

    const eagerOwnedModule = [...staticKeys].find(key => (
      key.startsWith('js/games/') || key.startsWith('js/activities/')
    ));
    if (eagerOwnedModule) {
      throw new Error(`${entryName} loads ${eagerOwnedModule} eagerly.`);
    }

    if (entryName === 'student') {
      for (const deferredKey of REQUIRED_DEFERRED_KEYS) {
        if (!manifest[deferredKey]?.file) {
          throw new Error(`Production manifest is missing deferred asset ${deferredKey}.`);
        }
        if (staticKeys.has(deferredKey)) {
          throw new Error(`student loads deferred asset ${deferredKey} eagerly.`);
        }
      }
    }
  }

  if (precacheFiles) {
    const forbiddenPrecacheFiles = new Set();
    for (const [key, entry] of Object.entries(manifest)) {
      const isOptionalFeature = OPTIONAL_FEATURE_NAMES.includes(entry?.name);
      const isOwnedLazyModule = key.startsWith('js/games/') || key.startsWith('js/activities/');
      if (!isOptionalFeature && !isOwnedLazyModule && !REQUIRED_DEFERRED_KEYS.includes(key)) continue;
      if (entry.file) forbiddenPrecacheFiles.add(entry.file);
      for (const file of entry.css || []) forbiddenPrecacheFiles.add(file);
      for (const file of entry.assets || []) forbiddenPrecacheFiles.add(file);
    }
    const eagerPrecacheFile = [...precacheFiles].find(file => forbiddenPrecacheFiles.has(file));
    if (eagerPrecacheFile) {
      throw new Error(`Student precache includes lazy delivery file ${eagerPrecacheFile}.`);
    }
  }

  return Object.freeze({
    checkedEdges: REQUIRED_LAZY_EDGES.reduce((total, edge) => total + edge.children.length, 0),
    optionalFeatureCount: OPTIONAL_FEATURE_NAMES.length
  });
}
