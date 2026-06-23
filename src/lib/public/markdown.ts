export type InlineNode =
  | { type: 'text'; text: string }
  | { type: 'strong'; text: string }
  | { type: 'em'; text: string }
  | { type: 'link'; href: string; text: string }

export type ArticleBlock =
  | { type: 'heading'; level: 2 | 3 | 4; children: InlineNode[] }
  | { type: 'paragraph'; children: InlineNode[] }
  | { type: 'ul'; items: InlineNode[][] }
  | { type: 'ol'; items: InlineNode[][] }

const HEADING_RE = /^(#{1,4})\s+(.+)$/
const UL_RE = /^[-*]\s+(.+)$/
const OL_RE = /^\d+\.\s+(.+)$/

function isSafeHttpUrl(value: string): boolean {
  try {
    const url = new URL(value)
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    return false
  }
}

function pushText(nodes: InlineNode[], text: string): void {
  if (!text) return

  const previous = nodes[nodes.length - 1]
  if (previous?.type === 'text') {
    previous.text += text
    return
  }

  nodes.push({ type: 'text', text })
}

export function parseInlineMarkdown(input: string): InlineNode[] {
  const nodes: InlineNode[] = []
  let index = 0

  while (index < input.length) {
    if (input.startsWith('**', index)) {
      const closeIndex = input.indexOf('**', index + 2)
      if (closeIndex > index + 2) {
        nodes.push({
          type: 'strong',
          text: input.slice(index + 2, closeIndex),
        })
        index = closeIndex + 2
        continue
      }
    }

    if (input[index] === '*') {
      const closeIndex = input.indexOf('*', index + 1)
      if (closeIndex > index + 1) {
        nodes.push({
          type: 'em',
          text: input.slice(index + 1, closeIndex),
        })
        index = closeIndex + 1
        continue
      }
    }

    if (input[index] === '[') {
      const labelEnd = input.indexOf('](', index + 1)
      if (labelEnd > index + 1) {
        const urlEnd = input.indexOf(')', labelEnd + 2)
        if (urlEnd > labelEnd + 2) {
          const label = input.slice(index + 1, labelEnd)
          const href = input.slice(labelEnd + 2, urlEnd).trim()

          if (label) {
            if (isSafeHttpUrl(href)) {
              nodes.push({ type: 'link', href, text: label })
            } else {
              pushText(nodes, label)
            }
            index = urlEnd + 1
            continue
          }
        }
      }
    }

    const nextTokenIndexes = [
      input.indexOf('**', index),
      input.indexOf('*', index),
      input.indexOf('[', index),
    ].filter((value) => value >= 0)

    const nextIndex = nextTokenIndexes.length > 0
      ? Math.min(...nextTokenIndexes)
      : input.length

    if (nextIndex === index) {
      pushText(nodes, input[index] ?? '')
      index += 1
      continue
    }

    pushText(nodes, input.slice(index, nextIndex))
    index = nextIndex
  }

  return nodes
}

export function parseArticleMarkdown(content: string | null | undefined): ArticleBlock[] {
  if (!content) return []

  const blocks: ArticleBlock[] = []
  const paragraphLines: string[] = []
  let listType: 'ul' | 'ol' | null = null
  let listItems: InlineNode[][] = []

  function flushParagraph(): void {
    if (paragraphLines.length === 0) return

    const text = paragraphLines.join(' ').trim()
    if (text) {
      blocks.push({ type: 'paragraph', children: parseInlineMarkdown(text) })
    }

    paragraphLines.length = 0
  }

  function flushList(): void {
    if (!listType || listItems.length === 0) {
      listType = null
      listItems = []
      return
    }

    blocks.push({ type: listType, items: listItems })
    listType = null
    listItems = []
  }

  const lines = content.replace(/\r\n?/g, '\n').split('\n')

  for (const rawLine of lines) {
    const line = rawLine.trim()

    if (!line) {
      flushParagraph()
      flushList()
      continue
    }

    const headingMatch = line.match(HEADING_RE)
    if (headingMatch) {
      flushParagraph()
      flushList()

      const headingText = headingMatch[2]?.trim()
      if (!headingText) continue

      const hashes = headingMatch[1] ?? '##'
      const level = hashes.length <= 1 ? 2 : Math.min(4, hashes.length) as 2 | 3 | 4
      blocks.push({
        type: 'heading',
        level,
        children: parseInlineMarkdown(headingText),
      })
      continue
    }

    const ulMatch = line.match(UL_RE)
    if (ulMatch) {
      flushParagraph()

      if (listType && listType !== 'ul') {
        flushList()
      }

      listType = 'ul'
      listItems.push(parseInlineMarkdown((ulMatch[1] ?? '').trim()))
      continue
    }

    const olMatch = line.match(OL_RE)
    if (olMatch) {
      flushParagraph()

      if (listType && listType !== 'ol') {
        flushList()
      }

      listType = 'ol'
      listItems.push(parseInlineMarkdown((olMatch[1] ?? '').trim()))
      continue
    }

    flushList()
    paragraphLines.push(line)
  }

  flushParagraph()
  flushList()

  return blocks
}
