export type RoyaltyBreakdown = {
  grossAmountCents: number;
  platformCommissionPct: number;
  platformCommissionCents: number;
  authorRoyaltyPct: number;
  authorRoyaltyCents: number;
};

export type CommissionMode = "PAID" | "MEMBERSHIP_PREMIUM" | "MEMBERSHIP_EDU" | "FREE";

export function calculateRoyaltyBreakdown(
  amountCents: number,
  platformCommissionPct: number
): RoyaltyBreakdown {
  const grossAmountCents = Math.max(0, Math.round(amountCents));
  const normalizedPct = Math.min(100, Math.max(0, Math.round(platformCommissionPct)));
  const platformCommissionCents = Math.round((grossAmountCents * normalizedPct) / 100);
  const authorRoyaltyPct = 100 - normalizedPct;
  const authorRoyaltyCents = grossAmountCents - platformCommissionCents;

  return {
    grossAmountCents,
    platformCommissionPct: normalizedPct,
    platformCommissionCents,
    authorRoyaltyPct,
    authorRoyaltyCents,
  };
}

export function calculatePlatformOnlyBreakdown(
  amountCents: number,
  platformCommissionPct: number
): RoyaltyBreakdown {
  const grossAmountCents = Math.max(0, Math.round(amountCents));
  const normalizedPct = Math.min(100, Math.max(0, Math.round(platformCommissionPct)));
  const platformCommissionCents = Math.round((grossAmountCents * normalizedPct) / 100);

  return {
    grossAmountCents,
    platformCommissionPct: normalizedPct,
    platformCommissionCents,
    authorRoyaltyPct: 0,
    authorRoyaltyCents: 0,
  };
}
