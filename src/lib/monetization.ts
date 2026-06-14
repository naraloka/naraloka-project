import type { SuggestedMonetization } from "@/stores/publishingStore";
import type { BookAccess, MembershipPlan } from "@/types/domain";

export type MonetizationDecisionStatus = "PENDING" | "ACCEPTED" | "ADJUSTED";

export function getSuggestedMonetizationLabel(value?: SuggestedMonetization) {
  if (value === "PAID") return "Paid / Beli Satuan";
  if (value === "MEMBERSHIP_PREMIUM") return "Membership Premium";
  if (value === "MEMBERSHIP_EDU") return "Membership Edukasi";
  return "Gratis / Open";
}

export function getPublishedAccessLabel(
  access?: BookAccess,
  requiredPlan?: MembershipPlan
) {
  if (access === "PAID") return "Paid / Beli Satuan";
  if (access === "MEMBERSHIP") {
    return requiredPlan === "EDU"
      ? "Membership Edukasi"
      : "Membership Premium";
  }
  if (access === "OPEN") return "Gratis / Open";
  return "Belum dipublish";
}

export function suggestionToPublishDefaults(
  value: SuggestedMonetization | undefined,
  fallbackPriceCents?: number
) {
  if (value === "PAID") {
    return {
      access: "PAID" as const,
      requiredPlan: undefined,
      priceCents: fallbackPriceCents,
    };
  }
  if (value === "MEMBERSHIP_EDU") {
    return {
      access: "MEMBERSHIP" as const,
      requiredPlan: "EDU" as const,
      priceCents: undefined,
    };
  }
  if (value === "MEMBERSHIP_PREMIUM") {
    return {
      access: "MEMBERSHIP" as const,
      requiredPlan: "PREMIUM" as const,
      priceCents: undefined,
    };
  }
  return {
    access: fallbackPriceCents ? ("PAID" as const) : ("OPEN" as const),
    requiredPlan: undefined,
    priceCents: fallbackPriceCents,
  };
}

export function getMonetizationDecisionStatus(params: {
  suggestedMonetization?: SuggestedMonetization;
  suggestedPriceCents?: number;
  publishedAccess?: BookAccess;
  publishedRequiredPlan?: MembershipPlan;
  publishedPriceCents?: number;
}): MonetizationDecisionStatus {
  const {
    suggestedMonetization,
    suggestedPriceCents,
    publishedAccess,
    publishedRequiredPlan,
    publishedPriceCents,
  } = params;

  if (!publishedAccess) return "PENDING";

  const expected = suggestionToPublishDefaults(
    suggestedMonetization,
    suggestedPriceCents
  );

  const sameAccess = publishedAccess === expected.access;
  const samePlan =
    (publishedRequiredPlan ?? undefined) === (expected.requiredPlan ?? undefined);
  const samePrice =
    publishedAccess !== "PAID" ||
    Math.max(0, publishedPriceCents ?? 0) === Math.max(0, expected.priceCents ?? 0);

  return sameAccess && samePlan && samePrice ? "ACCEPTED" : "ADJUSTED";
}

export function getDecisionStatusLabel(status: MonetizationDecisionStatus) {
  if (status === "ACCEPTED") return "Usulan Diterima";
  if (status === "ADJUSTED") return "Diubah Admin";
  return "Menunggu Publish";
}
