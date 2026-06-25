// Static badge class maps for Tailwind v4 scanner compatibility.
// All values are literal strings — never construct class names dynamically.

export const CONTENT_STATUS_BADGE: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-600',
  in_review: 'bg-yellow-100 text-yellow-700',
  published: 'bg-green-100 text-green-700',
  unpublished: 'bg-orange-100 text-orange-700',
  archived: 'bg-red-100 text-red-600',
}

export const VERIFICATION_STATUS_BADGE: Record<string, string> = {
  unverified: 'bg-gray-100 text-gray-600',
  partially_verified: 'bg-amber-100 text-amber-700',
  verified: 'bg-green-100 text-green-700',
  source_conflict: 'bg-red-100 text-red-600',
  outdated: 'bg-orange-100 text-orange-700',
  needs_review: 'bg-yellow-100 text-yellow-700',
}

export const IMPORT_STATUS_BADGE: Record<string, string> = {
  pending: 'bg-gray-100 text-gray-600',
  processing: 'bg-blue-100 text-blue-700',
  validated: 'bg-cyan-100 text-cyan-700',
  duplicate_detected: 'bg-yellow-100 text-yellow-700',
  approved: 'bg-green-100 text-green-700',
  rejected: 'bg-red-100 text-red-600',
  error: 'bg-red-200 text-red-800',
  skipped: 'bg-gray-100 text-gray-400',
  merged: 'bg-emerald-100 text-emerald-700',
}

export const BATCH_TYPE_BADGE: Record<string, string> = {
  universities: 'bg-blue-100 text-blue-700',
  programs: 'bg-purple-100 text-purple-700',
  scholarships: 'bg-orange-100 text-orange-700',
  articles: 'bg-teal-100 text-teal-700',
  mixed: 'bg-gray-100 text-gray-600',
}

export const QUALITY_RESULT_BADGE: Record<string, string> = {
  pass: 'bg-green-100 text-green-700',
  fail: 'bg-red-100 text-red-600',
  warning: 'bg-yellow-100 text-yellow-700',
}

export const ACCOUNT_STATUS_BADGE: Record<string, string> = {
  active: 'bg-green-100 text-green-700',
  disabled: 'bg-gray-100 text-gray-500',
  suspended: 'bg-orange-100 text-orange-700',
  deleted: 'bg-red-100 text-red-600',
  pending_review: 'bg-yellow-100 text-yellow-700',
}

export const FALLBACK_BADGE = 'bg-gray-100 text-gray-500'
