import type { SourceType } from "@/lib/embeddings/types";
import type {
  RagCitation,
  RagContextPacket,
  RagRetrievalFilters,
  RagRetrievalMode,
} from "@/lib/rag/types";

export const CONTEXT_ARCHITECTURE_SOURCE_PROFILE_VALUES = [
  "all",
  "official_knowledge",
  "community_items",
  "patch_change_records",
] as const;

export type ContextArchitectureSourceProfile =
  (typeof CONTEXT_ARCHITECTURE_SOURCE_PROFILE_VALUES)[number];

export type ContextArchitectureSourceProfileOption = {
  value: ContextArchitectureSourceProfile;
  label: string;
  description: string;
  sourceTypes: SourceType[];
};

export const CONTEXT_ARCHITECTURE_SOURCE_PROFILES: ContextArchitectureSourceProfileOption[] = [
  {
    value: "all",
    label: "All sources",
    description: "Use the full ARC Raiders corpus without pre-scoping the source family.",
    sourceTypes: [
      "official_docs",
      "official_updates",
      "community_items",
      "derived_patch_records",
    ],
  },
  {
    value: "official_knowledge",
    label: "Official docs + news",
    description:
      "Scope retrieval to scraped official evergreen docs and official update pages.",
    sourceTypes: ["official_docs", "official_updates"],
  },
  {
    value: "community_items",
    label: "Community item records",
    description:
      "Scope retrieval to structured community item detail records for item and inventory lookup.",
    sourceTypes: ["community_items"],
  },
  {
    value: "patch_change_records",
    label: "Derived patch records",
    description:
      "Scope retrieval to patch-note change records extracted from official updates.",
    sourceTypes: ["derived_patch_records"],
  },
];

export const CONTEXT_ARCHITECTURE_DEFAULT_TOKEN_BUDGET = 1400;

export type ContextPackSelection = {
  sourceId: string;
  sourceType: string;
  reason: string;
  estimatedTokens: number;
};

export type ContextPackExclusion = {
  sourceId: string;
  reason: string;
};

export type ContextPackPacket = {
  taskSummary: string;
  selectedSources: ContextPackSelection[];
  excludedSources: ContextPackExclusion[];
  totalEstimatedTokens: number;
  fitsBudget: boolean;
  compressionPlan: string[];
  warningFlags: string[];
};

export type ContextArchitecturePacket = {
  query: string;
  retrievalMode: RagRetrievalMode;
  sourceProfile: ContextArchitectureSourceProfile;
  sourceProfileLabel: string;
  resolvedSourceTypes: SourceType[];
  filters?: RagRetrievalFilters;
  sessionContext: string | null;
  tokenBudget: number;
  retrieval: RagContextPacket;
  selectedCitations: RagCitation[];
  contextPack: ContextPackPacket;
};

export type ContextArchitectureFilterOptions = {
  entityNames: string[];
  tags: string[];
  sourceProfiles: ContextArchitectureSourceProfileOption[];
};

export type ContextArchitectureMeasureScenario = {
  id: string;
  title: string;
  query: string;
  sourceProfile: ContextArchitectureSourceProfile;
  preferredSourceTypes: SourceType[];
  entityName?: string;
  topic?: string;
  whyItFits: string;
};

export type ContextArchitectureMeasureScenarioResult = {
  id: string;
  title: string;
  query: string;
  sourceProfile: ContextArchitectureSourceProfile;
  sourceProfileLabel: string;
  preferredSourceTypes: SourceType[];
  whyItFits: string;
  unfilteredPrecisionAt4: number;
  filteredPrecisionAt4: number;
  improvement: number;
  unfilteredTopTitles: string[];
  filteredTopTitles: string[];
  unfilteredSourceTypes: SourceType[];
  filteredSourceTypes: SourceType[];
};

export type ContextArchitectureMeasurePacket = {
  retrievalMode: RagRetrievalMode;
  scenarios: ContextArchitectureMeasureScenarioResult[];
};