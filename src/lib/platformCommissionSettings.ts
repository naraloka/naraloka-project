import { getSupabaseAccessToken } from "@/lib/supabase";
import type { RoyaltyConfig } from "@/stores/publishingStore";

type PlatformCommissionSettingsResponse = {
  settings: RoyaltyConfig;
};

type PlatformCommissionSaveResponse = {
  message: string;
  settings: RoyaltyConfig;
};

async function parseResponse<T extends object>(response: Response, fallbackMessage: string) {
  const payload = (await response.json().catch(() => ({}))) as T | { message?: string };
  if (!response.ok) {
    throw new Error(
      "message" in payload && typeof payload.message === "string"
        ? payload.message
        : fallbackMessage
    );
  }
  return payload as T;
}

export async function fetchPlatformCommissionSettings() {
  const response = await fetch("/api/platform-commission-settings", {
    method: "GET",
  });

  return parseResponse<PlatformCommissionSettingsResponse>(
    response,
    "Gagal mengambil pengaturan komisi platform."
  );
}

export async function savePlatformCommissionSettings(settings: RoyaltyConfig) {
  const accessToken = await getSupabaseAccessToken();
  if (!accessToken) {
    throw new Error("Sesi admin tidak ditemukan. Silakan login ulang.");
  }

  const response = await fetch("/api/platform-commission-settings", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ settings }),
  });

  return parseResponse<PlatformCommissionSaveResponse>(
    response,
    "Gagal menyimpan pengaturan komisi platform."
  );
}
