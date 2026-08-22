import { Cite } from "@citation-js/core";
import "@citation-js/plugin-csl";

export const SOURCE_TYPES = {
  webpage: "Webpage",
  "article-journal": "Journal article",
  book: "Book",
  report: "Report",
  motion_picture: "Online video",
};

function clean(value) {
  return String(value || "").trim();
}

function parsePeople(value) {
  return clean(value).split(";").map(clean).filter(Boolean).map((name) => {
    if (name.includes(",")) {
      const [family, ...given] = name.split(",").map(clean);
      return { family, given: given.join(", ") };
    }
    const parts = name.split(/\s+/);
    return parts.length === 1 ? { family: parts[0] } : { family: parts.pop(), given: parts.join(" ") };
  });
}

function dateParts(value) {
  const normalized = clean(value);
  if (!/^\d{4}(?:-\d{2}){0,2}$/.test(normalized)) return undefined;
  const parts = normalized.split("-").map(Number);
  return parts.length ? { "date-parts": [parts] } : undefined;
}

function doiValue(value) {
  return clean(value).replace(/^https?:\/\/(?:dx\.)?doi\.org\//i, "");
}

export function buildReference(form, id = globalThis.crypto?.randomUUID?.() || `ref-${Date.now()}`) {
  const type = SOURCE_TYPES[form.type] ? form.type : "webpage";
  const authorKind = clean(form.authorKind) || "person";
  const author = authorKind === "organization"
    ? [{ literal: clean(form.organization) }]
    : authorKind === "person"
      ? parsePeople(form.authors)
      : [];
  const reference = {
    id,
    type,
    title: clean(form.title),
  };
  if (author.length && author.every((item) => item.literal || item.family)) reference.author = author;
  const issued = dateParts(form.date);
  if (issued) reference.issued = issued;
  const container = clean(form.container);
  const sameAsOrganizationAuthor = type === "webpage" && author[0]?.literal?.toLocaleLowerCase("en") === container.toLocaleLowerCase("en");
  if (container && !sameAsOrganizationAuthor) reference["container-title"] = container;
  if (clean(form.publisher)) reference.publisher = clean(form.publisher);
  if (clean(form.volume)) reference.volume = clean(form.volume);
  if (clean(form.issue)) reference.issue = clean(form.issue);
  if (clean(form.pages)) reference.page = clean(form.pages);
  const doi = doiValue(form.doi);
  if (doi) reference.DOI = doi;
  else if (clean(form.url)) reference.URL = clean(form.url);
  return reference;
}

export function validateReferenceForm(form) {
  const errors = {};
  if (!clean(form.title)) errors.title = "Enter the title exactly as it appears in the source.";
  if (form.authorKind === "person" && !clean(form.authors)) errors.authors = "Enter at least one author, or choose another author option.";
  if (form.authorKind === "organization" && !clean(form.organization)) errors.organization = "Enter the organization responsible for the source.";
  if (["webpage", "motion_picture"].includes(form.type) && !clean(form.url)) errors.url = "Enter the source's full webpage URL.";
  if (form.type === "article-journal" && !clean(form.container)) errors.container = "Enter the journal name.";
  if (["book", "report"].includes(form.type) && !clean(form.publisher)) errors.publisher = "Enter the publisher or issuing organization.";
  if (clean(form.date)) {
    const [year, month, day] = clean(form.date).split("-").map(Number);
    if (!/^\d{4}(?:-\d{2}){0,2}$/.test(clean(form.date)) || year < 1000 || month > 12 || month === 0 || day > 31 || day === 0) {
      errors.date = "Use YYYY, YYYY-MM, or YYYY-MM-DD.";
    }
  }
  if (clean(form.url) && !/^https?:\/\/\S+$/i.test(clean(form.url))) errors.url = "Use a complete URL beginning with http:// or https://.";
  return errors;
}

export function formatBibliography(referenceOrReferences) {
  const references = Array.isArray(referenceOrReferences) ? referenceOrReferences : [referenceOrReferences];
  if (!references.length) return "";
  return new Cite(references).format("bibliography", { format: "text", template: "apa", lang: "en-US" }).trim();
}

export function formatParentheticalCitation(reference) {
  return new Cite([reference]).format("citation", { format: "text", template: "apa", lang: "en-US" }).trim();
}

function yearLabel(reference) {
  return reference.issued?.["date-parts"]?.[0]?.[0] || "n.d.";
}

export function formatNarrativeCitation(reference) {
  const authors = reference.author || [];
  let name;
  if (authors[0]?.literal) name = authors[0].literal;
  else if (authors.length === 1) name = authors[0].family;
  else if (authors.length === 2) name = `${authors[0].family} and ${authors[1].family}`;
  else if (authors.length > 2) name = `${authors[0].family} et al.`;
  else name = `"${reference.title}"`;
  return `${name} (${yearLabel(reference)})`;
}

export function referenceSortKey(reference) {
  const first = reference.author?.[0];
  return clean(first?.literal || first?.family || reference.title).toLocaleLowerCase("en");
}
