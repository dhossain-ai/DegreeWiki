import type { APIRoute } from 'astro'
import {
  abbreviateDegree,
  buildCloudinaryImageUrl,
  createPublicMobileClient,
  credentialsErrorResponse,
  formatDuration,
  formatShortDate,
  formatTuitionSummary,
  internalErrorResponse,
  jsonResponse,
  notFoundResponse,
} from '../../../../lib/mobile/public'

export const GET: APIRoute = async ({ params }) => {
  const slug = params.slug?.trim()
  if (!slug) {
    return notFoundResponse('university_not_found')
  }

  const supabase = createPublicMobileClient()
  if (!supabase) {
    return credentialsErrorResponse()
  }

  const cloudName = import.meta.env.PUBLIC_CLOUDINARY_CLOUD_NAME

  const { data: university, error } = await supabase
    .from('universities')
    .select(`
      id,
      slug,
      name,
      short_name,
      native_name,
      institution_type,
      ownership_type,
      founded_year,
      student_count,
      country_id,
      city_id,
      official_url,
      ranking_summary,
      ranking_source_url,
      overview,
      campus_summary,
      admission_overview,
      application_overview,
      application_portal_url,
      international_admissions_url,
      admission_email,
      language_requirement_overview,
      scholarship_overview,
      housing_overview,
      student_life_overview,
      international_student_overview,
      career_support_overview,
      verification_status,
      last_verified_at,
      source_confidence_score,
      updated_at,
      countries(name, iso2),
      cities(name),
      logo:media_assets!universities_logo_id_fkey(cloudinary_public_id),
      cover_image:media_assets!universities_cover_image_id_fkey(cloudinary_public_id)
    `)
    .eq('slug', slug)
    .eq('content_status', 'published')
    .maybeSingle()

  if (error) {
    console.error('mobile university detail error:', error.message)
    return internalErrorResponse()
  }

  if (!university) {
    return notFoundResponse('university_not_found')
  }

  const universityInfo = university as any

  const { data: relatedPrograms, error: relatedProgramsError } = await supabase
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
      degree_levels(name, code),
      subjects!programs_primary_subject_id_fkey(name)
    `)
    .eq('content_status', 'published')
    .eq('university_id', universityInfo.id)
    .order('title')
    .limit(3)

  if (relatedProgramsError) {
    console.error('mobile university detail related programs error:', relatedProgramsError.message)
    return internalErrorResponse()
  }

  return jsonResponse(200, {
    ok: true,
    item: {
      id: universityInfo.id,
      slug: universityInfo.slug,
      name: universityInfo.name,
      shortName: universityInfo.short_name ?? null,
      nativeName: universityInfo.native_name ?? null,
      institutionType: universityInfo.institution_type ?? null,
      ownershipType: universityInfo.ownership_type ?? null,
      foundedYear: universityInfo.founded_year ?? null,
      studentCount: universityInfo.student_count ?? null,
      country: {
        id: universityInfo.country_id ?? null,
        name: universityInfo.countries?.name ?? null,
        code: universityInfo.countries?.iso2 ?? null,
      },
      city: {
        id: universityInfo.city_id ?? null,
        name: universityInfo.cities?.name ?? null,
      },
      logoUrl: buildCloudinaryImageUrl(cloudName, universityInfo.logo?.cloudinary_public_id),
      imageUrl: buildCloudinaryImageUrl(cloudName, universityInfo.logo?.cloudinary_public_id),
      coverImageUrl: buildCloudinaryImageUrl(cloudName, universityInfo.cover_image?.cloudinary_public_id),
      overview: universityInfo.overview ?? null,
      officialUrl: universityInfo.official_url ?? null,
      admissionsUrl: universityInfo.application_portal_url ?? null,
      internationalAdmissionsUrl: universityInfo.international_admissions_url ?? null,
      admissionsContact: universityInfo.admission_email ?? null,
      rankingSummary: universityInfo.ranking_summary ?? null,
      rankingSourceUrl: universityInfo.ranking_source_url ?? null,
      campusSummary: universityInfo.campus_summary ?? null,
      admissionOverview: universityInfo.admission_overview ?? null,
      applicationOverview: universityInfo.application_overview ?? null,
      languageRequirementsSummary: universityInfo.language_requirement_overview ?? null,
      scholarshipsSummary: universityInfo.scholarship_overview ?? null,
      housingSummary: universityInfo.housing_overview ?? null,
      studentLifeSummary: universityInfo.student_life_overview ?? null,
      internationalStudentSummary: universityInfo.international_student_overview ?? null,
      careerSupportSummary: universityInfo.career_support_overview ?? null,
      verificationStatus: universityInfo.verification_status ?? null,
      lastVerifiedAt: universityInfo.last_verified_at ?? null,
      sourceConfidenceScore: universityInfo.source_confidence_score ?? null,
      updatedAt: universityInfo.updated_at ?? null,
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
        }
      }),
    },
  })
}
