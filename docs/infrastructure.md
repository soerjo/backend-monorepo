# Panduan Lengkap Infrastruktur Backend Monorepo

Dokumentasi ini mencakup seluruh komponen infrastruktur lokal yang dijalankan via Docker Compose di folder `docker/docker-compose.yml`.

---

## 🗺️ Peta Topologi Infrastruktur

```mermaid
flowchart TB
    subgraph HostAccess["Akses Developer (Localhost Browser / Client)"]
        BROWSER["Web Browser / Postman / DBeaver"]
    end

    subgraph DockerNetwork["Docker Bridge Network (monorepo-net)"]
        subgraph Databases["Data Persistence"]
            PG["PostgreSQL 16 Multi-DB<br/>Port: 5432<br/>(7 Databases)"]
            REDIS["Redis 7 (Cache & Queue)<br/>Port: 6379"]
            MINIO["MinIO S3 (Object Storage)<br/>Port API: 9000"]
        end

        subgraph EventStreaming["Event Streaming Backbone"]
            ZK["ZooKeeper<br/>Port: 2181"]
            KAFKA["Apache Kafka Broker<br/>Port: 9092 (Host) / 29092 (Internal)"]
            ZK --- KAFKA
        end

        subgraph MailTesting["Email Testing"]
            MAILPIT["Mailpit (Local SMTP)<br/>Port SMTP: 1025"]
        end

        subgraph Dashboards["Developer Web Dashboards"]
            KAFBAT_UI["Kafbat UI (Kafka Dashboard)<br/>Web Port: 8080"]
            REDIS_UI["RedisInsight (Redis Dashboard)<br/>Web Port: 5540"]
            MINIO_UI["MinIO Console (S3 Dashboard)<br/>Web Port: 9001"]
            MAIL_UI["Mailpit Web (Inbox Email)<br/>Web Port: 8025"]
        end
    end

    %% Connections
    BROWSER -->|"Web UI"| KAFBAT_UI
    BROWSER -->|"Web UI"| REDIS_UI
    BROWSER -->|"Web UI"| MINIO_UI
    BROWSER -->|"Web UI"| MAIL_UI
    BROWSER -->|"Direct TCP 5432"| PG
    BROWSER -->|"Direct TCP 6379"| REDIS

    KAFBAT_UI -.->|"Monitor"| KAFKA
    REDIS_UI -.->|"Inspect"| REDIS
    MINIO_UI -.->|"Manage"| MINIO
    MAIL_UI -.->|"Read"| MAILPIT
```

---

## 📋 Tabel Port, Kredensial & URL Dashboard

| Layanan | Komponen | Port Host | URL Akses / Web UI | Kredensial Default |
| :--- | :--- | :---: | :--- | :--- |
| **PostgreSQL 16** | Database Engine | `5432` | `localhost:5432` | User: `postgres`<br/>Password: `postgres` |
| **Redis 7** | Cache & Queue | `6379` | `localhost:6379` | *No password (auth disabled)* |
| **RedisInsight** | Redis Dashboard | `5540` | [http://localhost:5540](http://localhost:5540) | *Auto-connect ke `redis:6379`* |
| **Apache Kafka** | Event Streaming Broker | `9092` / `29092` | `localhost:9092` | *PLAINTEXT (No auth)* |
| **ZooKeeper** | Kafka Coordinator | `2181` | `localhost:2181` | *Internal daemon* |
| **Kafbat UI** | Kafka Dashboard | `8080` | [http://localhost:8080](http://localhost:8080) | *Auto-connect ke `kafka:29092`* |
| **MinIO S3** | S3 API Endpoint | `9000` | `http://localhost:9000` | Access Key: `minioadmin`<br/>Secret: `minioadmin` |
| **MinIO Console** | S3 Web Dashboard | `9001` | [http://localhost:9001](http://localhost:9001) | User: `minioadmin`<br/>Password: `minioadmin` |
| **Mailpit SMTP** | Mail Server Port | `1025` | `localhost:1025` | *No auth* |
| **Mailpit Web** | Email Inbox Dashboard | `8025` | [http://localhost:8025](http://localhost:8025) | *Langsung buka di browser* |

---

## 1. PostgreSQL 16 (Multi-Database Per-Service)

Sistem menggunakan pola **Database-per-Service** namun di-host dalam satu container PostgreSQL 16 terpadu untuk efisiensi RAM di lingkungan lokal.

### Skrip Inisialisasi Otomatis (`docker/init-db.sh`)
Saat container pertama kali dinyalakan, skrip `init-db.sh` secara otomatis mengeksekusi pembuatan 7 database terisolasi:

```text
1. ums_db          -> Digunakan oleh apps/ums-service
2. cms_db          -> Digunakan oleh apps/cms-service
3. pos_db          -> Digunakan oleh apps/pos-service
4. wms_db          -> Digunakan oleh apps/wms-service
5. billing_db      -> Digunakan oleh apps/billing-service
6. file_db         -> Digunakan oleh apps/minio-file-service
7. notification_db -> Digunakan oleh apps/notification-service
```

### Format Connection String
```env
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/<nama_db>?schema=public
```

### Akses via CLI (Terminal)
```bash
# Masuk ke terminal PostgreSQL
docker exec -it monorepo-postgres psql -U postgres

# Menampilkan daftar database
\l

# Berpindah ke database pos_db dan lihat tabel
\c pos_db
\dt
```

---

## 2. Redis 7 & RedisInsight (Cache, Lock, & Queue)

### Peran Redis di Monorepo Ini
1. **`billing-service`**: Distributed Lock & Idempotency Key (mencegah double-payment saat koneksi lambat).
2. **`notification-service`**: Backend message queue untuk antrean pesan BullMQ (Email, FCM, In-App).
3. **`ums-service`**: Session invalidation & token blocklist.

### Dashboard RedisInsight (`http://localhost:5540`)
1. Buka browser ke [http://localhost:5540](http://localhost:5540).
2. Jika diminta menambahkan database:
   - **Host**: `redis` (jika dari dalam docker) atau `localhost` (jika diakses dari luar).
   - **Port**: `6379`.
   - **Name**: `Local Monorepo Redis`.
3. Fitur yang dapat digunakan:
   - **Browser Key**: Mencari key idempotency (`idempotency:order-*`) atau antrean BullMQ (`bull:*`).
   - **Profiler**: Melihat perintah Redis yang dieksekusi secara real-time.
   - **Memory Analysis**: Mengecek konsumsi memori cache.

---

## 3. Apache Kafka, ZooKeeper & Kafbat UI (Event Driven)

### Alur Event Antar-Service
- **Producer (`pos-service`)**:
  - Event `pos.order.completed` diterbitkan saat kasir selesai transaksi.
  - Event `pos.order.refunded` diterbitkan saat ada pembatalan/pengembalian barang.
- **Consumer (`wms-service`)**:
  - Mendengarkan `pos.order.completed` via consumer group `wms-service-pos-events`.
  - Otomatis memotong kuantitas stok di gudang yang bersangkutan.
- **Producer (`billing-service`)**:
  - Menerbitkan `billing.payment.completed` dan `billing.payment.failed`.

### Dashboard Kafbat UI (`http://localhost:8080`)
Buka browser ke [http://localhost:8080](http://localhost:8080) untuk:
1. **Mengecek Daftar Topik**: Klik menu **Topics** untuk melihat topik `pos.order.completed`.
2. **Membaca Isi Pesan**: Klik topik -> Tab **Messages** untuk mengintip JSON payload order yang dikirim kasir secara live.
3. **Memeriksa Consumer Lag**: Klik menu **Consumers** -> pilih `wms-service-pos-events` untuk melihat apakah WMS lancar memproses pesan atau ada antrean tertunda.

---

## 4. MinIO S3 & MinIO Console (Object Storage)

Sistem penyimpanan berkas terdistribusi yang 100% kompatibel dengan API Amazon Web Services S3.

### Konfigurasi
- **S3 Endpoint (Backend)**: `http://localhost:9000`
- **Web Console (Developer)**: [http://localhost:9001](http://localhost:9001)
- **Bucket Default**: `app-uploads`
- **Kredensial**:
  - Username: `minioadmin`
  - Password: `minioadmin`

### Peran di Monorepo
- **`minio-file-service`**: Mengelola file upload, presigned URLs, MIME security checks.
- **`cms-service`**: Menyimpan aset media (gambar artikel, banner, dokumen CMS).

---

## 5. Mailpit (SMTP Server & Email Web UI)

Server email lokal zero-config untuk menguji pengiriman email verifikasi akun dan notifikasi.

### Konfigurasi
- **SMTP Port**: `localhost:1025` (tanpa autentikasi/password).
- **Web Inbox**: [http://localhost:8025](http://localhost:8025).

### Peran di Monorepo
- **`ums-service`**: Email verifikasi pendaftaran user, reset password, dan undangan member organisasi.
- **`notification-service`**: Dispatcher email transaksi/alert.

---

## 🛠️ Operasional & Perintah Harian

Semua perintah dapat dijalankan dari root repositori:

```bash
# 1. Menyalakan seluruh infrastruktur di background
bun run docker:up

# 2. Melihat status container dan healthcheck
docker compose -f docker/docker-compose.yml ps

# 3. Melihat log container secara real-time
bun run docker:logs
# Atau log service tertentu:
docker compose -f docker/docker-compose.yml logs -f kafka
docker compose -f docker/docker-compose.yml logs -f postgres

# 4. Mematikan seluruh infrastruktur (data tetap aman tersimpan)
bun run docker:down

# 5. HARD RESET: Menghapus seluruh database, volume, dan data cache (Fresh Install)
docker compose -f docker/docker-compose.yml down -v
```
