import "server-only";
import { z } from "zod";

const CHUCK_API_BASE = "https://api.chucknorris.io";

const jokeSchema = z.object({
  categories: z.array(z.string()).optional().default([]),
  icon_url: z.string(),
  id: z.string(),
  url: z.string(),
  value: z.string(),
});

const categoryListSchema = z.array(z.string());

const searchResultsSchema = z.object({
  total: z.number(),
  result: z.array(jokeSchema),
});

const NON_CATEGORY_VALUES = new Set(["all", "any", "random"]);

export type ChuckNorrisJoke = z.infer<typeof jokeSchema>;
export type ChuckNorrisSearchResults = z.infer<typeof searchResultsSchema>;

function normalizeCategory(category?: string) {
  const normalized = category?.trim().toLowerCase();

  if (!normalized || NON_CATEGORY_VALUES.has(normalized)) {
    return undefined;
  }

  return normalized;
}

async function fetchChuckNorris<T>(path: string, schema: z.ZodSchema<T>) {
  const response = await fetch(`${CHUCK_API_BASE}${path}`, {
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Chuck Norris API request failed with ${response.status}`);
  }

  const json = await response.json();
  return schema.parse(json);
}

export async function listCategories() {
  return fetchChuckNorris("/jokes/categories", categoryListSchema);
}

export async function getRandomJoke(category?: string) {
  const normalizedCategory = normalizeCategory(category);
  const params = new URLSearchParams();

  if (normalizedCategory) {
    params.set("category", normalizedCategory);
  }

  const query = params.toString();
  const path = query ? `/jokes/random?${query}` : "/jokes/random";

  return fetchChuckNorris(path, jokeSchema);
}

export async function searchJokes(query: string, limit = 5) {
  const params = new URLSearchParams({ query });
  const results = await fetchChuckNorris(
    `/jokes/search?${params.toString()}`,
    searchResultsSchema
  );

  return {
    total: results.total,
    result: results.result.slice(0, limit),
  };
}