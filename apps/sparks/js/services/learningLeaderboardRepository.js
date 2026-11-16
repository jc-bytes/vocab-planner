import {supabaseService} from '../supabaseService.js';
import {fail} from '../learningResults/contract.js';
export const learningLeaderboardRepository={
    async read({taskId,cursor=null,boardRevision=null,orderingDigest=null,signal},owner){
        await supabaseService.init();const client=supabaseService.getClient();const {data:auth,error:authError}=await client.auth.getUser();if(authError)throw authError;if(auth.user?.id!==owner)fail('OWNER_CHANGED');
        let query=client.rpc('get_learning_leaderboard_owned_v1',{p_expected_user_id:owner,p_payload:JSON.stringify({taskId,cursor,boardRevision,orderingDigest})});if(signal)query=query.abortSignal(signal);
        const {data,error}=await query;if(error)throw error;const {data:current}=await client.auth.getUser();if(current.user?.id!==owner)fail('OWNER_CHANGED');return data;
    }
};
