// Safe for public pages and components. Does not import secrets.
// Only cloudinaryUrl() from url.ts is used here.
import { cloudinaryUrl } from '../cloudinary/url'

export type PublicMediaAsset = {
  cloudinary_public_id: string | null
  alt_text: string | null
  display_name: string | null
}

export function getPublicId(asset: PublicMediaAsset | null | undefined): string | null {
  return asset?.cloudinary_public_id ?? null
}

export function getAlt(asset: PublicMediaAsset | null | undefined, fallback: string): string {
  return asset?.alt_text || asset?.display_name || fallback
}

export function getOgImageUrl(
  cloudName: string,
  primary: PublicMediaAsset | null | undefined,
  fallback?: PublicMediaAsset | null | undefined,
): string | null {
  const publicId = primary?.cloudinary_public_id ?? fallback?.cloudinary_public_id ?? null
  if (!publicId) return null
  return cloudinaryUrl(cloudName, publicId, { width: 1200, height: 630, crop: 'fill' })
}
