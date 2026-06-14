import { createClient } from "@supabase/supabase-js";
import { syncMembershipRoyaltyLedgerFromOrder } from "./membershipRoyaltyLedger.js";
import { syncAuthorRoyaltyLedgerFromOrder } from "./royaltyLedger.js";

function toLedgerError(message, statusCode = 500) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

export function getPaymentLedgerConfig(env = process.env) {
  const supabaseUrl = env.SUPABASE_URL || env.VITE_SUPABASE_URL || "";
  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY || "";
  const tableName = env.SUPABASE_PAYMENT_LEDGER_TABLE || "payment_ledger";

  return {
    supabaseUrl,
    serviceRoleKey,
    tableName,
    enabled: Boolean(supabaseUrl && serviceRoleKey),
  };
}

function createServerSupabaseClient(env = process.env) {
  const config = getPaymentLedgerConfig(env);
  if (!config.enabled) return null;

  return createClient(config.supabaseUrl, config.serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

export async function upsertPaymentLedgerEntry(entry, env = process.env) {
  const config = getPaymentLedgerConfig(env);
  const supabase = createServerSupabaseClient(env);

  if (!supabase) {
    return {
      enabled: false,
      synced: false,
      orderId: String(entry?.order_id || ""),
    };
  }

  const orderId = String(entry?.order_id || "").trim();
  if (!orderId) {
    throw toLedgerError("order_id ledger pembayaran wajib diisi.", 400);
  }

  const payload = {
    ...entry,
    order_id: orderId,
    updated_at: new Date().toISOString(),
  };

  const { error } = await supabase
    .from(config.tableName)
    .upsert(payload, { onConflict: "order_id", ignoreDuplicates: false, defaultToNull: false });

  if (error) {
    throw toLedgerError(
      `Gagal menyimpan ledger pembayaran ke Supabase: ${error.message}`,
      500
    );
  }

  const royalty = await syncAuthorRoyaltyLedgerFromOrder(orderId, env).catch((royaltyError) => {
    throw toLedgerError(royaltyError.message || "Gagal menyinkronkan royalty ledger.", 500);
  });
  const membershipPool = await syncMembershipRoyaltyLedgerFromOrder(orderId, env).catch(
    (membershipError) => {
      throw toLedgerError(
        membershipError.message || "Gagal menyinkronkan membership royalty pool.",
        500
      );
    }
  );

  return {
    enabled: true,
    synced: true,
    orderId,
    royalty,
    membershipPool,
  };
}
