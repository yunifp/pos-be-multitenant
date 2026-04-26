import { PrismaClient, Role, ShiftType, PromotionType } from '@prisma/client';
import * as bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting Seeding Process...');

  // --- 1. CLEANUP ---
  // Urutan delete penting karena foreign key constraints
  await prisma.receiptSetting.deleteMany(); // [BARU] Bersihkan setting struk
  await prisma.orderItem.deleteMany();
  await prisma.orderPromotion.deleteMany();
  await prisma.order.deleteMany();
  await prisma.employeeShift.deleteMany();
  await prisma.shift.deleteMany();
  await prisma.productStock.deleteMany();
  await prisma.inventoryStock.deleteMany();
  await prisma.promotionTarget.deleteMany();
  await prisma.promotion.deleteMany();
  await prisma.productVariant.deleteMany();
  await prisma.product.deleteMany();
  await prisma.category.deleteMany();
  await prisma.inventoryItem.deleteMany();
  await prisma.cashFlow.deleteMany();
  await prisma.attendance.deleteMany();
  await prisma.user.deleteMany();
  await prisma.branch.deleteMany();
  await prisma.generalSetting.deleteMany();

  console.log('🧹 Database cleaned.');

  // --- 2. GENERAL SETTINGS ---
  console.log('⚙️  Seeding General Settings...');
  await prisma.generalSetting.create({
    data: {
      appName: 'EPS POS',
      storeName: 'EPISODE KOPI',
      tagline: 'Smart Business System',
      taxRate: 11.0,
      serviceChargeRate: 5.0,
      currencySymbol: 'Rp',
      themePrimaryColor: '#4F46E5',
      themeSecondaryColor: '#0F172A',
      themeBackgroundColor: '#F3F4F6',
      address: 'Jl. Ks. Tubun No.22, Kejaksan, Cirebon',
      phone: '085174464404',
      email: 'admin@episodekopi.com',
      website: 'www.episodekopi.com',

      pointsPerAmount: 10000,
      pointsEarned: 1,
      pointValue: 1,
      minOrderToEarn: 0,
      maxRedeemPercent: 50,
      isActive: true,
    },
  });

  // --- 3. CREATE BRANCHES & RECEIPT SETTINGS ---
  console.log('🏢 Seeding Branches & Receipt Settings...');
  
  // Cabang Pusat
  const branchPusat = await prisma.branch.create({
    data: {
      name: 'Episode Kopi - Pusat',
      address: 'Jl. Ks. Tubun No.22, Kejaksan, Kec. Kejaksan, Kota Cirebon, Jawa Barat 45121',
      phone: '085174464404',
    },
  });

  // Cabang Arjawinangun
  const branchCabang = await prisma.branch.create({
    data: {
      name: 'Episode Kopi - Arjawinangun',
      address: 'Jl. Sutan Syahrir, Arjawinangun, Kec. Arjawinangun, Kabupaten Cirebon, Jawa Barat 45162',
      phone: '089603205121',
    },
  });

  // [BARU] SEEDER DEFAULT RECEIPT SETTINGS PER CABANG
  const branchIds = [branchPusat.id, branchCabang.id];

  for (const bId of branchIds) {
    const targetBranch = bId === branchPusat.id ? branchPusat : branchCabang;
    
    await prisma.receiptSetting.create({
      data: {
        branchId: bId,
        storeName: targetBranch.name.toUpperCase(),
        headerAddress: targetBranch.address,
        headerPhone: targetBranch.phone,
        headerTaxId: "01.234.567.8-901.000", // Contoh NPWP Default
        footerMessage: "Terima kasih atas kunjungan Anda!\nKritik & Saran: @episodekopi",
        showLogo: true,
        showCashierName: true,
        showCustomerName: true,
        showOrderType: true,
        showTableNumber: true,
        showVariantName: true,
        showItemDiscount: true,
        showPointsEarned: true,
        showBarcode: true,
        paperWidth: 58, // Standar printer thermal kecil
        fontSize: 'MEDIUM',
      }
    });
  }
  console.log('📄 Default Receipt Settings created for each branch.');

  // --- 4. CREATE USERS ---
  console.log('👥 Seeding Users...');
  const passwordHash = await bcrypt.hash('password123', 10);
  const pinHash = await bcrypt.hash('123456', 10);

  await prisma.user.create({
    data: {
      email: 'owner@episode.com',
      fullName: 'Owner Episode',
      passwordHash,
      pinHash,
      role: Role.OWNER,
      branchId: branchPusat.id,
    },
  });

  await prisma.user.create({
    data: {
      email: 'manager.pusat@episode.com',
      fullName: 'Manager Pusat',
      passwordHash,
      pinHash,
      role: Role.MANAGER,
      branchId: branchPusat.id,
    },
  });

  // --- 5. SHIFTS ---
  console.log('⏰ Seeding Shifts...');
  const shiftsData = [
    { name: 'Shift Pagi', startTime: '07:00', endTime: '15:00', type: ShiftType.MORNING },
    { name: 'Shift Siang', startTime: '12:00', endTime: '20:00', type: ShiftType.NOON },
    { name: 'Shift Malam', startTime: '15:00', endTime: '23:00', type: ShiftType.NIGHT },
  ];

  for (const s of shiftsData) {
    await prisma.shift.create({ data: { ...s, branchId: branchPusat.id } });
    await prisma.shift.create({ data: { ...s, branchId: branchCabang.id } });
  }

  console.log('✅ Seeding completed successfully!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });