import { getReadableSupabaseError, supabase } from "@/lib/supabase";
import type {
  AuthorRoyaltyLedgerEntry,
  AuthorRoyaltyLedgerStatus,
} from "@/stores/publishingStore";
import type { PaymentMethod, TransactionStatus, UserRole } from "@/types/domain";

type AuthorRoyaltyLedgerRow = {
  order_id: string;
  author_id: string;
  user_id: string | null;
  ebook_id: string | null;
  item_label: string | null;
  gross_amount_cents: number | null;
  platform_commission_pct: number | null;
  platform_commission_cents: number | null;
  author_royalty_pct: number | null;
  author_royalty_cents: number | null;
  payment_method: string | null;
  payment_status: string | null;
  transaction_state: string | null;
  status: string | null;
  payout_reference: string | null;
  payout_note: string | null;
  earned_at: string | null;
  processing_at: string | null;
  paid_at: string | null;
  created_at: string | null;
  updated_at: string | null;
};

function normalizePaymentMethod(value: string | null | undefined): PaymentMethod | undefined {
  if (
    value === "QRIS" ||
    value === "BANK_TRANSFER" ||
    value === "E_WALLET" ||
    value === "VIRTUAL_ACCOUNT" ||
    value === "CARD"
  ) {
    return value;
  }

  return undefined;
}

function normalizePaymentStatus(value: string | null | undefined): TransactionStatus {
  return value === "SUCCESS" || value === "FAILED" ? value : "PENDING";
}

function normalizeRoyaltyLedgerStatus(value: string | null | undefined): AuthorRoyaltyLedgerStatus {
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

export function mapRoyaltyLedgerRowToEntry(row: AuthorRoyaltyLedgerRow): AuthorRoyaltyLedgerEntry {
  return {
    orderId: String(row.order_id || "").trim(),
    authorId: String(row.author_id || "").trim(),
    userId: String(row.user_id || "").trim() || undefined,
    ebookId: String(row.ebook_id || "").trim() || undefined,
    itemLabel: String(row.item_label || "").trim() || "Royalti Naraloka",
    grossAmountCents: Math.max(0, Number(row.gross_amount_cents || 0)),
    platformCommissionPct: row.platform_commission_pct ?? undefined,
    platformCommissionCents: Math.max(0, Number(row.platform_commission_cents || 0)),
    authorRoyaltyPct: row.author_royalty_pct ?? undefined,
    authorRoyaltyCents: Math.max(0, Number(row.author_royalty_cents || 0)),
    paymentMethod: normalizePaymentMethod(row.payment_method),
    paymentStatus: normalizePaymentStatus(row.payment_status),
    transactionState: row.transaction_state || undefined,
    status: normalizeRoyaltyLedgerStatus(row.status),
    payoutReference: row.payout_reference || undefined,
    payoutNote: row.payout_note || undefined,
    earnedAtISO: row.earned_at || undefined,
    processingAtISO: row.processing_at || undefined,
    paidAtISO: row.paid_at || undefined,
    createdAtISO: row.created_at || row.updated_at || new Date().toISOString(),
    updatedAtISO: row.updated_at || row.created_at || new Date().toISOString(),
  };
}

export async function fetchRoyaltyLedgerSnapshot(params: { userId: string; role: UserRole }) {
  if (!supabase || !params.userId.trim()) {
    return { error: "", data: [] as AuthorRoyaltyLedgerEntry[] };
  }

  const query = supabase
    .from("author_royalty_ledger")
    .select(
      "order_id,author_id,user_id,ebook_id,item_label,gross_amount_cents,platform_commission_pct,platform_commission_cents,author_royalty_pct,author_royalty_cents,payment_method,payment_status,transaction_state,status,payout_reference,payout_note,earned_at,processing_at,paid_at,created_at,updated_at"
    )
    .order("earned_at", { ascending: false, nullsFirst: false })
    .order("updated_at", { ascending: false });

  const scopedQuery =
    params.role === "ADMIN" ? query : query.eq("author_id", params.userId);

  const { data, error } = await scopedQuery;
  if (error) {
    return {
      error: getReadableSupabaseError(error.message),
      data: [] as AuthorRoyaltyLedgerEntry[],
    };
  }

  return {
    error: "",
    data: ((data ?? []) as AuthorRoyaltyLedgerRow[]).map(mapRoyaltyLedgerRowToEntry),
  };
}

export async function updateRoyaltyLedgerPayoutStatus(input: {
  orderId: string;
  status: Extract<AuthorRoyaltyLedgerStatus, "AVAILABLE" | "PROCESSING" | "PAID">;
  payoutReference?: string;
  payoutNote?: string;
}) {
  if (!supabase) {
    throw new Error("Supabase belum terhubung untuk update payout royalti.");
  }

  const orderId = input.orderId.trim();
  if (!orderId) {
    throw new Error("orderId payout wajib diisi.");
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
    .from("author_royalty_ledger")
    .update(payload)
    .eq("order_id", orderId)
    .select(
      "order_id,author_id,user_id,ebook_id,item_label,gross_amount_cents,platform_commission_pct,platform_commission_cents,author_royalty_pct,author_royalty_cents,payment_method,payment_status,transaction_state,status,payout_reference,payout_note,earned_at,processing_at,paid_at,created_at,updated_at"
    )
    .maybeSingle();

  if (error || !data) {
    throw new Error(
      getReadableSupabaseError(error?.message || "Gagal memperbarui status payout royalti.")
    );
  }

  return mapRoyaltyLedgerRowToEntry(data as AuthorRoyaltyLedgerRow);
}
