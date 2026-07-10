import type { APIRoute } from 'astro'
import {
  abbreviateDegree,
  buildCloudinaryImageUrl,
  createPublicMobileClient,
  credentialsErrorResponse,
  formatDuration,
  formatLocation,
  formatTuitionSummary,
  internalErrorResponse,
  jsonResponse,
} from '../../../lib/mobile/public'

export const GET: APIRoute = async () => {
  const supabase = createPublicMobileClient()
  if (!supabase) {
    return credentialsErrorResponse()
  }

  const cloudName = import.meta.env.PUBLIC_CLOUDINARY_CLOUD_NAME

  const { data, error } = await supabase
    .from('programs')
    .select(`
      id,
      slug,
      title,
      university_id,
      country_id,
      city_id,
      duration_months,
      study_mode,
      delivery_mode,
      language_of_instruction,
      tuition_min_amount,
      tuition_max_amount,
      tuition_currency,
      tuition_period,
      official_url,
      verification_status,
      last_verified_at,
      universities(
        name,
        slug,
        logo:media_assets!universities_logo_id_fkey(cloudinary_public_id)
      ),
      countries(name, iso2),
      cities(name),
      degree_levels(name, code),
      subjects!programs_primary_subject_id_fkey(name)
    `)
    .eq('content_status', 'published')
    .order('title')

  if (error) {
    console.error('mobile programs list error:', error.message)
    return internalErrorResponse()
  }

  const payload = (data ?? []).map((program: any) => {
    const tuition = formatTuitionSummary(
      program.tuition_min_amount,
      program.tuition_max_amount,
      program.tuition_currency,
      program.tuition_period,
    )

    return {
      id: program.id,
      slug: program.slug,
      title: program.title,
      universityId: program.university_id ?? null,
      universitySlug: program.universities?.slug ?? null,
      universityName: program.universities?.name ?? '',
      countryId: program.country_id ?? null,
      countryCode: program.countries?.iso2 ?? null,
      countryName: program.countries?.name ?? '',
      cityId: program.city_id ?? null,
      city: program.cities?.name ?? null,
      location: formatLocation(program.cities?.name, program.countries?.name),
      degreeLevel: program.degree_levels?.name ?? '',
      degreeLevelCode: program.degree_levels?.code ?? null,
      degreeLevelShortLabel: abbreviateDegree(program.degree_levels?.code, program.degree_levels?.name),
      subject: program.subjects?.name ?? null,
      tuition: program.tuition_min_amount != null ? Number(program.tuition_min_amount) : null,
      tuitionMinAmount: program.tuition_min_amount != null ? Number(program.tuition_min_amount) : null,
      tuitionMaxAmount: program.tuition_max_amount != null ? Number(program.tuition_max_amount) : null,
      tuitionCurrency: program.tuition_currency ?? null,
      tuitionPeriod: program.tuition_period ?? null,
      tuitionDisplay: tuition.display,
      duration: formatDuration(program.duration_months),
      durationMonths: program.duration_months ?? null,
      language: program.language_of_instruction ?? null,
      studyMode: program.study_mode ?? null,
      deliveryMode: program.delivery_mode ?? null,
      officialUrl: program.official_url ?? null,
      verificationStatus: program.verification_status ?? null,
      lastVerifiedAt: program.last_verified_at ?? null,
      imageUrl: buildCloudinaryImageUrl(cloudName, program.universities?.logo?.cloudinary_public_id),
    }
  })

  return jsonResponse(200, payload)
}
