import type { AIGuardrailResult } from '../types'

// First-pass deterministic guardrails.
// These regex checks are conservative — they catch clearly prohibited content
// before and after LLM calls using exact phrase matching only.
// This is not a complete safety system; it is a first layer.
// Output moderation, intent classification, and semantic checks are deferred.

const FORBIDDEN_INPUT_PATTERNS: ReadonlyArray<{ pattern: RegExp; reason: string }> = [
  {
    pattern: /fake\s+recommendation\s+letter/i,
    reason: 'Requests for fake recommendation letters are not supported.',
  },
  {
    pattern: /forg(e|ed|ing)\s+(document|certificate|transcript|diploma)/i,
    reason: 'Requests for document forgery are not supported.',
  },
  {
    pattern: /essay\s+ghostwrit/i,
    reason: 'Essay ghostwriting is not supported.',
  },
  {
    pattern: /immigration\s+fraud/i,
    reason: 'Immigration fraud assistance is not supported.',
  },
  {
    pattern: /how\s+to\s+(cheat|bypass|fake)\s+(the\s+)?visa/i,
    reason: 'Visa fraud assistance is not supported.',
  },
]

const FORBIDDEN_OUTPUT_PATTERNS: ReadonlyArray<{ pattern: RegExp; reason: string }> = [
  {
    pattern: /guaranteed\s+admission/i,
    reason: 'Output claims guaranteed admission.',
  },
  {
    pattern: /guaranteed\s+scholarship/i,
    reason: 'Output claims guaranteed scholarship.',
  },
  {
    pattern: /visa\s+will\s+be\s+approved/i,
    reason: 'Output claims visa approval.',
  },
  {
    pattern: /100%\s+acceptance/i,
    reason: 'Output claims 100% acceptance rate.',
  },
  {
    pattern: /you\s+will\s+definitely\s+(be\s+)?(accepted|admitted|receive)/i,
    reason: 'Output makes definitive admission claim.',
  },
  {
    pattern: /your\s+application\s+will\s+succeed/i,
    reason: 'Output guarantees application success.',
  },
]

export function checkInput(text: string): AIGuardrailResult {
  for (const { pattern, reason } of FORBIDDEN_INPUT_PATTERNS) {
    if (pattern.test(text)) {
      return { passed: false, reason }
    }
  }
  return { passed: true }
}

export function checkOutput(text: string): AIGuardrailResult {
  for (const { pattern, reason } of FORBIDDEN_OUTPUT_PATTERNS) {
    if (pattern.test(text)) {
      return { passed: false, reason }
    }
  }
  return { passed: true }
}
