import { isContributorProfileApproved } from './status'
import type { ContributorProfileVisibilityInput } from './types'

export function isContributorProfilePublic(
  input: Pick<ContributorProfileVisibilityInput, 'profileReviewStatus' | 'publicProfileEnabled'>,
): boolean {
  return isContributorProfileApproved(input.profileReviewStatus)
    && input.publicProfileEnabled === true
}

export function isContributorAvatarPublic(
  input: ContributorProfileVisibilityInput,
): boolean {
  if (!isContributorProfilePublic(input)) return false
  if (input.publicAvatarEnabled !== true) return false
  if (!input.avatarSource) return false

  if (input.avatarSource === 'uploaded') {
    return input.avatarReviewStatus === 'approved'
  }

  return true
}
