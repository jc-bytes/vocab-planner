import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const VAULT = path.join(ROOT, 'plans');
const NAV = path.join(VAULT, '00 Navigation');
const DATA_DIR = path.join(NAV, 'Schedule Data');
const WEEKLY_DIR = path.join(NAV, 'Weekly Classes');
const MONTHLY_DIR = path.join(NAV, 'Monthly Schedule');
const YEAR = 2026;
const MONTH_ORDER = {
  March: 3, April: 4, May: 5, June: 6, July: 7, August: 8,
  September: 9, October: 10, November: 11, December: 12,
};
const TRIMESTER_ORDER = {'1st Trimester': 1, '2nd Trimester': 2, '3rd Trimester': 3};
const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const args = new Set(process.argv.slice(2));
const dryRun = args.has('--dry-run');

function currentPanamaDate() {
  if (process.env.SCHEDULE_TODAY) return process.env.SCHEDULE_TODAY;
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Panama',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function readJsonYaml(file) {
  const text = fs.readFileSync(file, 'utf8')
    .split('\n')
    .filter(line => !line.trimStart().startsWith('#'))
    .join('\n');
  return JSON.parse(text);
}

function walk(dir) {
  const out = [];
  for (const ent of fs.readdirSync(dir, {withFileTypes: true})) {
    if (ent.name === '.obsidian') continue;
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) out.push(...walk(p));
    else if (ent.isFile()) out.push(p);
  }
  return out;
}

function ensureDir(dir) {
  if (!dryRun) fs.mkdirSync(dir, {recursive: true});
}

function writeFile(file, text) {
  if (dryRun) return;
  fs.mkdirSync(path.dirname(file), {recursive: true});
  fs.writeFileSync(file, text, 'utf8');
}

function relNoExt(file) {
  return path.relative(VAULT, file).replace(/\\/g, '/').replace(/\.md$/, '');
}

function wiki(file, alias) {
  return `[[${relNoExt(file)}|${alias}]]`;
}

function parseFrontmatter(text) {
  const match = text.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return {};
  const out = {};
  for (const line of match[1].split('\n')) {
    const m = line.match(/^([A-Za-z0-9_-]+):\s*(.*)$/);
    if (m) out[m[1]] = m[2].trim().replace(/^['"]|['"]$/g, '');
  }
  return out;
}

function normalizeDuration(duration) {
  if (/45/.test(duration)) return '45 minutes';
  if (/90/.test(duration)) return '90 minutes';
  return duration;
}

function weekNumber(week) {
  const m = String(week).match(/\d+/);
  return m ? Number(m[0]) : 999;
}

function isoDate(date) {
  return date.toISOString().slice(0, 10);
}

function parseLocalDate(iso) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function addDays(iso, days) {
  const d = parseLocalDate(iso);
  d.setUTCDate(d.getUTCDate() + days);
  return isoDate(d);
}

function dateInRange(date, start, end) {
  return date >= start && date <= end;
}

function dateLabel(iso) {
  const d = parseLocalDate(iso);
  return `${DAY_NAMES[d.getUTCDay()]}, ${d.toLocaleString('en-US', {month: 'long', timeZone: 'UTC'})} ${d.getUTCDate()}`;
}

function weekTitle(week) {
  const start = parseLocalDate(week.start);
  const end = parseLocalDate(week.end);
  const startMonth = start.toLocaleString('en-US', {month: 'long', timeZone: 'UTC'});
  const endMonth = end.toLocaleString('en-US', {month: 'long', timeZone: 'UTC'});
  const range = startMonth === endMonth
    ? `${startMonth} ${start.getUTCDate()}-${end.getUTCDate()} ${YEAR}`
    : `${startMonth} ${start.getUTCDate()}-${endMonth} ${end.getUTCDate()} ${YEAR}`;
  return range;
}

function monthNameFromDate(iso) {
  return parseLocalDate(iso).toLocaleString('en-US', {month: 'long', timeZone: 'UTC'});
}

function gradeDir(grade) {
  return `${grade}th Grade Technology`;
}

function sectionGrade(section) {
  return section.match(/TECH\s+(\d+)/)?.[1] ?? '';
}

function classTopic(file) {
  const text = fs.readFileSync(file, 'utf8');
  return parseFrontmatter(text).topic?.replace(/^"|"$/g, '') || path.basename(file, '.md');
}

function loadClassNotes() {
  const notes = walk(VAULT)
    .filter(file => file.endsWith('.md'))
    .filter(file => fs.readFileSync(file, 'utf8').startsWith('---\ntype: class-plan'))
    .map(file => {
      const fm = parseFrontmatter(fs.readFileSync(file, 'utf8'));
      return {
        file,
        grade: fm.grade,
        month: fm.month,
        trimester: fm.trimester,
        week: fm.week,
        weekNo: weekNumber(fm.week),
        duration: normalizeDuration(fm.duration),
        topic: fm.topic?.replace(/^"|"$/g, '') || path.basename(file, '.md'),
      };
    });
  notes.sort((a, b) =>
    Number(a.grade) - Number(b.grade)
    || (TRIMESTER_ORDER[a.trimester] ?? 99) - (TRIMESTER_ORDER[b.trimester] ?? 99)
    || (MONTH_ORDER[a.month] ?? 99) - (MONTH_ORDER[b.month] ?? 99)
    || a.weekNo - b.weekNo
    || a.duration.localeCompare(b.duration)
  );
  return notes;
}

function buildLessonMap(notes) {
  const lessonMap = new Map();
  const duplicates = [];
  for (const note of notes) {
    const key = `${note.grade}|${note.month}|${note.week}|${note.duration}`;
    if (lessonMap.has(key)) duplicates.push(key);
    lessonMap.set(key, note);
  }
  return {lessonMap, duplicates};
}

function exceptionFor(exceptions, date, block) {
  return exceptions.find(ex => {
    if (ex.date !== date) return false;
    if (ex.section && ex.section !== block.section) return false;
    if (ex.grade && String(ex.grade) !== String(block.grade)) return false;
    return true;
  });
}

function buildAssignments(rotation, schoolWeeks, exceptions, lessonMap) {
  const skippedBacklog = new Map();
  const assignments = [];
  const unmatched = [];
  const assignedFiles = new Set();

  for (const week of schoolWeeks) {
    for (let offset = 0; offset < 5; offset++) {
      const date = addDays(week.start, offset);
      const dayName = DAY_NAMES[parseLocalDate(date).getUTCDay()];
      const blocks = rotation.days[dayName] ?? [];
      for (const block of blocks) {
        const grade = String(block.grade ?? sectionGrade(block.section));
        const duration = normalizeDuration(block.duration);
        const planning = week.grade_weeks?.[grade];
        const plannedKey = planning ? `${grade}|${planning.month}|${planning.week}|${duration}` : '';
        const plannedNote = planning ? lessonMap.get(plannedKey) : null;
        const ex = exceptionFor(exceptions, date, {...block, grade, duration});
        const assignment = {week, date, dayName, block: {...block, grade, duration}, exception: ex, note: null};
        if (ex) {
          if (plannedNote) {
            const backlogKey = `${block.section}|${duration}`;
            if (!skippedBacklog.has(backlogKey)) skippedBacklog.set(backlogKey, []);
            skippedBacklog.get(backlogKey).push(plannedNote);
          }
          assignments.push(assignment);
          continue;
        }
        const backlogKey = `${block.section}|${duration}`;
        const backlog = skippedBacklog.get(backlogKey) ?? [];
        const note = backlog.length ? backlog.shift() : plannedNote;
        if (!note) {
          unmatched.push({
            date,
            section: block.section,
            duration,
            reason: planning ? `No lesson note for ${plannedKey}` : 'No planning week for grade',
          });
        } else {
          assignment.note = note;
          assignedFiles.add(note.file);
        }
        assignments.push(assignment);
      }
    }
  }

  return {assignments, unmatched, assignedFiles};
}

function renderBlock(assignment) {
  const {block, exception, note} = assignment;
  if (exception) {
    return `- ${block.start}-${block.end} | ${block.section} | ${exception.reason || 'No class'} | skipped`;
  }
  if (!note) {
    return `- ${block.start}-${block.end} | ${block.section} | ${block.duration} | No lesson assigned`;
  }
  return `- ${block.start}-${block.end} | ${block.section} | ${wiki(note.file, note.topic)}`;
}

function renderWeeklyPage(week, assignments) {
  const title = weekTitle(week);
  const lines = [
    '---',
    'type: weekly-teaching-schedule',
    `week_start: ${week.start}`,
    `week_end: ${week.end}`,
    `draft: ${week.draft ? 'true' : 'false'}`,
    'tags:',
    '  - obsidian-index',
    '  - weekly-teaching',
    '---',
    '',
    `# This Week - ${title}`,
    '',
    'Dated teaching blocks generated from the editable schedule data.',
    '',
    '## Quick Links',
    '',
    '- Dashboard: [[00 Navigation/Technology Plans Dashboard|Technology Plans Dashboard]]',
    '- Weekly rotation: [[00 Navigation/Weekly Schedule|Weekly Schedule]]',
    '- Month schedules index: [[00 Navigation/Monthly Schedule/Monthly Schedule Index|Monthly Schedule Index]]',
    '',
  ];

  for (let offset = 0; offset < 5; offset++) {
    const date = addDays(week.start, offset);
    const dayAssignments = assignments.filter(a => a.date === date);
    if (!dayAssignments.length) continue;
    lines.push(`## ${dateLabel(date)}`, '');
    for (const assignment of dayAssignments) lines.push(renderBlock(assignment));
    lines.push('');
  }
  return lines.join('\n');
}

function renderScheduleAudit({today, currentWeek, unmatched, duplicates, neverAssigned}) {
  const lines = [
    '---',
    'type: schedule-audit',
    `generated_for: ${today}`,
    'tags:',
    '  - obsidian-index',
    '  - schedule-audit',
    '---',
    '',
    '# Schedule Audit',
    '',
    'Generated by `scripts/generate-obsidian-schedule.mjs`.',
    '',
    '## Current Week',
    '',
    currentWeek ? `- ${weekTitle(currentWeek)} (${currentWeek.start} to ${currentWeek.end})` : '- No current school week matched today.',
    '',
    '## Unmatched Scheduled Blocks',
    '',
  ];
  if (!unmatched.length) {
    lines.push('- None');
  } else {
    lines.push('These are draft calendar gaps. Fix them by editing `school_weeks_2026.yml` or `schedule_exceptions_2026.yml`.');
    lines.push('');
    for (const item of unmatched) {
      lines.push(`- ${item.date} | ${item.section} | ${item.duration} | ${item.reason}`);
    }
  }
  lines.push('', '## Duplicate Lesson Keys', '');
  if (!duplicates.length) {
    lines.push('- None');
  } else {
    for (const key of duplicates) lines.push(`- ${key}`);
  }
  lines.push('', '## Class Notes Not Assigned', '');
  if (!neverAssigned.length) {
    lines.push('- None');
  } else {
    lines.push('Most of these should be intentional placeholders, buffers, or no-regular-class notes.');
    lines.push('');
    for (const note of neverAssigned) {
      lines.push(`- ${note.grade} ${note.month} ${note.week} ${note.duration}: ${note.topic}`);
    }
  }
  lines.push('');
  return lines.join('\n');
}

function renderWeeklyRotation(rotation, weekPages) {
  const lines = [
    '---',
    'type: weekly-schedule',
    'tags:',
    '  - obsidian-index',
    '  - weekly-teaching',
    '---',
    '',
    '# Weekly Schedule',
    '',
    'Recurring TECH teaching rotation from Notion Calendar. Dated pages are generated from this rotation plus the school-week map.',
    '',
    '## Week Pages',
    '',
  ];
  for (const page of weekPages) lines.push(`- ${wiki(page.file, page.label)}`);
  lines.push('');
  for (const day of ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday']) {
    lines.push(`## ${day}`, '');
    for (const block of rotation.days[day] ?? []) {
      lines.push(`- ${block.start}-${block.end} | ${block.section} | ${normalizeDuration(block.duration)}`);
    }
    lines.push('');
  }
  return lines.join('\n');
}

function renderMonthlyPages(assignments) {
  const byMonth = new Map();
  for (const assignment of assignments) {
    const d = parseLocalDate(assignment.date);
    const monthName = d.toLocaleString('en-US', {month: 'long', timeZone: 'UTC'});
    if (!byMonth.has(monthName)) byMonth.set(monthName, []);
    byMonth.get(monthName).push(assignment);
  }

  const pages = [];
  for (const [month, monthAssignments] of [...byMonth.entries()].sort((a, b) => MONTH_ORDER[a[0]] - MONTH_ORDER[b[0]])) {
    if (!MONTH_ORDER[month]) continue;
    const file = path.join(MONTHLY_DIR, `${month} Schedule - ${YEAR}.md`);
    pages.push({file, month});
    const lines = [
      '---',
      'type: monthly-teaching-schedule',
      `month: ${month}`,
      `year: ${YEAR}`,
      'tags:',
      '  - obsidian-index',
      '  - monthly-teaching',
      '---',
      '',
      `# ${month} Schedule - ${YEAR}`,
      '',
      'Dated class blocks for the month. Use the month classes page for the undated planning view.',
      '',
      '## Quick Links',
      '',
      `- Month classes: [[00 Navigation/Month Classes/${month} Classes - ${YEAR}|${month} Classes - ${YEAR}]]`,
      '- Dashboard: [[00 Navigation/Technology Plans Dashboard|Technology Plans Dashboard]]',
      '- Weekly rotation: [[00 Navigation/Weekly Schedule|Weekly Schedule]]',
      '',
    ];
    const dates = [...new Set(monthAssignments.map(a => a.date))].sort();
    for (const date of dates) {
      lines.push(`## ${dateLabel(date)}`, '');
      for (const assignment of monthAssignments.filter(a => a.date === date)) lines.push(renderBlock(assignment));
      lines.push('');
    }
    writeFile(file, lines.join('\n'));
  }
  return pages;
}

function renderMonthlyIndex(monthPages) {
  const lines = [
    '---',
    'type: monthly-schedule-index',
    `year: ${YEAR}`,
    'tags:',
    '  - obsidian-index',
    '  - monthly-teaching',
    '---',
    '',
    '# Monthly Schedule Index',
    '',
    'Dated teaching schedule pages generated from the weekly rotation and editable school-week map.',
    '',
  ];
  for (const page of monthPages) lines.push(`- ${wiki(page.file, `${page.month} Schedule - ${YEAR}`)}`);
  lines.push('');
  return lines.join('\n');
}

function updateDashboard({currentWeekFile, currentMonthFile, currentMonthName, auditFile}) {
  const dashboard = path.join(NAV, 'Technology Plans Dashboard.md');
  const text = fs.readFileSync(dashboard, 'utf8');
  const replacement = [
    '## Teach This Month',
    '',
    `- ${wiki(currentWeekFile, 'This Week')}`,
    `- ${wiki(currentMonthFile, `${currentMonthName} Schedule - ${YEAR}`)}`,
    `- [[00 Navigation/Month Classes/${currentMonthName} Classes - ${YEAR}|${currentMonthName} Classes - ${YEAR}]]`,
    '- [[00 Navigation/Weekly Schedule|Weekly Schedule]]',
    '- [[00 Navigation/Teaching Workflow|Teaching Workflow]]',
    '- [[00 Navigation/Start Here|Start Here]]',
  ].join('\n');
  let next = text.replace(/## Teach This Month[\s\S]*?(?=\n## All Month Pages)/, `${replacement}\n\n`);
  if (!next.includes('Schedule Audit')) {
    next = next.replace(
      '- [[00 Navigation/Indexes/All Class Files Index|All Class Files Index]]',
      `- [[00 Navigation/Indexes/All Class Files Index|All Class Files Index]]\n- ${wiki(auditFile, 'Schedule Audit')}`
    );
  }
  writeFile(dashboard, next);
  writeFile(path.join(NAV, 'Start Here.md'), next);
}

function updateWorkflow() {
  const workflow = path.join(NAV, 'Teaching Workflow.md');
  const text = fs.readFileSync(workflow, 'utf8');
  const next = text
    .replace('Open [[00 Navigation/This Week - June 8-12 2026|This Week - June 8-12 2026]] during class time.', 'Open the current `This Week` page from the dashboard during class time.')
    .replace('Use the month page, currently [[00 Navigation/Month Classes/June Classes - 2026|June Classes - 2026]], for broader planning.', 'Use the monthly schedule for dated teaching blocks and the month classes page for broader planning.');
  writeFile(workflow, next);
}

function main() {
  const today = currentPanamaDate();
  const rotation = readJsonYaml(path.join(DATA_DIR, 'weekly_rotation_2026.yml'));
  const schoolWeeks = readJsonYaml(path.join(DATA_DIR, 'school_weeks_2026.yml')).weeks;
  const exceptions = readJsonYaml(path.join(DATA_DIR, 'schedule_exceptions_2026.yml')).exceptions ?? [];
  const notes = loadClassNotes();
  const {lessonMap, duplicates} = buildLessonMap(notes);
  const {assignments, unmatched, assignedFiles} = buildAssignments(rotation, schoolWeeks, exceptions, lessonMap);
  const neverAssigned = notes.filter(note => !assignedFiles.has(note.file));

  const weekPages = [];
  ensureDir(WEEKLY_DIR);
  ensureDir(MONTHLY_DIR);
  for (const week of schoolWeeks) {
    const file = path.join(WEEKLY_DIR, `${weekTitle(week)}.md`);
    weekPages.push({file, label: `This Week - ${weekTitle(week)}`});
    writeFile(file, renderWeeklyPage(week, assignments.filter(a => a.week === week)));
  }

  const currentWeek = schoolWeeks.find(week => dateInRange(today, week.start, week.end))
    ?? schoolWeeks.find(week => today < week.start)
    ?? schoolWeeks.at(-1);
  const currentWeekArchive = weekPages.find(page => page.file.includes(weekTitle(currentWeek))) ?? weekPages[0];
  const currentWeekShortcut = path.join(NAV, 'This Week.md');
  if (!dryRun) {
    for (const file of fs.readdirSync(NAV)) {
      if (/^This Week - .+\.md$/.test(file)) fs.rmSync(path.join(NAV, file), {force: true});
    }
  }
  writeFile(currentWeekShortcut, renderWeeklyPage(currentWeek, assignments.filter(a => a.week === currentWeek)));
  writeFile(path.join(NAV, 'Weekly Schedule.md'), renderWeeklyRotation(rotation, weekPages));
  const monthPages = renderMonthlyPages(assignments);
  writeFile(path.join(MONTHLY_DIR, 'Monthly Schedule Index.md'), renderMonthlyIndex(monthPages));
  const currentMonthName = monthNameFromDate(today);
  const currentMonth = monthPages.find(page => page.month === currentMonthName) ?? monthPages.find(page => page.month === 'June');
  const auditFile = path.join(NAV, 'Schedule Audit.md');
  writeFile(auditFile, renderScheduleAudit({today, currentWeek, unmatched, duplicates, neverAssigned}));
  if (currentWeekArchive && currentMonth) updateDashboard({
    currentWeekFile: currentWeekShortcut,
    currentMonthFile: currentMonth.file,
    currentMonthName: currentMonth.month,
    auditFile,
  });
  updateWorkflow();

  console.log(JSON.stringify({
    dryRun,
    today,
    currentWeek: currentWeek ? `${currentWeek.start} to ${currentWeek.end}` : null,
    generatedBlocks: assignments.length,
    skippedBlocks: assignments.filter(a => a.exception).length,
    unmatchedBlocks: unmatched.length,
    unmatchedBlocksSample: unmatched.slice(0, 20),
    duplicateLessonKeys: duplicates.length,
    duplicateLessonKeySample: duplicates.slice(0, 20),
    neverAssignedClassNotes: neverAssigned.length,
    neverAssignedSample: neverAssigned.slice(0, 20).map(note => `${note.grade} ${note.month} ${note.week} ${note.duration}: ${note.topic}`),
    weeklyPages: weekPages.length,
    monthlyPages: monthPages.length,
  }, null, 2));
}

main();
