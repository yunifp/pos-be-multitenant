// src/controllers/role.controller.ts
import { Request, Response } from "express";
import { generateInternalToken } from "../lib/internal-auth";
import { extractTenantSlug } from "../middlewares/tenant.middleware";

export interface AuthRequest extends Request {
  user?: {
    id: string;
    tenantId: string;
    branchId: string | null;
    roleId: string;
    email: string;
  };
}

// ============================================================================
// READ OPERATIONS (DIAMBIL DARI CONTROL PLANE API)
// ============================================================================

// [GET] Ambil Semua Daftar Izin Statis
export const getPermissions = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    console.log("[getPermissions] Memulai ekstraksi slug...");
    const slug = extractTenantSlug(req);
    console.log(`[getPermissions] Slug ditemukan: "${slug}"`);
    if (!slug) throw new Error("Invalid tenant slug");

    const controlPlaneUrl = process.env.CONTROL_PLANE_URL;
    if (!controlPlaneUrl)
      throw new Error("CONTROL_PLANE_URL is not defined di .env");

    const token = generateInternalToken(slug);
    const endpoint = `${controlPlaneUrl}/api/internal/tenant-permissions?slug=${encodeURIComponent(slug)}`;

    console.log(`[getPermissions] Fetching ke Control Plane: ${endpoint}`);
    const response = await fetch(endpoint, {
      headers: { "x-internal-token": token },
      signal: AbortSignal.timeout(5000),
    });

    const jsonResponse = await response.json().catch(() => ({}));
    console.log(
      "[getPermissions] Respon dari Control Plane diterima:",
      jsonResponse,
    );

    if (!response.ok) {
      res.status(response.status).json({
        success: false,
        message:
          jsonResponse.message ||
          "Gagal mengambil permissions dari Control Plane",
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: jsonResponse.data || jsonResponse,
      message: "Daftar Permissions berhasil diambil dari Control Plane",
    });
  } catch (error: any) {
    // MENAMPILKAN FULL ERROR STACK
    console.error("[getPermissions CRITICAL ERROR]:", error);
    res.status(500).json({
      success: false,
      message: "Terjadi kesalahan server (Controller Catch)",
      error: error.message,
    });
  }
};

// [GET] Ambil Semua Role
export const getRoles = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    console.log("[getRoles] Memulai ekstraksi slug...");
    const slug = extractTenantSlug(req);
    console.log(`[getRoles] Slug ditemukan: "${slug}"`);
    if (!slug) throw new Error("Invalid tenant slug");

    const controlPlaneUrl = process.env.CONTROL_PLANE_URL;
    if (!controlPlaneUrl)
      throw new Error("CONTROL_PLANE_URL is not defined di .env");

    const token = generateInternalToken(slug);
    const endpoint = `${controlPlaneUrl}/api/internal/tenant-roles?slug=${encodeURIComponent(slug)}`;

    console.log(`[getRoles] Fetching ke Control Plane: ${endpoint}`);
    const response = await fetch(endpoint, {
      headers: { "x-internal-token": token },
      signal: AbortSignal.timeout(5000),
    });

    const jsonResponse = await response.json().catch(() => ({}));
    console.log("[getRoles] Respon dari Control Plane diterima:", jsonResponse);

    if (!response.ok) {
      res.status(response.status).json({
        success: false,
        message:
          jsonResponse.message || "Gagal mengambil roles dari Control Plane",
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: jsonResponse.data || jsonResponse,
      message: "Daftar Role berhasil diambil dari Control Plane",
    });
  } catch (error: any) {
    // MENAMPILKAN FULL ERROR STACK
    console.error("[getRoles CRITICAL ERROR]:", error);
    res.status(500).json({
      success: false,
      message: "Terjadi kesalahan server (Controller Catch)",
      error: error.message,
    });
  }
};

// [GET] Ambil Detail 1 Role beserta Permissions-nya
export const getRoleById = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    console.log("[getRoleById] Memulai ekstraksi slug...");
    const slug = extractTenantSlug(req);
    if (!slug) throw new Error("Invalid tenant slug");

    const roleId = String(req.params.id);
    console.log(`[getRoleById] Slug: "${slug}", RoleID: "${roleId}"`);

    const controlPlaneUrl = process.env.CONTROL_PLANE_URL;
    if (!controlPlaneUrl)
      throw new Error("CONTROL_PLANE_URL is not defined di .env");

    const token = generateInternalToken(slug);
    const endpoint = `${controlPlaneUrl}/api/internal/tenant-permissions?slug=${encodeURIComponent(slug)}&roleId=${encodeURIComponent(roleId)}`;

    console.log(`[getRoleById] Fetching ke Control Plane: ${endpoint}`);
    const response = await fetch(endpoint, {
      headers: { "x-internal-token": token },
      signal: AbortSignal.timeout(5000),
    });

    const jsonResponse = await response.json().catch(() => ({}));
    console.log(
      "[getRoleById] Respon dari Control Plane diterima:",
      jsonResponse,
    );

    if (!response.ok) {
      res.status(response.status).json({
        success: false,
        message:
          jsonResponse.message ||
          "Gagal mengambil detail role dari Control Plane",
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: jsonResponse.data || jsonResponse,
      message: "Detail Role berhasil diambil dari Control Plane",
    });
  } catch (error: any) {
    // MENAMPILKAN FULL ERROR STACK
    console.error("[getRoleById CRITICAL ERROR]:", error);
    res.status(500).json({
      success: false,
      message: "Terjadi kesalahan server (Controller Catch)",
      error: error.message,
    });
  }
};
