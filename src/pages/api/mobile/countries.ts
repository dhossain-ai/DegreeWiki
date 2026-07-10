import type { APIRoute } from 'astro'
import {
  buildCloudinaryImageUrl,
  createPublicMobileClient,
  credentialsErrorResponse,
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
    .from('countries')
    .select(`
      id,
      slug,
      name,
      iso2,
      continent,
      overview,
      currency_code,
      currency_name,
      tuition_overview,
      living_cost_overview,
      verification_status,
      last_verified_at,
      cover_image:media_assets!countries_cover_image_id_fkey(cloudinary_public_id),
      og_image:media_assets!countries_og_image_id_fkey(cloudinary_public_id)
    `)
    .eq('content_status', 'published')
    .eq('is_destination_enabled', true)
    .order('name')

  if (error) {
    console.error('mobile countries list error:', error.message)
    return internalErrorResponse()
  }

  const payload = (data ?? []).map((country: any) => {
    const publicId = country.cover_image?.cloudinary_public_id ?? country.og_image?.cloudinary_public_id

    return {
      id: country.id,
      slug: country.slug,
      name: country.name,
      iso2: country.iso2 ?? null,
      continent: country.continent ?? null,
      summary: country.overview ?? null,
      imageUrl: buildCloudinaryImageUrl(cloudName, publicId),
      currencyCode: country.currency_code ?? null,
      currencyName: country.currency_name ?? null,
      tuitionOverview: country.tuition_overview ?? null,
      livingCostOverview: country.living_cost_overview ?? null,
      verificationStatus: country.verification_status ?? null,
      lastVerifiedAt: country.last_verified_at ?? null,
    }
  })

  return jsonResponse(200, payload)
}
