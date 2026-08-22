export const practice = (id, short, title, summary, items, minutes = 20) => ({ id, short, title, summary, minutes, kind: "choice", items });

export const item = (title, question, options, answer, skill, feedback, retry, visual = "") => ({
  title, question, options, answer, skill, feedback, retry, visual,
});

export const history = {
  id: "history",
  short: "History & export",
  title: "Review and export your practice",
  summary: "Recreate saved attempts and download one practice report.",
  minutes: 10,
  kind: "review",
};
