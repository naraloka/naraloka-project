import { describe, expect, it } from "vitest";
import { calculateMembershipPoolAllocations } from "./membershipRoyaltyLedger.js";

describe("calculateMembershipPoolAllocations", () => {
  it("membagi pool berdasarkan porsi halaman baca", () => {
    const result = calculateMembershipPoolAllocations({
      distributablePoolCents: 10000,
      reads: [
        { authorId: "author-a", ebookIds: ["ebook-a"], pagesRead: 75 },
        { authorId: "author-b", ebookIds: ["ebook-b"], pagesRead: 25 },
      ],
    });

    expect(result).toHaveLength(2);
    expect(result[0]).toMatchObject({
      authorId: "author-a",
      authorRoyaltyCents: 7500,
    });
    expect(result[1]).toMatchObject({
      authorId: "author-b",
      authorRoyaltyCents: 2500,
    });
  });

  it("menghabiskan seluruh pool setelah pembulatan", () => {
    const result = calculateMembershipPoolAllocations({
      distributablePoolCents: 10001,
      reads: [
        { authorId: "author-a", ebookIds: ["ebook-a"], pagesRead: 1 },
        { authorId: "author-b", ebookIds: ["ebook-b"], pagesRead: 1 },
        { authorId: "author-c", ebookIds: ["ebook-c"], pagesRead: 1 },
      ],
    });

    const total = result.reduce((sum, entry) => sum + entry.authorRoyaltyCents, 0);
    expect(total).toBe(10001);
  });
});
