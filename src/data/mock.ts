import type {
  Article,
  AuthorProfile,
  BookCategory,
  Ebook,
  Review,
  Testimonial,
} from "@/types/domain";
import { t2i } from "@/utils/image";

function makePages(seedTitle: string, pageCount: number) {
  const pages: string[] = [];
  for (let i = 1; i <= pageCount; i += 1) {
    pages.push(
      `${seedTitle}\n\nHalaman ${i}\n\n` +
        "Di atas kertas yang terasa hangat, kata-kata bergerak pelan—mengajakmu menunda dunia sejenak. " +
        "Bacaan ini dibuat untuk prototipe Naraloka: teks contoh yang memprioritaskan keterbacaan, spasi, dan ritme paragraf.\n\n" +
        "Tarik napas. Lanjutkan membaca saat siap."
    );
  }
  return pages;
}

export const categories: BookCategory[] = [
  "Novel",
  "Edukasi",
  "Motivasi",
  "Cerpen",
  "Komik Digital",
];

export const authors: AuthorProfile[] = [
  {
    id: "a-nara",
    displayName: "Nara Widya",
    bio: "Menulis novel realis dengan fokus pada karakter, kota, dan memori yang tumbuh perlahan.",
    avatarUrl: t2i(
      "Portrait photo of an Indonesian female author, soft natural light, clean background, editorial style, ultra realistic, high detail",
      "square"
    ),
    followerCount: 28450,
  },
  {
    id: "a-bima",
    displayName: "Bima Arkatama",
    bio: "Penulis nonfiksi edukasi yang menyukai penjelasan ringkas, ilustrasi konsep, dan contoh nyata.",
    avatarUrl: t2i(
      "Portrait photo of an Indonesian male author, modern minimal studio lighting, clean background, ultra realistic, high detail",
      "square"
    ),
    followerCount: 17320,
  },
  {
    id: "a-senja",
    displayName: "Senja Aksara",
    bio: "Cerpenis yang menulis kisah-kisah pendek: sunyi, lucu, dan sering berakhir dengan twist lembut.",
    avatarUrl: t2i(
      "Portrait photo of an Indonesian young adult writer, soft warm light, minimal background, ultra realistic",
      "square"
    ),
    followerCount: 21910,
  },
  {
    id: "a-raka",
    displayName: "Raka Pustaka",
    bio: "Komikus digital dengan gaya garis tegas, komedi observasi, dan panel yang rapi.",
    avatarUrl: t2i(
      "Portrait photo of an Indonesian comic artist, crisp lighting, clean background, ultra realistic",
      "square"
    ),
    followerCount: 33280,
  },
];

export const ebooks: Ebook[] = [
  {
    id: "eb-senja-kota",
    title: "Senja di Balik Kota Hujan",
    authorId: "a-nara",
    coverUrl: t2i(
      "Book cover, rainy Indonesian city at dusk, warm street lights, reflective streets, literary novel cover, elegant typography space, realistic illustration",
      "portrait_16_9"
    ),
    category: "Novel",
    description:
      "Novel tentang pertemuan kembali, kota yang berubah, dan keberanian menata hidup dari awal.",
    ratingAvg: 4.8,
    ratingCount: 284,
    priceCents: 0,
    access: "OPEN",
    isBestSeller: true,
    isFeatured: true,
    publishedAtISO: "2026-05-12T07:00:00.000Z",
    pageCount: 42,
    tags: ["Novel", "Romansa", "Kota"],
    previewPages: makePages("Senja di Balik Kota Hujan", 3),
    pages: makePages("Senja di Balik Kota Hujan", 42),
  },
  {
    id: "eb-belajar-fokus",
    title: "Belajar Fokus 30 Menit Sehari",
    authorId: "a-bima",
    coverUrl: t2i(
      "Book cover, minimalist desk setup, notebook, pen, warm morning light, self improvement education book cover, clean modern layout",
      "portrait_16_9"
    ),
    category: "Edukasi",
    description:
      "Panduan praktis membangun sesi belajar singkat yang konsisten tanpa terasa berat.",
    ratingAvg: 4.7,
    ratingCount: 198,
    priceCents: 0,
    access: "MEMBERSHIP",
    requiredPlan: "EDU",
    isBestSeller: true,
    isFeatured: false,
    publishedAtISO: "2026-04-25T07:00:00.000Z",
    pageCount: 36,
    tags: ["Edukasi", "Produktivitas", "Belajar"],
    previewPages: makePages("Belajar Fokus 30 Menit Sehari", 3),
    pages: makePages("Belajar Fokus 30 Menit Sehari", 36),
  },
  {
    id: "eb-lemari-kenangan",
    title: "Lemari Kenangan Pukul Lima",
    authorId: "a-senja",
    coverUrl: t2i(
      "Book cover, nostalgic short story collection, old wooden cabinet, sunset window light, poetic atmosphere, realistic illustration, premium editorial feel",
      "portrait_16_9"
    ),
    category: "Cerpen",
    description:
      "Kumpulan cerpen pendek yang lembut, ganjil, dan dekat dengan kehidupan sehari-hari.",
    ratingAvg: 4.6,
    ratingCount: 126,
    priceCents: 3900000,
    access: "PAID",
    isBestSeller: false,
    isFeatured: true,
    publishedAtISO: "2026-05-02T07:00:00.000Z",
    pageCount: 28,
    tags: ["Cerpen", "Slice of Life", "Reflektif"],
    previewPages: makePages("Lemari Kenangan Pukul Lima", 3),
    pages: makePages("Lemari Kenangan Pukul Lima", 28),
  },
  {
    id: "eb-atlas-kebiasaan",
    title: "Atlas Kebiasaan Kecil",
    authorId: "a-bima",
    coverUrl: t2i(
      "Book cover, habit tracker concept, geometric icons, clean educational design, cream and navy palette, realistic printed book cover",
      "portrait_16_9"
    ),
    category: "Motivasi",
    description:
      "Membahas cara membangun kebiasaan yang realistis, bertahan lama, dan mudah diukur.",
    ratingAvg: 4.9,
    ratingCount: 341,
    priceCents: 0,
    access: "MEMBERSHIP",
    requiredPlan: "PREMIUM",
    isBestSeller: true,
    isFeatured: true,
    publishedAtISO: "2026-03-18T07:00:00.000Z",
    pageCount: 54,
    tags: ["Motivasi", "Habit", "Produktivitas"],
    previewPages: makePages("Atlas Kebiasaan Kecil", 3),
    pages: makePages("Atlas Kebiasaan Kecil", 54),
  },
  {
    id: "eb-komik-jeda",
    title: "Komik Jeda Sebelum Pulang",
    authorId: "a-raka",
    coverUrl: t2i(
      "Book cover, digital comic style, urban commuter scene, playful expressive characters, vibrant yet clean composition, Indonesian comic cover",
      "portrait_16_9"
    ),
    category: "Komik Digital",
    description:
      "Komik digital ringan tentang perjalanan pulang, humor kecil, dan wajah-wajah kota yang akrab.",
    ratingAvg: 4.5,
    ratingCount: 172,
    priceCents: 0,
    access: "OPEN",
    isBestSeller: false,
    isFeatured: false,
    publishedAtISO: "2026-05-30T07:00:00.000Z",
    pageCount: 24,
    tags: ["Komik", "Humor", "Kota"],
    previewPages: makePages("Komik Jeda Sebelum Pulang", 3),
    pages: makePages("Komik Jeda Sebelum Pulang", 24),
  },
  {
    id: "eb-strategi-catatan",
    title: "Strategi Catatan untuk Pembelajar Mandiri",
    authorId: "a-bima",
    coverUrl: t2i(
      "Book cover, open notebook with highlighted notes, structured study guide feel, modern educational non-fiction cover, realistic detail",
      "portrait_16_9"
    ),
    category: "Edukasi",
    description:
      "Panduan membuat catatan belajar yang ringkas, terstruktur, dan mudah dipakai ulang.",
    ratingAvg: 4.8,
    ratingCount: 215,
    priceCents: 0,
    access: "MEMBERSHIP",
    requiredPlan: "EDU",
    isBestSeller: true,
    isFeatured: false,
    publishedAtISO: "2026-06-01T07:00:00.000Z",
    pageCount: 40,
    tags: ["Edukasi", "Catatan", "Belajar"],
    previewPages: makePages("Strategi Catatan untuk Pembelajar Mandiri", 3),
    pages: makePages("Strategi Catatan untuk Pembelajar Mandiri", 40),
  },
];

export const reviews: Review[] = [];

export const testimonials: Testimonial[] = [];

export const articles: Article[] = [
  {
    id: "ar1",
    title: "Cara Memilih Bacaan yang Cocok untuk Mood Hari Ini",
    excerpt:
      "Mood sering menentukan gaya baca. Coba mulai dari durasi, tema, dan energi tulisan.",
    publishedAtISO: "2026-06-07T07:00:00.000Z",
    tags: ["Rekomendasi", "Tips Membaca"],
    content: [
      "Tidak semua hari cocok untuk bacaan yang sama. Ada hari saat kamu ingin cerita yang pelan, ada juga momen ketika kamu butuh tulisan yang cepat, ringan, dan selesai dalam satu duduk.",
      "Mulailah dari durasi membaca yang kamu punya. Jika hanya ada 10 sampai 15 menit, pilih artikel pendek, cerpen, atau bab yang ringkas. Jika punya waktu lebih panjang, novel atau bacaan edukasi yang bertahap akan terasa lebih pas.",
      "Perhatikan juga energi tulisan. Saat pikiran sedang penuh, bacaan dengan bahasa sederhana dan ritme tenang biasanya lebih mudah dinikmati. Saat sedang bersemangat, kamu bisa mencoba tema yang lebih padat atau menantang.",
      "Naraloka menempatkan rekomendasi sebagai pintu masuk, bukan keharusan. Pilih bacaan yang terasa dekat dengan keadaanmu hari ini, lalu simpan yang menarik untuk nanti lewat wishlist atau perpustakaan.",
    ],
  },
  {
    id: "ar2",
    title: "Mengenal Highlight & Catatan: Membaca yang Tidak Mudah Lupa",
    excerpt:
      "Highlight yang baik itu ringkas. Catatan yang baik itu menyambungkan ide ke pengalamanmu.",
    publishedAtISO: "2026-06-04T07:00:00.000Z",
    tags: ["Edukasi", "Produktivitas"],
    content: [
      "Highlight sebaiknya dipakai untuk menandai inti gagasan, bukan memblok hampir seluruh halaman. Semakin singkat bagian yang kamu tandai, semakin mudah kamu kembali pada ide utamanya.",
      "Setelah memberi highlight, tambahkan satu atau dua kalimat catatan dengan bahasamu sendiri. Langkah kecil ini membantu otak memproses bacaan sebagai pemahaman, bukan sekadar kutipan yang lewat.",
      "Catatan paling berguna biasanya menjawab satu pertanyaan sederhana: kenapa bagian ini penting buatku? Saat kamu menulis alasan pribadi, isi buku lebih mudah tersambung ke pengalamanmu.",
      "Di reader Naraloka, highlight dan catatan dirancang untuk membantu pembaca membangun ritme belajar yang konsisten. Fokusnya bukan banyaknya tanda, melainkan kualitas pengingat yang kamu simpan.",
    ],
  },
  {
    id: "ar3",
    title: "Kenapa Membership Edukasi Cocok untuk Belajar Mandiri",
    excerpt:
      "Akses bacaan yang tepat, ritme belajar yang fleksibel, dan progress yang terasa.",
    publishedAtISO: "2026-05-29T07:00:00.000Z",
    tags: ["Membership", "Edukasi"],
    content: [
      "Belajar mandiri sering gagal bukan karena materi kurang bagus, tetapi karena ritmenya tidak terasa. Membership Edukasi diarahkan untuk memberi struktur yang cukup tanpa membuat proses belajar terasa berat.",
      "Dengan konten yang lebih terfokus, pembaca bisa bergerak dari satu topik ke topik lain secara lebih jelas. Catatan, highlight, dan progres membantu menjaga konteks agar tidak mudah hilang di tengah jalan.",
      "Fleksibilitas juga penting. Tidak semua orang belajar dalam blok waktu panjang. Karena itu, pengalaman membaca dirancang agar tetap nyaman untuk sesi pendek namun tetap terasa berlanjut ketika dibuka lagi.",
      "Jika tujuanmu adalah belajar konsisten dengan jalur yang lebih ringkas, paket Edukasi menjadi pilihan yang lebih relevan daripada sekadar akses bacaan umum.",
    ],
  },
];
