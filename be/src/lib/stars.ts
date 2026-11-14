/**
 * Stars and points for one attempt. The server recomputes them from `berhasil` and `kemiripan`
 * (browser-sent `bintang`/`poin` are ignored), so points cannot be forged.
 *
 *  - Correct = the component reached the target AND the accuracy was at least 50%.
 *  - Not correct (accuracy under 50%, or target not reached): 0 stars, 0 points; the child repeats.
 *  - Accuracy 50% to under 70%: 1 star (10 points).
 *  - Accuracy 70% to under 90%: 2 stars (20 points).
 *  - Accuracy 90% to 100%: 3 stars (30 points).
 */
export const MIN_ACCURACY_CORRECT = 0.5;
export const SIMILARITY_FOR_TWO_STARS = 0.7;
export const SIMILARITY_FOR_THREE_STARS = 0.9;

export const isCorrect = (success: boolean, similarity: number) => success && similarity >= MIN_ACCURACY_CORRECT;

export function starsFor(success: boolean, similarity: number): 0 | 1 | 2 | 3 {
  if (!isCorrect(success, similarity)) return 0;
  if (similarity >= SIMILARITY_FOR_THREE_STARS) return 3;
  return similarity >= SIMILARITY_FOR_TWO_STARS ? 2 : 1;
}
