import assert from 'node:assert/strict';
import { readFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { chromium } from 'playwright';
import { ensureViteServer } from './lib/local-vite-server.mjs';

const port = 8312;
const baseUrl = `http://127.0.0.1:${port}`;
const output = join(tmpdir(), 'sparks-library-layout');
const server = await ensureViteServer({ baseUrl, probePath: '/', host: '127.0.0.1', port });
const browser = await chromium.launch();
try {
    const page = await browser.newPage({ viewport: { width: 1440, height: 1050 }, reducedMotion: 'reduce' });
    page.setDefaultTimeout(10000);
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    // Real markup, styles and controllers with in-memory material data, without app bootstrap or network writes.
    const html = (await readFile(new URL('../teacher.html', import.meta.url), 'utf8')).replace(/<script\b[^>]*>[\s\S]*?<\/script>/g, '');
    await page.route('**/teacher.html', route => route.fulfill({ contentType: 'text/html', body: html }));
    await page.route(/https?:\/\/[^/]+\/(?:rest|auth)\/v1\//, route => route.abort());
    await page.goto(`${baseUrl}/teacher.html`);
    await page.evaluate(async () => {
        const { createTeacherVocabularyBrowserFeature } = await import('/js/teacherVocabularyBrowserFeature.js');
        const { installTeacherSettingsMethods } = await import('/js/teacherSettings.js');
        const { installTeacherVocabularyLibraryMethods } = await import('/js/teacherVocabularyLibrary.js');
        const { installTeacherVocabularyPlacementMethods } = await import('/js/teacherVocabularyPlacement.js');
        const { installTeacherVocabularyStorageMethods } = await import('/js/teacherVocabularyStorage.js');
        const { installTeacherVocabularyEditorCoreMethods } = await import('/js/teacherVocabularyEditorCoreMethods.js');
        const { initTeacherGlobalListeners } = await import('/js/teacherGlobalListeners.js');
        // The stripped bootstrap still needs the actual shell class-switcher styles.
        await import('/css/teacher-class-workspace.css');
        class Manager {
            getSubjects() { return [{ slug: 'technology', name: 'Technology', color: '#54b8ff', sortOrder: 1 }]; }
            getSubjectForVocab() { return this.getSubjects()[0]; }
            createTeacherVocabularyOperationGuard() { return () => true; }
            refreshIcons() {}
            updateVocabularyRoute() {}
            setTeacherMobileMenu() {}
            closeTeacherMobileMenu() {}
            setRoute() {}
            beginTeacherNavigation() {}
            setTeacherSidebarCollapsed() {}
            handleRouteChange() {}
            showTeacherSection(section) {
                const id = section === 'sparks' ? 'teacher-sparks-view' : 'teacher-dashboard-view';
                document.querySelectorAll('.teacher-main > .view').forEach(el => { el.classList.toggle('hidden', el.id !== id); el.classList.toggle('active', el.id === id); });
                if (section !== 'sparks') this.setVocabularyWorkflowTab(section === 'quizzes' ? 'quizzes' : 'assign', { updateRoute: false, loadQuizzes: false });
                if (section === 'vocabulary') void window.libraryBrowser?.show();
                else window.libraryBrowser?.deactivate();
                document.dispatchEvent(new CustomEvent('teacher-shell-view'));
            }
        }
        installTeacherVocabularyLibraryMethods(Manager);
        installTeacherVocabularyPlacementMethods(Manager);
        installTeacherVocabularyStorageMethods(Manager);
        installTeacherVocabularyEditorCoreMethods(Manager);
        installTeacherSettingsMethods(Manager);
        const owner = window.libraryOwner = new Manager();
        owner.subjects = [{ slug: 'technology', name: 'Technology', color: '#54b8ff', sortOrder: 1 }];
        owner.libraryDrilldown = {};
        owner.libraryItems = [
            { type: 'cloud', vocab: { id: 'a', name: 'Digital footprints', grade: '7', trimester: 'IIIT', month: 'october', week: 5, words: [{word:'trace',definition:'A mark left behind'}] } },
            { type: 'remote', vocab: { id: 'b', name: 'Safe messages', grade: '6', trimester: 'IIIT', month: 'october', week: 5, words: [{word:'safe',definition:'Protected'}] } },
            { type: 'local', vocab: { id: 'c', name: 'Binary numbers', grade: '8', trimester: 'IIT', month: 'july', week: 4, words: [{word:'bit',definition:'A binary digit'}] } },
            { type: 'cloud', vocab: { id: 'd', name: 'Retired - Old unit', grade: '7', trimester: 'IT', month: 'march', week: 1, words: [] } }
        ];
        owner.teacherVocabularyViewModes = {};
        document.querySelector('#teacher-tab-shell').classList.remove('hidden');
        owner.showTeacherSection('vocabulary');
        document.querySelector('#teacher-top-bar-section').textContent='Library';
        document.querySelectorAll('#teacher-tabs button').forEach(el=>{el.classList.toggle('active',el.id==='tab-vocabulary');el.setAttribute('aria-selected',String(el.id==='tab-vocabulary'));});
        initTeacherGlobalListeners(owner);
        document.querySelectorAll('[data-vocabulary-tab]').forEach(tab => tab.addEventListener('click', () => owner.setVocabularyWorkflowTab(tab.dataset.vocabularyTab, {updateRoute:false,loadQuizzes:false})));
        const feature = window.libraryBrowser = createTeacherVocabularyBrowserFeature({
            getSubjects: () => owner.getSubjects(), describeVocabulary: (vocab, type) => owner.describeTeacherVocabulary(vocab, type),
            describeVocabularyGrouping: vocab => owner.describeTeacherVocabularyGrouping(vocab),
            ensureAuthenticated: () => true, captureScope: () => () => true,
            isActive: () => owner.vocabularyMode === 'assign' && document.querySelector('#teacher-dashboard-view').classList.contains('active'),
            getDrilldown: () => owner.libraryDrilldown,
            writeDrilldown: value => { owner.libraryDrilldown = value; }, loadCatalog: async () => ({ items: owner.libraryItems }),
            refreshIcons() {}, captureNavigation: () => null, isNavigationCurrent: () => true,
            openItem: (vocab, type) => owner.openTeacherVocabularyItem(vocab, type),
            removeDraft: id => owner.removeLocalVocab(id), deleteSaved: id => owner.deleteCloudVocab(id)
        });
        await feature.show();
    });
    await page.locator('#library-list :is(.teacher-library-choice-card, button.student-vocab-row:not(.student-vocab-unit-row):not(.quiz-vocab-row))').filter({hasText:'Technology'}).click();
    await page.locator('#library-list :is(.teacher-library-choice-card, button.student-vocab-row:not(.student-vocab-unit-row):not(.quiz-vocab-row))').filter({hasText:'Grade 7'}).click();
    await page.locator('#library-list :is(.teacher-library-choice-card, button.student-vocab-row:not(.student-vocab-unit-row):not(.quiz-vocab-row))').filter({hasText:'3rd Trimester'}).click();
    await page.locator('#library-list :is(.teacher-library-choice-card, button.student-vocab-row:not(.student-vocab-unit-row):not(.quiz-vocab-row))').filter({hasText:'October'}).click();
    await page.locator('#library-list .teacher-material-item').first().waitFor();
    assert.match(await page.locator('#teacher-vocab-breadcrumb').innerText(), /Technology.*Grade 7.*3rd Trimester.*October/is);
    await page.locator('#teacher-vocab-view-toggle [data-teacher-vocab-view-mode=rows]').click();
    assert.match(await page.locator('#teacher-vocab-breadcrumb').innerText(), /October/i);
    await page.locator('#teacher-vocab-breadcrumb button').filter({hasText:'Grade 7'}).click();
    await page.locator('#library-list :is(.teacher-library-choice-card, button.student-vocab-row:not(.student-vocab-unit-row):not(.quiz-vocab-row))').filter({hasText:'3rd Trimester'}).waitFor();
    await page.locator('#library-list :is(.teacher-library-choice-card, button.student-vocab-row:not(.student-vocab-unit-row):not(.quiz-vocab-row))').filter({hasText:'3rd Trimester'}).click();
    await page.locator('#library-list :is(.teacher-library-choice-card, button.student-vocab-row:not(.student-vocab-unit-row):not(.quiz-vocab-row))').filter({hasText:'October'}).click();
    assert.equal(await page.getByText('Browse folders', {exact:true}).count(), 0);
    const materials = page.locator('#library-list .teacher-material-item');
    await materials.first().waitFor();
    assert.equal(await page.locator('#teacher-library-filters .teacher-library-clear').isVisible(), false);
    assert.equal(await page.locator('#teacher-library-filters select:visible').count(), 0);
    assert.ok(await page.locator('#teacher-vocab-breadcrumb').evaluate(el=>el.getBoundingClientRect().bottom <= document.querySelector('.teacher-library-control-row').getBoundingClientRect().top));
    const toolbar = await page.locator('.teacher-library-control-row:visible').evaluate(el => {
        const controls=[...el.querySelectorAll('#teacher-vocab-view-toggle, .teacher-library-authoring-tools, .teacher-library-filters')];
        return controls.map(node=>Math.round(node.getBoundingClientRect().bottom));
    });
    assert.ok(Math.max(...toolbar)-Math.min(...toolbar)<=1, `Desktop controls must be one row: ${toolbar}`);
    assert.equal(await page.locator('#vocabulary-assign-panel h1.teacher-library-accessible-title').evaluate(el=>getComputedStyle(el).clipPath), 'inset(50%)');
    assert.equal(await materials.count(), 1, 'Month shows its current materials');
    await page.locator('#vocabulary-tab-assign').focus();
    await page.keyboard.press('ArrowRight');
    assert.equal(await page.locator('#vocabulary-tab-quizzes').getAttribute('aria-selected'), 'true');
    await page.keyboard.press('ArrowRight');
    await page.waitForFunction(() => document.activeElement?.getAttribute('aria-selected') === 'true' && document.querySelector('#teacher-sparks-view').classList.contains('active'));
    await page.locator('#teacher-sparks-view [data-content-destination=vocabulary]').click();
    await page.locator('#teacher-library-create-btn').click();
    await page.locator('#teacher-library-create-menu').waitFor({state:'visible'});
    assert.equal(await page.locator('#teacher-library-create-menu [role=menuitem]').count(),2);
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('#teacher-library-create-menu').isVisible(),false);
    const search = page.locator('#teacher-library-filters input[type=search]');
    await search.fill('foot');
    await page.waitForFunction(() => document.querySelectorAll('#library-list .teacher-material-item').length === 1);
    assert.equal(await search.evaluate(el => el === document.activeElement), true, 'Typing preserves focus');
    await page.locator('#teacher-vocab-view-toggle [data-teacher-vocab-view-mode=rows]').click();
    await page.locator('#library-list .teacher-material-row').waitFor();
    assert.equal(await page.locator('#library-list .student-vocab-row-header').isVisible(), true);
    assert.equal(await page.locator('#library-list .student-vocab-unit-row').evaluate(el=>getComputedStyle(el).display), 'grid');
    assert.equal(await materials.count(), 1, 'View toggle preserves filtered results');
    await page.locator('#teacher-library-filters .teacher-library-clear').click();
    await page.waitForFunction(() => document.querySelectorAll('#library-list .teacher-material-item').length === 1);
    await page.locator('#teacher-library-filters .teacher-library-filter-toggle').click();
    await page.locator('#teacher-library-filters .teacher-library-filter-panel').waitFor({state:'visible'});
    await page.locator('#teacher-library-filters label').filter({hasText:'Grade'}).locator('select').selectOption('6');
    await page.locator('#teacher-library-filters .teacher-library-filter-panel').getByRole('button',{name:'Done'}).click();
    await page.getByText('No materials match these filters.', {exact:false}).waitFor();
    await page.locator('#teacher-library-filters .teacher-library-clear').click();
    await search.fill('no matching title');
    await page.getByText('No materials match these filters.', {exact:false}).waitFor();
    await page.locator('#teacher-library-filters .teacher-library-clear').click();
    await page.locator('#teacher-vocab-view-toggle [data-teacher-vocab-view-mode=cards]').click();
    await materials.first().waitFor();
    // Destructive actions stay in a keyboard-operable, viewport-contained menu.
    assert.equal(await page.locator('#library-list .delete-vocab-btn:visible').count(), 0);
    await page.locator('#library-list button[aria-label^="More actions"]').first().click();
    await page.locator('#library-list .delete-vocab-btn:visible').waitFor();
    await page.keyboard.press('Escape');
    assert.equal(await page.locator('#library-list .delete-vocab-btn:visible').count(), 0);
    const contrast = await page.locator('#vocabulary-tab-assign').evaluate(el => {
        const c = getComputedStyle(el); const rgb = text => text.match(/[\d.]+/g).slice(0,3).map(Number);
        const lum = text => rgb(text).map(v=>v/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4).reduce((a,v,i)=>a+v*[.2126,.7152,.0722][i],0);
        const a=lum(c.color),b=lum(c.backgroundColor); return (Math.max(a,b)+.05)/(Math.min(a,b)+.05);
    });
    assert.ok(contrast >= 4.5, `Selected-tab contrast ${contrast}`);
    await mkdir(output, {recursive:true});
    for (const width of [1440, 768, 390, 320]) {
        await page.setViewportSize({width,height:1050});
        for (const mode of ['cards', 'rows']) {
            await page.locator(`[data-teacher-vocab-view-mode=${mode}]`).click();
            await page.waitForFunction(() => !document.querySelector('#library-list .teacher-material-mount'));
            const actionFrames = await materials.evaluateAll(items => items.map(item => {
                const frame = item.getBoundingClientRect();
                const actions = item.querySelector('.teacher-material-actions').getBoundingClientRect();
                const face = item.firstElementChild.getBoundingClientRect();
                return { addedHeight: frame.height - face.height, visibleActions: [...item.querySelectorAll('.teacher-material-actions button')].filter(button => button.getClientRects().length).length, contained: actions.left >= frame.left && actions.right <= frame.right && actions.top >= frame.top && actions.bottom <= frame.bottom,
                    border: parseFloat(getComputedStyle(item).borderTopWidth), nestedButtons: item.querySelectorAll('button button').length };
            }));
            assert.ok(actionFrames.length && actionFrames.every(frame => frame.contained && frame.border > 0 && !frame.nestedButtons && frame.addedHeight <= 2.1 && frame.visibleActions === 1), JSON.stringify(actionFrames));
            const overflow = await page.evaluate(() => ({width:innerWidth,full:document.documentElement.scrollWidth,offscreen:[...document.querySelectorAll('#teacher-dashboard-view button, #teacher-dashboard-view input, #teacher-dashboard-view select')].filter(el=>el.getClientRects().length).filter(el=>el.getBoundingClientRect().right>innerWidth+1).map(el=>el.textContent.trim())}));
            assert.ok(overflow.full<=width && !overflow.offscreen.length, JSON.stringify(overflow));
        }
        if ([1440,390].includes(width)) console.log('Layout', width, await page.evaluate(() => ({scrollX,main:document.querySelector('main').getBoundingClientRect().x,view:document.querySelector('#teacher-dashboard-view').getBoundingClientRect().x,margin:getComputedStyle(document.querySelector('main')).marginLeft})));
        await page.locator('[data-teacher-vocab-view-mode=cards]').click();
        await materials.first().waitFor();
        if ([1440,390].includes(width)) await page.screenshot({path:join(output,`library-${width}.png`),fullPage:true,animations:'disabled'});
    }
    await page.setViewportSize({width:1440,height:1050});
    // Root-level rows list the same folder entries as cards, without losing breadcrumbs.
    await page.locator('#teacher-vocab-breadcrumb button').filter({hasText:'Vocabulary'}).click();
    for (const mode of ['cards','rows']) {
        await page.locator(`[data-teacher-vocab-view-mode=${mode}]`).click();
        assert.equal(await page.locator('#library-list :is(.teacher-library-choice-card, button.student-vocab-row:not(.student-vocab-unit-row):not(.quiz-vocab-row))').count(),1);
        if(mode==='rows') assert.equal(await page.locator('#library-list .teacher-library-choice-card').count(),0);
        assert.equal(await page.locator('#teacher-vocab-breadcrumb').isVisible(), false);
    }
    await page.screenshot({path:join(output,'library-toolbar.png'),fullPage:true,animations:'disabled'});
    console.log('Vocabulary checks passed');
    // The quiz picker shares folder navigation, filters and breadcrumbs, including empty results.
    await page.evaluate(async () => {
        const {installTeacherQuizBrowserMethods}=await import('/js/teacherQuizBrowserMethods.js');
        const {createQuizVocabularyBrowserAdapter}=await import('/js/teacherQuizVocabularyBrowserAdapter.js');
        class Quiz {
            getOwnedStorageKey(key) { return `layout-fixture:${key}`; }
            resetQuizDrilldown() { this.quizDrilldown={}; }
            updateQuizRoute() {}
            refreshIcons() {}
        }
        installTeacherQuizBrowserMethods(Quiz);
        const quiz=window.quizOwner=new Quiz();
        Object.assign(quiz,{storage:localStorage,quizDrilldown:{},quizLibraryItems:window.libraryOwner.libraryItems,vocabularyBrowser:createQuizVocabularyBrowserAdapter({ getSubjects: () => window.libraryOwner.getSubjects(), describeVocabulary: (vocab, type) => window.libraryOwner.describeTeacherVocabulary(vocab, type), describeVocabularyGrouping: vocab => window.libraryOwner.describeTeacherVocabularyGrouping(vocab) })});
        window.libraryOwner.showTeacherSection('quizzes'); quiz.renderQuizVocabularyBrowser();
    });
    await page.locator('#quiz-vocab-picker :is(.teacher-library-choice-card, button.student-vocab-row:not(.student-vocab-unit-row):not(.quiz-vocab-row))').filter({hasText:'Technology'}).click();
    await page.locator('#quiz-vocab-picker :is(.teacher-library-choice-card, button.student-vocab-row:not(.student-vocab-unit-row):not(.quiz-vocab-row))').filter({hasText:'Grade 7'}).click();
    await page.locator('#quiz-vocab-picker :is(.teacher-library-choice-card, button.student-vocab-row:not(.student-vocab-unit-row):not(.quiz-vocab-row))').filter({hasText:'3rd Trimester'}).click();
    await page.locator('#quiz-vocab-picker :is(.teacher-library-choice-card, button.student-vocab-row:not(.student-vocab-unit-row):not(.quiz-vocab-row))').filter({hasText:'October'}).click();
    await page.locator('#quiz-vocab-picker .teacher-vocab-pick-card').waitFor();
    const quizFrame = page.locator('#quiz-vocab-picker .teacher-material-item').first();
    assert.ok(await quizFrame.evaluate(item => item.getBoundingClientRect().height - item.firstElementChild.getBoundingClientRect().height <= 2.1));
    await quizFrame.locator('.floating-action-menu-trigger').click();
    await quizFrame.getByRole('menuitem', { name: 'Student preview', exact: true }).waitFor();
    await quizFrame.getByRole('menuitem', { name: 'Build quiz', exact: true }).waitFor();
    await page.keyboard.press('Escape');

    await page.locator('#quiz-library-filters input').fill('missing');
    await page.getByText('No vocabulary sets match these filters.',{exact:false}).waitFor();
    assert.match(await page.locator('#quiz-vocab-breadcrumb').innerText(),/October/i);
    await page.locator('#quiz-library-filters .teacher-library-clear').click();
    await page.locator('#quiz-vocab-view-toggle [data-quiz-vocab-view-mode=rows]').click();
    assert.equal(await page.locator('#quiz-vocab-picker .quiz-vocab-row:not(.student-vocab-row-header)').count(),1);
    console.log('Quiz checks passed');
    // Spark status filters never conflate saved materials and drafts.
    await page.evaluate(async () => {
        const {renderTeacherSparkBrowser}=await import('/js/teacherSparks/teacherSparkStudentLibrary.js');
        const {calculateVocabularyPlacement}=await import('/js/services/schoolCalendar.js');
        const date='2026-10-17', placement=calculateVocabularyPlacement(date);
        const spark={id:'spark-a',title:'Check a message before sharing it',status:'draft',scheduledDate:date,targetGrades:['6'],checkMode:'reading_only',sparkText:'Check who sent it.'};
        const owner=window.sparkOwner={weeklySparkItems:[spark,{...spark,id:'spark-b',title:'Digital footprints',status:'scheduled'}],weeklySparkLifecycleGeneration:0,
            sparkBrowserRoute:{trimester:placement?.trimester||'other',month:placement?.month||'other'},
            getSchoolCalendar:()=>undefined,findSparkById:id=>owner.weeklySparkItems.find(item=>item.id===id),
            formatSparkStatusLabel:status=>status==='draft'?'Draft':'Saved material',refreshIcons(){},isAuthenticationDisabled:()=>true};
        window.libraryOwner.showTeacherSection('sparks'); await renderTeacherSparkBrowser(owner,document.querySelector('#spark-library-list'));
    });
    await page.locator('#spark-library-list .teacher-material-item').first().waitFor();
    assert.equal(await page.locator('#spark-library-list .teacher-material-item').count(),2);
    await page.locator('#teacher-spark-library-panel .teacher-library-filter-toggle').click();
    await page.locator('#teacher-spark-library-panel .teacher-library-filter-panel').waitFor({state:'visible'});
    await page.locator('#teacher-spark-library-panel label').filter({hasText:'Status'}).locator('select').selectOption('draft');
    await page.locator('#teacher-spark-library-panel .teacher-library-filter-panel').getByRole('button',{name:'Done'}).click();
    await page.waitForFunction(()=>document.querySelectorAll('#spark-library-list .teacher-material-item').length===1);
    await page.locator('#teacher-spark-library-panel input[type=search]').fill('missing');
    await page.getByText('No Spark materials in this view.').waitFor();
    assert.equal(await page.locator('#teacher-spark-library-panel input[type=search]').evaluate(el=>el===document.activeElement),true);
    await page.locator('#teacher-spark-library-panel .teacher-library-clear').click();
    await page.locator('#spark-library-list .teacher-material-item').first().waitFor();
    for (const section of ['quizzes','sparks']) {
        await page.evaluate(section => window.libraryOwner.showTeacherSection(section), section);
        const panel = section === 'quizzes' ? '#vocabulary-quizzes-panel' : '#teacher-spark-library-panel';
        if (section === 'quizzes') await page.locator('#quiz-vocab-view-toggle [data-quiz-vocab-view-mode=cards]').click();
        for (const viewport of [1440, 768, 390, 320]) {
            await page.setViewportSize({width:viewport,height:1050});
            assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), `${section} overflow at ${viewport}`);
            if (viewport === 1440) {
                const aligned = await page.locator(`${panel} .teacher-library-control-row`).evaluate(row => {
                    const controls = [...row.querySelectorAll('input[type=search], .teacher-library-filter-toggle, .vocab-view-toggle, .teacher-library-authoring-tools > button')];
                    const bounds = controls.map(control => control.getBoundingClientRect());
                    return bounds.every(bound => Math.abs(bound.height - 48) < 1 && Math.abs(bound.bottom - bounds[0].bottom) < 1);
                });
                assert.equal(aligned, true, `${section} toolbar alignment`);
            }
            if ([1440,390].includes(viewport)) await page.screenshot({path:join(output, `${section}-${viewport}.png`),fullPage:true,animations:'disabled'});
        }
    }
    console.log('Spark checks passed');
    // Use the actual loading/error components to prove recoverability.
    const retry = await page.evaluate(async () => {
        const {showLibraryLoading,renderLibraryEmpty}=await import('/js/teacherLibraryControls.js');
        const host=document.querySelector('#library-list'); showLibraryLoading(host,'Loading materials...');
        const busy=host.getAttribute('aria-busy'); window.retryCount=0;
        renderLibraryEmpty(host,'Could not load materials.',()=>window.retryCount++); host.querySelector('button').click();
        return {busy,retried:window.retryCount,cleared:!host.hasAttribute('aria-busy')};
    });
    assert.deepEqual(retry,{busy:'true',retried:1,cleared:true});
    assert.deepEqual(errors,[]);
    console.log(`Library layout smoke passed: tabs, search, filters, view parity, menus, empty/retry states and 8 viewport layouts. Contrast ${contrast.toFixed(2)}:1. Screenshots: ${output}`);
} finally { await browser.close(); server?.kill(); }
