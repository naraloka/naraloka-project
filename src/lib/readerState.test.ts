import { describe, expect, it } from "vitest";
import {
  mapBookmarkRowToBookmark,
  mapHighlightRowToHighlight,
  mapLibraryRowToLibraryItem,
} from "./readerState";

describe("reader state helpers", () => {
  it("memetakan row progress baca menjadi item perpustakaan", () => {
    const item = mapLibraryRowToLibraryItem({
      user_id: "user-1",
      ebook_id: "ebook-1",
      owned: true,
      current_page: 8,
      total_pages: 120,
      last_read_at: "2026-06-11T10:00:00.000Z",
    });

    expect(item.userId).toBe("user-1");
    expect(item.ebookId).toBe("ebook-1");
    expect(item.owned).toBe(true);
    expect(item.progress.currentPage).toBe(8);
  });

  it("memetakan row bookmark menjadi bookmark domain", () => {
    const bookmark = mapBookmarkRowToBookmark({
      user_id: "user-1",
      ebook_id: "ebook-1",
      page: 12,
      created_at: "2026-06-11T10:00:00.000Z",
    });

    expect(bookmark.id).toBe("bookmark_user-1_ebook-1_12");
    expect(bookmark.page).toBe(12);
  });

  it("memetakan row highlight menjadi highlight domain", () => {
    const highlight = mapHighlightRowToHighlight({
      id: "hl-1",
      user_id: "user-1",
      ebook_id: "ebook-1",
      page: 5,
      text: "Kutipan penting",
      note: "Catatan pribadi",
      created_at: "2026-06-11T10:00:00.000Z",
    });

    expect(highlight.id).toBe("hl-1");
    expect(highlight.note).toBe("Catatan pribadi");
    expect(highlight.text).toBe("Kutipan penting");
  });
});
