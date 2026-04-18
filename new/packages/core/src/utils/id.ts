/**
 * Generates a unique ID for an MEI element.
 * Uses a prefix based on the tag name and a random string.
 */
export function generateId(prefix = "m"): string {
  const randomPart = Math.random().toString(36).substring(2, 9);
  return `${prefix}-${randomPart}`;
}
