import { createClient } from "@supabase/supabase-js";
import type { User } from "@supabase/supabase-js";
import type { MembershipPlan, UserProfile, UserRole } from "@/types/domain";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl!, supabaseAnonKey!, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null;

function parseMembershipPlan(value: unknown): MembershipPlan {
  if (value === "PREMIUM" || value === "EDU") return value;
  return "FREE";
}

export function parseUserRole(value: unknown): UserRole | null {
  if (value === "READER" || value === "AUTHOR" || value === "ADMIN") return value;
  return null;
}

function parseSelectableUserRole(value: unknown): Extract<UserRole, "READER" | "AUTHOR"> | null {
  if (value === "READER" || value === "AUTHOR") return value;
  return null;
}

function readStringMetadata(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : undefined;
}

export function getTrustedSupabaseUserRole(user: User): UserRole {
  const appRole = parseUserRole(user.app_metadata?.role);
  if (appRole === "ADMIN") {
    return "ADMIN";
  }
  return appRole ?? parseSelectableUserRole(user.user_metadata?.role) ?? "READER";
}

export function getTrustedSupabaseMembershipPlan(user: User): MembershipPlan {
  return parseMembershipPlan(user.app_metadata?.membership_plan);
}

export function getSupabaseUserProfile(user: User): UserProfile {
  const fullName =
    typeof user.user_metadata?.full_name === "string" && user.user_metadata.full_name.trim()
      ? user.user_metadata.full_name.trim()
      : user.email?.split("@")[0] || "Pengguna";

  return {
    id: user.id,
    name: fullName,
    email: user.email ?? "",
    role: getTrustedSupabaseUserRole(user),
    membershipPlan: getTrustedSupabaseMembershipPlan(user),
    avatarUrl: readStringMetadata(user.user_metadata?.avatar_url),
    phone: readStringMetadata(user.user_metadata?.phone),
    city: readStringMetadata(user.user_metadata?.city),
    website: readStringMetadata(user.user_metadata?.website),
    bio: readStringMetadata(user.user_metadata?.bio),
  };
}

export async function getSupabaseAccessToken() {
  if (!supabase) return "";
  const { data } = await supabase.auth.getSession();
  return data.session?.access_token || "";
}

export function getReadableSupabaseError(message: string) {
  if (!message) return "Terjadi kesalahan autentikasi.";
  if (message.toLowerCase().includes("invalid login credentials")) {
    return "Email atau password salah.";
  }
  if (message.toLowerCase().includes("email not confirmed")) {
    return "Email belum dikonfirmasi. Cek inbox email kamu.";
  }
  if (message.toLowerCase().includes("user already registered")) {
    return "Email sudah terdaftar. Silakan masuk.";
  }
  return message;
}
