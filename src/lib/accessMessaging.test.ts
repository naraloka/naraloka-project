import { describe, expect, it } from "vitest";
import {
  getLockedBookAccessMessage,
  getLockedBookPrimaryAction,
  getMembershipPlanLabel,
  getPublicAccessPriceLabel,
  getRequiredMembershipLabel,
} from "./accessMessaging";

describe("accessMessaging", () => {
  it("menjelaskan kebutuhan login untuk buku membership", () => {
    expect(
      getLockedBookAccessMessage({
        access: "MEMBERSHIP",
        requiredPlan: "PREMIUM",
        isLoggedIn: false,
        membershipPlan: "FREE",
      })
    ).toContain("Login dulu");
  });

  it("menjelaskan paket gratis belum cukup untuk buku membership", () => {
    expect(
      getLockedBookAccessMessage({
        access: "MEMBERSHIP",
        requiredPlan: "EDU",
        isLoggedIn: true,
        membershipPlan: "FREE",
      })
    ).toContain("Gratis");
  });

  it("memberi CTA checkout yang tepat untuk buku berbayar", () => {
    expect(getLockedBookPrimaryAction({ access: "PAID", isLoggedIn: false })).toBe(
      "Login untuk Checkout"
    );
  });

  it("menormalkan label paket membership", () => {
    expect(getMembershipPlanLabel("PREMIUM")).toBe("Premium");
    expect(getMembershipPlanLabel("EDU")).toBe("Edukasi");
    expect(getMembershipPlanLabel("FREE")).toBe("Gratis");
  });

  it("membuat label paket requirement dan harga publik yang konsisten", () => {
    expect(getRequiredMembershipLabel("EDU")).toBe("Edukasi atau Premium");
    expect(
      getPublicAccessPriceLabel({
        access: "MEMBERSHIP",
        requiredPlan: "PREMIUM",
      })
    ).toBe("Via Premium");
    expect(
      getPublicAccessPriceLabel({
        access: "OPEN",
      })
    ).toBe("Gratis");
  });
});
