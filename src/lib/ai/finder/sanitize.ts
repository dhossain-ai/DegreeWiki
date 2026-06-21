// Defensive plain-text sanitizer for AI finder summaries.
//
// The finder-summary prompt asks the provider for plain text only, but prompts
// are not a guarantee. This module strips Markdown/HTML artifacts so the stored
// and rendered explanation is always safe plain text. No dependencies.
//
// Safe to import on both server and client: pure string transforms, no secrets,
// no DB access. Rendering still uses text interpolation / textContent — this is
// belt-and-braces, never a substitute for safe rendering.

// Cap stored/returned explanation length. Generous vs. the ~180-word prompt
// target, but bounds pathological provider output.
const MAX_LENGTH = 4000

export function sanitizeAIExplanation(text: string): string {
  if (!text) return ''

  let out = text

  // 1. Convert <br> variants to real line breaks before stripping tags.
  out = out.replace(/<br\s*\/?>/gi, '\n')

  // 2. Strip any remaining HTML tags (e.g. <b>, <p>, <span>).
  out = out.replace(/<\/?[a-z][^>]*>/gi, '')

  // 3. Process line-by-line to drop table rows and heading markers.
  const lines = out.split(/\r?\n/)
  const cleaned: string[] = []
  for (let line of lines) {
    const trimmed = line.trim()

    // Markdown table separator rows, e.g. | --- | :--: | or ---|---
    if (/^\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)+\|?$/.test(trimmed)) {
      continue
    }

    // Obvious pipe table rows: contain at least two pipe separators.
    // Convert to a plain " - " separated line rather than dropping content.
    if ((trimmed.match(/\|/g) ?? []).length >= 2) {
      line = trimmed
        .replace(/^\||\|$/g, '')
        .split('|')
        .map(cell => cell.trim())
        .filter(Boolean)
        .join(' - ')
    }

    // Leading Markdown heading markers (#, ##, ...) -> plain text.
    line = line.replace(/^\s{0,3}#{1,6}\s+/, '')

    cleaned.push(line)
  }
  out = cleaned.join('\n')

  // 4. Remove emphasis / code markers: ** __ and backticks.
  out = out.replace(/\*\*/g, '')
  out = out.replace(/__/g, '')
  out = out.replace(/`/g, '')

  // 5. Normalize excessive blank lines (3+ newlines -> a single blank line).
  out = out.replace(/\n{3,}/g, '\n\n')

  // 6. Trim trailing spaces per line and overall whitespace.
  out = out
    .split('\n')
    .map(l => l.replace(/[ \t]+$/g, ''))
    .join('\n')
    .trim()

  // 7. Cap length on a word boundary if needed.
  if (out.length > MAX_LENGTH) {
    out = out.slice(0, MAX_LENGTH).replace(/\s+\S*$/, '').trim()
  }

  return out
}
