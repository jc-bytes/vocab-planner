import test from 'node:test';
import assert from 'node:assert/strict';
import { LazyStudentActivityLauncher } from '../js/student/lazyStudentActivityLauncher.js';

test('launcher waits for the activity feature and drops superseded launches', async () => {
 const calls=[];let release;
 const activities={sm:{currentVocab:{id:'one'}}};
 const pending=new Promise(resolve=>release=resolve);
 const launcher=new LazyStudentActivityLauncher(activities,()=>pending);
 const first=launcher.startActivity('flashcards');
 const second=launcher.startActivity('matching',{review:true});
 assert.deepEqual(calls,[]);
 release({StudentActivityLauncher:class {startActivity(...args){calls.push(args);}}});
 await Promise.all([first,second]);
 assert.deepEqual(calls,[['matching',{review:true}]]);
});
test('launcher discards a load after the selected unit changes and allows retry after import failure', async()=>{
 let release;const activities={sm:{currentVocab:{id:'one'}}};let launched=false;
 const launcher=new LazyStudentActivityLauncher(activities,()=>new Promise(resolve=>release=resolve));
 const pending=launcher.startActivity('quiz');activities.sm.currentVocab={id:'two'};
 release({StudentActivityLauncher:class {startActivity(){launched=true;}}});await pending;
 assert.equal(launched,false);
 launcher.load=async()=>{throw new Error('network');};
 await assert.rejects(launcher.startActivity('quiz'),/network/);
 launcher.load=async()=>({StudentActivityLauncher:class {startActivity(){launched=true;}}});
 await launcher.startActivity('quiz');assert.equal(launched,true);
});

test('eager launch ownership spans the launcher import and the inner startup promise', async () => {
    let load, finish;
    const launcher = new LazyStudentActivityLauncher({ sm: { currentVocab: { id: 'fixture' } } }, () => new Promise(resolve => { load = resolve; }));
    const pending = launcher.startActivity('flashcards');
    assert.equal(launcher.isStarting, true);
    load({ StudentActivityLauncher: class { startActivity() { return new Promise(resolve => { finish = resolve; }); } } });
    while (!finish) await new Promise(resolve => setImmediate(resolve));
    assert.equal(launcher.isStarting, true);
    finish(); await pending;
    assert.equal(launcher.isStarting, false);
});
