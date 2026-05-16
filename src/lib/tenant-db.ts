// src/lib/tenant-db.ts
import { PrismaClient } from "@prisma/client";
import { generateInternalToken } from "./internal-auth";
import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

// ==========================================
// KONFIGURASI ENKRIPSI & DEKRIPSI
// ==========================================
const ALG = "aes-256-gcm";

// Fungsi Decrypt (Sangat penting untuk mengekstrak dbUrl dari Control Plane)
export function decryptDbConfig(stored: string): string {
  if (!process.env.DB_CONFIG_SECRET)
    throw new Error("FATAL: DB_CONFIG_SECRET is missing");
  const KEY = Buffer.from(process.env.DB_CONFIG_SECRET, "hex");
  const [ivB64, tagB64, encB64] = stored.split(":");
  const iv = Buffer.from(ivB64, "base64");
  const tag = Buffer.from(tagB64, "base64");
  const enc = Buffer.from(encB64, "base64");
  const decipher = createDecipheriv(ALG, KEY, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(enc), decipher.final()]).toString(
    "utf8",
  );
}

// ==========================================
// MANAJEMEN CACHE KONEKSI TENANT
// ==========================================
interface CacheEntry {
  client: PrismaClient;
  expiresAt: number;
}

const cache = new Map<string, CacheEntry>();

export async function getTenantDb(slug: string): Promise<PrismaClient> {
  console.log(
    `\n[TenantDB-Debug] [1] Memulai request database untuk tenant: "${slug}"`,
  );

  const cached = cache.get(slug);
  if (cached && cached.expiresAt > Date.now()) {
    console.log(
      `[TenantDB-Debug] [2a] Cache HIT! Koneksi untuk "${slug}" masih valid. Menggunakan koneksi lama.`,
    );
    return cached.client;
  }

  console.log(
    `[TenantDB-Debug] [2b] Cache MISS atau EXPIRED untuk "${slug}". Mempersiapkan koneksi baru...`,
  );

  // Jika cache expired tapi masih ada koneksi lama, diskonek dulu agar tidak memory leak
  if (cached) {
    console.log(
      `[TenantDB-Debug] [3] Memutus koneksi Prisma lama yang sudah expired untuk "${slug}"...`,
    );
    await cached.client.$disconnect().catch((err) => {
      console.error(
        `[TenantDB-Debug] [3x] Error saat memutus koneksi lama:`,
        err,
      );
    });
  }

  console.log(
    `[TenantDB-Debug] [4] Membuat internal token auth untuk request ke Control Plane...`,
  );
  const token = generateInternalToken(slug);
  const controlPlaneUrl = process.env.CONTROL_PLANE_URL;

  if (!controlPlaneUrl) {
    console.error(
      `[TenantDB-Debug] [FATAL] CONTROL_PLANE_URL tidak ditemukan di file .env!`,
    );
    throw new Error("FATAL: CONTROL_PLANE_URL is not defined in .env");
  }

  const endpoint = `${controlPlaneUrl}/api/internal/tenant-config?slug=${encodeURIComponent(slug)}`;
  console.log(`[TenantDB-Debug] [5] Melakukan fetch API ke URL: ${endpoint}`);

  try {
    const res = await fetch(endpoint, {
      headers: { "x-internal-token": token },
      signal: AbortSignal.timeout(5000), // Timeout 5 detik agar request tidak gantung
    });

    console.log(
      `[TenantDB-Debug] [6] Menerima response HTTP dari Control Plane. Status: ${res.status} ${res.statusText}`,
    );

    // Ekstrak JSON mentah terlebih dahulu untuk di-log
    const jsonResponse = await res.json().catch(() => ({}));

    // LAMPIRAN LOG SELURUH RESPONSE API
    console.log(
      `[TenantDB-Debug] [7] Isi FULL Response API dari Control Plane:`,
      JSON.stringify(jsonResponse, null, 2),
    );

    if (!res.ok || !jsonResponse.success) {
      console.error(`[TenantDB-Debug] [7x] Fetch Gagal atau Success=False!`);
      throw new Error(
        `Failed to get tenant config: ${jsonResponse.message || res.statusText}`,
      );
    }

    // Ekstrak dari struktur { data: { tenantId, dbUrl, ttl } }
    const { tenantId, dbUrl: encryptedDbUrl, ttl } = jsonResponse.data;

    console.log(
      `[TenantDB-Debug] [8] Data berhasil diekstrak. TenantID: ${tenantId}, TTL: ${ttl} detik. Memulai proses DEKRIPSI...`,
    );

    // Proses Dekripsi
    const decryptedDbUrl = decryptDbConfig(encryptedDbUrl);
    console.log(
      `[TenantDB-Debug] [9] Dekripsi dbUrl berhasil dilakukan! ${decryptedDbUrl}`,
    );

    console.log(
      `[TenantDB-Debug] [10] Inisiasi instance PrismaClient baru untuk tenant "${slug}" dengan URL yang telah didekripsi...`,
    );

    // Inisiasi koneksi ke Database Spesifik milik Tenant
    const client = new PrismaClient({
      datasources: { db: { url: decryptedDbUrl } },
    });

    console.log(
      `[TenantDB-Debug] [11] Menyimpan instance Prisma ke dalam Cache Memory...`,
    );
    cache.set(slug, {
      client,
      expiresAt: Date.now() + ttl * 1000, // Menghitung waktu kadaluwarsa berdasarkan TTL (detik)
    });

    console.log(
      `[TenantDB-Debug] [12] SELESAI! PrismaClient untuk tenant "${slug}" siap digunakan dengan aman.\n`,
    );
    return client;
  } catch (error) {
    console.error(
      `[TenantDB-Debug] [ERROR FATAL] Terjadi kegagalan di getTenantDb untuk "${slug}":`,
      error,
    );
    throw error;
  }
}
