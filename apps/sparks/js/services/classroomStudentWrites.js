// Only the two student answer mutations use this adapter. Teacher operations and
// reads retain their existing interface and authorization rules.
export async function ownedClassroomWrite(getClient, name, args, ownerUserId, signal) {
    const client = await getClient();
    signal.throwIfAborted();
    if (!ownerUserId) {
        const { data, error } = await client.auth.getUser();
        signal.throwIfAborted();
        if (error) throw error;
        ownerUserId = data?.user?.id;
        if (!ownerUserId) throw new DOMException('Sign in before saving your work.', 'AbortError');
    }
    const { data, error } = await client.rpc(name, { ...args, p_expected_user_id: ownerUserId }).abortSignal(signal);
    signal.throwIfAborted();
    if (error) throw error;
    return data;
}
