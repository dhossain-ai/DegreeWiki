import type {
  ContributorApplicationStatus,
  ContributorProfileReviewStatus,
  ContributorSubmissionStatus,
} from './types'

export function isContributorApplicationEditableByOwner(
  status: ContributorApplicationStatus | null | undefined,
): boolean {
  return status === 'draft' || status === 'needs_more_info'
}

export function isContributorSubmissionEditableByOwner(
  status: ContributorSubmissionStatus | null | undefined,
): boolean {
  return status === 'draft' || status === 'needs_more_info'
}

export function isContributorProfileApproved(
  status: ContributorProfileReviewStatus | null | undefined,
): boolean {
  return status === 'approved'
}
