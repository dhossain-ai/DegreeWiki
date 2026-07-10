import type { APIRoute } from 'astro'
import {
  abbreviateDegree,
  buildCloudinaryImageUrl,
  createPublicMobileClient,
  credentialsErrorResponse,
  formatDuration,
  formatEnglishRequirements,
  formatIntakeLabel,
  formatLocation,
  formatLongDate,
  formatMoney,
  formatTuitionSummary,
  internalErrorResponse,
  jsonResponse,
  notFoundResponse,
} from '../../../../lib/mobile/public'

export const GET: APIRoute = async ({ params }) => {
  const slug = params.slug?.trim()
  if (!slug) {
    return notFoundResponse('program_not_found')
  }

  const supabase = createPublicMobileClient()
  if (!supabase) {
    return credentialsErrorResponse()
  }

  const cloudName = import.meta.env.PUBLIC_CLOUDINARY_CLOUD_NAME

  const { data: program, error } = await supabase
    .from('programs')
    .select(`
      id,
      slug,
      title,
      university_id,
      degree_level_id,
      primary_subject_id,
      country_id,
      city_id,
      degree_award,
      duration_months,
      study_mode,
      delivery_mode,
      language_of_instruction,
      tuition_min_amount,
      tuition_max_amount,
      tuition_currency,
      tuition_period,
      tuition_notes,
      application_fee_amount,
      application_fee_currency,
      application_fee_notes,
      application_url,
      official_url,
      admission_requirements,
      english_requirements,
      gpa_requirements,
      curriculum_summary,
      career_outcomes,
      verification_status,
      last_verified_at,
      source_confidence_score,
      updated_at,
      universities(
        name,
        slug,
        logo:media_assets!universities_logo_id_fkey(cloudinary_public_id),
        cover_image:media_assets!universities_cover_image_id_fkey(cloudinary_public_id)
      ),
      degree_levels(name, code),
      subjects!programs_primary_subject_id_fkey(name),
      countries(name, iso2),
      cities(name)
    `)
    .eq('slug', slug)
    .eq('content_status', 'published')
    .maybeSingle()

  if (error) {
    console.error('mobile program detail error:', error.message)
    return internalErrorResponse()
  }

  if (!program) {
    return notFoundResponse('program_not_found')
  }

  const programInfo = program as any

  const { data: intakes, error: intakesError } = await supabase
    .from('program_intakes')
    .select(`
      intake_name,
      intake_month,
      intake_year,
      application_open_date,
      application_deadline_date,
      deadline_text,
      deadline_status,
      is_rolling,
      notes
    `)
    .eq('program_id', programInfo.id)
    .order('application_deadline_date', { ascending: true, nullsFirst: false })
    .limit(10)

  if (intakesError) {
    console.error('mobile program detail intakes error:', intakesError.message)
    return internalErrorResponse()
  }

  const tuition = formatTuitionSummary(
    programInfo.tuition_min_amount,
    programInfo.tuition_max_amount,
    programInfo.tuition_currency,
    programInfo.tuition_period,
  )
  const applicationFeeDisplay = formatMoney(programInfo.application_fee_amount, programInfo.application_fee_currency)
  const englishRequirements = formatEnglishRequirements(programInfo.english_requirements)
  const featuredIntake = (intakes ?? []).find((intake: any) =>
    intake.is_rolling ||
    intake.application_deadline_date ||
    intake.deadline_text ||
    formatIntakeLabel(intake)
  ) ?? null

  const nextIntake = featuredIntake ? formatIntakeLabel(featuredIntake) : null
  const nextDeadline = featuredIntake
    ? featuredIntake.is_rolling
      ? 'Rolling admissions'
      : formatLongDate(featuredIntake.application_deadline_date) ?? featuredIntake.deadline_text ?? null
    : null

  return jsonResponse(200, {
    ok: true,
    item: {
      id: programInfo.id,
      slug: programInfo.slug,
      title: programInfo.title,
      university: {
        id: programInfo.university_id ?? null,
        slug: programInfo.universities?.slug ?? null,
        name: programInfo.universities?.name ?? null,
        logoUrl: buildCloudinaryImageUrl(cloudName, programInfo.universities?.logo?.cloudinary_public_id),
        coverImageUrl: buildCloudinaryImageUrl(cloudName, programInfo.universities?.cover_image?.cloudinary_public_id),
      },
      country: {
        id: programInfo.country_id ?? null,
        name: programInfo.countries?.name ?? null,
        code: programInfo.countries?.iso2 ?? null,
      },
      city: {
        id: programInfo.city_id ?? null,
        name: programInfo.cities?.name ?? null,
      },
      location: formatLocation(programInfo.cities?.name, programInfo.countries?.name),
      degreeLevel: {
        id: programInfo.degree_level_id ?? null,
        name: programInfo.degree_levels?.name ?? null,
        code: programInfo.degree_levels?.code ?? null,
        shortLabel: abbreviateDegree(programInfo.degree_levels?.code, programInfo.degree_levels?.name),
      },
      subject: {
        id: programInfo.primary_subject_id ?? null,
        name: programInfo.subjects?.name ?? null,
      },
      degreeAward: programInfo.degree_award ?? null,
      duration: formatDuration(programInfo.duration_months),
      durationMonths: programInfo.duration_months ?? null,
      language: programInfo.language_of_instruction ?? null,
      studyMode: programInfo.study_mode ?? null,
      studyModeLabel: programInfo.study_mode ? programInfo.study_mode.replace(/_/g, ' ') : null,
      deliveryMode: programInfo.delivery_mode ?? null,
      deliveryModeLabel: programInfo.delivery_mode ? programInfo.delivery_mode.replace(/_/g, ' ') : null,
      tuition: {
        minAmount: programInfo.tuition_min_amount != null ? Number(programInfo.tuition_min_amount) : null,
        maxAmount: programInfo.tuition_max_amount != null ? Number(programInfo.tuition_max_amount) : null,
        currency: programInfo.tuition_currency ?? null,
        period: programInfo.tuition_period ?? null,
        notes: programInfo.tuition_notes ?? null,
        display: tuition.display,
        detail: tuition.detail,
      },
      applicationFee: {
        amount: programInfo.application_fee_amount != null ? Number(programInfo.application_fee_amount) : null,
        currency: programInfo.application_fee_currency ?? null,
        notes: programInfo.application_fee_notes ?? null,
        display: applicationFeeDisplay,
      },
      nextIntake,
      nextDeadline,
      intakes: (intakes ?? []).map((intake: any) => ({
        label: formatIntakeLabel(intake),
        intakeName: intake.intake_name ?? null,
        intakeMonth: intake.intake_month ?? null,
        intakeYear: intake.intake_year ?? null,
        applicationOpenDate: intake.application_open_date ?? null,
        applicationDeadlineDate: intake.application_deadline_date ?? null,
        deadlineText: intake.deadline_text ?? null,
        deadlineStatus: intake.deadline_status ?? null,
        isRolling: intake.is_rolling ?? false,
        notes: intake.notes ?? null,
      })),
      admissionRequirements: programInfo.admission_requirements ?? null,
      englishRequirements,
      gpaRequirements: programInfo.gpa_requirements ?? null,
      documents: null,
      curriculumSummary: programInfo.curriculum_summary ?? null,
      careerOutcomes: programInfo.career_outcomes ?? null,
      officialUrl: programInfo.official_url ?? null,
      applicationUrl: programInfo.application_url ?? null,
      verificationStatus: programInfo.verification_status ?? null,
      lastVerifiedAt: programInfo.last_verified_at ?? null,
      sourceConfidenceScore: programInfo.source_confidence_score ?? null,
      updatedAt: programInfo.updated_at ?? null,
      imageUrl: buildCloudinaryImageUrl(cloudName, programInfo.universities?.logo?.cloudinary_public_id),
      coverImageUrl: buildCloudinaryImageUrl(cloudName, programInfo.universities?.cover_image?.cloudinary_public_id),
    },
  })
}
