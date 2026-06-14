import { beforeEach, describe, expect, it, vi } from "vitest";

const fetchPlatformCommissionSettings = vi.fn();
const createClient = vi.fn();

vi.mock("./platformCommissionSettings.js", () => ({
  fetchPlatformCommissionSettings,
}));

vi.mock("@supabase/supabase-js", () => ({
  createClient,
}));

const { resolveTrustedCheckoutPayload } = await import("./checkoutSecurity.js");

function createQueryBuilder(result) {
  const builder = {
    select: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    not: vi.fn(() => builder),
    limit: vi.fn(() => builder),
    maybeSingle: vi.fn(async () => result),
  };
  return builder;
}

describe("resolveTrustedCheckoutPayload", () => {
  const authUser = {
    id: "user_123",
    email: "reader@example.com",
    user_metadata: {
      full_name: "Reader Naraloka",
    },
  };
  const env = {
    SUPABASE_URL: "https://example.supabase.co",
    SUPABASE_SERVICE_ROLE_KEY: "service-role-key",
  };

  beforeEach(() => {
    fetchPlatformCommissionSettings.mockReset();
    createClient.mockReset();
    fetchPlatformCommissionSettings.mockResolvedValue({
      paidBookPct: 20,
      membershipPremiumPct: 30,
      membershipEduPct: 15,
    });
  });

  it("mengabaikan nominal membership palsu dari client dan memakai harga server", async () => {
    const result = await resolveTrustedCheckoutPayload({
      itemType: "MEMBERSHIP",
      membershipPlan: "PREMIUM",
      amount: 1000,
      buyerName: "Nama Client",
      buyerWhatsApp: "081234567890",
      authUser,
    }, env);

    expect(result.userId).toBe("user_123");
    expect(result.amount).toBe(49000);
    expect(result.buyerEmail).toBe("reader@example.com");
    expect(result.platformCommissionPct).toBe(30);
    expect(result.authorRoyaltyCents).toBe(0);
  });

  it("mengabaikan nominal ebook palsu dari client dan memakai harga katalog server", async () => {
    const publishedBookQuery = createQueryBuilder({
      data: {
        published_ebook_id: "eb-lemari-kenangan",
        title: "Lemari Kenangan",
        author_id: "author_456",
        published_access: "PAID",
        published_price_cents: 3900000,
      },
      error: null,
    });
    const duplicatePurchaseQuery = createQueryBuilder({
      data: null,
      error: null,
    });

    createClient.mockReturnValue({
      from: (table) => {
        if (table === "author_manuscripts") return publishedBookQuery;
        if (table === "payment_ledger") return duplicatePurchaseQuery;
        throw new Error(`Unexpected table ${table}`);
      },
    });

    const result = await resolveTrustedCheckoutPayload({
      itemType: "EBOOK",
      ebookId: "eb-lemari-kenangan",
      amount: 5000,
      buyerWhatsApp: "081234567890",
      authUser,
    }, env);

    expect(result.itemType).toBe("EBOOK");
    expect(result.amount).toBe(39000);
    expect(result.ebookId).toBe("eb-lemari-kenangan");
    expect(result.platformCommissionPct).toBe(20);
    expect(result.authorRoyaltyCents).toBe(3120000);
  });

  it("menolak paket membership tidak valid", async () => {
    await expect(
      resolveTrustedCheckoutPayload({
        itemType: "MEMBERSHIP",
        membershipPlan: "VIP",
        buyerWhatsApp: "081234567890",
        authUser,
      }, env)
    ).rejects.toThrow("Paket membership yang dipilih tidak valid.");
  });
});
