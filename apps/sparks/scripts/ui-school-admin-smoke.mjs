import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { ensureViteServer } from './lib/local-vite-server.mjs';
const port = Number(process.env.UI_SCHOOL_ADMIN_PORT || 8058), baseUrl = `http://127.0.0.1:${port}`;
let server, browser;
try {
 server = await ensureViteServer({ baseUrl, probePath: '/', host: '127.0.0.1', port });
 browser = await chromium.launch(); const page = await browser.newPage(); await page.goto(baseUrl);
 await page.addStyleTag({url:`${baseUrl}/css/floating-action-menu.css`});
 await page.evaluate(async () => {
  document.body.replaceChildren(); const root = document.createElement('main'); document.body.append(root);
  const { createSchoolContext } = await import('/js/services/schoolContext.js');
  const { createSchoolAdminView } = await import('/js/schoolAdminView.js');
  window.calls=[];window.schools=['a','b'].map(id=>({id,name:`School ${id}`,active:true,roles:['school_admin']}));window.failCreateOnce=true;window.years=[{year:2026,label:'2026',archived:false}];
  const {getDefaultSchoolCalendar}=await import('/js/services/schoolCalendar.js');
  window.schoolSettings={schoolCalendar:getDefaultSchoolCalendar(new Date(2026,0,1,12)),other:{keep:true}};
  const repository={
   getAccess: async()=>({platformAdmin:window.platformAdmin!==false,schools:window.schools}),
   createSchool:async value=>{window.calls.push(['create',value]);if(!window.schools.some(s=>s.id==='pending'))window.schools.push({id:'pending',name:value.name,active:false,onboardingPending:true,roles:[]});if(window.failCreateOnce){window.failCreateOnce=false;throw new Error('Response lost. Retry this request.');}return window.schools.at(-1);},
   setSchoolActive:async(id,active)=>{window.calls.push(['schoolActive',id,active]);Object.assign(window.schools.find(s=>s.id===id),{active,onboardingPending:false});},
   listMyInvitations:async()=>[{id:'invitation',school_id:'b',school_name:'<img src=x>',roles:['teacher']}],
   listMembersPage:async(id,{search,limit,offset})=>{window.memberQueries??=[];window.memberQueries.push({id,search,limit,offset});if(window.failMemberPageOnce){window.failMemberPageOnce=false;throw new Error('Could not load the next members page.');}const all=window.memberFixtures||[{user_id:'member',display_name:`Member ${id}`,grade:'6',section:'A',active:true,roles:['teacher','student']}];const matched=all.filter(m=>`${m.display_name} ${m.email||''}`.toLowerCase().includes(search.toLowerCase()));return {members:matched.slice(offset,offset+limit),total:matched.length,limit,offset};},
   listMembers:async(id)=>{window.fullMemberQueries??=[];window.fullMemberQueries.push(id);return [...(window.memberFixtures||[]),...(window.auditPeople||[])];},
   getSettings:async()=>window.schoolSettings,setSetting:async(id,key,value,options)=>{window.settingWriteOwner={owner:options?.ownerUserId,current:options?.isCurrent?.(),signal:options?.signal instanceof AbortSignal};window.calls.push(['setting',id,key,value]);if(window.failCalendarSaveOnce){window.failCalendarSaveOnce=false;throw new Error('Calendar write unavailable');}window.schoolSettings={...window.schoolSettings,[key]:value};},
   listYears:async()=>window.years,setYear:async(id,year,label,archived,options)=>{if(window.yearSaveGate){const gate=window.yearSaveGate;window.yearSaveGate=null;window.yearSaveStarted=true;await gate;window.yearSaveCompleted=true;}window.yearWriteOwner={owner:options?.ownerUserId,current:options?.isCurrent?.(),signal:options?.signal instanceof AbortSignal};window.calls.push(['year',id,year,label,archived]);const previous=window.years.find(item=>item.year===year);if(previous)Object.assign(previous,{label,archived});else window.years.push({year,label,archived});},
   listInvitations:async()=>window.pendingInvitations||[],listAudit:async()=>window.auditFixtures||[],listPlatformAdmins:async()=>window.platformAdmins||[],setPlatformAdmin:async(id,active)=>{window.calls.push(['platformAdmin',id,active]);window.platformAdmins??=[];const admin=window.platformAdmins.find(item=>item.user_id===id);if(admin)admin.active=active;else window.platformAdmins.push({user_id:id,email:`${id}@example.org`,active});},
   replaceInitialAdminInvitation:async(...args)=>window.calls.push(['replaceInitial',...args]),
   inviteMember:async(...args)=>{window.calls.push(['invite',...args]);if(window.failInviteOnce){window.failInviteOnce=false;throw new Error('Could not create invitation. Try again.');}window.pendingInvitations??=[];window.pendingInvitations.push({id:'new-invitation',email:args[1],roles:args[2]});},setMember:async(...args)=>window.calls.push(['member',...args]),acceptInvitation:async(...args)=>window.calls.push(['accept',...args])
  };
  window.adminLoadingRepository=repository;
  window.context=createSchoolContext({repository});await window.context.load('account');
  window.openAdminPage=async(mode='school')=>{window.view?.destroy();window.view=createSchoolAdminView({root,context:window.context,repository,mode});await window.view.show();};
  await window.openAdminPage();
 });

 // Hold actual administration repository reads to inspect both loading layouts.
 await page.evaluate(() => {
  for (const method of ['listMyInvitations','listPlatformAdmins']) {
   const read = window.adminLoadingRepository[method];
   window.adminLoadingRepository[method] = async (...args) => {
    const gate = window.adminLoadingGate;
    if (gate) { await gate.promise; if (gate.fail) throw new Error('Loading fixture unavailable.'); }
    return read(...args);
   };
  }
  window.holdAdminLoading = mode => {
   const gate = {}; gate.promise = new Promise(resolve => { gate.release = resolve; });
   window.adminLoadingGate = gate; window.pendingAdminLoading = window.openAdminPage(mode);
  };
  window.releaseAdminLoading = async (fail = false) => {
   const gate = window.adminLoadingGate; window.adminLoadingGate = null;
   gate.fail = fail; gate.release(); await window.pendingAdminLoading;
  };
 });
 for (const mode of ['school','platform']) {
  await page.evaluate(mode => { window.holdAdminLoading(mode); }, mode);
  await page.locator('.school-admin-loading').waitFor();
  assert.equal(await page.locator('main').getAttribute('aria-busy'),'true');
  const motion = await page.locator('.school-admin-loading-line').first().evaluate(el => ({ name:getComputedStyle(el).animationName, duration:getComputedStyle(el).animationDuration }));
  assert.deepEqual(motion,{name:'schoolAdminLoadingPulse',duration:'1.45s'});
  for (const width of [1440,390,320]) {
   await page.setViewportSize({width,height:900});
   assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1),false,`${mode} loading overflow at ${width}px`);
   await page.screenshot({path:`/tmp/${mode}-loading-${width}.png`,fullPage:true});
  }
  await page.emulateMedia({reducedMotion:'reduce'});
  assert.equal(await page.locator('.school-admin-loading-line').first().evaluate(el => getComputedStyle(el).animationName),'none');
  await page.emulateMedia({reducedMotion:'no-preference'});
  await page.evaluate(() => window.releaseAdminLoading());
  assert.equal(await page.locator('.school-admin-loading').count(),0);
  assert.equal(await page.locator('main').getAttribute('aria-busy'),null);
  await page.evaluate(mode => { window.holdAdminLoading(mode); }, mode);
  await page.locator('.school-admin-loading').waitFor();
  await page.evaluate(() => window.releaseAdminLoading(true));
  await page.getByText('Loading fixture unavailable.',{exact:true}).waitFor();
  assert.equal(await page.locator('.school-admin-loading').count(),0);
  assert.equal(await page.locator('main').getAttribute('aria-busy'),null);
  if (mode === 'school') assert.equal(await page.getByRole('button',{name:'Refresh access',exact:true}).isEnabled(),true);
  else assert.equal(await page.getByRole('button',{name:'Refresh access',exact:true}).count(),0);
  await page.evaluate(mode => { window.holdAdminLoading(mode); }, mode);
  await page.locator('.school-admin-loading').waitFor();
  await page.evaluate(() => { window.view.deactivate(); });
  assert.equal(await page.locator('.school-admin-loading').count(),0);
  assert.equal(await page.locator('main').getAttribute('aria-busy'),null);
  await page.evaluate(() => window.releaseAdminLoading());
 }
 await page.setViewportSize({width:1280,height:720});
 await page.evaluate(() => window.openAdminPage('school'));
 await page.evaluate(() => {
  const read = window.adminLoadingRepository.getAccess;
  window.adminAccessGate = new Promise(resolve => { window.releaseAdminAccess = resolve; });
  window.adminLoadingRepository.getAccess = async (...args) => { await window.adminAccessGate; if (window.failAdminAccessOnce) { window.failAdminAccessOnce = false; throw new Error('Access refresh unavailable.'); } return read(...args); };
 });
 await page.getByRole('button',{name:'Refresh access',exact:true}).click();
 await page.locator('main[aria-busy="true"] .school-admin-loading').waitFor();
 await page.evaluate(() => { window.releaseAdminAccess(); });
 await page.locator('.school-admin-loading').waitFor({state:'detached'});
 await page.getByRole('tab',{name:'Members',exact:true}).waitFor();
 assert.equal(await page.locator('main').getAttribute('aria-busy'),null);

 await page.evaluate(() => { window.failAdminAccessOnce = true; });
 await page.getByRole('button',{name:'Refresh access',exact:true}).click();
 await page.getByText('Access refresh unavailable.',{exact:true}).waitFor();
 assert.equal(await page.locator('main').getAttribute('aria-busy'),null);
 await page.getByRole('button',{name:'Retry',exact:true}).click();
 await page.getByRole('tab',{name:'Members',exact:true}).waitFor();
 await page.evaluate(() => { window.adminAccessGate = new Promise(resolve => { window.releaseAdminAccess = resolve; }); });
 await page.getByRole('button',{name:'Refresh access',exact:true}).click();
 await page.locator('.school-admin-loading').waitFor();
 await page.evaluate(() => { window.view.deactivate(); window.releaseAdminAccess(); });
 await page.waitForFunction(() => !document.querySelector('main[aria-busy]'));
 await page.evaluate(() => window.openAdminPage('school'));
 assert.equal(await page.locator('main img').count(),0);
 assert.equal(await page.getByRole('tab',{name:'Members',exact:true}).getAttribute('aria-selected'),'true');
 assert.equal(await page.getByRole('button',{name:'Save member',exact:true}).count(),0);
 await page.getByRole('tab',{name:'Members',exact:true}).focus();
 await page.keyboard.press('ArrowRight');
 assert.equal(await page.getByRole('tab',{name:'Invitations',exact:true}).getAttribute('aria-selected'),'true');
 assert.equal(await page.getByRole('heading',{name:'Add an existing account',exact:true,includeHidden:true}).count(),0);
 await page.getByRole('button',{name:'New invitation',exact:true}).click();
 await page.getByRole('dialog',{name:'New invitation',exact:true}).waitFor();
 await page.getByLabel('Email',{exact:true}).fill('draft@example.org');
 await page.keyboard.press('Escape');
 assert.equal(await page.getByRole('dialog').count(),0);
 assert.equal(await page.getByRole('button',{name:'New invitation',exact:true}).evaluate(node=>node===document.activeElement),true);
 assert.equal(await page.evaluate(()=>window.calls.length),0);
 await page.getByRole('button',{name:'New invitation',exact:true}).click();
 await page.getByLabel('Email',{exact:true}).fill('teacher@example.org');await page.getByRole('button',{name:'Create invitation'}).click();
 await page.getByRole('button',{name:'New invitation',exact:true}).waitFor();
 assert.deepEqual(await page.evaluate(()=>window.calls[0]),['invite','a','teacher@example.org',['teacher']]);
 assert.equal(await page.getByRole('dialog').count(),0);
 await page.getByText('teacher@example.org · teacher · Pending',{exact:false}).waitFor();
 await page.getByRole('button',{name:'New invitation',exact:true}).click();
 await page.getByRole('button',{name:'Cancel',exact:true}).click();
 assert.equal(await page.getByRole('dialog').count(),0);
 await page.evaluate(async()=>{window.context.select('b');await window.view.show();});await page.getByRole('button',{name:'Edit Member b',exact:true}).waitFor();
 await page.getByRole('button',{name:'Edit Member b',exact:true}).click();
 await page.getByRole('button',{name:'Remove from school'}).click();await page.getByRole('heading',{name:'School members'}).waitFor();
 assert.deepEqual(await page.evaluate(()=>window.calls.at(-1)),['member','b','member',['teacher','student'],false,{grade:'6',section:'A'}]);
 await page.getByRole('tab',{name:'Invitations',exact:true}).click();
 await page.getByRole('button',{name:'Accept invitation'}).click();await page.getByRole('button',{name:'New invitation',exact:true}).waitFor();
 await page.getByRole('tab',{name:'Members',exact:true}).click();
 await page.getByRole('button',{name:'Edit Member b',exact:true}).click();
 assert.deepEqual(await page.evaluate(()=>window.calls.at(-1)),['accept','invitation']);
 await page.getByLabel('Grade',{exact:true}).fill(' 7 ');await page.getByLabel('Section',{exact:true}).fill(' B ');
 await page.getByRole('button',{name:'Save member',exact:true}).click();await page.getByRole('heading',{name:'School members'}).waitFor();
 assert.deepEqual(await page.evaluate(()=>window.calls.at(-1)),['member','b','member',['teacher','student'],true,{grade:'7',section:'B'}]);
 await page.getByRole('button',{name:'Edit Member b',exact:true}).click();
 await page.getByLabel('Grade',{exact:true}).fill('');await page.getByLabel('Section',{exact:true}).fill(' ');
 await page.getByRole('button',{name:'Save member',exact:true}).click();await page.getByRole('heading',{name:'School members'}).waitFor();
 assert.deepEqual(await page.evaluate(()=>window.calls.at(-1)),['member','b','member',['teacher','student'],true,{grade:null,section:null}]);
 await page.evaluate(async()=>{
  window.auditPeople=[{user_id:'admin-a',display_name:'Porfirio Rios',email:'pjrios@example.org',roles:['school_admin']}];
  window.auditFixtures=Array.from({length:23},(_,i)=>({id:23-i,created_at:'2026-10-15T17:00:00Z',action:`event.${String(i).padStart(2,'0')}`,actor_id:'admin-a',target_user_id:`member-${i}`}));
  await window.view.show();
 });
 await page.getByRole('tab',{name:'History',exact:true}).click();
 const history=page.locator('#school-admin-panel-history');
 await history.getByText('Porfirio Rios',{exact:true}).first().waitFor();
 assert.equal(await history.getByText('admin-a',{exact:true}).count(),0);
 assert.equal(await history.locator('tbody tr').count(),10);
 assert.equal(await page.getByRole('button',{name:'Previous history page',exact:true}).isDisabled(),true);
 await page.getByRole('button',{name:'Next history page',exact:true}).click();
 await page.getByText('Events 11–20 of 23',{exact:true}).waitFor();
 assert.equal(await history.locator('tbody tr').count(),10);
 assert.equal(await history.getByText('Event 00',{exact:true}).count(),0);
 assert.equal(await history.getByText('Event 10',{exact:true}).isVisible(),true);
 await page.getByRole('button',{name:'Next history page',exact:true}).click();
 await page.getByText('Events 21–23 of 23',{exact:true}).waitFor();
 assert.equal(await history.locator('tbody tr').count(),3);
 assert.equal(await page.getByRole('button',{name:'Next history page',exact:true}).isDisabled(),true);
 await page.getByRole('button',{name:'Previous history page',exact:true}).click();
 await page.getByText('Events 11–20 of 23',{exact:true}).waitFor();
 await page.getByRole('button',{name:'Previous history page',exact:true}).click();
 await page.getByText('Events 1–10 of 23',{exact:true}).waitFor();
 assert.equal(await history.getByText('Event 00',{exact:true}).isVisible(),true);
 assert.equal(await page.getByRole('button',{name:'Previous history page',exact:true}).isDisabled(),true);
 await page.getByRole('tab',{name:'Academic years',exact:true}).click();
 assert.equal(await page.getByRole('table',{name:'Academic years',exact:true}).count(),1);
 assert.equal(await page.locator('#school-admin-panel-years input[type="date"]').count(),0);
 await page.getByRole('button',{name:'Edit academic year 2026',exact:true}).click();
 await page.getByRole('dialog',{name:'Edit academic year',exact:true}).waitFor();
 assert.equal(await page.getByLabel('Year',{exact:true}).evaluate(node=>node.readOnly),true);
 await page.getByLabel('Year label',{exact:true}).fill('2026 school year');
 await page.getByLabel('Trimester 1 start',{exact:true}).fill('2026-03-03');
 await page.getByLabel('Trimester 2 start',{exact:true}).fill('2026-04-01');
 const beforeInvalidSave=await page.evaluate(()=>window.calls.length);
 await page.getByRole('button',{name:'Save academic year',exact:true}).click();
 await page.getByRole('dialog').getByText('Trimester 2 must start after the previous trimester ends.',{exact:true}).waitFor();
 assert.equal(await page.evaluate(()=>window.calls.length),beforeInvalidSave);
 await page.getByLabel('Trimester 2 start',{exact:true}).fill('2026-06-08');
 await page.getByRole('button',{name:'Save academic year',exact:true}).click();
 await page.getByRole('dialog').waitFor({state:'detached'});
 assert.equal(await page.evaluate(()=>window.calls.at(-1)[1]),'b');
 assert.equal(await page.evaluate(()=>window.schoolSettings.schoolCalendar.trimesters.IT.weekCount),13);
 assert.equal(await page.evaluate(()=>window.schoolSettings.other.keep),true);
 assert.deepEqual(await page.evaluate(()=>[window.yearWriteOwner,window.settingWriteOwner]),[{owner:'account',current:true,signal:true},{owner:'account',current:true,signal:true}]);
 await page.getByRole('button',{name:'Edit academic year 2026',exact:true}).click();
 assert.equal(await page.getByLabel('Trimester 1 start',{exact:true}).inputValue(),'2026-03-03');
 assert.equal(await page.getByLabel('Year label',{exact:true}).inputValue(),'2026 school year');
 await page.getByRole('button',{name:'Cancel',exact:true}).click();
 await page.getByRole('button',{name:'New year',exact:true}).click();
 await page.getByRole('dialog',{name:'New academic year',exact:true}).waitFor();
 await page.getByLabel('Year',{exact:true}).fill('2027');
 await page.getByLabel('Year label',{exact:true}).fill('2027 school year');
 assert.equal(await page.getByLabel('Trimester 1 start',{exact:true}).inputValue(),'');
 for (const [number,start,end] of [[1,'2027-03-01','2027-05-28'],[2,'2027-06-07','2027-09-03'],[3,'2027-09-13','2027-12-10']]) {
  await page.getByLabel(`Trimester ${number} start`,{exact:true}).fill(start);
  await page.getByLabel(`Trimester ${number} end`,{exact:true}).fill(end);
 }
 await page.evaluate(()=>window.failCalendarSaveOnce=true);
 await page.getByRole('button',{name:'Save academic year',exact:true}).click();
 await page.getByRole('dialog').getByText('The year was saved, but its trimester dates were not saved. Retry to finish saving.',{exact:true}).waitFor();
 assert.equal(await page.getByLabel('Trimester 1 start',{exact:true}).inputValue(),'2027-03-01');
 await page.getByRole('button',{name:'Save academic year',exact:true}).click();
 await page.getByRole('dialog').waitFor({state:'detached'});
 await page.getByRole('button',{name:'Edit academic year 2027',exact:true}).waitFor();
 assert.deepEqual(await page.evaluate(()=>window.calls.filter(call=>call[0]==='year').at(-1)),['year','b',2027,'2027 school year',false]);
 assert.equal(await page.evaluate(()=>window.schoolSettings.schoolCalendar.schoolYear),'2026');
 assert.equal(await page.evaluate(()=>window.schoolSettings.schoolCalendar.trimesters.IT.startDate),'2026-03-03');
 assert.equal(await page.evaluate(()=>window.schoolSettings.schoolCalendar.academicYears['2027'].trimesters.IT.startDate),'2027-03-01');
 await page.getByRole('button',{name:'Edit academic year 2027',exact:true}).click();
 assert.equal(await page.getByLabel('Trimester 1 start',{exact:true}).inputValue(),'2027-03-01');
 await page.keyboard.press('Escape');
 assert.equal(await page.getByRole('dialog').count(),0);
 await page.getByRole('button',{name:'Archive academic year 2027',exact:true}).click();
 await page.getByRole('button',{name:'Reopen academic year 2027',exact:true}).waitFor();
 assert.deepEqual(await page.evaluate(()=>window.calls.at(-1)),['year','b',2027,'2027 school year',true]);
 assert.deepEqual(await page.evaluate(()=>window.yearWriteOwner),{owner:'account',current:true,signal:true});
 await page.getByRole('button',{name:'Reopen academic year 2027',exact:true}).click();
 await page.getByRole('button',{name:'Archive academic year 2027',exact:true}).waitFor();
 assert.deepEqual(await page.evaluate(()=>window.yearWriteOwner),{owner:'account',current:true,signal:true});
 // A held original-account year response must not start a calendar write for a replacement account.
 const settingCallsBeforeAccountChange=await page.evaluate(()=>window.calls.filter(call=>call[0]==='setting').length);
 await page.getByRole('button',{name:'Edit academic year 2027',exact:true}).click();
 await page.evaluate(()=>{window.yearSaveStarted=false;window.yearSaveCompleted=false;window.yearSaveGate=new Promise(resolve=>window.releaseYearSave=resolve);});
 await page.getByRole('button',{name:'Save academic year',exact:true}).click();
 await page.waitForFunction(()=>window.yearSaveStarted);
 await page.evaluate(async()=>{await window.context.load('replacement-account');window.releaseYearSave();});
 await page.waitForFunction(()=>window.yearSaveCompleted);
 assert.equal(await page.evaluate(()=>window.calls.filter(call=>call[0]==='setting').length),settingCallsBeforeAccountChange);
 await page.evaluate(async()=>{await window.context.load('account');});
 await page.evaluate(()=>window.openAdminPage('platform'));
 assert.equal(await page.getByRole('table',{name:'Schools',exact:true}).count(),1);
 for (const width of [1440,390,320]) {
  await page.setViewportSize({width,height:900});
  const trigger = page.getByRole('button',{name:'Actions for School a',exact:true});
  await trigger.scrollIntoViewIfNeeded();
  const table = page.getByRole('table',{name:'Schools',exact:true});
  const before = await table.boundingBox();
  await trigger.click();
  const menu = page.getByRole('menu',{name:'Actions for School a',exact:true}); await menu.waitFor();
  assert.deepEqual(await table.boundingBox(),before);
  const bounds = await menu.boundingBox();
  assert.ok(bounds.x>=0 && bounds.x+bounds.width<=width && bounds.y>=0 && bounds.y+bounds.height<=900);
  await trigger.click(); assert.equal(await menu.isVisible(),false);
  await trigger.click(); await menu.waitFor(); await page.keyboard.press('Escape');
  assert.equal(await menu.isVisible(),false);
 }
 await page.setViewportSize({width:1280,height:720});
 assert.equal(await page.getByLabel('School name',{exact:true}).count(),0);
 await page.getByRole('button',{name:'New school',exact:true}).click();
 await page.getByLabel('School name',{exact:true}).fill('New school');
 await page.getByLabel('First administrator email',{exact:true}).fill('new-admin@example.org');
 assert.equal(await page.getByLabel('First school administrator account ID').count(),0);
 await page.getByRole('button',{name:'Create school',exact:true}).click();
 await page.getByText('Response lost. Retry this request.',{exact:true}).waitFor();
 const firstRequest=await page.evaluate(()=>window.calls.at(-1)[1]);
 assert.equal(firstRequest.adminEmail,'new-admin@example.org');assert.ok(firstRequest.requestId);
 await page.getByRole('button',{name:'Create school',exact:true}).click();
 await page.getByRole('dialog').waitFor({state:'detached'});
 assert.equal(await page.evaluate(()=>window.calls.at(-1)[1].requestId),firstRequest.requestId);
 await page.getByRole('button',{name:'Actions for New school',exact:true}).click();
 await page.getByRole('menuitem',{name:'Replace administrator invitation for New school',exact:true}).click();
 await page.getByRole('heading',{name:'Replace first administrator invitation',exact:true}).waitFor();
 assert.equal(await page.getByRole('heading',{name:'Add an existing account',exact:true}).count(),0);
 await page.getByLabel('Administrator email',{exact:true}).fill('replacement@example.org');
 await page.getByRole('button',{name:'Replace invitation',exact:true}).click();
 await page.getByRole('dialog').waitFor({state:'detached'});
 assert.deepEqual(await page.evaluate(()=>window.calls.at(-1)),['replaceInitial','pending','replacement@example.org']);
 await page.evaluate(()=>window.openAdminPage('platform'));
 await page.getByRole('button',{name:'Actions for New school',exact:true}).click();
 await page.getByRole('menuitem',{name:'Cancel onboarding for New school',exact:true}).click();
 await page.getByRole('button',{name:'Actions for New school',exact:true}).click();
 await page.getByRole('menuitem',{name:'Reactivate New school',exact:true}).waitFor();
 assert.deepEqual(await page.evaluate(()=>window.calls.at(-1)),['schoolActive','pending',false]);
 await page.getByRole('tab',{name:'Administrators',exact:true}).click();
 await page.getByRole('button',{name:'Add administrator',exact:true}).click();
 await page.getByLabel('Account ID',{exact:true}).fill('added-admin');
 await page.getByRole('button',{name:'Grant access',exact:true}).click();
 await page.getByRole('dialog').waitFor({state:'detached'});
 assert.deepEqual(await page.evaluate(()=>window.calls.at(-1)),['platformAdmin','added-admin',true]);
 const adminTrigger = page.getByRole('button',{name:'Actions for added-admin@example.org',exact:true});
 await adminTrigger.click();
 await page.getByRole('menu',{name:'Actions for added-admin@example.org',exact:true}).waitFor();
 await adminTrigger.click();
 assert.equal(await page.getByRole('menu',{name:'Actions for added-admin@example.org',exact:true}).isVisible(),false);
 await adminTrigger.click();
 await page.getByRole('menuitem',{name:'Revoke platform access for added-admin@example.org',exact:true}).click();
 await page.getByRole('table',{name:'Platform administrators',exact:true}).getByText('Inactive',{exact:true}).waitFor();
 assert.deepEqual(await page.evaluate(()=>window.calls.at(-1)),['platformAdmin','added-admin',false]);
 await page.evaluate(async()=>{window.context.select('a');await window.openAdminPage();});
 await page.getByRole('button',{name:'Edit Member a',exact:true}).waitFor();
 await page.evaluate(async()=>{window.memberFixtures=Array.from({length:56},(_,i)=>({user_id:`member-${i}`,display_name:`Person ${String(i).padStart(2,'0')}`,email:`person${i}@example.org`,active:true,roles:['student']}));await window.view.show();});
 assert.equal(await page.locator('.school-admin-member-row').count(),10);
 assert.equal(await page.getByRole('button',{name:'Previous members page',exact:true}).isDisabled(),true);
 await page.evaluate(()=>window.failMemberPageOnce=true);
 await page.getByRole('button',{name:'Next members page',exact:true}).click();
 await page.getByText('Could not load the next members page.',{exact:true}).waitFor();
 assert.equal(await page.locator('.school-admin-member-row').count(),10);
 assert.equal(await page.getByRole('button',{name:'Edit Person 00',exact:true}).isVisible(),true);
 assert.equal(await page.getByRole('button',{name:'Next members page',exact:true}).isEnabled(),true);
 await page.getByRole('button',{name:'Next members page',exact:true}).click();
 await page.getByText('Members 11–20 of 56',{exact:true}).waitFor();
 assert.deepEqual(await page.evaluate(()=>window.memberQueries.at(-1)),{id:'a',search:'',limit:10,offset:10});
 assert.equal(await page.locator('.school-admin-member-row').count(),10);
 assert.equal(await page.getByRole('button',{name:'Edit Person 00',exact:true}).count(),0);
 assert.equal(await page.getByRole('button',{name:'Edit Person 10',exact:true}).isVisible(),true);
 await page.getByRole('button',{name:'Previous members page',exact:true}).click();
 await page.getByText('Members 1–10 of 56',{exact:true}).waitFor();
 assert.equal(await page.getByRole('button',{name:'Edit Person 00',exact:true}).isVisible(),true);
 assert.equal(await page.getByRole('button',{name:'Previous members page',exact:true}).isDisabled(),true);
 for (const [start,end] of [[11,20],[21,30],[31,40],[41,50],[51,56]]) {
  await page.getByRole('button',{name:'Next members page',exact:true}).click();
  await page.getByText(`Members ${start}–${end} of 56`,{exact:true}).waitFor();
  assert.equal(await page.locator('.school-admin-member-row').count(),end-start+1);
 }
 assert.equal(await page.getByRole('button',{name:'Next members page',exact:true}).isDisabled(),true);
 const rosterReadsBeforeFilter=await page.evaluate(()=>window.fullMemberQueries?.length||0);
 await page.evaluate(()=>{window.memberFixtures.forEach((member,index)=>member.roles=index%3===0?['teacher','school_admin']:['student']);});
 await page.getByLabel('Role',{exact:true}).selectOption('teacher');
 await page.getByText('Members 1–10 of 19',{exact:true}).waitFor();
 assert.equal(await page.locator('.school-admin-member-row').count(),10);
 await page.getByRole('button',{name:'Next members page',exact:true}).click();
 await page.getByText('Members 11–19 of 19',{exact:true}).waitFor();
 assert.equal(await page.locator('.school-admin-member-row').count(),9);
 assert.equal(await page.getByRole('button',{name:'Next members page',exact:true}).isDisabled(),true);
 assert.equal(await page.evaluate(()=>window.fullMemberQueries.length),rosterReadsBeforeFilter+1);
 await page.getByLabel('Search members by name or email').fill('Person 03');
 await page.getByRole('button',{name:'Search members',exact:true}).click();
 await page.getByText('Members 1–1 of 1',{exact:true}).waitFor();
 assert.equal(await page.getByRole('button',{name:'Edit Person 03',exact:true}).isVisible(),true);
 await page.getByLabel('Role',{exact:true}).selectOption('student');
 await page.getByText('No members match this search.',{exact:true}).waitFor();
 await page.getByLabel('Search members by name or email').fill('');
 await page.getByLabel('Role',{exact:true}).selectOption('');
 await page.getByText('Members 1–10 of 56',{exact:true}).waitFor();
 await page.getByLabel('Search members by name or email').fill('person1@example.org');
 await page.getByRole('button',{name:'Search members',exact:true}).click();
 await page.getByRole('button',{name:'Edit Person 01',exact:true}).waitFor();
 assert.deepEqual(await page.evaluate(()=>window.memberQueries.at(-1)),{id:'a',search:'person1@example.org',limit:10,offset:0});
 assert.equal(await page.locator('.school-admin-member-row').count(),1);
 await page.getByLabel('Search members by name or email').fill('missing');
 await page.getByRole('button',{name:'Search members',exact:true}).click();
 await page.getByText('No members match this search.',{exact:true}).waitFor();
 await page.evaluate(async()=>{window.context.select('b');await window.view.show();});
 await page.getByText('Members 1–10 of 56',{exact:true}).waitFor();
 assert.equal(await page.getByLabel('Search members by name or email').inputValue(),'');
 await page.evaluate(async()=>{
  window.platformAdmin=false; window.schools=window.schools.filter(s=>s.id==='a');
  await window.context.load('account'); await window.view.show();
 });
 await page.getByRole('heading',{name:'School settings',exact:true}).waitFor();
 assert.equal(await page.getByLabel('School',{exact:true}).count(),0);
 assert.equal(await page.getByRole('tab',{name:'Platform',exact:true}).count(),0);
 assert.equal(await page.getByRole('button',{name:'Create school and invite administrator',exact:true,includeHidden:true}).count(),0);
 assert.equal(await page.getByRole('heading',{name:'School members',exact:true}).isVisible(),true);
 assert.equal(await page.evaluate(()=>window.memberQueries.at(-1).id),'a');
 await page.getByRole('tab',{name:'Invitations',exact:true}).click();
 await page.getByRole('button',{name:'New invitation',exact:true}).click();
 await page.getByLabel('Email',{exact:true}).fill('retry@example.org');
 await page.evaluate(()=>window.failInviteOnce=true);
 await page.getByRole('button',{name:'Create invitation',exact:true}).click();
 await page.getByRole('dialog').getByText('Could not create invitation. Try again.',{exact:true}).waitFor();
 assert.equal(await page.getByLabel('Email',{exact:true}).inputValue(),'retry@example.org');
 await page.evaluate(()=>window.context.clear());assert.equal(await page.locator('main').innerText(),'');
 assert.equal(await page.getByRole('dialog').count(),0);
 await page.evaluate(async()=>{
  const {createTeacherClassWorkspace}=await import('/js/teacherClassWorkspace.js');
  window.view.destroy();window.years=[{year:2026,label:'Current year',archived:false},{year:2025,label:'Past year',archived:true}];
  window.classView=createTeacherClassWorkspace({root:document.querySelector('main'),getUserId:()=> 'teacher',
   schoolRepository:{listYears:async()=>window.years},repository:{listClasses:async()=>[],listSubjects:async()=>[{id:'subject',name:'Technology'}],createClass:async value=>window.createdClass=value}});
  await window.classView.show();
 });
 await page.getByRole('button',{name:'Create class',exact:true}).click();
 await page.getByLabel('Class name',{exact:true}).fill('Technology 6A');
 assert.deepEqual(await page.getByRole('dialog').locator('select[name="year"] option').allTextContents(),['Current year']);
 await page.getByRole('dialog').getByRole('button',{name:'Create class',exact:true}).click();
 await page.getByRole('dialog').waitFor({state:'detached'});
 assert.equal(await page.evaluate(()=>window.createdClass.schoolYear),'2026');
 await page.evaluate(async()=>{window.years=[];await window.classView.show();});
 assert.equal(await page.getByRole('button',{name:'Create class',exact:true}).isDisabled(),true);
 console.log('School administration and academic year class selection browser smoke passed.');
} finally {await browser?.close();server?.kill();}
