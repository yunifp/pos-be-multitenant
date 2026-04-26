import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// GET: Ambil Settings
export const getSettings = async (req: Request, res: Response) => {
  try {
    let settings = await prisma.generalSetting.findFirst();
    
    // Jika belum ada, buat default
    if (!settings) {
      settings = await prisma.generalSetting.create({
        data: {
          appName: 'EPS POS',
          storeName: 'Episode Store'
        }
      });
    }

    // [FIX] Base URL harus sesuai path folder upload
    // Format: http://localhost:3000/uploads/settings/filename.jpg
    const baseUrl = `${req.protocol}://${req.get('host')}/uploads/settings/`;
    
    return res.json({
      ...settings,
      logoUrl: settings.logoUrl ? baseUrl + settings.logoUrl : null,
      loginBgUrl: settings.loginBgUrl ? baseUrl + settings.loginBgUrl : null,
    });
  } catch (error) {
    return res.status(500).json({ message: 'Error fetching settings' });
  }
};

// PUT: Update Settings
export const updateSettings = async (req: Request, res: Response) => {
  try {
    const {
      appName, tagline, storeName,
      themePrimaryColor, themeSecondaryColor,
      taxRate, serviceChargeRate,
      address, phone, email,

      pointsPerAmount, pointsEarned, pointValue,
      minOrderToEarn, maxRedeemPercent, isActive
    } = req.body;

    // Type Casting untuk Multer Fields
    const files = req.files as { [fieldname: string]: Express.Multer.File[] } | undefined;
    
    let updateData: any = {
      appName,
      tagline,
      storeName,
      themePrimaryColor,
      themeSecondaryColor,
      address,
      phone,
      email,
      // Konversi string ke number (pastikan tidak NaN)
      taxRate: taxRate ? parseFloat(taxRate) : 0,
      serviceChargeRate: serviceChargeRate ? parseFloat(serviceChargeRate) : 0,

      pointsPerAmount: pointsPerAmount ? parseInt(pointsPerAmount) : undefined,
      pointsEarned: pointsEarned ? parseInt(pointsEarned) : undefined,
      pointValue: pointValue ? parseInt(pointValue) : undefined,
      minOrderToEarn: minOrderToEarn ? parseFloat(minOrderToEarn) : undefined,
      maxRedeemPercent: maxRedeemPercent ? parseInt(maxRedeemPercent) : undefined,
      // Handle Boolean dari form-data string
      isActive: isActive === 'true' || isActive === true ? true : false,
    };

    // [FIX] Handle File Upload
    // Pastikan files ada sebelum mengakses property-nya
    if (files) {
        if (files['logoUrl']?.[0]) {
            updateData.logoUrl = files['logoUrl'][0].filename;
        }
        if (files['loginBgUrl']?.[0]) {
            updateData.loginBgUrl = files['loginBgUrl'][0].filename;
        }
    }

    // Update Database (Selalu update row pertama)
    // Gunakan findFirst untuk mendapatkan ID, atau upsert
    const firstSetting = await prisma.generalSetting.findFirst();
    const id = firstSetting ? firstSetting.id : 1;

    // Gunakan upsert agar aman jika data kosong
    const settings = await prisma.generalSetting.upsert({
      where: { id: id },
      update: updateData,
      create: { ...updateData, appName: appName || 'EPS POS', storeName: storeName || 'My Store' } 
    });

    // Kembalikan data lengkap dengan URL gambar baru
    const baseUrl = `${req.protocol}://${req.get('host')}/uploads/settings/`;
    const responseData = {
        ...settings,
        logoUrl: settings.logoUrl ? baseUrl + settings.logoUrl : null,
        loginBgUrl: settings.loginBgUrl ? baseUrl + settings.loginBgUrl : null,
    };

    return res.json({ message: 'Settings updated successfully', settings: responseData });

  } catch (error) {
    console.error("Update Settings Error:", error);
    return res.status(500).json({ message: 'Error updating settings' });
  }
};