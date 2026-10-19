# Design Patterns — ums-service

Pola yang **sudah berlaku** di kode ini. Menyimpang darinya butuh alasan tertulis di PR.

## Pola modul tiga lapis

Setiap modul bisnis di `src/modules/<domain>/` terdiri dari:

- **Controller** — hanya urusan HTTP: routing, decorator (`@ApiTags`, `@Roles`, `@Public`,
  `@Throttle`), binding DTO. Tidak ada logika bisnis, tidak ada Prisma.
- **Service** — logika bisnis tipis, mengorkestrasi repository. Tidak menyentuh objek request/response.
- **Repository** — satu-satunya tempat query Prisma. Melempar `NotFoundException` saat entitas tidak ada.
- **DTO** — Create DTO memakai `class-validator` + decorator Swagger dengan contoh nilai;
  Update DTO diturunkan lewat `PartialType(CreateDto)`.

Alasannya: lapisan repository membuat perubahan skema terlokalisasi, dan controller yang tipis
membuat kontrak OpenAPI bisa digenerate tanpa kebocoran detail implementasi.

## Autentikasi dan otorisasi

- **Guard global berurutan** (`app.module.ts`): `ThrottlerGuard` → `JwtAuthGuard` → `RolesGuard`.
- `@Public()` membebaskan route dari `JwtAuthGuard`. Tanpa decorator ini, route otomatis terproteksi —
  default-nya aman.
- **`JwtStrategy.validate()` hanya memetakan klaim.** Dilarang menambahkan query database di sini;
  itu mengubah access token dari stateless menjadi stateful dan menambah satu round-trip DB per request.
- **`RolesGuard` membaca `user.roles` dari klaim**, bukan tabel. Gerbang admin memakai konstanta
  `UMS_ADMIN_ROLE = 'ums:admin'`.

## Penanganan token

- Access token: RS256, ditandatangani private key yang **tidak pernah keluar** dari service ini.
  Public key dan `kid` diturunkan dari private key — satu sumber kebenaran, tidak ada env public key.
- Refresh token: opaque 32-byte base64url. Yang tersimpan hanya SHA-256-nya.
  Rotasi → `replacedByHash` + `revokedAt`. Pemakaian ulang → cabut seluruh `family`.
- JWKS dikirim lewat `@Res()` mentah supaya bentuknya tetap `{ keys: [...] }` dan tidak dibungkus
  `ResponseTransformInterceptor`.

## Bentuk response

- Sukses dibungkus `ResponseTransformInterceptor`:
  `{ statusCode, message, data, timestamp, path }`.
- Error dinormalkan `AllExceptionsFilter`: `{ statusCode, message, errors?, timestamp, path }`.
- **Pengecualian sadar:** `/metrics` dan JWKS sengaja melewati pembungkus ini karena formatnya
  ditentukan pihak luar (Prometheus text format dan RFC 7517).

## Konfigurasi

- Env divalidasi saat startup dengan `class-validator` di `src/config/env.validation.ts`.
  Env yang salah membuat aplikasi gagal start — bukan gagal diam-diam saat request pertama.
- Logger winston menggantikan logger bawaan Nest (`src/config/logger.config.ts`).

## Observability

- `request-logging.middleware.ts` dipasang sebagai **middleware Express mentah**, bukan interceptor.
  Alasannya konkret: guard menolak 401/403/429 dan 404 tak-terpetakan **sebelum** interceptor jalan,
  jadi interceptor tidak akan pernah melihat request tersebut. Middleware melihat semuanya.
- Label route memakai template (`/api/users/:id`), bukan URL mentah, supaya kardinalitas label
  Prometheus tidak meledak oleh UUID.

## Anti-pattern (jangan diulang)

- Query DB di jalur verifikasi token.
- Prisma dipanggil langsung dari service atau controller, melewati repository.
- Membuat konfigurasi `DocumentBuilder` kedua yang berbeda dari `main.ts` — kontrak jadi bercabang.
- Menambahkan env public key RS256; public key diturunkan, bukan dikonfigurasi.
- Menyimpan refresh token apa adanya, atau mencabut satu baris sesi saat mendeteksi pemakaian ulang.
