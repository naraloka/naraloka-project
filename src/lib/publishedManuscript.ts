import type { Ebook } from "@/types/domain";
import type { Manuscript } from "@/stores/publishingStore";

function cleanLine(value: string | undefined) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .trim();
}

function splitTextIntoChunks(text: string, sentenceLimit = 3) {
  const normalized = cleanLine(text);
  if (!normalized) return [];

  const sentences = normalized
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean);

  if (!sentences.length) return [normalized];

  const chunks: string[] = [];
  for (let index = 0; index < sentences.length; index += sentenceLimit) {
    chunks.push(sentences.slice(index, index + sentenceLimit).join(" "));
  }
  return chunks;
}

function buildManuscriptSections(manuscript: Manuscript, authorDisplayName?: string) {
  const title = cleanLine(manuscript.title) || "Karya Naraloka";
  const synopsis = cleanLine(manuscript.synopsis);
  const targetAudience = cleanLine(manuscript.targetAudience);
  const tags = (manuscript.tags ?? []).map((tag) => cleanLine(tag)).filter(Boolean);
  const authorName = cleanLine(authorDisplayName || manuscript.authorDisplayName) || "Penulis Naraloka";
  const monetizationNote = cleanLine(manuscript.monetizationNote);
  const adminNote = cleanLine(manuscript.adminNote);

  const sections: Array<{ heading: string; body: string }> = [];

  const synopsisChunks = splitTextIntoChunks(
    synopsis ||
      `${title} merupakan karya ${manuscript.category.toLowerCase()} yang dipublikasikan melalui portal penulis Naraloka.`
  );
  synopsisChunks.forEach((chunk, index) => {
    sections.push({
      heading: index === 0 ? "Tentang Karya Ini" : `Sinopsis Lanjutan ${index + 1}`,
      body: chunk,
    });
  });

  if (targetAudience) {
    splitTextIntoChunks(targetAudience, 2).forEach((chunk, index) => {
      sections.push({
        heading: index === 0 ? "Untuk Pembaca" : `Fokus Pembaca ${index + 1}`,
        body: chunk,
      });
    });
  }

  if (tags.length) {
    sections.push({
      heading: "Tema Utama",
      body: `Kata kunci utama karya ini: ${tags.join(", ")}.`,
    });
  }

  sections.push({
    heading: "Profil Karya",
    body: `${title} berada pada kategori ${manuscript.category} dan ditulis oleh ${authorName}. Edisi digital ini mengikuti metadata naskah yang dikirim melalui portal penulis Naraloka.`,
  });

  if (monetizationNote) {
    sections.push({
      heading: "Catatan Publikasi",
      body: monetizationNote,
    });
  }

  if (adminNote) {
    sections.push({
      heading: "Catatan Editorial",
      body: adminNote,
    });
  }

  sections.push({
    heading: "Dokumen Sumber",
    body:
      manuscript.storageMimeType === "application/pdf"
        ? "Reader dapat menampilkan file PDF asli bila akses buku sudah aktif."
        : manuscript.storageMimeType
          ? `Dokumen sumber tersedia dalam format ${manuscript.storageMimeType} dan dapat dibuka atau diunduh dari reader setelah akses aktif.`
          : "Dokumen sumber karya ini tersimpan bersama metadata publikasi dan dapat diakses sesuai hak baca.",
  });

  return sections.length
    ? sections
    : [
        {
          heading: "Tentang Karya Ini",
          body: "Naskah ini telah dipublikasikan dari portal penulis Naraloka dan siap dibaca sesuai akses yang tersedia.",
        },
      ];
}

export function estimatePublishedManuscriptPageCount(manuscript: Manuscript) {
  return Math.max(12, Math.min(240, Math.round((manuscript.wordCount ?? 7200) / 300)));
}

export function buildPublishedManuscriptPages(params: {
  manuscript: Manuscript;
  authorDisplayName?: string;
  pageCount?: number;
}) {
  const pageCount = Math.max(1, params.pageCount ?? estimatePublishedManuscriptPageCount(params.manuscript));
  const title = cleanLine(params.manuscript.title) || "Karya Naraloka";
  const sections = buildManuscriptSections(params.manuscript, params.authorDisplayName);

  const pages = Array.from({ length: pageCount }, (_, index) => {
    const pageNumber = index + 1;
    const section = sections[index % sections.length];
    const footer =
      pageNumber <= 3
        ? "Bagian ini disusun dari metadata naskah agar pembaca mendapat gambaran isi sebelum membuka dokumen sumber."
        : "Buka dokumen sumber dari reader untuk membaca naskah asli sesuai format file yang diunggah penulis.";

    return [
      title,
      `Halaman ${pageNumber} dari ${pageCount}`,
      section.heading,
      section.body,
      footer,
    ].join("\n\n");
  });

  return {
    pageCount,
    previewPages: pages.slice(0, Math.min(3, pages.length)),
    pages,
  };
}

export function hasOriginalPublishedSource(ebook: Pick<Ebook, "sourceStoragePath"> | null | undefined) {
  return Boolean(ebook?.sourceStoragePath);
}
