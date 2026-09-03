const TRAILING_ELLIPSIS = /(?:\.{3}|\u2026)\s*$/u;
const LAST_SENTENCE_END = /[.!?](?=\s|$)/gu;

/** Removes a catalog sentence that was cut off and marked with an ellipsis. */
export function cleanProductDescription(value: string): string {
  const description = value
    .replace(/&#x20;|&#32;|&nbsp;/giu, " ")
    .replace(/\s+/gu, " ")
    .trim();

  if (!TRAILING_ELLIPSIS.test(description)) {
    return description;
  }

  const withoutCutoff = description.replace(TRAILING_ELLIPSIS, "").trimEnd();
  const lastSentenceEnd = [...withoutCutoff.matchAll(LAST_SENTENCE_END)].at(-1);

  if (lastSentenceEnd?.index === undefined) {
    return withoutCutoff;
  }

  return withoutCutoff.slice(0, lastSentenceEnd.index + 1).trim();
}
