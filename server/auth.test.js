import { describe, expect, it } from "vitest";
import { getTrustedMembershipPlan } from "./auth.js";

describe("getTrustedMembershipPlan", () => {
  it("memakai membership plan dari app metadata", () => {
    expect(
      getTrustedMembershipPlan({
        app_metadata: {
          membership_plan: "PREMIUM",
        },
        user_metadata: {
          membership_plan: "FREE",
        },
      })
    ).toBe("PREMIUM");
  });

  it("mengabaikan membership plan premium palsu dari user metadata", () => {
    expect(
      getTrustedMembershipPlan({
        app_metadata: {},
        user_metadata: {
          membership_plan: "PREMIUM",
        },
      })
    ).toBe("FREE");
  });
});
