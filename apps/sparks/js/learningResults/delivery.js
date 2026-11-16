import {fail} from './contract.js';
export function learningFailure(error) {
    const message=String(error?.message || error?.code || '');
    if(error?.code==='OWNER_CHANGED' || message==='OWNER_CHANGED')return {code:'OWNER_CHANGED',ownerChanged:true};
    const code=/^[A-Z][A-Z0-9_]+$/.test(message)?message:String(error?.code || 'NETWORK_ERROR');
    const hold=error?.code==='42501' || /^(22|23)/.test(error?.code || '') || /^(ATTEMPT_|WRITING_|INVALID_|EVIDENCE_|STATE_|PREFIX_|ASSISTANCE_|ORIGINAL_|CORRECTION_|VARIANT_|SCHEDULE_|OPERATION_|RESULT_|READING_|SUBMISSION_|ANSWER_|SCHOOL_|ACTIVITY_|PREPARATION_|OWNER_)/.test(code);
    return {code,hold};
}
// Uses the existing owner/session scheduler. The learning outbox retains its own immutable requests.
export class LearningDelivery {
    constructor({sync,store,activeOwner,now=()=>Date.now(),random=Math.random}) {Object.assign(this,{sync,store,activeOwner,now,random});}
    register(queue) {return queue.registerDrain('learning-results',({ownerUserId})=>this.run(ownerUserId));}
    async run(owner) {
        if(!owner || owner!==this.activeOwner())fail('OWNER_CHANGED');
        for(let failures=0;failures<4;failures++) {
            try {await this.sync.drain(owner);break;}
            catch(error) {
                const failure=learningFailure(error);
                if(failure.ownerChanged || owner!==this.activeOwner())throw error;
                const id=error.learningOperationId || this.sync.currentOperationId;
                const operation=id?await this.store.get('learningOutbox',owner,id):null;
                if(!operation)throw error;
                const delay=Math.floor(Math.min(60000,1000*2**Math.min(operation.attempts || 0,6))*(0.8+0.4*this.random()));
                await this.store.markFailure(owner,id,{code:failure.code,hold:failure.hold,retryAt:failure.hold?0:this.now()+delay});
            }
        }
        const rows=await this.store.list('learningOutbox',owner),heads=new Map();
        for(const row of rows.filter(row=>row.status==='pending').sort((a,b)=>a.localRevision-b.localRevision || a.id.localeCompare(b.id)))if(!heads.has(row.attemptId))heads.set(row.attemptId,row);
        return {pending:heads.size,held:rows.filter(row=>row.status==='held').length,retryAt:heads.size?Math.min(...[...heads.values()].map(row=>Math.max(row.retryAt || 0,this.now()+1000))):null};
    }
}
