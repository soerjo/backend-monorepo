# Panduan Penggunaan Mailpit (Local SMTP Testing)

Mailpit adalah server SMTP lokal dan inbox web visual untuk menguji fitur pengiriman email di lingkungan *development* tanpa mengirim email sungguhan ke internet.

---

## 1. Port Mailpit

Ketika Anda menjalankan `bun run docker:up`, Mailpit berjalan pada dua port:

| Port | Protokol / Fungsi | Kegunaan |
| :---: | :--- | :--- |
| **`1025`** | **SMTP Server** | Menerima email dari aplikasi (`ums-service` & `notification-service`) |
| **`8025`** | **Web UI Dashboard** | Buka di browser (`http://localhost:8025`) untuk membaca inbox email |

---

## 2. Cara Mengonfigurasi Aplikasi

### A. Untuk `ums-service`
Tambahkan konfigurasi berikut pada file `.env` di `apps/ums-service/.env` (atau root `.env`):

```env
# Aktifkan mode pengiriman via SMTP
MAIL_TRANSPORT=smtp

# Arahkan ke Mailpit
SMTP_HOST=localhost
SMTP_PORT=1025
SMTP_SECURE=false

# Kosongkan kredensial (Mailpit tidak memerlukan autentikasi di lokal)
SMTP_USER=
SMTP_PASSWORD=

# Identitas pengirim
MAIL_FROM=auth@example.com
```

### B. Untuk `notification-service`
Tambahkan konfigurasi berikut pada file `.env` di `apps/notification-service/.env`:

```env
SMTP_HOST=localhost
SMTP_PORT=1025
SMTP_USER=
SMTP_PASS=
SMTP_FROM=noreply@example.com
```

---

## 3. Langkah Pengujian Praktis (Hands-on)

### Langkah 1: Nyalakan Docker
```bash
bun run docker:up
```

### Langkah 2: Buka Web Dashboard Mailpit
Buka browser dan akses:
👉 **[http://localhost:8025](http://localhost:8025)**

Halaman inbox kosong Mailpit akan tampil.

### Langkah 3: Picu Pengiriman Email (Contoh UMS)
1. Jalankan `ums-service`:
   ```bash
   bun --filter ums-service start:dev
   ```
2. Lakukan registrasi akun baru atau panggil endpoint Forgot Password / Resend Verification.
3. Begitu API selesai dipanggil, kembali ke tab browser Mailpit.
4. Email verifikasi akan **langsung muncul secara instan** di inbox.
5. Klik pesan tersebut untuk:
   - Membaca format HTML dan Plain Text.
   - Menguji responsivitas tampilan di layar Mobile & Desktop.
   - Menyalin link verifikasi / token verifikasi untuk melanjutkan pengujian.

---

## 4. Keunggulan Mailpit Dibanding SMTP Asli
1. **100% Aman & Terisolasi**: Tidak ada email testing yang mungkin salah terkirim ke alamat pengguna asli.
2. **Offline-friendly**: Anda bisa coding dan testing fitur email di pesawat atau tanpa koneksi internet.
3. **Instan**: Tanpa delay pengiriman jaringan SMTP publik (pengiriman selesai dalam < 10 milidetik).
4. **Tool Debugging Lengkap**: Menyediakan tab *Raw MIME*, *Headers*, *HTML*, *Plain Text*, dan pemeriksaan lampiran (*attachments*).
