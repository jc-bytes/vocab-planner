import {node,button,textInput,formSubmit} from './ui.js';
import {normalizeSpelling} from '../scoring.js';
import {shuffle,random32} from '../task.js';
export function spellingGame({root,word,opportunity,runtime}) {
    const activity=runtime.session.attempt.task.activity,expected=normalizeSpelling(word.word),draft=runtime.draftFor(opportunity),data={...draft};
    root.append(node('h3',word.definition));
    if(activity==='fill-in-blank'){
        if(word.example){const escaped=word.word.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');root.append(node('p',word.example.replace(new RegExp(escaped,'gi'),'_____')));}
        const form=node('form'),{wrapper,input}=textInput('Missing word',data.answer || '');form.append(wrapper);root.append(form);
        input.addEventListener('input',()=>runtime.saveDraft(opportunity,{answer:input.value}));formSubmit(form,'Submit answer',()=>runtime.answer(opportunity,{answer:input.value}));input.focus();return;
    }
    if(activity==='scramble'){
        const letters=shuffle([...expected].map((letter,id)=>({letter,id})),random32(runtime.session.attempt.seed));let selected=data.selected || [];
        const answer=node('div',undefined,'learning-tiles'),pool=node('div',undefined,'learning-tiles');root.append(node('p','Build the word by selecting letters. Only your first submitted arrangement is scored.'),answer,pool);
        const draw=()=>{answer.replaceChildren();pool.replaceChildren();for(const id of selected){const item=letters.find(l=>l.id===id);if(item)answer.append(button(item.letter.toUpperCase(),()=>{selected=selected.filter(value=>value!==id);draw();runtime.saveDraft(opportunity,{selected});},'learning-tile'));}for(const item of letters.filter(l=>!selected.includes(l.id)))pool.append(button(item.letter.toUpperCase(),()=>{selected.push(item.id);draw();runtime.saveDraft(opportunity,{selected});},'learning-tile'));};draw();
        root.append(button('Submit arrangement',()=>runtime.answer(opportunity,{answer:selected.map(id=>letters.find(l=>l.id===id).letter).join('')})));return;
    }
    if(activity==='wordle'){
        const guesses=[...(data.guesses || [])],history=node('ol',undefined,'learning-guesses');
        for(const guess of guesses){const row=node('li'),remaining=[...expected],states=[...guess].map((char,i)=>{if(char===expected[i]){remaining[i]=null;return 'correct';}return '';});
            [...guess].forEach((char,i)=>{if(!states[i]){const found=remaining.indexOf(char);if(found>=0){states[i]='present';remaining[found]=null;}else states[i]='absent';}const cell=node('span',char.toUpperCase(),`learning-letter ${states[i]}`);cell.setAttribute('aria-label',`${char}, ${states[i]}`);row.append(cell);});history.append(row);}
        root.append(node('p',`Guess the ${expected.length}-letter word in six guesses.`),history);
        const form=node('form'),{wrapper,input}=textInput('Next guess');input.maxLength=expected.length;form.append(wrapper);root.append(form);const feedback=node('p');feedback.setAttribute('role','status');form.append(feedback);
        formSubmit(form,'Submit guess',()=>runtime.run(async()=>{const guess=normalizeSpelling(input.value);if(!/^[a-z]+$/.test(guess) || guess.length!==expected.length){feedback.textContent=`Enter ${expected.length} letters.`;return;}
            guesses.push(guess);if(guess===expected || guesses.length===6)await runtime.record(opportunity,{guesses});else{await runtime.persistDraft(opportunity,{guesses});await runtime.render();}}));input.focus();return;
    }
    if(activity==='hangman'){
        const letters=[...(data.letters || [])],wrong=letters.filter(char=>!expected.includes(char));
        root.append(node('p',[...expected].map(char=>letters.includes(char)?char.toUpperCase():'_').join(' '),'learning-word'),node('p',`${wrong.length} of 6 incorrect letters. Solve the word before the sixth incorrect letter.`));
        const drawing=node('pre',['  +---+','  |   |',`  ${wrong.length>0?'O':' '}   |`,`${wrong.length>2?'/':''}${wrong.length>1?'|':' '}${wrong.length>3?'\\':''}   |`,`${wrong.length>4?'/':' '} ${wrong.length>5?'\\':' '}  |`,'======'].join('\n'));drawing.setAttribute('aria-hidden','true');root.append(drawing);
        const keyboard=node('div',undefined,'learning-keyboard');for(const char of 'abcdefghijklmnopqrstuvwxyz'){const key=button(char.toUpperCase(),()=>runtime.run(async()=>{letters.push(char);const solved=[...expected].every(c=>letters.includes(c));if(solved || letters.filter(c=>!expected.includes(c)).length===6)await runtime.record(opportunity,{letters});else{await runtime.persistDraft(opportunity,{letters});await runtime.render();}}),'btn secondary-btn');key.disabled=letters.includes(char);keyboard.append(key);}root.append(keyboard);
    }
}
