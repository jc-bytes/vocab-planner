import { ImageDB } from '../db.js';
import { getActiveStudentStorageOwner } from '../student/persistence/studentStorage.js';
import { canonical, fail, byteLength, LIMITS } from './contract.js';
export class LearningStore {
    constructor({ database = new ImageDB(), activeOwner = getActiveStudentStorageOwner } = {}) { this.database=database; this.activeOwner=activeOwner; }
    assertOwner(owner) { if (!owner || owner !== this.activeOwner()) fail('OWNER_CHANGED'); }
    async get(store, owner, id) { this.assertOwner(owner); const db=await this.database.open(); const result=await db.get(store,[owner,id]); this.assertOwner(owner); return result; }
    async list(store, owner) { this.assertOwner(owner); const db=await this.database.open(); const rows=await db.getAllFromIndex(store,'owner',owner); this.assertOwner(owner); return rows; }
    async savePackage(pkg) { this.assertOwner(pkg.ownerUserId); const db=await this.database.open(); await db.put('learningPackages',pkg); this.assertOwner(pkg.ownerUserId); }
    async commit(attempt, intents = [], expectedRevision = null) {
        this.assertOwner(attempt.ownerUserId); const db=await this.database.open(); this.assertOwner(attempt.ownerUserId);
        const tx=db.transaction(['learningAttempts','learningOutbox'],'readwrite');
        try {
            const store=tx.objectStore('learningAttempts'), current=await store.get([attempt.ownerUserId,attempt.id]); this.assertOwner(attempt.ownerUserId);
            if ((current?.localRevision ?? null) !== expectedRevision) fail('LOCAL_ATTEMPT_CONFLICT');
            if (current?.confirmed && canonical(current)!==canonical(attempt)) fail('ATTEMPT_FINISHED');
            await store.put({...attempt, ...(current?.serverHead ? {serverHead:current.serverHead} : {}),...(current?.syncStatus==='held'?{syncStatus:'held',syncError:current.syncError}:{})});
            for (const intent of intents) {
                if (intent.ownerUserId!==attempt.ownerUserId || intent.attemptId!==attempt.id) fail('OWNER_CHANGED');
                await tx.objectStore('learningOutbox').add({...intent,...(current?.syncStatus==='held'?{status:'held',lastError:current.syncError}:{})});
            }
            this.assertOwner(attempt.ownerUserId); await tx.done;
        } catch(error) { try { tx.abort(); } catch {} await tx.done.catch(()=>{}); throw error; }
    }
    async coalesceCheckpoints(owner) {
        this.assertOwner(owner);const db=await this.database.open(),tx=db.transaction('learningOutbox','readwrite');
        try {
            const pending=(await tx.store.index('owner').getAll(owner)).filter(row=>row.status==='pending')
                .sort((a,b)=>a.attemptId.localeCompare(b.attemptId)||a.localRevision-b.localRevision);
            let group=[];
            const flush=async()=>{
                if(group.length>1)for(const row of group.slice(0,-1))await tx.store.put({...row,status:'superseded',supersededBy:group.at(-1).id});
                group=[];
            };
            for(const row of pending) {
                if(row.kind!=='checkpoint' || row.request) {await flush();continue;}
                if(group.length && group[0].attemptId!==row.attemptId)await flush();
                group.push(row);
            }
            await flush();this.assertOwner(owner);await tx.done;
        }catch(error){try{tx.abort();}catch{}await tx.done.catch(()=>{});throw error;}
    }
    async saveRequest(owner, id, request) {
        this.assertOwner(owner); const db=await this.database.open(), tx=db.transaction('learningOutbox','readwrite');
        try {
            const row=await tx.store.get([owner,id]); this.assertOwner(owner); if(!row) fail('MISSING_OPERATION');
            if(row.status==='superseded')fail('OPERATION_SUPERSEDED');
            if(row.request && canonical(row.request)!==canonical(request)) fail('OPERATION_CONFLICT');
            if(byteLength(request)>LIMITS.request) fail('EVIDENCE_LIMIT');
            await tx.store.put({...row,request}); await tx.done; return {...row,request};
        } catch(error) { try { tx.abort(); } catch {} await tx.done.catch(()=>{}); throw error; }
    }
    async reconcile(owner,id,head,continuation=null,patch={}) {
        this.assertOwner(owner);const db=await this.database.open(),tx=db.transaction(['learningAttempts','learningOutbox'],'readwrite');
        try {
            const operation=await tx.objectStore('learningOutbox').get([owner,id]);
            if(!operation || operation.status!=='pending')fail('OPERATION_CONFLICT');
            const attempt=await tx.objectStore('learningAttempts').get([owner,operation.attemptId]);
            if(!attempt || (attempt.serverHead?.revision || 0)>head.revision)fail('ATTEMPT_CONFLICT');
            await tx.objectStore('learningAttempts').put({...attempt,serverHead:head,...patch});
            await tx.objectStore('learningOutbox').put({...operation,status:'superseded',reason:'accepted_prefix',reconciledHead:head});
            if(patch.confirmed)for(const row of await tx.objectStore('learningOutbox').index('owner').getAll(owner))if(row.attemptId===attempt.id && row.status==='pending')await tx.objectStore('learningOutbox').put({...row,status:'superseded',reason:'confirmed_elsewhere'});
            if(continuation)await tx.objectStore('learningOutbox').add(continuation);
            this.assertOwner(owner);await tx.done;
        }catch(error){try{tx.abort();}catch{}await tx.done.catch(()=>{});throw error;}
    }
    async markFailure(owner,id,{code,retryAt=0,hold=false}) {
        this.assertOwner(owner);const db=await this.database.open(),tx=db.transaction(['learningAttempts','learningOutbox'],'readwrite');
        try {
            const operation=await tx.objectStore('learningOutbox').get([owner,id]);if(!operation)fail('MISSING_OPERATION');
            if(operation.status!=='pending'){await tx.done;return;}
            const attempt=await tx.objectStore('learningAttempts').get([owner,operation.attemptId]);
            await tx.objectStore('learningOutbox').put({...operation,attempts:(operation.attempts||0)+1,lastError:code,retryAt,status:hold?'held':'pending'});
            if(hold) {
                await tx.objectStore('learningAttempts').put({...attempt,syncStatus:'held',syncError:code});
                for(const row of await tx.objectStore('learningOutbox').index('owner').getAll(owner))if(row.attemptId===attempt.id && row.status==='pending')await tx.objectStore('learningOutbox').put({...row,status:'held',lastError:code});
            }
            this.assertOwner(owner);await tx.done;
        }catch(error){try{tx.abort();}catch{}await tx.done.catch(()=>{});throw error;}
    }
    async acknowledge(owner, id, response, patch, continuation=null) {
        this.assertOwner(owner); const db=await this.database.open(), tx=db.transaction(['learningAttempts','learningOutbox'],'readwrite');
        try {
            const operation=await tx.objectStore('learningOutbox').get([owner,id]); if(!operation) fail('MISSING_OPERATION');
            if(operation.status==='accepted') {
                if(canonical(operation.response)!==canonical(response))fail('OPERATION_CONFLICT');
                await tx.done;return;
            }
            const attempt=await tx.objectStore('learningAttempts').get([owner,operation.attemptId]); this.assertOwner(owner);
            // Patch only the acknowledged server head. Never replace newer unsent local answers.
            const next={...attempt,...patch};
            if(attempt.serverHead && patch.serverHead && attempt.serverHead.revision>patch.serverHead.revision) next.serverHead=attempt.serverHead;
            await tx.objectStore('learningAttempts').put(next);
            await tx.objectStore('learningOutbox').put({...operation,status:'accepted',response});
            if(continuation) {
                if(continuation.ownerUserId!==owner || continuation.attemptId!==attempt.id)fail('OWNER_CHANGED');
                await tx.objectStore('learningOutbox').add(continuation);
            }
            this.assertOwner(owner);await tx.done;
        } catch(error) { try {tx.abort();} catch {} await tx.done.catch(()=>{}); throw error; }
    }
}
