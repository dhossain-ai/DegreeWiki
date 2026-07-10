import type { APIRoute } from 'astro'
import {
  abbreviateDegree,
  buildCloudinaryImageUrl,
  confidenceLabel,
  createPublicMobileClient,
  credentialsErrorResponse,
  formatDuration,
  formatRange,
  formatShortDate,
  formatTuitionSummary,
  internalErrorResponse,
  jsonResponse,
  normalizeFaq,
  notFoundResponse,
} from '../../../../lib/mobile/public'

export const GET: APIRoute = async ({ params }) => {
  const slug = params.slug?.trim()
  if (!slug) {
    return notFoundResponse('country_not_found')
  }

  const supabase = createPublicMobileClient()
  if (!supabase) {
    return credentialsErrorResponse()
  }

  const cloudName = import.meta.env.PUBLIC_CLOUDINARY_CLOUD_NAME

  const { data: country, error } = await supabase
    .from('countries')
    .select(`
      id,
      slug,
      name,
      iso2,
      iso3,
      continent,
      overview,
      verification_status,
      capital_city_name,
      currency_code,
      currency_name,
      official_language_names,
      common_study_language_names,
      popular_student_city_names,
      tuition_overview,
      living_cost_overview,
      admission_overview,
      visa_overview,
      student_work_rights_overview,
      post_study_work_overview,
      scholarship_overview,
      university_system_overview,
      required_documents_overview,
      intake_overview,
      tuition_min_annual,
      tuition_max_annual,
      tuition_currency,
      living_cost_min_monthly,
      living_cost_max_monthly,
      living_cost_currency,
      student_work_allowed,
      student_work_hours_text,
      post_study_work_available,
      post_study_work_duration_text,
      official_education_url,
      official_visa_url,
      faq_json,
      last_verified_at,
      source_confidence_score,
      updated_at,
      cover_image:media_assets!countries_cover_image_id_fkey(cloudinary_public_id),
      og_image:media_assets!countries_og_image_id_fkey(cloudinary_public_id)
    `)
    .eq('slug', slug)
    .eq('content_status', 'published')
    .eq('is_destination_enabled', true)
    .maybeSingle()

  if (error) {
    console.error('mobile country detail error:', error.message)
    return internalErrorResponse()
  }

  if (!country) {
    return notFoundResponse('country_not_found')
  }

  const countryInfo = country as any

  const [
    { data: relatedUniversities, error: relatedUniversitiesError },
    { data: relatedPrograms, error: relatedProgramsError },
  ] = await Promise.all([
    supabase
      .from('universities')
      .select(`
        id,
        slug,
        name,
        official_url,
        overview,
        ranking_summary,
        verification_status,
        last_verified_at,
        cities(name),
        logo:media_assets!universities_logo_id_fkey(cloudinary_public_id)
      `)
      .eq('content_status', 'published')
      .eq('country_id', countryInfo.id)
      .order('name')
      .limit(4),
    supabase
      .from('programs')
      .select(`
        id,
        slug,
        title,
        duration_months,
        language_of_instruction,
        tuition_min_amount,
        tuition_max_amount,
        tuition_currency,
        tuition_period,
        verification_status,
        last_verified_at,
        universities(
          name,
          slug,
          logo:media_assets!universities_logo_id_fkey(cloudinary_public_id)
        ),
        degree_levels(name, code),
        subjects!programs_primary_subject_id_fkey(name)
      `)
      .eq('content_status', 'published')
      .eq('country_id', countryInfo.id)
      .order('title')
      .limit(6),
  ])

  if (relatedUniversitiesError) {
    console.error('mobile country detail related universities error:', relatedUniversitiesError.message)
    return internalErrorResponse()
  }

  if (relatedProgramsError) {
    console.error('mobile country detail related programs error:', relatedProgramsError.message)
    return internalErrorResponse()
  }

  const imagePublicId = countryInfo.cover_image?.cloudinary_public_id ?? countryInfo.og_image?.cloudinary_public_id

  return jsonResponse(200, {
    ok: true,
    item: {
      id: countryInfo.id,
      slug: countryInfo.slug,
      name: countryInfo.name,
      iso2: countryInfo.iso2 ?? null,
      iso3: countryInfo.iso3 ?? null,
      continent: countryInfo.continent ?? null,
      overview: countryInfo.overview ?? null,
      destinationSummary: countryInfo.overview ?? null,
      imageUrl: buildCloudinaryImageUrl(cloudName, imagePublicId),
      capitalCityName: countryInfo.capital_city_name ?? null,
      currencyCode: countryInfo.currency_code ?? null,
      currencyName: countryInfo.currency_name ?? null,
      officialLanguages: Array.isArray(countryInfo.official_language_names) ? countryInfo.official_language_names : [],
      commonStudyLanguages: Array.isArray(countryInfo.common_study_language_names) ? countryInfo.common_study_language_names : [],
      popularStudentCities: Array.isArray(countryInfo.popular_student_city_names) ? countryInfo.popular_student_city_names : [],
      tuitionOverview: countryInfo.tuition_overview ?? null,
      livingCostOverview: countryInfo.living_cost_overview ?? null,
      admissionOverview: countryInfo.admission_overview ?? null,
      visaOverview: countryInfo.visa_overview ?? null,
      studentWorkRightsOverview: countryInfo.student_work_rights_overview ?? null,
      postStudyWorkOverview: countryInfo.post_study_work_overview ?? null,
      scholarshipSummary: countryInfo.scholarship_overview ?? null,
      universitySystemOverview: countryInfo.university_system_overview ?? null,
      requiredDocumentsOverview: countryInfo.required_documents_overview ?? null,
      intakeOverview: countryInfo.intake_overview ?? null,
      tuition: {
        minAnnual: countryInfo.tuition_min_annual != null ? Number(countryInfo.tuition_min_annual) : null,
        maxAnnual: countryInfo.tuition_max_annual != null ? Number(countryInfo.tuition_max_annual) : null,
        currency: countryInfo.tuition_currency ?? null,
        display: formatRange(countryInfo.tuition_min_annual, countryInfo.tuition_max_annual, countryInfo.tuition_currency, 'per year'),
      },
      livingCost: {
        minMonthly: countryInfo.living_cost_min_monthly != null ? Number(countryInfo.living_cost_min_monthly) : null,
        maxMonthly: countryInfo.living_cost_max_monthly != null ? Number(countryInfo.living_cost_max_monthly) : null,
        currency: countryInfo.living_cost_currency ?? null,
        display: formatRange(countryInfo.living_cost_min_monthly, countryInfo.living_cost_max_monthly, countryInfo.living_cost_currency, 'per month'),
      },
      studentWork: {
        allowed: countryInfo.student_work_allowed ?? null,
        hoursText: countryInfo.student_work_hours_text ?? null,
      },
      postStudyWork: {
        available: countryInfo.post_study_work_available ?? null,
        durationText: countryInfo.post_study_work_duration_text ?? null,
      },
      officialEducationUrl: countryInfo.official_education_url ?? null,
      officialVisaUrl: countryInfo.official_visa_url ?? null,
      faq: normalizeFaq(countryInfo.faq_json),
      verificationStatus: countryInfo.verification_status ?? null,
      lastVerifiedAt: countryInfo.last_verified_at ?? null,
      sourceConfidenceScore: countryInfo.source_confidence_score ?? null,
      sourceConfidenceLabel: confidenceLabel(countryInfo.source_confidence_score),
      updatedAt: countryInfo.updated_at ?? null,
      relatedUniversities: (relatedUniversities ?? []).map((university: any) => ({
        id: university.id,
        slug: university.slug,
        name: university.name,
        city: university.cities?.name ?? null,
        overview: university.overview ?? null,
        rankingSummary: university.ranking_summary ?? null,
        officialUrl: university.official_url ?? null,
        verificationStatus: university.verification_status ?? null,
        lastVerifiedAt: university.last_verified_at ?? null,
        sourceCheckedLabel: formatShortDate(university.last_verified_at),
        logoUrl: buildCloudinaryImageUrl(cloudName, university.logo?.cloudinary_public_id),
      })),
      relatedPrograms: (relatedPrograms ?? []).map((program: any) => {
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
          universityName: program.universities?.name ?? null,
          universitySlug: program.universities?.slug ?? null,
          degreeLevel: program.degree_levels?.name ?? null,
          degreeLevelCode: program.degree_levels?.code ?? null,
          degreeLevelShortLabel: abbreviateDegree(program.degree_levels?.code, program.degree_levels?.name),
          subject: program.subjects?.name ?? null,
          duration: formatDuration(program.duration_months),
          durationMonths: program.duration_months ?? null,
          language: program.language_of_instruction ?? null,
          tuitionDisplay: tuition.display,
          tuitionDetail: tuition.detail,
          verificationStatus: program.verification_status ?? null,
          lastVerifiedAt: program.last_verified_at ?? null,
          sourceCheckedLabel: formatShortDate(program.last_verified_at),
          imageUrl: buildCloudinaryImageUrl(cloudName, program.universities?.logo?.cloudinary_public_id),
        }
      }),
    },
  })
}
