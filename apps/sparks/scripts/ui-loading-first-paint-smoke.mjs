import assert from 'node:assert/strict';
import { readFile, mkdir } from 'node:fs/promises';
import { chromium } from 'playwright';
import { ensureViteServer } from './lib/local-vite-server.mjs';

// Exercise actual entry HTML and loading templates before any application or
// lazy feature code runs. No accounts, database seeds, or external requests.
const built = process.env.LOADING_FIRST_PAINT_DIST === '1';
const manifest = built ? JSON.parse(await readFile(new URL('../dist-desktop/.vite/manifest.json',import.meta.url),'utf8')) : null;
const port = built ? 18342 : 18341, baseUrl = `http://127.0.0.1:${port}`;
const output = `/tmp/sparks-loading-first-paint/${built ? 'dist' : 'source'}`;
let server, browser;
const failures = [];
try {
    await mkdir(output, { recursive: true });
    server = await ensureViteServer({ baseUrl, probePath: '/student.html', host: '127.0.0.1', port,
        ...(built ? { args: ['vite', 'preview', '--outDir', 'dist-desktop', '--host', '127.0.0.1', '--port', String(port), '--strictPort'] } : {}) });
    browser = await chromium.launch();
    const page = await browser.newPage({ serviceWorkers: 'block' });
    await page.route('**/*.html*', async route => {
        const response = await route.fetch();
        const html = (await response.text()).replace(/<script\b[^>]*>[\s\S]*?<\/script>/g, '');
        await route.fulfill({ response, body: html });
    });
    const check = (condition, message) => { if (!condition) failures.push(message); };
    const bounds = async label => {
        const state = await page.evaluate(() => ({
            overflow: document.documentElement.scrollWidth > innerWidth + 1,
            leaked: [...document.querySelectorAll('[hidden]')].filter(el => {
                const r = el.getBoundingClientRect(); return r.width > 0 && r.height > 0;
            }).map(el => el.id || `${el.tagName}.${el.className}`),
            largeIcons: [...document.querySelectorAll('nav svg, header svg, aside svg, button svg')].filter(el => {
                const r = el.getBoundingClientRect(); return r.width > 48 || r.height > 48;
            }).map(el => el.id || el.getAttribute('class'))
        }));
        check(!state.overflow, `${label}: horizontal overflow`);
        check(!state.leaked.length, `${label}: hidden controls visible: ${state.leaked.join(', ')}`);
        check(!state.largeIcons.length, `${label}: oversized control icons: ${state.largeIcons.join(', ')}`);
    };
    for (const width of [1440, 768, 390, 320]) {
        await page.setViewportSize({ width, height: 1000 });
        for (const entry of ['index', 'teacher', 'student', 'student-preview']) {
            await page.goto(`${baseUrl}/${entry}.html`);
            if (entry === 'teacher') await page.evaluate(() => document.getElementById('teacher-tab-shell').classList.remove('hidden'));
            await bounds(`${entry} bare entry ${width}px`);
            if (entry === 'student-preview') check(await page.locator('body').evaluate(el=>!['rgba(0, 0, 0, 0)','rgb(255, 255, 255)'].includes(getComputedStyle(el).backgroundColor)), `preview ${width}px: loading frame has no themed background before bootstrap`);
        }
        // Legacy join wrappers are source redirects, not production build entries.
        for (const grade of built ? [] : [6,7,8,9]) {
            await page.goto(`${baseUrl}/join/${grade}/index.html`);
            await page.waitForURL(url=>url.pathname.endsWith('/student.html')&&url.searchParams.get('grade')===String(grade));
            await bounds(`grade ${grade} registration redirect ${width}px`);
        }
        for (const [kind, activity] of [['dashboard', ''], ['months', ''], ['units', ''], ['rows', ''], ['month-rows', ''], ['unit', ''], ['sparks', ''], ['arcade', ''],
            ...['flashcards', 'matching', 'quiz', 'synonym-antonym', 'word-search', 'crossword', 'hangman', 'scramble', 'wordle', 'speed-match', 'fill-in-blank', 'illustration'].map(type => ['activity', type])]) {
            await page.goto(`${baseUrl}/student.html`);
            await page.evaluate(({ kind, activity }) => {
                const app = document.querySelector('.app-container'); app.classList.add('student-session-loading');
                const shell = document.getElementById('student-tab-shell'); shell.classList.remove('hidden'); shell.inert = true;
                const template = document.getElementById(kind === 'dashboard' ? 'student-dashboard-loading-template' : `student-loading-${kind}-template`);
                const view = document.getElementById('loading-view'); view.innerHTML = template.innerHTML;
                const skeleton = view.querySelector('[data-loading-layout]'); if (skeleton) skeleton.dataset.loadingLayout = activity;
            }, { kind, activity });
            const label = `${kind}${activity ? `/${activity}` : ''} ${width}px`;
            await bounds(label);
            const shape = await page.locator('#loading-view').evaluate(root => {
                const arcade = root.querySelector('.student-loading-arcade-card');
                const answers = root.querySelector('.student-loading-answer-grid');
                const lines = [...root.querySelectorAll('.student-loading-line,.student-dashboard-skeleton-line')];
                return { arcade: arcade && getComputedStyle(arcade).display, answers: answers && getComputedStyle(answers).display,
                    lineHeight: Math.max(0,...lines.map(line=>line.getBoundingClientRect().height)) };
            });
            check(shape.lineHeight > 0, `${label}: loading lines have no height before lazy styles`);
            if (kind === 'arcade') check(shape.arcade === 'grid', `${label}: carousel skeleton is unstyled before lazy CSS`);
            if (['matching', 'quiz', 'synonym-antonym', 'fill-in-blank'].includes(activity)) check(shape.answers === 'grid', `${label}: answer skeleton is unstyled before lazy CSS`);
            if (activity === 'flashcards') check(shape.answers === 'none', `${label}: unrelated answer controls flash before lazy CSS`);
            if (['sparks','arcade'].includes(kind) || ['quiz','matching','flashcards'].includes(activity)) {
                const targets = '#loading-view :is(.student-current-class-spark,.student-class-spark-heading,.student-class-spark-questions,.student-loading-arcade-card,.student-loading-answer-grid,.student-loading-activity-focus)';
                const geometry = () => page.locator(targets).evaluateAll(nodes=>nodes.map(node=>{const r=node.getBoundingClientRect();return {class:node.className,x:r.x,y:r.y,width:r.width,height:r.height};}));
                const before = await geometry();
                if (built) {
                    const css = new Set(), seen = new Set();
                    const collect = key => { if (seen.has(key)) return; seen.add(key); const entry = manifest[key]; if (!entry) throw new Error(`Missing built style entry ${key}`); if(entry.file.endsWith('.css'))css.add('/'+entry.file); for(const file of entry.css || [])css.add('/'+file); for(const dependency of entry.imports || [])collect(dependency); };
                    for(const key of ['js/student/studentFeatureStyles.js','js/student/studentClassSparkStyles.js','js/student/studentLibraryStyles.js'])collect(key);
                    await page.evaluate(urls=>Promise.all(urls.map(url=>new Promise((resolve,reject)=>{const link=document.createElement('link');link.rel='stylesheet';link.onload=resolve;link.onerror=()=>reject(new Error('Built feature stylesheet failed'));link.href=url;document.head.append(link);}))),[...css]);
                } else await page.evaluate(async()=>{
                    await import('/js/student/studentFeatureStyles.js');
                    const {loadStudentSparkStyles}=await import('/js/student/studentLibraryStyleLoader.js'); await loadStudentSparkStyles();
                });
                const after = await geometry();
                check(JSON.stringify(before) === JSON.stringify(after), `${label}: late feature CSS changes loading geometry: ${JSON.stringify({before,after})}`);
            }
            if (width === 390) {
                await page.emulateMedia({reducedMotion:'reduce'});
                const moving=await page.locator('#loading-view .student-loading-line,#loading-view .student-dashboard-skeleton-line').evaluateAll(nodes=>nodes.some(node=>node.getBoundingClientRect().height>0&&getComputedStyle(node).animationName!=='none'));
                check(!moving,`${label}: loading motion ignores reduced-motion preference`);
                await page.emulateMedia({reducedMotion:'no-preference'});
            }
            if (width === 390 && ['sparks', 'arcade', 'activity'].includes(kind) && (!activity || activity === 'quiz')) await page.screenshot({ path: `${output}/${kind}-${activity || 'page'}.png`, fullPage: true });
        }
    }
    if (failures.length) console.error(failures.join('\n'));
    assert.equal(failures.length, 0, `${failures.length} first-paint presentation failures`);
    console.log(`${built ? 'Production' : 'Source'} first paint passed: 4 entry pages, 20 student loading layouts, 4 widths, hidden controls, icons, and loading geometry. Screenshots: ${output}`);
} finally { await browser?.close(); server?.kill(); }
