// src/middlewares/tenant.middleware.ts
import { Request, Response, NextFunction } from "express";
import { getTenantDb } from "../lib/tenant-db";
import { PrismaClient } from "@prisma/client";

// Global Type Override agar TypeScript mengenali req.tenantSlug dan req.db
declare global {
  namespace Express {
    interface Request {
      tenantSlug: string;
      db: PrismaClient;
      // Memindahkan informasi user JWT dari middleware auth agar menyatu
      user?: {
        id: string;
        tenantId: string;
        branchId: string | null;
        roleId: string;
        email: string;
      };
    }
  }
}

// Fungsi cerdas untuk mengekstrak Slug Tenant dari berbagai skenario
export function extractTenantSlug(req: Request): string {
  // 1. PRIORITAS UTAMA: Custom Header dari Frontend
  // Frontend POS saat fetch API harus menyelipkan header { "x-tenant-slug": "kopisenja" }
  const headerSlug = req.headers["x-tenant-slug"];
  if (headerSlug && typeof headerSlug === "string") {
    return headerSlug;
  }

  // 2. FALLBACK 1: Baca dari Origin Browser (Jika Frontend tidak kirim custom header)
  // Contoh Origin: "https://kopisenja.epspos.com" -> akan diambil "kopisenja"
  const origin = req.headers.origin;
  if (origin) {
    try {
      const url = new URL(origin);
      return url.hostname.split(".")[0];
    } catch (e) {
      // Abaikan error parsing URL, lanjut ke fallback berikutnya
    }
  }

  // 3. FALLBACK 2: Baca dari Host (Berguna jika Anda testing API langsung via Postman)
  // Contoh Host: "kopisenja.api.epspos.com" -> akan diambil "kopisenja"
  const host = req.headers.host;
  if (host) {
    return host.split(":")[0].split(".")[0];
  }

  throw new Error("Cannot resolve tenant slug from request parameters");
}

export async function tenantMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
) {
  try {
    // Jalankan ekstraktor cerdas
    const slug = extractTenantSlug(req);

    // Filter keamanan (Opsional: hindari request nyasar dari localhost murni ke production)
    if (!slug || slug === "www" || slug === "api") {
      throw new Error("Invalid tenant subdomain");
    }

    // Minta koneksi DB ke Control Plane berdasarkan Slug tersebut
    const db = await getTenantDb(slug);

    req.tenantSlug = slug;
    req.db = db;

    next();
  } catch (err: any) {
    console.error("[Tenant Middleware Error]:", err.message);
    res.status(400).json({
      success: false,
      error: "Invalid or unknown tenant. Please check your Tenant ID/URL.",
    });
  }
}
