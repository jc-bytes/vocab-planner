import { validateLesson } from './validate.js';
import { tableHtml } from './content.js';

const result = (name, status, detail) => ({name, status, detail});
const escape = value => String(value).replace(/[&<>"']/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));

// Keep this check focused on problems an activity author can fix in site.js,
// lesson.js, steps/, or by rebuilding the printable version.
export function checkActivity(lesson, printable = '') {
  const checks = [];
  try {
    validateLesson(lesson);
    checks.push(result('Activity setup', 'pass', 'Title, step IDs, answers, and PDF fields are valid.'));
  } catch (error) {
    checks.push(result('Activity setup', 'fail', `${error.message} Check site.js or the named step.`));
  }

  const sections = Array.isArray(lesson?.sections) ? lesson.sections : [];
  const position = stage => sections.findIndex(section => section?.stage === stage);
  const model = position('model'), guided = position('guided'), independent = position('independent');
  const firstPractice = sections.findIndex(section => ['guided','practice','independent'].includes(section?.stage));
  const review = position('review');
  if (model < 0 || guided < 0 || independent < 0) {
    checks.push(result('Teaching order', 'review', 'Mark a model, guided step, and independent step so the order can be checked. See the example in steps/.'));
  } else if (model > firstPractice || guided < model || independent < guided || review >= 0 && review !== sections.length - 1) {
    checks.push(result('Teaching order', 'fail', 'Put the model before guided work, independent work after guided work, and review last. Change the order in lesson.js.'));
  } else {
    checks.push(result('Teaching order', 'pass', 'Students see a model, guided work, and independent work in that order.'));
  }

  const questions = new Map();
  const repeated = [];
  for (const section of sections) {
    const question = section?.authoring?.question?.trim();
    if (!question) continue;
    const key = question.replace(/\s+/g, ' ').toLowerCase();
    if (questions.has(key)) repeated.push(`${questions.get(key)} and ${section.id}`);
    else questions.set(key, section.id);
  }
  checks.push(repeated.length
    ? result('Repeated questions', 'review', `Check whether these steps intentionally ask the same question: ${repeated.join(', ')}.`)
    : result('Repeated questions', 'pass', 'Common step patterns have distinct questions.'));

  const pdfProblems = [];
  for (const section of sections) {
    const question = section?.authoring?.question;
    if (!question) continue;
    const table=section.authoring.table;
    if (!section.pdf?.prompt?.includes(question) || section.pdf?.items?.[0]?.label !== question ||
      table && JSON.stringify(section.pdf?.visual?.rows) !== JSON.stringify(table.rows)) pdfProblems.push(section.id);
  }
  checks.push(pdfProblems.length
    ? result('PDF content', 'fail', `The PDF question or table differs from the student step in: ${pdfProblems.join(', ')}. Use the step pattern or fix the PDF task in that step file.`)
    : result('PDF content', 'pass', 'Common step questions and tables match their PDF tasks.'));

  if (!printable) {
    checks.push(result('Paper version', 'fail', 'Run npm run build to create printable-fallback.html.'));
  } else {
    const missing = [];
    if (!printable.includes(`<title>${escape(lesson?.title || '')}</title>`)) missing.push('activity title');
    for (const section of sections) {
      if (section?.kind === 'review') continue;
      const start = printable.indexOf(`<section data-step="${escape(section.id)}">`);
      const body = start < 0 ? '' : printable.slice(start, printable.indexOf('</section>', start));
      if (!body.includes(escape(section.title)) || section.authoring?.table && !body.includes(tableHtml(section.authoring.table))) missing.push(section.id);
      const question = section?.authoring?.question;
      if (question && !body.includes(escape(question)) && !missing.includes(section.id)) missing.push(section.id);
    }
    checks.push(missing.length
      ? result('Paper version', 'fail', `The paper version is missing current content (${missing.join(', ')}). Run npm run build, then check again.`)
      : result('Paper version', 'pass', 'The paper title, questions, and tables match the activity.'));
  }
  return checks;
}
