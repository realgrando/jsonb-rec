/**
 * Deterministic Slugifier for Dynamic Field Keys
 */

export function slugifyFieldKey(text: string): string {
  return text
    .toString()
    .normalize('NFD') // Split accented characters
    .replace(/[\u0300-\u036f]/g, '') // Remove accents
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9_\s-]/g, '') // Remove non-alphanumeric chars
    .replace(/[\s-]+/g, '_') // Replace spaces and dashes with single underscore
    .replace(/^_+|_+$/g, ''); // Trim leading/trailing underscores
}
