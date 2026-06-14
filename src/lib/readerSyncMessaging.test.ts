import { describe, expect, it } from "vitest";
import { getOfflineActionMessage, getReaderSyncNotice } from "./readerSyncMessaging";

describe("readerSyncMessaging", () => {
  it("menjelaskan sinkronisasi tamu dengan jelas", () => {
    expect(
      getReaderSyncNotice({
        isGuestSession: true,
        downloadActive: false,
        usingSourceDocumentReader: false,
      })
    ).toContain("preview tamu");
  });

  it("menjelaskan offline sebagai status lokal perangkat", () => {
    expect(
      getReaderSyncNotice({
        isGuestSession: false,
        downloadActive: true,
        usingSourceDocumentReader: false,
      })
    ).toContain("lokal di perangkat ini");
  });

  it("menjelaskan pesan unduh offline penuh", () => {
    expect(
      getOfflineActionMessage({
        isGuestSession: false,
        fullAccess: true,
        downloadActive: false,
      })
    ).toContain("perangkat ini");
  });
});
