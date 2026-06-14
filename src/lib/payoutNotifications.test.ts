import { describe, expect, it } from "vitest";
import {
  createMembershipPayoutStatusNotification,
  createRoyaltyPayoutStatusNotification,
} from "@/lib/payoutNotifications";

describe("payoutNotifications", () => {
  it("membuat notifikasi saat royalti buku masuk PROCESSING", () => {
    const notification = createRoyaltyPayoutStatusNotification({
      previousEntry: {
        orderId: "ord_1",
        authorId: "author_1",
        itemLabel: "Buku A",
        grossAmountCents: 50000,
        platformCommissionCents: 10000,
        authorRoyaltyCents: 40000,
        paymentStatus: "SUCCESS",
        status: "AVAILABLE",
        createdAtISO: "2026-06-12T10:00:00.000Z",
        updatedAtISO: "2026-06-12T10:00:00.000Z",
      },
      entry: {
        orderId: "ord_1",
        authorId: "author_1",
        itemLabel: "Buku A",
        grossAmountCents: 50000,
        platformCommissionCents: 10000,
        authorRoyaltyCents: 40000,
        paymentStatus: "SUCCESS",
        status: "PROCESSING",
        payoutReference: "TRF-001",
        processingAtISO: "2026-06-12T12:00:00.000Z",
        createdAtISO: "2026-06-12T10:00:00.000Z",
        updatedAtISO: "2026-06-12T12:00:00.000Z",
      },
    });

    expect(notification?.eventStatus).toBe("PROCESSING");
    expect(notification?.sourceType).toBe("PAID_BOOK");
    expect(notification?.message).toContain("Buku A");
    expect(notification?.message).toContain("TRF-001");
  });

  it("tidak membuat notifikasi duplikat saat status tidak berubah", () => {
    const notification = createRoyaltyPayoutStatusNotification({
      previousEntry: {
        orderId: "ord_1",
        authorId: "author_1",
        itemLabel: "Buku A",
        grossAmountCents: 50000,
        platformCommissionCents: 10000,
        authorRoyaltyCents: 40000,
        paymentStatus: "SUCCESS",
        status: "PAID",
        paidAtISO: "2026-06-12T13:00:00.000Z",
        createdAtISO: "2026-06-12T10:00:00.000Z",
        updatedAtISO: "2026-06-12T13:00:00.000Z",
      },
      entry: {
        orderId: "ord_1",
        authorId: "author_1",
        itemLabel: "Buku A",
        grossAmountCents: 50000,
        platformCommissionCents: 10000,
        authorRoyaltyCents: 40000,
        paymentStatus: "SUCCESS",
        status: "PAID",
        paidAtISO: "2026-06-12T13:00:00.000Z",
        createdAtISO: "2026-06-12T10:00:00.000Z",
        updatedAtISO: "2026-06-12T13:00:00.000Z",
      },
    });

    expect(notification).toBeNull();
  });

  it("membuat notifikasi membership pool saat payout masuk PAID", () => {
    const notification = createMembershipPayoutStatusNotification({
      previousEntry: {
        entryId: "mem_1",
        orderId: "ord_mem_1",
        authorId: "author_1",
        membershipPlan: "PREMIUM",
        itemLabel: "Membership Buku B",
        poolAmountCents: 80000,
        platformCommissionCents: 20000,
        distributablePoolCents: 60000,
        allocationBasisPages: 120,
        allocationRatio: 0.5,
        authorRoyaltyCents: 30000,
        status: "PROCESSING",
        paymentStatus: "SUCCESS",
        processingAtISO: "2026-06-12T12:00:00.000Z",
        createdAtISO: "2026-06-12T10:00:00.000Z",
        updatedAtISO: "2026-06-12T12:00:00.000Z",
        sourceEbookIds: ["ebook_1"],
      },
      entry: {
        entryId: "mem_1",
        orderId: "ord_mem_1",
        authorId: "author_1",
        membershipPlan: "PREMIUM",
        itemLabel: "Membership Buku B",
        poolAmountCents: 80000,
        platformCommissionCents: 20000,
        distributablePoolCents: 60000,
        allocationBasisPages: 120,
        allocationRatio: 0.5,
        authorRoyaltyCents: 30000,
        status: "PAID",
        paymentStatus: "SUCCESS",
        payoutNote: "Ditransfer ke rekening BCA",
        paidAtISO: "2026-06-12T14:00:00.000Z",
        createdAtISO: "2026-06-12T10:00:00.000Z",
        updatedAtISO: "2026-06-12T14:00:00.000Z",
        sourceEbookIds: ["ebook_1"],
      },
    });

    expect(notification?.eventStatus).toBe("PAID");
    expect(notification?.sourceType).toBe("MEMBERSHIP_POOL");
    expect(notification?.message).toContain("Ditransfer ke rekening BCA");
  });
});
