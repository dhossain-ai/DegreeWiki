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
  notFoundResponse,
  safeExternalUrl,
  teaserFromText,
} from '../../../../lib/mobile/public'

function relationItems(rows: any[] | null | undefined, relation: string) {
  return (rows ?? []).flatMap((row: any) => {
    const item = row?.[relation]
    return item?.id && item?.name
      ? [{ id: item.id, slug: item.slug ?? null, name: item.name, code: item.code ?? null }]
      : []
  })
}

export const GET: APIRoute = async ({ params }) => {
  const slug = params.slug?.trim()
  if (!slug) return notFoundResponse('scholarship_not_found')

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
      coverage_notes,
      deadline,
      deadline_text,
      official_url,
      application_url,
      provider_url,
      verification_status,
      last_verified_at,
      source_confidence_score,
      updated_at,
      scholarship_countries(countries(id, slug, name)),
      scholarship_universities(universities(id, slug, name, content_status)),
      scholarship_programs(programs(id, slug, title, content_status)),
      scholarship_subjects(subjects(id, slug, name)),
      scholarship_degree_levels(degree_levels(id, name, code)),
      scholarship_eligible_nationalities(eligibility_type, notes, countries(id, slug, name, iso2)),
      logo:media_assets!scholarships_logo_id_fkey(cloudinary_public_id),
      cover_image:media_assets!scholarships_cover_image_id_fkey(cloudinary_public_id)
    `)
    .eq('slug', slug)
    .eq('content_status', 'published')
    .maybeSingle()

  if (error) {
    console.error('mobile scholarship detail error:', error.message)
    return internalErrorResponse()
  }
  if (!data) return notFoundResponse('scholarship_not_found')

  const scholarship = data as any
  const studyCountries = relationItems(scholarship.scholarship_countries, 'countries')
  const degreeLevels = relationItems(scholarship.scholarship_degree_levels, 'degree_levels')
  const subjects = relationItems(scholarship.scholarship_subjects, 'subjects')
  const universities = relationItems(
    (scholarship.scholarship_universities ?? []).filter((row: any) => row.universities?.content_status === 'published'),
    'universities',
  )
  const programs = (scholarship.scholarship_programs ?? []).flatMap((row: any) => {
    const program = row.programs
    return program?.id && program?.title && program?.content_status === 'published'
      ? [{ id: program.id, slug: program.slug ?? null, title: program.title }]
      : []
  })

  return jsonResponse(200, {
    ok: true,
    item: {
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
      applicationTypeLabel: formatEnumLabel(scholarship.application_type),
      overview: scholarship.overview ?? null,
      contentFormat: 'plain_text',
      eligibilitySummary: scholarship.eligibility_summary ?? null,
      coverageNotes: scholarship.coverage_notes ?? null,
      amount: {
        min: scholarship.amount_min != null ? Number(scholarship.amount_min) : null,
        max: scholarship.amount_max != null ? Number(scholarship.amount_max) : null,
        currency: scholarship.currency ?? null,
        display: formatRange(scholarship.amount_min, scholarship.amount_max, scholarship.currency, ''),
      },
      deadline: {
        date: scholarship.deadline ?? null,
        text: scholarship.deadline_text ?? null,
        display: formatLongDate(scholarship.deadline) ?? scholarship.deadline_text ?? null,
      },
      studyCountries,
      eligibleDegreeLevels: degreeLevels,
      eligibleSubjects: subjects,
      eligibleNationalities: (scholarship.scholarship_eligible_nationalities ?? []).flatMap((row: any) => {
        const country = row.countries
        return country?.id && country?.name
          ? [{
              country: { id: country.id, slug: country.slug ?? null, name: country.name, code: country.iso2 ?? null },
              eligibilityType: row.eligibility_type,
              notes: row.notes ?? null,
            }]
          : []
      }),
      universities,
      programs,
      officialUrl: safeExternalUrl(scholarship.official_url),
      applicationUrl: safeExternalUrl(scholarship.application_url),
      providerUrl: safeExternalUrl(scholarship.provider_url),
      verificationStatus: scholarship.verification_status ?? null,
      lastVerifiedAt: scholarship.last_verified_at ?? null,
      sourceConfidenceScore: scholarship.source_confidence_score ?? null,
      updatedAt: scholarship.updated_at ?? null,
      logoUrl: buildCloudinaryImageUrl(cloudName, scholarship.logo?.cloudinary_public_id),
      coverImageUrl: buildCloudinaryImageUrl(cloudName, scholarship.cover_image?.cloudinary_public_id),
      imageUrl: buildCloudinaryImageUrl(
        cloudName,
        scholarship.cover_image?.cloudinary_public_id ?? scholarship.logo?.cloudinary_public_id,
      ),
    },
  })
}
