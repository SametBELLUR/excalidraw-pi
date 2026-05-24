/**
 * Generates a random UUID.
 *
 * This is a wrapper around `window.crypto.randomUUID()` that falls back to a
 * simple polyfill for non-secure contexts (where `crypto.randomUUID` is not
 * available).
 *
 * @returns A new v4 UUID.
 */
export const randomUUID = (): string => {
  if (window.crypto?.randomUUID) {
    return window.crypto.randomUUID();
  }
  // A simple fallback for non-secure contexts or older browsers.
  // This is not cryptographically secure, but it's good enough for unique IDs.
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
};
