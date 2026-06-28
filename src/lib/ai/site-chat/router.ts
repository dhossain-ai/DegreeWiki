// SERVER-ONLY. Deterministic router for the public site chatbot shell.
// Static routes always win before any authenticated AI path is considered.

export type SiteStaticCategory =
  | 'greeting'
  | 'help'
  | 'find_programs'
  | 'fit_finder'
  | 'scholarships'
  | 'study_guides'
  | 'login'
  | 'guarantee'
  | 'out_of_scope'

export type SiteChatRouteDecision =
  | { route: 'static'; category: SiteStaticCategory }
  | { route: 'llm' }

export const SITE_STATIC_RESPONSES: Record<SiteStaticCategory, string> = {
  greeting:
    'Hi! I can help you explore DegreeWiki and answer general study-planning questions within DegreeWiki scope.',
  help:
    "I can help you use DegreeWiki for study planning, including program search, Fit Finder, scholarships, and guides. I can't guarantee admission, scholarships, visa outcomes, or official accuracy.",
  find_programs:
    'You can browse programs in DegreeWiki search or use Fit Finder for guided matching. If you want personalized AI help, sign in first.',
  fit_finder:
    'Fit Finder helps you narrow programs based on your study preferences. Use it when you want guided matching rather than open-ended chat.',
  scholarships:
    'You can explore scholarships on DegreeWiki and verify eligibility details at the official provider source before applying.',
  study_guides:
    'DegreeWiki guides can help you understand study planning topics and next steps. Use Guides for broader explainers, and program search for specific listings.',
  login:
    'Sign in or create an account to use the logged-in DegreeWiki AI chat. Anonymous visitors can still use the public program search, Fit Finder, scholarships, and guides.',
  guarantee:
    'I cannot guarantee admission, scholarship awards, visa approval, or official accuracy. Please verify important decisions with the relevant institution or official source.',
  out_of_scope:
    "I'm limited to DegreeWiki study-planning help here. Try program search, Fit Finder, scholarships, guides, or sign in for controlled DegreeWiki AI chat.",
}

export const SITE_LOGIN_REQUIRED_RESPONSE =
  'Sign in to use personalized DegreeWiki AI chat. You can also use program search, Fit Finder, scholarships, and guides without signing in.'

const GREETING_RE = /^(hi|hello|hey)[!.,?]?\s*$/i
const HELP_RE =
  /\b(help|who\s+are\s+you|what\s+can\s+you\s+do|how\s+can\s+you\s+help|what\s+can\s+i\s+ask(\s+you)?)\b/i
const FIND_PROGRAMS_RE =
  /\b(find|search|browse|look\s+for)\s+programs?\b|\bfind\s+(a|some)\s+(program|degree|course)\b/i
const FIT_FINDER_RE = /\bfit\s+finder\b|\bmatch\s+me\s+to\s+programs?\b/i
const SCHOLARSHIPS_RE = /\bscholarships?\b|\bfunding\b|\bfinancial\s+aid\b/i
const STUDY_GUIDES_RE = /\b(study\s+guides?|guides?|articles?)\b/i
const LOGIN_RE = /\b(sign\s*in|login|log\s*in|sign\s*up|signup|create\s+an\s+account)\b/i
const GUARANTEE_RE =
  /\bguarantee(d|s)?\b|\badmission\s+guarantee\b|\bvisa\s+guarantee\b|\bscholarship\s+guarantee\b|\bwill\s+i\s+(get|receive|be)\s+(admitted|accepted|a\s+scholarship|my\s+visa)\b/i
const OUT_OF_SCOPE_RE =
  /\btell\s+(me\s+)?a\s+joke\b|\bwrite\s+(me\s+)?code\b|\bmedical\s+advice\b|\binvestment\s+advice\b|\bcrypto\b|\bstock\s+(tip|tips|advice)\b|\bpretend\s+you\s+are\b|\bignore\s+(all\s+)?(previous|your)\s+instructions\b/i

export function routeSiteChatMessage(message: string): SiteChatRouteDecision {
  if (GUARANTEE_RE.test(message)) return { route: 'static', category: 'guarantee' }
  if (OUT_OF_SCOPE_RE.test(message)) return { route: 'static', category: 'out_of_scope' }
  if (GREETING_RE.test(message)) return { route: 'static', category: 'greeting' }
  if (HELP_RE.test(message)) return { route: 'static', category: 'help' }
  if (FIT_FINDER_RE.test(message)) return { route: 'static', category: 'fit_finder' }
  if (FIND_PROGRAMS_RE.test(message)) return { route: 'static', category: 'find_programs' }
  if (SCHOLARSHIPS_RE.test(message)) return { route: 'static', category: 'scholarships' }
  if (STUDY_GUIDES_RE.test(message)) return { route: 'static', category: 'study_guides' }
  if (LOGIN_RE.test(message)) return { route: 'static', category: 'login' }
  return { route: 'llm' }
}
