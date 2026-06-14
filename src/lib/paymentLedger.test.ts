import { describe, expect, it } from "vitest";
import {
  deriveMembershipPlanFromRows,
  mapLedgerRowToTransaction,
  type PaymentLedgerRow,
} from "./paymentLedger";

function makeRow(overrides: Partial<PaymentLedgerRow> = {}): PaymentLedgerRow {
  return {
    order_id: "ORDER-1",
    user_id: "user-1",
    item_type: "MEMBERSHIP",
    item_id: "naraloka-premium",
    item_label: "Langganan Premium",
    amount_cents: 49000,
    payment_method: "BANK_TRANSFER",
    status: "SUCCESS",
    buyer_email: "user@example.com",
    buyer_whatsapp: "08123",
    membership_plan: "PREMIUM",
    ebook_id: null,
    author_id: null,
    platform_commission_pct: 30,
    platform_commission_cents: 14700,
    author_royalty_pct: 0,
    author_royalty_cents: 0,
    redirect_url: "https://pay.example.com",
    created_at: "2026-06-11T10:00:00.000Z",
    updated_at: "2026-06-11T10:05:00.000Z",
    transaction_status: "settlement",
    transaction_state: "SUCCESS",
    should_grant_access: true,
    ...overrides,
  };
}

describe("payment ledger helpers", () => {
  it("memetakan row ledger menjadi transaksi pembaca", () => {
    const transaction = mapLedgerRowToTransaction(
      makeRow({
        item_type: "EBOOK",
        item_id: "ebook-1",
        item_label: "E-book Naraloka",
        ebook_id: "ebook-1",
        membership_plan: null,
      })
    );

    expect(transaction.orderId).toBe("ORDER-1");
    expect(transaction.itemType).toBe("EBOOK");
    expect(transaction.ebookId).toBe("ebook-1");
    expect(transaction.status).toBe("SUCCESS");
  });

  it("mengambil membership terbaru yang sukses dari ledger", () => {
    const plan = deriveMembershipPlanFromRows(
      [
        makeRow({
          order_id: "ORDER-OLD",
          membership_plan: "PREMIUM",
          updated_at: "2026-06-10T10:00:00.000Z",
        }),
        makeRow({
          order_id: "ORDER-NEW",
          membership_plan: "EDU",
          updated_at: "2026-06-11T10:00:00.000Z",
        }),
      ],
      "FREE"
    );

    expect(plan).toBe("EDU");
  });

  it("memakai fallback plan jika belum ada membership sukses", () => {
    const plan = deriveMembershipPlanFromRows(
      [
        makeRow({
          status: "PENDING",
          membership_plan: "PREMIUM",
        }),
      ],
      "FREE"
    );

    expect(plan).toBe("FREE");
  });
});
