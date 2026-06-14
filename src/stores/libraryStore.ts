import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Bookmark, Highlight, LibraryItem } from "@/types/domain";
import {
  persistLibraryItem,
  reportReaderSyncError,
  setBookmarkItem,
  setWishlistItem,
  type ReaderSyncSnapshot,
  upsertHighlightItem,
  deleteHighlightItem,
} from "@/lib/readerState";
import { useSessionStore } from "@/stores/sessionStore";

type UserScoped<T> = Record<string, T>;

type LibraryState = {
  libraryByUser: UserScoped<Record<string, LibraryItem>>;
  wishlistByUser: UserScoped<Record<string, true>>;
  bookmarksByUser: UserScoped<Record<string, Bookmark[]>>;
  highlightsByUser: UserScoped<Record<string, Highlight[]>>;
  addToLibrary: (ebookId: string, totalPages: number) => void;
  markOwned: (ebookId: string, totalPages: number) => void;
  markOwnedForUser: (targetUserId: string, ebookId: string, totalPages: number) => void;
  toggleDownloaded: (ebookId: string, totalPages: number) => void;
  updateProgress: (ebookId: string, page: number, totalPages: number) => void;
  toggleWishlist: (ebookId: string) => void;
  toggleBookmark: (ebookId: string, page: number) => void;
  addHighlight: (ebookId: string, page: number, text: string) => void;
  setHighlightNote: (highlightId: string, note: string) => void;
  removeHighlight: (highlightId: string) => void;
  syncOwnedFromLedger: (
    targetUserId: string,
    items: Array<{ ebookId: string; totalPages: number }>
  ) => void;
  hydrateReaderState: (targetUserId: string, snapshot: ReaderSyncSnapshot) => void;
};

function nowIso() {
  return new Date().toISOString();
}

function uid(prefix: string) {
  return `${prefix}_${Math.random().toString(16).slice(2)}_${Date.now().toString(16)}`;
}

function userId() {
  return useSessionStore.getState().user?.id ?? "guest";
}

function createLibraryItem(uidKey: string, ebookId: string, totalPages: number, owned = false): LibraryItem {
  return {
    userId: uidKey,
    ebookId,
    owned,
    downloaded: false,
    lastReadAtISO: nowIso(),
    progress: { currentPage: 1, totalPages },
  };
}

function upsertOwnedLibraryItem(
  state: LibraryState,
  uidKey: string,
  ebookId: string,
  totalPages: number
) {
  const userLib = state.libraryByUser[uidKey] ?? {};
  const current = userLib[ebookId] ?? createLibraryItem(uidKey, ebookId, totalPages);
  return {
    ...state,
    libraryByUser: {
      ...state.libraryByUser,
      [uidKey]: {
        ...userLib,
        [ebookId]: {
          ...current,
          owned: true,
          downloaded: current.downloaded,
          lastReadAtISO: nowIso(),
          progress: current.progress ?? { currentPage: 1, totalPages },
        },
      },
    },
  };
}

export const useLibraryStore = create<LibraryState>()(
  persist(
    (set) => ({
      libraryByUser: {},
      wishlistByUser: {},
      bookmarksByUser: {},
      highlightsByUser: {},

      addToLibrary: (ebookId, totalPages) => {
        let nextItem: LibraryItem | null = null;
        set((state) => {
          const uidKey = userId();
          const userLib = state.libraryByUser[uidKey] ?? {};
          if (userLib[ebookId]) {
            nextItem = userLib[ebookId];
            return state;
          }
          nextItem = createLibraryItem(uidKey, ebookId, totalPages);
          return {
            ...state,
            libraryByUser: {
              ...state.libraryByUser,
              [uidKey]: {
                ...userLib,
                [ebookId]: nextItem,
              },
            },
          };
        });

        if (nextItem) {
          void persistLibraryItem(nextItem).catch((error) => {
            reportReaderSyncError("persist addToLibrary", error);
          });
        }
      },

      markOwned: (ebookId, totalPages) => {
        let nextItem: LibraryItem | null = null;
        set((state) => {
          const uidKey = userId();
          const userLib = state.libraryByUser[uidKey] ?? {};
          const current = userLib[ebookId] ?? createLibraryItem(uidKey, ebookId, totalPages);
          nextItem = {
            ...current,
            owned: true,
            downloaded: current.downloaded,
            lastReadAtISO: nowIso(),
            progress: current.progress ?? { currentPage: 1, totalPages },
          };
          return {
            ...state,
            libraryByUser: {
              ...state.libraryByUser,
              [uidKey]: {
                ...userLib,
                [ebookId]: nextItem,
              },
            },
          };
        });

        if (nextItem) {
          void persistLibraryItem(nextItem).catch((error) => {
            reportReaderSyncError("persist markOwned", error);
          });
        }
      },

      markOwnedForUser: (targetUserId, ebookId, totalPages) => {
        let nextItem: LibraryItem | null = null;
        set((state) => {
          if (!targetUserId.trim()) return state;
          const userLib = state.libraryByUser[targetUserId] ?? {};
          const current = userLib[ebookId] ?? createLibraryItem(targetUserId, ebookId, totalPages);
          nextItem = {
            ...current,
            owned: true,
            downloaded: current.downloaded,
            lastReadAtISO: nowIso(),
            progress: current.progress ?? { currentPage: 1, totalPages },
          };
          return {
            ...state,
            libraryByUser: {
              ...state.libraryByUser,
              [targetUserId]: {
                ...userLib,
                [ebookId]: nextItem,
              },
            },
          };
        });

        if (nextItem && targetUserId === userId()) {
          void persistLibraryItem(nextItem).catch((error) => {
            reportReaderSyncError("persist markOwnedForUser", error);
          });
        }
      },

      toggleDownloaded: (ebookId, totalPages) => {
        set((state) => {
          const uidKey = userId();
          const userLib = state.libraryByUser[uidKey] ?? {};
          const current = userLib[ebookId] ?? createLibraryItem(uidKey, ebookId, totalPages);
          return {
            ...state,
            libraryByUser: {
              ...state.libraryByUser,
              [uidKey]: {
                ...userLib,
                [ebookId]: {
                  ...current,
                  downloaded: !current.downloaded,
                  lastReadAtISO: nowIso(),
                },
              },
            },
          };
        });
      },

      updateProgress: (ebookId, page, totalPages) => {
        let nextItem: LibraryItem | null = null;
        set((state) => {
          const uidKey = userId();
          const userLib = state.libraryByUser[uidKey] ?? {};
          const current = userLib[ebookId] ?? createLibraryItem(uidKey, ebookId, totalPages);
          nextItem = {
            ...current,
            lastReadAtISO: nowIso(),
            progress: { currentPage: page, totalPages },
          };
          return {
            ...state,
            libraryByUser: {
              ...state.libraryByUser,
              [uidKey]: {
                ...userLib,
                [ebookId]: nextItem,
              },
            },
          };
        });

        if (nextItem) {
          void persistLibraryItem(nextItem).catch((error) => {
            reportReaderSyncError("persist updateProgress", error);
          });
        }
      },

      toggleWishlist: (ebookId) => {
        const uidKey = userId();
        let nextActive = false;
        set((state) => {
          const wish = state.wishlistByUser[uidKey] ?? {};
          if (wish[ebookId]) {
            const next = { ...wish };
            delete next[ebookId];
            nextActive = false;
            return {
              ...state,
              wishlistByUser: {
                ...state.wishlistByUser,
                [uidKey]: next,
              },
            };
          }
          nextActive = true;
          return {
            ...state,
            wishlistByUser: {
              ...state.wishlistByUser,
              [uidKey]: { ...wish, [ebookId]: true },
            },
          };
        });

        void setWishlistItem(uidKey, ebookId, nextActive).catch((error) => {
          reportReaderSyncError("persist toggleWishlist", error);
        });
      },

      toggleBookmark: (ebookId, page) => {
        let bookmark: Bookmark | null = null;
        let nextActive = false;
        set((state) => {
          const uidKey = userId();
          const map = state.bookmarksByUser[uidKey] ?? {};
          const current = map[ebookId] ?? [];
          const existing = current.find((b) => b.page === page);
          bookmark = existing ?? {
            id: `bookmark_${uidKey}_${ebookId}_${page}`,
            userId: uidKey,
            ebookId,
            page,
            createdAtISO: nowIso(),
          };
          const nextBookmarks = existing
            ? current.filter((b) => b.page !== page)
            : [
                ...current,
                bookmark,
              ];
          nextActive = !existing;
          return {
            ...state,
            bookmarksByUser: {
              ...state.bookmarksByUser,
              [uidKey]: {
                ...map,
                [ebookId]: nextBookmarks,
              },
            },
          };
        });

        if (bookmark) {
          void setBookmarkItem(bookmark, nextActive).catch((error) => {
            reportReaderSyncError("persist toggleBookmark", error);
          });
        }
      },

      addHighlight: (ebookId, page, text) => {
        let nextHighlight: Highlight | null = null;
        set((state) => {
          const uidKey = userId();
          const map = state.highlightsByUser[uidKey] ?? {};
          const current = map[ebookId] ?? [];
          nextHighlight = {
            id: uid("hl"),
            userId: uidKey,
            ebookId,
            page,
            text,
            createdAtISO: nowIso(),
          };
          return {
            ...state,
            highlightsByUser: {
              ...state.highlightsByUser,
              [uidKey]: {
                ...map,
                [ebookId]: [
                  ...current,
                  nextHighlight,
                ],
              },
            },
          };
        });

        if (nextHighlight) {
          void upsertHighlightItem(nextHighlight).catch((error) => {
            reportReaderSyncError("persist addHighlight", error);
          });
        }
      },

      setHighlightNote: (highlightId, note) => {
        let nextHighlight: Highlight | null = null;
        set((state) => {
          const uidKey = userId();
          const map = state.highlightsByUser[uidKey] ?? {};
          for (const ebookId of Object.keys(map)) {
            const list = map[ebookId] ?? [];
            const idx = list.findIndex((h) => h.id === highlightId);
            if (idx >= 0) {
              const next = [...list];
              next[idx] = { ...next[idx], note };
              nextHighlight = next[idx];
              return {
                ...state,
                highlightsByUser: {
                  ...state.highlightsByUser,
                  [uidKey]: {
                    ...map,
                    [ebookId]: next,
                  },
                },
              };
            }
          }
          return state;
        });

        if (nextHighlight) {
          void upsertHighlightItem(nextHighlight).catch((error) => {
            reportReaderSyncError("persist setHighlightNote", error);
          });
        }
      },

      removeHighlight: (highlightId) => {
        const uidKey = userId();
        set((state) => {
          const map = state.highlightsByUser[uidKey] ?? {};
          for (const ebookId of Object.keys(map)) {
            const list = map[ebookId] ?? [];
            if (list.some((h) => h.id === highlightId)) {
              return {
                ...state,
                highlightsByUser: {
                  ...state.highlightsByUser,
                  [uidKey]: {
                    ...map,
                    [ebookId]: list.filter((h) => h.id !== highlightId),
                  },
                },
              };
            }
          }
          return state;
        });

        void deleteHighlightItem(uidKey, highlightId).catch((error) => {
          reportReaderSyncError("persist removeHighlight", error);
        });
      },

      syncOwnedFromLedger: (targetUserId, items) => {
        set((state) => {
          const uidKey = targetUserId.trim();
          if (!uidKey || !items.length) return state;

          let nextState = state;
          for (const item of items) {
            if (!item.ebookId.trim() || item.totalPages <= 0) continue;
            nextState = upsertOwnedLibraryItem(nextState, uidKey, item.ebookId, item.totalPages);
          }

          return nextState;
        });
      },

      hydrateReaderState: (targetUserId, snapshot) => {
        set((state) => {
          const uidKey = targetUserId.trim();
          if (!uidKey) return state;

          const existingLibrary = state.libraryByUser[uidKey] ?? {};
          const nextLibrary: Record<string, LibraryItem> = {};
          for (const item of snapshot.libraryItems) {
            const localDownloaded = existingLibrary[item.ebookId]?.downloaded ?? false;
            nextLibrary[item.ebookId] = {
              ...item,
              userId: uidKey,
              downloaded: localDownloaded,
            };
          }

          const nextWishlist: Record<string, true> = Object.fromEntries(
            snapshot.wishlistIds.map((ebookId) => [ebookId, true as const])
          );
          const nextBookmarks = snapshot.bookmarks.reduce<Record<string, Bookmark[]>>((acc, bookmark) => {
            const ebookId = bookmark.ebookId;
            acc[ebookId] = [...(acc[ebookId] ?? []), { ...bookmark, userId: uidKey }];
            return acc;
          }, {});
          const nextHighlights = snapshot.highlights.reduce<Record<string, Highlight[]>>((acc, highlight) => {
            const ebookId = highlight.ebookId;
            acc[ebookId] = [...(acc[ebookId] ?? []), { ...highlight, userId: uidKey }];
            return acc;
          }, {});

          return {
            ...state,
            libraryByUser: {
              ...state.libraryByUser,
              [uidKey]: nextLibrary,
            },
            wishlistByUser: {
              ...state.wishlistByUser,
              [uidKey]: nextWishlist,
            },
            bookmarksByUser: {
              ...state.bookmarksByUser,
              [uidKey]: nextBookmarks,
            },
            highlightsByUser: {
              ...state.highlightsByUser,
              [uidKey]: nextHighlights,
            },
          };
        });
      },
    }),
    { name: "naraloka_library_v1" }
  )
);

export function selectUserLibrary(ebookId: string) {
  const uidKey = userId();
  return (useLibraryStore.getState().libraryByUser[uidKey] ?? {})[ebookId] ?? null;
}
