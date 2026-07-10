import type { APIRoute } from 'astro'
import {
  buildCloudinaryImageUrl,
  createPublicMobileClient,
  credentialsErrorResponse,
  internalErrorResponse,
  jsonResponse,
  teaserFromText,
} from '../../../lib/mobile/public'

export const GET: APIRoute = async () => {
  const supabase = createPublicMobileClient()
  if (!supabase) {
    return credentialsErrorResponse()
  }

  const cloudName = import.meta.env.PUBLIC_CLOUDINARY_CLOUD_NAME

  const { data, error } = await supabase
    .from('universities')
    .select(`
      id,
      slug,
      name,
      short_name,
      native_name,
      country_id,
      official_url,
      ranking_summary,
      overview,
      verification_status,
      last_verified_at,
      countries(name, iso2),
      cities(name),
      logo:media_assets!universities_logo_id_fkey(cloudinary_public_id)
    `)
    .eq('content_status', 'published')
    .order('name')

  if (error) {
    console.error('mobile universities list error:', error.message)
    return internalErrorResponse()
  }

  const payload = (data ?? []).map((university: any) => {
    const logoUrl = buildCloudinaryImageUrl(cloudName, university.logo?.cloudinary_public_id)

    return {
      id: university.id,
      slug: university.slug,
      name: university.name,
      shortName: university.short_name ?? null,
      nativeName: university.native_name ?? null,
      countryId: university.country_id ?? null,
      countryName: university.countries?.name ?? null,
      countryCode: university.countries?.iso2 ?? null,
      city: university.cities?.name ?? null,
      logoUrl,
      imageUrl: logoUrl,
      overview: university.overview ?? null,
      overviewTeaser: teaserFromText(university.overview, 180),
      officialUrl: university.official_url ?? null,
      verificationStatus: university.verification_status ?? null,
      lastVerifiedAt: university.last_verified_at ?? null,
      rankingSummary: university.ranking_summary ?? null,
      rankingSummaryTeaser: teaserFromText(university.ranking_summary, 180),
    }
  })

  return jsonResponse(200, payload)
}
