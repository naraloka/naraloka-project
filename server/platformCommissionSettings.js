import { createSupabaseServiceClient, requireAdminUser, toAuthError } from "./auth.js";

export const defaultPlatformCommissionSettings = {
  freeAccessPct: 0,
  paidBookPct: 20,
  membershipPremiumPct: 30,
  membershipEduPct: 25,
};

function clampPct(value, fallback) {
  const next = Number(value);
  if (!Number.isFinite(next)) return fallback;
  return Math.min(60, Math.max(0, Math.round(next)));
}

function mapRowToSettings(row) {
  return {
    freeAccessPct: clampPct(row?.free_access_pct, defaultPlatformCommissionSettings.freeAccessPct),
    paidBookPct: clampPct(row?.paid_book_pct, defaultPlatformCommissionSettings.paidBookPct),
    membershipPremiumPct: clampPct(
      row?.membership_premium_pct,
      defaultPlatformCommissionSettings.membershipPremiumPct
    ),
    membershipEduPct: clampPct(
      row?.membership_edu_pct,
      defaultPlatformCommissionSettings.membershipEduPct
    ),
  };
}

function sanitizeSettings(input = {}) {
  return {
    freeAccessPct: clampPct(
      input.freeAccessPct,
      defaultPlatformCommissionSettings.freeAccessPct
    ),
    paidBookPct: clampPct(input.paidBookPct, defaultPlatformCommissionSettings.paidBookPct),
    membershipPremiumPct: clampPct(
      input.membershipPremiumPct,
      defaultPlatformCommissionSettings.membershipPremiumPct
    ),
    membershipEduPct: clampPct(
      input.membershipEduPct,
      defaultPlatformCommissionSettings.membershipEduPct
    ),
  };
}

export async function fetchPlatformCommissionSettings(env = process.env) {
  let supabase;
  try {
    supabase = createSupabaseServiceClient(env);
  } catch {
    return defaultPlatformCommissionSettings;
  }

  const { data, error } = await supabase
    .from(env.SUPABASE_PLATFORM_COMMISSION_SETTINGS_TABLE || "platform_commission_settings")
    .select(
      "settings_key,free_access_pct,paid_book_pct,membership_premium_pct,membership_edu_pct"
    )
    .eq("settings_key", "default")
    .maybeSingle();

  if (error) {
    throw toAuthError(`Gagal mengambil pengaturan komisi platform: ${error.message}`, 500);
  }

  if (!data) {
    return defaultPlatformCommissionSettings;
  }

  return mapRowToSettings(data);
}

export async function savePlatformCommissionSettings(input = {}, env = process.env) {
  const authUser = await requireAdminUser(input.headers, env);
  const supabase = createSupabaseServiceClient(env);
  const nextSettings = sanitizeSettings(input.settings);

  const { error } = await supabase
    .from(env.SUPABASE_PLATFORM_COMMISSION_SETTINGS_TABLE || "platform_commission_settings")
    .upsert(
      {
        settings_key: "default",
        free_access_pct: nextSettings.freeAccessPct,
        paid_book_pct: nextSettings.paidBookPct,
        membership_premium_pct: nextSettings.membershipPremiumPct,
        membership_edu_pct: nextSettings.membershipEduPct,
        updated_by_user_id: authUser.id,
        updated_at: new Date().toISOString(),
      },
      { onConflict: "settings_key", ignoreDuplicates: false }
    );

  if (error) {
    throw toAuthError(`Gagal menyimpan pengaturan komisi platform: ${error.message}`, 500);
  }

  return {
    message: "Pengaturan komisi platform berhasil disimpan.",
    settings: nextSettings,
  };
}
