#!/usr/bin/env python3
"""Rebuild the approved, date-aware Grade 7 T3 calendar materials."""
from pathlib import Path
from html import escape

ROOT = Path(__file__).resolve().parents[6]
G7 = ROOT / "plans/7th Grade Technology"
PKG = G7 / "Materials/Lesson Packages/T3 2026"
NOTES = G7 / "Materials/Class Notes"
DRAFTS = G7 / "Planning/Drafts/3rd Trimester"

rows = [
    ("September",1,"Sep 16","Sep 17","Sep 18","Spreadsheet cell references","Spreadsheet Vocabulary and Cell References","Practice rows, columns, cells, and references.","Complete the fixed vocabulary and cell-reference task.","Corrected practice sheet","Daily Grade 1 working file or print fallback","D1"),
    ("September",2,"Sep 23","Sep 24","Sep 25","Spreadsheet formulas and chart practice","Spreadsheet Formulas and Column Chart","Practice SUM, AVERAGE, MAX, a column chart, and interpretation.","Complete the fixed dataset, formulas, chart, and conclusions.","Saved module practice or printable","Daily Grade 2 spreadsheet/build sheet","D2"),
    ("October",3,"Sep 30","Oct 1","Oct 2","Scratch custom-block practice","Scratch Custom Block and Repeat Loop","Plan and trace one custom block inside a repeat loop.","Build the fixed Scratch delivery task and record three tests.","Scratch practice export or paper trace","Daily Grade 5 .sb3/test sheet","D5"),
    ("October",4,"Oct 7","Oct 8","Oct 9","STEAM preparation","STEAM project development","Continue the cross-subject project assigned by the responsible teacher.","Complete the assigned project checkpoint and work log.","Shared-kit checkpoint","Shared-kit formative work log","STEAM"),
    ("October",5,"Oct 14","Oct 15","Oct 16","STEAM test planning","STEAM Preparation and Work Process","Prepare one fair test and one improvement; begin the individual Technology log.","Complete Daily Grade 4 through the assigned cross-subject project and individual Technology evidence.","Shared-kit test plan and individual log","Daily Grade 4 individual Technology log","D4"),
    ("October",6,"Oct 21","Oct 22","Oct 23","STEAM Week preparation","STEAM Expo Participation and Closure","Rehearse the assigned explanation and organize materials.","Complete Daily Grade 3 through the assigned expo/closure role and individual Technology reflection.","Shared-kit rehearsal/role record","Daily Grade 3 individual expo/closure sheet","D3"),
    ("October",7,"Oct 28","Oct 29","Oct 30","Source and image-credit practice","Source Credibility and Image Credit practice","Practice author, date, evidence, purpose, and four-part credit checks.","Complete fixed source-card practice; this is formative, not a Daily grade.","Corrected fixed-card practice","Formative source response","PRACTICE"),
    ("November",8,"Nov 4 — closed","Nov 5 — closed","Nov 6","No 45-minute class","Digital Work Habits and File Responsibility","Record the Nov 3-5 closures; 7A loses Nov 4 and 7B loses Nov 5.","Complete Appreciation Grade 1 using the fixed file-responsibility task.","None; closures","Appreciation Grade 1 task sheet","A1"),
    ("November",9,"Nov 11","Nov 12","Nov 13","Sensor-system and threshold practice","Mandrake Detection System Design Plan milestone","Trace input-process-signal-output and boundary cases 17, 18, 19 cm.","Complete the fixed Mandrake design milestone as exam-process evidence, not a Daily grade.","Sensor practice record","Exam design milestone","EXAM"),
    ("November",10,"Nov 18","Nov 19","Nov 20","Mandrake project planning","Mandrake build and first tests","Confirm the fixed purpose, roles, logic, and test setup.","Build or simulate the fixed system and record first trials.","Project plan/log entry","Project file or simulation and test record","EXAM"),
    ("November",11,"Nov 25","Nov 26","Nov 27","Mandrake reliability and peer review","Mandrake Project Process and Peer Feedback","Run comparable trials and prepare fixed peer-feedback evidence.","Complete Appreciation Grade 2 using the process log, peer review, revision, and retest sheet.","Updated tests/log","Appreciation Grade 2 process/peer sheet","A2"),
    ("December",12,"Dec 2","Dec 3","Dec 4","Mandrake rehearsal and final checks","Mandrake Obstacle-Detection System — Exam","Use the submission checklist; rehearse the fixed explanation and demo.","Submit and demonstrate the fixed Mandrake obstacle-detection system.","Rehearsal checklist","Exam file/simulation, log, tests, demo, reflection","EXAM"),
    ("December",13,"Dec 9","Dec 10","Dec 11","School exams and Technology make-up","School exams and Technology make-up","Dec 8 is a closure. Complete only assigned make-up, return, or archive work.","Complete only an approved make-up or administrative task; no new Technology assessment.","Make-up evidence only if assigned","No new assessment","BUFFER"),
]

modules = {"D1":"MOD-SPREADSHEET-ANALYSIS-01","D2":"MOD-SPREADSHEET-ANALYSIS-01","D3":"Shared STEAM kit + individual Technology closure sheet","D4":"Shared STEAM kit + individual Technology log","D5":"MOD-SCRATCH-DECOMPOSITION-01","PRACTICE":"assigned module/fixed practice","EXAM":"Mandrake Project packet","A1":"Fixed file-responsibility task sheet","A2":"Mandrake process/peer-feedback sheet","STEAM":"../../../../Shared Materials/T3 2026 STEAM Kit","BUFFER":"None"}

def note_path(month, week, minutes):
    folder = NOTES / f"T3 2026-{ {'September':'09','October':'10','November':'11','December':'12'}[month]} {month}"
    return folder / f"7th Grade Technology - T3 - 2026-{ {'September':'09','October':'10','November':'11','December':'12'}[month]} - {month} - Week {week} - {minutes} minutes.md"

def note(row, minutes):
    month,week,d7a,d7b,fri,t45,t90,o45,o90,e45,e90,tag=row
    if minutes==45:
        label=f"7A — {d7a} — 45 minutes / 7B — {d7b} — 45 minutes"
        topic,obj,evidence=t45,o45,e45
        activity=obj
    else:
        label=f"7A and 7B — {fri} — 90 minutes"
        topic,obj,evidence=t90,o90,e90
        activity=obj
    status=(f"Preparation for {tag}" if minutes==45 and tag in ('D3','D4','A1','A2') else {'STEAM':'Formative STEAM','BUFFER':'No new assessment','PRACTICE':'Formative practice'}.get(tag,tag))
    return f"""---
type: class-plan
grade: 7
trimester: 3rd Trimester
week: {week}
duration: {minutes} minutes
groups-and-dates: \"{label}\"
---

# {label}

## Snapshot

| Field | Detail |
| --- | --- |
| Week | {week} |
| Group, date, duration | {label} |
| Topic | {topic} |
| Assessment status | {status} |

## Objective

{obj}

## Before

- Project [Class Visuals](../../Lesson%20Packages/T3%202026/Class%20Visuals.html#w{week}-{minutes}).
- Open `{modules[tag]}` or distribute the named fixed task/fallback.
- Students use computers; phones, photos, and screenshots are not evidence.

## During

- {activity}
- Teacher checks the working file, written record, or live result named in the package index.

## After and collection

- **Collect:** {evidence}.
- **Check:** use the linked fixed checklist or rubric. Oct 16 is Daily Grade 4 and Oct 23 is Daily Grade 3; other STEAM checkpoints are formative.
- **Make-up/fallback:** use the same fixed printable or simulation route. Documented school network, platform, teacher-account, or hardware failure carries no penalty when the equal fallback is completed.

## Calendar note

The trimester runs Sep 14-Dec 11. Closures recorded for planning are Nov 3, 4, 5, 10, 28 and Dec 8. Nov 28 is a Saturday and does not remove a Grade 7 block.
"""

def monthly(month):
    rr=[r for r in rows if r[0]==month]
    links=[]; table=[]
    for r in rr:
        _,w,a,b,f,t45,t90,o45,o90,_,_,tag=r
        for mins,title in ((45,t45),(90,t90)):
            p=note_path(month,w,mins)
            links.append(f"- [{('7A '+a+' / 7B '+b) if mins==45 else '7A and 7B '+f} — {mins} minutes](<../../../Materials/Class Notes/{p.parent.name}/{p.name}>)")
        assess45=(f"Preparation for {tag}" if tag in ('D3','D4','A1','A2') else {'STEAM':'Formative STEAM','BUFFER':'No new assessment','PRACTICE':'Formative practice'}.get(tag,tag))
        table.append(f"| Week {w} | 7A — {a} — 45 min / 7B — {b} — 45 min | {t45} | {o45} | {assess45} |")
        table.append(f"| Week {w} | 7A and 7B — {f} — 90 min | {t90} | {o90} | { {'STEAM':'Formative STEAM','BUFFER':'No new assessment','PRACTICE':'Formative practice'}.get(tag,tag)} |")
    closure="Closures recorded: Nov 3, 4, 5, 10, 28 and Dec 8. Nov 28 is Saturday. Actual Grade 7 losses: 7A Nov 4 (45 minutes) and 7B Nov 5 (45 minutes)." if month in ('November','December') else "STEAM runs Oct 5-23. Every student receives Technology Daily Grade 4 on Oct 16 and Daily Grade 3 on Oct 23 regardless of assigned project subject." if month=='October' else "Sep 30-Oct 2 is regular class and appears in October Week 3."
    return f"""# 7° Technology - {month} 2026

## Calendar and assessment rules

- Trimester: Sep 14-Dec 11, 2026.
- Schedule: 7A Wednesday 45 minutes and Friday 90 minutes; 7B Thursday 45 minutes and Friday 90 minutes.
- {closure}
- Students bring their computer and school login. Phones, photos, and screenshots are not evidence.
- Readiness/responsibility is at most 10% of an assessment. Documented school-system or hardware failure has an equal fallback and no penalty.

## Class notes

{chr(10).join(links)}

## Monthly plan

| Week | Actual group-date-duration | Topic | Objective / student work | Assessment |
| --- | --- | --- | --- | --- |
{chr(10).join(table)}
"""

def index():
    out=["# Grade 7 Technology, Trimester 3 materials index","","**Package ID:** G7-T3-2026-DATE-AWARE  ","**Groups:** 7A Wednesday 45 min/Friday 90 min; 7B Thursday 45 min/Friday 90 min  ","**Term:** Sep 14-Dec 11, 2026  ","**Assessment structure:** exactly 5 Daily grades, 2 Appreciation grades, 1 Mandrake exam","","Phones, photos, and screenshots are not evidence. STEAM is graded as Daily 4 and Daily 3 for every student regardless of the subject leading the assigned project. Readiness/responsibility is at most 4/40 or 9/90; documented school-system or hardware failure uses an equal fallback with no penalty.","","## Shared resources","","- [Class Visuals](Class%20Visuals.html)","- [Student Task Sheets](Student%20Materials/Student%20Task%20Sheets.md)","- [Teacher checks](Teacher%20Materials/Teacher%20Expected%20Responses%20and%20Check%20Notes.md)","- [Assessment assets](Assessment%20Assets/)","- [Formative fixed source cards](<Assessment Assets/Formative - Fixed Source Cards and Response Sheet.md>)","- [Mandrake design milestone template](<Assessment Assets/Exam Milestone - Fixed Mandrake Design Template.md>)","- [Mandrake packet](Mandrake%20Project/01%20Project%20Brief.md)","- [Shared STEAM kit](<../../../../Shared Materials/T3 2026 STEAM Kit/00 STEAM Kit Index.md>)","","## Official assessment directions","","- Sep 18 — [Daily Grade 1: Spreadsheet Vocabulary and Cell References](<Assessment Directions/Daily Grade 1 - Spreadsheet Vocabulary and Cell References.md>)","- Sep 25 — [Daily Grade 2: Spreadsheet Formulas and Column Chart](<Assessment Directions/Daily Grade 2 - Spreadsheet Formulas and Column Chart.md>)","- Oct 2 — [Daily Grade 5: Scratch Custom Block and Repeat Loop](<Assessment Directions/Daily Grade 5 - Scratch Custom Block and Repeat Loop.md>)","- Oct 16 — [Daily Grade 4: STEAM Preparation and Work Process](<Assessment Directions/Daily Grade 4 - STEAM Preparation and Work Process.md>)","- Oct 23 — [Daily Grade 3: STEAM Expo Participation and Closure](<Assessment Directions/Daily Grade 3 - STEAM Expo Participation and Closure.md>)","- Nov 6 — [Appreciation Grade 1: Digital Work Habits and File Responsibility](<Assessment Directions/Appreciation Grade 1 - Digital Work Habits and File Responsibility.md>)","- Nov 27 — [Appreciation Grade 2: Mandrake Project Process and Peer Feedback](<Assessment Directions/Appreciation Grade 2 - Mandrake Project Process and Peer Feedback.md>)","- Dec 4 — [Exam: Mandrake Obstacle-Detection System](<Mandrake Project/01 Project Brief.md>)","","## Date-aware class-block map",""]
    for r in rows:
        month,w,a,b,f,t45,t90,o45,o90,e45,e90,tag=r
        for mins,label,topic,obj,evidence in ((45,f"7A — {a} / 7B — {b} — 45 min",t45,o45,e45),(90,f"7A and 7B — {f} — 90 min",t90,o90,e90)):
            p=note_path(month,w,mins)
            rel=f"../../Class Notes/{p.parent.name}/{p.name}".replace(' ','%20')
            check=('formative preparation checkpoint' if mins==45 and tag in ('A1','A2') else {'STEAM':'shared-kit formative checkpoint','BUFFER':'make-up checklist only; no new grade','PRACTICE':'formative check; no new grade'}.get(tag,'fixed directions and matching rubric/checklist'))
            out += [f"### {label}","",f"- **Topic:** {topic}",f"- **Objective/student task:** {obj}",f"- **Teacher guide:** [class note]({rel})",f"- **Projected visual:** [w{w}-{mins}](Class%20Visuals.html#w{w}-{mins})",f"- **Module/fixed page:** `{modules[tag]}`",f"- **Evidence/collection:** {evidence}",f"- **Check:** {check}",f"- **Make-up/offline fallback:** same fixed printable or simulation; no penalty for documented school-system/hardware failure","" ]
    out += ["## Closure record","","- Nov 3 and Nov 10: Tuesday closures; no scheduled Grade 7 block lost.","- Nov 4: 7A 45-minute block lost.","- Nov 5: 7B 45-minute block lost.","- Nov 28: Saturday closure; no Grade 7 block lost.","- Dec 8: Tuesday closure; no scheduled Grade 7 block lost.","- Dec 7-11: school exams/make-up; no new Technology assessment."]
    return "\n".join(out)+"\n"

def visuals():
    cards=[]
    for r in rows:
        m,w,a,b,f,t45,t90,o45,o90,e45,e90,tag=r
        for mins,label,topic,obj in ((45,f"7A {a} / 7B {b} · 45 min",t45,o45),(90,f"7A + 7B {f} · 90 min",t90,o90)):
            cards.append(f'<section id="w{w}-{mins}"><p class="kicker">{escape(label)} · {escape(tag)}</p><h2>{escape(topic)}</h2><p>{escape(obj)}</p><p><strong>Evidence:</strong> {escape(e45 if mins==45 else e90)}</p></section>')
    return """<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Grade 7 T3 Class Visuals</title><style>body{font:20px/1.5 Arial,sans-serif;color:#123;background:#f7f4ea;margin:0}header,main{max-width:980px;margin:auto;padding:32px}nav{display:flex;flex-wrap:wrap;gap:8px}a{color:#075b66}section{background:white;border-left:8px solid #0b7a75;margin:28px 0;padding:30px;min-height:48vh}h1{font-size:2.4rem}h2{font-size:2rem}.kicker{font-weight:700;color:#8a4b00}strong{color:#0b4760}@media print{nav{display:none}section{break-inside:avoid;min-height:auto}}</style></head><body><header><h1>Grade 7 Technology · T3 2026</h1><p>Sep 14-Dec 11 · 5 Daily + 2 Appreciation + 1 exam · no phone/photo/screenshot evidence</p><nav>""" + "".join(f'<a href="#w{r[1]}-{m}">W{r[1]} {m}</a>' for r in rows for m in (45,90)) + "</nav></header><main>" + "".join(cards) + "</main></body></html>"

for r in rows:
    for mins in (45,90):
        p=note_path(r[0],r[1],mins); p.parent.mkdir(parents=True,exist_ok=True); p.write_text(note(r,mins))
# Remove obsolete generated placeholders that fall outside the approved calendar.
expected={note_path(r[0],r[1],mins).resolve() for r in rows for mins in (45,90)}
for folder in NOTES.glob("T3 2026-*"):
    for p in folder.glob("7th Grade Technology - T3 - 2026-* - Week * minutes.md"):
        if p.resolve() not in expected:
            p.unlink()
for month in ("September","October","November","December"):
    (DRAFTS/f"7° Technology - {month}.md").write_text(monthly(month))
(PKG/"00 Trimester Materials Index.md").write_text(index())
(PKG/"Class Visuals.html").write_text(visuals())
progress=G7/"Planning/Reviews/simple-classroom-progress.md"
if progress.exists():
    prior=progress.read_text().split("## 3rd Trimester",1)[0].rstrip()
    lines=[prior,"","## 3rd Trimester","","The date-aware sequence below is the active T3 plan. Class 1 means 7A Wednesday/7B Thursday (45 minutes); Class 2 means Friday (90 minutes)."," "]
    for r in rows:
        month,w,a,b,f,t45,t90,o45,o90,e45,e90,tag=r
        lines += [f"- Week {w}, Class 1 — 7A {a} / 7B {b}, 45 min: {t45}. {o45} Evidence: {e45}.",f"- Week {w}, Class 2 — 7A and 7B {f}, 90 min: {t90}. {o90} Evidence: {e90}."]
    lines += ["","STEAM Oct 5-23 includes Technology Daily Grade 4 and Daily Grade 3 for every student, regardless of assigned project subject. Dec 7-11 has make-up/administrative work only and no new Technology assessment."]
    progress.write_text("\n".join(lines)+"\n")
print("Rebuilt Grade 7 T3 calendar Markdown, notes, index, and visuals")
