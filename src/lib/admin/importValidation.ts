export type StagedEntityType = 'universities' | 'programs' | 'scholarships' | 'articles'

export type ValidationResult = {
  warnings: string[]
}

export type ValidationContext = {
  rawData?: Record<string, unknown>
  programPrimarySubject?: {
    status: 'missing' | 'matched_by_name' | 'matched_by_slug' | 'unmatched' | 'ambiguous'
    input: string | null
  } | null
}

const PROGRAM_DEGREE_LEVEL_CODES = ['associate', 'bachelor', 'certificate', 'diploma', 'foundation', 'master', 'phd'] as const
const PROGRAM_STUDY_MODE_OPTIONS = ['full_time', 'part_time', 'online', 'hybrid'] as const
const PROGRAM_DELIVERY_MODE_OPTIONS = ['on_campus', 'online', 'hybrid', 'distance'] as const
const PROGRAM_TUITION_PERIOD_OPTIONS = ['per_year', 'per_semester', 'total', 'per_credit'] as const

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
  values: Record<string, string>,
  context: ValidationContext = {},
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
    if (!values.extracted_degree_level_code?.trim()) {
      warnings.push('Degree level code is missing')
    } else if (!(PROGRAM_DEGREE_LEVEL_CODES as readonly string[]).includes(values.extracted_degree_level_code.trim().toLowerCase())) {
      warnings.push(`Degree level code "${values.extracted_degree_level_code.trim()}" is not supported and will block merge`)
    }
    if (values.extracted_tuition_amount?.trim() && isNaN(Number(values.extracted_tuition_amount.trim()))) {
      warnings.push('Tuition amount is not a valid number')
    }

    const rawData = context.rawData
    if (rawData) {
      const studyModeValue = textField(rawData, ['study_mode', 'attendance_mode'])
      if (studyModeValue && !normalizeEnum(studyModeValue, PROGRAM_STUDY_MODE_OPTIONS, {
        fulltime: 'full_time',
        full_time: 'full_time',
        parttime: 'part_time',
        part_time: 'part_time',
      })) {
        warnings.push(`Study mode "${studyModeValue}" is not supported and will be ignored`)
      }

      const deliveryModeValue = textField(rawData, ['delivery_mode', 'delivery_format'])
      if (deliveryModeValue && !normalizeEnum(deliveryModeValue, PROGRAM_DELIVERY_MODE_OPTIONS, {
        campus: 'on_campus',
        in_person: 'on_campus',
        oncampus: 'on_campus',
      })) {
        warnings.push(`Delivery mode "${deliveryModeValue}" is not supported and will be ignored`)
      }

      const tuitionPeriodValue = textField(rawData, ['tuition_period', 'tuition_frequency'])
      if (tuitionPeriodValue && !normalizeEnum(tuitionPeriodValue, PROGRAM_TUITION_PERIOD_OPTIONS, {
        year: 'per_year',
        yearly: 'per_year',
        annual: 'per_year',
        annually: 'per_year',
        per_annum: 'per_year',
        semester: 'per_semester',
        credit: 'per_credit',
      })) {
        warnings.push(`Tuition period "${tuitionPeriodValue}" is not supported and will be ignored`)
      }
    }

    const primarySubject = context.programPrimarySubject
    if (primarySubject?.status === 'unmatched' && primarySubject.input) {
      warnings.push(`Primary subject "${primarySubject.input}" does not match any existing subject and will be ignored`)
    } else if (primarySubject?.status === 'ambiguous' && primarySubject.input) {
      warnings.push(`Primary subject "${primarySubject.input}" matched multiple existing subjects and will be ignored`)
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

function textField(raw: Record<string, unknown>, keys: string[]): string | null {
  for (const key of keys) {
    const value = raw[key]
    if (value === null || value === undefined || typeof value === 'object') continue
    const text = String(value).trim()
    if (text) return text
  }
  return null
}

function normalizeEnum(
  value: string,
  allowed: readonly string[],
  aliases: Record<string, string> = {},
): string | null {
  const key = value.toLowerCase().replace(/[\s-]+/g, '_').trim()
  const normalized = aliases[key] ?? key
  return allowed.includes(normalized) ? normalized : null
}
