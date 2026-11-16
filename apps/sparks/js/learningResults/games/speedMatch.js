import {node,button} from './ui.js';
import {shuffle,random32} from '../task.js';
export function speedMatchGame({root,word,opportunity,runtime}) {
    let stopped=false,deadline=null;const attempt=runtime.session.attempt;
    const candidates=shuffle([word,...shuffle(attempt.task.words.filter(w=>w.id!==word.id),random32(attempt.seed)).slice(0,4)],random32(((attempt.seed+opportunity.appearance+attempt.schedule.indexOf(opportunity))>>>0)||1));
    root.append(node('h3',word.definition),node('p','Select the matching falling word. Every scheduled appearance includes the correct word.'));
    const field=node('div',undefined,'learning-falling-field');field.setAttribute('aria-label','Falling words');root.append(field);
    const choose=id=>{if(stopped || runtime.busy)return;stopped=true;clearTimeout(deadline);runtime.answer(opportunity,{selectedWordId:id,missed:id===null});};
    candidates.forEach((candidate,index)=>{const control=button(candidate.word,()=>choose(candidate.id),'btn secondary-btn learning-falling-word');control.style.setProperty('--lane',String(index));control.style.setProperty('--lanes',String(candidates.length));field.append(control);});
    // All choices become usable together. Wait for explicit resume after hiding the page.
    deadline=setTimeout(()=>{if(!document.hidden)choose(null);},8000);
    return ()=>{stopped=true;clearTimeout(deadline);};
}
