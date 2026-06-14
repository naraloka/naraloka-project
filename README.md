# Naraloka (Book Platform) — Prototipe UI/UX

Prototipe platform e-book kerja sama penulis: Beranda, Katalog, Detail E-book, Reader (bookmark/highlight/catatan/offline simulasi), Portal Penulis, dan Dashboard Admin.

## Menjalankan Lokal

```bash
npm install
npm run dev
```

## Konfigurasi Midtrans

1. Salin file `.env.example` menjadi `.env`
2. Isi kredensial Midtrans:

```bash
VITE_MIDTRANS_ENV=sandbox
VITE_MIDTRANS_CLIENT_KEY=SB-Mid-client-xxxxxxxxxxxx
MIDTRANS_SERVER_KEY=SB-Mid-server-xxxxxxxxxxxx
```

3. Jalankan aplikasi:

```bash
npm install
npm run dev
```

Catatan:
- Checkout memanggil endpoint `/api/midtrans/token`
- Webhook Midtrans tersedia di endpoint `/api/midtrans/webhook`
- Saat `npm run dev`, endpoint Midtrans juga aktif lewat middleware Vite
- Untuk deploy di Vercel, tambahkan env yang sama di Project Settings -> Environment Variables

## Webhook Midtrans

Setelah aplikasi punya domain publik, arahkan HTTP notification Midtrans ke:

```bash
https://domain-kamu/api/midtrans/webhook
```

Catatan:
- Endpoint webhook memverifikasi `signature_key` dari Midtrans.
- Server lalu mengambil ulang status transaksi ke API Midtrans sebelum memutuskan hasil akhir.
- Jika `SUPABASE_SERVICE_ROLE_KEY` diisi, order checkout `PENDING` dan hasil webhook akan tersimpan ke tabel ledger Supabase.

## Ledger Pembayaran Supabase

1. Jalankan SQL schema di [payment_ledger.sql](file:///workspace/supabase/payment_ledger.sql)
2. Tambahkan environment variable server:

```bash
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key
SUPABASE_PAYMENT_LEDGER_TABLE=payment_ledger
SUPABASE_AUTHOR_ROYALTY_LEDGER_TABLE=author_royalty_ledger
SUPABASE_AUTHOR_MEMBERSHIP_ROYALTY_LEDGER_TABLE=author_membership_royalty_ledger
```

Catatan:
- Server memakai `SUPABASE_SERVICE_ROLE_KEY`, bukan anon key, untuk menulis ledger pembayaran.
- URL Supabase server otomatis memakai `VITE_SUPABASE_URL` jika `SUPABASE_URL` tidak diisi terpisah.
- Saat order dibuat, server menyimpan status awal `PENDING` ke Supabase.
- Saat webhook Midtrans masuk, baris ledger yang sama akan di-update berdasarkan `order_id`.
- Saat status pembayaran e-book berubah, server juga menyinkronkan `author_royalty_ledger` agar pendapatan penulis mengikuti transaksi backend yang sama.
- Saat status pembayaran membership berubah, server juga menyiapkan dasar `author_membership_royalty_ledger` yang nantinya dibagi ke penulis berdasarkan progres baca nyata.
- SQL schema juga menambahkan policy RLS agar user login hanya bisa membaca ledger miliknya sendiri.

## Ledger Royalti Penulis

1. Jalankan SQL schema di [author_royalty_ledger.sql](file:///workspace/supabase/author_royalty_ledger.sql)
2. Pastikan `payment_ledger.sql` juga sudah aktif karena tabel ini mereferensikan `payment_ledger`.

Catatan:
- Ledger ini dibuat otomatis dari transaksi `EBOOK` di `payment_ledger`.
- Status payout mendukung alur `PENDING`, `AVAILABLE`, `PROCESSING`, `PAID`, dan `VOID`.
- Penulis hanya bisa membaca ledger miliknya sendiri.
- Admin bisa membaca seluruh ledger dan mengubah status payout dari dashboard.

## Ledger Membership Pool

1. Jalankan SQL schema di [author_membership_royalty_ledger.sql](file:///workspace/supabase/author_membership_royalty_ledger.sql)
2. Pastikan `payment_ledger.sql`, `reader_state.sql`, dan `author_workspace.sql` juga sudah aktif.

Catatan:
- Ledger ini dibuat dari transaksi `MEMBERSHIP` yang sukses di `payment_ledger`.
- Pool distributable dihitung dari `gross amount - platform commission`.
- Pool lalu dibagi ke penulis berdasarkan total halaman baca nyata pembeli paket pada buku membership yang sesuai plan.
- Saat progress baca reader disimpan ke `user_library_state`, aplikasi memanggil endpoint sync agar pembagian pool ikut diperbarui.
- Status payout mendukung alur `PENDING`, `AVAILABLE`, `PROCESSING`, `PAID`, dan `VOID`.
- Admin bisa memproses payout membership pool dari dashboard.
- Admin juga bisa memfilter laporan payout berdasarkan tanggal, status, penulis, dan `source type` sebelum mengekspor gabungan `Paid Book + Membership Pool` ke CSV dari tab laporan, sekaligus melihat summary total payout per penulis setelah filter.
- Dari summary per penulis, admin juga bisa membuka `Slip / Invoice Payout` HTML yang siap dicetak atau disimpan PDF dari browser.

## Arsip Slip Payout

1. Jalankan SQL schema di [payout_slip_archives.sql](file:///workspace/supabase/payout_slip_archives.sql)
2. Pastikan role admin di metadata auth sudah benar-benar `ADMIN`.

Catatan:
- Nomor invoice payout dibuat otomatis di backend dengan format seperti `NAR-PYT-YYYYMMDD-000001`.
- Saat admin mengarsipkan slip dari summary per penulis, dokumen HTML resmi beserta metadata payout disimpan ke Supabase.
- Arsip yang sudah pernah dibuat bisa dibuka lagi tanpa generate ulang dari dashboard admin.
- Penulis juga dapat diberi akses baca arsip slip miliknya sendiri melalui RLS yang sama.

## Sinkronisasi Reader State

1. Jalankan SQL schema di [reader_state.sql](file:///workspace/supabase/reader_state.sql)
2. Schema ini menyiapkan sinkronisasi untuk:
   - `user_library_state`
   - `user_wishlist`
   - `user_bookmarks`
   - `user_highlights`

Catatan:
- Saat user login, aplikasi akan menarik progress baca, wishlist, bookmark, dan highlight miliknya dari Supabase.
- Saat user mengubah progress baca, wishlist, bookmark, atau highlight, perubahan lokal tetap instan lalu disinkronkan ke Supabase di belakang layar.
- Policy RLS membatasi baca/tulis hanya untuk user pemilik data.

## Sinkronisasi Portal Penulis

1. Jalankan SQL schema di [author_workspace.sql](file:///workspace/supabase/author_workspace.sql)
2. Schema ini menyiapkan:
   - `author_workspace_profiles`
   - `author_collaboration_requests`
   - `author_manuscripts`
   - `author_manuscript_reviews`

Catatan:
- Portal penulis sekarang bisa menyimpan profil, pengajuan kerja sama, draft naskah, review admin, dan status publish ke Supabase.
- Review editor per naskah sekarang tersimpan sebagai histori terpisah, bukan hanya satu `adminNote`.
- Workflow editorial sekarang mendukung tahap `SUBMITTED`, `IN_REVIEW`, `NEEDS_REVISION`, `IN_EDITING`, `READY_TO_PUBLISH`, dan `REJECTED`.
- Penulis kini bisa mengirim ulang revisi dari status `NEEDS_REVISION`, termasuk unggah file revisi baru ke Supabase Storage, lalu status naskah kembali ke antrean editorial.
- Portal penulis sekarang menampilkan royalti nyata dari `author_royalty_ledger`, termasuk nominal siap dibayar, sedang diproses, dan sudah dibayar.
- Portal penulis juga menampilkan pembagian `membership pool` nyata dari `author_membership_royalty_ledger`, termasuk halaman baca yang menjadi dasar pembagian.
- Saat login, store `publishing` akan dihidrasi dari Supabase agar data penulis dan admin tidak lagi bergantung pada browser lokal.
- Policy RLS membatasi profil lengkap hanya untuk pemiliknya atau admin.
- Naskah yang sudah `published_at` boleh dibaca user login untuk kebutuhan katalog, sedangkan draft dan review tetap dibatasi pemilik naskah atau admin.
- Script yang sama juga membuat bucket Storage `author-manuscripts` untuk file PDF/DOCX maksimal 20MB.
- Jika ingin memakai nama bucket lain, ubah env `VITE_SUPABASE_AUTHOR_MANUSCRIPT_BUCKET`.

## Konfigurasi Supabase Auth

1. Buat project di Supabase.
2. Buka **Project Settings -> API** lalu salin:
   - `Project URL`
   - `anon public key`
3. Tambahkan ke `.env`:

```bash
VITE_PUBLIC_APP_URL=https://your-public-domain.vercel.app
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key
SUPABASE_PAYMENT_LEDGER_TABLE=payment_ledger
```

4. Di dashboard Supabase, aktifkan provider auth yang dibutuhkan:
   - `Email`
   - `Google`
5. Jika ingin tes lewat domain publik, isi `VITE_PUBLIC_APP_URL` dengan URL deploy kamu.
6. Di `Authentication -> URL Configuration`, isi:
   - `Site URL`: `https://domain-kamu`
   - `Redirect URLs`:
     - `https://domain-kamu/login`
     - `https://domain-kamu/`
     - opsional untuk lokal: `http://localhost:5175/login`
7. Untuk Google OAuth, callback di Google Cloud tetap:
   - `https://your-project-ref.supabase.co/auth/v1/callback`

Catatan:
- Login, daftar, logout, dan sesi akun sekarang memakai Supabase Auth.
- Metadata user menyimpan `full_name` dan `membership_plan`.
- Jika environment Supabase belum diisi, halaman login akan menampilkan pesan konfigurasi belum siap.
- Redirect login Google, email konfirmasi, dan finish URL checkout akan memakai `VITE_PUBLIC_APP_URL` jika diisi.

## Deploy Publik (Vercel)

1. Buat repository GitHub baru, lalu push project ini.
2. Buka Vercel → **New Project** → Import repo GitHub.
3. Pastikan pengaturan berikut:
   - Build Command: `npm run build`
   - Output Directory: `dist`
   - Environment Variables:
     - `VITE_MIDTRANS_ENV`
     - `VITE_MIDTRANS_CLIENT_KEY`
     - `MIDTRANS_SERVER_KEY`
     - `VITE_PUBLIC_APP_URL`
     - `VITE_SUPABASE_URL`
     - `VITE_SUPABASE_ANON_KEY`
4. Klik **Deploy** → Vercel akan memberi URL publik.
5. Setelah URL publik keluar, set:
   - `VITE_PUBLIC_APP_URL=https://domain-vercel-kamu.vercel.app`
   - `Supabase -> Authentication -> URL Configuration -> Site URL = https://domain-vercel-kamu.vercel.app`
   - `Supabase -> Authentication -> URL Configuration -> Redirect URLs` tambahkan:
     - `https://domain-vercel-kamu.vercel.app/login`
     - `https://domain-vercel-kamu.vercel.app/`

Catatan:
- File [vercel.json](./vercel.json) sudah disiapkan agar routing React Router tetap berjalan saat refresh URL.
- Endpoint webhook Midtrans siap di `https://domain-vercel-kamu.vercel.app/api/midtrans/webhook`

## Deploy Publik (Netlify)

1. Import repository ke Netlify
2. Build setting:
   - Build command: `npm run build`
   - Publish directory: `dist`
3. Tambahkan environment variables:
   - `VITE_MIDTRANS_ENV`
   - `VITE_MIDTRANS_CLIENT_KEY`
   - `MIDTRANS_SERVER_KEY`
   - `VITE_PUBLIC_APP_URL`
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
    - `SUPABASE_SERVICE_ROLE_KEY`
    - `SUPABASE_PAYMENT_LEDGER_TABLE`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `SUPABASE_PAYMENT_LEDGER_TABLE`
4. Setelah URL publik keluar, set:
   - `VITE_PUBLIC_APP_URL=https://domain-netlify-kamu.netlify.app`
   - `Supabase -> Authentication -> URL Configuration -> Site URL = https://domain-netlify-kamu.netlify.app`
   - `Supabase -> Authentication -> URL Configuration -> Redirect URLs` tambahkan:
     - `https://domain-netlify-kamu.netlify.app/login`
     - `https://domain-netlify-kamu.netlify.app/`

Catatan:
- File [netlify.toml](./netlify.toml) sudah menyiapkan:
  - redirect SPA `/* -> /index.html`
  - redirect endpoint `/api/midtrans/token` ke Netlify Function
  - redirect endpoint `/api/midtrans/status` ke Netlify Function
  - redirect endpoint `/api/midtrans/webhook` ke Netlify Function
