import { getReadableSupabaseError, supabase } from "@/lib/supabase";
import { usePublishingStore } from "@/stores/publishingStore";
import { useLibraryStore } from "@/stores/libraryStore";
import { useTransactionStore } from "@/stores/transactionStore";
import type {
  MembershipPlan,
  PaymentMethod,
  ReaderTransaction,
  TransactionItemType,
  TransactionStatus,
} from "@/types/domain";

export type PaymentLedgerRow = {
  order_id: string;
  user_id: string | null;
  item_type: string | null;
  item_id: string | null;
  item_label: string | null;
  amount_cents: number | null;
  payment_method: string | null;
  status: string | null;
  buyer_email: string | null;
  buyer_whatsapp: string | null;
  membership_plan: string | null;
  ebook_id: string | null;
  author_id: string | null;
  platform_commission_pct: number | null;
  platform_commission_cents: number | null;
  author_royalty_pct: number | null;
  author_royalty_cents: number | null;
  redirect_url: string | null;
  created_at: string | null;
  updated_at: string | null;
  transaction_status: string | null;
  transaction_state: string | null;
  should_grant_access: boolean | null;
};

function normalizeMembershipPlan(value: string | null | undefined): MembershipPlan | null {
  return value === "PREMIUM" || value === "EDU" ? value : value === "FREE" ? "FREE" : null;
}

function normalizePaymentMethod(value: string | null | undefined): PaymentMethod {
  if (
    value === "QRIS" ||
    value === "BANK_TRANSFER" ||
    value === "E_WALLET" ||
    value === "VIRTUAL_ACCOUNT" ||
    value === "CARD"
  ) {
    return value;
  }

  return "QRIS";
}

function normalizeTransactionItemType(value: string | null | undefined): TransactionItemType {
  return value === "EBOOK" ? "EBOOK" : "MEMBERSHIP";
}

function normalizeTransactionStatus(value: string | null | undefined): TransactionStatus {
  return value === "SUCCESS" || value === "FAILED" ? value : "PENDING";
}

function getKnownPageCount(ebookId: string) {
  const publishedEbooks = usePublishingStore.getState().publishedEbooks;
  const ebook = publishedEbooks.find((item) => item.id === ebookId);
  return ebook?.pageCount ?? 1;
}

export function mapLedgerRowToTransaction(row: PaymentLedgerRow): ReaderTransaction {
  const orderId = String(row.order_id || "").trim();
  const userId = String(row.user_id || "").trim() || "guest";
  const createdAtISO = row.created_at || row.updated_at || new Date().toISOString();
  const updatedAtISO = row.updated_at || createdAtISO;

  return {
    id: `ledger_${orderId}`,
    userId,
    orderId,
    itemType: normalizeTransactionItemType(row.item_type),
    itemId: String(row.item_id || "").trim() || orderId,
    itemLabel: String(row.item_label || "").trim() || "Pembayaran Naraloka",
    amountCents: Number(row.amount_cents || 0),
    paymentMethod: normalizePaymentMethod(row.payment_method),
    status: normalizeTransactionStatus(row.status),
    buyerEmail: String(row.buyer_email || "").trim(),
    buyerWhatsApp: String(row.buyer_whatsapp || "").trim(),
    membershipPlan: normalizeMembershipPlan(row.membership_plan) ?? undefined,
    ebookId: row.ebook_id || undefined,
    authorId: row.author_id || undefined,
    platformCommissionPct: row.platform_commission_pct ?? undefined,
    platformCommissionCents: row.platform_commission_cents ?? undefined,
    authorRoyaltyPct: row.author_royalty_pct ?? undefined,
    authorRoyaltyCents: row.author_royalty_cents ?? undefined,
    redirectUrl: row.redirect_url || undefined,
    createdAtISO,
    updatedAtISO,
  };
}

export function deriveMembershipPlanFromRows(
  rows: PaymentLedgerRow[],
  fallbackPlan: MembershipPlan
): MembershipPlan {
  const successfulMemberships = rows
    .filter(
      (row) =>
        row.status === "SUCCESS" &&
        row.item_type === "MEMBERSHIP" &&
        normalizeMembershipPlan(row.membership_plan)
    )
    .sort((a, b) => +new Date(b.updated_at || b.created_at || 0) - +new Date(a.updated_at || a.created_at || 0));

  return normalizeMembershipPlan(successfulMemberships[0]?.membership_plan) ?? fallbackPlan;
}

export async function syncLedgerStateForUser(userId: string, fallbackPlan: MembershipPlan) {
  if (!supabase || !userId.trim()) {
    return {
      error: "",
      membershipPlan: fallbackPlan,
    };
  }

  const { data, error } = await supabase
    .from("payment_ledger")
    .select(
      "order_id,user_id,item_type,item_id,item_label,amount_cents,payment_method,status,buyer_email,buyer_whatsapp,membership_plan,ebook_id,author_id,platform_commission_pct,platform_commission_cents,author_royalty_pct,author_royalty_cents,redirect_url,created_at,updated_at,transaction_status,transaction_state,should_grant_access"
    )
    .eq("user_id", userId)
    .order("updated_at", { ascending: false });

  if (error) {
    return {
      error: getReadableSupabaseError(error.message),
      membershipPlan: fallbackPlan,
    };
  }

  const rows = ((data ?? []) as PaymentLedgerRow[]).filter((row) => String(row.order_id || "").trim());
  const transactions = rows.map(mapLedgerRowToTransaction);
  useTransactionStore.getState().hydrateTransactionsForUser(userId, transactions);

  const ownedEbooks = rows
    .filter(
      (row) =>
        row.status === "SUCCESS" &&
        row.item_type === "EBOOK" &&
        row.should_grant_access === true &&
        String(row.ebook_id || "").trim()
    )
    .map((row) => ({
      ebookId: String(row.ebook_id || "").trim(),
      totalPages: getKnownPageCount(String(row.ebook_id || "").trim()),
    }));

  useLibraryStore.getState().syncOwnedFromLedger(userId, ownedEbooks);

  return {
    error: "",
    membershipPlan: deriveMembershipPlanFromRows(rows, fallbackPlan),
  };
}
