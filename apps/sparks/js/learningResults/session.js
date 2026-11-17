import { initialHash, extendHash, frame, fail, integer, LIMITS, canonical, byteLength } from './contract.js';
import { ScoredTimer } from './scoredTimer.js';
import { deriveOutcome, validateCorrection } from './adapters.js';
import { calculateResult, comboSummary, fraction } from './scoring.js';
import { makeSchedule, validateTask, chooseVariant } from './task.js';
import { recoverableState } from './sync.js';
const copy = value => structuredClone(value);
export class LearningSession {
    constructor({ attempt, store, owner, now, newId = () => crypto.randomUUID() }) {
        this.attempt=copy(attempt); this.store=store; this.owner=owner; this.newId=newId; this.tail=Promise.resolve();
        this.timer=new ScoredTimer({now,recordedMilliseconds:attempt.state.recordedMilliseconds});
    }
    static async create({ task, preparationId, ownerUserId, seed, kind='ranked_full', passingTarget=80, startContext=null, predecessorAttemptId=null, writingSnapshot=null, store, owner, now, newId=()=>crypto.randomUUID() }) {
        validateTask(task); integer(passingTarget,1,100);if(!['ranked_full','practice'].includes(kind))fail('INVALID_ATTEMPT_KIND'); const id=newId(), prefixHash=await initialHash(id,task.id);
        const variantId=['crossword','word-search'].includes(task.activity) ? (await chooseVariant(task,id)).variantId : null;
        const attempt={id,variantId,attemptId:id,ownerUserId,task,preparationId,passingTarget,kind,startContext,predecessorAttemptId,writingSnapshot:copy(writingSnapshot),
            schedule:makeSchedule(task,seed),seed,createdAt:Date.now(),updatedAt:Date.now(),localRevision:0,events:[],eventHashes:[],evidenceBytes:0,prefixHash,status:'pending',serverHead:null,
            state:{phase:'paused',crosswordPhase:'original',recordedMilliseconds:0,originals:{},assisted:[],corrections:{},draft:{},writingRevisionId:null}};
        const claim={id:newId(),ownerUserId,attemptId:id,kind:'claim',status:'pending',localRevision:0};
        await store.commit(attempt,[claim]); return new LearningSession({attempt,store,owner,now,newId});
    }
    assertOwner() { if(this.owner()!==this.attempt.ownerUserId) fail('OWNER_CHANGED'); }
    enqueue(operation) {
        const pending=this.tail.then(operation); this.tail=pending.catch(()=>{}); return pending;
    }
    mutate(type, operation, phase, terminal=false) {
        return this.enqueue(async()=>{
            this.assertOwner();
            if(this.attempt.confirmed || this.attempt.status==='submitted') fail('ATTEMPT_FINISHED');
            const prior=this.attempt, next=copy(prior), recorded=this.timer.pause();
            try {
                next.state.recordedMilliseconds=recorded;
                const payload=operation(next);
                const event={attemptId:next.id,eventId:this.newId(),sequence:next.events.length+1,type,recordedMilliseconds:recorded,...payload};
                const framed=frame(event);
                if(next.events.length>=LIMITS.events || next.evidenceBytes+framed.length>LIMITS.evidence) fail('EVIDENCE_LIMIT');
                next.events.push(event); next.prefixHash=await extendHash(prior.prefixHash,[event]);
                next.eventHashes.push(next.prefixHash); next.evidenceBytes+=framed.length;
                next.localRevision++;next.updatedAt=Date.now(); next.state.phase=(typeof phase==='function' ? phase(next) : phase) || next.state.phase;
                const state=recoverableState(next,next.state,next.events.length);
                const intents=[{id:this.newId(),ownerUserId:next.ownerUserId,attemptId:next.id,kind:'checkpoint',status:'pending',localRevision:next.localRevision,throughSequence:next.events.length,state}];
                if(terminal) {
                    next.status='submitted';
                    intents.push({id:this.newId(),ownerUserId:next.ownerUserId,attemptId:next.id,kind:'submit',status:'pending',localRevision:next.localRevision+1,
                        throughSequence:next.events.length,finishDeclaration:{originalSetSubmitted:true,requiredReviewSubmitted:finished(next)},state});
                }
                await this.store.commit(next,intents,prior.localRevision);
                this.assertOwner(); this.attempt=next;
                if(next.state.phase==='answer') this.timer.resume();
                return copy(payload);
            } catch(error) {
                // Failed validation must not silently stop an otherwise usable answer clock.
                this.timer.restore(recorded);
                if(prior.state.phase==='answer' && this.owner()===prior.ownerUserId) this.timer.resume();
                throw error;
            }
        });
    }
    resume() { return this.mutate('resume',next=>{assertCanAdvance(next);if(next.task.activity!=='reading-check' && next.schedule.every(o=>Object.hasOwn(next.state.originals,o.id)))fail('ORIGINAL_SET_LOCKED');return {};},'answer'); }
    pause() { return this.mutate('pause',()=>({}),'paused'); }
    checkpoint() { return this.mutate('timer',()=>({})); }
    setPhase(phase) {
        if(!['study','help','feedback','paused','reading','writing'].includes(phase)) fail('INVALID_PHASE');
        return this.mutate('phase',()=>({phase}),phase);
    }
    draft(value) { return this.mutate('draft',next=>{next.state.draft=copy(value);return {draft:value};}); }
    assist(opportunityIds) { return this.mutate('assist',next=>{
        for(const id of opportunityIds) {
            if(!next.schedule.some(o=>o.id===id)) fail('INVALID_OPPORTUNITY');
            if(!next.state.originals[id] && !next.state.assisted.includes(id)) next.state.assisted.push(id);
        } return {opportunityIds};
    },'help'); }
    original(opportunityId,response) { return this.mutate('original',next=>{
        if(next.task.activity==='reading-check') fail('READING_SUBMISSION_REQUIRED');
        const opportunity=next.schedule.find(o=>o.id===opportunityId); if(!opportunity) fail('INVALID_OPPORTUNITY');
        if(next.state.originals[opportunityId]) fail('ORIGINAL_LOCKED');
        if(next.state.phase!=='answer') fail('ANSWER_NOT_USABLE');
        assertCanAdvance(next);
        if(next.task.activity==='word-search' && response?.variantId!==next.variantId)fail('VARIANT_MISMATCH');
        const outcome=deriveOutcome(next.task,opportunity,response,next.state.assisted.includes(opportunityId));
        next.state.originals[opportunityId]={...outcome,credit:{n:String(outcome.credit.n),d:String(outcome.credit.d)}};
        if(Object.keys(next.state.originals).length===next.schedule.length) next.state.crosswordPhase='correction';
        return {opportunityId,response,assisted:outcome.assisted};
    },next=>['crossword','word-search'].includes(next.task.activity) && Object.keys(next.state.originals).length<next.schedule.length ? 'answer' : 'feedback'); }
    submitPuzzle(responses) {
        return this.enqueue(async()=>{
            this.assertOwner();const prior=this.attempt;
            if(prior.task.activity!=='crossword' || prior.state.phase!=='answer' || prior.status==='submitted' || prior.confirmed)fail('ANSWER_NOT_USABLE');
            if(!responses || Object.keys(responses).length!==prior.schedule.length || Object.keys(prior.state.originals).length)fail('INVALID_PUZZLE_SUBMISSION');
            const recorded=this.timer.pause(),next=copy(prior);
            try {
                for(const opportunity of next.schedule){
                    const response=responses[opportunity.id],outcome=deriveOutcome(next.task,opportunity,response,next.state.assisted.includes(opportunity.id));
                    next.state.originals[opportunity.id]={...outcome,credit:{n:String(outcome.credit.n),d:String(outcome.credit.d)}};
                    const event={attemptId:next.id,eventId:this.newId(),sequence:next.events.length+1,type:'original',recordedMilliseconds:recorded,opportunityId:opportunity.id,response,assisted:outcome.assisted};
                    next.evidenceBytes+=frame(event).length;if(next.events.length>=LIMITS.events || next.evidenceBytes>LIMITS.evidence)fail('EVIDENCE_LIMIT');
                    next.events.push(event);next.prefixHash=await extendHash(next.prefixHash,[event]);next.eventHashes.push(next.prefixHash);
                }
                next.state.recordedMilliseconds=recorded;next.state.phase='feedback';next.state.crosswordPhase='correction';next.localRevision++;next.updatedAt=Date.now();
                await this.store.commit(next,[{id:this.newId(),ownerUserId:next.ownerUserId,attemptId:next.id,kind:'checkpoint',status:'pending',localRevision:next.localRevision,throughSequence:next.events.length,state:recoverableState(next,next.state,next.events.length)}],prior.localRevision);
                this.assertOwner();this.attempt=next;
            }catch(error){this.timer.restore(recorded);if(this.owner()===prior.ownerUserId)this.timer.resume();throw error;}
        });
    }
    correct(opportunityId,answer) { return this.mutate('correction',next=>{
        if(next.task.activity==='crossword' && next.state.crosswordPhase!=='correction') fail('CORRECTION_NOT_READY');
        if(!next.state.originals[opportunityId]) fail('ORIGINAL_NOT_LOCKED');
        const opportunity=next.schedule.find(o=>o.id===opportunityId);
        if(!validateCorrection(next.task,opportunity,answer)) fail('CORRECTION_INCORRECT');
        next.state.corrections[opportunityId]=answer; return {opportunityId,answer};
    },'correction'); }
    outcomes() { return Object.values(this.attempt.state.originals).map(o=>({...o,credit:fraction(o.credit.n,o.credit.d)})); }
    combo() { return comboSummary(this.outcomes()); }
    isFinished() { return finished(this.attempt); }
    preview() {
        const scoredSetComplete=this.attempt.schedule.every(o=>Object.hasOwn(this.attempt.state.originals,o.id));
        return {...calculateResult({outcomes:this.outcomes(),scheduled:this.attempt.schedule,
            recordedMilliseconds:this.attempt.state.recordedMilliseconds,
            sharedTargetMilliseconds:this.attempt.task.sharedTargetMilliseconds,
            passingTarget:this.attempt.passingTarget,finished:scoredSetComplete}),finished:this.isFinished()};
    }
    stageWriting(responses) {
        return this.enqueue(async()=>{
            this.assertOwner();
            if(this.attempt.task.activity!=='reading-check')fail('INVALID_ACTIVITY');
            if(this.attempt.confirmed || this.attempt.status==='submitted')fail('ATTEMPT_FINISHED');
            const questions=this.attempt.task.writingQuestions || [],normalized={};
            if(!responses || Array.isArray(responses) || Object.keys(responses).length!==questions.length)fail('WRITING_INCOMPLETE');
            for(const question of questions) {
                const answer=responses[question.id];
                if(typeof answer!=='string' || [...answer.trim()].length<12 || [...answer.trim()].length>3000)fail('WRITING_INCOMPLETE');
                normalized[question.id]=answer.trim();
            }
            if(byteLength(normalized)>10000)fail('EVIDENCE_LIMIT','writing');
            const prior=this.attempt,previous=prior.writingSnapshot;
            if(previous?.writingRevisionId && canonical(previous.responses)===canonical(normalized))return previous.writingRevisionId;
            const revisionId=this.newId(),next=copy(prior);next.localRevision++;next.updatedAt=Date.now();
            const payload={contractVersion:'learning-results-v1',preparationId:next.preparationId,writingRevisionId:revisionId,
                expectedWritingRevisionId:previous?.writingRevisionId || null,expectedLegacyRevision:previous?.legacyRevision || 0,responses:normalized};
            next.writingSnapshot={writingRevisionId:revisionId,responses:normalized,legacyRevision:(previous?.legacyRevision || 0)+1};
            await this.store.commit(next,[{id:this.newId(),ownerUserId:next.ownerUserId,attemptId:next.id,kind:'writing',status:'pending',localRevision:next.localRevision,payload}],prior.localRevision);
            this.assertOwner();this.attempt=next;return revisionId;
        });
    }
    async submit(writingRevisionId=null) {
        await this.mutate('submission',next=>{
            if(next.task.activity==='reading-check') fail('READING_SUBMISSION_REQUIRED');
            if(!finished(next)) fail('REVIEW_REQUIRED');
            next.state.writingRevisionId=writingRevisionId;
            return {writingRevisionId};
        },'paused',true);
        return {status:'waiting_to_sync',preview:this.preview()};
    }
    async submitReading({responses,writingRevisionId=null}) {
        await this.mutate('reading-submission',next=>{
            if(next.task.activity!=='reading-check') fail('INVALID_ACTIVITY');
            if(!responses || Object.keys(responses).length!==next.schedule.length) fail('INCOMPLETE_READING_CHECK');
            const originals={};
            // Derive all choices in schedule order. No individual score or combo is exposed before this commit.
            for(const opportunity of next.schedule) {
                const response=responses[opportunity.id];
                if(!response) fail('INCOMPLETE_READING_CHECK');
                if(next.task.activity==='word-search' && response?.variantId!==next.variantId)fail('VARIANT_MISMATCH');
        const outcome=deriveOutcome(next.task,opportunity,response,next.state.assisted.includes(opportunity.id));
                originals[opportunity.id]={...outcome,credit:{n:String(outcome.credit.n),d:String(outcome.credit.d)}};
            }
            next.state.originals=originals;
            if(writingRevisionId && next.writingSnapshot)next.writingSnapshot={...next.writingSnapshot,legacyRevision:(next.writingSnapshot.legacyRevision || 0)+1};
            next.state.writingRevisionId=writingRevisionId;
            return {responses,writingRevisionId};
        },'paused',true);
        return {status:'waiting_to_sync',preview:this.preview(),combo:this.combo()};
    }
}
function assertCanAdvance(attempt) {
    if(!['fill-in-blank','speed-match'].includes(attempt.task.activity)) return;
    if(Object.entries(attempt.state.originals).some(([id,outcome])=>!outcome.correct && !Object.hasOwn(attempt.state.corrections,id))) fail('CORRECTION_REQUIRED');
}
function finished(attempt) {
    return attempt.schedule.every(o=>{
        const original=attempt.state.originals[o.id];
        return original && (attempt.task.activity==='reading-check' || original.correct || Object.hasOwn(attempt.state.corrections,o.id));
    });
}
