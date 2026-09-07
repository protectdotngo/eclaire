// Tiny in-memory TTL cache for GET API responses (per pod, same idea as the
// prompt/org cache in chatPrompt.ts). Bounded so org-specific keys can't grow
// without limit.
const store = new Map<string, { body: string; at: number }>();
const MAX_ENTRIES = 200;

export function getCached(key: string, ttlMs: number): string | null {
  const hit = store.get(key);
  if (hit && Date.now() - hit.at < ttlMs) {
    return hit.body;
  }
  return null;
}

export function setCached(key: string, body: string): void {
  if (store.size >= MAX_ENTRIES) {
    const oldest = store.keys().next().value;
    if (oldest !== undefined) store.delete(oldest);
  }
  store.set(key, { body, at: Date.now() });
}
