// src/seeders/permission.seeder.ts
import { PrismaClient } from "@prisma/client";

const PERMISSIONS = [
  // --- MODULE: POS (Kasir) ---
  {
    module: "POS",
    action: "READ",
    code: "POS_READ",
    description: "Melihat riwayat transaksi kasir",
  },
  {
    module: "POS",
    action: "CREATE",
    code: "POS_CREATE",
    description: "Melakukan transaksi/checkout pesanan",
  },
  {
    module: "POS",
    action: "UPDATE",
    code: "POS_UPDATE",
    description: "Mengubah status transaksi (Dapur/Selesai)",
  },
  {
    module: "POS",
    action: "REFUND",
    code: "POS_REFUND",
    description: "Mengajukan refund transaksi",
  },

  // --- MODULE: PRODUCT (Produk & Resep) ---
  {
    module: "PRODUCT",
    action: "READ",
    code: "PRODUCT_READ",
    description: "Melihat daftar produk & kategori",
  },
  {
    module: "PRODUCT",
    action: "CREATE",
    code: "PRODUCT_CREATE",
    description: "Menambah produk, varian, dan resep baru",
  },
  {
    module: "PRODUCT",
    action: "UPDATE",
    code: "PRODUCT_UPDATE",
    description: "Mengubah data produk & resep",
  },
  {
    module: "PRODUCT",
    action: "DELETE",
    code: "PRODUCT_DELETE",
    description: "Menghapus produk & kategori",
  },

  // --- MODULE: INVENTORY (Gudang & Stok) ---
  {
    module: "INVENTORY",
    action: "READ",
    code: "INVENTORY_READ",
    description: "Melihat stok bahan baku dan gudang",
  },
  {
    module: "INVENTORY",
    action: "CREATE",
    code: "INVENTORY_CREATE",
    description: "Menambah data material/bahan baku fisik",
  },
  {
    module: "INVENTORY",
    action: "UPDATE",
    code: "INVENTORY_UPDATE",
    description: "Update stok manual & surat jalan distribusi",
  },
  {
    module: "INVENTORY",
    action: "DELETE",
    code: "INVENTORY_DELETE",
    description: "Menghapus data bahan baku",
  },

  // --- MODULE: FINANCE (Arus Kas & Buku Kas) ---
  {
    module: "FINANCE",
    action: "READ",
    code: "FINANCE_READ",
    description: "Melihat buku arus kas (Cashflow)",
  },
  {
    module: "FINANCE",
    action: "CREATE",
    code: "FINANCE_CREATE",
    description: "Mencatat pengeluaran/pemasukan manual",
  },
  {
    module: "FINANCE",
    action: "APPROVE",
    code: "FINANCE_APPROVE",
    description: "Menyetujui request pengajuan refund",
  },

  // --- MODULE: EMPLOYEE (HR & Absensi) ---
  {
    module: "EMPLOYEE",
    action: "READ",
    code: "EMPLOYEE_READ",
    description: "Melihat daftar karyawan dan shift",
  },
  {
    module: "EMPLOYEE",
    action: "CREATE",
    code: "EMPLOYEE_CREATE",
    description: "Mendaftarkan karyawan & shift baru",
  },
  {
    module: "EMPLOYEE",
    action: "UPDATE",
    code: "EMPLOYEE_UPDATE",
    description: "Mengubah data karyawan & assign shift",
  },
  {
    module: "EMPLOYEE",
    action: "DELETE",
    code: "EMPLOYEE_DELETE",
    description: "Menghapus/menonaktifkan karyawan",
  },

  // --- MODULE: CRM (Member & Promosi) ---
  {
    module: "CRM",
    action: "READ",
    code: "CRM_READ",
    description: "Melihat data pelanggan dan promosi",
  },
  {
    module: "CRM",
    action: "CREATE",
    code: "CRM_CREATE",
    description: "Membuat member dan diskon/promo baru",
  },
  {
    module: "CRM",
    action: "UPDATE",
    code: "CRM_UPDATE",
    description: "Mengubah poin member & data promosi",
  },
  {
    module: "CRM",
    action: "DELETE",
    code: "CRM_DELETE",
    description: "Menghapus data member & promosi",
  },

  // --- MODULE: REPORT (Laporan & Analytics) ---
  {
    module: "REPORT",
    action: "READ",
    code: "REPORT_READ",
    description: "Melihat Dashboard KPI & Laporan Penjualan",
  },

  // --- MODULE: SETTING (Pengaturan Toko) ---
  {
    module: "SETTING",
    action: "READ",
    code: "SETTING_READ",
    description: "Melihat pengaturan aplikasi dan struk",
  },
  {
    module: "SETTING",
    action: "UPDATE",
    code: "SETTING_UPDATE",
    description: "Mengubah pengaturan, pajak, struk, dan payment gateway",
  },

  // --- MODULE: ROLE (Hak Akses) ---
  {
    module: "ROLE",
    action: "READ",
    code: "ROLE_READ",
    description: "Melihat daftar jabatan & hak akses",
  },
  {
    module: "ROLE",
    action: "CREATE",
    code: "ROLE_CREATE",
    description: "Membuat jabatan (Role) baru",
  },
  {
    module: "ROLE",
    action: "UPDATE",
    code: "ROLE_UPDATE",
    description: "Mengubah hak akses (Permissions) pada suatu jabatan",
  },
  {
    module: "ROLE",
    action: "DELETE",
    code: "ROLE_DELETE",
    description: "Menghapus jabatan",
  },
];

/**
 * Fungsi ini dijalankan dengan Prisma Client dari Tenant spesifik (Isolated DB)
 * Digunakan untuk mengisi tabel `permissions` agar tersedia saat pembuatan Role.
 */
export const seedPermissions = async (db: PrismaClient) => {
  console.log("Seeding Permissions...");
  for (const perm of PERMISSIONS) {
    await db.permission.upsert({
      where: { code: perm.code },
      update: {
        module: perm.module,
        action: perm.action,
        description: perm.description,
      },
      create: perm,
    });
  }
  console.log("Permissions seeded successfully.");
};
