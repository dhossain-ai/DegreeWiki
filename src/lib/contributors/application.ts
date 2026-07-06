import {
  type FormErrors,
  validateIn,
  validateMaxLength,
  validateRequired,
  validateUrl,
} from '../admin/validate'
import type {
  ContributorApplicationStatus,
  ContributorProfileReviewStatus,
} from './types'

export const CONTRIBUTOR_TYPE_OPTIONS = [
  'student',
  'alumni',
  'professor',
  'university_staff',
  'counselor',
  'education_expert',
  'other',
] as const

export type ContributorRequestedType = (typeof CONTRIBUTOR_TYPE_OPTIONS)[number]

export const CONTRIBUTOR_REVIEW_ACTIONS = [
  'pending_review',
  'needs_more_info',
  'approved',
  'rejected',
] as const

export type ContributorReviewAction = (typeof CONTRIBUTOR_REVIEW_ACTIONS)[number]

export type ContributorApplicationRecord = {
  id: string
  user_id: string
  status: ContributorApplicationStatus
  requested_contributor_type: ContributorRequestedType | null
  headline: string | null
  organization_name: string | null
  role_title: string | null
  country_expertise_text: string | null
  university_expertise_text: string | null
  subject_expertise_text: string | null
  bio_draft: string | null
  motivation: string | null
  public_profile_requested: boolean
  public_attribution_consent: boolean
  external_links: unknown
  admin_notes: string | null
  rejection_reason: string | null
  reviewed_by_user_id: string | null
  reviewed_at: string | null
  submitted_at: string | null
  created_at: string
  updated_at: string
}

export type ContributorProfileRecord = {
  user_id: string
  profile_review_status: ContributorProfileReviewStatus
  public_profile_enabled: boolean
  public_display_name: string | null
  public_role_label: string | null
  organization_name: string | null
  headline: string | null
  joined_at: string | null
  approved_at: string | null
}

export type ContributorScopeRecord = {
  id: string
  scope_type: 'country' | 'university' | 'subject'
  country_id: string | null
  university_id: string | null
  subject_id: string | null
  is_active: boolean
  approved_at: string | null
  created_at: string
}

export type ContributorApplicationFormValues = {
  requested_contributor_type: string
  headline: string
  organization_name: string
  role_title: string
  country_expertise_text: string
  university_expertise_text: string
  subject_expertise_text: string
  bio_draft: string
  motivation: string
  public_profile_requested: boolean
  public_attribution_consent: boolean
  external_links_text: string
}

export type ContributorDisplayStatus = ContributorApplicationStatus | 'not_started'

export const EMPTY_CONTRIBUTOR_APPLICATION_FORM: ContributorApplicationFormValues = {
  requested_contributor_type: '',
  headline: '',
  organization_name: '',
  role_title: '',
  country_expertise_text: '',
  university_expertise_text: '',
  subject_expertise_text: '',
  bio_draft: '',
  motivation: '',
  public_profile_requested: false,
  public_attribution_consent: false,
  external_links_text: '',
}

export const CONTRIBUTOR_STATUS_LABELS: Record<ContributorDisplayStatus, string> = {
  not_started: 'Not started',
  draft: 'Draft',
  submitted: 'Submitted',
  pending_review: 'Pending review',
  needs_more_info: 'Needs more info',
  approved: 'Approved',
  rejected: 'Rejected',
  withdrawn: 'Withdrawn',
  suspended: 'Suspended',
}

export const CONTRIBUTOR_STATUS_BADGES: Record<ContributorDisplayStatus, string> = {
  not_started: 'border-slate-200 bg-slate-50 text-slate-700',
  draft: 'border-slate-200 bg-slate-50 text-slate-700',
  submitted: 'border-blue-200 bg-blue-50 text-blue-700',
  pending_review: 'border-indigo-200 bg-indigo-50 text-indigo-700',
  needs_more_info: 'border-amber-200 bg-amber-50 text-amber-800',
  approved: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  rejected: 'border-rose-200 bg-rose-50 text-rose-700',
  withdrawn: 'border-slate-200 bg-slate-100 text-slate-500',
  suspended: 'border-orange-200 bg-orange-50 text-orange-700',
}

const CONTRIBUTOR_STATUS_SUMMARIES: Record<ContributorDisplayStatus, string> = {
  not_started: 'You have not started a contributor application yet.',
  draft: 'Your draft is saved. You can keep editing before submitting it for review.',
  submitted: 'Your application is in the review queue. DegreeWiki will show the outcome here.',
  pending_review: 'A reviewer is actively assessing your application.',
  needs_more_info: 'A reviewer asked for more detail. Update the application and submit it again.',
  approved: 'You are approved as a DegreeWiki contributor. Contributor tools will expand in a later phase.',
  rejected: 'This application was closed without approval.',
  withdrawn: 'This application was withdrawn.',
  suspended: 'This contributor application is suspended.',
}

const MAX_EXTERNAL_LINKS = 6

function getTextField(formData: FormData, key: string): string {
  return String(formData.get(key) ?? '').trim()
}

function getCheckboxField(formData: FormData, key: string): boolean {
  return formData.get(key) === 'on'
}

export function normalizeContributorApplicationForm(
  formData: FormData,
): ContributorApplicationFormValues {
  return {
    requested_contributor_type: getTextField(formData, 'requested_contributor_type'),
    headline: getTextField(formData, 'headline'),
    organization_name: getTextField(formData, 'organization_name'),
    role_title: getTextField(formData, 'role_title'),
    country_expertise_text: getTextField(formData, 'country_expertise_text'),
    university_expertise_text: getTextField(formData, 'university_expertise_text'),
    subject_expertise_text: getTextField(formData, 'subject_expertise_text'),
    bio_draft: getTextField(formData, 'bio_draft'),
    motivation: getTextField(formData, 'motivation'),
    public_profile_requested: getCheckboxField(formData, 'public_profile_requested'),
    public_attribution_consent: getCheckboxField(formData, 'public_attribution_consent'),
    external_links_text: getTextField(formData, 'external_links_text'),
  }
}

export function contributorApplicationToFormValues(
  application: ContributorApplicationRecord | null | undefined,
): ContributorApplicationFormValues {
  if (!application) return { ...EMPTY_CONTRIBUTOR_APPLICATION_FORM }

  return {
    requested_contributor_type: application.requested_contributor_type ?? '',
    headline: application.headline ?? '',
    organization_name: application.organization_name ?? '',
    role_title: application.role_title ?? '',
    country_expertise_text: application.country_expertise_text ?? '',
    university_expertise_text: application.university_expertise_text ?? '',
    subject_expertise_text: application.subject_expertise_text ?? '',
    bio_draft: application.bio_draft ?? '',
    motivation: application.motivation ?? '',
    public_profile_requested: application.public_profile_requested === true,
    public_attribution_consent: application.public_attribution_consent === true,
    external_links_text: externalLinksToTextarea(application.external_links),
  }
}

export function externalLinksToTextarea(externalLinks: unknown): string {
  if (!Array.isArray(externalLinks)) return ''

  const links = externalLinks.flatMap((entry) => {
    if (typeof entry === 'string') return [entry.trim()]
    if (
      entry &&
      typeof entry === 'object' &&
      'url' in entry &&
      typeof (entry as { url?: unknown }).url === 'string'
    ) {
      return [String((entry as { url: string }).url).trim()]
    }

    return []
  })

  return links.filter(Boolean).join('\n')
}

export function parseContributorExternalLinks(text: string): string[] {
  const rawLinks = text
    .split(/\r?\n/)
    .map(link => link.trim())
    .filter(Boolean)

  return Array.from(new Set(rawLinks))
}

export function validateContributorApplicationForm(
  values: ContributorApplicationFormValues,
  mode: 'draft' | 'submit',
): { errors: FormErrors; externalLinks: string[] } {
  const errors: FormErrors = {}
  const externalLinks = parseContributorExternalLinks(values.external_links_text)

  const typeError = values.requested_contributor_type
    ? validateIn(values.requested_contributor_type, CONTRIBUTOR_TYPE_OPTIONS, 'Contributor type')
    : mode === 'submit'
      ? validateRequired(values.requested_contributor_type, 'Contributor type')
      : null
  if (typeError) errors.requested_contributor_type = typeError

  const headlineError = validateMaxLength(values.headline, 120, 'Headline')
  if (headlineError) errors.headline = headlineError

  const organizationError = validateMaxLength(values.organization_name, 120, 'Organization name')
  if (organizationError) errors.organization_name = organizationError

  const roleTitleError = validateMaxLength(values.role_title, 120, 'Role title')
  if (roleTitleError) errors.role_title = roleTitleError

  const countryExpertiseError = validateMaxLength(
    values.country_expertise_text,
    500,
    'Country expertise',
  )
  if (countryExpertiseError) errors.country_expertise_text = countryExpertiseError

  const universityExpertiseError = validateMaxLength(
    values.university_expertise_text,
    500,
    'University expertise',
  )
  if (universityExpertiseError) errors.university_expertise_text = universityExpertiseError

  const subjectExpertiseError = validateMaxLength(
    values.subject_expertise_text,
    500,
    'Subject expertise',
  )
  if (subjectExpertiseError) errors.subject_expertise_text = subjectExpertiseError

  const bioError = validateMaxLength(values.bio_draft, 1800, 'Bio draft')
  if (bioError) errors.bio_draft = bioError

  const motivationError = validateMaxLength(values.motivation, 2000, 'Motivation')
  if (motivationError) errors.motivation = motivationError

  if (externalLinks.length > MAX_EXTERNAL_LINKS) {
    errors.external_links_text = `You can include up to ${MAX_EXTERNAL_LINKS} external links.`
  } else {
    for (const link of externalLinks) {
      const linkError = validateUrl(link, 'External link')
      if (linkError) {
        errors.external_links_text = linkError
        break
      }
    }
  }

  if (mode === 'submit') {
    const requiredHeadlineError = validateRequired(values.headline, 'Headline')
    if (requiredHeadlineError) errors.headline = requiredHeadlineError

    const requiredBioError = validateRequired(values.bio_draft, 'Short bio')
    if (requiredBioError) {
      errors.bio_draft = requiredBioError
    } else if (values.bio_draft.trim().length < 30) {
      errors.bio_draft = 'Short bio must be at least 30 characters.'
    }

    const requiredMotivationError = validateRequired(values.motivation, 'Motivation')
    if (requiredMotivationError) {
      errors.motivation = requiredMotivationError
    } else if (values.motivation.trim().length < 40) {
      errors.motivation = 'Motivation must be at least 40 characters.'
    }

    const hasExpertiseDetail = [
      values.country_expertise_text,
      values.university_expertise_text,
      values.subject_expertise_text,
    ].some(value => value.trim().length > 0)

    if (!hasExpertiseDetail) {
      errors.country_expertise_text = 'Add at least one country, university, or subject expertise note.'
    }

    if (values.public_profile_requested && !values.public_attribution_consent) {
      errors.public_attribution_consent = 'Public attribution consent is required when requesting a public contributor profile.'
    }
  }

  return { errors, externalLinks }
}

export function getContributorStatusSummary(status: ContributorDisplayStatus): string {
  return CONTRIBUTOR_STATUS_SUMMARIES[status]
}

