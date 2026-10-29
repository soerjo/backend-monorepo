# Dokumentasi Arsitektur & Alur Bisnis (Business Flow) ERP Core Service

**Service:** `erp-core-service`  
**Repository:** [soerjo/erp-core-service](https://github.com/soerjo/erp-core-service)  
**Port Default Deployment:** `3504`  
**Database:** `erp_db` (PostgreSQL 16)  
**Authentication & IAM Authority:** `ums-service` (SSO via RS256 JWKS)  
**Template Standar:** `soerjo/my-nestjs-template` (NestJS 11 + Prisma 6 + Bun + TypeScript nodenext)

---

## 1. Executive Overview

`erp-core-service` bertindak sebagai **Single Source of Truth (SSOT)** enterprise untuk transaksi operasional dan finansial. Service ini mengorkestrasikan empat pilar bisnis utama dan menghubungkannya dengan ekosistem microservices eksisting:

1. **UMS (`ums-service`):** Penyedia tunggal identitas pengguna dan Single Sign-On (SSO).
2. **POS (`pos-service`):** Penjualan ritel fisik toko.
3. **WMS (`wms-service`):** Manajemen gudang fisik, inbound receipt, dan outbound fulfillment.
4. **Billing (`billing-service`):** Manajemen penagihan faktur vendor (AP) dan pembayaran pelanggan (AR).

---

## 2. Alur Bisnis End-to-End (Business Flows)

```
+---------------------------------------------------------------------------------------------------+
|                                      SISTEM SSO PUSAT (UMS)                                       |
|                  Menerbitkan token RS256; diverifikasi stateless via JWKS oleh ERP Core           |
+---------------------------------------------------------------------------------------------------+

     [ 1. PROCURE-TO-PAY (P2P) ]                         [ 2. ORDER-TO-CASH (O2C) ]
 Vendor & Draf Purchase Order (PO)                   Transaksi Kasir Toko POS Selesai
                |                                                   |
                v                                                   v
   Approval PO oleh Finance (ERP)                  Webhook / Event POS Ingestion (ERP)
   - Status PO -> APPROVED                         - Deduplikasi Idempoten (posTransactionId)
   - Tulis Outbox: erp.po.approved                 - Buat Sales Order (PENDING)
                |                                  - Tulis Outbox: pos.transaction.ingested
                v                                                   |
   WMS Menerima Inbound ASN Dokumen                                 v
   & Memproses Penerimaan Barang                       WMS Menerima Order Fulfillment (DO)
                |
                v
   WMS Kirim Callback Goods Received
   (POST /api/v1/integration/wms/goods-received)
                |
                +------------------------------------+
                |                                    |
                v                                    v
     [ 3. FINANCIAL RECORDING ]             [ 4. BILLING INTEGRATION ]
   Otomatis Posting Jurnal Buku Besar       Outbox Event erp.goods_receipt.reconciled
   - Debit: Persediaan Barang (11300)       dikirim ke Billing Service untuk membuat
   - Credit: Hutang Usaha / AP (21100)      draf Faktur Hutang Usaha (AP Invoice)
   - Rule: sum(Debit) === sum(Credit)
```

---

### Flow 1: Procure-to-Pay (P2P) & Inbound Fulfillment

Alur pengadaan stok barang dari vendor luar hingga masuk gudang fisik:

1. **Pendaftaran Vendor:** Departemen procurement mendaftarkan data vendor melalui `POST /api/v1/procurement/vendors`.
2. **Pembuatan Purchase Order (PO):** Procurement membuat pesanan pembelian dengan status `DRAFT` melalui `POST /api/v1/procurement/orders`. Sistem otomatis menghitung subtotal baris item, kalkulasi pajak PPN 11%, dan total pembayaran.
3. **Persetujuan PO (Approval):** Finance Manager menyetujui PO melalui `POST /api/v1/procurement/orders/:id/approve`.
   - Status PO berubah menjadi `APPROVED`.
   - Sistem secara atomik menulis event `erp.po.approved` (dokumen _Advanced Shipping Notice / ASN_) ke tabel `outbox_events`.
4. **Eksekusi Fisik Gudang (WMS):** WMS menerima notifikasi ASN dan menunggu kedatangan truk/pengiriman barang fisik dari vendor.
5. **Konfirmasi Penerimaan Barang (GRN Callback):** Ketika barang selesai dibongkar dan diperiksa di gudang, WMS memanggil webhook `POST /api/v1/integration/wms/goods-received`.
   - ERP mencocokkan nomor PO dan memperbarui kuantitas barang masuk (`qtyReceived`).
   - Status PO diperbarui menjadi `PARTIALLY_RECEIVED` atau `COMPLETED`.
   - **Pencatatan Akuntansi Otomatis:** Sistem menerbitkan entri jurnal:
     - **Debit:** Akun 11300 (Persediaan Barang Dagang)
     - **Credit:** Akun 21100 (Hutang Usaha / Accounts Payable)
   - **Pemicuan Tagihan (AP):** Sistem menulis event `erp.goods_receipt.reconciled` ke Outbox untuk memicu pembuatan jadwal pembayaran tagihan di Billing Service.

---

### Flow 2: Order-to-Cash (O2C) & POS Sales Aggregation

Alur agregasi transaksi penjualan kasir toko ke buku besar terpusat:

1. **Transaksi POS:** Pelanggan berbelanja di kasir toko fisik (POS). Setelah struk tercetak dan pembayaran diterima (Cash/QRIS/Card), POS mengirim webhook `POST /api/v1/sales/pos-sync`.
2. **Idempotent Ingestion:**
   - ERP memeriksa apakah `posTransactionId` sudah pernah diproses. Jika sudah ada, sistem langsung mengembalikan status respons `queued` idempoten tanpa membuat duplikasi order.
3. **Sales Order Creation:**
   - Sistem membuat dokumen _Sales Order_ (SO) resmi di ERP.
   - Jika ada SKU produk baru yang belum terdaftar di master ERP, sistem meng-auto-provision stub produk agar aliran transaksi kasir tidak terputus.
4. **Sinkronisasi Buku Besar & Gudang:**
   - ERP menerbitkan event `pos.transaction.ingested` ke Outbox.
   - Worker memicu entri jurnal pendapatan kasir (Debit: Kas Toko, Credit: Pendapatan Penjualan) serta meminta WMS memperbarui sisa stok barang toko.

---

### Flow 3: General Ledger & Double-Entry Bookkeeping

Aturan baku pencatatan finansial enterprise:

1. **Multi-tier Chart of Accounts (COA):**
   - Klasifikasi 5 tipe akun standar akuntansi: `ASSET`, `LIABILITY`, `EQUITY`, `REVENUE`, dan `EXPENSE`.
   - Pengelolaan akun melalui `POST /api/v1/accounting/coa` dan `GET /api/v1/accounting/coa`.
2. **Double-entry Balance Validation Engine:**
   - Setiap transaksi jurnal yang masuk melalui `POST /api/v1/accounting/journals` divalidasi dengan persamaan:
     $$\sum \text{Debit} = \sum \text{Credit}$$
   - Jika terjadi ketidakseimbangan ($\sum \text{Debit} \neq \sum \text{Credit}$), request ditolak secara tegas dengan kode HTTP `422 Unprocessable Entity` disertai pesan error selisih nilai balance.
3. **Append-Only Immutability:**
   - Baris jurnal buku besar bersifat _append-only_. Tidak ada update saldo akun in-place secara destruktif guna mencegah kondisi race condition / deadlock pada transaksi konkuren.

---

## 3. Arsitektur Keamanan & SSO UMS

Sesuai konsensus platform Mas Soerjo (`PLATFORM.md` Tier-0):

- **UMS (`ums-service`) adalah satu-satunya Identity Provider (IDP) & penerbit token.**
- **Stateless Token Verification:**
  - ERP Core menggunakan `UmsJwksService` untuk mengunduh public key RSA (algoritma `RS256`) langsung dari JWKS endpoint UMS (`UMS_JWKS_URL`) dengan in-memory cache TTL (`UMS_JWKS_CACHE_TTL_SECONDS`).
  - Jika UMS sementara unreachable saat startup, service otomatis fallback membaca kunci publik statis dari `UMS_JWT_PUBLIC_KEY` / `UMS_JWT_PUBLIC_KEY_PATH`.
- **Zero Database Coupling for Auth:**
  - Otorisasi token **tidak melakukan query baris user ke database lokal ERP**, mencegah jebakan `404 Not Found` bagi user yang sah.
  - Role (`@Roles()`) dan Granular Permissions (`@Permissions('erp.po.approve')`) dievaluasi secara murni di memori dari payload klaim JWT UMS.

---

## 4. Pola Reliabilitas: Transactional Outbox Pattern

Untuk mencegah fenomena _split-brain_ antara database relasional dan message broker:

1. Setiap aksi mutasi domain (approval PO, ingest transaksi POS, rekonsiliasi barang gudang) mencatat event bisnis ke tabel `outbox_events` di dalam transaksi database ACID (`prisma.$transaction`) yang sama dengan data bisnis.
2. Status event dicatat sebagai `PENDING`.
3. Background worker / relay mempublikasikan event ke broker Kafka/RabbitMQ (`pos.order.completed`, `erp.po.approved`, dsb) dan memperbarui status menjadi `PROCESSED`.

---

## 5. Ringkasan API Endpoints

| Modul            | Method | Endpoint                                 | Deskripsi                                   | Otorisasi / Guard                                      |
| ---------------- | ------ | ---------------------------------------- | ------------------------------------------- | ------------------------------------------------------ |
| **Auth Check**   | ANY    | All protected routes                     | Verifikasi Bearer token JWT RS256 UMS       | `JwtAuthGuard`                                         |
| **Accounting**   | `POST` | `/api/v1/accounting/coa`                 | Tambah akun COA baru                        | Permission: `erp.coa.create`                           |
|                  | `GET`  | `/api/v1/accounting/coa`                 | Ambil seluruh daftar COA                    | Permission: `erp.coa.view`                             |
|                  | `POST` | `/api/v1/accounting/journals`            | Catat & posting entri jurnal balanced       | Permission: `erp.journal.post` (HTTP 422 if imbalance) |
|                  | `GET`  | `/api/v1/accounting/journals/:id`        | Detail entri jurnal & baris debit/kredit    | Permission: `erp.journal.view`                         |
| **Procurement**  | `POST` | `/api/v1/procurement/vendors`            | Registrasi vendor baru                      | Permission: `erp.vendor.create`                        |
|                  | `GET`  | `/api/v1/procurement/vendors`            | List seluruh vendor                         | Permission: `erp.vendor.view`                          |
|                  | `POST` | `/api/v1/procurement/orders`             | Buat Purchase Order (DRAFT)                 | Permission: `erp.po.create`                            |
|                  | `GET`  | `/api/v1/procurement/orders/:id`         | Detail Purchase Order                       | Permission: `erp.po.view`                              |
|                  | `POST` | `/api/v1/procurement/orders/:id/approve` | Approve PO & generate ASN outbox event      | Permission: `erp.po.approve`                           |
| **Sales**        | `POST` | `/api/v1/sales/pos-sync`                 | Webhook ingest transaksi kasir POS          | `@Public()` / Machine Token (HTTP 202 Accepted)        |
| **Integration**  | `POST` | `/api/v1/integration/wms/goods-received` | Callback penerimaan barang fisik gudang WMS | `@Public()` / Internal Callback                        |
| **Health & Ops** | `GET`  | `/health`                                | Liveness & Readiness DB probe               | `@Public()`                                            |
|                  | `GET`  | `/metrics`                               | Prometheus metrics scrape                   | Raw Express handler                                    |
