import { getReviewSummaryForEbook } from "@/lib/reviews";
import { usePublishingStore } from "@/stores/publishingStore";

export function useCatalogEbooks() {
  const publishedEbooks = usePublishingStore((s) => s.publishedEbooks);
  const reviews = usePublishingStore((s) => s.reviews);
  return publishedEbooks.map((ebook) => {
    const summary = getReviewSummaryForEbook(ebook, reviews);
    return {
      ...ebook,
      ratingAvg: summary.ratingAvg,
      ratingCount: summary.ratingCount,
    };
  });
}
