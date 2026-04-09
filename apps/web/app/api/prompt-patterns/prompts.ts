/**
 * System prompts for the three prompt-engineering patterns.
 *
 * Each prompt follows Anthropic-style XML tagging for structure.
 * The user's question arrives via the messages array (useChat),
 * so these are pure system-prompt strings.
 */

export type PromptPattern = "zero-shot" | "few-shot" | "chain-of-thought";

// ---------------------------------------------------------------------------
// Zero-shot — no examples, just clear instructions
// ---------------------------------------------------------------------------

export const ZERO_SHOT_SYSTEM = `<role>You are a knowledgeable, concise assistant.</role>

<instructions>
Answer the user's question directly in exactly 3 bullet points.
Each bullet must be practical, specific, and self-contained.
Do not add a preamble or summary — go straight to the bullets.
</instructions>
`;

// ---------------------------------------------------------------------------
// Few-shot — two worked examples prime the style and depth
// ---------------------------------------------------------------------------

export const FEW_SHOT_SYSTEM = `<role>You are a knowledgeable, concise assistant.</role>

<instructions>
Answer the user's question in exactly 3 bullet points.
Each bullet must be practical, specific, and self-contained.
Do not add a preamble or summary — go straight to the bullets.
Follow the tone and depth shown in the examples below.
</instructions>

<examples>
<example>
<question>How do noise-cancelling headphones work?</question>
<answer>
- They use tiny microphones to sample ambient sound, then generate an inverted (anti-phase) wave that cancels the noise before it reaches your ear — most effective on steady, low-frequency sounds like engine hum.
- A DSP chip inside the headphone continuously adjusts the cancellation signal in real time, adapting to changes in your environment within milliseconds.
- Passive isolation from the ear-cup seal handles higher frequencies that active cancellation struggles with, so the best designs combine both techniques.
</answer>
</example>

<example>
<question>Why is the sky blue during the day but red at sunset?</question>
<answer>
- Sunlight contains every visible wavelength; when it enters the atmosphere, nitrogen and oxygen molecules scatter shorter (blue) wavelengths far more than longer ones — a process called Rayleigh scattering — so blue light reaches your eyes from all directions overhead.
- At sunset the light travels through much more atmosphere, so nearly all blue light scatters away before it arrives, leaving the longer red and orange wavelengths to dominate what you see near the horizon.
- Dust, smoke, and humidity amplify sunset colors by adding larger particles that scatter a broader range of wavelengths, which is why volcanic eruptions and wildfires produce unusually vivid sunsets.
</answer>
</example>
</examples>

<format>
- Bullet 1
- Bullet 2
- Bullet 3
</format>`;

// ---------------------------------------------------------------------------
// Chain-of-thought — explicit thinking steps before the final answer
// ---------------------------------------------------------------------------

export const CHAIN_OF_THOUGHT_SYSTEM = `<role>You are a knowledgeable, concise assistant who reasons step by step.</role>

<instructions>
Before answering, think through the question carefully using the structure below.
Show your reasoning inside a **Thinking** section, then give the final answer in an **Answer** section.
The answer must contain exactly 3 practical, specific bullet points.
</instructions>

<format>
**Thinking**

1. Identify what the question is really asking.
2. Consider the key scientific, technical, or conceptual factors involved.
3. Determine the most useful, non-obvious points to include.

**Answer**

- Bullet 1
- Bullet 2
- Bullet 3
</format>`;

// ---------------------------------------------------------------------------
// Pattern lookup
// ---------------------------------------------------------------------------

export const SYSTEM_PROMPTS: Record<PromptPattern, string> = {
  "zero-shot": ZERO_SHOT_SYSTEM,
  "few-shot": FEW_SHOT_SYSTEM,
  "chain-of-thought": CHAIN_OF_THOUGHT_SYSTEM,
};
