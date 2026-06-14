import { createClient } from "@supabase/supabase-js";

export function toAuthError(message, statusCode = 401) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function readMetadataString(value) {
  return typeof value === "string" && value.trim() ? value.trim() : "";
}

function getSupabaseUrl(env = process.env) {
  return env.SUPABASE_URL || env.VITE_SUPABASE_URL || "";
}

function getSupabaseAnonKey(env = process.env) {
  return env.SUPABASE_ANON_KEY || env.VITE_SUPABASE_ANON_KEY || "";
}

function getSupabaseServiceRoleKey(env = process.env) {
  return env.SUPABASE_SERVICE_ROLE_KEY || "";
}

function normalizeHeaderLookup(headers, key) {
  if (!headers) return "";

  if (typeof headers.get === "function") {
    return String(headers.get(key) || headers.get(key.toLowerCase()) || "").trim();
  }

  const value = headers[key] ?? headers[key.toLowerCase()];
  return String(Array.isArray(value) ? value[0] || "" : value || "").trim();
}

export function getBearerTokenFromHeaders(headers) {
  const authorization = normalizeHeaderLookup(headers, "authorization");
  const match = /^Bearer\s+(.+)$/i.exec(authorization);
  return match?.[1]?.trim() || "";
}

function createSupabaseAuthClient(env = process.env) {
  const url = getSupabaseUrl(env);
  const anonKey = getSupabaseAnonKey(env);
  if (!url || !anonKey) {
    throw toAuthError("Konfigurasi Supabase auth belum lengkap di server.", 500);
  }

  return createClient(url, anonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

export function createSupabaseServiceClient(env = process.env) {
  const url = getSupabaseUrl(env);
  const serviceRoleKey = getSupabaseServiceRoleKey(env);
  if (!url || !serviceRoleKey) {
    throw toAuthError("Konfigurasi service role Supabase belum lengkap di server.", 500);
  }

  return createClient(url, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

export async function requireAuthenticatedUser(headers, env = process.env) {
  const accessToken = getBearerTokenFromHeaders(headers);
  if (!accessToken) {
    throw toAuthError("Sesi login tidak ditemukan. Silakan login ulang.", 401);
  }

  const supabase = createSupabaseAuthClient(env);
  const { data, error } = await supabase.auth.getUser(accessToken);
  if (error || !data.user) {
    throw toAuthError("Sesi login tidak valid atau sudah berakhir.", 401);
  }

  return data.user;
}

export async function requireAdminUser(headers, env = process.env) {
  const user = await requireAuthenticatedUser(headers, env);
  const role = readMetadataString(user.app_metadata?.role);

  if (role !== "ADMIN") {
    throw toAuthError("Akses ini hanya untuk admin.", 403);
  }

  return user;
}

export function getTrustedMembershipPlan(user) {
  const membershipPlan = readMetadataString(user?.app_metadata?.membership_plan);
  if (membershipPlan === "PREMIUM" || membershipPlan === "EDU") {
    return membershipPlan;
  }
  return "FREE";
}

export async function assertPaymentLedgerOwnership(input, env = process.env) {
  const orderId = String(input?.orderId || "").trim();
  const userId = String(input?.userId || "").trim();
  if (!orderId || !userId) {
    throw toAuthError("Validasi ownership order tidak lengkap.", 400);
  }

  const supabase = createSupabaseServiceClient(env);
  const { data, error } = await supabase
    .from(env.SUPABASE_PAYMENT_LEDGER_TABLE || "payment_ledger")
    .select("order_id,user_id")
    .eq("order_id", orderId)
    .maybeSingle();

  if (error) {
    throw toAuthError(`Gagal memverifikasi order pembayaran: ${error.message}`, 500);
  }

  if (!data || String(data.user_id || "").trim() !== userId) {
    throw toAuthError("Order pembayaran tidak ditemukan atau bukan milik akun ini.", 403);
  }

  return data;
}
