import { getSupabaseAccessToken } from "@/lib/supabase";
import type { MembershipPlan, UserRole } from "@/types/domain";

export type AdminUserSummary = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  membershipPlan: MembershipPlan;
  avatarUrl?: string;
  phone?: string;
  city?: string;
  website?: string;
  bio?: string;
  providerList: string[];
  emailConfirmed: boolean;
  createdAtISO?: string;
  lastSignInAtISO?: string;
  bannedUntilISO?: string;
  isSuspended: boolean;
  lastActivityAtISO?: string;
  authorProfile: {
    displayName?: string;
    specialty?: string;
    portfolioUrl?: string;
  };
  stats: {
    manuscriptCount: number;
    publishedBooksCount: number;
    transactionCount: number;
    successfulTransactionCount: number;
    ownedBookCount: number;
    readingBookCount: number;
  };
};

type AdminUsersResponse = {
  currentAdminUserId: string;
  users: AdminUserSummary[];
};

type AdminUserActionResponse = {
  message: string;
  user: AdminUserSummary;
};

async function createAdminRequestHeaders() {
  const accessToken = await getSupabaseAccessToken();
  if (!accessToken) {
    throw new Error("Sesi admin tidak ditemukan. Silakan login ulang.");
  }

  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${accessToken}`,
  };
}

export async function fetchAdminUsers() {
  const response = await fetch("/api/admin/users", {
    method: "GET",
    headers: await createAdminRequestHeaders(),
  });

  const payload = (await response.json().catch(() => ({}))) as
    | AdminUsersResponse
    | { message?: string };

  if (!response.ok) {
    throw new Error(
      "message" in payload && typeof payload.message === "string"
        ? payload.message
        : "Gagal mengambil daftar pengguna admin."
    );
  }

  return payload as AdminUsersResponse;
}

export async function updateAdminUserAction(input: {
  userId: string;
  action: "suspend" | "activate";
}) {
  const response = await fetch("/api/admin/users", {
    method: "POST",
    headers: await createAdminRequestHeaders(),
    body: JSON.stringify(input),
  });

  const payload = (await response.json().catch(() => ({}))) as
    | AdminUserActionResponse
    | { message?: string };

  if (!response.ok) {
    throw new Error(
      "message" in payload && typeof payload.message === "string"
        ? payload.message
        : "Gagal memperbarui status pengguna admin."
    );
  }

  return payload as AdminUserActionResponse;
}
