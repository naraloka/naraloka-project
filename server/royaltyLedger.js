import { createClient } from "@supabase/supabase-js";

function toRoyaltyLedgerError(message, statusCode = 500) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function normalizeText(value) {
  if (value === null || value === undefined) return null;
  const next = String(value).trim();
  return next || null;
}

function normalizeNumber(value) {
  if (value === null || value === undefined || value === "") return null;
  const next = Number(value);
  return Number.isFinite(next) ? next : null;
}

function nowIso() {
  return new Date().toISOString();
}

function createServerSupabaseClient(env = process.env) {
  const supabaseUrl = env.SUPABASE_URL || env.VITE_SUPABASE_URL || "";
  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY || "";
  if (!supabaseUrl || !serviceRoleKey) return null;

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

function getRoyaltyLedgerTableName(env = process.env) {
  return env.SUPABASE_AUTHOR_ROYALTY_LEDGER_TABLE || "author_royalty_ledger";
}

function deriveRoyaltyStatus(paymentRow, existingStatus) {
  const paymentStatus = String(paymentRow?.status || "").trim().toUpperCase();
  const royaltyCents = Math.max(0, Number(paymentRow?.author_royalty_cents || 0));

  if (paymentStatus === "FAILED") return "VOID";
  if (paymentStatus === "PENDING") return "PENDING";
  if (paymentStatus !== "SUCCESS") return "PENDING";
  if (existingStatus === "PROCESSING" || existingStatus === "PAID") return existingStatus;
  if (royaltyCents <= 0) return "VOID";
  return "AVAILABLE";
}

function buildRoyaltyLedgerPayload(paymentRow, existingRow) {
  const existingStatus = String(existingRow?.status || "").trim().toUpperCase();
  const nextStatus = deriveRoyaltyStatus(paymentRow, existingStatus);
  const earnedAt =
    nextStatus === "AVAILABLE" || nextStatus === "PROCESSING" || nextStatus === "PAID"
      ? existingRow?.earned_at || paymentRow.updated_at || paymentRow.created_at || nowIso()
      : null;

  return {
    order_id: String(paymentRow.order_id || "").trim(),
    author_id: normalizeText(paymentRow.author_id),
    user_id: normalizeText(paymentRow.user_id),
    ebook_id: normalizeText(paymentRow.ebook_id),
    item_label: normalizeText(paymentRow.item_label),
    gross_amount_cents: Math.max(0, Number(paymentRow.amount_cents || 0)),
    platform_commission_pct: normalizeNumber(paymentRow.platform_commission_pct),
    platform_commission_cents: Math.max(0, Number(paymentRow.platform_commission_cents || 0)),
    author_royalty_pct: normalizeNumber(paymentRow.author_royalty_pct),
    author_royalty_cents: Math.max(0, Number(paymentRow.author_royalty_cents || 0)),
    payment_method: normalizeText(paymentRow.payment_method),
    payment_status: normalizeText(paymentRow.status) || "PENDING",
    transaction_state: normalizeText(paymentRow.transaction_state),
    status: nextStatus,
    payout_reference: normalizeText(existingRow?.payout_reference),
    payout_note: normalizeText(existingRow?.payout_note),
    earned_at: earnedAt,
    processing_at:
      nextStatus === "PROCESSING" || nextStatus === "PAID"
        ? existingRow?.processing_at || nowIso()
        : null,
    paid_at: nextStatus === "PAID" ? existingRow?.paid_at || nowIso() : null,
    last_synced_at: nowIso(),
    updated_at: nowIso(),
  };
}

export async function syncAuthorRoyaltyLedgerFromOrder(orderId, env = process.env) {
  const normalizedOrderId = String(orderId || "").trim();
  if (!normalizedOrderId) {
    throw toRoyaltyLedgerError("order_id royalty ledger wajib diisi.", 400);
  }

  const supabase = createServerSupabaseClient(env);
  if (!supabase) {
    return {
      enabled: false,
      synced: false,
      orderId: normalizedOrderId,
    };
  }

  const royaltyTable = getRoyaltyLedgerTableName(env);
  const { data: paymentRow, error: paymentError } = await supabase
    .from(env.SUPABASE_PAYMENT_LEDGER_TABLE || "payment_ledger")
    .select(
      "order_id,user_id,item_type,item_label,amount_cents,payment_method,status,ebook_id,author_id,platform_commission_pct,platform_commission_cents,author_royalty_pct,author_royalty_cents,transaction_state,created_at,updated_at"
    )
    .eq("order_id", normalizedOrderId)
    .maybeSingle();

  if (paymentError) {
    throw toRoyaltyLedgerError(
      `Gagal membaca payment ledger untuk royalty: ${paymentError.message}`,
      500
    );
  }

  if (!paymentRow) {
    return {
      enabled: true,
      synced: false,
      skipped: true,
      orderId: normalizedOrderId,
      reason: "Payment ledger belum tersedia.",
    };
  }

  if (String(paymentRow.item_type || "").trim().toUpperCase() !== "EBOOK") {
    return {
      enabled: true,
      synced: false,
      skipped: true,
      orderId: normalizedOrderId,
      reason: "Royalty ledger hanya dibuat untuk transaksi e-book.",
    };
  }

  if (!normalizeText(paymentRow.author_id)) {
    return {
      enabled: true,
      synced: false,
      skipped: true,
      orderId: normalizedOrderId,
      reason: "author_id transaksi tidak tersedia.",
    };
  }

  const { data: existingRow, error: existingError } = await supabase
    .from(royaltyTable)
    .select("status,payout_reference,payout_note,earned_at,processing_at,paid_at")
    .eq("order_id", normalizedOrderId)
    .maybeSingle();

  if (existingError) {
    throw toRoyaltyLedgerError(
      `Gagal membaca author royalty ledger: ${existingError.message}`,
      500
    );
  }

  const payload = buildRoyaltyLedgerPayload(paymentRow, existingRow || null);
  const { error } = await supabase
    .from(royaltyTable)
    .upsert(payload, { onConflict: "order_id", ignoreDuplicates: false, defaultToNull: false });

  if (error) {
    throw toRoyaltyLedgerError(
      `Gagal menyimpan author royalty ledger ke Supabase: ${error.message}`,
      500
    );
  }

  return {
    enabled: true,
    synced: true,
    orderId: normalizedOrderId,
    status: payload.status,
    authorId: payload.author_id,
    royaltyCents: payload.author_royalty_cents,
  };
}
