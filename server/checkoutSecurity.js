import { createClient } from "@supabase/supabase-js";
import { fetchPlatformCommissionSettings } from "./platformCommissionSettings.js";

function toCheckoutError(message, statusCode = 400) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

const membershipCatalog = {
  PREMIUM: {
    itemId: "naraloka-premium",
    itemName: "Langganan Naraloka Premium",
    amount: 49000,
    membershipPlan: "PREMIUM",
  },
  EDU: {
    itemId: "naraloka-edu",
    itemName: "Langganan Naraloka Edukasi",
    amount: 29000,
    membershipPlan: "EDU",
  },
};

function getSupabaseServiceClient(env = process.env) {
  const url = env.SUPABASE_URL || env.VITE_SUPABASE_URL || "";
  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY || "";
  if (!url || !serviceRoleKey) {
    return null;
  }

  return createClient(url, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

function sanitizeText(value) {
  return String(value || "").trim();
}

function sanitizeBuyerWhatsApp(value) {
  const digits = String(value || "").replace(/[^\d+]/g, "").trim();
  if (digits.length < 8) {
    throw toCheckoutError("Nomor WhatsApp pembeli belum valid.", 400);
  }
  return digits;
}

function sanitizeFinishUrl(value) {
  const next = sanitizeText(value);
  if (!next) return null;
  try {
    const url = new URL(next);
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      return null;
    }
    return url.toString();
  } catch {
    return null;
  }
}

function buildBreakdown(amount, platformCommissionPct, withAuthorRoyalty) {
  const amountCents = Math.max(0, Math.round(Number(amount || 0) * 100));
  const pct = Math.min(100, Math.max(0, Math.round(Number(platformCommissionPct || 0))));
  const platformCommissionCents = Math.round((amountCents * pct) / 100);
  const authorRoyaltyPct = withAuthorRoyalty ? 100 - pct : 0;
  const authorRoyaltyCents = withAuthorRoyalty ? amountCents - platformCommissionCents : 0;

  return {
    platformCommissionPct: pct,
    platformCommissionCents,
    authorRoyaltyPct,
    authorRoyaltyCents,
  };
}

async function resolvePublishedPaidEbook(ebookId, royaltyConfig, env = process.env) {
  const supabase = getSupabaseServiceClient(env);
  if (!supabase) {
    return null;
  }

  const { data, error } = await supabase
    .from("author_manuscripts")
    .select("published_ebook_id,title,author_id,published_access,published_price_cents")
    .eq("published_ebook_id", ebookId)
    .eq("published_access", "PAID")
    .not("published_at", "is", null)
    .maybeSingle();

  if (error) {
    throw toCheckoutError(`Gagal membaca katalog e-book terbit: ${error.message}`, 500);
  }

  if (!data) {
    return null;
  }

  return {
    itemId: String(data.published_ebook_id || "").trim(),
    itemName: sanitizeText(data.title) || "E-book Naraloka",
    authorId: sanitizeText(data.author_id),
    amount: Math.max(0, Math.round(Number(data.published_price_cents || 0) / 100)),
    ebookId: String(data.published_ebook_id || "").trim(),
    platformCommissionPct: royaltyConfig.paidBookPct,
  };
}

async function ensureNoDuplicateSuccessfulEbookPurchase(input, env = process.env) {
  const supabase = getSupabaseServiceClient(env);
  if (!supabase) {
    return;
  }

  const { data, error } = await supabase
    .from(env.SUPABASE_PAYMENT_LEDGER_TABLE || "payment_ledger")
    .select("order_id")
    .eq("user_id", input.userId)
    .eq("item_type", "EBOOK")
    .eq("ebook_id", input.ebookId)
    .eq("status", "SUCCESS")
    .eq("should_grant_access", true)
    .limit(1)
    .maybeSingle();

  if (error) {
    throw toCheckoutError(`Gagal memeriksa kepemilikan e-book: ${error.message}`, 500);
  }

  if (data?.order_id) {
    throw toCheckoutError("E-book ini sudah dimiliki akun kamu.", 409);
  }
}

export async function resolveTrustedCheckoutPayload(input, env = process.env) {
  const royaltyConfig = await fetchPlatformCommissionSettings(env);
  const itemType = sanitizeText(input?.itemType).toUpperCase();
  const fullName =
    sanitizeText(input?.buyerName) ||
    sanitizeText(input?.authUser?.user_metadata?.full_name) ||
    sanitizeText(input?.authUser?.email?.split("@")[0]) ||
    "Pembeli Naraloka";
  const buyerEmail = sanitizeText(input?.authUser?.email);
  const buyerWhatsApp = sanitizeBuyerWhatsApp(input?.buyerWhatsApp);
  const finishUrl = sanitizeFinishUrl(input?.finishUrl);

  if (!buyerEmail) {
    throw toCheckoutError("Email akun pembeli tidak tersedia.", 400);
  }

  if (itemType === "MEMBERSHIP") {
    const plan = sanitizeText(input?.membershipPlan).toUpperCase();
    const product = membershipCatalog[plan];
    if (!product) {
      throw toCheckoutError("Paket membership yang dipilih tidak valid.", 400);
    }

    const breakdown = buildBreakdown(
      product.amount,
      product.membershipPlan === "EDU"
        ? royaltyConfig.membershipEduPct
        : royaltyConfig.membershipPremiumPct,
      false
    );
    return {
      userId: sanitizeText(input?.authUser?.id),
      itemType: "MEMBERSHIP",
      itemId: product.itemId,
      itemName: product.itemName,
      amount: product.amount,
      buyerName: fullName,
      buyerEmail,
      buyerWhatsApp,
      membershipPlan: product.membershipPlan,
      ebookId: undefined,
      authorId: undefined,
      paymentMethod: sanitizeText(input?.paymentMethod),
      preferredMethod: sanitizeText(input?.preferredMethod),
      preferredBank: sanitizeText(input?.preferredBank),
      preferredWallet: sanitizeText(input?.preferredWallet),
      finishUrl: finishUrl || undefined,
      ...breakdown,
    };
  }

  if (itemType !== "EBOOK") {
    throw toCheckoutError("Jenis item checkout tidak valid.", 400);
  }

  const ebookId = sanitizeText(input?.ebookId || input?.itemId);
  if (!ebookId) {
    throw toCheckoutError("E-book checkout tidak ditemukan.", 400);
  }

  const product = await resolvePublishedPaidEbook(ebookId, royaltyConfig, env);
  if (!product || !product.amount) {
    throw toCheckoutError("E-book tidak tersedia untuk pembelian satuan.", 400);
  }

  await ensureNoDuplicateSuccessfulEbookPurchase(
    {
      userId: sanitizeText(input?.authUser?.id),
      ebookId: product.ebookId,
    },
    env
  );

  const breakdown = buildBreakdown(product.amount, product.platformCommissionPct, true);
  return {
    userId: sanitizeText(input?.authUser?.id),
    itemType: "EBOOK",
    itemId: product.itemId,
    itemName: product.itemName,
    amount: product.amount,
    buyerName: fullName,
    buyerEmail,
    buyerWhatsApp,
    membershipPlan: undefined,
    ebookId: product.ebookId,
    authorId: product.authorId,
    paymentMethod: sanitizeText(input?.paymentMethod),
    preferredMethod: sanitizeText(input?.preferredMethod),
    preferredBank: sanitizeText(input?.preferredBank),
    preferredWallet: sanitizeText(input?.preferredWallet),
    finishUrl: finishUrl || undefined,
    ...breakdown,
  };
}
