export type FormErrors = Record<string, string>

export function validateRequired(value: string | null | undefined, label: string): string | null {
  if (!value || value.trim() === '') return `${label} is required.`
  return null
}

export function validateExactLength(value: string, exact: number, label: string): string | null {
  if (value.trim().length !== exact) return `${label} must be exactly ${exact} characters.`
  return null
}

export function validateIn(value: string, options: readonly string[], label: string): string | null {
  if (!options.includes(value)) return `${label} must be one of: ${options.join(', ')}.`
  return null
}

export function validateSlug(value: string): string | null {
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value)) {
    return 'Slug must contain only lowercase letters, numbers, and hyphens, with no leading or trailing hyphens.'
  }
  return null
}

export function validateNumeric(
  value: string,
  label: string,
  options: { min?: number } = {}
): string | null {
  if (!value || value.trim() === '') return null
  const n = Number(value.trim())
  if (!isFinite(n)) return `${label} must be a valid number.`
  if (options.min !== undefined && n < options.min) return `${label} must be at least ${options.min}.`
  return null
}

export function validateUrl(value: string, label: string): string | null {
  if (!value || value.trim() === '') return null
  try {
    const url = new URL(value.trim())
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      return `${label} must start with http:// or https://.`
    }
  } catch {
    return `${label} must be a valid URL (e.g. https://example.com).`
  }
  return null
}
