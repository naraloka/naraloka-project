import type { Ebook, Review } from "@/types/domain";

export function getVisibleReviews(reviews: Review[]) {
  return reviews;
}

export function getReviewSummaryForEbook(ebook: Ebook, reviews: Review[]) {
  const visibleReviews = getVisibleReviews(reviews).filter((review) => review.ebookId === ebook.id);
  if (!visibleReviews.length) {
    return {
      ratingAvg: ebook.ratingAvg,
      ratingCount: ebook.ratingCount,
      visibleReviews,
    };
  }

  const approvedSum = visibleReviews.reduce((sum, review) => sum + review.rating, 0);
  const baseWeighted = ebook.ratingAvg * ebook.ratingCount;
  const nextCount = ebook.ratingCount + visibleReviews.length;
  const nextAvg = nextCount > 0 ? (baseWeighted + approvedSum) / nextCount : 0;

  return {
    ratingAvg: Number(nextAvg.toFixed(2)),
    ratingCount: nextCount,
    visibleReviews,
  };
}

export function sortReviewsNewestFirst(reviews: Review[]) {
  return [...reviews].sort(
    (a, b) =>
      +new Date(b.updatedAtISO || b.createdAtISO) - +new Date(a.updatedAtISO || a.createdAtISO)
  );
}
