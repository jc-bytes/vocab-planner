import assert from "node:assert/strict";
import test from "node:test";
import { countWords, extractKeywordCount, findFirstPerson, runScientificChecks } from "../src/checks.js";

test("counts words and keyword lists", () => {
  assert.equal(countWords("A short scientific sentence."), 4);
  assert.equal(extractKeywordCount("Keywords: filters, turbidity, charcoal"), 3);
  assert.equal(extractKeywordCount("No keyword line"), null);
});

test("finds first-person scientific voice", () => {
  assert.deepEqual(findFirstPerson("We recorded our results."), ["we", "our"]);
});

test("abstract check enforces word and keyword limits", () => {
  const findings = runScientificChecks("abstract-keywords", "A short abstract.\nKeywords: water, filters, turbidity");
  assert.ok(findings.some((item) => item.title === "Abstract length" && item.tone === "good"));
  assert.ok(findings.some((item) => item.title === "Keywords" && item.tone === "good"));
});

test("methodology check requests safety evidence", () => {
  const findings = runScientificChecks("methodology", "The sample was measured and compared in three trials.");
  assert.ok(findings.some((item) => item.title === "Safety or ethics" && item.tone === "warn"));
});
