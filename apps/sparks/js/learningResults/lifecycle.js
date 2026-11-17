// The hidden document cannot expose an answer while its score clock is paused.
export function bindLearningVisibility({session,root,isCurrent=()=>true,onError=()=>{},onHide=()=>{},onResume=()=>{},document:doc=document,interval=5000}) {
    let destroyed=false,hidden=false,previousPhase='paused',pausing=Promise.resolve();
    const notice=doc.createElement('section'),message=doc.createElement('p'),resume=doc.createElement('button');
    notice.hidden=true;notice.className='learning-paused';message.textContent='Activity paused. Resume when you are ready to answer.';resume.textContent='Resume activity';resume.type='button';resume.className='btn primary-btn';notice.append(message,resume);root.before(notice);
    function hide(){if(destroyed || hidden || session.attempt.status==='submitted' || session.attempt.confirmed)return;previousPhase=session.attempt.state.phase;hidden=true;root.hidden=true;notice.hidden=false;session.timer.pause();onHide();pausing=session.pause().catch(onError);}
    const visibility=()=>{if(doc.hidden)hide();};doc.addEventListener('visibilitychange',visibility);
    const checkpoint=globalThis.setInterval(()=>{if(!isCurrent()){session.timer.pause();return;}if(!destroyed && !hidden && session.attempt.state.phase==='answer')void session.checkpoint().catch(onError);},interval);
    resume.addEventListener('click',async()=>{if(destroyed || resume.disabled || doc.hidden)return;resume.disabled=true;try{await pausing;if(destroyed)return;
        const allOriginals=session.attempt.schedule.every(o=>Object.hasOwn(session.attempt.state.originals,o.id));
        if(previousPhase==='answer' && !allOriginals)await session.resume();
        else if(['study','help','feedback','reading','writing'].includes(previousPhase))await session.setPhase(previousPhase);
        if(destroyed)return;hidden=false;notice.hidden=true;root.hidden=false;await onResume();root.querySelector('button,input,textarea,[tabindex="0"]')?.focus();
    }catch(error){onError(error);}finally{resume.disabled=false;}});
    if(doc.hidden)hide();
    return {pause:hide,async destroy(){if(destroyed)return;destroyed=true;globalThis.clearInterval(checkpoint);doc.removeEventListener('visibilitychange',visibility);session.timer.pause();if(!session.attempt.confirmed && session.attempt.status!=='submitted')await session.pause().catch(onError);notice.remove();}};
}
