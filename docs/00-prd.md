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
- Bukan identity provider pihak ketiga (Google OAuth sudah dihapus dari jalur aktif).

## Yang belum diputuskan

- `[NEEDS INPUT]` Apakah UMS akan melayani konsumen di luar platform `soerjo/*` (multi-tenant
  eksternal)? Ini menentukan perlu-tidaknya OAuth2 client registry.
- `[NEEDS INPUT]` Apakah permission akan ditegakkan di UMS atau cukup dibawa sebagai klaim dan
  ditegakkan masing-masing service?
- `[NEEDS INPUT]` Apakah role perlu di-scope per organisasi? Saat ini `Role.name` unik global,
  sementara `OrgMember.role` adalah string bebas — dua mekanisme peran yang berdampingan.
- `[NEEDS INPUT]` Target SLA/ketersediaan. Saat ini seluruh platform berada di satu host.
- `[NEEDS INPUT]` Kebijakan audit log: apa yang wajib tercatat dan berapa lama disimpan.

## Kriteria keberhasilan

- `[NEEDS INPUT]` Belum ada metrik yang disepakati. Kandidat yang bisa diukur dari sistem sekarang:
  jumlah service yang memverifikasi token UMS (saat ini 3 dari 7), p95 latensi `POST /auth/login`,
  dan rasio refresh yang gagal karena deteksi penggunaan ulang.
