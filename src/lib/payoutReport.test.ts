import { describe, expect, it } from "vitest";
import {
  buildPayoutReportCsv,
  createPayoutReportRows,
  filterPayoutReportRows,
  summarizePayoutReportByAuthor,
} from "@/lib/payoutReport";

describe("payoutReport", () => {
  it("membuat baris laporan gabungan dari ledger paid dan membership", () => {
    const rows = createPayoutReportRows({
      royaltyEntries: [
        {
          orderId: "order-paid-1",
          authorId: "author-1",
          userId: "reader-1",
          ebookId: "ebook-1",
          itemLabel: "Novel Paid",
          grossAmountCents: 50000,
          platformCommissionPct: 30,
          platformCommissionCents: 15000,
          authorRoyaltyPct: 70,
          authorRoyaltyCents: 35000,
          paymentMethod: "QRIS",
          paymentStatus: "SUCCESS",
          transactionState: "SUCCESS",
          status: "AVAILABLE",
          payoutReference: "TRF-1",
          payoutNote: "Siap bayar",
          earnedAtISO: "2026-06-12T10:00:00.000Z",
          processingAtISO: undefined,
          paidAtISO: undefined,
          createdAtISO: "2026-06-12T10:00:00.000Z",
          updatedAtISO: "2026-06-12T10:00:00.000Z",
        },
      ],
      membershipEntries: [
        {
          entryId: "membership-1::author-2",
          orderId: "membership-1",
          buyerUserId: "reader-9",
          authorId: "author-2",
          membershipPlan: "PREMIUM",
          itemLabel: "Membership Premium Juni",
          poolAmountCents: 100000,
          platformCommissionPct: 40,
          platformCommissionCents: 40000,
          distributablePoolCents: 60000,
          allocationBasisPages: 120,
          allocationRatio: 0.25,
          authorRoyaltyCents: 15000,
          status: "PROCESSING",
          paymentStatus: "SUCCESS",
          payoutReference: "",
          payoutNote: "",
          sourceEbookIds: ["ebook-2", "ebook-3"],
          earnedAtISO: "2026-06-12T12:00:00.000Z",
          processingAtISO: "2026-06-12T13:00:00.000Z",
          paidAtISO: undefined,
          createdAtISO: "2026-06-12T12:00:00.000Z",
          updatedAtISO: "2026-06-12T13:00:00.000Z",
        },
      ],
      resolveAuthorName: (authorId) => `Nama ${authorId}`,
    });

    expect(rows).toHaveLength(2);
    expect(rows[0].sourceType).toBe("MEMBERSHIP_POOL");
    expect(rows[1].sourceType).toBe("PAID_BOOK");
  });

  it("menghasilkan CSV yang aman untuk koma dan kutip", () => {
    const csv = buildPayoutReportCsv([
      {
        sourceType: "PAID_BOOK",
        entryId: "order-1",
        orderId: "order-1",
        authorId: "author-1",
        authorName: 'Naraloka, "Studio"',
        buyerUserId: "reader-1",
        ebookIds: "ebook-1",
        membershipPlan: "",
        itemLabel: "Judul, Buku",
        grossAmountCents: 10000,
        poolAmountCents: 0,
        distributablePoolCents: 0,
        platformCommissionPct: 30,
        platformCommissionCents: 3000,
        authorRoyaltyPct: 70,
        authorRoyaltyCents: 7000,
        allocationBasisPages: 0,
        allocationRatioPct: "",
        paymentMethod: "QRIS",
        paymentStatus: "SUCCESS",
        transactionState: "SUCCESS",
        payoutStatus: "AVAILABLE",
        payoutReference: "",
        payoutNote: "",
        earnedAtISO: "2026-06-12T10:00:00.000Z",
        processingAtISO: "",
        paidAtISO: "",
        updatedAtISO: "2026-06-12T10:00:00.000Z",
      },
    ]);

    expect(csv).toContain('"Naraloka, ""Studio"""');
    expect(csv).toContain('"Judul, Buku"');
  });

  it("memfilter laporan berdasarkan tanggal, status, dan penulis", () => {
    const rows = createPayoutReportRows({
      royaltyEntries: [
        {
          orderId: "order-paid-1",
          authorId: "author-1",
          userId: "reader-1",
          ebookId: "ebook-1",
          itemLabel: "Novel Paid",
          grossAmountCents: 50000,
          platformCommissionPct: 30,
          platformCommissionCents: 15000,
          authorRoyaltyPct: 70,
          authorRoyaltyCents: 35000,
          paymentMethod: "QRIS",
          paymentStatus: "SUCCESS",
          transactionState: "SUCCESS",
          status: "AVAILABLE",
          payoutReference: "",
          payoutNote: "",
          earnedAtISO: "2026-06-11T10:00:00.000Z",
          processingAtISO: undefined,
          paidAtISO: undefined,
          createdAtISO: "2026-06-11T10:00:00.000Z",
          updatedAtISO: "2026-06-11T10:00:00.000Z",
        },
      ],
      membershipEntries: [
        {
          entryId: "membership-1::author-2",
          orderId: "membership-1",
          buyerUserId: "reader-9",
          authorId: "author-2",
          membershipPlan: "PREMIUM",
          itemLabel: "Membership Premium Juni",
          poolAmountCents: 100000,
          platformCommissionPct: 40,
          platformCommissionCents: 40000,
          distributablePoolCents: 60000,
          allocationBasisPages: 120,
          allocationRatio: 0.25,
          authorRoyaltyCents: 15000,
          status: "PAID",
          paymentStatus: "SUCCESS",
          payoutReference: "",
          payoutNote: "",
          sourceEbookIds: ["ebook-2"],
          earnedAtISO: "2026-06-12T12:00:00.000Z",
          processingAtISO: "2026-06-12T13:00:00.000Z",
          paidAtISO: "2026-06-13T09:00:00.000Z",
          createdAtISO: "2026-06-12T12:00:00.000Z",
          updatedAtISO: "2026-06-13T09:00:00.000Z",
        },
      ],
      resolveAuthorName: (authorId) => `Nama ${authorId}`,
    });

    const filtered = filterPayoutReportRows(rows, {
      startDate: "2026-06-13",
      endDate: "2026-06-13",
      payoutStatus: "PAID",
      authorId: "author-2",
      sourceType: "MEMBERSHIP_POOL",
    });

    expect(filtered).toHaveLength(1);
    expect(filtered[0]).toMatchObject({
      sourceType: "MEMBERSHIP_POOL",
      authorId: "author-2",
      payoutStatus: "PAID",
    });
  });

  it("merangkum total payout per penulis dari hasil filter", () => {
    const summary = summarizePayoutReportByAuthor([
      {
        sourceType: "PAID_BOOK",
        entryId: "order-1",
        orderId: "order-1",
        authorId: "author-1",
        authorName: "Penulis A",
        buyerUserId: "reader-1",
        ebookIds: "ebook-1",
        membershipPlan: "",
        itemLabel: "Novel A",
        grossAmountCents: 50000,
        poolAmountCents: 0,
        distributablePoolCents: 0,
        platformCommissionPct: 30,
        platformCommissionCents: 15000,
        authorRoyaltyPct: 70,
        authorRoyaltyCents: 35000,
        allocationBasisPages: 0,
        allocationRatioPct: "",
        paymentMethod: "QRIS",
        paymentStatus: "SUCCESS",
        transactionState: "SUCCESS",
        payoutStatus: "AVAILABLE",
        payoutReference: "",
        payoutNote: "",
        earnedAtISO: "2026-06-12T10:00:00.000Z",
        processingAtISO: "",
        paidAtISO: "",
        updatedAtISO: "2026-06-12T10:00:00.000Z",
      },
      {
        sourceType: "MEMBERSHIP_POOL",
        entryId: "membership-1::author-1",
        orderId: "membership-1",
        authorId: "author-1",
        authorName: "Penulis A",
        buyerUserId: "reader-9",
        ebookIds: "ebook-2",
        membershipPlan: "PREMIUM",
        itemLabel: "Pool Premium",
        grossAmountCents: 0,
        poolAmountCents: 100000,
        distributablePoolCents: 60000,
        platformCommissionPct: 40,
        platformCommissionCents: 40000,
        authorRoyaltyPct: "",
        authorRoyaltyCents: 15000,
        allocationBasisPages: 120,
        allocationRatioPct: "25.00",
        paymentMethod: "",
        paymentStatus: "SUCCESS",
        transactionState: "",
        payoutStatus: "PROCESSING",
        payoutReference: "",
        payoutNote: "",
        earnedAtISO: "2026-06-12T12:00:00.000Z",
        processingAtISO: "2026-06-12T13:00:00.000Z",
        paidAtISO: "",
        updatedAtISO: "2026-06-12T13:00:00.000Z",
      },
    ]);

    expect(summary).toHaveLength(1);
    expect(summary[0]).toMatchObject({
      authorId: "author-1",
      entryCount: 2,
      paidBookRoyaltyCents: 35000,
      membershipRoyaltyCents: 15000,
      totalRoyaltyCents: 50000,
      availableCents: 35000,
      processingCents: 15000,
    });
  });
});
