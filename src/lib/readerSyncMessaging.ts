export function getReaderSyncNotice(params: {
  isGuestSession: boolean;
  downloadActive: boolean;
  usingSourceDocumentReader: boolean;
}) {
  const { isGuestSession, downloadActive, usingSourceDocumentReader } = params;

  if (usingSourceDocumentReader) {
    return "Dokumen sumber asli dibuka langsung dari file penulis. Bookmark halaman, highlight teks, dan mode offline teks tidak dipakai di mode ini.";
  }

  if (isGuestSession) {
    return "Progress preview tamu hanya tersimpan di sesi browser ini. Masuk untuk sinkronisasi progres, bookmark, dan highlight lintas perangkat.";
  }

  if (downloadActive) {
    return "Status offline tersimpan lokal di perangkat ini. Progress, bookmark, dan highlight tetap sinkron ke akun, tetapi file offline tidak otomatis muncul di perangkat lain.";
  }

  return "Progress, bookmark, dan highlight sinkron ke akun setelah login. Mode offline tetap disimpan lokal per perangkat.";
}

export function getOfflineActionMessage(params: {
  isGuestSession: boolean;
  fullAccess: boolean;
  downloadActive: boolean;
}) {
  const { isGuestSession, fullAccess, downloadActive } = params;

  if (isGuestSession) {
    return "Masuk dulu untuk menyimpan status offline ke perpustakaan perangkat ini.";
  }

  if (downloadActive) {
    return "Status offline dihapus dari perangkat ini. Akses akun dan progres bacaan tetap aman.";
  }

  return fullAccess
    ? "File e-book berhasil diunduh untuk akses offline di perangkat ini."
    : "Preview e-book berhasil diunduh ke perangkat ini. Upgrade untuk file penuh.";
}
