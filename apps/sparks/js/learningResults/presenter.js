import {learningLeaderboardRepository} from '../services/learningLeaderboardRepository.js';
const element=(tag,text,className)=>{const node=document.createElement(tag);if(text!==undefined)node.textContent=String(text);if(className)node.className=className;return node;};
export function scoredTime(milliseconds) {
    const minutes=Math.floor(milliseconds/60000),seconds=Math.floor(milliseconds%60000/1000),fraction=milliseconds%1000;
    return `${minutes}:${String(seconds).padStart(2,'0')}.${String(fraction).padStart(3,'0')}`;
}
export function weightedPercent(weighted) {return Number(100n*BigInt(weighted.numerator)/BigInt(weighted.denominator));}
export function mountLearningBoard({root,taskId,owner,getOwner=()=>owner,repository=learningLeaderboardRepository}) {
    let generation=0,cursor=null,revision=null,digest=null,top=[],own=null,destroyed=false;
    const section=element('section'),heading=element('h3','Grade leaderboard'),status=element('p'),table=element('table'),body=element('tbody'),more=element('button','Show more tied students','btn secondary-btn'),refresh=element('button','Refresh rankings','btn secondary-btn');
    status.setAttribute('role','status');more.type=refresh.type='button';more.hidden=true;
    const caption=element('caption','Best fully finished score for each student. Equal scores share a rank.');table.append(caption);
    const header=element('thead'),row=element('tr');for(const text of ['Rank','Student','Points','Answer time']){const cell=element('th',text);cell.scope='col';row.append(cell);}header.append(row);table.append(header,body);
    section.append(heading,status,table,more,refresh);root.append(section);
    const current=id=>!destroyed && id===generation && owner===getOwner();
    function render(){body.replaceChildren();for(const entry of [...top,...(own && !top.some(entry=>entry.userId===own.userId)?[own]:[])]){
        const tr=element('tr');if(entry.userId===owner)tr.setAttribute('aria-label','Your result');
        for(const value of [entry.rank,`${entry.name || 'Student'}${entry.userId===owner?' (you)':''}`,entry.points,scoredTime(entry.recordedMilliseconds)])tr.append(element('td',value));body.append(tr);
    }table.hidden=!body.children.length;more.hidden=!cursor;}
    async function load(reset=false){const id=++generation;if(reset){cursor=null;revision=null;digest=null;top=[];own=null;render();}more.disabled=refresh.disabled=true;status.textContent='Loading rankings…';
        try{const response=await repository.read({taskId,cursor,boardRevision:revision,orderingDigest:digest},owner);if(!current(id))return;
            if(response.status==='refresh_required' || response.status==='BOARD_CHANGED'){top=[];own=null;cursor=null;render();status.textContent='Rankings changed. Refresh to see the current order.';return;}
            if(response.status!=='ok'){status.textContent='Rankings are unavailable for this activity.';table.hidden=true;return;}
            revision=response.boardRevision;digest=response.orderingDigest;cursor=response.nextCursor;
            const seen=new Set(top.map(entry=>entry.userId));for(const entry of response.entries){if(entry.userId===owner)own=entry;if(entry.rank<=5 && (!response.pageUserIds || response.pageUserIds.includes(entry.userId)) && !seen.has(entry.userId)){top.push(entry);seen.add(entry.userId);}}
            render();status.textContent=top.length?'Top five ranks, including tied students. Your own result appears too.':'No confirmed results yet.';
        }catch{if(current(id))status.textContent='Rankings could not be loaded. Your saved attempt is still available.';}
        finally{if(current(id))more.disabled=refresh.disabled=false;}
    }
    more.addEventListener('click',()=>load());refresh.addEventListener('click',()=>load(true));void load(true);
    return {refresh:()=>load(true),destroy(){destroyed=true;generation++;section.remove();}};
}
function contribution(n,d){const value=100n*BigInt(n)/BigInt(d);return value%100n===0n?String(value/100n):`${value/100n}.${String(value%100n).padStart(2,'0')}`;}
export function mountLearningResult({root,result,confirmed=false,passingTarget=80,kind='ranked_full',onRetry,onReview,board}) {
    const section=element('section',undefined,'learning-result'),heading=element('h2',confirmed?'Your result':'Your saved result');heading.tabIndex=-1;
    const status=element('p',confirmed?'Confirmed':'Waiting to sync');status.setAttribute('role','status');
    const score=element('p',`${result.points} / 1000 points`,'learning-result-points'),stars=element('p','★'.repeat(result.stars)+'☆'.repeat(5-result.stars));stars.setAttribute('aria-label',`${result.stars} out of 5 stars`);
    const stats=element('dl');for(const [label,value] of [['Accuracy',`${weightedPercent(result.weighted)}%`],['Accuracy contribution',`${contribution(950n*BigInt(result.weighted.numerator),result.weighted.denominator)} / 950`],['Speed bonus',`${contribution(result.speed.numerator,result.speed.denominator)} / 50`],['Passing target',`${passingTarget}%`],['Scored answer time',scoredTime(result.recordedMilliseconds)],['Longest combo',result.longestCombo]])stats.append(element('dt',label),element('dd',value));
    let explanation;
    if(kind==='practice')explanation='Practice result. Practice does not add progress rewards or a leaderboard entry.';
    else if(!result.finished)explanation='Your original score is saved. Correct the missed answers to finish this attempt.';
    else if(result.passed)explanation=confirmed?'You reached your passing target.':'You reached your passing target. Completion will be confirmed after syncing.';
    else explanation='You finished the full set. Your score can appear on the leaderboard after validation. Try a new full attempt to reach your passing target.';
    section.append(heading,status,score,stars,stats,element('p','Total points are rounded down to a whole number.'),element('p',explanation));
    const buttons=[];function button(label,action){const control=element('button',label,'btn primary-btn');control.type='button';control.addEventListener('click',async()=>{if(control.disabled)return;control.disabled=true;try{await action();}catch{status.textContent='That action could not be completed. Your saved work is still available.';}finally{if(control.isConnected)control.disabled=false;}});buttons.push(control);section.append(control);}
    if(!result.finished && onReview)button('Correct missed answers',onReview);if(result.finished && onRetry)button('Try the full activity again',onRetry);
    root.append(section);heading.focus();const leaderboard=confirmed && kind==='ranked_full' && result.finished && board?mountLearningBoard({...board,root:section}):null;
    return {destroy(){leaderboard?.destroy();section.remove();}};
}
