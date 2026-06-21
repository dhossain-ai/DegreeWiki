// Safe for import in public and server code.
// Does NOT import config.ts — no secrets are used here.
// Only PUBLIC_CLOUDINARY_CLOUD_NAME is needed for delivery URLs.

export interface CloudinaryUrlOpts {
  width?: number
  height?: number
  crop?: 'fill' | 'fit' | 'scale' | 'thumb' | 'pad'
}

export function cloudinaryUrl(
  cloudName: string,
  publicId: string,
  opts: CloudinaryUrlOpts = {},
): string {
  const transforms: string[] = ['f_auto', 'q_auto']
  if (opts.width)  transforms.push(`w_${opts.width}`)
  if (opts.height) transforms.push(`h_${opts.height}`)
  if (opts.crop)   transforms.push(`c_${opts.crop}`)
  const t = transforms.join(',')
  return `https://res.cloudinary.com/${cloudName}/image/upload/${t}/${publicId}`
}
