import type { APIRoute } from 'astro'
import {
  buildCloudinaryImageUrl,
  createPublicMobileClient,
  credentialsErrorResponse,
  formatEnumLabel,
  formatLongDate,
  formatRange,
  internalErrorResponse,
  jsonResponse,
  safeExternalUrl,
  teaserFromText,
} from '../../../lib/mobile/public'

function relationNames(rows: any[] | null | undefined, relation: string): string[] {
  return (rows ?? [])
    .map((row: any) => row?.[relation]?.name)
    .filter((name: unknown): name is string => typeof name === 'string' && name.trim().length > 0)
}

export const GET: APIRoute = async () => {
  const supabase = createPublicMobileClient()
  if (!supabase) return credentialsErrorResponse()

  const cloudName = import.meta.env.PUBLIC_CLOUDINARY_CLOUD_NAME
  const { data, error } = await supabase
    .from('scholarships')
    .select(`
      id,
      slug,
      name,
      scholarship_type,
      provider_name,
      provider_type,
      funding_type,
      application_type,
      overview,
      eligibility_summary,
      amount_min,
      amount_max,
      currency,
      deadline,
      deadline_text,
      official_url,
      application_url,
      verification_status,
      last_verified_at,
      updated_at,
      scholarship_countries(countries(name)),
      scholarship_subjects(subjects(name)),
      scholarship_degree_levels(degree_levels(name)),
      logo:media_assets!scholarships_logo_id_fkey(cloudinary_public_id),
      cover_image:media_assets!scholarships_cover_image_id_fkey(cloudinary_public_id)
    `)
    .eq('content_status', 'published')
    .order('deadline', { ascending: true, nullsFirst: false })
    .order('name')
    .limit(200)

  if (error) {
    console.error('mobile scholarships list error:', error.message)
    return internalErrorResponse()
  }

  const payload = (data ?? []).map((scholarship: any) => ({
    id: scholarship.id,
    slug: scholarship.slug,
    name: scholarship.name,
    providerName: scholarship.provider_name ?? null,
    providerType: scholarship.provider_type ?? null,
    providerTypeLabel: formatEnumLabel(scholarship.provider_type),
    summary: teaserFromText(scholarship.overview) ?? scholarship.eligibility_summary ?? null,
    scholarshipType: scholarship.scholarship_type ?? null,
    scholarshipTypeLabel: formatEnumLabel(scholarship.scholarship_type),
    fundingType: scholarship.funding_type ?? null,
    fundingTypeLabel: formatEnumLabel(scholarship.funding_type),
    applicationType: scholarship.application_type ?? null,
    amountMin: scholarship.amount_min != null ? Number(scholarship.amount_min) : null,
    amountMax: scholarship.amount_max != null ? Number(scholarship.amount_max) : null,
    currency: scholarship.currency ?? null,
    amountDisplay: formatRange(scholarship.amount_min, scholarship.amount_max, scholarship.currency, ''),
    deadline: scholarship.deadline ?? null,
    deadlineText: scholarship.deadline_text ?? null,
    deadlineDisplay: formatLongDate(scholarship.deadline) ?? scholarship.deadline_text ?? null,
    studyCountries: relationNames(scholarship.scholarship_countries, 'countries'),
    eligibleDegreeLevels: relationNames(scholarship.scholarship_degree_levels, 'degree_levels'),
    eligibleSubjects: relationNames(scholarship.scholarship_subjects, 'subjects'),
    officialUrl: safeExternalUrl(scholarship.official_url),
    applicationUrl: safeExternalUrl(scholarship.application_url),
    verificationStatus: scholarship.verification_status ?? null,
    lastVerifiedAt: scholarship.last_verified_at ?? null,
    updatedAt: scholarship.updated_at ?? null,
    imageUrl: buildCloudinaryImageUrl(
      cloudName,
      scholarship.cover_image?.cloudinary_public_id ?? scholarship.logo?.cloudinary_public_id,
    ),
  }))

  return jsonResponse(200, payload)
}
