// import {
//   PrismaClient,
//   JobPosition,
//   DocumentFormat,
//   PaymentChannel,
// } from "@prisma/client";
// import * as bcrypt from "bcrypt";

// const prisma = new PrismaClient();

// async function main() {
//   console.log("🌱 Memulai proses seeding...");

//   // 1. Hapus data lama (Opsional, hati-hati jika di production)
//   // Karena relasi Tenant menggunakan onDelete: Cascade, menghapus tenant akan menghapus hampir semua data terkait.
//   await prisma.tenant.deleteMany();
//   await prisma.permission.deleteMany();

//   // 2. Buat Data Tenant Awal
//   const tenant = await prisma.tenant.create({
//     data: {
//       name: "EPS Kopi Nusantara",
//       email: "admin@gmail.com",
//       phone: "081234567890",
//       activeFeatures: ["INVENTORY", "QUEUE", "PAYMENT_GATEWAY"],
//     },
//   });
//   console.log(`✅ Tenant dibuat: ${tenant.name}`);

//   // 3. Setup Permissions (Hak Akses Master)
//   const permissionsData = [
//     // Modul Order
//     {
//       module: "ORDER",
//       action: "CREATE",
//       code: "ORDER_CREATE",
//       description: "Membuat pesanan baru",
//     },
//     {
//       module: "ORDER",
//       action: "READ",
//       code: "ORDER_READ",
//       description: "Melihat riwayat pesanan",
//     },
//     // Modul Inventory
//     {
//       module: "INVENTORY",
//       action: "CREATE",
//       code: "INVENTORY_CREATE",
//       description: "Menambah bahan baku & stok",
//     },
//     {
//       module: "INVENTORY",
//       action: "READ",
//       code: "INVENTORY_READ",
//       description: "Melihat stok gudang dan cabang",
//     },
//     // Modul Finance
//     {
//       module: "FINANCE",
//       action: "READ",
//       code: "FINANCE_READ",
//       description: "Melihat laporan keuangan dan cashflow",
//     },
//     // Modul Settings
//     {
//       module: "SETTINGS",
//       action: "UPDATE",
//       code: "SETTINGS_UPDATE",
//       description: "Mengubah pengaturan sistem",
//     },
//   ];

//   await prisma.permission.createMany({ data: permissionsData });
//   const allPermissions = await prisma.permission.findMany();
//   console.log("✅ Permissions master dibuat");

//   // 4. Setup Role (OWNER) dan Assign semua Permissions
//   const roleOwner = await prisma.role.create({
//     data: {
//       tenantId: tenant.id,
//       name: "Owner",
//       description: "Akses penuh ke seluruh sistem",
//     },
//   });

//   const rolePermissionsData = allPermissions.map((perm) => ({
//     roleId: roleOwner.id,
//     permissionId: perm.id,
//   }));
//   await prisma.rolePermission.createMany({ data: rolePermissionsData });
//   console.log(`✅ Role dibuat: ${roleOwner.name}`);

//   // 5. Setup Pengaturan Umum (General Setting)
//   await prisma.generalSetting.create({
//     data: {
//       tenantId: tenant.id,
//       appName: "EPS POS",
//       storeName: "EPS Kopi Nusantara",
//       taxRate: 11.0, // Pajak 11%
//       serviceChargeRate: 5.0, // Service Charge 5%
//       currencySymbol: "Rp",
//     },
//   });

//   // 6. Setup Gudang (Warehouse) dan Cabang (Branch)
//   const warehouse = await prisma.warehouse.create({
//     data: {
//       tenantId: tenant.id,
//       name: "Gudang Utama Pusat",
//       address: "Jl. Gudang Kopi No. 1, Bandung",
//     },
//   });

//   const branch = await prisma.branch.create({
//     data: {
//       tenantId: tenant.id,
//       name: "Cabang Utama Dago",
//       address: "Jl. Ir. H. Juanda No. 99, Bandung",
//       phone: "022-1234567",
//       enableOrderQueue: true,
//     },
//   });
//   console.log(`✅ Gudang dan Cabang dibuat`);

//   // 7. Setup Pengaturan Struk & Payment untuk Cabang
//   await prisma.receiptSetting.create({
//     data: {
//       branchId: branch.id,
//       documentFormat: DocumentFormat.RECEIPT,
//       storeName: "EPS KOPI DAGO",
//       footerMessage: "Terima kasih atas kunjungan Anda!",
//     },
//   });

//   await prisma.paymentIntegration.create({
//     data: {
//       branchId: branch.id,
//       channelType: PaymentChannel.BASIC, // Default basic, ubah ke GATEWAY jika API key midtrans sudah ada
//       isProduction: false,
//     },
//   });

//   // 8. Buat User Admin (Owner)
//   const hashedPassword = await bcrypt.hash("password123", 10);
//   const user = await prisma.user.create({
//     data: {
//       tenantId: tenant.id,
//       branchId: branch.id,
//       roleId: roleOwner.id,
//       email: "owner@gmail.com",
//       passwordHash: hashedPassword,
//       fullName: "Owner",
//       jobPosition: JobPosition.OWNER,
//       isActive: true,
//     },
//   });
//   console.log(`✅ User dibuat: ${user.email} (Password: password123)`);

//   // 9. Setup Inventory Master (Bahan Baku)
//   const materialKopi = await prisma.material.create({
//     data: {
//       tenantId: tenant.id,
//       name: "Biji Kopi Arabica",
//       unit: "Gram",
//       costPerUnit: 200, // Rp 200 per gram
//     },
//   });

//   const materialSusu = await prisma.material.create({
//     data: {
//       tenantId: tenant.id,
//       name: "Susu UHT Full Cream",
//       unit: "Mililiter",
//       costPerUnit: 20, // Rp 20 per ml
//     },
//   });

//   const materialCup = await prisma.material.create({
//     data: {
//       tenantId: tenant.id,
//       name: "Gelas Cup Plastik 16oz",
//       unit: "Pcs",
//       costPerUnit: 1500, // Rp 1500 per cup
//     },
//   });
//   console.log("✅ Master Bahan Baku (Materials) dibuat");

//   // Inject Stok Awal ke Gudang Pusat
//   await prisma.warehouseStock.createMany({
//     data: [
//       {
//         warehouseId: warehouse.id,
//         materialId: materialKopi.id,
//         quantity: 10000,
//       }, // 10 Kg Kopi
//       {
//         warehouseId: warehouse.id,
//         materialId: materialSusu.id,
//         quantity: 20000,
//       }, // 20 Liter Susu
//       { warehouseId: warehouse.id, materialId: materialCup.id, quantity: 1000 }, // 1000 Cup
//     ],
//   });

//   // Inject Stok Awal ke Cabang Dago (Simulasi sudah didistribusikan)
//   await prisma.branchMaterialStock.createMany({
//     data: [
//       { branchId: branch.id, materialId: materialKopi.id, quantity: 2000 }, // 2 Kg Kopi di cabang
//       { branchId: branch.id, materialId: materialSusu.id, quantity: 5000 }, // 5 Liter Susu di cabang
//       { branchId: branch.id, materialId: materialCup.id, quantity: 200 }, // 200 Cup di cabang
//     ],
//   });
//   console.log("✅ Stok Awal Gudang & Cabang disiapkan");

//   // 10. Setup Kategori & Produk
//   const categoryCoffee = await prisma.category.create({
//     data: {
//       tenantId: tenant.id,
//       name: "Kopi Susu",
//     },
//   });

//   const productKopiSusu = await prisma.product.create({
//     data: {
//       tenantId: tenant.id,
//       categoryId: categoryCoffee.id,
//       name: "Kopi Susu Gula Aren",
//       // Jika branchId null, artinya produk ini global (tersedia di semua cabang tenant tersebut)
//     },
//   });

//   // Buat Varian (Reguler & Large)
//   const variantReguler = await prisma.productVariant.create({
//     data: {
//       productId: productKopiSusu.id,
//       name: "Reguler (16oz)",
//       price: 25000,
//     },
//   });

//   // 11. Setup Resep (BOM - Pengurangan Otomatis)
//   // Untuk 1 Gelas Kopi Susu Aren Reguler membutuhkan: 18g Kopi, 150ml Susu, 1 Cup
//   await prisma.recipe.createMany({
//     data: [
//       {
//         variantId: variantReguler.id,
//         materialId: materialKopi.id,
//         quantityRequired: 18,
//       },
//       {
//         variantId: variantReguler.id,
//         materialId: materialSusu.id,
//         quantityRequired: 150,
//       },
//       {
//         variantId: variantReguler.id,
//         materialId: materialCup.id,
//         quantityRequired: 1,
//       },
//     ],
//   });
//   console.log("✅ Produk, Varian, dan Resep (BOM) berhasil dikonfigurasi");

//   console.log("🎉 Seeding Selesai!");
// }

// main()
//   .catch((e) => {
//     console.error("❌ Gagal melakukan seeding:", e);
//   })
//   .finally(async () => {
//     await prisma.$disconnect();
//   });
