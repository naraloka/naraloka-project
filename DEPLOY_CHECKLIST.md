# Naraloka Deploy Checklist

Checklist singkat ini dipakai setelah project diekstrak agar proses setup lebih rapi dan cepat.

## 1. Install Project

```bash
npm install
```

## 2. Siapkan File Environment

Salin `.env.example` menjadi `.env`, lalu isi variabel berikut:

```env
VITE_MIDTRANS_ENV=sandbox
VITE_MIDTRANS_CLIENT_KEY=SB-Mid-client-xxxxxxxxxxxx
MIDTRANS_SERVER_KEY=SB-Mid-server-xxxxxxxxxxxx
VITE_PUBLIC_APP_URL=https://domain-kamu.netlify.app
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
VITE_SUPABASE_AUTHOR_MANUSCRIPT_BUCKET=author-manuscripts
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key
SUPABASE_PAYMENT_LEDGER_TABLE=payment_ledger
SUPABASE_AUTHOR_ROYALTY_LEDGER_TABLE=author_royalty_ledger
SUPABASE_AUTHOR_MEMBERSHIP_ROYALTY_LEDGER_TABLE=author_membership_royalty_ledger
```

Catatan:
- `VITE_*` dipakai frontend.
- `SUPABASE_SERVICE_ROLE_KEY` hanya untuk server/backend, jangan dipublish ke browser.
- Untuk local dev, `VITE_PUBLIC_APP_URL` bisa diisi `http://localhost:5173`.

## 3. Jalankan SQL Supabase

Jalankan file SQL berikut di Supabase SQL Editor:

1. `supabase/payment_ledger.sql`
2. `supabase/author_royalty_ledger.sql`
3. `supabase/author_membership_royalty_ledger.sql`
4. `supabase/payout_slip_archives.sql`
5. `supabase/reader_state.sql`
6. `supabase/author_workspace.sql`

## 4. Atur Auth Supabase

Di Supabase:

1. Buka `Authentication -> Providers`
2. Aktifkan `Email`
3. Aktifkan `Google` jika ingin login Google
4. Buka `Authentication -> URL Configuration`
5. Isi:
   - `Site URL`: `https://domain-kamu.netlify.app`
   - `Redirect URLs`:
     - `https://domain-kamu.netlify.app/`
     - `https://domain-kamu.netlify.app/login`
     - opsional lokal: `http://localhost:5173/login`

## 5. Jadikan Admin

Untuk menjadikan akun tertentu sebagai admin:

```bash
npm run promote:admin -- naralokanaraloka@gmail.com
```

Catatan:
- Pastikan user itu sudah terdaftar di Supabase Auth lebih dulu.
- Role admin disimpan di `app_metadata.role = ADMIN`.
- Setelah berhasil, user perlu logout lalu login ulang.

## 6. Jalankan Lokal

```bash
npm run dev
```

## 7. Validasi Build

```bash
npm run build
npm test
```

## 8. Deploy Netlify

Build setting:

- Build command: `npm run build`
- Publish directory: `dist`

Environment variables yang wajib di Netlify:

- `VITE_MIDTRANS_ENV`
- `VITE_MIDTRANS_CLIENT_KEY`
- `MIDTRANS_SERVER_KEY`
- `VITE_PUBLIC_APP_URL`
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_PAYMENT_LEDGER_TABLE`
- `SUPABASE_AUTHOR_ROYALTY_LEDGER_TABLE`
- `SUPABASE_AUTHOR_MEMBERSHIP_ROYALTY_LEDGER_TABLE`

## 9. Hubungkan Webhook Midtrans

Set HTTP notification URL Midtrans ke:

```text
https://domain-kamu.netlify.app/api/midtrans/webhook
```

Untuk Netlify Functions, pastikan endpoint parity backend sudah ikut terdeploy.

## 10. Final Check

Pastikan alur berikut berjalan:

- Login email
- Login Google
- Checkout membership
- Checkout e-book paid
- Webhook Midtrans
- Library reader
- Wishlist dan bookmark
- Portal penulis
- Dashboard admin
- Arsip slip payout
