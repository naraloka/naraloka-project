import type { Bookmark, Highlight, LibraryItem } from "@/types/domain";
import { getReadableSupabaseError, getSupabaseAccessToken, supabase } from "@/lib/supabase";

export type UserLibraryRow = {
  user_id: string;
  ebook_id: string;
  owned: boolean | null;
  current_page: number | null;
  total_pages: number | null;
  last_read_at: string | null;
};

export type UserWishlistRow = {
  user_id: string;
  ebook_id: string;
};

export type UserBookmarkRow = {
  user_id: string;
  ebook_id: string;
  page: number;
  created_at: string | null;
};

export type UserHighlightRow = {
  id: string;
  user_id: string;
  ebook_id: string;
  page: number;
  text: string;
  note: string | null;
  created_at: string | null;
};

export type ReaderSyncSnapshot = {
  libraryItems: LibraryItem[];
  wishlistIds: string[];
  bookmarks: Bookmark[];
  highlights: Highlight[];
};

function emptySnapshot(): ReaderSyncSnapshot {
  return {
    libraryItems: [],
    wishlistIds: [],
    bookmarks: [],
    highlights: [],
  };
}

function nowIso() {
  return new Date().toISOString();
}

function canSyncReaderState(userId: string) {
  return Boolean(supabase && userId.trim() && userId !== "guest");
}

function logReaderSyncError(action: string, error: unknown) {
  const message = error instanceof Error ? error.message : String(error || "unknown error");
  console.error(`[reader-sync] ${action}: ${message}`);
}

async function syncMembershipRoyaltyPoolForUser(userId: string) {
  if (!canSyncReaderState(userId)) return;
  const accessToken = await getSupabaseAccessToken();
  if (!accessToken) {
    throw new Error("Sesi login tidak ditemukan untuk sinkronisasi membership royalty.");
  }

  const response = await fetch("/api/royalty/membership-sync", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify({ userId }),
  });

  if (!response.ok) {
    const data = (await response.json().catch(() => null)) as { message?: string } | null;
    throw new Error(data?.message || "Gagal menyinkronkan membership royalty pool.");
  }
}

export async function fetchReaderStateForUser(userId: string) {
  if (!canSyncReaderState(userId)) {
    return { error: "", data: emptySnapshot() };
  }

  const [libraryResult, wishlistResult, bookmarkResult, highlightResult] = await Promise.all([
    supabase!
      .from("user_library_state")
      .select("user_id,ebook_id,owned,current_page,total_pages,last_read_at")
      .eq("user_id", userId),
    supabase!.from("user_wishlist").select("user_id,ebook_id").eq("user_id", userId),
    supabase!
      .from("user_bookmarks")
      .select("user_id,ebook_id,page,created_at")
      .eq("user_id", userId),
    supabase!
      .from("user_highlights")
      .select("id,user_id,ebook_id,page,text,note,created_at")
      .eq("user_id", userId),
  ]);

  const firstError =
    libraryResult.error || wishlistResult.error || bookmarkResult.error || highlightResult.error;

  if (firstError) {
    return {
      error: getReadableSupabaseError(firstError.message),
      data: emptySnapshot(),
    };
  }

  const libraryItems = ((libraryResult.data ?? []) as UserLibraryRow[]).map((row) =>
    mapLibraryRowToLibraryItem(row, userId)
  );

  const wishlistIds = ((wishlistResult.data ?? []) as UserWishlistRow[]).map((row) => row.ebook_id);

  const bookmarks = ((bookmarkResult.data ?? []) as UserBookmarkRow[]).map(mapBookmarkRowToBookmark);

  const highlights = ((highlightResult.data ?? []) as UserHighlightRow[]).map(
    mapHighlightRowToHighlight
  );

  return {
    error: "",
    data: {
      libraryItems,
      wishlistIds,
      bookmarks,
      highlights,
    },
  };
}

export function mapLibraryRowToLibraryItem(
  row: UserLibraryRow,
  fallbackUserId = row.user_id
): LibraryItem {
  return {
    userId: fallbackUserId,
    ebookId: row.ebook_id,
    owned: Boolean(row.owned),
    downloaded: false,
    lastReadAtISO: row.last_read_at || nowIso(),
    progress: {
      currentPage: Math.max(1, Number(row.current_page || 1)),
      totalPages: Math.max(1, Number(row.total_pages || 1)),
    },
  };
}

export function mapBookmarkRowToBookmark(row: UserBookmarkRow): Bookmark {
  return {
    id: `bookmark_${row.user_id}_${row.ebook_id}_${row.page}`,
    userId: row.user_id,
    ebookId: row.ebook_id,
    page: row.page,
    createdAtISO: row.created_at || nowIso(),
  };
}

export function mapHighlightRowToHighlight(row: UserHighlightRow): Highlight {
  return {
    id: row.id,
    userId: row.user_id,
    ebookId: row.ebook_id,
    page: row.page,
    text: row.text,
    note: row.note || undefined,
    createdAtISO: row.created_at || nowIso(),
  };
}

export async function persistLibraryItem(item: LibraryItem) {
  if (!canSyncReaderState(item.userId)) return;

  const { error } = await supabase!.from("user_library_state").upsert(
    {
      user_id: item.userId,
      ebook_id: item.ebookId,
      owned: item.owned,
      current_page: item.progress.currentPage,
      total_pages: item.progress.totalPages,
      last_read_at: item.lastReadAtISO || nowIso(),
    },
    { onConflict: "user_id,ebook_id", ignoreDuplicates: false }
  );

  if (error) throw error;

  if (item.progress.currentPage > 1) {
    await syncMembershipRoyaltyPoolForUser(item.userId);
  }
}

export async function setWishlistItem(userId: string, ebookId: string, active: boolean) {
  if (!canSyncReaderState(userId) || !ebookId.trim()) return;

  if (!active) {
    const { error } = await supabase!
      .from("user_wishlist")
      .delete()
      .eq("user_id", userId)
      .eq("ebook_id", ebookId);

    if (error) throw error;
    return;
  }

  const { error } = await supabase!.from("user_wishlist").upsert(
    {
      user_id: userId,
      ebook_id: ebookId,
    },
    { onConflict: "user_id,ebook_id", ignoreDuplicates: false }
  );

  if (error) throw error;
}

export async function setBookmarkItem(bookmark: Bookmark, active: boolean) {
  if (!canSyncReaderState(bookmark.userId) || !bookmark.ebookId.trim()) return;

  if (!active) {
    const { error } = await supabase!
      .from("user_bookmarks")
      .delete()
      .eq("user_id", bookmark.userId)
      .eq("ebook_id", bookmark.ebookId)
      .eq("page", bookmark.page);

    if (error) throw error;
    return;
  }

  const { error } = await supabase!.from("user_bookmarks").upsert(
    {
      user_id: bookmark.userId,
      ebook_id: bookmark.ebookId,
      page: bookmark.page,
      created_at: bookmark.createdAtISO || nowIso(),
    },
    { onConflict: "user_id,ebook_id,page", ignoreDuplicates: false }
  );

  if (error) throw error;
}

export async function upsertHighlightItem(highlight: Highlight) {
  if (!canSyncReaderState(highlight.userId) || !highlight.ebookId.trim()) return;

  const { error } = await supabase!.from("user_highlights").upsert(
    {
      id: highlight.id,
      user_id: highlight.userId,
      ebook_id: highlight.ebookId,
      page: highlight.page,
      text: highlight.text,
      note: highlight.note ?? null,
      created_at: highlight.createdAtISO || nowIso(),
    },
    { onConflict: "id", ignoreDuplicates: false }
  );

  if (error) throw error;
}

export async function deleteHighlightItem(userId: string, highlightId: string) {
  if (!canSyncReaderState(userId) || !highlightId.trim()) return;

  const { error } = await supabase!
    .from("user_highlights")
    .delete()
    .eq("user_id", userId)
    .eq("id", highlightId);

  if (error) throw error;
}

export function reportReaderSyncError(action: string, error: unknown) {
  logReaderSyncError(action, error);
}
