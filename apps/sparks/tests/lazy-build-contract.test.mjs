import assert from 'node:assert/strict';
import test from 'node:test';

import {
  REQUIRED_LAZY_EDGES,
  validateLazyBuildContracts
} from '../scripts/lib/lazyBuildContracts.mjs';

function createValidManifest() {
  const manifest = {
    student: { name: 'student', file: 'student.js', imports: ['shared'], dynamicImports: [] },
    teacher: { name: 'teacher', file: 'teacher.js', imports: ['shared'], dynamicImports: [] },
    shared: { name: 'shared', file: 'shared.js' },
    'js/student/studentFeatureStyles.js': { file: 'student-features.css' }
  };
  for (const { parent, children } of REQUIRED_LAZY_EDGES) {
    const parentKey = Object.keys(manifest).find(key => manifest[key].name === parent) || parent;
    manifest[parentKey] ||= { name: parent, file: `${parent}.js`, isDynamicEntry: true, dynamicImports: [] };
    manifest[parentKey].dynamicImports ||= [];
    for (const child of children) {
      const childKey = child;
      manifest[childKey] ||= { name: child, file: `${child}.js`, isDynamicEntry: true };
      manifest[parentKey].dynamicImports.push(childKey);
    }
  }
  return manifest;
}

test('the production contract covers every intended feature-level lazy edge', () => {
  const result = validateLazyBuildContracts(createValidManifest());
  assert.deepEqual(result, { checkedEdges: 9, optionalFeatureCount: 9 });
});

test('the lazy contract rejects a missing, eager, or incorrectly linked child', () => {
  const missing = createValidManifest();
  delete missing.reportGenerator;
  assert.throws(() => validateLazyBuildContracts(missing), /missing reportGenerator/);

  const eager = createValidManifest();
  eager.quizMaker.isDynamicEntry = false;
  assert.throws(() => validateLazyBuildContracts(eager), /quizMaker must remain a dynamic/);

  const unlinked = createValidManifest();
  unlinked.teacherQuiz.dynamicImports = [];
  assert.throws(() => validateLazyBuildContracts(unlinked), /teacherQuiz must load quizMaker/);

  const staticChild = createValidManifest();
  staticChild.teacherDataManagement.imports = ['teacher-charts'];
  assert.throws(() => validateLazyBuildContracts(staticChild), /teacherDataManagement loads teacher-charts through its static graph/);
});

test('student and teacher initial graphs reject optional features, activities, and games', () => {
  const optionalFeature = createValidManifest();
  optionalFeature.student.imports.push('studentGames');
  assert.throws(() => validateLazyBuildContracts(optionalFeature), /student loads studentGames through its static graph/);

  const activity = createValidManifest();
  activity['js/activities/quiz.js'] = { name: 'quiz', file: 'quiz.js' };
  activity.student.imports.push('js/activities/quiz.js');
  assert.throws(() => validateLazyBuildContracts(activity), /student loads js\/activities\/quiz\.js eagerly/);

  const game = createValidManifest();
  game['js/games/snake.js'] = { name: 'snake', file: 'snake.js' };
  game.teacher.imports.push('js/games/snake.js');
  assert.throws(() => validateLazyBuildContracts(game), /teacher loads js\/games\/snake\.js eagerly/);

  const featureStyles = createValidManifest();
  featureStyles.student.imports.push('js/student/studentFeatureStyles.js');
  assert.throws(() => validateLazyBuildContracts(featureStyles), /student loads deferred asset js\/student\/studentFeatureStyles\.js eagerly/);
});

test('duplicate manifest names and broken static imports fail clearly', () => {
  const duplicate = createValidManifest();
  duplicate.anotherStudent = { name: 'student', file: 'other.js' };
  assert.throws(() => validateLazyBuildContracts(duplicate), /duplicate entries named student/);

  const broken = createValidManifest();
  broken.student.imports.push('missing');
  assert.throws(() => validateLazyBuildContracts(broken), /missing or has no emitted file/);
});

test('student precache cannot contain lazy feature code, styles, or assets', () => {
  const manifest = createValidManifest();
  manifest.studentGames.css = ['student-games.css'];
  manifest.studentGames.assets = ['game-cover.webp'];
  assert.doesNotThrow(() => validateLazyBuildContracts(manifest, {
    precacheFiles: new Set(['student.html', 'student.js', 'shared.js'])
  }));
  for (const file of ['studentGames.js', 'student-games.css', 'game-cover.webp']) {
    assert.throws(() => validateLazyBuildContracts(manifest, {
      precacheFiles: new Set(['student.html', file])
    }), new RegExp(`Student precache includes lazy delivery file ${file.replace('.', '\\.')}\\.`));
  }
  assert.throws(() => validateLazyBuildContracts(manifest, {
    precacheFiles: new Set(['student.html', 'student-features.css'])
  }), /Student precache includes lazy delivery file student-features\.css/);
});
