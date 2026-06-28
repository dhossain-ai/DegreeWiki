import type { AIContext } from '../types'

const DEGREEWIKI_SCOPE_SUMMARY = [
  'DegreeWiki helps users explore study-abroad programs, universities, scholarships, and guides.',
  'Use general DegreeWiki guidance only unless the supplied context contains a specific fact.',
  'If the user needs exact program details, direct them to DegreeWiki search, Fit Finder, or official sources.',
  'Do not guarantee admission, scholarships, visa outcomes, or official accuracy.',
].join(' ')

function normalizePublicPath(pathname: string): string {
  if (!pathname.startsWith('/')) return '/'
  return pathname.slice(0, 180)
}

export function getSiteChatPageType(pathname: string): string {
  if (pathname === '/') return 'home'
  if (pathname === '/programs') return 'program_index'
  if (pathname.startsWith('/programs/')) return 'program_detail'
  if (pathname === '/universities') return 'university_index'
  if (pathname.startsWith('/universities/')) return 'university_detail'
  if (pathname === '/scholarships') return 'scholarship_index'
  if (pathname.startsWith('/scholarships/')) return 'scholarship_detail'
  if (pathname === '/guides') return 'guide_index'
  if (pathname.startsWith('/guides/')) return 'guide_detail'
  return 'public_page'
}

export function buildSiteChatContext(pathname: string): AIContext {
  const currentPath = normalizePublicPath(pathname)
  const pageType = getSiteChatPageType(currentPath)

  return {
    source: 'none',
    records: [{
      scope: DEGREEWIKI_SCOPE_SUMMARY,
      current_page_path: currentPath,
      current_page_type: pageType,
      allowed_topics: [
        'DegreeWiki navigation',
        'program discovery',
        'Fit Finder guidance',
        'scholarship browsing',
        'study planning guidance',
      ],
      disallowed_topics: [
        'invented program facts',
        'tuition or deadline guesses',
        'admission guarantees',
        'scholarship guarantees',
        'visa guarantees',
        'internet browsing',
      ],
      next_steps: [
        'Browse DegreeWiki programs',
        'Use Fit Finder',
        'Check scholarships',
        'Read DegreeWiki guides',
        'Verify details with official sources',
      ],
    }],
  }
}
