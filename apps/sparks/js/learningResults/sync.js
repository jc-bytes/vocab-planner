import { CONTRACT_VERSION, LIMITS, canonical, bytes, byteLength, sha256, initialHash, extendHash, frame, rpcArguments, fail, integer, unhex } from './contract.js';
export function recoverableState(attempt, state, throughSequence) {
    // Originals and correction history belong to the immutable event stream, never a second editable transcript.
    const result={phase:state.phase,crosswordPhase:state.crosswordPhase,recordedMilliseconds:state.recordedMilliseconds,
        evidenceThroughSequence:throughSequence,draft:state.draft,writingRevisionId:state.writingRevisionId};
    if(byteLength(result)>LIMITS.state) fail('EVIDENCE_LIMIT','recoverableState');return result;
}
export function recoveryAt(attempt,throughSequence) {
    const state={phase:'paused',crosswordPhase:'original',recordedMilliseconds:0,draft:{},writingRevisionId:null};
    let originals=0;
    for(const event of attempt.events.slice(0,throughSequence)) {
        state.recordedMilliseconds=event.recordedMilliseconds;
        switch(event.type) {
        case 'resume': state.phase='answer'; break;
        case 'pause': case 'submission': case 'reading-submission': state.phase='paused'; break;
        case 'phase': state.phase=event.phase; break;
        case 'assist': state.phase='help'; break;
        case 'correction': state.phase='correction'; break;
        case 'draft': state.draft=event.draft; break;
        case 'original':
            originals++;
            if(originals===attempt.schedule.length) state.crosswordPhase='correction';
            state.phase=['crossword','word-search'].includes(attempt.task.activity) && originals<attempt.schedule.length ? 'answer' : 'feedback';
            break;
        }
        if(event.type==='submission' || event.type==='reading-submission') state.writingRevisionId=event.writingRevisionId;
    }
    return recoverableState(attempt,state,throughSequence);
}
// Small upload batches bound device hashing work and hosted transaction time.
export async function buildCheckpoint({attempt,head,intent,operationId,maxEvents=256,requestLimit=LIMITS.request}) {
    if(intent.throughSequence<head.sequence) fail('EVIDENCE_OVERLAP');
    const maximum=Math.min(intent.throughSequence,head.sequence+maxEvents);
    const build=async end=>{
        const events=attempt.events.slice(head.sequence,end);
        const payload={contractVersion:CONTRACT_VERSION,attemptId:attempt.id,expectedRevision:head.revision,localCheckpointRevision:intent.localRevision,
            baseSequence:head.sequence,baseHash:head.hash,throughSequence:end,throughHash:await extendHash(head.hash,events),events,
            recoverableState:end===intent.throughSequence ? recoverableState(attempt,intent.state,end) : recoveryAt(attempt,end)};
        payload.chunkHash=await sha256(bytes({operationId,payload}));
        return rpcArguments(operationId,payload,requestLimit,attempt.ownerUserId);
    };
    try {return await build(maximum);} catch(error) {if(error.code!=='EVIDENCE_LIMIT')throw error;}
    // Find a prefix that fits the actual escaped RPC envelope. Never pair later state with earlier evidence.
    let low=head.sequence+1,high=maximum-1,best=null;
    while(low<=high) {
        const middle=Math.floor((low+high)/2);
        try {best=await build(middle);low=middle+1;} catch(error) {if(error.code!=='EVIDENCE_LIMIT')throw error;high=middle-1;}
    }
    if(!best)fail('EVIDENCE_LIMIT','checkpoint');
    return best;
}
export function acceptedHead(response) {
    integer(response?.revision);integer(response?.acceptedThroughSequence,0,LIMITS.events);integer(response?.acceptedEvidenceBytes,0,LIMITS.evidence);
    unhex(response?.acceptedPrefixHash);unhex(response?.acceptedStateHash);
    return {revision:response.revision,sequence:response.acceptedThroughSequence,hash:response.acceptedPrefixHash,stateHash:response.acceptedStateHash,evidenceBytes:response.acceptedEvidenceBytes};
}
export class LearningSync {
    constructor({store,repository,activeOwner,newId=()=>crypto.randomUUID(),requestLimit=65536,now=()=>Date.now()}) {this.now=now;this.store=store;this.repository=repository;this.activeOwner=activeOwner;this.newId=newId;this.running=null;this.requestLimit=requestLimit;}
    drain(owner) {
        if(this.running) {
            if(this.runningOwner===owner)return this.running;
            return this.running.catch(()=>{}).then(()=>this.drain(owner));
        }
        this.runningOwner=owner;
        const work=this.run(owner);this.running=work.finally(()=>{this.running=null;this.runningOwner=null;});return this.running;
    }
    check(owner){if(this.activeOwner()!==owner)fail('OWNER_CHANGED');}
    async reconcileConflict(owner,operation,attempt) {
        if(!this.repository.read || !this.store.reconcile)fail('ATTEMPT_CONFLICT');
        const remote=await this.repository.read({attemptId:attempt.id},owner);this.check(owner);
        if(remote?.status!=='ok')fail('ATTEMPT_CONFLICT');
        const head=acceptedHead(remote);
        if(head.sequence>attempt.events.length || head.hash!==(head.sequence?attempt.eventHashes[head.sequence-1]:await initialHash(attempt.id,attempt.task.id)))fail('ATTEMPT_CONFLICT');
        const stateHash=await sha256(bytes(recoveryAt(attempt,head.sequence)));
        if(head.stateHash!==stateHash && !(head.sequence===0 && head.stateHash===await sha256(bytes(null))))fail('ATTEMPT_CONFLICT');
        const evidenceBytes=attempt.events.slice(0,head.sequence).reduce((sum,event)=>sum+frame(event).length,0);
        if(head.evidenceBytes!==evidenceBytes)fail('ATTEMPT_CONFLICT');
        if(remote.result?.full_task_finished_at) {
            if(!remote.confirmedResult)fail('RESULT_RECOVERY_REQUIRED');
            await this.store.reconcile(owner,operation.id,head,null,{confirmed:true,status:'confirmed',result:{...remote.confirmedResult,rewards:{coins:0,xp:0}}});return;
        }
        const continuation=operation.kind==='checkpoint' && operation.throughSequence>head.sequence?{...operation,id:this.newId(),request:undefined,retryAt:0}:null;
        if(continuation)delete continuation.request;
        await this.store.reconcile(owner,operation.id,head,continuation);
    }
    async run(owner) {
        this.check(owner);
        for(;;) {
            await this.store.coalesceCheckpoints?.(owner);
            const pending=(await this.store.list('learningOutbox',owner)).filter(row=>row.status==='pending').sort((a,b)=>a.localRevision-b.localRevision || (a.id<b.id?-1:1));
            const first=new Map();for(const row of pending)if(!first.has(row.attemptId))first.set(row.attemptId,row);
            const allOperations=await this.store.list('learningOutbox',owner);
            let operation=null;
            for(const candidate of first.values()){
                if((candidate.retryAt || 0)>this.now())continue;
                const local=await this.store.get('learningAttempts',owner,candidate.attemptId);
                if(!local)fail('MISSING_ATTEMPT');
                const dependencies=[];
                if(candidate.kind!=='claim' && local.predecessorAttemptId){
                    const predecessor=await this.store.get('learningAttempts',owner,local.predecessorAttemptId);
                    if(predecessor?.status==='submitted' && !predecessor.confirmed)dependencies.push(...allOperations.filter(row=>row.attemptId===predecessor.id && ['pending','held'].includes(row.status)));
                }
                if(candidate.kind==='claim' && local.predecessorAttemptId){const predecessor=await this.store.get('learningAttempts',owner,local.predecessorAttemptId);if(predecessor && !predecessor.serverHead)dependencies.push(...allOperations.filter(row=>row.attemptId===predecessor.id && row.kind==='claim' && ['pending','held'].includes(row.status)));}
                const writingId=candidate.kind==='writing'?candidate.payload.expectedWritingRevisionId:candidate.state?.writingRevisionId;
                if(writingId)dependencies.push(...allOperations.filter(row=>row.kind==='writing' && row.payload?.writingRevisionId===writingId && ['pending','held'].includes(row.status)));
                if(dependencies.some(row=>row.status==='held')){this.currentOperationId=candidate.id;fail('WRITING_DEPENDENCY_HELD');}
                if(dependencies.length)continue;
                operation=candidate;break;
            }
            if(!operation){this.currentOperationId=null;return;}
            this.currentOperationId=operation.id;
            this.check(owner);const attempt=await this.store.get('learningAttempts',owner,operation.attemptId);if(!attempt)fail('MISSING_ATTEMPT');
            let request=operation.request;
            if(!request) {
                if(operation.kind==='writing') request=rpcArguments(operation.id,operation.payload,LIMITS.request,owner);
                else if(operation.kind==='claim') request=rpcArguments(operation.id,{contractVersion:CONTRACT_VERSION,preparationId:attempt.preparationId,attemptId:attempt.id,kind:attempt.kind,seed:attempt.seed,scheduleDigest:await sha256(bytes(attempt.schedule)),startContext:attempt.startContext,predecessorAttemptId:attempt.predecessorAttemptId},LIMITS.request,owner);
                else if(operation.kind==='checkpoint') {
                    if(!attempt.serverHead)fail('CLAIM_REQUIRED');
                    // Each persisted intent is a small local checkpoint. Preserve its exact prefix/state pairing.
                    request=await buildCheckpoint({attempt,head:attempt.serverHead,intent:operation,operationId:operation.id,requestLimit:this.requestLimit});
                } else if(operation.kind==='submit') {
                    const head=attempt.serverHead;
                    if(!head || head.sequence!==operation.throughSequence)fail('EVIDENCE_GAP');
                    request=rpcArguments(operation.id,{contractVersion:CONTRACT_VERSION,attemptId:attempt.id,expectedRevision:head.revision,terminalSequence:head.sequence,terminalHash:head.hash,stateHash:head.stateHash,writingRevisionId:operation.state.writingRevisionId,
                        finishDeclaration:operation.finishDeclaration},LIMITS.terminal,owner);
                } else fail('UNKNOWN_OPERATION');
                try {await this.store.saveRequest(owner,operation.id,request);}catch(error){if(error.code==='OPERATION_SUPERSEDED')continue;throw error;}
            }
            this.check(owner);
            let response;
            try {response=await this.repository.mutate(operation.kind,request,owner);}catch(error) {
                if(operation.kind==='checkpoint' && /^(ATTEMPT_CONFLICT|HEAD_CONFLICT)$/.test(error.message || error.code || '')) {await this.reconcileConflict(owner,operation,attempt);continue;}
                error.learningOperationId=operation.id;throw error;
            }
            this.check(owner);
            if(operation.kind==='claim' && response?.existingClaim && response.revision>0) {await this.reconcileConflict(owner,operation,attempt);continue;}
            if(operation.kind==='writing') {
                const sent=JSON.parse(request.p_payload);
                if(response?.status!=='saved' || response.writingRevisionId!==sent.writingRevisionId || canonical(response.responses)!==canonical(sent.responses))fail('INVALID_RECEIPT');
                await this.store.acknowledge(owner,operation.id,response,{});continue;
            }
            const head=acceptedHead(response),sent=JSON.parse(request.p_payload);
            const expectedSequence=operation.kind==='claim'?0:operation.kind==='checkpoint'?sent.throughSequence:sent.terminalSequence;
            const expectedHash=operation.kind==='claim'?await initialHash(attempt.id,attempt.task.id):operation.kind==='checkpoint'?sent.throughHash:sent.terminalHash;
            const expectedRevision=operation.kind==='claim'?0:sent.expectedRevision+1;
            if(head.sequence!==expectedSequence || head.hash!==expectedHash || (head.revision!==expectedRevision && !(operation.kind==='submit' && response.alreadyConfirmed && head.revision===sent.expectedRevision)))fail('INVALID_RECEIPT');
            if(operation.kind==='checkpoint' && head.stateHash!==await sha256(bytes(sent.recoverableState)))fail('INVALID_RECEIPT');
            if(!['accepted','confirmed'].includes(response.status) || (operation.kind==='submit' && response.status!=='confirmed'))fail('INVALID_RECEIPT');
            const patch={serverHead:head};
            if(operation.kind==='submit' && response.status==='confirmed') {patch.confirmed=true;patch.status='confirmed';patch.result=response.result;}
            const continuation=operation.kind==='checkpoint' && response.acceptedThroughSequence<operation.throughSequence
                ? {...operation,id:this.newId(),request:undefined} : null;
            if(continuation)delete continuation.request;
            await this.store.acknowledge(owner,operation.id,response,patch,continuation);
        }
    }
}
