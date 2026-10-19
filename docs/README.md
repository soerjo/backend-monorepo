# docs/ — ums-service (Tier-1)

Dokumentasi lokal service ini. Fakta lintas service **tidak** ditulis di sini —
lihat `docs/platform/PLATFORM.md` (GENERATED) atau repo `soerjo/platform-docs`.

- `00-prd.md` — masalah, scope, non-goals
- `01-data-model.md` — ERD + invariant + index + kebijakan migrasi
- `02-patterns.md` — pola modul, guard, error, dan anti-pattern
- `03-operations.md` — env, build, port, deployment
- `platform/PLATFORM.md` — **GENERATED**, disinkron dari `platform-docs`, jangan diedit

Kontrak HTTP bukan dokumen tulisan tangan: sumbernya `SwaggerModule` → `contracts/openapi.json`.

## Aturan

Maksimal 200 baris per file. Satu fakta satu tempat. Checklist pekerjaan di GitHub Issues.
