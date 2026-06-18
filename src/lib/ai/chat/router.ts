// SERVER-ONLY. Deterministic chat intent router.
// Classifies incoming user messages before any LLM or rate-limit check.
// All patterns are conservative — obvious cases only. Ambiguous messages fall through to LLM.

export type StaticCategory = 'greeting' | 'thanks' | 'help' | 'guarantee' | 'out_of_scope'

export type ChatRouteDecision =
  | { route: 'static'; category: StaticCategory }
  | { route: 'llm' }

// Static response text for each category.
// Wording is bounded, non-guarantee, and non-committal.
export const STATIC_RESPONSES: Record<StaticCategory, string> = {
  greeting:
    'Hi! I can help you understand the programs in this saved Fit Finder result.',
  thanks:
    "You're welcome. You can ask me to compare programs, explain match reasons, or point out what to verify before applying.",
  help:
    "I can answer questions about the programs in this saved Fit Finder result, such as tuition, deadlines, countries, degree levels, and match reasons. I can't search for new programs or guarantee admission, visas, or scholarships.",
  guarantee:
    "I can't predict or guarantee admission, visa approval, or scholarship success. I can help you understand the visible requirements and what to verify with official sources.",
  out_of_scope:
    "I'm focused on this saved Fit Finder result and can't help with that request here. Ask me about the matched programs, costs, deadlines, requirements, or next steps.",
}

// Standalone greeting words only. Short phrase must be the entire message.
const GREETING_RE = /^(hi|hello|hey)[!.,?]?\s*$/i

// Standalone thank-you phrases only.
const THANKS_RE = /^(thanks|thank\s+you(\s+so\s+much)?|cheers|thx)[!.,?]?\s*$/i

// Questions about assistant capabilities.
const HELP_RE =
  /\b(what\s+can\s+you\s+do|how\s+can\s+you\s+help|what\s+do\s+you\s+know|what\s+are\s+you\s+able\s+to|what\s+can\s+i\s+ask(\s+you)?)\b/i

// Requests for guaranteed outcomes — must include an admission/visa/scholarship term.
// Avoids over-matching: "will I get a response?" does not match.
const GUARANTEE_RE =
  /\bwill\s+i\s+(get|receive)\s+(admission|a\s+scholarship|my\s+visa)\b|\bam\s+i\s+guaranteed\b|\bguarantee\b.{0,60}\b(admission|visa|scholarship|accepted|eligib)\b|\bwill\s+(my\s+)?(visa|application)\s+be\s+(approved|accepted)\b|\bwill\s+i\s+be\s+(admitted|accepted|given\s+a\s+scholarship)\b/i

// Requests for programs outside the saved result.
// Requires a search/find verb or an explicit "outside/beyond" qualifier.
// Does NOT match: "which program should I choose?", "tell me more about these programs".
const NEW_PROGRAMS_RE =
  /\b(find|search|look)\s+(for\s+)?(new|other|more|additional|different|better)\s+programs?\b|\b(show|get|suggest)\s+me\s+(new|other|more|additional|different|better)\s+programs?\b|\bsearch\s+for\s+programs?\b|\bprograms?\s+outside\s+(this|the)\s+(result|list|set|saved)\b|\bfind\s+programs?\s+outside\b|\b(new|other|additional|different)\s+programs?\s+(outside|beyond|not\s+in)\b/i

// Clearly off-topic requests unrelated to study planning.
const OFF_TOPIC_RE =
  /\btell\s+(me\s+)?a\s+joke\b|\bwrite\s+(me\s+)?(some\s+)?code\b|\bmedical\s+advice\b|\binvestment\s+advice\b|\bstock\s+(tips?|advice)\b|\bcrypto\s+(tips?|advice|trading)\b|\bdiagnos(e|is)\s+(me|my)\b|\bprescri(be|ption)\b/i

// Prompt-override attempts not already blocked by input guardrails in guardrails.ts.
// Guardrails already block "ignore/disregard (all) previous instructions" patterns.
const PROMPT_OVERRIDE_RE =
  /\bforget\s+(all\s+)?(your\s+)?(instructions|rules|guidelines|constraints|context)\b|\bact\s+as\s+(if\s+)?you\s+(have\s+no|are\s+without)\s+(rules|instructions|constraints)\b|\bpretend\s+(you\s+are|to\s+be)\s+(a\s+)?(different|unconstrained|unrestricted|free)\b|\byou\s+are\s+now\s+(unconstrained|unrestricted|a\s+different\s+ai)\b/i

// routeChatMessage returns the routing decision for a single user message.
// The message must already be trimmed. Decision order:
//   1. greeting — standalone hello/hi/hey
//   2. thanks   — standalone thank-you phrase
//   3. help     — asking about capabilities
//   4. guarantee — requesting outcome certainty
//   5. out_of_scope — new program search, off-topic, or prompt-override attempt
//   6. llm      — all other messages
export function routeChatMessage(message: string): ChatRouteDecision {
  if (GREETING_RE.test(message)) return { route: 'static', category: 'greeting' }
  if (THANKS_RE.test(message)) return { route: 'static', category: 'thanks' }
  if (HELP_RE.test(message)) return { route: 'static', category: 'help' }
  if (GUARANTEE_RE.test(message)) return { route: 'static', category: 'guarantee' }
  if (
    NEW_PROGRAMS_RE.test(message) ||
    OFF_TOPIC_RE.test(message) ||
    PROMPT_OVERRIDE_RE.test(message)
  ) {
    return { route: 'static', category: 'out_of_scope' }
  }
  return { route: 'llm' }
}
