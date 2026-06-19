export type StagedEntityType = 'universities' | 'programs' | 'scholarships' | 'articles'

export type ValidationResult = {
  warnings: string[]
}

export function parseRawData(
  raw: string
): { ok: true; value: Record<string, unknown> } | { ok: false; error: string } {
  if (!raw || raw.trim() === '') {
    return { ok: true, value: {} }
  }
  try {
    const parsed = JSON.parse(raw.trim())
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
      return { ok: false, error: 'raw_data must be a JSON object, not an array or primitive value' }
    }
    return { ok: true, value: parsed as Record<string, unknown> }
  } catch {
    return { ok: false, error: 'raw_data is not valid JSON' }
  }
}

export function validateStagedRecord(
  entityType: StagedEntityType,
  values: Record<string, string>
): ValidationResult {
  const warnings: string[] = []

  if (entityType === 'universities') {
    if (!values.extracted_name?.trim()) {
      warnings.push('Name is missing')
    }
    if (!values.extracted_official_url?.trim()) {
      warnings.push('Official URL is missing')
    } else if (!isValidUrl(values.extracted_official_url.trim())) {
      warnings.push('Official URL is not a valid URL')
    }
    if (values.extracted_country_code?.trim() && values.extracted_country_code.trim().length !== 2) {
      warnings.push('Country code should be exactly 2 characters')
    }
  } else if (entityType === 'programs') {
    if (!values.extracted_title?.trim()) {
      warnings.push('Title is missing')
    }
    if (values.extracted_tuition_amount?.trim() && isNaN(Number(values.extracted_tuition_amount.trim()))) {
      warnings.push('Tuition amount is not a valid number')
    }
  } else if (entityType === 'scholarships') {
    if (!values.extracted_name?.trim()) {
      warnings.push('Name is missing')
    }
    if (values.extracted_amount?.trim() && isNaN(Number(values.extracted_amount.trim()))) {
      warnings.push('Amount is not a valid number')
    }
  } else if (entityType === 'articles') {
    if (!values.extracted_title?.trim()) {
      warnings.push('Title is missing')
    }
    if (!values.extracted_slug?.trim()) {
      warnings.push('Slug is missing')
    } else if (!/^[a-z0-9-]+$/.test(values.extracted_slug.trim())) {
      warnings.push('Slug must contain only lowercase letters, numbers, and hyphens')
    }
    if (values.extracted_content?.trim() && values.extracted_content.trim().length < 50) {
      warnings.push('Content is shorter than 50 characters')
    }
  }

  return { warnings }
}

function isValidUrl(url: string): boolean {
  try {
    new URL(url)
    return true
  } catch {
    return false
  }
}
