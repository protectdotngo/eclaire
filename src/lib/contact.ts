/**
 * Contact helpers, deduplicated.
 *
 * These three functions existed identically in `mapSearchState.ts` and in the
 * inline <script> of `FilteredOrgList.astro`.
 */

export function isEmail(contact: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact.trim());
}

export function isPhone(contact: string): boolean {
  const digitsOnly = contact.trim().replace(/[\s().-]/g, "");
  return /^\+?\d{7,15}$/.test(digitsOnly);
}

export function formatContactHref(contact: string): string {
  const trimmed = contact.trim();
  if (isEmail(trimmed)) {
    return `mailto:${trimmed}`;
  }
  if (isPhone(trimmed)) {
    return `tel:${trimmed.replace(/[\s().-]/g, "")}`;
  }
  // The original http(s) branch already returned the value as-is, exactly
  // like the default case.
  return trimmed;
}
