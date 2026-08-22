import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const root = new URL('../', import.meta.url);
const designPath = new URL('css/student-design-system.css', root);
const htmlPath = new URL('student.html', root);

const [designCss, studentHtml] = await Promise.all([
    readFile(designPath, 'utf8'),
    readFile(htmlPath, 'utf8')
]);

assert.match(studentHtml, /<body class="student-site">/, 'student.html must scope the student design system');
assert.match(studentHtml, /data-student-design-system/, 'student.html must load the student design-system stylesheet');

const typographyIndex = studentHtml.indexOf('css/typography.css');
const designIndex = studentHtml.indexOf('css/student-design-system.css');
assert.ok(typographyIndex >= 0 && designIndex > typographyIndex, 'student design-system stylesheet must load after shared typography');

const componentMarker = '/* Component contracts */';
const componentCss = designCss.slice(designCss.indexOf(componentMarker) + componentMarker.length);

assert.ok(!componentCss.includes('!important'), 'student design-system component rules must not use !important');
assert.ok(!/font-family\s*:\s*['"](?:Geist|JetBrains Mono)/i.test(designCss), 'student design system must not reference unbundled fonts');

const fontSizeDeclarations = [...componentCss.matchAll(/font-size\s*:\s*([^;]+);/g)];
const literalFontSizes = fontSizeDeclarations.filter(([, value]) => !value.trim().startsWith('var('));
assert.equal(literalFontSizes.length, 0, `use typography tokens instead of literal font sizes: ${literalFontSizes.map(match => match[0]).join(', ')}`);

const spacingDeclarations = [...componentCss.matchAll(/(?:^|[;{]\s*)(gap|row-gap|column-gap|padding(?:-(?:block|inline|top|right|bottom|left))?|margin(?:-(?:block|inline|top|right|bottom|left))?)\s*:\s*([^;]+);/gm)];
const literalSpacing = spacingDeclarations.filter(([, , value]) => !value.includes('var(--student-'));
assert.equal(literalSpacing.length, 0, `use student spacing tokens: ${literalSpacing.map(match => match[0].trim()).join(', ')}`);

console.log('Student design-system audit passed.');
