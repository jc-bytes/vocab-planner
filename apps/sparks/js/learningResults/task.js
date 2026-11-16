import { ACTIVITIES, LIMITS, CONTRACT_VERSION, canonical, byteLength, bytes, sha256, fail, integer, uuid, byteOrder } from './contract.js';
import { normalizeSpelling } from './scoring.js';
export function random32(seed) {
    integer(seed, 1, 0xffffffff); let state = seed >>> 0;
    return () => { state ^= state << 13; state ^= state >>> 17; state ^= state << 5; return state >>> 0; };
}
export function shuffle(values, next) { const result = [...values]; for (let i = result.length - 1; i > 0; i--) { const j = next() % (i + 1); [result[i], result[j]] = [result[j], result[i]]; } return result; }
export function validateTask(task) {
    if (task.contractVersion !== CONTRACT_VERSION || !ACTIVITIES.includes(task.activity)) fail('INVALID_TASK');
    uuid(task.id, 'task.id'); integer(task.sharedTargetMilliseconds, 1000, 86400000);
    if (!Array.isArray(task.words) || !task.words.length || task.words.length > LIMITS.words) fail('INVALID_TASK', 'words');
    const ids = new Set(), labels = new Set(), definitions = new Set();
    for (const word of task.words) {
        if (typeof word.id !== 'string' || !word.id || ids.has(word.id)) fail('INVALID_TASK', 'word.id'); ids.add(word.id);
        if (typeof word.word !== 'string' || !word.word.trim()) fail('INVALID_TASK', word.id);
        if(['flashcards','quiz','synonym-antonym','reading-check'].includes(task.activity)) {
            if(!Array.isArray(word.options) || word.options.length<2 || word.options.length>8)fail('INVALID_TASK','options');
            const options=new Set();
            for(const option of word.options) {
                if(typeof option.id!=='string' || !option.id || options.has(option.id))fail('INVALID_TASK','option.id');
                options.add(option.id);
            }
            if(!options.has(word.correctOptionId))fail('INVALID_TASK','correctOptionId');
        }
        const label = normalizeSpelling(word.word);
        if(task.activity!=='reading-check') {
            if(task.activity==='synonym-antonym' && !['synonym','antonym'].includes(word.relation))fail('INVALID_TASK','relation');
            const identity=task.activity==='synonym-antonym'?`${label}:${word.relation}`:label;
            if(!label || labels.has(identity))fail('WORD_AMBIGUOUS',word.id);
            labels.add(identity);
            if(['matching','speed-match'].includes(task.activity) && word.definition!==undefined) {
                const definition=word.definition.trim();
                if(!definition || definitions.has(definition))fail('WORD_AMBIGUOUS',word.id);
                definitions.add(definition);
            }
        }
        if (['wordle', 'hangman', 'scramble', 'crossword', 'word-search'].includes(task.activity)) {
            const min = task.activity === 'wordle' ? 3 : ['crossword', 'word-search'].includes(task.activity) ? 2 : 1;
            const max = task.activity === 'wordle' ? 10 : 30;
            if (!/^[a-z]+$/.test(label) || label.length < min || label.length > max) fail('WORD_UNPLAYABLE', word.id);
        }
    }
    if (['matching', 'speed-match'].includes(task.activity) && task.words.length < 2) fail('INVALID_TASK', 'distractors');
    const appearances = ['matching', 'speed-match'].includes(task.activity) ? integer(task.appearances ?? 5, 1, LIMITS.appearances) : 1;
    if (appearances * task.words.length > LIMITS.opportunities) fail('INVALID_TASK', 'opportunities');
    if (['crossword', 'word-search'].includes(task.activity)) {
        if (!task.variants?.length || task.variants.length > 4) fail('LAYOUT_INVALID');
        const variantIds = new Set();
        for (const variant of task.variants) { uuid(variant.variantId); if (variantIds.has(variant.variantId)) fail('LAYOUT_INVALID'); variantIds.add(variant.variantId); validateLayout(task.words, task.activity, variant); }
    }
    return task;
}
export function makeSchedule(task, seed) {
    const next = random32(seed); const opportunities = [];
    const count = ['matching', 'speed-match'].includes(task.activity) ? task.appearances ?? 5 : 1;
    for (let round = 0; round < count; round++) for (const word of shuffle([...task.words].sort((a, b) => byteOrder(a.id,b.id)), next)) opportunities.push({ id: `${word.id}:${round}`, wordId: word.id, appearance: round });
    return opportunities;
}
const DIRECTIONS = Object.freeze({ across: [0, 1], down: [1, 0], N: [-1, 0], NE: [-1, 1], E: [0, 1], SE: [1, 1], S: [1, 0], SW: [1, -1], W: [0, -1], NW: [-1, -1] });
export function placementCells(placement, word) {
    const step = DIRECTIONS[placement.direction]; if (!step) fail('LAYOUT_INVALID', 'direction');
    return [...normalizeSpelling(word.word).toUpperCase()].map((letter, i) => ({ row: placement.startRow + step[0] * i, column: placement.startColumn + step[1] * i, letter }));
}
export function validateLayout(words, activity, layout) {
    if (layout.generatorVersion !== 'grid-v1' || !/^[0-9a-f]{8}$/.test(layout.seed) || parseInt(layout.seed, 16) === 0) fail('LAYOUT_INVALID', 'seed');
    integer(layout.rows, 1, 40); integer(layout.columns, 1, 40);
    if (!Array.isArray(layout.gridRows) || layout.gridRows.length !== layout.rows || layout.gridRows.some(row => typeof row !== 'string' || row.length !== layout.columns || !(activity === 'crossword' ? /^[A-Z#]+$/ : /^[A-Z]+$/).test(row))) fail('LAYOUT_INVALID', 'gridRows');
    if (byteLength(layout) > 49152) fail('LAYOUT_LIMIT');
    const byId = new Map(words.map(w => [w.id, w])), seen = new Set(), occupied = new Map(), adjacency = new Map();
    if (!Array.isArray(layout.placements) || layout.placements.length !== words.length) fail('LAYOUT_INVALID', 'coverage');
    const normalized = words.map(w => normalizeSpelling(w.word));
    if (activity === 'word-search' && new Set(normalized).size !== normalized.length) fail('LAYOUT_INVALID', 'duplicateWords');
    for (const placement of layout.placements) {
        const word = byId.get(placement.wordId);
        if (!word || seen.has(word.id)) fail('LAYOUT_INVALID', 'coverage'); seen.add(word.id); adjacency.set(word.id, new Set());
        integer(placement.startRow, 0, layout.rows - 1); integer(placement.startColumn, 0, layout.columns - 1);
        if (activity === 'crossword' && !['across', 'down'].includes(placement.direction)) fail('LAYOUT_INVALID', 'direction');
        if (activity === 'word-search' && !['N','NE','E','SE','S','SW','W','NW'].includes(placement.direction)) fail('LAYOUT_INVALID', 'direction');
        const cells = placementCells(placement, word);
        for (const cell of cells) {
            if (layout.gridRows[cell.row]?.[cell.column] !== cell.letter) fail('LAYOUT_INVALID', 'letters');
            const key = `${cell.row}:${cell.column}`, prior = occupied.get(key) || [];
            for (const other of prior) {
                if (activity === 'crossword' && other.direction === placement.direction) fail('LAYOUT_INVALID', 'collinear');
                adjacency.get(word.id).add(other.wordId); adjacency.get(other.wordId).add(word.id);
            }
            prior.push(placement); occupied.set(key, prior);
        }
    }
    if (activity === 'crossword') {
        const reached = new Set(), visit = id => { if (reached.has(id)) return; reached.add(id); for (const other of adjacency.get(id)) visit(other); }; visit(words[0].id);
        if (reached.size !== words.length) fail('LAYOUT_INVALID', 'connected');
        const declared = new Set(layout.placements.map(p => placementCells(p, byId.get(p.wordId)).map(c => `${c.row}:${c.column}`).join(',')));
        for (let row = 0; row < layout.rows; row++) for (let col = 0; col < layout.columns; col++) {
            if (layout.gridRows[row][col] === '#') continue;
            if (!occupied.has(`${row}:${col}`)) fail('LAYOUT_INVALID', 'undeclared');
            for (const [dr, dc] of [[0,1],[1,0]]) {
                if (layout.gridRows[row-dr]?.[col-dc] && layout.gridRows[row-dr][col-dc] !== '#') continue;
                const run = []; let r=row, c=col;
                while (layout.gridRows[r]?.[c] && layout.gridRows[r][c] !== '#') { run.push(`${r}:${c}`); r+=dr; c+=dc; }
                if (run.length > 1 && !declared.has(run.join(','))) fail('LAYOUT_INVALID', 'undeclared');
            }
        }
    }
    return layout;
}
export async function chooseVariant(task, attemptId) {
    const variants = [...task.variants].sort((a,b) => a.variantId < b.variantId ? -1 : 1);
    const hash = await sha256(bytes({ attemptId: uuid(attemptId), taskId: uuid(task.id) }));
    return variants[parseInt(hash.slice(0,8), 16) % variants.length];
}
export async function packageReady(pkg) {
    if (!pkg?.ready || !pkg.ownerUserId || !pkg.preparationId || !pkg.manifestHash) return false;
    try { validateTask(pkg.task); return await sha256(bytes(pkg.content)) === pkg.manifestHash && canonical(pkg.content.task) === canonical(pkg.task); } catch { return false; }
}
export function generateLayout({words,activity,seed,variantId=crypto.randomUUID()}) {
    if(!['crossword','word-search'].includes(activity))fail('INVALID_ACTIVITY');
    integer(seed,1,0xffffffff);uuid(variantId);if(!words.length||words.length>LIMITS.words)fail('INVALID_TASK');
    const labels=new Map(words.map(w=>[w.id,normalizeSpelling(w.word).toUpperCase()]));
    if(words.some(w=>!/^[A-Z]{2,30}$/.test(labels.get(w.id))))fail('WORD_UNPLAYABLE');
    for(let candidate=0;candidate<100;candidate++) {
        const next=random32(((seed+candidate)>>>0)||1), grid=Array.from({length:40},()=>Array(40).fill('#')),placements=[],occupied=new Map();let operations=0,failed=false;
        const order=shuffle([...words].sort((a,b)=>a.id<b.id?-1:1),next).sort((a,b)=>labels.get(b.id).length-labels.get(a.id).length);
        for(const word of order) {
            const label=labels.get(word.id),choices=[];
            if(activity==='word-search') {
                const dirs=['N','NE','E','SE','S','SW','W','NW'];
                for(let i=0;i<300;i++)choices.push({wordId:word.id,startRow:next()%40,startColumn:next()%40,direction:dirs[next()%8]});
            } else if(!placements.length)choices.push({wordId:word.id,startRow:20,startColumn:Math.floor((40-label.length)/2),direction:'across'});
            else for(const [key,prior] of occupied) {
                const [row,col]=key.split(':').map(Number);
                for(let i=0;i<label.length;i++)if(grid[row][col]===label[i])for(const direction of ['across','down'])if(prior.every(p=>p.direction!==direction))choices.push({wordId:word.id,startRow:row-(direction==='down'?i:0),startColumn:col-(direction==='across'?i:0),direction});
            }
            let placed=false;
            for(const placement of shuffle(choices,next)) {
                if(++operations>10000)break;
                const cells=placementCells(placement,word),[dr,dc]=DIRECTIONS[placement.direction];let valid=true;
                if(activity==='crossword')for(const p of [{row:cells[0].row-dr,column:cells[0].column-dc},{row:cells.at(-1).row+dr,column:cells.at(-1).column+dc}])if(grid[p.row]?.[p.column]&&grid[p.row][p.column]!=='#')valid=false;
                for(const cell of cells) {
                    if(cell.row<0||cell.row>=40||cell.column<0||cell.column>=40){valid=false;break;}
                    const previous=grid[cell.row][cell.column],prior=occupied.get(`${cell.row}:${cell.column}`)||[];
                    if(previous!=='#'&&previous!==cell.letter)valid=false;
                    if(activity==='crossword') {
                        if(prior.some(p=>p.direction===placement.direction))valid=false;
                        if(previous==='#')for(const sign of [-1,1]){const neighbor=grid[cell.row+sign*dc]?.[cell.column+sign*dr];if(neighbor&&neighbor!=='#')valid=false;}
                    }
                }
                if(!valid)continue;
                for(const cell of cells){grid[cell.row][cell.column]=cell.letter;const key=`${cell.row}:${cell.column}`;occupied.set(key,[...(occupied.get(key)||[]),placement]);}
                placements.push(placement);placed=true;break;
            }
            if(!placed){failed=true;break;}
        }
        if(failed)continue;
        let minRow=0,minCol=0,maxRow=39,maxCol=39;
        if(activity==='crossword') {
            const keys=[...occupied.keys()].map(k=>k.split(':').map(Number));minRow=Math.min(...keys.map(p=>p[0]));maxRow=Math.max(...keys.map(p=>p[0]));minCol=Math.min(...keys.map(p=>p[1]));maxCol=Math.max(...keys.map(p=>p[1]));
        } else for(const row of grid)for(let col=0;col<40;col++)if(row[col]==='#')row[col]=String.fromCharCode(65+next()%26);
        const layout={variantId,generatorVersion:'grid-v1',seed:seed.toString(16).padStart(8,'0'),rows:maxRow-minRow+1,columns:maxCol-minCol+1,
            gridRows:grid.slice(minRow,maxRow+1).map(row=>row.slice(minCol,maxCol+1).join('')),placements:placements.map(p=>({...p,startRow:p.startRow-minRow,startColumn:p.startColumn-minCol}))};
        try{return validateLayout(words,activity,layout);}catch(error){if(error.code!=='LAYOUT_INVALID')throw error;}
    }
    return fail('LAYOUT_GENERATION_FAILED','words','A complete puzzle could not be created. Try editing the words or selecting a smaller set.');
}
