const REQUIRED_HEADINGS = [
  "abstract",
  "keywords",
  "research question",
  "theoretical framework",
  "problem statement",
  "general objective",
  "specific objectives",
  "hypothesis",
  "variables",
  "methodology",
  "results",
  "analysis",
  "discussion",
  "conclusions",
  "limitations",
  "recommendations",
  "references",
  "appendices",
];

const SECTION_TERMS = {
  "research-question": ["?"],
  objectives: ["to "],
  "hypothesis-variables": ["independent", "dependent", "control"],
  methodology: ["material", "procedure", "measure", "data", "safety"],
  results: ["table", "figure", "%", "mean", "average", "total", "trial"],
  "analysis-discussion": ["because", "suggest", "support", "source", "study"],
  conclusions: ["found", "result", "support", "question"],
  limitations: ["limitation", "affect", "future", "improve"],
  references: ["http", "doi", "("],
};

export function countWords(text) {
  return (text.trim().match(/[\p{L}\p{N}]+(?:['’-][\p{L}\p{N}]+)*/gu) || []).length;
}

export function countSentences(text) {
  return (text.trim().match(/[^.!?]+[.!?]+|[^.!?]+$/g) || []).filter((item) => item.trim()).length;
}

export function extractKeywordCount(text) {
  const match = text.match(/keywords?\s*:\s*([^\n]+)/i);
  if (!match) return null;
  return match[1].split(/[,;]/).map((item) => item.trim()).filter(Boolean).length;
}

export function findFirstPerson(text) {
  return [...new Set((text.match(/\b(I|me|my|mine|we|us|our|ours)\b/gi) || []).map((word) => word.toLowerCase()))];
}

function result(tone, title, detail) {
  return { tone, title, detail };
}

function containsAny(text, terms) {
  const lower = text.toLowerCase();
  return terms.some((term) => lower.includes(term));
}

function objectiveCount(text) {
  return (text.match(/(?:^|\n)\s*(?:[-•*]|\d+[.)])?\s*to\s+[a-z]+/gim) || []).length;
}

export function runScientificChecks(sectionId, rawText) {
  const text = rawText.trim();
  if (!text) return [result("warn", "Add a draft", "Paste the current section from your Google Doc before running the check.")];

  const findings = [];
  const words = countWords(text);
  const sentences = countSentences(text);
  const firstPerson = findFirstPerson(text);
  const avgSentence = sentences ? Math.round(words / sentences) : words;

  findings.push(result("good", "Draft detected", `${words} words in ${sentences} sentence${sentences === 1 ? "" : "s"}.`));

  if (firstPerson.length) {
    findings.push(result("warn", "Check scientific voice", `Found ${firstPerson.join(", ")}. The official format requests impersonal writing. Rewrite only where the sentence can stay clear.`));
  } else {
    findings.push(result("good", "Scientific voice", "No first-person pronouns were found."));
  }

  if (avgSentence > 28) {
    findings.push(result("warn", "Long sentences", `The average sentence has about ${avgSentence} words. Split sentences that contain more than one main idea.`));
  }

  const certainty = [...new Set(text.match(/\b(proves?|proven|everyone|always|never|guarantees?)\b/gi) || [])];
  if (certainty.length) {
    findings.push(result("warn", "Check claim strength", `Review ${certainty.join(", ")}. Scientific claims should match the limits of the sample and method.`));
  }

  if (sectionId === "research-question") {
    findings.push(text.endsWith("?")
      ? result("good", "Question form", "The draft ends with a question mark.")
      : result("warn", "Question form", "Write the research question as one direct question ending with a question mark."));
    if (words > 35) findings.push(result("warn", "Focus the question", "The question is long. Remove background information that belongs in the problem statement."));
  }

  if (sectionId === "objectives") {
    const count = objectiveCount(text);
    findings.push(count >= 3 && count <= 4
      ? result("good", "Objective count", `Found ${count} objectives, which fits one general plus two or three specific objectives.`)
      : result("warn", "Objective count", `Found ${count}. Use one general objective and two or three specific objectives, each beginning with To plus an action verb.`));
  }

  if (sectionId === "hypothesis-variables") {
    for (const [label, term] of [["Independent variable", "independent"], ["Dependent variable", "dependent"], ["Controlled variables", "control"]]) {
      findings.push(text.toLowerCase().includes(term)
        ? result("good", label, `${label} wording was found.`)
        : result("warn", label, `Name the ${label.toLowerCase()} or explain why it does not apply to this study.`));
    }
  }

  if (sectionId === "methodology") {
    const checks = [
      ["Participants, sample, or materials", ["participant", "sample", "material"]],
      ["Measurement", ["measure", "record", "scale", "sensor", "survey"]],
      ["Repetition or sample size", ["trial", "repeat", "participant", "sample size"]],
      ["Safety or ethics", ["safety", "consent", "permission", "allerg", "hygiene", "risk"]],
      ["Analysis plan", ["average", "percentage", "compare", "graph", "table", "analysis"]],
    ];
    for (const [label, terms] of checks) {
      findings.push(containsAny(text, terms)
        ? result("good", label, `The draft includes language related to ${label.toLowerCase()}. Check that the detail is specific.`)
        : result("warn", label, `Add specific information about ${label.toLowerCase()}.`));
    }
  }

  if (sectionId === "results") {
    const hasNumber = /\b\d+(?:\.\d+)?\s*(?:%|cm|mm|mL|L|g|kg|°C|participants?|trials?)?\b/i.test(text);
    findings.push(hasNumber
      ? result("good", "Measured evidence", "The draft contains numerical evidence. Verify every value against the logbook or data table.")
      : result("warn", "Measured evidence", "Add the relevant counts, measurements, units, averages, or percentages."));
    if (containsAny(text, ["because", "therefore", "this means", "caused by"])) {
      findings.push(result("warn", "Results or discussion?", "Explanations such as because or therefore usually belong in Analysis and discussion."));
    }
  }

  if (sectionId === "abstract-keywords") {
    findings.push(words <= 250
      ? result("good", "Abstract length", `${words} words. The maximum is 250.`)
      : result("warn", "Abstract length", `${words} words. Cut at least ${words - 250} words.`));
    const keywordCount = extractKeywordCount(text);
    findings.push(keywordCount === null
      ? result("warn", "Keywords", "Add a line beginning with Keywords: followed by three to five terms.")
      : keywordCount >= 3 && keywordCount <= 5
        ? result("good", "Keywords", `Found ${keywordCount} keywords.`)
        : result("warn", "Keywords", `Found ${keywordCount} keywords. Use three to five.`));
    if (/\([A-Za-z][^)]*(?:19|20)\d{2}[^)]*\)/.test(text)) findings.push(result("warn", "Citation in abstract", "The abstract should not contain reference citations."));
  }

  if (sectionId === "full-report") {
    const lower = text.toLowerCase();
    const missing = REQUIRED_HEADINGS.filter((heading) => !lower.includes(heading));
    findings.push(missing.length
      ? result("warn", "Required headings", `Check these missing or differently named sections: ${missing.join(", ")}.`)
      : result("good", "Required headings", "All expected section names were found."));
  }

  const expectedTerms = SECTION_TERMS[sectionId];
  if (expectedTerms && !containsAny(text, expectedTerms)) {
    findings.push(result("note", "Section vocabulary", "The draft may be missing the concrete terms normally used in this section. Review the section checklist rather than adding words mechanically."));
  }

  return findings;
}
