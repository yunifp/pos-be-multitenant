// src/controllers/tenant.controller.ts
import { Request, Response } from "express";
import { generateInternalToken } from "../lib/internal-auth";
import { extractTenantSlug } from "../middlewares/tenant.middleware";

export async function checkTenantStatus(req: Request, res: Response) {
  try {
    let slug: string;

    // 1. Ekstrak slug menggunakan fungsi pintar dari middleware
    try {
      slug = extractTenantSlug(req);
    } catch (err: any) {
      return res.status(400).json({
        success: false,
        message: err.message || "Gagal mendapatkan slug tenant.",
      });
    }

    // Filter slug invalid (domain root atau API murni)
    if (!slug || slug === "www" || slug === "api") {
      return res.status(400).json({
        success: false,
        message: "Invalid tenant slug",
      });
    }

    console.log(`[CheckTenant API] Mengecek status untuk slug: "${slug}"`);

    const controlPlaneUrl = process.env.CONTROL_PLANE_URL;
    if (!controlPlaneUrl) {
      throw new Error("FATAL: CONTROL_PLANE_URL is not defined in .env");
    }

    // 2. Buat token internal & Fetch ke Control Plane
    const token = generateInternalToken(slug);
    const endpoint = `${controlPlaneUrl}/api/internal/check-slug?slug=${encodeURIComponent(slug)}`;

    const response = await fetch(endpoint, {
      headers: { "x-internal-token": token },
      signal: AbortSignal.timeout(5000), // Timeout 5 detik
    });

    const jsonResponse = await response.json().catch(() => ({}));

    if (!response.ok || !jsonResponse.success) {
      console.error(
        `[CheckTenant API] Gagal fetch ke Control Plane:`,
        jsonResponse,
      );
      return res.status(500).json({
        success: false,
        message: "Gagal memverifikasi tenant dengan Control Plane",
      });
    }

    // 3. Evaluasi hasil dari Control Plane
    const { exists, isActive } = jsonResponse.data;

    // Skenario A: Slug tidak terdaftar sama sekali
    if (!exists) {
      console.log(`[CheckTenant API] Tenant "${slug}" tidak ditemukan (404).`);
      return res.status(404).json({
        success: false,
        message: "Tenant tidak ditemukan.",
        data: { exists: false },
      });
    }

    // Skenario B: Slug terdaftar tapi dinonaktifkan (suspend/belum bayar)
    if (!isActive) {
      console.log(`[CheckTenant API] Tenant "${slug}" dinonaktifkan.`);
      return res.status(403).json({
        success: false,
        message: "Tenant sedang tidak aktif (Inactive).",
        tenantIsActive: false, // Flag khusus untuk dibaca Frontend
        data: { exists: true, isActive: false },
      });
    }

    // Skenario C: Slug Valid & Aktif
    console.log(`[CheckTenant API] Tenant "${slug}" valid dan aktif!`);
    return res.status(200).json({
      success: true,
      message: "Tenant valid dan siap digunakan.",
      tenantIsActive: true,
      data: { slug, exists: true, isActive: true },
    });
  } catch (error: any) {
    console.error("[CheckTenant API Error]:", error.message);
    return res.status(500).json({
      success: false,
      message: "Terjadi kesalahan internal saat mengecek tenant.",
    });
  }
}
