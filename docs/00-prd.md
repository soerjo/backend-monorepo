# PRD — ums-service

> Bagian "kondisi saat ini" direkonstruksi dari kode (`src/`, `prisma/schema.prisma`,
> `package.json`) per 19 Oktober 2026. Bagian bertanda `[NEEDS INPUT]` **belum** diputuskan dan
> sengaja tidak diisi — mengarangnya akan menghasilkan arah palsu.

## Masalah yang diselesaikan

Platform `soerjo/*` terdiri dari 7 backend dan 5 frontend. Tanpa pusat identitas, setiap service
harus mengurus login, password, role, dan sesi sendiri — artinya 7 implementasi auth, 7 permukaan
serangan, dan tidak ada cara konsisten menjawab "siapa user ini dan dia boleh apa".

UMS menjadi satu-satunya penerbit identitas sehingga service lain cukup **memverifikasi**, bukan
mengelola.

## Pengguna

- **Service consumer** (`wms-service`, `pos-service`, `my-cms-service`) — memverifikasi token
  terbitan UMS untuk mengotorisasi request.
- **Administrator platform** — mengelola user, role, permission, dan organisasi lewat `ums-ui`.
- **End user** — mendaftar, login, dan mengelola sesinya.

## Kemampuan saat ini

**Autentikasi** — register, login (throttle 5 request/60 detik), refresh dengan rotasi,
logout, logout seluruh perangkat, profil `GET /auth/me`.

**Penerbitan token** — access token RS256 berumur pendek dengan klaim
`{ sub, email, name, roles[], orgs[], iss, azp }`; `kid` berupa JWK thumbprint RFC 7638;
public key dipublikasikan di `GET /api/.well-known/jwks.json`.

**Keamanan kredensial** — password argon2id; refresh token opaque yang disimpan hanya sebagai
SHA-256, dirotasi, dan pemakaian ulang mencabut seluruh `family` sesi.

**Otorisasi** — RBAC berbasis role dan permission, gerbang admin lewat role `ums:admin`,
keanggotaan organisasi lewat `OrgMember`.

**Administrasi** — CRUD user, role (termasuk penetapan permission), permission, dan organisasi
beserta anggotanya.

**Operasional** — health check Prisma, metrik Prometheus di `/metrics`, logging request winston.

## Non-goals (tegas)

- Tidak menerbitkan token untuk pihak di luar platform.
- Tidak menyimpan data domain milik service lain.
- Tidak melakukan otorisasi atas resource milik service lain — UMS menyatakan *siapa* dan *peran
  apa*; keputusan akses atas resource adalah tanggung jawab service pemilik.

**Non-goal yang dicabut bersama di atas:** "tidak melayani konsumen di luar platform `soerjo/*`".
Adanya client registry M2M dan billing per-seat di desain hanya masuk akal untuk konsumen eksternal
(ADR 0006).
- ~~Bukan identity provider pihak ketiga.~~ **Dicabut 19 Oktober 2026** (ADR 0006) — UMS akan
  menjadi *service provider* terhadap IdP eksternal lewat federasi SAML 2.0 / OIDC. Google OAuth
  bawaan template tetap dihapus; federasi nanti dibangun ulang dengan desain sendiri.

## Yang belum diputuskan

- `[NEEDS INPUT]` Apakah permission akan ditegakkan di UMS atau cukup dibawa sebagai klaim dan
  ditegakkan masing-masing service? Desain memakai 21 entitlement granular, yang mengarah ke
  penegakan di UMS — tetapi klaim token saat ini hanya membawa `roles[]`, bukan permission.
- `[NEEDS INPUT]` Target SLA/ketersediaan. Saat ini seluruh platform berada di satu host.
- `[NEEDS INPUT]` Kebijakan audit log: apa yang wajib tercatat dan berapa lama disimpan.

## Kondisi target menurut desain

Desain Stitch **"Enterprise UMS Dashboard"** (`6437226935783627922`, 9 layar, 19 Oktober 2026)
menggambarkan UMS sebagai produk IAM setingkat Keycloak/Auth0 — jauh di atas kemampuan sekarang.
Dipelajari dari HTML tiap layar, bukan dari screenshot.

Kemampuan yang digambarkan desain tetapi **belum ada sama sekali** di kode:

- **MFA** — kolom MFA di direktori user; faktor TOTP, FIDO2/WebAuthn, Passkey device-bound.
  SMS OTP sengaja ditandai *Strictly Prohibited* di desain.
- **Audit log & telemetri autentikasi** — Timestamp, Event Identity, Severity, Actor/Subject,
  Origin & Geo-IP, Client Agent, Status, plus kebijakan retensi.
- **Kredensial M2M & webhook** — client registry (client id, scope, rate limit, CIDR allowlist),
  endpoint webhook, dan event stream dengan replay.
- **Kebijakan keamanan adaptif** — risk engine berbasis geo-velocity, deteksi Tor/VPN, device
  fingerprint, step-up challenge, killswitch credential stuffing.
- **Federasi SAML 2.0 / OIDC** — UMS sebagai service provider yang mempercayai IdP eksternal.
- **Billing & seat allocation** — langganan, invoice, alokasi kursi enterprise.
- **Impersonasi user** (`users:impersonate.ephemeral`) dan **rotasi kunci** (`crypto:keys.rotate`).

Kemampuan desain yang **sudah didukung sebagian** oleh skema sekarang:

- **Session manager** — `Session` sudah menyimpan `userAgent`, `ip`, `family`. Yang kurang hanya
  endpoint baca/cabut selektif. Menjadi **epic 002**.
- **Matriks role × permission** — `Permission`, `RolePermission`, dan `PUT /roles/:id/permissions`
  sudah ada; desain hanya menuntut UI dan konvensi penamaan yang lebih kaya.

**Desain ini sudah diadopsi sebagai arah produk** (ADR 0006, 19 Oktober 2026). Bukan lagi sekadar
catatan desain.

> **Peringatan cakupan yang tetap berlaku.** Mengadopsi arah **bukan** berarti membangun semuanya
> berikutnya. Isinya setara beberapa kuartal kerja dan ~7 tabel baru. Setiap area besar (audit, MFA,
> kebijakan keamanan, M2M, webhook, federasi, billing) menjadi **epic tersendiri dengan kontrak
> beku**, bukan satu epic raksasa. Urutan yang diusulkan ada di `platform-docs/docs/roadmap.md`;
> sub-pertanyaan yang masih memblokir tiap area ada di
> `platform-docs/docs/07-open-architecture-questions.md`.

## Batas yang tetap berlaku meski desain diadopsi

- **Role tetap global.** ADR 0003 ditegaskan kembali (ADR 0005). "Realm Admin — DELEGATED" di desain
  diimplementasikan sebagai role global `ums:realm-admin`; pembatasan per-organisasi terjadi di
  **lapisan query**, bukan di definisi role. `user_roles` tidak ditambah `orgId`, dan klaim token
  tidak berubah — jadi `wms-service`, `pos-service`, dan `my-cms-service` tidak terdampak.
  **Risikonya berpindah, bukan hilang:** satu endpoint yang lupa memfilter berdasarkan keanggotaan
  organisasi langsung menjadi privilege escalation lintas organisasi. Wajib ada test per endpoint.
- **Istilah tetap "Organization"**, bukan "Realm" (ADR 0005). Label UI diterjemahkan saat
  implementasi.
- **SMS OTP tetap dilarang** sebagai faktor MFA — desain sendiri menandainya *Strictly Prohibited*;
  alasannya kuat (rentan SIM-swap).
- **Kolom tanpa sumber data tidak dirender** — Geolocation dan Risk Score menunggu sumber datanya ada.
- **UMS tetap satu-satunya penerbit token platform.** Federasi menjadikan UMS service provider
  terhadap IdP eksternal, tetapi token yang dikonsumsi service internal tetap terbit dari UMS.

## Sudah diputuskan

- **Role bersifat global, bukan per-organisasi** (ADR 0003, ditegaskan kembali 19 Oktober 2026 di
  ADR 0005 setelah desain menampilkan "Realm Admin — DELEGATED"). `user_roles` adalah satu-satunya
  sumber peran otorisasi; `OrgMember.role` bukan peran otorisasi. Tidak ada migrasi yang diperlukan.
- **Desain Stitch diadopsi sebagai arah produk** (ADR 0006). Dua non-goal dicabut: UMS kini boleh
  menjadi service provider terhadap IdP eksternal, dan boleh melayani konsumen di luar platform.

## Kriteria keberhasilan

- `[NEEDS INPUT]` Belum ada metrik yang disepakati. Kandidat yang bisa diukur dari sistem sekarang:
  jumlah service yang memverifikasi token UMS (saat ini 3 dari 7), p95 latensi `POST /auth/login`,
  dan rasio refresh yang gagal karena deteksi penggunaan ulang.
