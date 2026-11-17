import {node,button} from './ui.js';
import {normalizeSpelling} from '../scoring.js';
export const directions={across:[0,1],down:[1,0],N:[-1,0],NE:[-1,1],E:[0,1],SE:[1,1],S:[1,0],SW:[1,-1],W:[0,-1],NW:[-1,-1]};
export function cellsFor(placement,length){const [dr,dc]=directions[placement.direction];return Array.from({length},(_,i)=>[placement.startRow+i*dr,placement.startColumn+i*dc]);}
export function puzzleGame({root,runtime}) {
    const attempt=runtime.session.attempt,layout=attempt.task.variants.find(v=>v.variantId===attempt.variantId),crossword=attempt.task.activity==='crossword';
    const grid=node('div',undefined,`learning-grid ${crossword?'learning-crossword':'learning-search'}`);grid.style.setProperty('--columns',String(layout.gridRows[0].length));grid.setAttribute('role','group');grid.setAttribute('aria-label',crossword?'Crossword grid':'Word Search grid');
    const draft={...(attempt.state.draft.puzzle || {})},inputs=new Map(),selected=[];let start=null,pointer=false;
    const selectionStatus=node('p');selectionStatus.setAttribute('role','status');
    function select(row,col){
        if(!start){start=[row,col];selected.splice(0);selected.push([row,col]);selectionStatus.textContent=`Start row ${row+1}, column ${col+1}. Select the last letter.`;return;}
        const dr=Math.sign(row-start[0]),dc=Math.sign(col-start[1]),distance=Math.max(Math.abs(row-start[0]),Math.abs(col-start[1]));
        if((row!==start[0] && col!==start[1] && Math.abs(row-start[0])!==Math.abs(col-start[1])) || !distance){start=null;selectionStatus.textContent='Select a straight line of letters.';return;}
        const path=Array.from({length:distance+1},(_,i)=>[start[0]+i*dr,start[1]+i*dc]);start=null;
        const text=path.map(([r,c])=>layout.gridRows[r]?.[c] || '').join('').toLowerCase();
        const opportunity=attempt.schedule.find(o=>!attempt.state.originals[o.id] && normalizeSpelling(attempt.task.words.find(w=>w.id===o.wordId).word)===text);
        if(!opportunity){selectionStatus.textContent='That selection is not a remaining word. Try again.';return;}
        runtime.answer(opportunity,{variantId:layout.variantId,path});
    }
    layout.gridRows.forEach((row,r)=>[...row].forEach((letter,c)=>{
        if(letter==='#'){const block=node('span',undefined,'learning-grid-block');block.setAttribute('aria-hidden','true');grid.append(block);return;}
        if(crossword){const input=node('input');input.maxLength=1;input.autocomplete='off';input.spellcheck=false;input.setAttribute('aria-label',`Row ${r+1}, column ${c+1}`);input.value=draft[`${r}:${c}`] || '';input.addEventListener('input',()=>{draft[`${r}:${c}`]=input.value;runtime.savePuzzle(draft);});input.addEventListener('keydown',event=>{const delta={ArrowUp:[-1,0],ArrowDown:[1,0],ArrowLeft:[0,-1],ArrowRight:[0,1]}[event.key];if(delta){event.preventDefault();inputs.get(`${r+delta[0]}:${c+delta[1]}`)?.focus();}});inputs.set(`${r}:${c}`,input);grid.append(input);}
        else{const control=button(letter,()=>{if(!pointer)select(r,c);},'learning-grid-letter');control.setAttribute('aria-label',`${letter}, row ${r+1}, column ${c+1}`);control.addEventListener('pointerdown',event=>{if(event.pointerType==='mouse'){pointer=true;start=[r,c];event.preventDefault();}});control.addEventListener('pointerup',()=>{if(pointer){pointer=false;select(r,c);}});grid.append(control);}
    }));
    const clues=node('ol');layout.placements.forEach((placement,index)=>{const word=attempt.task.words.find(w=>w.id===placement.wordId),opportunity=attempt.schedule.find(o=>o.wordId===word.id),found=!!attempt.state.originals[opportunity.id],item=node('li');
        const text=crossword?`${['E','across'].includes(placement.direction)?'Across':'Down'}, row ${placement.startRow+1}, column ${placement.startColumn+1}: ${word.definition}`:`${word.word}${found?' — found':''}`;
        item.append(node('span',text));if(!found)item.append(button('Clue',()=>runtime.hint(opportunity,crossword?`The word is ${word.word}.`:`${word.word} starts at row ${placement.startRow+1}, column ${placement.startColumn+1}.`,crossword?layout.placements.filter(other=>{const a=new Set(cellsFor(placement,normalizeSpelling(word.word).length).map(cell=>cell.join(':')));return cellsFor(other,normalizeSpelling(attempt.task.words.find(w=>w.id===other.wordId).word).length).some(cell=>a.has(cell.join(':')));}).map(p=>attempt.schedule.find(o=>o.wordId===p.wordId).id):[opportunity.id]),'btn secondary-btn'));clues.append(item);
    });
    root.append(node('h3',crossword?'Complete the crossword':'Find each word'),node('p',crossword?'Submit the whole puzzle when ready. Then correct any missed words.':'Select the first and last letter, or drag from the first to the last letter.'),grid,selectionStatus,clues);
    if(crossword)root.append(button('Submit whole puzzle',()=>runtime.run(async()=>{const responses={};for(const placement of layout.placements){const word=attempt.task.words.find(w=>w.id===placement.wordId),opportunity=attempt.schedule.find(o=>o.wordId===word.id);responses[opportunity.id]={answer:cellsFor(placement,normalizeSpelling(word.word).length).map(([r,c])=>inputs.get(`${r}:${c}`)?.value || '?').join('')};}await runtime.flushDraft();await runtime.session.submitPuzzle(responses);runtime.saved();await runtime.render();})));
    return ()=>{};
}
