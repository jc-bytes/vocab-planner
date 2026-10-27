// Owns save ordering and outcomes. Browser/application state enters only through
// explicit capabilities; an acknowledged write is never reclassified by its UI.
export function createTeacherVocabularySaveCoordinator({ prepareSnapshot, captureContext, authorize,
    writeCloud, writeDraft, removeDraft, invalidateCatalog, markCloudSource, setStatus, notifyFailure,
    reportDiagnostic = (label, error) => console.warn(label, error),
    setTimer = (callback, delay) => globalThis.setTimeout(callback, delay),
    clearTimer = timer => globalThis.clearTimeout(timer) }) {
    // Document epochs own UI feedback. Durable draft identity survives reopening
    // that same vocabulary in another document epoch during an in-flight save.
    const freshState = () => ({ debounces: new Map(), latest: new Map(), durableLatest: new Map(), tail: null, statusTimer: null });
    let state = freshState(), sequence = 0;
    const diagnostic = (label, error) => { try { reportDiagnostic(label, error); } catch { /* Diagnostics cannot alter persistence. */ } };
    const current = ticket => {
        try { return ticket.state === state && ticket.context.isCurrent(); }
        catch (error) { diagnostic('Could not verify vocabulary save ownership', error); return false; }
    };
    const latest = ticket => current(ticket) && ticket.state.latest.get(ticket.context.documentKey) === ticket.sequence;
    const durableLatest = ticket => current(ticket) && ticket.state.durableLatest.get(ticket.snapshot.id) === ticket.sequence;
    const documentCurrent = ticket => current(ticket) && ticket.context.isDocumentCurrent();
    const uiCurrent = ticket => latest(ticket) && durableLatest(ticket) && documentCurrent(ticket) && ticket.context.isNavigationCurrent();
    function observe(label, effect) {
        try {
            const result = effect();
            if (result && typeof result.catch === 'function') void result.catch(error => diagnostic(label, error));
        } catch (error) { diagnostic(label, error); }
    }
    function clearStatus(ownedState = state) {
        clearTimer(ownedState.statusTimer); ownedState.statusTimer = null;
    }
    function cancelDocument(documentKey) {
        clearTimer(state.debounces.get(documentKey)); state.debounces.delete(documentKey); clearStatus();
    }
    function capture(vocab) {
        const snapshot = prepareSnapshot(vocab), context = captureContext();
        const ticket = Object.freeze({ snapshot, context, sequence: ++sequence, state });
        state.latest.set(context.documentKey, ticket.sequence);
        state.durableLatest.set(snapshot.id, ticket.sequence);
        return ticket;
    }
    function failureFeedback(ticket, errors) {
        if (!uiCurrent(ticket)) return;
        observe('Could not display vocabulary save failure', () => setStatus('Save failed', 'error'));
        if (uiCurrent(ticket)) observe('Could not display vocabulary failure notification', () => notifyFailure(errors));
    }
    function failedCloud(ticket, cloudError) {
        if (!current(ticket)) return { status: 'stale' };
        diagnostic('Failed to save vocabulary to backend', cloudError);
        let localError;
        if (durableLatest(ticket)) {
            try { writeDraft(ticket.snapshot); }
            catch (error) { localError = error; diagnostic('Could not keep the failed vocabulary save locally', error); }
        }
        failureFeedback(ticket, { cloudError, localError, localOnly: false });
        return { status: 'failed' };
    }
    async function execute(ticket) {
        if (!current(ticket) || !ticket.snapshot?.id || ticket.context.localMode || !authorize(false)) return { status: 'stale' };
        try { await writeCloud(ticket.snapshot, ticket.context); }
        catch (error) { return failedCloud(ticket, error); }
        // Transport is acknowledged here. Cleanup and observers cannot enter its
        // failure path, create fallback writes, or reject the user's save command.
        if (!current(ticket)) return { status: 'stale' };
        if (durableLatest(ticket)) {
            observe('Could not remove the acknowledged vocabulary draft', () => removeDraft(ticket.snapshot.id));
            if (durableLatest(ticket)) observe('Could not invalidate the vocabulary catalog', invalidateCatalog);
        }
        if (uiCurrent(ticket)) {
            observe('Could not mark the current vocabulary as saved', () => markCloudSource(ticket.snapshot.id));
            if (uiCurrent(ticket)) observe('Could not display vocabulary save success', () => setStatus('Saved to cloud', 'success'));
            if (uiCurrent(ticket)) {
                clearStatus(ticket.state);
                ticket.state.statusTimer = setTimer(() => {
                    if (!uiCurrent(ticket)) return;
                    ticket.state.statusTimer = null;
                    observe('Could not display vocabulary ready status', () => setStatus('Ready', 'info'));
                }, 1500);
            }
        }
        return { status: 'saved' };
    }
    function enqueue(ticket) {
        const ownedState = ticket.state;
        const operation = (ownedState.tail || Promise.resolve()).catch(() => {}).then(() => execute(ticket));
        ownedState.tail = operation;
        return operation.finally(() => { if (ownedState.tail === operation) ownedState.tail = null; });
    }
    return Object.freeze({
        schedule(vocab) {
            if (!vocab?.id) return;
            const ticket = capture(vocab);
            if (!latest(ticket)) return;
            let localError;
            if (ticket.context.localMode || ticket.snapshot.source !== 'cloud') {
                try { writeDraft(ticket.snapshot); }
                catch (error) { localError = error; diagnostic('Could not save the vocabulary draft locally', error); }
            }
            if (!latest(ticket)) return;
            if (ticket.context.localMode) {
                if (localError) failureFeedback(ticket, { localError, localOnly: true });
                else if (uiCurrent(ticket)) observe('Could not display local vocabulary save success', () => setStatus('Saved locally', 'success'));
                return;
            }
            if (!ticket.context.authenticated) {
                if (localError) failureFeedback(ticket, { localError, localOnly: true });
                return;
            }
            cancelDocument(ticket.context.documentKey);
            if (uiCurrent(ticket)) observe('Could not display vocabulary saving status', () => setStatus('Saving...', 'info'));
            if (!latest(ticket)) return;
            const timer = setTimer(() => {
                if (ticket.state.debounces.get(ticket.context.documentKey) !== timer) return;
                ticket.state.debounces.delete(ticket.context.documentKey);
                void enqueue(ticket).catch(error => diagnostic('Unexpected vocabulary autosave failure', error));
            }, 800);
            ticket.state.debounces.set(ticket.context.documentKey, timer);
        },
        async publish(prepareDocument, { onDocumentSaved, onUiSaved } = {}) {
            if (!authorize(true)) return;
            // Save as New changes the document identity during preparation.
            // Cancel the old document's pending debounce before that mutation.
            cancelDocument(captureContext().documentKey);
            const ticket = capture(prepareDocument());
            if (!current(ticket)) return { status: 'stale' };
            if (ticket.context.localMode) {
                try { writeDraft(ticket.snapshot); return { status: 'local' }; }
                catch (error) {
                    diagnostic('Could not publish vocabulary locally', error);
                    failureFeedback(ticket, { localError: error, localOnly: true });
                    return { status: 'failed' };
                }
            }
            const result = await enqueue(ticket);
            if (result.status === 'saved' && documentCurrent(ticket) && onDocumentSaved)
                observe('Could not finalize the saved vocabulary document', onDocumentSaved);
            if (result.status === 'saved' && uiCurrent(ticket) && onUiSaved)
                observe('Could not display published vocabulary feedback', () => onUiSaved({ isCurrent: () => current(ticket) }));
            return result;
        },
        reset() {
            const oldState = state; state = freshState();
            for (const timer of oldState.debounces.values()) clearTimer(timer);
            oldState.debounces.clear(); oldState.latest.clear(); oldState.durableLatest.clear(); clearStatus(oldState);
            // Already-dispatched transport may settle, but its state can neither
            // serialize a replacement actor nor publish into that actor's UI.
        }
    });
}
