-- CreateTable
CREATE TABLE `pengguna` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `nama` VARCHAR(100) NOT NULL,
    `email` VARCHAR(150) NOT NULL,
    `password_hash` VARCHAR(255) NOT NULL,
    `dibuat_pada` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    UNIQUE INDEX `pengguna_email_key`(`email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `jenis_akun` (
    `kode_akun` VARCHAR(10) NOT NULL,
    `nama_akun` VARCHAR(150) NOT NULL,
    `tipe_akun` VARCHAR(50) NOT NULL,
    `parent_kode` VARCHAR(10) NULL,
    `saldo_normal` VARCHAR(10) NOT NULL,
    `aktif` BOOLEAN NOT NULL DEFAULT true,

    PRIMARY KEY (`kode_akun`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `jenis_transaksi` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `kode` VARCHAR(10) NOT NULL,
    `nama_transaksi` VARCHAR(150) NOT NULL,
    `arah` ENUM('PEMASUKAN', 'PENGELUARAN') NOT NULL,
    `jenis_akun` VARCHAR(150) NULL,
    `unit_bisnis` VARCHAR(50) NULL,
    `is_bawaan` BOOLEAN NOT NULL DEFAULT false,
    `aktif` BOOLEAN NOT NULL DEFAULT true,
    `dibuat_oleh` INTEGER NULL,
    `dibuat_pada` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    UNIQUE INDEX `jenis_transaksi_kode_key`(`kode`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `kolom_custom` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `jenis_transaksi_id` INTEGER NOT NULL,
    `nama_kolom` VARCHAR(100) NOT NULL,
    `tipe_data` ENUM('TEKS', 'ANGKA', 'TANGGAL', 'DROPDOWN') NOT NULL,
    `opsi_dropdown` JSON NULL,
    `urutan` INTEGER NOT NULL DEFAULT 0,
    `aktif` BOOLEAN NOT NULL DEFAULT true,
    `dibuat_oleh` INTEGER NULL,
    `dibuat_pada` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    INDEX `kolom_custom_jenis_transaksi_id_idx`(`jenis_transaksi_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `data_pelanggan` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `kode` VARCHAR(20) NOT NULL,
    `nama` VARCHAR(150) NOT NULL,
    `status` VARCHAR(50) NULL,
    `alamat` VARCHAR(255) NULL,
    `kontak_person` VARCHAR(100) NULL,
    `telepon` VARCHAR(30) NULL,
    `bank_nama` VARCHAR(100) NULL,
    `rekening` VARCHAR(50) NULL,
    `saldo_piutang` DECIMAL(15, 2) NOT NULL DEFAULT 0,
    `keterangan` TEXT NULL,
    `dibuat_pada` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    UNIQUE INDEX `data_pelanggan_kode_key`(`kode`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `data_pemasok` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `kode` VARCHAR(20) NOT NULL,
    `nama` VARCHAR(150) NOT NULL,
    `alamat` VARCHAR(255) NULL,
    `kontak_person` VARCHAR(100) NULL,
    `telepon` VARCHAR(30) NULL,
    `bank_nama` VARCHAR(100) NULL,
    `rekening` VARCHAR(50) NULL,
    `saldo_hutang` DECIMAL(15, 2) NOT NULL DEFAULT 0,
    `keterangan` TEXT NULL,
    `dibuat_pada` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    UNIQUE INDEX `data_pemasok_kode_key`(`kode`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `produk` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `kode` VARCHAR(20) NOT NULL,
    `nama_barang` VARCHAR(100) NOT NULL,
    `varian` VARCHAR(100) NULL,
    `satuan` VARCHAR(20) NOT NULL DEFAULT 'pcs',
    `harga_default` DECIMAL(15, 2) NOT NULL DEFAULT 0,
    `aktif` BOOLEAN NOT NULL DEFAULT true,
    `dibuat_pada` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    UNIQUE INDEX `produk_kode_key`(`kode`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `transaksi` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `kode` VARCHAR(30) NOT NULL,
    `tanggal` DATE NOT NULL,
    `unit_bisnis` VARCHAR(50) NULL,
    `jenis_transaksi_id` INTEGER NOT NULL,
    `nama_transaksi` VARCHAR(150) NOT NULL,
    `detail` VARCHAR(255) NULL,
    `jenis_kas` VARCHAR(50) NULL,
    `nominal` DECIMAL(15, 2) NOT NULL,
    `debit` VARCHAR(150) NULL,
    `kredit` VARCHAR(150) NULL,
    `custom_data` JSON NULL,
    `pemasok_id` INTEGER NULL,
    `hutang_id` INTEGER NULL,
    `pelanggan_id` INTEGER NULL,
    `produk_id` INTEGER NULL,
    `jumlah` INTEGER NULL,
    `harga_satuan` DECIMAL(15, 2) NULL,
    `jumlah_bayar` DECIMAL(15, 2) NULL,
    `sisa_piutang` DECIMAL(15, 2) NULL,
    `sumber_order` VARCHAR(50) NULL,
    `sumber_input` ENUM('MANUAL', 'AI') NOT NULL DEFAULT 'MANUAL',
    `dibuat_oleh` INTEGER NOT NULL,
    `dibuat_pada` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `diubah_pada` DATETIME(0) NOT NULL,

    UNIQUE INDEX `transaksi_kode_key`(`kode`),
    INDEX `transaksi_tanggal_idx`(`tanggal`),
    INDEX `transaksi_jenis_transaksi_id_idx`(`jenis_transaksi_id`),
    INDEX `transaksi_unit_bisnis_idx`(`unit_bisnis`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `hutang` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `nama_kreditur` VARCHAR(150) NOT NULL,
    `jaminan` VARCHAR(150) NULL,
    `jumlah_pinjaman` DECIMAL(15, 2) NOT NULL,
    `tanggal_mulai` DATE NULL,
    `sisa_hutang` DECIMAL(15, 2) NOT NULL,
    `dibuat_pada` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `tabel_bebas` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `nama_tabel` VARCHAR(100) NOT NULL,
    `deskripsi` VARCHAR(255) NULL,
    `dibuat_oleh` INTEGER NOT NULL,
    `dibuat_pada` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    UNIQUE INDEX `tabel_bebas_nama_tabel_key`(`nama_tabel`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `kolom_tabel_bebas` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `tabel_bebas_id` INTEGER NOT NULL,
    `nama_kolom` VARCHAR(100) NOT NULL,
    `tipe_data` ENUM('TEKS', 'ANGKA', 'TANGGAL', 'DROPDOWN') NOT NULL,
    `opsi_dropdown` JSON NULL,
    `urutan` INTEGER NOT NULL DEFAULT 0,

    INDEX `kolom_tabel_bebas_tabel_bebas_id_idx`(`tabel_bebas_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `baris_tabel_bebas` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `tabel_bebas_id` INTEGER NOT NULL,
    `data` JSON NOT NULL,
    `dibuat_pada` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),
    `diubah_pada` DATETIME(0) NOT NULL,

    INDEX `baris_tabel_bebas_tabel_bebas_id_idx`(`tabel_bebas_id`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `log_audit` (
    `id` INTEGER NOT NULL AUTO_INCREMENT,
    `pengguna_id` INTEGER NOT NULL,
    `tabel_target` VARCHAR(50) NOT NULL,
    `target_id` INTEGER NULL,
    `aksi` ENUM('TAMBAH', 'UBAH', 'HAPUS') NOT NULL,
    `sumber` ENUM('MANUAL', 'AI') NOT NULL,
    `command` VARCHAR(50) NULL,
    `label_record` VARCHAR(150) NOT NULL,
    `detail` VARCHAR(255) NULL,
    `data_sebelum` TEXT NULL,
    `data_sesudah` TEXT NULL,
    `dibuat_pada` DATETIME(0) NOT NULL DEFAULT CURRENT_TIMESTAMP(0),

    INDEX `log_audit_tabel_target_idx`(`tabel_target`),
    INDEX `log_audit_sumber_idx`(`sumber`),
    INDEX `log_audit_dibuat_pada_idx`(`dibuat_pada`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `jenis_akun` ADD CONSTRAINT `jenis_akun_parent_kode_fkey` FOREIGN KEY (`parent_kode`) REFERENCES `jenis_akun`(`kode_akun`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `jenis_transaksi` ADD CONSTRAINT `jenis_transaksi_dibuat_oleh_fkey` FOREIGN KEY (`dibuat_oleh`) REFERENCES `pengguna`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `kolom_custom` ADD CONSTRAINT `kolom_custom_jenis_transaksi_id_fkey` FOREIGN KEY (`jenis_transaksi_id`) REFERENCES `jenis_transaksi`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `kolom_custom` ADD CONSTRAINT `kolom_custom_dibuat_oleh_fkey` FOREIGN KEY (`dibuat_oleh`) REFERENCES `pengguna`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `transaksi` ADD CONSTRAINT `transaksi_jenis_transaksi_id_fkey` FOREIGN KEY (`jenis_transaksi_id`) REFERENCES `jenis_transaksi`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `transaksi` ADD CONSTRAINT `transaksi_pemasok_id_fkey` FOREIGN KEY (`pemasok_id`) REFERENCES `data_pemasok`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `transaksi` ADD CONSTRAINT `transaksi_hutang_id_fkey` FOREIGN KEY (`hutang_id`) REFERENCES `hutang`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `transaksi` ADD CONSTRAINT `transaksi_pelanggan_id_fkey` FOREIGN KEY (`pelanggan_id`) REFERENCES `data_pelanggan`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `transaksi` ADD CONSTRAINT `transaksi_produk_id_fkey` FOREIGN KEY (`produk_id`) REFERENCES `produk`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `transaksi` ADD CONSTRAINT `transaksi_dibuat_oleh_fkey` FOREIGN KEY (`dibuat_oleh`) REFERENCES `pengguna`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `tabel_bebas` ADD CONSTRAINT `tabel_bebas_dibuat_oleh_fkey` FOREIGN KEY (`dibuat_oleh`) REFERENCES `pengguna`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `kolom_tabel_bebas` ADD CONSTRAINT `kolom_tabel_bebas_tabel_bebas_id_fkey` FOREIGN KEY (`tabel_bebas_id`) REFERENCES `tabel_bebas`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `baris_tabel_bebas` ADD CONSTRAINT `baris_tabel_bebas_tabel_bebas_id_fkey` FOREIGN KEY (`tabel_bebas_id`) REFERENCES `tabel_bebas`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `log_audit` ADD CONSTRAINT `log_audit_pengguna_id_fkey` FOREIGN KEY (`pengguna_id`) REFERENCES `pengguna`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
