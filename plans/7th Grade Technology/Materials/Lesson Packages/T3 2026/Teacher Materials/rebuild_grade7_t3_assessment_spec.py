#!/usr/bin/env python3
import json
from pathlib import Path
p=Path(__file__).with_name('grade7-assessment-spec.json')
old=json.loads(p.read_text())
by=lambda s: next(x for x in old if s in x['title'])
d1=by('Spreadsheet Vocabulary'); d2=by('Spreadsheet Formulas'); scratch=by('Scratch Custom Block'); exam=by('Mandrake Obstacle-Detection')
scratch['title']='Daily Grade 5 — Scratch Custom Block and Repeat Loop — October 2, 2026'; scratch['label']='2026-10-02 - Daily Grade 5 - Scratch Custom Block and Repeat Loop'
ready=["Device and login ready; on time; responsible use; deadline met.","One issue corrected after one reminder; work remains checkable.","Device or login missing, late or unprepared, or repeated reminders; some fallback work.","No device or login and no fallback, no checkable work, or responsible-use rules refused."]
def steam(number,date,title,criteria):
 return {'kind':'daily','folder':'Daily','title':f'Daily Grade {number} — {title} — {date}, 2026','label':f'2026-{"10-23" if number==3 else "10-16"} - Daily Grade {number} - {title}','max':40,'criteria':criteria+[['Punctuality, responsibility, and readiness',4,ready]]}
d4=steam(4,'October 16','STEAM Preparation and Work Process',[
['Preparation',9,['All 4 announced preparation checks are observed.','3 of 4 preparation checks are observed.','1–2 preparation checks are observed.','0 preparation checks are observed after make-up.']],
['Assigned role work',9,['All 4 individual role-work checkpoints are completed.','3 of 4 checkpoints are completed.','1–2 checkpoints are completed.','0 checkpoints are completed after make-up.']],
['Responsible work',9,['All 4 safety, materials, focus, and team-role checks are observed.','3 of 4 responsible-work checks are observed.','1–2 checks are observed.','0 checks are observed, or unsafe conduct prevents work.']],
['Individual Technology log',9,['All 3 entries name task, result/evidence, and next step.','All 3 entries exist; one required part is missing.','1–2 usable entries are complete.','No usable individual log is submitted after make-up.']]])
d3=steam(3,'October 23','STEAM Expo Participation and Closure',[
['Assigned expo role',9,['All 4 announced individual role actions are completed.','3 of 4 role actions are completed.','1–2 role actions are completed.','0 role actions are completed after make-up.']],
['Project explanation',9,['All 5 explanation parts are accurate and clear.','4 of 5 explanation parts are accurate.','2–3 explanation parts are accurate.','0–1 explanation parts are accurate after make-up.']],
['Respect and closure',9,['All 4 listening, speech, safety, and cleanup checks are observed.','3 of 4 closure checks are observed.','1–2 closure checks are observed.','0 checks are observed, or unsafe conduct prevents closure.']],
['Individual Technology reflection',9,['Contribution, result evidence, and next improvement are all specific.','All 3 parts are present; one lacks detail.','1–2 usable reflection parts are present.','No usable reflection is submitted after make-up.']]])
def appreciation(number,date,title,criteria):
 return {'kind':'appreciation','folder':'Appreciation','title':f'Appreciation Grade {number} — {title} — {date}, 2026','label':f'2026-{"11-06" if number==1 else "11-27"} - Appreciation Grade {number} - {title}','max':40,'criteria':criteria+[['Punctuality, responsibility, and readiness',4,ready]]}
a1=appreciation(1,'November 6','Digital Work Habits and File Responsibility',[
['Folder plan',9,['All 6 fixed files are placed in the correct announced folders.','4–5 files are placed correctly.','2–3 files are placed correctly.','0–1 files are placed correctly.']],
['File names',9,['All 6 filenames follow the supplied name, class, task, and version rules.','4–5 filenames follow the rules.','2–3 filenames follow the rules.','0–1 filenames follow the rules.']],
['Fixed responsibility decisions',9,['All 6 fixed file-responsibility decisions and reasons are correct.','4–5 decisions are correct.','2–3 decisions are correct.','0–1 decisions are correct.']],
['Verification record',9,['All 4 checks record location, open/read test, final version, and submission/fallback.','3 of 4 verification checks are complete.','1–2 verification checks are complete.','No usable verification record is submitted.']]])
a2=appreciation(2,'November 27','Mandrake Project Process and Peer Feedback',[
['Milestone preparation',9,['All 4 fixed milestone checks are complete before peer review.','3 of 4 milestone checks are complete.','1–2 milestone checks are complete.','No milestone check is complete.']],
['Process log',9,['All 3 dated entries state action, result, and next step.','All 3 entries exist; one required detail is missing.','1–2 usable entries are complete.','No usable process entry is submitted.']],
['Peer feedback',9,['All 4 fixed peer-review checks cite visible project evidence.','3 of 4 peer-review checks are usable.','1–2 peer-review checks are usable.','No usable peer feedback is recorded.']],
['Revision and retest',9,['Before issue, selected change, reason, and same-condition retest result are all specific.','3 of 4 revision/retest parts are specific.','1–2 revision/retest parts are usable.','No usable revision or retest is recorded.']]])
p.write_text(json.dumps([d1,d2,d3,d4,scratch,a1,a2,exam],indent=2,ensure_ascii=False)+'\n')
print('Grade 7 spec rebuilt: 5 Daily + 2 Appreciation + 1 Exam')
