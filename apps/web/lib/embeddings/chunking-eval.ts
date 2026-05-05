import { embedMany } from "@/lib/ai";
import { CHUNKING_EVAL_TOP_K, EMBEDDING_MODEL_ID } from "./config";
import { chunkDocument } from "./chunking";
import { normalizeScrapedPage } from "./normalize";
import type { ChunkStrategy, ChunkingEvalQuery, ChunkingEvalResult, ScrapedPage } from "./types";

type ChunkingEvalBenchmark = {
  id: string;
  label: string;
  url: string;
  sourceType: "official_docs" | "official_updates" | "community_items";
  sourceName: string;
  queries: ChunkingEvalQuery[];
};

export const MAP_CONDITIONS_EVAL_BENCHMARK: ChunkingEvalBenchmark = {
  id: "map-conditions",
  label: "Map Conditions",
  url: "https://arcraiders.com/map-conditions",
  sourceType: "official_docs",
  sourceName: "Official ARC Raiders site",
  queries: [
  {
    id: "map-conditions-overview",
    query: "What are map conditions in ARC Raiders?",
    expectedTerms: ["map", "condition"],
  },
  {
    id: "weather-impacts",
    query: "How do environmental conditions change a raid?",
    expectedTerms: ["environment", "raid"],
  },
  {
    id: "visibility",
    query: "Which conditions affect visibility or sightlines?",
    expectedTerms: ["visibility", "sight"],
  },
  {
    id: "movement",
    query: "Do map conditions change movement or traversal?",
    expectedTerms: ["movement", "traversal"],
  },
  {
    id: "planning",
    query: "Why should players plan loadouts around conditions?",
    expectedTerms: ["loadout", "condition"],
  },
  {
    id: "risk",
    query: "What risks do conditions introduce during extraction?",
    expectedTerms: ["risk", "extract"],
  },
  {
    id: "strategy",
    query: "How do conditions change combat strategy?",
    expectedTerms: ["combat", "strategy"],
  },
  {
    id: "loot",
    query: "Can map conditions change how players think about loot runs?",
    expectedTerms: ["loot", "run"],
  },
  {
    id: "teamplay",
    query: "How can teams coordinate better around map conditions?",
    expectedTerms: ["team", "condition"],
  },
  {
    id: "adaptation",
    query: "What does the page say about adapting to changing conditions?",
    expectedTerms: ["adapt", "condition"],
  },
  ],
};

export const PATCH_NOTES_EVAL_BENCHMARK: ChunkingEvalBenchmark = {
  id: "riven-tides-patch-notes-1-26-0",
  label: "Riven Tides Patch Notes 1.26.0",
  url: "https://arcraiders.com/news/riven-tides-patch-notes-1-26-0",
  sourceType: "official_updates",
  sourceName: "Official ARC Raiders updates",
  queries: [
    {
      id: "beachcombing-condition",
      query: "What does the Beachcombing Map Condition add to Riven Tides?",
      expectedTerms: ["beachcombing map condition", "buried treasure"],
    },
    {
      id: "weapon-economy-goal",
      query: "What weapon economy problem were these balance changes trying to solve?",
      expectedTerms: ["weapon accumulation", "weapon attrition"],
    },
    {
      id: "repair-on-upgrade",
      query: "How does the new repair on upgrade feature work for damaged weapons?",
      expectedTerms: [
        "repair on upgrade",
        "repair 25 of the weapons max durability",
      ],
    },
    {
      id: "durability-loss-shot",
      query: "What changed for legendary weapons in durability loss on shot?",
      expectedTerms: ["legendary weapons", "10 durability loss on shot"],
    },
    {
      id: "dam-battlegrounds-arc",
      query: "What changed about Comets in the Dam Battlegrounds?",
      expectedTerms: ["removed comets", "dam battlegrounds"],
    },
    {
      id: "photoelectric-cloak-tradeoff",
      query: "Why was the Photoelectric Cloak changed and what tradeoff did the patch introduce?",
      expectedTerms: ["photoelectric cloak", "intentionality between uses"],
    },
    {
      id: "bettina-rationale",
      query: "Why was the Bettina buffed in this patch?",
      expectedTerms: ["bettina", "closer to its rarity"],
    },
    {
      id: "voice-chat-noise-suppression",
      query: "What was added to voice chat for clearer communication?",
      expectedTerms: ["noise suppression option", "voice chat"],
    },
    {
      id: "expedition-late-departure",
      query: "What expedition fix introduced a late departure option?",
      expectedTerms: ["late departure", "expedition"],
    },
    {
      id: "off-the-radar-known-issue",
      query: "Which known issue says Off The Radar cannot be completed on Riven Tides?",
      expectedTerms: ["off the radar", "completed on riven tides"],
    },
  ],
};

export const COMMUNITY_ITEMS_PAGE_EVAL_BENCHMARK: ChunkingEvalBenchmark = {
  id: "community-items-page-1",
  label: "Metaforge Items Page 1",
  url: "https://metaforge.app/arc-raiders/database/items/page/1",
  sourceType: "community_items",
  sourceName: "Metaforge ARC Raiders database",
  queries: [
    {
      id: "acoustic-guitar-purpose",
      query: "Which item is a playable acoustic guitar used to attract ARC's attention and impress other Raiders?",
      expectedTerms: ["acoustic guitar", "attract arcs attention"],
    },
    {
      id: "adrenaline-shot-effect",
      query: "Which quick-use item fully restores stamina and temporarily increases stamina regeneration?",
      expectedTerms: ["adrenaline shot", "temporarily increases stamina regeneration"],
    },
    {
      id: "advanced-powercell-source",
      query: "Which top-side material is a very valuable resource that drops from certain ARC enemies?",
      expectedTerms: ["advanced arc powercell", "drops from certain arc enemies"],
    },
    {
      id: "advanced-mechanical-components-use",
      query: "Which material is mostly used to craft advanced weapons?",
      expectedTerms: ["advanced mechanical components", "advanced weapons"],
    },
    {
      id: "antiseptic-use",
      query: "Which refined material is used to craft medical supplies and can be recycled into chemicals?",
      expectedTerms: ["antiseptic", "used to craft medical supplies"],
    },
    {
      id: "alien-duck-noise",
      query: "Which trinket can be thrown to create noise?",
      expectedTerms: ["alien duck", "create noise"],
    },
    {
      id: "anvil-heavy-ammo",
      query: "Which weapon is a single-action hand cannon that uses heavy ammo?",
      expectedTerms: ["anvil i", "single action hand cannon"],
    },
    {
      id: "aphelion-energy-rounds",
      query: "Which weapon fires high velocity energy rounds?",
      expectedTerms: ["aphelion rifle", "energy rounds"],
    },
    {
      id: "angled-grip-blueprint",
      query: "Which blueprint lets you craft an Angled Grip II?",
      expectedTerms: ["angled grip ii blueprint", "lets you craft an angled grip ii"],
    },
    {
      id: "arpeggio-medium-ammo",
      query: "Which assault rifle uses medium ammo and fires in bursts?",
      expectedTerms: ["arpeggio i", "burst"],
    },
  ],
};

export const CHUNKING_EVAL_BENCHMARKS = {
  default: COMMUNITY_ITEMS_PAGE_EVAL_BENCHMARK,
  communityItemsPage1: COMMUNITY_ITEMS_PAGE_EVAL_BENCHMARK,
  mapConditions: MAP_CONDITIONS_EVAL_BENCHMARK,
  patchNotes: PATCH_NOTES_EVAL_BENCHMARK,
} as const;

export const DEFAULT_CHUNKING_EVAL_BENCHMARK = CHUNKING_EVAL_BENCHMARKS.default;

function cosineSimilarity(left: number[], right: number[]) {
  let dot = 0;
  let leftNorm = 0;
  let rightNorm = 0;

  for (let index = 0; index < left.length; index += 1) {
    const leftValue = left[index] ?? 0;
    const rightValue = right[index] ?? 0;

    dot += leftValue * rightValue;
    leftNorm += leftValue * leftValue;
    rightNorm += rightValue * rightValue;
  }

  if (leftNorm === 0 || rightNorm === 0) {
    return 0;
  }

  return dot / (Math.sqrt(leftNorm) * Math.sqrt(rightNorm));
}

function normalizeForMatch(value: string) {
  return value
    .toLowerCase()
    .replace(/[’']/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function queryHit(chunkTexts: string[], expectedTerms: string[]) {
  const haystack = normalizeForMatch(chunkTexts.join(" "));

  return expectedTerms.every((term) => {
    const needle = normalizeForMatch(term);
    return needle.length > 0 && haystack.includes(needle);
  });
}

async function evaluateStrategy(
  document: ScrapedPage,
  strategy: ChunkStrategy,
  benchmark: ChunkingEvalBenchmark
) {
  const normalizedDocument = normalizeScrapedPage({
    sourceType: benchmark.sourceType,
    sourceName: benchmark.sourceName,
    scrapedPage: document,
  });

  const chunks = chunkDocument(normalizedDocument, strategy);

  const { embeddings: chunkEmbeddings } = await embedMany({
    model: EMBEDDING_MODEL_ID,
    values: chunks.map((chunk) => chunk.chunkText),
  });

  const { embeddings: queryEmbeddings } = await embedMany({
    model: EMBEDDING_MODEL_ID,
    values: benchmark.queries.map((query) => query.query),
  });

  let hitCount = 0;

  for (const [queryIndex, queryEmbedding] of queryEmbeddings.entries()) {
    const scoredChunks = chunkEmbeddings
      .map((embedding, index) => ({
        chunkText: chunks[index]!.chunkText,
        score: cosineSimilarity(queryEmbedding, embedding),
      }))
      .sort((left, right) => right.score - left.score)
      .slice(0, CHUNKING_EVAL_TOP_K);

    if (
      queryHit(
        scoredChunks.map((entry) => entry.chunkText),
        benchmark.queries[queryIndex]!.expectedTerms
      )
    ) {
      hitCount += 1;
    }
  }

  const result: ChunkingEvalResult = {
    strategy,
    recallAt3: hitCount / benchmark.queries.length,
    hitCount,
    queryCount: benchmark.queries.length,
  };

  return result;
}

export async function runChunkingEvaluation(
  scrapedPage: ScrapedPage,
  benchmark: ChunkingEvalBenchmark = DEFAULT_CHUNKING_EVAL_BENCHMARK
) {
  const strategies: ChunkStrategy[] = ["fixed", "overlapping", "semantic"];
  const results = [];

  for (const strategy of strategies) {
    results.push(await evaluateStrategy(scrapedPage, strategy, benchmark));
  }

  const sorted = [...results].sort((left, right) => right.recallAt3 - left.recallAt3);
  const highestRecall = sorted[0]?.recallAt3 ?? 0;
  const lowestRecall = sorted.at(-1)?.recallAt3 ?? 0;
  const winningStrategies = results.filter(
    (result) => result.recallAt3 === highestRecall
  );
  const isTied = winningStrategies.length > 1;
  const isWeakBenchmark = highestRecall <= 0.2;
  const isInconclusive = isTied || isWeakBenchmark || highestRecall === lowestRecall;
  const winner = !isInconclusive ? winningStrategies[0]! : null;

  return {
    benchmarkId: benchmark.id,
    benchmarkLabel: benchmark.label,
    evaluationUrl: benchmark.url,
    embeddingModel: EMBEDDING_MODEL_ID,
    results,
    winner: winner?.strategy ?? null,
    benchmarkStatus: isInconclusive ? "inconclusive" : "winner",
    warning: isInconclusive
      ? "This benchmark is not discriminative enough to justify changing the default chunking strategy."
      : null,
    rationale:
      !winner
        ? `All strategies tied at recall@${CHUNKING_EVAL_TOP_K} ${(highestRecall * 100).toFixed(0)}% on ${benchmark.label}, so the result is inconclusive.`
        : winner.strategy === "overlapping"
        ? "Overlapping chunks preserve retrieval continuity across paragraph boundaries without fragmenting the evidence too aggressively."
        : winner.strategy === "semantic"
          ? "Semantic chunks preserved the page's topic boundaries better than fixed slices on this source."
          : "Fixed chunks won on this source because the relevant evidence was already clustered in short contiguous spans.",
  };
}