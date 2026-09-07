import { marked } from "marked";

marked.setOptions({
  breaks: true,
  gfm: true,
});

/**
 * Renders the assistant's Markdown.
 *
 * ⚠️ The output is not sanitised and feeds `innerHTML` — behaviour carried
 * over as-is from the original `x-html`. See the security note in the PR.
 */
export function renderMarkdown(text: string): string {
  return marked.parse(text) as string;
}

/**
 * Replaces the Alpine `$truncate` plugin.
 *
 * Reproduces its exact semantics (verified against
 * @alpine-collective/toolkit-truncate): the comparison is against the
 * original string's length, so a string shorter than the limit gets no
 * ellipsis, and the ellipsis is U+2026.
 */
export function truncate(s: string, max: number): string {
  if (!max) return s;
  const cut = s.slice(0, max);
  return s.length <= cut.length ? cut : cut + "…";
}
