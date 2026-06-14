import { describe, expect, it } from "vitest";
import { buildPayoutSlipHtml } from "@/lib/payoutSlip";

describe("payoutSlip", () => {
  it("membuat html slip payout penulis dari summary dan baris report", () => {
    const html = buildPayoutSlipHtml({
      summary: {
        authorId: "author-1",
        authorName: "Penulis A",
        entryCount: 2,
        paidBookRoyaltyCents: 35000,
        membershipRoyaltyCents: 15000,
        totalRoyaltyCents: 50000,
        availableCents: 35000,
        processingCents: 15000,
        paidCents: 0,
      },
      rows: [
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
      ],
      filters: {
        startDate: "2026-06-01",
        endDate: "2026-06-30",
        sourceType: "ALL",
        payoutStatus: "ALL",
      },
      invoiceNumber: "NAR-PYT-20260612-000001",
      generatedByName: "Admin Naraloka",
      generatedAtISO: "2026-06-12T12:00:00.000Z",
    });

    expect(html).toContain("Slip Payout Penulis");
    expect(html).toContain("Penulis A");
    expect(html).toContain("NAR-PYT-20260612-000001");
    expect(html).toContain("Admin Naraloka");
    expect(html).toContain("order-1");
    expect(html).toContain("Periode 2026-06-01 s/d 2026-06-30");
  });
});
