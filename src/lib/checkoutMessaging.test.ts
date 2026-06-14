import { describe, expect, it } from "vitest";
import { buildCheckoutStatusSummary, deriveCheckoutUiState } from "./checkoutMessaging";

describe("deriveCheckoutUiState", () => {
  it("memakai status transaksi terakhir saat state lokal masih idle", () => {
    expect(deriveCheckoutUiState("IDLE", "PENDING")).toBe("PENDING");
    expect(deriveCheckoutUiState("IDLE", "SUCCESS")).toBe("SUCCESS");
    expect(deriveCheckoutUiState("IDLE", "FAILED")).toBe("ERROR");
  });

  it("mempertahankan state lokal saat proses aktif", () => {
    expect(deriveCheckoutUiState("PROCESSING", "SUCCESS")).toBe("PROCESSING");
  });
});

describe("buildCheckoutStatusSummary", () => {
  it("memberi ringkasan membership pending yang jelas", () => {
    expect(
      buildCheckoutStatusSummary({
        uiState: "PENDING",
        latestTransaction: {
          itemType: "MEMBERSHIP",
          membershipPlan: "PREMIUM",
        } as never,
        itemType: "MEMBERSHIP",
        buyerEmail: "reader@example.com",
        buyerWhatsApp: "08123",
      })
    ).toContain("Premium");
  });

  it("memberi ringkasan sukses untuk buku", () => {
    expect(
      buildCheckoutStatusSummary({
        uiState: "SUCCESS",
        itemType: "EBOOK",
        buyerEmail: "reader@example.com",
        buyerWhatsApp: "08123",
      })
    ).toContain("Akses baca penuh");
  });
});
