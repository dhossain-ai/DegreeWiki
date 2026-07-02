export type FitMatchTone = 'strong' | 'good' | 'possible' | 'ambitious' | 'review'

export interface FitMatchLabelResult {
  label: string
  tone: FitMatchTone
}

export function getFitMatchLabel(
  score: number | null | undefined,
  reasonsCount: number,
  warningsCount: number,
): FitMatchLabelResult {
  const safeScore = Number.isFinite(score) ? Number(score) : 0

  if (safeScore >= 80 && warningsCount <= 1) {
    return { label: 'Strong match', tone: 'strong' }
  }

  if (safeScore >= 60) {
    return { label: 'Good match', tone: 'good' }
  }

  if (safeScore >= 40) {
    return { label: 'Possible match', tone: 'possible' }
  }

  if (safeScore >= 20 || reasonsCount >= 2) {
    return { label: 'Ambitious', tone: 'ambitious' }
  }

  return { label: 'Needs review', tone: 'review' }
}
