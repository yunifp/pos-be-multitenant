// src/controllers/role.controller.ts
import { Request, Response } from "express";

export interface AuthRequest extends Request {
  user?: {
    id: string;
    tenantId: string;
    branchId: string | null;
    roleId: string;
    email: string;
  };
}

// [GET] Ambil Semua Daftar Izin Statis (Untuk ditampilkan di Form Builder Checkbox Frontend)
export const getPermissions = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    const db = req.db;
    const permissions = await db.permission.findMany({
      orderBy: [{ module: "asc" }, { action: "asc" }],
    });

    res.status(200).json({
      success: true,
      data: permissions,
      message: "Daftar Permissions berhasil diambil",
    });
  } catch (error) {
    console.log("ERROR", error);
    res
      .status(500)
      .json({ success: false, message: "Terjadi kesalahan server", error });
  }
};

// [GET] Ambil Semua Role
export const getRoles = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    const db = req.db;
    const tenantId = req.user!.tenantId;

    const roles = await db.role.findMany({
      where: { tenantId },
      include: {
        _count: { select: { users: true } }, // Menghitung berapa karyawan yang pakai role ini
        permissions: {
          include: { permission: true },
        },
      },
      orderBy: { name: "asc" },
    });

    // Formatting agar JSON lebih rapi (menyederhanakan array permissions)
    const formattedRoles = roles.map((role) => ({
      ...role,
      permissions: role.permissions.map((rp) => rp.permission),
    }));

    res.status(200).json({
      success: true,
      data: formattedRoles,
      message: "Daftar Role berhasil diambil",
    });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: "Terjadi kesalahan server", error });
  }
};

// [GET] Ambil Detail 1 Role
export const getRoleById = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    const db = req.db;
    const tenantId = req.user!.tenantId;
    const roleId = req.params.id;

    const role = await db.role.findFirst({
      where: { id: String(roleId), tenantId },
      include: {
        permissions: {
          include: { permission: true },
        },
      },
    });

    if (!role) {
      res.status(404).json({ success: false, message: "Role tidak ditemukan" });
      return;
    }

    const formattedRole = {
      ...role,
      permissions: role.permissions.map((rp) => rp.permission),
    };

    res.status(200).json({
      success: true,
      data: formattedRole,
      message: "Detail Role berhasil diambil",
    });
  } catch (error) {
    console.log("ERROR", error);
    res
      .status(500)
      .json({ success: false, message: "Terjadi kesalahan server", error });
  }
};

// [POST] Buat Role Baru + Assign Hak Akses
export const createRole = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    const db = req.db;
    const tenantId = req.user!.tenantId;

    // permissionIds adalah array string berisi ID dari tabel Permission (Cth: ["uuid-1", "uuid-2"])
    const { name, description, permissionIds } = req.body;

    // Cek duplikasi nama role
    const existingRole = await db.role.findFirst({
      where: { name, tenantId },
    });

    if (existingRole) {
      res
        .status(400)
        .json({ success: false, message: "Nama Role sudah digunakan" });
      return;
    }

    const newRole = await db.role.create({
      data: {
        tenantId,
        name,
        description,
        permissions: {
          create: permissionIds.map((id: string) => ({
            permissionId: id,
          })),
        },
      },
      include: {
        permissions: { include: { permission: true } },
      },
    });

    res.status(201).json({
      success: true,
      data: newRole,
      message: "Role berhasil dibuat",
    });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: "Terjadi kesalahan server", error });
  }
};

// [PUT] Update Role & Ubah Hak Akses
export const updateRole = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    const db = req.db;
    const tenantId = req.user!.tenantId;
    const roleId = req.params.id;
    const { name, description, permissionIds } = req.body;

    const existingRole = await db.role.findFirst({
      where: { id: String(roleId), tenantId },
    });

    if (!existingRole) {
      res.status(404).json({ success: false, message: "Role tidak ditemukan" });
      return;
    }

    // Menggunakan transaksi agar penghapusan dan penambahan permission sinkron
    const updatedRole = await db.$transaction(async (tx) => {
      // 1. Update data dasar role
      const role = await tx.role.update({
        where: { id: String(roleId) },
        data: { name, description },
      });

      // 2. Jika permissionIds dikirim, kita hapus relasi lama dan masukkan yang baru (Sync)
      if (permissionIds && Array.isArray(permissionIds)) {
        await tx.rolePermission.deleteMany({
          where: { roleId: String(roleId) },
        });

        await tx.rolePermission.createMany({
          data: permissionIds.map((permId: string) => ({
            roleId: String(roleId),
            permissionId: permId,
          })),
        });
      }

      return role;
    });

    res.status(200).json({
      success: true,
      data: updatedRole,
      message: "Role beserta hak aksesnya berhasil diperbarui",
    });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: "Terjadi kesalahan server", error });
  }
};

// [DELETE] Hapus Role
export const deleteRole = async (
  req: AuthRequest,
  res: Response,
): Promise<void> => {
  try {
    const db = req.db;
    const tenantId = req.user!.tenantId;
    const roleId = req.params.id;

    // Jangan izinkan menghapus role 'Owner' default (Optional safety guard)
    const existingRole = await db.role.findFirst({
      where: { id: String(roleId), tenantId },
      include: { _count: { select: { users: true } } },
    });

    if (!existingRole) {
      res.status(404).json({ success: false, message: "Role tidak ditemukan" });
      return;
    }

    // Proteksi: Tidak boleh menghapus role yang masih digunakan oleh user/karyawan
    if (existingRole._count.users > 0) {
      res.status(400).json({
        success: false,
        message: `Tidak dapat menghapus Role ini karena masih digunakan oleh ${existingRole._count.users} karyawan.`,
      });
      return;
    }

    // Menghapus Role akan memicu Cascade delete pada tabel `RolePermission`
    await db.role.delete({
      where: { id: String(roleId) },
    });

    res.status(200).json({
      success: true,
      message: "Role berhasil dihapus",
    });
  } catch (error) {
    res
      .status(500)
      .json({ success: false, message: "Terjadi kesalahan server", error });
  }
};
