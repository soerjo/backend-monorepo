# PLATFORM.md — digest Tier-0

<!-- GENERATED: disinkron dari repo soerjo/platform-docs. JANGAN EDIT DI REPO INI.
     Perubahan dilakukan di platform-docs, lalu disinkron ulang.
     Sumber: platform-docs/digest/PLATFORM.md · verifikasi fakta: 2026-10-19 -->

Ringkasan fakta platform `soerjo/*` yang wajib diketahui agent di repo manapun.
Detail lengkap ada di repo `platform-docs`.

## Prinsip yang mengikat semua repo

1. **UMS satu-satunya penerbit identitas.** Hanya `ums-service` menerbitkan access token (RS256).
   Consumer memverifikasi tanda tangan secara lokal (key atau JWKS), **tidak** memanggil UMS per
   request, dan **tidak** mewajibkan baris user lokal untuk memvalidasi token.
2. **Contract-driven.** Service yang mengekspos interface memiliki kontraknya. Kontrak HTTP
   digenerate dari `SwaggerModule` ke `contracts/openapi.json` dan tidak pernah diedit tangan.
3. **Hanya fakta terverifikasi.** Port, nama database, nama topik, dan nama env di dokumen harus
   berasal dari inspeksi kode atau host yang berjalan, lengkap dengan tanggal verifikasi.
4. **Generated mengalahkan handwritten.** Bila artefak bisa digenerate, bentuk generated yang
   otoritatif dan salinan manualnya dihapus.
5. **Satu fakta satu tempat.** Dokumentasi duplikat diganti link. `AGENTS.md` adalah kartu
   operasional singkat (±120 baris); checklist pekerjaan tinggal di GitHub Issues.
6. **Spec sebelum kode.** specify → clarify → plan → tasks → implement → converge. Pekerjaan lintas
   repo ditulis sebagai epic dengan kontrak beku sebelum slice manapun dimulai.
7. **Disiplin delivery.** `bun` satu-satunya package manager; setiap perubahan lolos lint, typecheck,
   build; pengiriman lewat PR, tanpa push langsung ke `main`; klaim selesai wajib disertai output
   perintah nyata.

## Port deployment nyata (host `soerjo-sever`)

Backend: ums `3500` · wms `3501` · pos `3502` · my-cms `3503` · notification `3400` ·
routing `3420` · minio-file `3110`
Frontend: ums-ui `3600` · wms-ui `3601` · pos-ui `3602` · my-cms-ui `3603` · minio-file-ui `3200`
Infra: postgres `5432` · redis `6379` · kafka `9092` · kafbat `8085` · minio `9100`/`9101` ·
grafana `3001` · osrm `5000`

> `.env.example` di semua repo masih nilai template (`PORT=3000`, `my_db`) dan **tidak**
> mencerminkan port nyata.

## Database

Satu instance PostgreSQL, satu database per service: `ums_db`, `wms_db`, `pos_db`, `my_cms_db`,
`notification_db`, `routing_db`, `minio_file_db`. Tidak ada cross-database query.

## Event

Kafka `:9092`. Topik aktif: `pos.order.completed`, `pos.order.refunded` —
producer `pos-service` (lewat outbox), consumer `wms-service`.
Skema payload **belum dibekukan**; perubahan payload saat ini adalah breaking change tak terdeteksi.

## Status integrasi auth

- Terintegrasi: `wms-service`, `pos-service`, `my-cms-service`
- **Belum**: `notification-service`, `routing-service`, `minio-file-service`

## Jebakan yang sudah memakan korban

- **Token lolos, otorisasi gagal.** `wms-service` memverifikasi JWT UMS dengan benar tetapi tetap
  menjalankan `validateUserById` lokal, sehingga user sah yang belum ada di DB lokal menerima `404`.
- **`NEXT_PUBLIC_*` di-bake saat build.** Tanpa `--build-arg NEXT_PUBLIC_API_URL=''`, browser
  menembak `localhost:3050` bawaan Dockerfile. Nilai kosong memaksa fallback ke `/api`.
- **Target proxy harus container internal**, bukan `host.docker.internal`.
- **Nama env proxy tidak seragam**: `wms-ui` memakai `UMS_SERVICE_URL`, UI lain
  `API_PROXY_TARGET` / `UMS_API_PROXY_TARGET`. Gunakan `API_PROXY_TARGET` untuk yang baru.
