// Safe for public pages and components. Does not import secrets.
// Only cloudinaryUrl() from url.ts is used here.
import { cloudinaryUrl } from '../cloudinary/url'

export type PublicMediaAsset = {
  cloudinary_public_id: string | null
  alt_text: string | null
  display_name: string | null
}

function normalizeText(value: string | null | undefined): string {
  return typeof value === 'string' ? value.trim() : ''
}

export function getPublicId(asset: PublicMediaAsset | null | undefined): string | null {
  const publicId = normalizeText(asset?.cloudinary_public_id)
  return publicId || null
}

export function getAlt(asset: PublicMediaAsset | null | undefined, fallback: string): string {
  return normalizeText(asset?.alt_text) || normalizeText(asset?.display_name) || normalizeText(fallback) || 'DegreeWiki image'
}

export function getOgImageUrl(
  cloudName: string,
  primary: PublicMediaAsset | null | undefined,
  fallback?: PublicMediaAsset | null | undefined,
): string | null {
  const normalizedCloudName = normalizeText(cloudName)
  const publicId = getPublicId(primary) ?? getPublicId(fallback) ?? null
  if (!normalizedCloudName || !publicId) return null
  return cloudinaryUrl(normalizedCloudName, publicId, { width: 1200, height: 630, crop: 'fill' })
}
