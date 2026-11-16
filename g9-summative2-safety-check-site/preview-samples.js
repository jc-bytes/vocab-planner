// Fictional answers for author review. These are never written to browser storage.
export function previewLesson(lesson) {
  return {...lesson, sections: lesson.sections.map(section => ({
    ...section,
    inlineChecks: section.kind === 'html' && section.authoring?.question
      ? [{key:`preview:${section.id}`,label:section.authoring.question}]
      : [],
  }))};
}

export function sampleState(lesson, mode) {
  if (!['empty','partial','filled'].includes(mode)) throw new Error('Unknown preview state');
  const state = {identity:{},responses:{},attempts:[],choiceDrafts:{},inlineAnswers:{}};
  if (mode === 'empty') return state;
  state.identity = {firstName:'Sample',lastName:'Learner',grade:'6A'};
  let recorded = 0;
  for (const section of lesson.sections) {
    if (section.kind === 'review' || mode === 'partial' && recorded >= 2) continue;
    if (section.kind === 'form') {
      state.responses[section.id] = Object.fromEntries(section.fields.map(field => [field.name,
        'Sample student response for layout review. This longer sentence checks how the PDF wraps text.']));
      recorded++;
    } else if (section.kind === 'choice') {
      section.items.forEach((item,index) => {state.choiceDrafts[`${section.id}:${index}`] = 0;});
      recorded++;
    } else if (section.inlineChecks?.length) {
      for (const check of section.inlineChecks) state.inlineAnswers[check.key] = section.authoring?.options?.[0] ?? 'Sample answer';
      recorded++;
    }
  }
  return state;
}
