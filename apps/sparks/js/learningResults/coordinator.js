import {LearningSession} from './session.js';
import {LearningStore} from './store.js';
import {LearningSync,acceptedHead,recoverableState} from './sync.js';
import {LearningDelivery} from './delivery.js';
import {learningResultsRepository} from '../services/learningResultsRepository.js';
import {packageReady,makeSchedule} from './task.js';
import {CONTRACT_VERSION,canonical,fail,initialHash,extendHash,frame,bytes,sha256,LIMITS} from './contract.js';
import {deriveOutcome,validateCorrection} from './adapters.js';
const seed=()=>crypto.getRandomValues(new Uint32Array(1))[0] || 1;
export class LearningCoordinator {
    constructor({owner,store=new LearningStore({activeOwner:owner}),repository=learningResultsRepository,prepareAssets,now,newSeed=seed,online=()=>globalThis.navigator?.onLine!==false}) {
        Object.assign(this,{owner,store,repository,prepareAssets,now,newSeed,online});
        this.sync=new LearningSync({store,repository,activeOwner:owner});this.delivery=new LearningDelivery({sync:this.sync,store,activeOwner:owner});
    }
    assertOwner(owner){if(!owner || owner!==this.owner())fail('OWNER_CHANGED');}
    register(queue){return this.delivery.register(queue);}
    async download({source,grade,activity,expectedTaskId=null,signal}) {
        const owner=this.owner();this.assertOwner(owner);
        const response=await this.repository.operation('prepare',{contractVersion:CONTRACT_VERSION,source,grade,activity,expectedTaskId},owner,{signal});this.assertOwner(owner);
        const pkg={...response,id:response.preparationId,source,grade,activity,ready:true,downloadedAt:Date.now()};
        if(pkg.ownerUserId!==owner || !await packageReady(pkg))fail('INVALID_PACKAGE');
        if(!this.prepareAssets)fail('OFFLINE_ASSETS_REQUIRED');pkg.offlineReady=await this.prepareAssets(activity,{signal})===true;this.assertOwner(owner);
        await this.store.savePackage(pkg);return pkg;
    }
    async available({source,grade,activity}) {
        const owner=this.owner(),rows=await this.store.list('learningPackages',owner);
        const matching=rows.filter(p=>p.source && canonical(p.source)===canonical(source) && p.grade===grade && p.activity===activity);
        // Preparation UUIDs are identifiers, not timestamps. Preserve explicit download time.
        matching.sort((a,b)=>(b.downloadedAt || 0)-(a.downloadedAt || 0));
        for(const pkg of matching)if(await packageReady(pkg) && (this.online() || pkg.offlineReady===true))return pkg;
        return null;
    }
    async start(pkg,{kind='ranked_full',predecessorAttemptId=null,writingSnapshot=pkg?.writing}={}) {
        const owner=this.owner();this.assertOwner(owner);if(pkg?.ownerUserId!==owner || !await packageReady(pkg))fail('PREVIOUS_DOWNLOAD_REQUIRED');
        if(!this.online() && (pkg.offlineReady!==true || !this.prepareAssets || await this.prepareAssets(pkg.task.activity)!==true))fail('PREVIOUS_DOWNLOAD_REQUIRED');
        return LearningSession.create({task:pkg.task,preparationId:pkg.preparationId,ownerUserId:owner,seed:this.newSeed(),kind,passingTarget:pkg.passingTarget,
            startContext:pkg.startContext,predecessorAttemptId,writingSnapshot,store:this.store,owner:this.owner,now:this.now});
    }
    async resume(attemptId) {
        const owner=this.owner(),attempt=await this.store.get('learningAttempts',owner,attemptId);this.assertOwner(owner);
        if(!attempt)fail('ATTEMPT_UNAVAILABLE');return new LearningSession({attempt,store:this.store,owner:this.owner,now:this.now});
    }
    async history(contextKey,activity,options={}){const owner=this.owner(),result=await this.repository.read({mode:'history',contextKey,activity,...options},owner);this.assertOwner(owner);return result;}
    async recover(attemptId,{signal}={}) {
        const owner=this.owner();this.assertOwner(owner);
        const existing=await this.store.get('learningAttempts',owner,attemptId);if(existing)return this.resume(attemptId);
        const remote=await this.repository.read({mode:'recovery',attemptId},owner,{signal});this.assertOwner(owner);
        if(remote.status!=='ok' || remote.attemptId!==attemptId || remote.recovery?.ownerUserId!==owner)fail('INVALID_RECOVERY');
        const input=remote.recovery,head=acceptedHead(remote),pkg={...input,id:input.preparationId,activity:input.task.activity,ready:true,downloadedAt:Date.now()};
        if(!await packageReady(pkg))fail('INVALID_PACKAGE');
        const schedule=makeSchedule(input.task,input.seed),events=[],hashes=[];let hash=await initialHash(attemptId,input.task.id),evidenceBytes=0,cursor=0;
        while(cursor<head.sequence){
            const page=await this.repository.read({attemptId,expectedRevision:head.revision,afterSequence:cursor},owner,{signal});this.assertOwner(owner);
            if(page.status==='refresh_required')fail('RECOVERY_CHANGED');
            if(page.status!=='ok' || !page.events?.length || page.nextAfterSequence<=cursor)fail('INVALID_RECOVERY');
            for(const event of page.events){if(event.attemptId!==attemptId || event.sequence!==events.length+1)fail('INVALID_RECOVERY');hash=await extendHash(hash,[event]);hashes.push(hash);evidenceBytes+=frame(event).length;events.push(event);if(events.length>LIMITS.events || evidenceBytes>LIMITS.evidence)fail('EVIDENCE_LIMIT');}
            cursor=page.nextAfterSequence;
        }
        if(events.length!==head.sequence || hash!==head.hash || evidenceBytes!==head.evidenceBytes)fail('INVALID_RECOVERY');
        const state={phase:'paused',crosswordPhase:'original',recordedMilliseconds:0,originals:{},assisted:[],corrections:{},draft:{},writingRevisionId:null};
        for(const event of events){
            state.recordedMilliseconds=event.recordedMilliseconds;
            if(event.type==='assist'){for(const id of event.opportunityIds)if(!state.assisted.includes(id))state.assisted.push(id);}
            if(event.type==='original'){const opportunity=schedule.find(o=>o.id===event.opportunityId);if(!opportunity || state.originals[opportunity.id])fail('INVALID_RECOVERY');const outcome=deriveOutcome(input.task,opportunity,event.response,state.assisted.includes(opportunity.id));state.originals[opportunity.id]={...outcome,credit:{n:String(outcome.credit.n),d:String(outcome.credit.d)}};}
            if(event.type==='reading-submission'){for(const opportunity of schedule){const outcome=deriveOutcome(input.task,opportunity,event.responses[opportunity.id],false);state.originals[opportunity.id]={...outcome,credit:{n:String(outcome.credit.n),d:String(outcome.credit.d)}};}}
            if(event.type==='correction'){const opportunity=schedule.find(o=>o.id===event.opportunityId);if(!validateCorrection(input.task,opportunity,event.answer))fail('INVALID_RECOVERY');state.corrections[event.opportunityId]=event.answer;}
        }
        // Compact state is authoritative only when it hashes to the accepted head.
        if(head.sequence && await sha256(bytes(remote.state))!==head.stateHash)fail('INVALID_RECOVERY');
        const attempt={id:attemptId,attemptId,ownerUserId:owner,task:input.task,preparationId:input.preparationId,passingTarget:input.passingTarget,kind:input.kind,seed:input.seed,
            variantId:input.variantId,startContext:input.startContext,predecessorAttemptId:input.predecessorAttemptId,writingSnapshot:input.writing,schedule,localRevision:0,events,eventHashes:hashes,evidenceBytes,prefixHash:hash,serverHead:head,
            state:{...state,...(remote.state || {})},status:remote.confirmedResult?'submitted':'pending',confirmed:!!remote.confirmedResult,...(remote.confirmedResult?{result:remote.confirmedResult}:{})};
        if(head.sequence && canonical(recoverableState(attempt,attempt.state,head.sequence))!==canonical(remote.state))fail('INVALID_RECOVERY');
        if(!this.prepareAssets)fail('OFFLINE_ASSETS_REQUIRED');pkg.offlineReady=await this.prepareAssets(input.task.activity,{signal})===true;this.assertOwner(owner);
        await this.store.savePackage(pkg);await this.store.commit(attempt);return new LearningSession({attempt,store:this.store,owner:this.owner,now:this.now});
    }
}
