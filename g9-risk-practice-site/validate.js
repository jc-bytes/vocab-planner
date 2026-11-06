export function validateLesson(lesson) {
  const fail = message => { throw new Error(`Lesson: ${message}`); };
  const validSource = source => source && typeof source === 'object' && (
    (source.kind === 'field' && typeof source.name === 'string' && source.name.trim()) ||
    (['choice','inline-check'].includes(source.kind) && Number.isInteger(source.index) && source.index >= 0)
  );
  const sourceExists = (source, page) => {
    if (!validSource(source)) return false;
    if (source.kind === 'field') return page.kind === 'form' && page.fields?.some(field => field.name === source.name);
    if (source.kind === 'choice') return page.kind === 'choice' && source.index < page.items.length;
    return page.kind === 'html' && source.index < [...(page.html||'').matchAll(/<t3-check\b/gi)].length;
  };
  const validatePdf = (page) => {
    const pdf = page.pdf;
    if (!pdf) return;
    if (typeof pdf !== 'object' || Array.isArray(pdf)) fail(`${page.id} pdf instructions must be an object`);
    if (pdf.prompt !== undefined && typeof pdf.prompt !== 'string') fail(`${page.id} PDF prompt must be text`);
    if (pdf.visual) {
      const visual = pdf.visual;
      if (visual.type === 'table') {
        if (!Array.isArray(visual.columns) || visual.columns.length < 1 || visual.columns.length > 5 || !Array.isArray(visual.rows) || visual.rows.some(row => !Array.isArray(row) || row.length !== visual.columns.length)) fail(`${page.id} PDF table needs 1-5 columns and matching rows`);
      } else if (visual.type === 'grid') {
        if (!Number.isInteger(visual.columns) || visual.columns < 1 || visual.columns > 24 || !Array.isArray(visual.values) || !visual.values.length || visual.values.length > 120 || (visual.palette && !Array.isArray(visual.palette))) fail(`${page.id} PDF grid needs columns and 1-120 cell values`);
      } else if (visual.type === 'dot-groups') {
        if (!Array.isArray(visual.groups) || !visual.groups.length || visual.groups.length > 12 || visual.groups.some(group => typeof group.label !== 'string' || !Number.isInteger(group.dots) || group.dots < 0 || group.dots > 40)) fail(`${page.id} PDF dot groups need labels and 0-40 dots`);
      } else fail(`${page.id} has an unsupported PDF visual type`);
    }
    if (pdf.items !== undefined && !Array.isArray(pdf.items)) fail(`${page.id} PDF items must be a list`);
    for (const item of pdf.items || []) {
      if (!item.label?.trim()) fail(`${page.id} PDF items need a label`);
      if (item.type === 'response') {
        if (!sourceExists(item.source,page)) fail(`${page.id} PDF response needs a valid source`);
      } else if (item.type === 'calculation') {
        if (!sourceExists(item.multiplicationSource,page) || !sourceExists(item.totalSource,page)) fail(`${page.id} PDF calculation needs multiplication and total sources`);
      } else fail(`${page.id} has an unsupported PDF item type`);
    }
  };
  for (const key of ['id','slug','title','storageKey']) if (!lesson[key]?.trim()) fail(`${key} is required`);
  if (!Array.isArray(lesson.sections) || !lesson.sections.length) fail('add a page');
  const ids = new Set();
  for (const page of lesson.sections) {
    if (!page.id || ids.has(page.id)) fail(`page ID is missing or repeated: ${page.id}`);
    ids.add(page.id);
    if (!page.title) fail(`${page.id} needs a title`);
    if (!['html','choice','form','review'].includes(page.kind)) fail(`unsupported page kind: ${page.kind}`);
    if (page.kind === 'html' && !page.html?.trim()) fail(`${page.id} needs content`);
    if (page.kind === 'form') {
      if (!page.fields?.length) fail(`${page.id} needs a field`);
      const names = new Set();
      for (const field of page.fields) {
        if (!field.name || names.has(field.name) || !field.label) fail(`${page.id} needs unique named and labelled fields`);
        names.add(field.name);
      }
    }
    if (page.kind === 'choice') {
      if (!page.items?.length) fail(`${page.id} needs a question`);
      for (const item of page.items) {
        if (!item.question || !item.retry || !item.options?.length || !Number.isInteger(item.answer) || item.answer < 0 || item.answer >= item.options.length) fail(`${page.id} has an invalid question, answer or hint`);
      }
    }
    validatePdf(page);
  }
  return lesson;
}
