import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import { ensureViteServer } from './lib/local-vite-server.mjs';

const port = 8069, baseUrl = `http://127.0.0.1:${port}`;
let server, browser;
try {
    server = await ensureViteServer({baseUrl,probePath:'/',host:'127.0.0.1',port});
    browser = await chromium.launch();
    for (const [file,selector,label,action] of [
        ['teacher.html','.vocab-editor-heading','More save options','export-btn'],
        ['student.html','.activity-menu-status','Export options','download-word-hunt-btn']
    ]) {
        const source = await readFile(new URL(`../${file}`,import.meta.url),'utf8');
        const page = await browser.newPage();
        await page.goto(baseUrl);
        for (const css of ['theme','buttons',file === 'teacher.html' ? 'teacher' : 'student','floating-action-menu']) {
            await page.addStyleTag({url:`${baseUrl}/css/${css}.css`});
        }
        await page.evaluate(async ({source,selector,label}) => {
            const parsed = new DOMParser().parseFromString(source,'text/html');
            const root = document.createElement('main');
            if (label === 'Export options') root.id = 'activity-menu-view';
            root.append(parsed.querySelector(selector));
            document.body.replaceChildren(root);
            const outside = document.createElement('button'); outside.textContent = 'Outside'; outside.style.cssText = 'position:fixed;bottom:8px;left:8px;width:auto'; root.append(outside);
            window.menuActions = [];
            for (const button of root.querySelectorAll('details button')) button.addEventListener('click',()=>window.menuActions.push(button.id));
            const {upgradeActionMenu} = await import('/js/ui/floatingActionMenu.js');
            upgradeActionMenu(root.querySelector('details'),label);
        },{source,selector,label});
        for (const width of [1440,390,320]) {
            await page.setViewportSize({width,height:900});
            const trigger = page.getByRole('button',{name:label,exact:true});
            assert.equal(await trigger.textContent(),'⋮');
            const before = await trigger.boundingBox();
            await trigger.click();
            const menu = page.getByRole('menu',{name:label,exact:true});
            await menu.waitFor();
            const rect = await menu.boundingBox();
            if (width === 1440 || width === 390) await page.screenshot({path:`/tmp/${file}-${width}-action-menu.png`});
            assert.ok(rect.x >= 0 && rect.x + rect.width <= width && rect.y >= 0 && rect.y + rect.height <= 900,`${file} at ${width}: ${JSON.stringify(rect)}`);
            assert.deepEqual(await trigger.boundingBox(),before);
            await trigger.click();
            assert.equal(await menu.isVisible(),false,'second click closes');
            await trigger.click();
            await page.keyboard.press('Escape');
            assert.equal(await menu.isVisible(),false);
            assert.equal(await trigger.evaluate(el=>el===document.activeElement),true);
            await trigger.click();
            await page.getByRole('button',{name:'Outside',exact:true}).click();
            assert.equal(await menu.isVisible(),false);
            await trigger.click();
            await page.locator(`#${action}`).click();
            assert.equal(await page.evaluate(()=>window.menuActions.at(-1)),action);
            assert.equal(await menu.isVisible(),false);
        }
        await page.close();
    }
    console.log('Save and export menus preserve actions, stay within desktop/phone screens, and close on a second click, Escape, selection, or outside click.');
} finally { await browser?.close(); server?.kill(); }
