import {createRequire} from 'node:module';
import {pathToFileURL,fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../../',import.meta.url));
const require=createRequire(`${root}/package.json`); require('fake-indexeddb/auto');
const load=path=>import(pathToFileURL(`${root}/${path}`).href);
const {deleteDB}=await load('node_modules/idb/build/index.js');
globalThis.document={body:{appendChild(){}},createElement:()=>({style:{},classList:{add(){},remove(){}},append(){},appendChild(){},addEventListener(){},querySelector(){return null;},remove(){}}),getElementById(){return null;},querySelector(){return null;},querySelectorAll(){return[];}};
globalThis.window={setTimeout,clearTimeout,addEventListener(){},removeEventListener(){}};
Object.defineProperty(globalThis,'navigator',{configurable:true,value:{onLine:true}});
const {imageDB}=await load('js/db.js');
const {supabaseService}=await load('js/supabaseService.js');
const {installSupabaseStudentWriteMethods}=await load('js/supabaseStudentWriteMethods.js');
const {StudentProgressSyncQueue}=await load('js/student/studentProgressSyncQueue.js');
const operations=await load('js/supabaseStudentWriteOperations.js');
const {setActiveStudentStorageOwner}=await load('js/student/persistence/studentStorage.js');
const timeoutMs=30, deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return{promise,resolve};};

async function fixture(label){
 imageDB.dbName=`bounded-drain-${label}-${crypto.randomUUID()}`;
 setActiveStudentStorageOwner('owner-a');
 const first=deferred(), requests=[], applied=[], statuses=[], timers=[];
 let active=0,maxActive=0;
 const service={currentUser:{uid:'owner-a'},authIdentityGeneration:1,async init(){},client:{auth:{async getUser(){return {data:{user:{id:service.currentUser.uid}}};}},rpc(name,args){
  const request={name,eventId:args.p_event_id,sparkId:args.p_spark_id,owner:args.p_expected_user_id,at:performance.now()};requests.push(request);
  active++;maxActive=Math.max(active,maxActive);
  const stalled=name==='submit_student_activity_progress_owned_v1';
  if(!stalled){active--;return {abortSignal(){return Promise.resolve({data:name==='sync_student_unit_work_owned_v1'?{unit:{unitKey:args.p_unit_key}}:{spark_id:args.p_spark_id}});}};}
  const pending=deferred();let reject;
  const result=new Promise((_,r)=>reject=r);
  if(requests.length===1)first.resolve();
  return {abortSignal(signal){signal.addEventListener('abort',()=>{active--;request.aborted=true;reject(signal.reason);},{once:true});return result;}};
 }}};
 installSupabaseStudentWriteMethods(service,{loadOperations:async()=>operations,context:{getGeneration:()=>0}});
 for(const name of ['submitStudentActivityProgress','submitStudentSparkResponse','syncStudentUnitWork'])supabaseService[name]=(payload,options)=>service[name](payload,{...options,timeoutMs});
 const sm={authDisabled:false,currentUser:{uid:'owner-a'},setAuthStatus:text=>statuses.push(text),activities:{progressPersistence:{applyActivityProgressResult:result=>applied.push(result)}}};
 const cloud={sm,progress:{},cloudGeneration:1,isCurrentOwner:owner=>owner===sm.currentUser.uid,applyUnitProgressResult:result=>applied.push(result)};
 const queue=new StudentProgressSyncQueue(cloud);cloud.flushLocalSyncQueue=queue.flushLocalSyncQueue.bind(queue);
 queue.scheduler={now:()=>Date.now(),setTimeout:(callback,delay)=>{timers.push({callback,delay});return timers.length;},clearTimeout(){}};
 const seed=async(count=5,distinct=false)=>{for(let n=0;n<count;n++)await imageDB.enqueueSyncAction('student-activity-progress',{eventId:`stalled-${n}`,unitKey:distinct?`causal-unit-${n}`:'causal-unit-a',activityType:'matching',score:20},{ownerUserId:'owner-a'});};
 const addHealthy=async owner=>{
  await imageDB.enqueueSyncAction('student-spark-response',{eventId:'healthy-spark',sparkId:'unrelated-spark',answers:{q:'fixture'}},{ownerUserId:owner});
  await imageDB.enqueueSyncAction('student-unit-work',{eventId:'healthy-unit',unitKey:'unrelated-unit-b',snapshotOrder:1,workPatch:{notes:'fixture'}},{ownerUserId:owner});
 };
 const close=async()=>{queue.cancelRetry();await imageDB.close();await deleteDB(imageDB.dbName);};
 return {first,requests,applied,statuses,timers,service,sm,cloud,queue,seed,addHealthy,close,active:()=>active,maxActive:()=>maxActive};
}


export {fixture,imageDB};
