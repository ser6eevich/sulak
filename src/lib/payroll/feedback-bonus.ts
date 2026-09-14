export type FeedbackType = 'none' | 'no_photo' | 'with_photo'

const BASE_BONUS: Record<Exclude<FeedbackType, 'none'>, number> = {
  no_photo: 300,
  with_photo: 500,
}

/**
 * Бонус за отзыв: базовая сумма относится к пяти звёздам,
 * четыре звезды уменьшают её на 100 ₽, три — ещё на 100 ₽.
 * Отзывы, заведённые до появления оценки, сохраняют прежнюю базовую сумму.
 */
export function getFeedbackBonus(feedbackType: FeedbackType, feedbackRating: number | null | undefined): number {
  if (feedbackType === 'none') return 0

  const baseBonus = BASE_BONUS[feedbackType]
  if (feedbackRating === 4) return baseBonus - 100
  if (feedbackRating === 3) return baseBonus - 200
  return baseBonus
}
