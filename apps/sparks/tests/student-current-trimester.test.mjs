import test from 'node:test';
import assert from 'node:assert/strict';
import { assignmentVocabulary } from '../js/services/classroomRepository.js';
import { StudentActivitySchedule } from '../js/student/studentActivityScheduleMethods.js';
import { getCurrentTrimesterFromCalendar } from '../js/services/schoolCalendar.js';

test('assignment vocabulary keeps scheduling placement separate from frozen content', () => {
    const vocab = assignmentVocabulary({id:'assignment',materialId:'material',kind:'vocabulary',title:'Unit',
        content:{words:[{word:'frozen'}]}, vocabularyPlacement:{assignedDate:'2026-10-01',trimester:'3',month:'October',week:2}});
    assert.equal(vocab.trimester, '3');
    assert.equal(vocab.month, 'October');
    assert.equal(vocab.assignedDate, '2026-10-01');
    assert.deepEqual(vocab.words, [{word:'frozen'}]);
});

test('published units without frozen scheduling metadata match the current trimester', () => {
    const schedule = new StudentActivitySchedule({ schoolCalendar: null });
    const today = new Date('2026-10-14T12:00:00');
    const detail = {
        id: 'assignment', materialId: 'material', kind: 'vocabulary', title: 'October unit',
        content: { words: [{ word: 'source', definition: 'Where information comes from' }] }
    };
    assert.equal(schedule.getVocabTrimesterKey(assignmentVocabulary(detail)), 'other');
    const vocab = assignmentVocabulary({
        ...detail,
        vocabularyPlacement: { assignedDate: '2026-10-12', trimester: '3', month: 'October', week: 5 }
    });
    assert.equal(schedule.getVocabTrimesterKey(vocab), getCurrentTrimesterFromCalendar(today));
    assert.equal(schedule.getVocabSchedule(vocab, today).month, 'october');
    assert.deepEqual(vocab.words, detail.content.words);
});

test('legacy assignments with no assigned date retain their saved trimester', () => {
    const schedule = new StudentActivitySchedule({ schoolCalendar: null });
    const vocab = assignmentVocabulary({
        id: 'assignment', materialId: 'material', kind: 'vocabulary', title: 'September unit',
        content: { words: [{ word: 'evidence' }] },
        vocabularyPlacement: { assignedDate: null, trimester: '3', month: 'September', week: 1 }
    });
    assert.equal(schedule.getVocabTrimesterKey(vocab), 'IIIT');
});

test('assignment close time survives mapping and excludes closed work from available units', () => {
 const today=new Date('2026-11-06T12:00:00Z');
 const schedule=new StudentActivitySchedule({schoolCalendar:null});
 const detail={id:'closed',materialId:'material',kind:'vocabulary',title:'Retired spreadsheet unit',
  release_at:'2026-03-02T05:00:00Z',close_at:'2026-10-13T18:12:12Z',withdrawn:false,content:{words:[{word:'cell'}]}};
 const vocab=assignmentVocabulary(detail);
 assert.equal(vocab.closeAt,detail.close_at);
 assert.equal(schedule.isStudentVocabularyAvailable(vocab,today),false);
 assert.equal(schedule.isStudentVocabularyAvailable(assignmentVocabulary({...detail,close_at:null}),today),true);
 assert.equal(schedule.isStudentVocabularyAvailable(assignmentVocabulary({...detail,close_at:today.toISOString()}),today),false);
});
