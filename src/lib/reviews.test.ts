import { describe, expect, it } from "vitest";
import { getReviewSummaryForEbook } from "@/lib/reviews";
import type { Ebook, Review } from "@/types/domain";

const ebook: Ebook = {
  id: "ebook_1",
  title: "Buku Uji",
  authorId: "author_1",
  coverUrl: "https://example.com/cover.jpg",
  category: "Novel",
  description: "Buku untuk pengujian.",
  ratingAvg: 4.5,
  ratingCount: 10,
  priceCents: 0,
  access: "OPEN",
  isBestSeller: false,
  isFeatured: false,
  publishedAtISO: "2026-06-13T00:00:00.000Z",
  pageCount: 20,
  tags: ["uji"],
  previewPages: ["a"],
  pages: ["a", "b"],
};

function makeReview(input: Partial<Review>): Review {
  return {
    id: input.id || "rvw_1",
    ebookId: input.ebookId || ebook.id,
    userId: input.userId || "user_1",
    userName: input.userName || "Pembaca",
    rating: input.rating || 5,
    comment: input.comment || "Bagus",
    createdAtISO: input.createdAtISO || "2026-06-13T10:00:00.000Z",
    updatedAtISO: input.updatedAtISO || "2026-06-13T10:00:00.000Z",
  };
}

describe("reviews summary", () => {
  it("menggabungkan rating dasar ebook dengan review pembaca baru", () => {
    const summary = getReviewSummaryForEbook(ebook, [
      makeReview({ id: "rvw_1", rating: 5 }),
      makeReview({ id: "rvw_2", rating: 3, userId: "user_2" }),
    ]);

    expect(summary.ratingCount).toBe(12);
    expect(summary.ratingAvg).toBeCloseTo(4.42, 2);
    expect(summary.visibleReviews).toHaveLength(2);
  });

  it("tetap memakai rating dasar ebook jika belum ada review pembaca", () => {
    const summary = getReviewSummaryForEbook(ebook, []);

    expect(summary.ratingCount).toBe(10);
    expect(summary.ratingAvg).toBe(4.5);
    expect(summary.visibleReviews).toHaveLength(0);
  });
});
