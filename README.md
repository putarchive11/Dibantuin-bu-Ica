# Generator Komentar Rapor AI

Website pembuat komentar rapor berbasis AI. Guru memilih sifat positif dan hal yang perlu ditingkatkan, lalu AI menulis komentar yang personal dan **berbeda di setiap versi**.

## Isi paket

```
index.html       Halaman utama
style.css        Tampilan
app.js           Logika frontend (form, tab versi, salin, cetak, daftar tersimpan)
api/generate.js  Backend serverless: memanggil Claude API (API key aman di server)
vercel.json      Konfigurasi Vercel
package.json
.env.example     Contoh environment variable
```

## Fitur

- Seluruh tampilan (form, tombol, pesan) dan hasil komentar berbahasa Inggris
- Input: nama siswa, pronoun (He/She/They), jenjang (SD/SMP/SMA), gaya bahasa, panjang komentar
- 18 sifat positif dan 12 area perbaikan (pilihan "Tidak ada" otomatis eksklusif)
- Catatan tambahan opsional (mis. "nilai matematika naik")
- 1-3 versi komentar sekaligus (tab Versi 1/2/3), masing-masing bisa diedit langsung
- Salin, cetak (hanya komentar yang tercetak), generate ulang
- Daftar tersimpan di perangkat (satu kelas bisa dikerjakan berurutan, lalu "Salin semua")
- Kode akses opsional agar kredit API tidak disalahgunakan orang lain
- Responsif untuk HP

## Cara deploy (Vercel, gratis)

1. Buat repo GitHub baru, lalu upload semua file di folder ini.
2. Masuk ke vercel.com, klik **Add New > Project**, pilih repo tadi, lalu **Deploy**. Tidak perlu mengubah pengaturan build.
3. Buka **Project > Settings > Environment Variables**, tambahkan:

   | Nama | Isi |
   |---|---|
   | `ANTHROPIC_API_KEY` | API key dari console.anthropic.com (wajib) |
   | `ACCESS_CODE` | Kode rahasia buatan Anda (sangat disarankan) |
   | `ANTHROPIC_MODEL` | Opsional. Default `claude-haiku-5-5` (hemat). Untuk hasil lebih halus pakai `claude-sonnet-5-5` |

4. Buka tab **Deployments**, klik **Redeploy** agar variabel terbaca.
5. (Opsional) Hubungkan domain sendiri di **Settings > Domains**.

> Catatan: file `index.html` harus tetap di root dan `api/generate.js` di folder `api`, karena Vercel otomatis menjadikannya endpoint `/api/generate`.

## Uji di komputer sendiri

```bash
npm i -g vercel
cp .env.example .env.local     # isi API key
vercel dev
```

Lalu buka alamat yang ditampilkan (biasanya http://localhost:3000).

## Keamanan dan biaya

- API key hanya ada di server (environment variable), tidak pernah dikirim ke browser.
- Backend hanya menerima pilihan dari daftar yang sudah ditentukan dan catatan maksimal 300 karakter, jadi tidak bisa dipakai sebagai chatbot umum.
- Ada pembatas permintaan per IP (best effort). **Tetap isi `ACCESS_CODE`** bila situs dibuka untuk umum.
- Biaya per komentar sangat kecil (model Haiku). Pantau penggunaan di console.anthropic.com dan isi saldo kredit di sana.
- Nama siswa dikirim ke Claude API untuk menulis komentar. Gunakan nama depan saja bila ingin lebih privat.

## Kustomisasi cepat

- Tambah sifat atau area baru: ubah daftar `POSITIVE` / `AREAS` di `app.js` **dan** di `api/generate.js` (harus sama).
- Ubah gaya penulisan AI: edit fungsi `buildPrompts` di `api/generate.js`.
- Ubah warna: variabel di bagian atas `style.css`.
