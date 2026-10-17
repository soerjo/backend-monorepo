# Product Requirement Document (PRD): Core WMS (Warehouse Management System) Service

| Parameter | Keterangan |
| :--- | :--- |
| **Status** | Draft Ready for Review |
| **Target Client** | Back-office Web, Barcode Scanner Mobile/PDA, Asynchronous Event Consumer |
| **Integrasi Eksternal** | Auth Service (JWT), POS Service (via Event Broker), Purchasing/ERP (Opsional) |
| **Metode Alokasi Stok** | FIFO (*First In, First Out*) & FEFO (*First Expired, First Out*) |

---

## 1. Ringkasan & Tujuan Produk

### 1.1 Latar Belakang
Core WMS Service adalah layanan backend independen yang bertugas mengelola persediaan fisik, pergerakan barang, serta penataan hierarki penyimpanan (gudang pusat maupun outlet toko). Service ini didesain terpisah dari POS Service guna memastikan pemrosesan transaksi kasir tetap cepat dan tidak terbebani oleh kompleksitas logika inventaris (alokasi bin, pelacakan nomor batch, stok opname, dan mutasi barang antar-cabang).

### 1.2 Tujuan
* Mengelola hierarki lokasi penyimpanan multi-gudang dan multi-level (Warehouse $\rightarrow$ Zone $\rightarrow$ Rack $\rightarrow$ Bin).
* Menangani konsumsi event asinkron dari POS (`pos.order.completed` dan `pos.order.refunded`) secara idempotent.
* Menerapkan audit trail inventaris berbasis *immutable stock ledger* (kartu stok append-only).
* Mendukung alur masuk (*inbound*), pemindahan (*internal transfer*), penyesuaian (*stock adjustment*), dan keluar (*outbound*).

---

## 2. Cakupan Fitur (Functional Requirements)

### 2.1 Manajemen Hierarki Gudang & Lokasi
* **Hierarki Penyimpanan**:
  * **Warehouse**: Entitas fisik utama (Gudang Pusat/DC, Outlet Toko Cabang).
  * **Zone**: Area khusus (misal: Area Suhu Ruang, *Chilled*, Karantina/Barang Rusak, Area Display).
  * **Rack / Aisle**: Baris lorong atau rak bertingkat.
  * **Bin**: Satuan lokasi terkecil yang memiliki kode unik/barcode untuk pemindaian.
* **Klasifikasi Status Lokasi**:
  * `ACTIVE`: Siap dipakai untuk penyimpanan dan picking transaksi.
  * `QUARANTINE`: Khusus barang rusak, barang retur bermasalah, atau barang menunggu inspeksi QA.
  * `LOCKED`: Lokasi sedang dalam proses penghitungan stok opname fisik.

### 2.2 Inbound Management (Barang Masuk)
* **Goods Receipt (Penerimaan Barang)**:
  * Penerimaan berbasis nomor referensi Purchase Order (PO) atau Direct Inbound.
  * Pencatatan atribut kontrol mutu: Nomor Batch/Lot, Tanggal Kedaluwarsa (*Expiry Date*), dan Serial Number (opsional).
* **Putaway (Penempatan Barang)**:
  * Pemindahan barang dari area transit penerimaan (*Receiving Bay*) ke bin penyimpanan definitif.
  * Validasi kapasitas tampung bin sebelum konfirmasi penempatan.

### 2.3 Outbound & Integrasi Event POS
* **Konsumsi Event Penjualan POS (`pos.order.completed`)**:
  * WMS bertindak sebagai consumer event dari Message Broker (Kafka/RabbitMQ).
  * Deduksi stok di gudang/outlet terkait secara otomatis menggunakan strategi:
    * **FEFO**: Produk makanan/minuman/farmasi dengan tanggal kedaluwarsa terdekat diprioritaskan keluar lebih dahulu.
    * **FIFO**: Produk umum berdasarkan tanggal penerimaan barang terdahulu.
* **Konsumsi Event Retur POS (`pos.order.refunded`)**:
  * Menambah kembali unit stok ke area karantina atau area toko aktif berdasarkan flag kondisi barang (`SELLABLE` vs `DAMAGED`).
* **Store Requisition & Dispatch**:
  * Pembuatan dokumen Surat Jalan dan pengurangan stok gudang pusat untuk pemenuhan pesanan restock outlet toko.

### 2.4 Internal Movement & Stock Opname
* **Inter-Warehouse Transfer (Transfer Antar-Gudang)**:
  * Siklus mutasi: `REQUESTED` $\rightarrow$ `DISPATCHED` (stok berpindah ke akun *In-Transit*) $\rightarrow$ `RECEIVED` (stok bertambah di gudang tujuan).
* **Bin Transfer**:
  * Pemindahan internal antar-rak dalam satu fasilitas gudang yang sama.
* **Stock Opname (Adjustment)**:
  * Penyesuaian selisih hitung fisik vs saldo sistem.
  * Wajib mencantumkan kode alasan standard (contoh: *Shrinkage/Kehilangan*, *Expired*, *Sampling*, *Damage*).
  * Otorisasi persetujuan bertingkat (*Approval Flow*) untuk penyesuaian di atas nilai nominal tertentu.

### 2.5 Audit Trail & Kartu Stok (Stock Ledger)
* Setiap mutasi kuantitas wajib mencatat record kartu stok bersifat **append-only** (tidak boleh di-update atau di-delete).
* Formula pencatatan saldo berjalan:
  $$\text{Saldo Akhir} = \text{Saldo Awal} + \text{Qty Masuk} - \text{Qty Keluar}$$
* Peringatan stok minimum (*Safety Stock / Reorder Point Alert*).

---

## 3. Desain Skema Database (Relasional)

```
[warehouses] 1 ──── N [storage_bins]
                            │
                            ├── 1 ──── N [product_stocks]
                            │
                            └── 1 ──── N [stock_ledger]
```

### 3.1 Definisi Tabel Inti

#### `warehouses`
* `id` (UUID, Primary Key)
* `code` (Varchar(50), Unique, Indexed - misal: `WH-JKT-01`, `STORE-BDG-01`)
* `name` (Varchar(255), Not Null)
* `type` (Enum: `CENTRAL_DC`, `STORE_OUTLET`, `TRANSIT`)
* `address` (Text, Nullable)
* `is_active` (Boolean, Default true)
* `created_at`, `updated_at` (Timestamp)

#### `storage_bins`
* `id` (UUID, Primary Key)
* `warehouse_id` (UUID, Foreign Key ke `warehouses.id`)
* `bin_code` (Varchar(50), Unique per Warehouse - Indexed)
* `zone_name` (Varchar(50), Not Null - misal: `DRY`, `COLD`, `FRONT_STORE`)
* `aisle` (Varchar(20), Nullable)
* `rack` (Varchar(20), Nullable)
* `status` (Enum: `ACTIVE`, `QUARANTINE`, `LOCKED`)
* `created_at` (Timestamp)

#### `product_stocks`
* `id` (UUID, Primary Key)
* `warehouse_id` (UUID, Foreign Key ke `warehouses.id`)
* `bin_id` (UUID, Foreign Key ke `storage_bins.id`)
* `product_id` (UUID, Not Null, Indexed)
* `sku` (Varchar(100), Not Null, Indexed)
* `batch_number` (Varchar(100), Default '-')
* `expiry_date` (Date, Nullable, Indexed)
* `quantity_on_hand` (Decimal(15,3), Not Null, Default 0.000)
* `quantity_reserved` (Decimal(15,3), Not Null, Default 0.000)
* `updated_at` (Timestamp)

#### `stock_ledger` (Append-Only Audit Log)
* `id` (UUID, Primary Key)
* `transaction_time` (Timestamp, Not Null, Indexed)
* `warehouse_id` (UUID, Foreign Key ke `warehouses.id`)
* `bin_id` (UUID, Foreign Key ke `storage_bins.id`)
* `product_id` (UUID, Not Null)
* `sku` (Varchar(100), Not Null)
* `batch_number` (Varchar(100), Default '-')
* `change_quantity` (Decimal(15,3), Not Null) — nilai positif (masuk) atau negatif (keluar)
* `balance_after` (Decimal(15,3), Not Null)
* `reference_type` (Enum: `POS_SALE`, `POS_REFUND`, `INBOUND_PO`, `TRANSFER_OUT`, `TRANSFER_IN`, `STOCK_ADJUSTMENT`)
* `reference_id` (Varchar(100), Not Null, Indexed - misal Order ID, Transfer ID)
* `notes` (Text, Nullable)

#### `inbound_shipments`
* `id` (UUID, Primary Key)
* `shipment_no` (Varchar(50), Unique)
* `warehouse_id` (UUID, Foreign Key)
* `supplier_id` (UUID, Nullable)
* `reference_po_no` (Varchar(100), Nullable)
* `status` (Enum: `PENDING`, `PARTIAL`, `COMPLETED`, `CANCELLED`)
* `received_at` (Timestamp, Nullable)
* `created_at` (Timestamp)

#### `stock_transfers`
* `id` (UUID, Primary Key)
* `transfer_no` (Varchar(50), Unique)
* `origin_warehouse_id` (UUID, Foreign Key)
* `destination_warehouse_id` (UUID, Foreign Key)
* `status` (Enum: `DRAFT`, `IN_TRANSIT`, `COMPLETED`, `CANCELLED`)
* `dispatched_at` (Timestamp, Nullable)
* `received_at` (Timestamp, Nullable)

#### `processed_events` (Idempotent Consumer Guard)
* `event_id` (Varchar(100), Primary Key)
* `source_service` (Varchar(50), Value: `POS_SERVICE`)
* `event_type` (Varchar(50), Value: `ORDER_COMPLETED`, `ORDER_REFUNDED`)
* `processed_at` (Timestamp)

---

## 4. Mekanisme Event Broker & Idempotensi Consumer

```
[POS Service Engine]
        │
        ▼ (Publishes outbox event: pos.order.completed)
[Message Broker / Kafka / RabbitMQ]
        │
        ▼ (Consumes event message)
[WMS Consumer Worker]
        ├── Check duplicate: SELECT event_id FROM processed_events
        │     └── If exists: ACK and Skip (Prevent double deduction)
        ├── Begin DB Transaction
        ├── Deduct stock via FEFO/FIFO strategy using SELECT ... FOR UPDATE
        ├── Insert into stock_ledger (Append-only)
        ├── Record event_id into processed_events
        └── Commit DB Transaction
```

* **Penanganan Oversell / Stok Negatif**:
  * Apabila kasir POS berhasil menjual barang namun alokasi fisik di WMS bernilai 0 (contoh: selisih hitung fisik belum disesuaikan), sistem memindahkan pesan ke **Dead Letter Queue (DLQ)** dan memicu notifikasi tiket perbaikan inventaris tanpa membatalkan transaksi keuangan kasir.

---

## 5. Spesifikasi API Utama (RESTful)

### 5.1 Inbound Endpoints
* `POST /v1/inbound/receipts`: Mencatat barang masuk dari supplier atau transfer.
* `POST /v1/inbound/putaway`: Konfirmasi penempatan stok ke bin definitif.

### 5.2 Stock & Inventory Query Endpoints
* `GET /v1/inventory/on-hand`: Menampilkan saldo stok riil (bisa difilter per toko, SKU, atau batch).
* `GET /v1/inventory/ledger`: Menampilkan mutasi kartu stok riil untuk keperluan audit.
* `GET /v1/inventory/low-stock`: Daftar produk dengan kuantitas di bawah ambang batas minimum (*reorder point*).

### 5.3 Transfer & Penyesuaian Endpoints
* `POST /v1/transfers`: Inisiasi mutasi antar-gudang/toko.
* `POST /v1/transfers/:id/dispatch`: Konfirmasi keberangkatan barang.
* `POST /v1/transfers/:id/receive`: Konfirmasi penerimaan barang di toko tujuan.
* `POST /v1/inventory/adjustments`: Penyesuaian stok manual hasil stock opname.

---

## 6. Persyaratan Non-Fungsional (NFR)

1. **Integritas Konkurensi**:
   * Pengurangan stok wajib menggunakan mekanisme *row-level locking* (`SELECT FOR UPDATE`) atau *optimistic locking* berbasis nomor versi untuk mengeliminasi *race condition* saat ada transaksi massal bersamaan.
2. **Kinerja Konsumsi Event**:
   * Latensi pemrosesan event penjualan POS oleh consumer worker: P99 < 150 ms per pesan.
3. **Ketahanan Data Audit (Auditability)**:
   * Tabel `stock_ledger` tidak mengizinkan operasi `UPDATE` maupun `DELETE` di tingkat database privileges (hanya `INSERT` dan `SELECT`).
4. **Skalabilitas Lokasi**:
   * Mampu menangani hingga ratusan gudang dan ribuan slot bin tanpa degradasi performa query ketersediaan stok produk.