import test from 'node:test';
import assert from 'node:assert/strict';
import { selectCurrentClassSpark, formatClassSparkHeading, getReleasedClassSparks, getAutomaticClassSparkLocation } from '../js/student/studentClassSparkModel.js';

test('Sparks defaults to the current Panama month, including at a UTC month boundary', () => {
 const items=[{trimester:'IIIT',month:'october',date:'2026-10-01'}, {trimester:'IIIT',month:'september',date:'2026-09-30'}];
 assert.deepEqual(getAutomaticClassSparkLocation(items,null,new Date('2026-10-15T12:00:00Z')), {trimester:'IIIT',month:'october'});
 assert.deepEqual(getAutomaticClassSparkLocation(items,null,new Date('2026-10-01T04:30:00Z')), {trimester:'IIIT',month:'september'});
});

test('Sparks falls back to the nearest available month without mutating the library', () => {
 const items=[{trimester:'IT',month:'march',date:'2026-03-04'}, {trimester:'IIIT',month:'september',date:'2026-09-30'}];
 const before=structuredClone(items);
 assert.deepEqual(getAutomaticClassSparkLocation(items,null,new Date('2026-10-15T12:00:00Z')), {trimester:'IIIT',month:'september'});
 assert.deepEqual(items,before);
 assert.equal(getAutomaticClassSparkLocation([],null,new Date('2026-10-15T12:00:00Z')),null);
 assert.equal(getAutomaticClassSparkLocation([{trimester:'other',month:'other',date:'2026-01-01'}],null),null);
});
test('current class Spark excludes future, withdrawn, closed and vocabulary work and selects the latest release', () => {
 const now=Date.parse('2026-10-14T12:00:00Z');
 const a=(id,release,extra={})=>({id,kind:'spark',release_at:release,...extra});
 const current=a('current','2026-10-13');
 const candidates=[a('old','2026-10-01'),current,a('future','2026-10-20'),a('withdrawn','2026-10-14',{withdrawn:true}),a('closed','2026-10-14',{close_at:'2026-10-14T11:00:00Z'}),a('vocab','2026-10-14',{kind:'vocabulary'})];
 assert.equal(selectCurrentClassSpark(candidates,now),current);
 assert.equal(selectCurrentClassSpark([],now),null);
});

test('library uses Panama release dates and school calendar, retains closed Sparks, excludes future and withdrawn', () => {
 const a=(id,release,extra={})=>({id,kind:'spark',release_at:release,...extra});
 const list=getReleasedClassSparks([a('oct','2026-10-01T04:30:00Z'),a('closed','2026-03-03T12:00:00Z',{close_at:'2026-03-04'}),a('future','2026-12-20'),a('withdrawn','2026-09-14',{withdrawn:true}),a('vocab','2026-09-14',{kind:'vocabulary'})],null,Date.parse('2026-10-15'));
 assert.deepEqual(list.map(x=>[x.id,x.trimester,x.month,x.closed]),[['oct','IIIT','september',false],['closed','IT','march',true]]);
 assert.equal(list[0].date,'2026-09-30');
});

test('Spark headings separate recognised scheduling context without losing the series or title', () => {
 assert.deepEqual(formatClassSparkHeading('G9 T3 W04 - Explain the message risk - Words in use 2'), {
  title: 'Explain the message risk', context: 'Grade 9 · Trimester 3 · Week 4 · Words in use 2'
 });
 assert.deepEqual(formatClassSparkHeading('G6 T1 W02 - Back-up files - Keep a copy'), {
  title: 'Back-up files - Keep a copy', context: 'Grade 6 · Trimester 1 · Week 2'
 });
 for (const title of ['Explain the message risk', '<script>alert(1)</script>', 'G9 - Unusual teacher title']) {
  assert.deepEqual(formatClassSparkHeading(title), { title, context: '' });
 }
 assert.deepEqual(formatClassSparkHeading(''), {title:'Your Spark',context:''});
});
