import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { chromium } from 'playwright';
import { createClient } from '@supabase/supabase-js';
import { createClassroomRepository } from '../js/services/classroomRepository.js';
import { ensureViteServer } from './lib/local-vite-server.mjs';
import { assertNoAccessibilityViolations } from './lib/accessibility-audit.mjs';
import { AUDIT_PASSWORD, AUDIT_TEACHER_EMAIL, AUDIT_STUDENT_EMAIL, readLocalSupabaseStatus, getBrowserSupabaseConfig } from './lib/local-supabase-audit.mjs';

// This explicitly mutating acceptance test uses existing local fixture accounts.
// It adds/reuses one dedicated class and preserves all pre-existing class work.
const built=process.env.SPARKS_CLASS_FLOW_DIST==='1'||process.argv.includes('--built');
const port=built?18315:18314,baseUrl=`http://127.0.0.1:${port}`;
const output=`/tmp/sparks-class-flow-${built?'built':'source'}`,className='Class flow acceptance';
let server,browser,teacher,student;
const stages=[],errors=[],backendErrors=[];
const mark=stage=>{stages.push(stage);console.log(`PASS: ${stage}`);};
try {
 const config=getBrowserSupabaseConfig(await readLocalSupabaseStatus({startIfStopped:false}));
 await mkdir(output,{recursive:true});
 const client=createClient(config.url,config.publishableKey,{auth:{persistSession:false,autoRefreshToken:false}});
 const login=await client.auth.signInWithPassword({email:AUDIT_TEACHER_EMAIL,password:AUDIT_PASSWORD});if(login.error)throw login.error;
 const access=await client.rpc('my_school_access_v1');if(access.error)throw access.error;
 const school=access.data.schools.find(s=>s.roles.includes('teacher')&&s.active);assert.ok(school,'Existing teacher has verified school authority');
 const repo=createClassroomRepository(()=>client,()=>school.id);
 const beforeClasses=await repo.listClasses();const original=beforeClasses.find(c=>c.name==='Audit 6A');assert.ok(original);
 const originalWork=await repo.listAssignments(original.id);
 server=await ensureViteServer({baseUrl,probePath:'/teacher.html',host:'127.0.0.1',port,...(built?{args:['vite','preview','--outDir','dist-desktop','--host','127.0.0.1','--port',String(port),'--strictPort']}: {})});
 browser=await chromium.launch();
 async function newSession(){
  const context=await browser.newContext({viewport:{width:1440,height:1000},acceptDownloads:true,timezoneId:'America/Panama',serviceWorkers:'block'});
  await context.addInitScript(value=>window.SUPABASE_CONFIG=value,config);
  await context.routeWebSocket(url=>url.host===`127.0.0.1:${port}`,socket=>socket.close());
  await context.route('https://*.supabase.co/**',route=>{errors.push('Unexpected hosted database request');return route.abort();});
  const page=await context.newPage();page.setDefaultTimeout(20000);
  page.on('pageerror',e=>errors.push(e.message));
  page.on('response',r=>{if(r.url().startsWith(`${config.url}/rest/v1/`)&&r.status()>=400)backendErrors.push(`${r.status()} ${new URL(r.url()).pathname}`);});
  return page;
 }
 const waitClass=()=>teacher.waitForFunction(()=>document.querySelector('#teacher-classes-view.active')?.getAttribute('aria-busy')==='false');
 async function teacherHome(){await teacher.locator('#tab-overview').click();await teacher.locator('#teacher-overview-view .teacher-class-card').first().waitFor();}
 teacher=await newSession();
 await teacher.goto(`${baseUrl}/teacher.html`);
 await teacher.locator('#teacher-email').fill(AUDIT_TEACHER_EMAIL);await teacher.locator('#teacher-password').fill(AUDIT_PASSWORD);
 await teacher.locator('#teacher-login-form button[type=submit]').click();
 const home=teacher.locator('#teacher-overview-view'),classes=teacher.locator('#teacher-classes-view'),review=teacher.locator('#teacher-assignments-view');
 await home.getByRole('heading',{name:'My classes',exact:true}).waitFor();mark('Real teacher password login and school access');
 if(!beforeClasses.some(c=>c.name===className)){
  await home.getByRole('button',{name:'Create class',exact:true}).click();const dialog=teacher.getByRole('dialog',{name:'Create class',exact:true});
  await dialog.getByLabel('Class name',{exact:true}).fill(className);
  await dialog.locator('select[name=subject]').selectOption({label:'Audit Technology'});
  await dialog.locator('select[name=year]').selectOption('2026');
  await dialog.getByRole('button',{name:'Create class',exact:true}).click();await dialog.waitFor({state:'detached'});
 }
 await home.getByRole('button',{name:`Open class ${className}`,exact:true}).click();await waitClass();
 const classId=await teacher.getByLabel('Current class',{exact:true}).inputValue();assert.ok(classId&&classId!==original.id);
 mark('Create/reopen dedicated class through Home card');
 let roster=await repo.getRoster(classId);
 if(!roster.some(s=>s.email===AUDIT_STUDENT_EMAIL)){
  await classes.getByRole('tab',{name:'Students',exact:true}).click();await waitClass();
  await classes.getByRole('button',{name:'Invite students',exact:true}).click();const dialog=teacher.getByRole('dialog',{name:'Invite students',exact:true});
  await dialog.getByLabel('Student emails',{exact:true}).fill(AUDIT_STUDENT_EMAIL);
  await dialog.getByRole('button',{name:'Invite students',exact:true}).click();await dialog.waitFor({state:'detached'});
 }
 student=await newSession();
 await student.addLocatorHandler(student.getByRole('button',{name:'Skip guide',exact:true}),button=>button.click());
 await student.goto(`${baseUrl}/student.html`);
 await student.locator('#login-email').fill(AUDIT_STUDENT_EMAIL);await student.locator('#login-password').fill(AUDIT_PASSWORD);
 await student.locator('#student-login-form button[type=submit]').click();await student.locator('#student-tab-shell:not(.hidden)').waitFor({timeout:30000});
 await student.locator('#student-tab-vocabulary').click();
 if(!roster.some(s=>s.email===AUDIT_STUDENT_EMAIL)){
  const invitation=student.locator('#vocab-list article').filter({has:student.getByRole('heading',{name:className,exact:true})});
  await invitation.getByRole('button',{name:'Join class',exact:true}).click();await invitation.waitFor({state:'detached'});
 }
 roster=await repo.getRoster(classId);assert.ok(roster.some(s=>s.email===AUDIT_STUDENT_EMAIL));mark('Real student login and class invitation/enrollment');
 await teacher.locator('#tab-classes').click();await waitClass();
 let assignments=await repo.listAssignments(classId);
 async function publish(kind){
  const existing=assignments.find(a=>a.kind===kind&&!a.withdrawn&&new Date(a.release_at)<=new Date());if(existing)return existing;
  await classes.getByRole('button',{name:'Assign material',exact:true}).click();const dialog=teacher.getByRole('dialog',{name:'Assign material',exact:true});
  const picker=dialog.locator('select[name=material]');await picker.waitFor();
  const index=await picker.locator('option').evaluateAll((options,kind)=>options.find(o=>o.textContent.startsWith(kind==='spark'?'Spark · Current Audit Spark':'Vocabulary ·'))?.value,kind);assert.notEqual(index,undefined);
  await picker.selectOption(index);
  assert.deepEqual(await dialog.locator('input[name=classIds]:checked').evaluateAll(nodes=>nodes.map(n=>n.value)),[classId]);
  await dialog.getByLabel('Available from',{exact:true}).fill('2026-10-01T08:00');
  await dialog.getByRole('button',{name:'Assign material',exact:true}).click();await dialog.waitFor({state:'detached'});
  await teacher.locator('#tab-classes').click();await waitClass();
  assignments=await repo.listAssignments(classId);const created=assignments.find(a=>a.kind===kind&&!a.withdrawn);assert.ok(created);return created;
 }
 const vocab=await publish('vocabulary'),spark=await publish('spark');
 assert.equal((await repo.listAssignments(original.id)).length,originalWork.length);mark('Publish reusable vocabulary and Spark to selected class only');
 await teacher.locator('#tab-vocabulary').click();await teacher.locator('#teacher-dashboard-view:not(.hidden)').waitFor();
 assert.equal(await teacher.getByLabel('Current class',{exact:true}).inputValue(),classId);
 await teacher.locator('#tab-classes').click();await waitClass();mark('Shared Library retains the selected class');
 await student.locator('#student-subject-picker .student-subject-trigger').click();
 await student.locator(`#student-subject-picker [data-subject-slug="${classId}"]`).click();
 await student.evaluate(id=>{location.hash=`#/sparks?spark=${id}`;},spark.id);
 const answer=`A browser opens websites, and storage keeps the information that we save. Acceptance run ${Date.now()}.`;
 await student.getByLabel('Your answer',{exact:true}).fill(answer);
 await student.getByRole('button',{name:'Save answer',exact:true}).click();await student.getByText('Answer saved. Your teacher will review it.',{exact:true}).waitFor();
 await student.reload();await student.getByLabel('Your answer',{exact:true}).waitFor();assert.equal(await student.getByLabel('Your answer',{exact:true}).inputValue(),answer);
 mark('Student opens selected class Spark and saves/reloads an answer');
 await teacher.locator('#tab-assignments').click();
 await review.getByRole('tab',{name:'Needs review',selected:true}).waitFor();
 await review.getByRole('button',{name:`Open ${spark.title} · ${className}`,exact:true}).click();
 await review.getByText(answer,{exact:true}).waitFor();
 const editor=review.locator('.student-feedback-editor').first(),note='Local acceptance: your explanation connects the browser and saved information.';
 await editor.locator('textarea[name=teacher-note]').fill(note);await editor.locator('select[name=review-status]').selectOption('reviewed');
 await editor.getByRole('button',{name:'Save teacher note',exact:true}).click();
 await review.getByText('No submissions need review.',{exact:true}).waitFor();
 await review.getByLabel('Show work',{exact:true}).selectOption('all');
 await editor.getByText('Teacher note saved.',{exact:true}).waitFor();
 await teacher.reload();await review.getByLabel('Show work',{exact:true}).selectOption('all');await review.locator('textarea[name=teacher-note]').waitFor();assert.equal(await review.locator('textarea[name=teacher-note]').inputValue(),note);
 assert.equal(await review.locator('select[name=review-status]').inputValue(),'reviewed');
 mark('Review student answer and persist/reload teacher note and decision');
 await review.getByRole('button',{name:'Export results',exact:true}).click();const exportDialog=teacher.getByRole('dialog',{name:'Export assignment results',exact:true});
 const download=teacher.waitForEvent('download');await exportDialog.getByRole('button',{name:'Download CSV',exact:true}).click();
 const file=await download;await file.saveAs(`${output}/assignment-results.csv`);const csv=await readFile(`${output}/assignment-results.csv`,'utf8');
 assert.ok(csv.includes(className)&&csv.includes(answer)&&!csv.includes('Audit 6A'));await exportDialog.getByRole('button',{name:'Cancel',exact:true}).click();mark('Download class-scoped CSV with actual student answer');
 await teacher.getByLabel('Current class',{exact:true}).selectOption(original.id);
 await teacher.locator('#teacher-assignments-view').getByRole('tab',{name:'Current',exact:true}).click();
 assert.equal(await review.getByRole('button',{name:`Open ${spark.title} · ${className}`,exact:true}).count(),0);
 await teacher.getByLabel('Current class',{exact:true}).selectOption(classId);await teacher.locator('#tab-classes').click();await waitClass();
 await classes.getByRole('tab',{name:'Students',exact:true}).click();await waitClass();
 await classes.getByRole('button',{name:'Make groups',exact:true}).click();await teacher.waitForFunction(id=>document.querySelector('#group-class-select')?.value===id,classId);
 if(roster.length<2){
  assert.equal(await teacher.locator('#randomize-groups-btn').isDisabled(),true);
  await teacher.locator('#group-student-list label.group-student-toggle').first().click();
  await teacher.locator('#group-roster-summary').getByText('0 present · 1 absent',{exact:true}).waitFor();
  await teacher.locator('#group-student-list label.group-student-toggle').first().click();
 }else{await teacher.locator('#randomize-groups-btn').click();await teacher.locator('#group-results .random-group-card').first().waitFor();}
 mark('Switch classes without leaking work; Groups uses selected roster and minimum-size guard');
 await teacher.locator('#tab-classes').click();await waitClass();await classes.getByRole('tab',{name:'Students',exact:true}).click();await waitClass();
 await classes.getByRole('button',{name:/^Actions for /}).first().click();await teacher.getByRole('menuitem',{name:'Assigned work',exact:true}).click();
 await teacher.locator('#student-profile-assigned-work [data-assignment-card]').first().waitFor();
 const profileIds=await teacher.locator('#student-profile-assigned-work [data-assignment-card]').evaluateAll(nodes=>nodes.map(n=>n.dataset.assignmentCard));
 assert.deepEqual(new Set(profileIds),new Set([vocab.id,spark.id]));mark('Student profile lists only selected class assignments');
 await teacherHome();await assertNoAccessibilityViolations(teacher,'Real teacher home',{include:['#teacher-overview-view','#teacher-class-switcher']});
 await teacher.screenshot({path:`${output}/home-desktop.png`,animations:'disabled'});
 await home.getByRole('button',{name:`Open class ${className}`,exact:true}).click();await waitClass();
 for(const width of [1440,768,390,320]){await teacher.setViewportSize({width,height:1000});assert.equal(await teacher.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true,`Teacher fits ${width}px`);}
 await teacher.screenshot({path:`${output}/classwork-mobile.png`,animations:'disabled'});
 await teacher.reload();await classes.getByRole('tab',{name:'Classwork',exact:true}).waitFor();assert.equal(await teacher.getByLabel('Current class',{exact:true}).inputValue(),classId);
 await assertNoAccessibilityViolations(teacher,'Real mobile classwork',{include:['#teacher-classes-view','#teacher-class-switcher']});
 assert.deepEqual(backendErrors,[]);assert.deepEqual(errors,[]);
 const result={environment:built?'local production build':'local source',stages,classId,assignmentIds:[vocab.id,spark.id],originalClassAssignmentsPreserved:originalWork.length,screenshots:output};
 await writeFile(`${output}/results.json`,JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
}catch(error){if(teacher)await teacher.screenshot({path:`${output}/teacher-failure.png`,animations:'disabled'});if(student)await student.screenshot({path:`${output}/student-failure.png`,animations:'disabled'});console.error(JSON.stringify({completed:stages,backendErrors,errors},null,2));throw error;}
finally{await browser?.close();server?.kill();}
