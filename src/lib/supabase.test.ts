import { describe, expect, it } from "vitest";
import { getSupabaseUserProfile, getTrustedSupabaseMembershipPlan } from "./supabase";

describe("getSupabaseUserProfile", () => {
  it("mengambil role author dari user metadata tetapi admin hanya dari app metadata", () => {
    const authorProfile = getSupabaseUserProfile({
      id: "user-1",
      email: "author@example.com",
      app_metadata: {},
      user_metadata: {
        full_name: "Penulis",
        role: "AUTHOR",
      },
    } as never);

    const fakeAdminProfile = getSupabaseUserProfile({
      id: "user-2",
      email: "fake-admin@example.com",
      app_metadata: {},
      user_metadata: {
        full_name: "Fake Admin",
        role: "ADMIN",
      },
    } as never);

    expect(authorProfile.role).toBe("AUTHOR");
    expect(fakeAdminProfile.role).toBe("READER");
  });
});

describe("getTrustedSupabaseMembershipPlan", () => {
  it("hanya mempercayai membership plan dari app metadata", () => {
    expect(
      getTrustedSupabaseMembershipPlan({
        app_metadata: {
          membership_plan: "PREMIUM",
        },
        user_metadata: {
          membership_plan: "FREE",
        },
      } as never)
    ).toBe("PREMIUM");

    expect(
      getTrustedSupabaseMembershipPlan({
        app_metadata: {},
        user_metadata: {
          membership_plan: "EDU",
        },
      } as never)
    ).toBe("FREE");
  });
});
