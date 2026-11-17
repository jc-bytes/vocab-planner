import {supabaseService} from '../supabaseService.js';
import {rpcArguments,fail,byteLength,LIMITS} from '../learningResults/contract.js';
const MUTATIONS=Object.freeze({prepare:'prepare_student_learning_task_owned_v1',claim:'claim_student_learning_attempt_owned_v1',checkpoint:'save_student_learning_checkpoint_owned_v1',submit:'submit_student_learning_result_owned_v1',writing:'save_student_learning_writing_owned_v1',settings:'save_teacher_learning_settings_owned_v1',target:'save_teacher_learning_target_owned_v1'});
export function createLearningResultsRepository({service=supabaseService}={}) {
    async function clientFor(owner){await service.init();const client=service.getClient();const {data,error}=await client.auth.getUser();if(error)throw error;if(!owner||data.user?.id!==owner)fail('OWNER_CHANGED');return client;}
    return {
        async mutate(kind,args,owner,{signal}={}){const name=MUTATIONS[kind];if(!name)fail('UNKNOWN_OPERATION');if(args.p_expected_user_id && args.p_expected_user_id!==owner)fail('OWNER_CHANGED');
            const client=await clientFor(owner),bound={...args,p_expected_user_id:owner};if(byteLength(bound)>LIMITS.request)fail('EVIDENCE_LIMIT');
            let request=client.rpc(name,bound);if(signal)request=request.abortSignal(signal);const {data,error}=await request;if(error)throw error;await clientFor(owner);return data;},
        async operation(kind,payload,owner,options={}){return this.mutate(kind,rpcArguments(options.operationId||crypto.randomUUID(),payload,LIMITS.request,owner),owner,options);},
        async read(payload,owner,{signal,teacher=false}={}){const client=await clientFor(owner);let request=client.rpc(teacher?'get_teacher_learning_results_owned_v1':'get_student_learning_result_owned_v1',{p_expected_user_id:owner,p_payload:JSON.stringify(payload)});if(signal)request=request.abortSignal(signal);const {data,error}=await request;if(error)throw error;await clientFor(owner);return data;}
    };
}
export const learningResultsRepository=createLearningResultsRepository();
