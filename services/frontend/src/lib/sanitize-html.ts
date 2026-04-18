import DOMPurify from "isomorphic-dompurify";

// Allowlist matches the AI prompt contract (processEmailWithAI + the thematic
// daily_summary prompt). Anything the model emits outside this set is stripped
// so malformed HTML or prompt-injection attempts can't reach the DOM.
const ALLOWED_TAGS = [
  "h3",
  "h4",
  "p",
  "ul",
  "ol",
  "li",
  "strong",
  "em",
  "a",
  "br",
];
const ALLOWED_ATTR = ["href", "target", "rel"];

export function sanitizeHtml(dirty: string | null | undefined): string {
  if (!dirty) return "";
  return DOMPurify.sanitize(dirty, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    ALLOW_DATA_ATTR: false,
  });
}
