// The shared renderer supplies the visual style, student identity, and page breaks.
// This module maps a step's own question and table into its PDF task.
export const taskPdf = ({prompt, table, label, source}) => ({
  prompt,
  visual: {type:'table', caption:table.caption, columns:table.columns, rows:table.rows},
  items: [{type:'response', label, source}],
});
