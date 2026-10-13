import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import AxeBuilder from '@axe-core/playwright';
import { ensureViteServer } from './lib/local-vite-server.mjs';
const port=8061,baseUrl=`http://127.0.0.1:${port}`;let server,browser;
try {
 server=await ensureViteServer({baseUrl,probePath:'/',host:'127.0.0.1',port});browser=await chromium.launch();const context=await browser.newContext();const page=await context.newPage();await page.goto(baseUrl);
 await page.evaluate(async()=>{
  document.body.replaceChildren();const root=document.createElement('main');document.body.append(root);window.calls=[];
  const {supabaseService}=await import('/js/supabaseService.js');
  supabaseService.init=async()=>{};supabaseService.getClient=()=>({auth:{
   signUp:async value=>{window.calls.push(['signup',value]);return {error:window.failSignup?new Error('Signup temporarily unavailable'):null};},
   resetPasswordForEmail:async(...args)=>{window.calls.push(['recover',...args]);return {error:null};},
   updateUser:async value=>{window.calls.push(['password',value]);return {error:window.failPassword?new Error('Password update denied'):null};},
   onAuthStateChange:callback=>{window.authCallback=callback;return {data:{subscription:{unsubscribe(){}}}};}
  }});
  const {mountSchoolAccountAccess}=await import('/js/schoolAccountAccess.js');window.mount=mountSchoolAccountAccess;
  await Promise.all([mountSchoolAccountAccess(root),mountSchoolAccountAccess(root)]);
 });
 assert.equal(await page.getByRole('button',{name:'Create invited account'}).count(),1);
 await page.getByRole('button',{name:'Create invited account'}).click();
 await page.getByLabel('Invited email address').fill('invited@example.org');await page.getByLabel('First name').fill('Ada');await page.getByLabel('Last name').fill('Teacher');await page.getByLabel('Password, at least 10 characters').fill('Test-only-password-42');
 assert.equal((await new AxeBuilder({page}).withRules(['label','aria-dialog-name','button-name']).analyze()).violations.length,0);
 await page.evaluate(()=>window.failSignup=true);await page.getByRole('button',{name:'Create account',exact:true}).click();await page.getByText('Signup temporarily unavailable',{exact:true}).waitFor();
 assert.equal(await page.getByRole('button',{name:'Create account',exact:true}).isEnabled(),true);
 await page.evaluate(()=>window.failSignup=false);await page.getByRole('button',{name:'Create account',exact:true}).click();await page.getByText('Check your email to verify your account. Then sign in and accept your school invitation.',{exact:true}).waitFor();
 const signup=await page.evaluate(()=>window.calls.at(-1));assert.equal(signup[1].email,'invited@example.org');assert.deepEqual(signup[1].options.data,{first_name:'Ada',last_name:'Teacher'});assert.equal(signup[1].options.emailRedirectTo,`${baseUrl}/`);
 await page.getByRole('button',{name:'Close',exact:true}).click();await page.getByRole('button',{name:'Forgot password'}).click();await page.getByLabel('Invited email address').fill('missing@example.org');await page.getByRole('button',{name:'Send recovery link'}).click();await page.getByText('If this account can receive recovery email, a link has been requested. Check your inbox.',{exact:true}).waitFor();assert.deepEqual(await page.evaluate(()=>window.calls.at(-1)),['recover','missing@example.org',{redirectTo:`${baseUrl}/`}]);
 await page.evaluate(()=>{window.authCallback('PASSWORD_RECOVERY');window.authCallback('PASSWORD_RECOVERY');});assert.equal(await page.getByRole('dialog').count(),1);await page.getByRole('heading',{name:'Choose a new password'}).waitFor();
 await page.getByLabel('Password, at least 10 characters').fill('Replacement-test-password');await page.evaluate(()=>window.failPassword=true);await page.getByRole('button',{name:'Save password'}).click();await page.getByText('Password update denied',{exact:true}).waitFor();
 await page.evaluate(()=>window.failPassword=false);await page.getByRole('button',{name:'Save password'}).click();await page.getByText('Password saved.',{exact:true}).waitFor();assert.equal(await page.getByLabel('Password, at least 10 characters').inputValue(),'');assert.deepEqual(await page.evaluate(()=>window.calls.at(-1)),['password',{password:'Replacement-test-password'}]);
 await page.getByRole('button',{name:'Close',exact:true}).click();
 await page.evaluate(async()=>{document.querySelector('[data-school-account-access]').remove();window.__sparksPasswordRecoveryPending=true;await window.mount(document.querySelector('main'));});await page.getByRole('heading',{name:'Choose a new password'}).waitFor();assert.equal(await page.evaluate(()=>window.__sparksPasswordRecoveryPending),false);
 await page.getByRole('button',{name:'Close',exact:true}).click();
 await page.evaluate(async()=>{
  const html=await fetch('/teacher.html').then(response=>response.text());const parsed=new DOMParser().parseFromString(html,'text/html');document.body.replaceChildren(...Array.from(parsed.body.childNodes));for(const template of document.querySelectorAll('template'))template.replaceWith(template.content.cloneNode(true));
  const ids=['quiz-title-input','quiz-school-input','quiz-teacher-input','quiz-grade-input','quiz-instructions-input','quiz-font-select','word-input','pos-input','def-input','example-input','difficulty-input','synonyms-input','antonyms-input'];
  for(const id of ids){const field=document.getElementById(id);if(!field||!Array.from(field.labels||[]).some(label=>label.textContent.trim()))throw new Error(`Missing accessible label ${id}`);}
 });
 console.log('Mocked school signup/recovery, concurrent mount, callback handling, dialog accessibility and current editor labels passed.');
}finally{await browser?.close();server?.kill();}
