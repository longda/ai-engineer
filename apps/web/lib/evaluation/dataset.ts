import { ragEvalCaseSchema, type RagEvalCase } from "./types";

export const ARC_RAIDERS_RAG_V1_DATASET = [
  {
    id: "acoustic-guitar-item",
    question: "What is the Acoustic Guitar item in ARC Raiders?",
    questionType: "item_lookup",
    difficulty: "easy",
    expectedSourceTypes: ["community_items"],
    expectedEntityNames: ["Acoustic Guitar"],
    expectedEvidence: [
      {
        sourceType: "community_items",
        entityName: "Acoustic Guitar",
        titleContains: "Acoustic Guitar",
      },
    ],
    answerTraits: {
      mustMention: ["playable acoustic guitar", "attract ARC", "impress other Raiders"],
      shouldNotMention: ["weapon", "ammo"],
      mustCiteSources: true,
    },
  },
  {
    id: "adrenaline-shot-effect",
    question:
      "What does the Adrenaline Shot do in ARC Raiders?",
    questionType: "item_lookup",
    difficulty: "easy",
    expectedSourceTypes: ["community_items"],
    expectedEntityNames: ["Adrenaline Shot"],
    expectedEvidence: [
      {
        sourceType: "community_items",
        entityName: "Adrenaline Shot",
        titleContains: "Adrenaline Shot",
      },
    ],
    answerTraits: {
      mustMention: ["fully restores stamina", "temporarily increases stamina regeneration"],
      shouldNotMention: ["heals health"],
      mustCiteSources: true,
    },
  },
  {
    id: "advanced-arc-powercell-source",
    question:
      "What is the Advanced ARC Powercell and where does it come from?",
    questionType: "relationship_lookup",
    difficulty: "medium",
    expectedSourceTypes: ["community_items"],
    expectedEntityNames: ["Advanced ARC Powercell"],
    expectedEvidence: [
      {
        sourceType: "community_items",
        entityName: "Advanced ARC Powercell",
        titleContains: "Advanced ARC Powercell",
      },
    ],
    answerTraits: {
      mustMention: ["valuable resource", "drops from certain ARC enemies"],
      shouldNotMention: ["crafted from chemicals"],
      mustCiteSources: true,
    },
  },
  {
    id: "advanced-mechanical-components-use",
    question:
      "What are Advanced Mechanical Components mostly used for?",
    questionType: "relationship_lookup",
    difficulty: "easy",
    expectedSourceTypes: ["community_items"],
    expectedEntityNames: ["Advanced Mechanical Components"],
    expectedEvidence: [
      {
        sourceType: "community_items",
        entityName: "Advanced Mechanical Components",
        titleContains: "Advanced Mechanical Components",
      },
    ],
    answerTraits: {
      mustMention: ["craft advanced weapons"],
      shouldNotMention: ["medical supplies"],
      mustCiteSources: true,
    },
  },
  {
    id: "antiseptic-use",
    question:
      "What is Antiseptic used for in ARC Raiders?",
    questionType: "relationship_lookup",
    difficulty: "easy",
    expectedSourceTypes: ["community_items"],
    expectedEntityNames: ["Antiseptic"],
    expectedEvidence: [
      {
        sourceType: "community_items",
        entityName: "Antiseptic",
        titleContains: "Antiseptic",
      },
    ],
    answerTraits: {
      mustMention: ["craft medical supplies", "recycled into chemicals"],
      shouldNotMention: ["heavy ammo"],
      mustCiteSources: true,
    },
  },
  {
    id: "alien-duck-noise",
    question:
      "What is the Alien Duck used for?",
    questionType: "item_lookup",
    difficulty: "easy",
    expectedSourceTypes: ["community_items"],
    expectedEntityNames: ["Alien Duck"],
    expectedEvidence: [
      {
        sourceType: "community_items",
        entityName: "Alien Duck",
        titleContains: "Alien Duck",
      },
    ],
    answerTraits: {
      mustMention: ["can be thrown", "create noise"],
      shouldNotMention: ["heals stamina"],
      mustCiteSources: true,
    },
  },
  {
    id: "anvil-heavy-ammo",
    question:
      "Which weapon uses heavy ammo and how is it described?",
    questionType: "relationship_lookup",
    difficulty: "medium",
    expectedSourceTypes: ["community_items"],
    expectedEntityNames: ["Anvil I"],
    expectedEvidence: [
      {
        sourceType: "community_items",
        entityName: "Anvil I",
        titleContains: "Anvil I",
      },
    ],
    answerTraits: {
      mustMention: ["single-action hand cannon", "heavy ammo"],
      shouldNotMention: ["burst rifle"],
      mustCiteSources: true,
    },
  },
  {
    id: "aphelion-energy-rounds",
    question:
      "What kind of weapon is the Aphelion Rifle and what does it fire?",
    questionType: "relationship_lookup",
    difficulty: "medium",
    expectedSourceTypes: ["community_items"],
    expectedEntityNames: ["Aphelion Rifle"],
    expectedEvidence: [
      {
        sourceType: "community_items",
        entityName: "Aphelion Rifle",
        titleContains: "Aphelion Rifle",
      },
    ],
    answerTraits: {
      mustMention: ["high velocity energy rounds"],
      shouldNotMention: ["heavy ammo"],
      mustCiteSources: true,
    },
  },
  {
    id: "angled-grip-blueprint",
    question:
      "What does the Angled Grip II Blueprint let you craft?",
    questionType: "item_lookup",
    difficulty: "easy",
    expectedSourceTypes: ["community_items"],
    expectedEntityNames: ["Angled Grip II Blueprint"],
    expectedEvidence: [
      {
        sourceType: "community_items",
        entityName: "Angled Grip II Blueprint",
        titleContains: "Angled Grip II Blueprint",
      },
    ],
    answerTraits: {
      mustMention: ["craft an Angled Grip II"],
      shouldNotMention: ["weapon ammo"],
      mustCiteSources: true,
    },
  },
  {
    id: "arpeggio-medium-ammo",
    question:
      "What ammo does Arpeggio I use and how does it fire?",
    questionType: "relationship_lookup",
    difficulty: "medium",
    expectedSourceTypes: ["community_items"],
    expectedEntityNames: ["Arpeggio I"],
    expectedEvidence: [
      {
        sourceType: "community_items",
        entityName: "Arpeggio I",
        titleContains: "Arpeggio I",
      },
    ],
    answerTraits: {
      mustMention: ["medium ammo", "fires in bursts"],
      shouldNotMention: ["single-action hand cannon"],
      mustCiteSources: true,
    },
  },
  {
    id: "heavy-ammo-category",
    question: "What category does Heavy Ammo belong to?",
    questionType: "category_lookup",
    difficulty: "easy",
    expectedSourceTypes: ["community_items"],
    expectedEntityNames: ["Heavy Ammo"],
    expectedEvidence: [
      {
        sourceType: "community_items",
        entityName: "Heavy Ammo",
        titleContains: "Heavy Ammo",
      },
    ],
    answerTraits: {
      mustMention: ["ammo"],
      shouldNotMention: ["material", "weapon"],
      mustCiteSources: true,
    },
  },
  {
    id: "scrap-metal-comparison",
    question:
      "How does Scrap Metal compare to nearby materials in the current corpus?",
    questionType: "comparison",
    difficulty: "hard",
    expectedSourceTypes: ["community_items"],
    expectedEntityNames: ["Scrap Metal"],
    expectedEvidence: [
      {
        sourceType: "community_items",
        entityName: "Scrap Metal",
        titleContains: "Scrap Metal",
      },
      {
        sourceType: "community_items",
        entityName: "Advanced Mechanical Components",
        titleContains: "Advanced Mechanical Components",
      },
      {
        sourceType: "community_items",
        entityName: "Antiseptic",
        titleContains: "Antiseptic",
      },
    ],
    answerTraits: {
      mustMention: ["compare only what the corpus supports"],
      shouldNotMention: ["damage stats", "rarity tiers"],
      mustCiteSources: true,
      notes:
        "A strong answer should stay grounded and avoid inventing unsupported comparison dimensions.",
    },
  },
] satisfies RagEvalCase[];

export const arcRaidersRagV1Dataset = ragEvalCaseSchema.array().parse(
  ARC_RAIDERS_RAG_V1_DATASET
);