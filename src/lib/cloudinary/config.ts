// SERVER-ONLY. Never import this file from browser code, client components,
// or any file that may be bundled for the client.
// It reads CLOUDINARY_API_SECRET which must never reach the browser.

export type { AllowedSubfolder } from './folders'
export { ALLOWED_SUBFOLDERS, isAllowedSubfolder } from './folders'

export type SignatureAlgorithm = 'sha256' | 'sha1'

export interface CloudinaryConfig {
  cloudName: string
  apiKey: string
  apiSecret: string
  uploadFolder: string
  signatureAlgorithm: SignatureAlgorithm
}

export function getCloudinaryConfig(): CloudinaryConfig {
  const cloudName = import.meta.env.PUBLIC_CLOUDINARY_CLOUD_NAME
  const apiKey = import.meta.env.CLOUDINARY_API_KEY
  const apiSecret = import.meta.env.CLOUDINARY_API_SECRET
  const uploadFolder = import.meta.env.CLOUDINARY_UPLOAD_FOLDER ?? 'degreewiki'
  const rawAlgorithm = import.meta.env.CLOUDINARY_SIGNATURE_ALGORITHM ?? 'sha256'

  if (!cloudName) throw new Error('PUBLIC_CLOUDINARY_CLOUD_NAME is not set')
  if (!apiKey) throw new Error('CLOUDINARY_API_KEY is not set')
  if (!apiSecret) throw new Error('CLOUDINARY_API_SECRET is not set')

  if (rawAlgorithm !== 'sha256' && rawAlgorithm !== 'sha1') {
    throw new Error('CLOUDINARY_SIGNATURE_ALGORITHM must be sha256 or sha1')
  }

  return {
    cloudName,
    apiKey,
    apiSecret,
    uploadFolder,
    signatureAlgorithm: rawAlgorithm as SignatureAlgorithm,
  }
}
