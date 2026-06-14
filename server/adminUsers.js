import {
  createSupabaseServiceClient,
  getTrustedMembershipPlan,
  requireAdminUser,
  toAuthError,
} from "./auth.js";

function readString(value) {
  return typeof value === "string" && value.trim() ? value.trim() : "";
}

function normalizeRole(user) {
  const appRole = readString(user?.app_metadata?.role);
  const profileRole = readString(user?.user_metadata?.role);
  if (appRole === "ADMIN") return "ADMIN";
  if (appRole === "AUTHOR" || profileRole === "AUTHOR") return "AUTHOR";
  return "READER";
}

function normalizeMembershipPlan(user) {
  return getTrustedMembershipPlan(user);
}

function getDisplayName(user) {
  return (
    readString(user?.user_metadata?.full_name) ||
    readString(user?.user_metadata?.name) ||
    readString(user?.email).split("@")[0] ||
    "Pengguna"
  );
}

function getLatestIso(a, b) {
  if (!a) return b || "";
  if (!b) return a || "";
  return new Date(a).getTime() >= new Date(b).getTime() ? a : b;
}

function mapAdminUserSummary(user, aggregates) {
  const profile = aggregates.profilesByUserId.get(user.id);
  const manuscriptSummary = aggregates.manuscriptsByAuthorId.get(user.id);
  const paymentSummary = aggregates.paymentsByUserId.get(user.id);
  const readerSummary = aggregates.readerStateByUserId.get(user.id);
  const bannedUntil = readString(user.banned_until);
  const isSuspended = Boolean(bannedUntil && new Date(bannedUntil).getTime() > Date.now());

  return {
    id: user.id,
    name: getDisplayName(user),
    email: readString(user.email),
    role: normalizeRole(user),
    membershipPlan: normalizeMembershipPlan(user),
    avatarUrl: readString(user.user_metadata?.avatar_url) || profile?.avatarUrl || "",
    phone: readString(user.user_metadata?.phone) || profile?.phone || "",
    city: readString(user.user_metadata?.city),
    website: readString(user.user_metadata?.website),
    bio: readString(user.user_metadata?.bio) || profile?.bio || "",
    providerList: Array.isArray(user.app_metadata?.providers)
      ? user.app_metadata.providers
          .map((item) => readString(item))
          .filter(Boolean)
      : [],
    emailConfirmed: Boolean(user.email_confirmed_at),
    createdAtISO: readString(user.created_at),
    lastSignInAtISO: readString(user.last_sign_in_at),
    bannedUntilISO: bannedUntil,
    isSuspended,
    authorProfile: {
      displayName: profile?.displayName || "",
      specialty: profile?.specialty || "",
      portfolioUrl: profile?.portfolioUrl || "",
    },
    stats: {
      manuscriptCount: manuscriptSummary?.manuscriptCount || 0,
      publishedBooksCount: manuscriptSummary?.publishedBooksCount || 0,
      transactionCount: paymentSummary?.transactionCount || 0,
      successfulTransactionCount: paymentSummary?.successfulTransactionCount || 0,
      ownedBookCount: readerSummary?.ownedBookCount || 0,
      readingBookCount: readerSummary?.readingBookCount || 0,
    },
    lastActivityAtISO:
      getLatestIso(
        readString(user.last_sign_in_at),
        getLatestIso(paymentSummary?.lastPaymentAtISO || "", readerSummary?.lastReadAtISO || "")
      ) || readString(user.created_at),
  };
}

async function loadAggregates(supabase, userIds) {
  if (!userIds.length) {
    return {
      profilesByUserId: new Map(),
      manuscriptsByAuthorId: new Map(),
      paymentsByUserId: new Map(),
      readerStateByUserId: new Map(),
    };
  }

  const [profilesResult, manuscriptsResult, paymentsResult, readerStateResult] = await Promise.all([
    supabase
      .from("author_workspace_profiles")
      .select("user_id,display_name,avatar_url,bio,phone,portfolio_url,specialty")
      .in("user_id", userIds),
    supabase
      .from("author_manuscripts")
      .select("author_id,published_at")
      .in("author_id", userIds),
    supabase
      .from("payment_ledger")
      .select("user_id,status,updated_at,created_at")
      .in("user_id", userIds),
    supabase
      .from("user_library_state")
      .select("user_id,owned,current_page,last_read_at")
      .in("user_id", userIds),
  ]);

  const firstError =
    profilesResult.error ||
    manuscriptsResult.error ||
    paymentsResult.error ||
    readerStateResult.error;
  if (firstError) {
    throw toAuthError(`Gagal mengambil ringkasan pengguna admin: ${firstError.message}`, 500);
  }

  const profilesByUserId = new Map();
  for (const row of profilesResult.data || []) {
    const userId = readString(row.user_id);
    if (!userId) continue;
    profilesByUserId.set(userId, {
      displayName: readString(row.display_name),
      avatarUrl: readString(row.avatar_url),
      bio: readString(row.bio),
      phone: readString(row.phone),
      portfolioUrl: readString(row.portfolio_url),
      specialty: readString(row.specialty),
    });
  }

  const manuscriptsByAuthorId = new Map();
  for (const row of manuscriptsResult.data || []) {
    const authorId = readString(row.author_id);
    if (!authorId) continue;
    const current = manuscriptsByAuthorId.get(authorId) || {
      manuscriptCount: 0,
      publishedBooksCount: 0,
    };
    current.manuscriptCount += 1;
    if (row.published_at) current.publishedBooksCount += 1;
    manuscriptsByAuthorId.set(authorId, current);
  }

  const paymentsByUserId = new Map();
  for (const row of paymentsResult.data || []) {
    const userId = readString(row.user_id);
    if (!userId) continue;
    const current = paymentsByUserId.get(userId) || {
      transactionCount: 0,
      successfulTransactionCount: 0,
      lastPaymentAtISO: "",
    };
    current.transactionCount += 1;
    if (readString(row.status) === "SUCCESS") current.successfulTransactionCount += 1;
    current.lastPaymentAtISO = getLatestIso(
      current.lastPaymentAtISO,
      readString(row.updated_at) || readString(row.created_at)
    );
    paymentsByUserId.set(userId, current);
  }

  const readerStateByUserId = new Map();
  for (const row of readerStateResult.data || []) {
    const userId = readString(row.user_id);
    if (!userId) continue;
    const current = readerStateByUserId.get(userId) || {
      ownedBookCount: 0,
      readingBookCount: 0,
      lastReadAtISO: "",
    };
    if (row.owned) current.ownedBookCount += 1;
    if (Number(row.current_page || 0) > 1) current.readingBookCount += 1;
    current.lastReadAtISO = getLatestIso(current.lastReadAtISO, readString(row.last_read_at));
    readerStateByUserId.set(userId, current);
  }

  return {
    profilesByUserId,
    manuscriptsByAuthorId,
    paymentsByUserId,
    readerStateByUserId,
  };
}

export async function listAdminUsers(input = {}, env = process.env) {
  const authUser = await requireAdminUser(input.headers, env);
  const supabase = createSupabaseServiceClient(env);

  const { data, error } = await supabase.auth.admin.listUsers({
    page: 1,
    perPage: 200,
  });
  if (error) {
    throw toAuthError(`Gagal mengambil daftar pengguna admin: ${error.message}`, 500);
  }

  const users = Array.isArray(data?.users) ? data.users : [];
  const userIds = users.map((user) => readString(user.id)).filter(Boolean);
  const aggregates = await loadAggregates(supabase, userIds);

  return {
    currentAdminUserId: authUser.id,
    users: users
      .map((user) => mapAdminUserSummary(user, aggregates))
      .sort(
        (a, b) =>
          new Date(b.lastActivityAtISO || b.createdAtISO || 0).getTime() -
          new Date(a.lastActivityAtISO || a.createdAtISO || 0).getTime()
      ),
  };
}

export async function updateAdminUserStatus(input = {}, env = process.env) {
  const authUser = await requireAdminUser(input.headers, env);
  const userId = readString(input.userId);
  const action = readString(input.action);

  if (!userId) {
    throw toAuthError("ID pengguna admin belum valid.", 400);
  }
  if (action !== "suspend" && action !== "activate") {
    throw toAuthError("Aksi admin pengguna tidak dikenali.", 400);
  }
  if (action === "suspend" && userId === authUser.id) {
    throw toAuthError("Admin tidak bisa menangguhkan akunnya sendiri.", 400);
  }

  const supabase = createSupabaseServiceClient(env);
  const { data: userResult, error: userError } = await supabase.auth.admin.getUserById(userId);
  if (userError || !userResult.user) {
    throw toAuthError(
      `Data pengguna admin tidak ditemukan: ${userError?.message || "unknown error"}`,
      404
    );
  }

  const { error: updateError } = await supabase.auth.admin.updateUserById(userId, {
    ban_duration: action === "suspend" ? "876000h" : "none",
  });
  if (updateError) {
    throw toAuthError(`Gagal memperbarui status pengguna: ${updateError.message}`, 500);
  }

  const aggregates = await loadAggregates(supabase, [userId]);
  const { data: refreshedUserResult, error: refreshedUserError } =
    await supabase.auth.admin.getUserById(userId);
  if (refreshedUserError || !refreshedUserResult.user) {
    throw toAuthError(
      `Status pengguna berhasil diubah, tetapi data terbaru gagal dimuat: ${
        refreshedUserError?.message || "unknown error"
      }`,
      500
    );
  }

  return {
    message:
      action === "suspend"
        ? "Pengguna berhasil ditangguhkan."
        : "Pengguna berhasil diaktifkan kembali.",
    user: mapAdminUserSummary(refreshedUserResult.user, aggregates),
  };
}
