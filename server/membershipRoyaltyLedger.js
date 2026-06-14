import { createClient } from "@supabase/supabase-js";

function toMembershipRoyaltyError(message, statusCode = 500) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function nowIso() {
  return new Date().toISOString();
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

function getMembershipRoyaltyLedgerTableName(env = process.env) {
  return (
    env.SUPABASE_AUTHOR_MEMBERSHIP_ROYALTY_LEDGER_TABLE ||
    "author_membership_royalty_ledger"
  );
}

function normalizeMembershipPlan(value) {
  if (value === "PREMIUM" || value === "EDU") return value;
  return null;
}

export function calculateMembershipPoolAllocations(params) {
  const distributablePoolCents = Math.max(0, Number(params.distributablePoolCents || 0));
  const reads = Array.isArray(params.reads) ? params.reads : [];
  const normalizedReads = reads
    .map((item) => ({
      authorId: String(item.authorId || "").trim(),
      ebookIds: Array.isArray(item.ebookIds)
        ? item.ebookIds.map((ebookId) => String(ebookId || "").trim()).filter(Boolean)
        : [],
      pagesRead: Math.max(0, Number(item.pagesRead || 0)),
    }))
    .filter((item) => item.authorId && item.pagesRead > 0);

  const totalPagesRead = normalizedReads.reduce((sum, item) => sum + item.pagesRead, 0);
  if (!normalizedReads.length || totalPagesRead <= 0 || distributablePoolCents <= 0) {
    return [];
  }

  const allocations = normalizedReads.map((item, index) => {
    const ratio = item.pagesRead / totalPagesRead;
    const cents =
      index === normalizedReads.length - 1
        ? 0
        : Math.max(0, Math.floor(distributablePoolCents * ratio));

    return {
      authorId: item.authorId,
      ebookIds: item.ebookIds,
      pagesRead: item.pagesRead,
      allocationRatio: ratio,
      authorRoyaltyCents: cents,
    };
  });

  const allocatedBeforeLast = allocations.reduce(
    (sum, item, index) =>
      index === allocations.length - 1 ? sum : sum + item.authorRoyaltyCents,
    0
  );
  const lastIndex = allocations.length - 1;
  allocations[lastIndex] = {
    ...allocations[lastIndex],
    authorRoyaltyCents: Math.max(0, distributablePoolCents - allocatedBeforeLast),
  };

  return allocations;
}

async function syncMembershipRoyaltyLedgerFromPaymentRow(paymentRow, supabase, env = process.env) {
  const normalizedPlan = normalizeMembershipPlan(paymentRow.membership_plan);
  const normalizedUserId = normalizeText(paymentRow.user_id);
  const normalizedOrderId = String(paymentRow.order_id || "").trim();
  const tableName = getMembershipRoyaltyLedgerTableName(env);

  if (!normalizedOrderId) {
    throw toMembershipRoyaltyError("order_id membership royalty wajib diisi.", 400);
  }

  if (
    String(paymentRow.item_type || "").trim().toUpperCase() !== "MEMBERSHIP" ||
    !normalizedPlan ||
    !normalizedUserId
  ) {
    return {
      enabled: true,
      synced: false,
      skipped: true,
      orderId: normalizedOrderId,
      reason: "Order bukan membership valid untuk pembagian pool.",
    };
  }

  const paymentStatus = String(paymentRow.status || "").trim().toUpperCase();
  if (paymentStatus !== "SUCCESS") {
    const { error: voidError } = await supabase
      .from(tableName)
      .update({
        status: paymentStatus === "FAILED" ? "VOID" : "PENDING",
        payment_status: paymentStatus || "PENDING",
        updated_at: nowIso(),
        last_synced_at: nowIso(),
      })
      .eq("order_id", normalizedOrderId);

    if (voidError) {
      throw toMembershipRoyaltyError(
        `Gagal memperbarui status membership royalty ledger: ${voidError.message}`,
        500
      );
    }

    return {
      enabled: true,
      synced: true,
      orderId: normalizedOrderId,
      entries: 0,
      reason: "Payment membership belum sukses.",
    };
  }

  const distributablePoolCents = Math.max(
    0,
    Number(paymentRow.amount_cents || 0) - Number(paymentRow.platform_commission_cents || 0)
  );

  const [{ data: libraryRows, error: libraryError }, { data: membershipBooks, error: booksError }] =
    await Promise.all([
      supabase
        .from("user_library_state")
        .select("ebook_id,current_page,total_pages")
        .eq("user_id", normalizedUserId),
      supabase
        .from("author_manuscripts")
        .select("author_id,published_ebook_id,published_required_plan,published_access")
        .eq("published_access", "MEMBERSHIP")
        .eq("published_required_plan", normalizedPlan)
        .not("published_ebook_id", "is", null),
    ]);

  if (libraryError) {
    throw toMembershipRoyaltyError(
      `Gagal membaca progress membership reader: ${libraryError.message}`,
      500
    );
  }
  if (booksError) {
    throw toMembershipRoyaltyError(
      `Gagal membaca katalog membership penulis: ${booksError.message}`,
      500
    );
  }

  const bookByEbookId = new Map();
  for (const row of membershipBooks ?? []) {
    const ebookId = String(row.published_ebook_id || "").trim();
    const authorId = String(row.author_id || "").trim();
    if (!ebookId || !authorId) continue;
    bookByEbookId.set(ebookId, {
      authorId,
      ebookId,
    });
  }

  const readsByAuthor = new Map();
  for (const row of libraryRows ?? []) {
    const ebookId = String(row.ebook_id || "").trim();
    const book = bookByEbookId.get(ebookId);
    if (!book) continue;

    const totalPages = Math.max(1, Number(row.total_pages || 1));
    const currentPage = Math.min(totalPages, Math.max(1, Number(row.current_page || 1)));
    const pagesRead = Math.max(0, currentPage - 1);
    if (pagesRead <= 0) continue;

    const current = readsByAuthor.get(book.authorId) || {
      authorId: book.authorId,
      ebookIds: [],
      pagesRead: 0,
    };
    current.pagesRead += pagesRead;
    if (!current.ebookIds.includes(book.ebookId)) {
      current.ebookIds.push(book.ebookId);
    }
    readsByAuthor.set(book.authorId, current);
  }

  const allocations = calculateMembershipPoolAllocations({
    distributablePoolCents,
    reads: Array.from(readsByAuthor.values()),
  });

  const existingRowsResult = await supabase
    .from(tableName)
    .select("entry_id,author_id,status,payout_reference,payout_note,processing_at,paid_at")
    .eq("order_id", normalizedOrderId);

  if (existingRowsResult.error) {
    throw toMembershipRoyaltyError(
      `Gagal membaca ledger membership sebelumnya: ${existingRowsResult.error.message}`,
      500
    );
  }

  const existingRows = Array.isArray(existingRowsResult.data) ? existingRowsResult.data : [];
  const existingByAuthorId = new Map(
    existingRows.map((row) => [String(row.author_id || "").trim(), row])
  );

  const allocationAuthorIds = new Set(allocations.map((item) => item.authorId));
  const authorsToVoid = Array.from(existingByAuthorId.keys()).filter(
    (authorId) => !allocationAuthorIds.has(authorId)
  );

  if (authorsToVoid.length) {
    const { error: voidError } = await supabase
      .from(tableName)
      .update({
        status: "VOID",
        author_royalty_cents: 0,
        allocation_ratio: 0,
        allocation_basis_pages: 0,
        source_ebook_ids: [],
        updated_at: nowIso(),
        last_synced_at: nowIso(),
      })
      .eq("order_id", normalizedOrderId)
      .in("author_id", authorsToVoid);

    if (voidError) {
      throw toMembershipRoyaltyError(
        `Gagal menandai allocation membership lama sebagai void: ${voidError.message}`,
        500
      );
    }
  }

  if (!allocations.length) {
    return {
      enabled: true,
      synced: true,
      orderId: normalizedOrderId,
      entries: 0,
      distributablePoolCents,
      reason: "Belum ada konsumsi baca membership yang memenuhi untuk dibagikan.",
    };
  }

  const payload = allocations.map((allocation) => {
    const entryId = `${normalizedOrderId}::${allocation.authorId}`;
    const existing = existingByAuthorId.get(allocation.authorId);
    const preservedStatus = String(existing?.status || "").trim().toUpperCase();
    const nextStatus =
      preservedStatus === "PROCESSING" || preservedStatus === "PAID"
        ? preservedStatus
        : "AVAILABLE";
    const earnedAt = nowIso();

    return {
      entry_id: entryId,
      order_id: normalizedOrderId,
      buyer_user_id: normalizedUserId,
      author_id: allocation.authorId,
      membership_plan: normalizedPlan,
      item_label: normalizeText(paymentRow.item_label) || `Membership ${normalizedPlan}`,
      pool_amount_cents: Math.max(0, Number(paymentRow.amount_cents || 0)),
      platform_commission_pct: normalizeNumber(paymentRow.platform_commission_pct),
      platform_commission_cents: Math.max(0, Number(paymentRow.platform_commission_cents || 0)),
      distributable_pool_cents: distributablePoolCents,
      allocation_basis_pages: allocation.pagesRead,
      allocation_ratio: allocation.allocationRatio,
      author_royalty_cents: allocation.authorRoyaltyCents,
      payment_status: paymentStatus,
      status: nextStatus,
      payout_reference: normalizeText(existing?.payout_reference),
      payout_note: normalizeText(existing?.payout_note),
      source_ebook_ids: allocation.ebookIds,
      earned_at: earnedAt,
      processing_at:
        nextStatus === "PROCESSING" || nextStatus === "PAID"
          ? existing?.processing_at || nowIso()
          : null,
      paid_at: nextStatus === "PAID" ? existing?.paid_at || nowIso() : null,
      last_synced_at: nowIso(),
      updated_at: nowIso(),
    };
  });

  const { error: upsertError } = await supabase
    .from(tableName)
    .upsert(payload, { onConflict: "entry_id", ignoreDuplicates: false, defaultToNull: false });

  if (upsertError) {
    throw toMembershipRoyaltyError(
      `Gagal menyimpan membership royalty ledger: ${upsertError.message}`,
      500
    );
  }

  return {
    enabled: true,
    synced: true,
    orderId: normalizedOrderId,
    entries: payload.length,
    distributablePoolCents,
  };
}

export async function syncMembershipRoyaltyLedgerFromOrder(orderId, env = process.env) {
  const normalizedOrderId = String(orderId || "").trim();
  if (!normalizedOrderId) {
    throw toMembershipRoyaltyError("order_id membership pool wajib diisi.", 400);
  }

  const supabase = createServerSupabaseClient(env);
  if (!supabase) {
    return {
      enabled: false,
      synced: false,
      orderId: normalizedOrderId,
    };
  }

  const { data: paymentRow, error } = await supabase
    .from(env.SUPABASE_PAYMENT_LEDGER_TABLE || "payment_ledger")
    .select(
      "order_id,user_id,item_type,item_label,amount_cents,membership_plan,status,platform_commission_pct,platform_commission_cents,created_at,updated_at"
    )
    .eq("order_id", normalizedOrderId)
    .maybeSingle();

  if (error) {
    throw toMembershipRoyaltyError(
      `Gagal membaca payment ledger membership: ${error.message}`,
      500
    );
  }

  if (!paymentRow) {
    return {
      enabled: true,
      synced: false,
      skipped: true,
      orderId: normalizedOrderId,
      reason: "Payment ledger membership belum tersedia.",
    };
  }

  return syncMembershipRoyaltyLedgerFromPaymentRow(paymentRow, supabase, env);
}

export async function syncMembershipRoyaltyLedgerForUser(userId, env = process.env) {
  const normalizedUserId = String(userId || "").trim();
  if (!normalizedUserId) {
    throw toMembershipRoyaltyError("user_id membership pool wajib diisi.", 400);
  }

  const supabase = createServerSupabaseClient(env);
  if (!supabase) {
    return {
      enabled: false,
      synced: false,
      userId: normalizedUserId,
      orders: 0,
    };
  }

  const { data, error } = await supabase
    .from(env.SUPABASE_PAYMENT_LEDGER_TABLE || "payment_ledger")
    .select("order_id")
    .eq("user_id", normalizedUserId)
    .eq("item_type", "MEMBERSHIP")
    .order("updated_at", { ascending: false });

  if (error) {
    throw toMembershipRoyaltyError(
      `Gagal membaca order membership user: ${error.message}`,
      500
    );
  }

  const orderIds = (data ?? [])
    .map((row) => String(row.order_id || "").trim())
    .filter(Boolean);

  const results = [];
  for (const orderId of orderIds) {
    results.push(await syncMembershipRoyaltyLedgerFromOrder(orderId, env));
  }

  return {
    enabled: true,
    synced: true,
    userId: normalizedUserId,
    orders: orderIds.length,
    results,
  };
}
