import assert from 'node:assert/strict';
import { chromium } from 'playwright';
import { ensureViteServer } from './lib/local-vite-server.mjs';
const port = 8058, baseUrl = `http://127.0.0.1:${port}`;
let server, browser;
try {
 server = await ensureViteServer({ baseUrl, probePath: '/', host: '127.0.0.1', port });
 browser = await chromium.launch(); const page = await browser.newPage(); await page.goto(baseUrl);
 await page.evaluate(async () => {
  document.body.replaceChildren(); const root = document.createElement('main'); document.body.append(root);
  const { createSchoolContext } = await import('/js/services/schoolContext.js');
  const { createSchoolAdminView } = await import('/js/schoolAdminView.js');
  window.calls=[];window.schools=['a','b'].map(id=>({id,name:`School ${id}`,active:true,roles:['school_admin']}));window.failCreateOnce=true;window.years=[{year:2026,label:'2026',archived:false}];
  const repository={
   getAccess: async()=>({platformAdmin:true,schools:window.schools}),
   createSchool:async value=>{window.calls.push(['create',value]);if(!window.schools.some(s=>s.id==='pending'))window.schools.push({id:'pending',name:value.name,active:false,onboardingPending:true,roles:[]});if(window.failCreateOnce){window.failCreateOnce=false;throw new Error('Response lost. Retry this request.');}return window.schools.at(-1);},
   setSchoolActive:async(id,active)=>{window.calls.push(['schoolActive',id,active]);Object.assign(window.schools.find(s=>s.id===id),{active,onboardingPending:false});},
   listMyInvitations:async()=>[{id:'invitation',school_name:'<img src=x>',roles:['teacher']}],
   listMembersPage:async(id,{search,limit,offset})=>{window.memberQueries??=[];window.memberQueries.push({id,search,limit,offset});const all=window.memberFixtures||[{user_id:'member',display_name:`Member ${id}`,grade:'6',section:'A',active:true,roles:['teacher','student']}];const matched=all.filter(m=>`${m.display_name} ${m.email||''}`.toLowerCase().includes(search.toLowerCase()));return {members:matched.slice(offset,offset+limit),total:matched.length,limit,offset};},
   listYears:async()=>window.years,setYear:async(id,year,label,archived)=>{window.calls.push(['year',id,year,label,archived]);const previous=window.years.find(item=>item.year===year);if(previous)Object.assign(previous,{label,archived});else window.years.push({year,label,archived});},
   listInvitations:async()=>[],listAudit:async()=>[],listPlatformAdmins:async()=>[],
   replaceInitialAdminInvitation:async(...args)=>window.calls.push(['replaceInitial',...args]),
   inviteMember:async(...args)=>window.calls.push(['invite',...args]),setMember:async(...args)=>window.calls.push(['member',...args]),acceptInvitation:async(...args)=>window.calls.push(['accept',...args])
  };
  window.context=createSchoolContext({repository});await window.context.load('account');
  window.view=createSchoolAdminView({root,context:window.context,repository});await window.view.show();
 });
 assert.equal(await page.locator('main img').count(),0);
 await page.getByLabel('Email',{exact:true}).fill('teacher@example.org');await page.getByRole('button',{name:'Create invitation'}).click();
 await page.getByRole('heading',{name:'School members'}).waitFor();
 assert.deepEqual(await page.evaluate(()=>window.calls[0]),['invite','a','teacher@example.org',['teacher']]);
 await page.getByLabel('School',{exact:true}).selectOption('b');await page.getByRole('heading',{name:'Member b',exact:true}).waitFor();
 await page.getByRole('button',{name:'Remove from school'}).click();await page.getByRole('heading',{name:'School members'}).waitFor();
 assert.deepEqual(await page.evaluate(()=>window.calls[1]),['member','b','member',['teacher','student'],false,{grade:'6',section:'A'}]);
 await page.getByRole('button',{name:'Accept invitation'}).click();await page.getByRole('heading',{name:'School members'}).waitFor();
 assert.deepEqual(await page.evaluate(()=>window.calls[2]),['accept','invitation']);
 await page.getByLabel('Grade',{exact:true}).fill(' 7 ');await page.getByLabel('Section',{exact:true}).fill(' B ');
 await page.getByRole('button',{name:'Save member',exact:true}).click();await page.getByRole('heading',{name:'School members'}).waitFor();
 assert.deepEqual(await page.evaluate(()=>window.calls.at(-1)),['member','b','member',['teacher','student'],true,{grade:'7',section:'B'}]);
 await page.getByLabel('Grade',{exact:true}).fill('');await page.getByLabel('Section',{exact:true}).fill(' ');
 await page.getByRole('button',{name:'Save member',exact:true}).click();await page.getByRole('heading',{name:'School members'}).waitFor();
 assert.deepEqual(await page.evaluate(()=>window.calls.at(-1)),['member','b','member',['teacher','student'],true,{grade:null,section:null}]);
 await page.getByLabel('Year',{exact:true}).fill('2027');await page.getByLabel('Year label',{exact:true}).fill('2027 school year');
 await page.getByRole('button',{name:'Save academic year'}).click();await page.getByText('2027 school year (2027)',{exact:false}).waitFor();
 assert.deepEqual(await page.evaluate(()=>window.calls.at(-1)),['year','b',2027,'2027 school year',false]);
 await page.getByText('2027 school year (2027)',{exact:false}).getByRole('button',{name:'Archive academic year'}).click();
 await page.getByRole('button',{name:'Reopen academic year'}).waitFor();
 assert.deepEqual(await page.evaluate(()=>window.calls.at(-1)),['year','b',2027,'2027 school year',true]);
 await page.getByRole('button',{name:'Reopen academic year'}).click();
 await page.getByText('2027 school year (2027)',{exact:false}).getByRole('button',{name:'Archive academic year'}).waitFor();
 await page.getByLabel('School name',{exact:true}).fill('New school');
 await page.getByLabel('First administrator email',{exact:true}).fill('new-admin@example.org');
 assert.equal(await page.getByLabel('First school administrator account ID').count(),0);
 await page.getByRole('button',{name:'Create school and invite administrator',exact:true}).click();
 await page.getByText('Response lost. Retry this request.',{exact:true}).waitFor();
 const firstRequest=await page.evaluate(()=>window.calls.at(-1)[1]);
 assert.equal(firstRequest.adminEmail,'new-admin@example.org');assert.ok(firstRequest.requestId);
 await page.getByRole('button',{name:'Create school and invite administrator',exact:true}).click();
 await page.getByRole('heading',{name:'School members',exact:true}).waitFor();
 assert.equal(await page.evaluate(()=>window.calls.at(-1)[1].requestId),firstRequest.requestId);
 await page.getByLabel('School',{exact:true}).selectOption('pending');
 await page.getByRole('heading',{name:'Replace first administrator invitation',exact:true}).waitFor();
 assert.equal(await page.getByRole('heading',{name:'Add an existing account',exact:true}).count(),0);
 await page.getByLabel('Administrator email',{exact:true}).fill('replacement@example.org');
 await page.getByRole('button',{name:'Replace invitation',exact:true}).click();
 await page.getByRole('heading',{name:'Replace first administrator invitation',exact:true}).waitFor();
 assert.deepEqual(await page.evaluate(()=>window.calls.at(-1)),['replaceInitial','pending','replacement@example.org']);
 await page.getByRole('button',{name:'Cancel school onboarding',exact:true}).click();
 await page.getByRole('button',{name:'Reactivate school',exact:true}).waitFor();
 assert.deepEqual(await page.evaluate(()=>window.calls.at(-1)),['schoolActive','pending',false]);
 await page.getByLabel('School',{exact:true}).selectOption('a');
 await page.getByRole('heading',{name:'Member a',exact:true}).waitFor();
 await page.evaluate(async()=>{window.memberFixtures=Array.from({length:56},(_,i)=>({user_id:`member-${i}`,display_name:`Person ${String(i).padStart(2,'0')}`,email:`person${i}@example.org`,active:true,roles:['student']}));await window.view.show();});
 assert.equal(await page.getByRole('button',{name:'Save member',exact:true}).count(),25);
 await page.getByRole('button',{name:'Next members',exact:true}).click();
 await page.getByText('Members 26–50 of 56',{exact:true}).waitFor();
 assert.deepEqual(await page.evaluate(()=>window.memberQueries.at(-1)),{id:'a',search:'',limit:25,offset:25});
 await page.getByRole('button',{name:'Next members',exact:true}).click();
 await page.getByText('Members 51–56 of 56',{exact:true}).waitFor();
 assert.equal(await page.getByRole('button',{name:'Next members',exact:true}).isDisabled(),true);
 await page.getByLabel('Search members by name or email').fill('person1@example.org');
 await page.getByRole('button',{name:'Search members',exact:true}).click();
 await page.getByRole('heading',{name:'Person 01',exact:true}).waitFor();
 assert.deepEqual(await page.evaluate(()=>window.memberQueries.at(-1)),{id:'a',search:'person1@example.org',limit:25,offset:0});
 assert.equal(await page.getByRole('button',{name:'Save member',exact:true}).count(),1);
 await page.getByLabel('Search members by name or email').fill('missing');
 await page.getByRole('button',{name:'Search members',exact:true}).click();
 await page.getByText('No members match this search.',{exact:true}).waitFor();
 await page.getByLabel('School',{exact:true}).selectOption('b');
 await page.getByText('Members 1–25 of 56',{exact:true}).waitFor();
 assert.equal(await page.getByLabel('Search members by name or email').inputValue(),'');
 await page.evaluate(()=>window.context.clear());assert.equal(await page.locator('main').innerText(),'');
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
