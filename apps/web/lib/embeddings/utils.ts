import crypto from "node:crypto";

export function hashString(value: string) {
  return crypto.createHash("sha256").update(value).digest("hex").slice(0, 16);
}

export function toUtcIsoString(value?: string | Date | null) {
  if (!value) {
    return null;
  }

  const date = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.toISOString();
}

export function dedupeAndSort(values: string[]) {
  return Array.from(
    new Set(
      values
        .map((value) => value.trim())
        .filter(Boolean)
        .map((value) => value.toLowerCase())
    )
  ).sort();
}

export function estimateTokenCount(text: string) {
  return Math.max(1, Math.ceil(text.length / 4));
}

export function batchArray<T>(items: T[], batchSize: number) {
  const batches: T[][] = [];

  for (let index = 0; index < items.length; index += batchSize) {
    batches.push(items.slice(index, index + batchSize));
  }

  return batches;
}

export function collapseWhitespace(value: string) {
  return value.replace(/\r/g, "").replace(/\n{3,}/g, "\n\n").trim();
}