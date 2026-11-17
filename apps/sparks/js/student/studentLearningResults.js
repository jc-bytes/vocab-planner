import {LearningCoordinator} from '../learningResults/coordinator.js';
import {ensureLearningQueue} from '../learningResults/queue.js';
import {ReadingLearningRuntime} from '../learningResults/readingRuntime.js';
import {VocabularyLearningRuntime} from '../learningResults/vocabularyRuntime.js';
import {learningAssetsReady} from '../learningResults/runtimeAssets.js';
import {getActiveStudentStorageOwner} from './persistence/studentStorage.js';
import {ACTIVITIES} from '../learningResults/contract.js';
export function studentLearningCoordinator(sm) {
    if(sm.progress?.syncQueue)return ensureLearningQueue(sm.progress.syncQueue);
    const owner=()=>sm.currentUser?.uid && sm.currentUser.uid===getActiveStudentStorageOwner()?sm.currentUser.uid:null;
    if(!sm.learningResults){
        const coordinator=new LearningCoordinator({owner,prepareAssets:learningAssetsReady});sm.learningResults={coordinator,queue:null,unregister:null};
    }
    const state=sm.learningResults,queue=sm.progress?.syncQueue;
    if(queue && queue!==state.queue){state.unregister?.();state.unregister=state.coordinator.register(queue);state.queue=queue;}
    return state.coordinator;
}
export function scheduleLearningSync(sm){const queue=sm.progress?.syncQueue,owner=sm.currentUser?.uid;if(queue && owner)queue.scheduleRetry({ownerUserId:owner,generation:queue.cloud?.cloudGeneration},0);}
export async function prepareSourceLearning(sm,{source,grade,activity,signal}) {
    if(sm.isTeacherUnitPreview || sm.authDisabled || !sm.currentUser)return null;
    const coordinator=studentLearningCoordinator(sm),contextKey=source.kind==='assignment'?`assignment:${source.id}`:`spark:${source.id}`;
    const attempts=await coordinator.store.list('learningAttempts',coordinator.owner()),packages=await coordinator.store.list('learningPackages',coordinator.owner());
    const packageIds=new Set(packages.filter(p=>p.content?.contextKey===contextKey && p.activity===activity).map(p=>p.preparationId));
    const local=attempts.filter(a=>packageIds.has(a.preparationId) && a.syncStatus!=='held').sort((a,b)=>(b.updatedAt || b.createdAt || 0)-(a.updatedAt || a.createdAt || 0));
    if(local.length){const pkg=packages.find(p=>p.preparationId===local[0].preparationId);if(globalThis.navigator?.onLine===false && (!pkg.offlineReady || !await learningAssetsReady()))throw new Error('PREVIOUS_DOWNLOAD_REQUIRED');return {coordinator,session:await coordinator.resume(local[0].id),pkg};}
    if(globalThis.navigator?.onLine!==false){
        try {
            const heldIds=new Set(attempts.filter(a=>a.syncStatus==='held').map(a=>a.id)),seen=new Set();
            let afterId=null;
            do {
                const history=await coordinator.history(contextKey,activity,{limit:100,...(afterId?{afterId}:{})});
                const unfinished=history.attempts.find(a=>!a.finishedAt && !heldIds.has(a.attemptId));
                if(unfinished){
                    try{const session=await coordinator.recover(unfinished.attemptId,{signal}),pkg=await coordinator.store.get('learningPackages',coordinator.owner(),session.attempt.preparationId);return {coordinator,session,pkg};}
                    catch(error){if(error.code==='OWNER_CHANGED' || error.name==='AbortError')throw error;/* A replacement computer can start a fresh independent attempt. */}
                    break;
                }
                afterId=history.nextAfterId;
                if(afterId && seen.has(afterId))throw new Error('INVALID_HISTORY_CURSOR');
                seen.add(afterId);
            }while(afterId);
        }catch(error){if(error.code==='PGRST202')return null;throw error;}
    }
    let pkg;
    if(globalThis.navigator?.onLine===false){pkg=await coordinator.available({source,grade,activity});if(!pkg)return null;}
    else{
        try{pkg=await coordinator.download({source,grade,activity,signal});}
        catch(error){if(['TASK_NOT_PUBLISHED','NO_SCORED_QUESTIONS'].includes(error.message) || error.code==='PGRST202')return null;throw error;}
    }
    return {coordinator,pkg,session:await coordinator.start(pkg)};
}
export async function prepareVocabularyLearning(sm,type,{signal}={}) {
    if(!sm.currentVocab?.assignmentId || !ACTIVITIES.includes(type) || type==='reading-check')return null;
    return prepareSourceLearning(sm,{source:{kind:'assignment',id:sm.currentVocab.assignmentId},grade:Number(sm.studentProfile?.grade),activity:type,signal});
}
async function retryLearning(prepared,runtime,predecessorAttemptId) {
    const owner=prepared.coordinator.owner(),saved=await prepared.coordinator.store.get('learningAttempts',owner,predecessorAttemptId);
    if(globalThis.navigator?.onLine!==false)prepared.pkg=await prepared.coordinator.download({source:prepared.pkg.source,grade:prepared.pkg.grade,activity:prepared.pkg.task.activity});
    const continuous=saved?.syncStatus!=='held' && prepared.pkg.task.id===runtime.session.attempt.task.id;
    return prepared.coordinator.start(prepared.pkg,{predecessorAttemptId:continuous?predecessorAttemptId:null,writingSnapshot:continuous?runtime.session.attempt.writingSnapshot:prepared.pkg.writing});
}
export async function mountVocabularyLearning(sm,root,prepared,{isCurrent=()=>true}={}) {
    let runtime;
    const mount=async session=>{runtime=new VocabularyLearningRuntime({root,session,coordinator:prepared.coordinator,isCurrent,onSaved:()=>scheduleLearningSync(sm),onRetry:async predecessorAttemptId=>{
        const next=await retryLearning(prepared,runtime,predecessorAttemptId);await runtime.destroy();if(!isCurrent())return;await mount(next);
    }});await runtime.render();};
    await mount(prepared.session);return {destroy(){return runtime?.destroy();}};
}

export async function mountReadingLearning(sm,root,{source,grade,isCurrent=()=>true,signal}={}) {
    const prepared=await prepareSourceLearning(sm,{source,grade,activity:'reading-check',signal});if(!prepared)return null;
    return mountPreparedReading(sm,root,prepared,{isCurrent});
}
export async function mountPreparedReading(sm,root,prepared,{isCurrent=()=>true}={}) {
    let runtime;const mount=async session=>{runtime=new ReadingLearningRuntime({root,session,coordinator:prepared.coordinator,content:prepared.pkg.content.source,isCurrent,onSaved:()=>scheduleLearningSync(sm),onRetry:async predecessorAttemptId=>{
        const next=await retryLearning(prepared,runtime,predecessorAttemptId);await runtime.destroy();if(isCurrent())await mount(next);
    }});await runtime.render();};await mount(prepared.session);return {destroy(){return runtime?.destroy();}};
}
