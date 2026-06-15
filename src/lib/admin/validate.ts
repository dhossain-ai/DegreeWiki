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
