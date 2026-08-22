import assert from "node:assert/strict";
import test from "node:test";
import {
  buildReference,
  formatBibliography,
  formatNarrativeCitation,
  formatParentheticalCitation,
  validateReferenceForm,
} from "../src/references.js";

const webpage = {
  type: "webpage",
  authorKind: "organization",
  organization: "Food and Agriculture Organization of the United Nations",
  date: "2020-09-29",
  title: "Food loss and waste must be reduced for greater food security and environmental sustainability",
  container: "",
  url: "https://www.fao.org/example",
  doi: "",
};

test("builds and formats an organization-authored APA webpage reference", () => {
  const reference = buildReference(webpage, "fao");
  assert.deepEqual(reference.issued, { "date-parts": [[2020, 9, 29]] });
  assert.match(formatBibliography(reference), /^Food and Agriculture Organization of the United Nations\. \(2020, September 29\)\./);
  assert.equal(formatParentheticalCitation(reference), "(Food and Agriculture Organization of the United Nations, 2020)");
  assert.equal(formatNarrativeCitation(reference), "Food and Agriculture Organization of the United Nations (2020)");
});

test("parses multiple personal authors and normalizes a DOI URL", () => {
  const reference = buildReference({
    ...webpage,
    type: "article-journal",
    authorKind: "person",
    authors: "Rivera, Ana; Chen, David",
    organization: "",
    container: "Journal of School Science",
    url: "",
    doi: "https://doi.org/10.1234/example",
  }, "journal");
  assert.deepEqual(reference.author, [{ family: "Rivera", given: "Ana" }, { family: "Chen", given: "David" }]);
  assert.equal(reference.DOI, "10.1234/example");
  assert.equal(formatNarrativeCitation(reference), "Rivera and Chen (2020)");
});

test("requires the fields needed for the selected source type", () => {
  const errors = validateReferenceForm({ type: "webpage", authorKind: "person", authors: "", title: "", date: "2020-99", url: "example.com" });
  assert.ok(errors.title);
  assert.ok(errors.authors);
  assert.ok(errors.date);
  assert.ok(errors.url);
});

test("accepts a year-only publication date", () => {
  const reference = buildReference({ ...webpage, date: "2020" }, "year-only");
  assert.deepEqual(reference.issued, { "date-parts": [[2020]] });
  assert.equal(validateReferenceForm({ ...webpage, date: "2020" }).date, undefined);
});
