export const CONTRIBUTOR_APPLICATION_STATUSES = [
  'draft',
  'submitted',
  'pending_review',
  'needs_more_info',
  'approved',
  'rejected',
  'withdrawn',
  'suspended',
] as const

export type ContributorApplicationStatus =
  (typeof CONTRIBUTOR_APPLICATION_STATUSES)[number]

export const CONTRIBUTOR_PROFILE_REVIEW_STATUSES = [
  'pending_review',
  'approved',
  'rejected',
  'disabled',
  'suspended',
] as const

export type ContributorProfileReviewStatus =
  (typeof CONTRIBUTOR_PROFILE_REVIEW_STATUSES)[number]

export const CONTRIBUTOR_AFFILIATION_STATUSES = [
  'unverified',
  'email_verified',
  'affiliation_claimed',
  'affiliation_verified',
  'trusted_contributor',
  'official_partner',
  'suspended',
] as const

export type ContributorAffiliationStatus =
  (typeof CONTRIBUTOR_AFFILIATION_STATUSES)[number]

export const CONTRIBUTOR_AVATAR_SOURCES = [
  'google',
  'uploaded',
  'default_initials',
] as const

export type ContributorAvatarSource =
  (typeof CONTRIBUTOR_AVATAR_SOURCES)[number]

export const CONTRIBUTOR_AVATAR_REVIEW_STATUSES = [
  'not_needed',
  'pending_review',
  'approved',
  'rejected',
] as const

export type ContributorAvatarReviewStatus =
  (typeof CONTRIBUTOR_AVATAR_REVIEW_STATUSES)[number]

export const CONTRIBUTOR_SUBMISSION_STATUSES = [
  'draft',
  'submitted',
  'pending_review',
  'approved',
  'rejected',
  'needs_more_info',
  'withdrawn',
] as const

export type ContributorSubmissionStatus =
  (typeof CONTRIBUTOR_SUBMISSION_STATUSES)[number]

export type ContributorProfileVisibilityInput = {
  profileReviewStatus: ContributorProfileReviewStatus | null
  publicProfileEnabled: boolean | null
  publicAvatarEnabled: boolean | null
  avatarSource: ContributorAvatarSource | null
  avatarReviewStatus: ContributorAvatarReviewStatus | null
}
