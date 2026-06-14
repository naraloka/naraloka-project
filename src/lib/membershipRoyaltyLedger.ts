import { getReadableSupabaseError, supabase } from "@/lib/supabase";
import type {
  AuthorMembershipRoyaltyLedgerEntry,
  AuthorMembershipRoyaltyLedgerStatus,
} from "@/stores/publishingStore";
import type { MembershipPlan, TransactionStatus, UserRole } from "@/types/domain";

type AuthorMembershipRoyaltyLedgerRow = {
  entry_id: string;
  order_id: string;
  buyer_user_id: string | null;
  author_id: string;
  membership_plan: string;
  item_label: string | null;
  pool_amount_cents: number | null;
  platform_commission_pct: number | null;
  platform_commission_cents: number | null;
  distributable_pool_cents: number | null;
  allocation_basis_pages: number | null;
  allocation_ratio: number | null;
  author_royalty_cents: number | null;
  payment_status: string | null;
  status: string | null;
  payout_reference: string | null;
  payout_note: string | null;
  source_ebook_ids: unknown;
  earned_at: string | null;
  processing_at: string | null;
  paid_at: string | null;
  created_at: string | null;
  updated_at: string | null;
};

function normalizeMembershipPlan(value: string | null | undefined): Exclude<MembershipPlan, "FREE"> {
  return value === "EDU" ? "EDU" : "PREMIUM";
}

function normalizeTransactionStatus(value: string | null | undefined): TransactionStatus {
  return value === "SUCCESS" || value === "FAILED" ? value : "PENDING";
}

function normalizeMembershipLedgerStatus(
  value: string | null | undefined
): AuthorMembershipRoyaltyLedgerStatus {
  if (
    value === "AVAILABLE" ||
    value === "PROCESSING" ||
    value === "PAID" ||
    value === "VOID"
  ) {
    return value;
  }
  return "PENDING";
}

function ensureStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item || "").trim()).filter(Boolean);
}

export function mapMembershipRoyaltyLedgerRowToEntry(
  row: AuthorMembershipRoyaltyLedgerRow
): AuthorMembershipRoyaltyLedgerEntry {
  return {
    entryId: String(row.entry_id || "").trim(),
    orderId: String(row.order_id || "").trim(),
    buyerUserId: String(row.buyer_user_id || "").trim() || undefined,
    authorId: String(row.author_id || "").trim(),
    membershipPlan: normalizeMembershipPlan(row.membership_plan),
    itemLabel: String(row.item_label || "").trim() || "Membership Pool",
    poolAmountCents: Math.max(0, Number(row.pool_amount_cents || 0)),
    platformCommissionPct: row.platform_commission_pct ?? undefined,
    platformCommissionCents: Math.max(0, Number(row.platform_commission_cents || 0)),
    distributablePoolCents: Math.max(0, Number(row.distributable_pool_cents || 0)),
    allocationBasisPages: Math.max(0, Number(row.allocation_basis_pages || 0)),
    allocationRatio: Math.max(0, Number(row.allocation_ratio || 0)),
    authorRoyaltyCents: Math.max(0, Number(row.author_royalty_cents || 0)),
    paymentStatus: normalizeTransactionStatus(row.payment_status),
    status: normalizeMembershipLedgerStatus(row.status),
    payoutReference: row.payout_reference || undefined,
    payoutNote: row.payout_note || undefined,
    sourceEbookIds: ensureStringArray(row.source_ebook_ids),
    earnedAtISO: row.earned_at || undefined,
    processingAtISO: row.processing_at || undefined,
    paidAtISO: row.paid_at || undefined,
    createdAtISO: row.created_at || row.updated_at || new Date().toISOString(),
    updatedAtISO: row.updated_at || row.created_at || new Date().toISOString(),
  };
}

export async function fetchMembershipRoyaltyLedgerSnapshot(params: {
  userId: string;
  role: UserRole;
}) {
  if (!supabase || !params.userId.trim()) {
    return { error: "", data: [] as AuthorMembershipRoyaltyLedgerEntry[] };
  }

  const query = supabase
    .from("author_membership_royalty_ledger")
    .select(
      "entry_id,order_id,buyer_user_id,author_id,membership_plan,item_label,pool_amount_cents,platform_commission_pct,platform_commission_cents,distributable_pool_cents,allocation_basis_pages,allocation_ratio,author_royalty_cents,payment_status,status,payout_reference,payout_note,source_ebook_ids,earned_at,processing_at,paid_at,created_at,updated_at"
    )
    .order("earned_at", { ascending: false, nullsFirst: false })
    .order("updated_at", { ascending: false });

  const scopedQuery =
    params.role === "ADMIN" ? query : query.eq("author_id", params.userId);

  const { data, error } = await scopedQuery;
  if (error) {
    return {
      error: getReadableSupabaseError(error.message),
      data: [] as AuthorMembershipRoyaltyLedgerEntry[],
    };
  }

  return {
    error: "",
    data: ((data ?? []) as AuthorMembershipRoyaltyLedgerRow[]).map(
      mapMembershipRoyaltyLedgerRowToEntry
    ),
  };
}

export async function updateMembershipRoyaltyLedgerPayoutStatus(input: {
  entryId: string;
  status: Extract<AuthorMembershipRoyaltyLedgerStatus, "AVAILABLE" | "PROCESSING" | "PAID">;
  payoutReference?: string;
  payoutNote?: string;
}) {
  if (!supabase) {
    throw new Error("Supabase belum terhubung untuk update payout membership pool.");
  }

  const entryId = input.entryId.trim();
  if (!entryId) {
    throw new Error("entryId membership pool wajib diisi.");
  }

  const now = new Date().toISOString();
  const payload = {
    status: input.status,
    payout_reference: input.payoutReference?.trim() || null,
    payout_note: input.payoutNote?.trim() || null,
    processing_at:
      input.status === "PROCESSING" || input.status === "PAID" ? now : null,
    paid_at: input.status === "PAID" ? now : null,
    updated_at: now,
  };

  const { data, error } = await supabase
    .from("author_membership_royalty_ledger")
    .update(payload)
    .eq("entry_id", entryId)
    .select(
      "entry_id,order_id,buyer_user_id,author_id,membership_plan,item_label,pool_amount_cents,platform_commission_pct,platform_commission_cents,distributable_pool_cents,allocation_basis_pages,allocation_ratio,author_royalty_cents,payment_status,status,payout_reference,payout_note,source_ebook_ids,earned_at,processing_at,paid_at,created_at,updated_at"
    )
    .maybeSingle();

  if (error || !data) {
    throw new Error(
      getReadableSupabaseError(error?.message || "Gagal memperbarui payout membership pool.")
    );
  }

  return mapMembershipRoyaltyLedgerRowToEntry(data as AuthorMembershipRoyaltyLedgerRow);
}
