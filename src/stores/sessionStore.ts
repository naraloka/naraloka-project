import { create } from "zustand";
import type { User } from "@supabase/supabase-js";
import type { MembershipPlan, UserProfile, UserRole } from "@/types/domain";
import { getAppUrl } from "@/lib/appUrl";
import { fetchMembershipRoyaltyLedgerSnapshot } from "@/lib/membershipRoyaltyLedger";
import { syncLedgerStateForUser } from "@/lib/paymentLedger";
import { fetchPlatformCommissionSettings } from "@/lib/platformCommissionSettings";
import { fetchRoyaltyLedgerSnapshot } from "@/lib/royaltyLedger";
import { fetchPayoutSlipArchiveSnapshot } from "@/lib/payoutSlipArchive";
import { fetchReaderStateForUser } from "@/lib/readerState";
import { fetchAuthorWorkspaceSnapshot, fetchPublicAuthorWorkspaceSnapshot } from "@/lib/authorWorkspace";
import { useLibraryStore } from "@/stores/libraryStore";
import { usePublishingStore } from "@/stores/publishingStore";
import {
  getReadableSupabaseError,
  getSupabaseUserProfile,
  getTrustedSupabaseMembershipPlan,
  getTrustedSupabaseUserRole,
  isSupabaseConfigured,
  supabase,
} from "@/lib/supabase";

type SelectableRole = Extract<UserRole, "READER" | "AUTHOR">;

const pendingRoleStorageKey = "naraloka_pending_signup_role";

function normalizeSelectableRole(value: unknown): SelectableRole {
  return value === "AUTHOR" ? "AUTHOR" : "READER";
}

function setPendingSignupRole(role: SelectableRole) {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(pendingRoleStorageKey, role);
}

function takePendingSignupRole(): SelectableRole | null {
  if (typeof window === "undefined") return null;
  const value = window.sessionStorage.getItem(pendingRoleStorageKey);
  if (value === "READER" || value === "AUTHOR") {
    window.sessionStorage.removeItem(pendingRoleStorageKey);
    return value;
  }
  return null;
}

async function syncPendingOAuthRole(user: User | null) {
  if (!user || !supabase) return user;
  const pendingRole = takePendingSignupRole();
  if (!pendingRole) return user;
  const resolvedRole = getTrustedSupabaseUserRole(user);
  if (resolvedRole === "READER" || resolvedRole === "AUTHOR") return user;

  const { data, error } = await supabase.auth.updateUser({
    data: {
      ...user.user_metadata,
      role: pendingRole,
    },
  });

  if (error) return user;
  return data.user ?? user;
}

async function getUserProfileWithLedger(user: User | null) {
  if (!user) return null;

  const profile = getSupabaseUserProfile(user);
  const trustedMembershipFallback = getTrustedSupabaseMembershipPlan(user);
  const [
    ledgerSync,
    readerSync,
    authorWorkspaceSync,
    royaltyLedgerSync,
    membershipRoyaltySync,
    payoutSlipArchiveSync,
  ] = await Promise.all([
    syncLedgerStateForUser(profile.id, trustedMembershipFallback),
    fetchReaderStateForUser(profile.id),
    fetchAuthorWorkspaceSnapshot({ userId: profile.id, role: profile.role }),
    fetchRoyaltyLedgerSnapshot({ userId: profile.id, role: profile.role }),
    fetchMembershipRoyaltyLedgerSnapshot({ userId: profile.id, role: profile.role }),
    fetchPayoutSlipArchiveSnapshot({ userId: profile.id, role: profile.role }),
  ]);

  if (!readerSync.error) {
    useLibraryStore.getState().hydrateReaderState(profile.id, readerSync.data);
  }
  if (!authorWorkspaceSync.error) {
    usePublishingStore.getState().hydrateWorkspaceData(authorWorkspaceSync.data);
  }
  if (!royaltyLedgerSync.error) {
    usePublishingStore.getState().hydrateRoyaltyLedger(royaltyLedgerSync.data);
  }
  if (!membershipRoyaltySync.error) {
    usePublishingStore.getState().hydrateMembershipRoyaltyLedger(membershipRoyaltySync.data);
  }
  if (!payoutSlipArchiveSync.error) {
    usePublishingStore.getState().hydratePayoutSlipArchives(payoutSlipArchiveSync.data);
  }

  const syncErrors = [
    ledgerSync.error,
    readerSync.error,
    authorWorkspaceSync.error,
    royaltyLedgerSync.error,
    membershipRoyaltySync.error,
    payoutSlipArchiveSync.error,
  ]
    .filter(Boolean)
    .join(" ");
  return {
    user: {
      ...profile,
      membershipPlan: ledgerSync.membershipPlan,
    },
    ledgerError: syncErrors,
  };
}

async function syncPlatformCommissionSettingsState() {
  try {
    const result = await fetchPlatformCommissionSettings();
    usePublishingStore.getState().hydrateRoyaltyConfig(result.settings);
    return "";
  } catch (error) {
    return error instanceof Error
      ? error.message
      : "Gagal menyinkronkan pengaturan komisi platform.";
  }
}

async function syncPublicWorkspaceState() {
  try {
    const result = await fetchPublicAuthorWorkspaceSnapshot();
    usePublishingStore.getState().hydrateWorkspaceData(result.data);
    return result.error;
  } catch (error) {
    return error instanceof Error ? error.message : "Gagal memuat katalog publik.";
  }
}

type SessionState = {
  user: UserProfile | null;
  authReady: boolean;
  authError: string;
  initializeAuth: () => Promise<void>;
  signInWithPassword: (input: { email: string; password: string }) => Promise<{ error: string }>;
  signUpWithPassword: (input: { name: string; email: string; password: string; role: SelectableRole }) => Promise<{
    error: string;
    requiresEmailConfirmation: boolean;
  }>;
  signInWithGoogle: (input?: { role?: SelectableRole }) => Promise<{ error: string }>;
  logout: () => Promise<void>;
  setUserRole: (role: SelectableRole) => Promise<{ error: string }>;
  updateProfile: (input: {
    name: string;
    phone?: string;
    city?: string;
    website?: string;
    bio?: string;
    avatarUrl?: string;
  }) => Promise<{ error: string }>;
  updateEmail: (input: { email: string }) => Promise<{ error: string; message?: string }>;
  updatePassword: (input: { password: string; confirmPassword: string }) => Promise<{ error: string }>;
  setMembershipPlan: (plan: MembershipPlan, expectedUserId?: string) => Promise<{ error: string }>;
  refreshCurrentUserSession: () => Promise<{ error: string }>;
};

let authInitialized = false;

export const useSessionStore = create<SessionState>()((set, get) => ({
  user: null,
  authReady: false,
  authError: "",

  initializeAuth: async () => {
    if (!isSupabaseConfigured || !supabase) {
      set({
        user: null,
        authReady: true,
        authError: "Konfigurasi Supabase belum diisi. Tambahkan VITE_SUPABASE_URL dan VITE_SUPABASE_ANON_KEY.",
      });
      return;
    }

    if (!authInitialized) {
      authInitialized = true;
      supabase.auth.onAuthStateChange((_event, session) => {
        void (async () => {
          const syncedUser = await syncPendingOAuthRole(session?.user ?? null);
          const profileResult = await getUserProfileWithLedger(syncedUser);
          const publicWorkspaceError = !profileResult?.user ? await syncPublicWorkspaceState() : "";
          const platformCommissionError = await syncPlatformCommissionSettingsState();
          const nextUser = profileResult?.user ?? null;
          set({
            user: nextUser,
            authReady: true,
            authError: [profileResult?.ledgerError, publicWorkspaceError, platformCommissionError]
              .filter(Boolean)
              .join(" "),
          });
        })();
      });
    }

    const { data, error } = await supabase.auth.getSession();
    const syncedUser = await syncPendingOAuthRole(data.session?.user ?? null);
    const profileResult = await getUserProfileWithLedger(syncedUser);
    const publicWorkspaceError = !profileResult?.user ? await syncPublicWorkspaceState() : "";
    const platformCommissionError = await syncPlatformCommissionSettingsState();
    const nextUser = profileResult?.user ?? null;
    set({
      user: nextUser,
      authReady: true,
      authError: error
        ? getReadableSupabaseError(error.message)
        : [profileResult?.ledgerError, publicWorkspaceError, platformCommissionError]
            .filter(Boolean)
            .join(" "),
    });
  },

  signInWithPassword: async ({ email, password }) => {
    if (!supabase) {
      return { error: "Supabase belum dikonfigurasi." };
    }

    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    return { error: error ? getReadableSupabaseError(error.message) : "" };
  },

  signUpWithPassword: async ({ name, email, password, role }) => {
    if (!supabase) {
      return { error: "Supabase belum dikonfigurasi.", requiresEmailConfirmation: false };
    }

    const normalizedRole = normalizeSelectableRole(role);
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        emailRedirectTo: getAppUrl("/login"),
        data: {
          full_name: name.trim(),
          role: normalizedRole satisfies UserRole,
        },
      },
    });

    return {
      error: error ? getReadableSupabaseError(error.message) : "",
      requiresEmailConfirmation: !error && !data.session,
    };
  },

  signInWithGoogle: async (input) => {
    if (!supabase) {
      return { error: "Supabase belum dikonfigurasi." };
    }

    if (input?.role) setPendingSignupRole(normalizeSelectableRole(input.role));
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: getAppUrl("/login"),
        queryParams: {
          prompt: "select_account",
        },
      },
    });

    return { error: error ? getReadableSupabaseError(error.message) : "" };
  },

  logout: async () => {
    if (!supabase) {
      await syncPublicWorkspaceState();
      set({ user: null });
      return;
    }

    await supabase.auth.signOut();
    await syncPublicWorkspaceState();
    set({ user: null });
  },

  setUserRole: async (role) => {
    const currentUser = get().user;
    if (!currentUser) {
      return { error: "Kamu harus login dulu." };
    }
    if (!supabase) {
      return { error: "Supabase belum dikonfigurasi." };
    }
    if (currentUser.role === "ADMIN") {
      return { error: "Role admin dikelola manual dan tidak bisa diubah dari halaman akun." };
    }

    const normalizedRole = normalizeSelectableRole(role);
    const { data: currentUserResult, error: currentUserError } = await supabase.auth.getUser();
    if (currentUserError || !currentUserResult.user) {
      return {
        error: currentUserError
          ? getReadableSupabaseError(currentUserError.message)
          : "Sesi login tidak ditemukan.",
      };
    }

    const { error } = await supabase.auth.updateUser({
      data: {
        ...currentUserResult.user.user_metadata,
        role: normalizedRole,
      },
    });
    if (error) {
      return { error: getReadableSupabaseError(error.message) };
    }

    const refreshResult = await get().refreshCurrentUserSession();
    if (refreshResult.error) {
      return refreshResult;
    }

    return { error: "" };
  },

  updateProfile: async ({ name, phone, city, website, bio, avatarUrl }) => {
    if (!supabase) {
      return { error: "Supabase belum dikonfigurasi." };
    }

    const trimmedName = name.trim();
    if (!trimmedName) {
      return { error: "Nama akun wajib diisi." };
    }

    const { data: currentUserResult, error: currentUserError } = await supabase.auth.getUser();
    if (currentUserError || !currentUserResult.user) {
      return {
        error: currentUserError
          ? getReadableSupabaseError(currentUserError.message)
          : "Sesi login tidak ditemukan.",
      };
    }

    const { data, error } = await supabase.auth.updateUser({
      data: {
        ...currentUserResult.user.user_metadata,
        full_name: trimmedName,
        phone: phone?.trim() || null,
        city: city?.trim() || null,
        website: website?.trim() || null,
        bio: bio?.trim() || null,
        avatar_url:
          avatarUrl === undefined
            ? currentUserResult.user.user_metadata?.avatar_url || null
            : avatarUrl.trim() || null,
      },
    });

    if (error) {
      return { error: getReadableSupabaseError(error.message) };
    }

    const profileResult = await getUserProfileWithLedger(data.user ?? currentUserResult.user);
    const nextUser = profileResult?.user ?? null;
    set({
      user: nextUser,
      authReady: true,
      authError: profileResult?.ledgerError ?? "",
    });

    return { error: "" };
  },

  updateEmail: async ({ email }) => {
    if (!supabase) {
      return { error: "Supabase belum dikonfigurasi." };
    }

    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedEmail) {
      return { error: "Email baru wajib diisi." };
    }
    if (!trimmedEmail.includes("@")) {
      return { error: "Format email baru belum valid." };
    }

    const { error } = await supabase.auth.updateUser({
      email: trimmedEmail,
    });

    if (error) {
      return { error: getReadableSupabaseError(error.message) };
    }

    await get().refreshCurrentUserSession();
    return {
      error: "",
      message: "Permintaan ganti email berhasil dikirim. Cek inbox email lama dan email baru untuk konfirmasi bila diminta.",
    };
  },

  updatePassword: async ({ password, confirmPassword }) => {
    if (!supabase) {
      return { error: "Supabase belum dikonfigurasi." };
    }

    if (password.length < 6) {
      return { error: "Password baru minimal 6 karakter." };
    }
    if (password !== confirmPassword) {
      return { error: "Konfirmasi password tidak cocok." };
    }

    const { error } = await supabase.auth.updateUser({
      password,
    });

    if (error) {
      return { error: getReadableSupabaseError(error.message) };
    }

    return { error: "" };
  },

  setMembershipPlan: async (plan, expectedUserId) => {
    void plan;
    void expectedUserId;
    return {
      error:
        "Perubahan membership plan tidak boleh dilakukan langsung dari client. Gunakan checkout agar paket aktif berasal dari ledger pembayaran.",
    };
  },

  refreshCurrentUserSession: async () => {
    if (!supabase) {
      return { error: "Supabase belum dikonfigurasi." };
    }

    const { data, error } = await supabase.auth.getUser();
    if (error) {
      return { error: getReadableSupabaseError(error.message) };
    }

    const profileResult = await getUserProfileWithLedger(data.user ?? null);
    const platformCommissionError = await syncPlatformCommissionSettingsState();
    const nextUser = profileResult?.user ?? null;
    set({
      user: nextUser,
      authReady: true,
      authError: [profileResult?.ledgerError, platformCommissionError].filter(Boolean).join(" "),
    });

    return {
      error: [profileResult?.ledgerError, platformCommissionError].filter(Boolean).join(" "),
    };
  },
}));
