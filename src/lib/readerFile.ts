import { getSupabaseAccessToken } from "@/lib/supabase";

type ReaderFileUrlResponse = {
  ebookId: string;
  title: string;
  fileName: string;
  mimeType: string;
  signedUrl: string;
};

export async function fetchPublishedReaderFileUrl(ebookId: string) {
  const trimmedEbookId = ebookId.trim();
  if (!trimmedEbookId) {
    throw new Error("ID e-book tidak valid.");
  }

  const accessToken = await getSupabaseAccessToken();
  const response = await fetch(`/api/reader/file-url?ebookId=${encodeURIComponent(trimmedEbookId)}`, {
    method: "GET",
    headers: accessToken
      ? {
          Authorization: `Bearer ${accessToken}`,
        }
      : undefined,
  });

  const payload = (await response.json().catch(() => ({}))) as
    | ReaderFileUrlResponse
    | { message?: string };

  if (!response.ok) {
    throw new Error(
      "message" in payload && typeof payload.message === "string"
        ? payload.message
        : "Gagal mengambil file e-book."
    );
  }

  return payload as ReaderFileUrlResponse;
}
