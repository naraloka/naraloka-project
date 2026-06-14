import { createClient } from "@supabase/supabase-js";
import { getTrustedMembershipPlan, requireAuthenticatedUser } from "./auth.js";

function toReaderAccessError(message, statusCode = 400) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function getSupabaseServiceClient(env = process.env) {
  const url = env.SUPABASE_URL || env.VITE_SUPABASE_URL || "";
  const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY || "";
  if (!url || !serviceRoleKey) {
    throw toReaderAccessError("Konfigurasi service role Supabase belum lengkap di server.", 500);
  }

  return createClient(url, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

function normalizeMembershipPlan(value) {
  if (value === "PREMIUM" || value === "EDU") return value;
  return "FREE";
}

function canReadMembershipBook(userPlan, requiredPlan) {
  if (!requiredPlan) {
    return userPlan !== "FREE";
  }

  if (requiredPlan === "EDU") {
    return userPlan === "EDU" || userPlan === "PREMIUM";
  }

  if (requiredPlan === "PREMIUM") {
    return userPlan === "PREMIUM";
  }

  return false;
}

async function getPublishedManuscriptFile(ebookId, env = process.env) {
  const supabase = getSupabaseServiceClient(env);
  const { data, error } = await supabase
    .from("author_manuscripts")
    .select(
      "published_ebook_id,title,published_access,published_required_plan,published_at,file_name,storage_bucket,storage_path,storage_mime_type"
    )
    .eq("published_ebook_id", ebookId)
    .not("published_at", "is", null)
    .maybeSingle();

  if (error) {
    throw toReaderAccessError(`Gagal membaca file e-book terbit: ${error.message}`, 500);
  }

  if (!data) {
    throw toReaderAccessError("File e-book terbit tidak ditemukan.", 404);
  }

  if (!String(data.storage_path || "").trim()) {
    throw toReaderAccessError("File naskah terbit belum tersedia di storage.", 404);
  }

  return data;
}

async function assertPaidAccess(input, env = process.env) {
  const supabase = getSupabaseServiceClient(env);
  const paymentLedgerTable = env.SUPABASE_PAYMENT_LEDGER_TABLE || "payment_ledger";
  const { data, error } = await supabase
    .from(paymentLedgerTable)
    .select("order_id")
    .eq("user_id", input.userId)
    .eq("item_type", "EBOOK")
    .eq("ebook_id", input.ebookId)
    .eq("status", "SUCCESS")
    .eq("should_grant_access", true)
    .limit(1)
    .maybeSingle();

  if (error) {
    throw toReaderAccessError(`Gagal memeriksa akses e-book: ${error.message}`, 500);
  }

  if (!data?.order_id) {
    throw toReaderAccessError("E-book ini belum dimiliki akun kamu.", 403);
  }
}

export async function createPublishedReaderFileUrl(input, env = process.env) {
  const ebookId = String(input?.ebookId || "").trim();
  if (!ebookId) {
    throw toReaderAccessError("ID e-book tidak ditemukan.", 400);
  }

  const manuscript = await getPublishedManuscriptFile(ebookId, env);
  const publishedAccess = String(manuscript.published_access || "").trim();

  if (publishedAccess === "PAID" || publishedAccess === "MEMBERSHIP") {
    const authUser = await requireAuthenticatedUser(input?.headers, env);

    if (publishedAccess === "PAID") {
      await assertPaidAccess({ userId: authUser.id, ebookId }, env);
    } else {
      const membershipPlan = normalizeMembershipPlan(getTrustedMembershipPlan(authUser));
      if (!canReadMembershipBook(membershipPlan, manuscript.published_required_plan || undefined)) {
        throw toReaderAccessError("Membership akun kamu belum memenuhi akses buku ini.", 403);
      }
    }
  } else if (publishedAccess !== "OPEN") {
    throw toReaderAccessError("Mode akses e-book tidak valid.", 400);
  }

  const supabase = getSupabaseServiceClient(env);
  const signedUrlResult = await supabase.storage
    .from(String(manuscript.storage_bucket || "").trim() || "author-manuscripts")
    .createSignedUrl(String(manuscript.storage_path || "").trim(), 60 * 10);

  if (signedUrlResult.error || !signedUrlResult.data?.signedUrl) {
    throw toReaderAccessError(
      `Gagal membuat tautan file e-book: ${signedUrlResult.error?.message || "unknown error"}`,
      500
    );
  }

  return {
    ebookId,
    title: String(manuscript.title || "").trim(),
    fileName: String(manuscript.file_name || "").trim() || "ebook.pdf",
    mimeType: String(manuscript.storage_mime_type || "").trim() || "application/pdf",
    signedUrl: signedUrlResult.data.signedUrl,
  };
}
