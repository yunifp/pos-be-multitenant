import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { startOfDay, endOfDay, subMinutes } from 'date-fns';
import ExcelJS from 'exceljs';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';

const prisma = new PrismaClient();

// --- HELPER: HAVERSINE FORMULA (Hitung Jarak Meter) ---
function getDistanceFromLatLonInM(lat1: number, lon1: number, lat2: number, lon2: number) {
    const R = 6371; // Radius bumi (km)
    const dLat = deg2rad(lat2 - lat1);
    const dLon = deg2rad(lon2 - lon1);
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const d = R * c; // Jarak (km)
    return d * 1000; // Konversi ke Meter
}

function deg2rad(deg: number) {
    return deg * (Math.PI / 180);
}

// --- 1. SHIFT MANAGEMENT ---
export const getShifts = async (req: Request, res: Response) => {
    try {
        const user = (req as any).user;
        const { branchId } = req.query;
        let whereClause: any = {};

        if (user.role === 'OWNER') {
            if (branchId && branchId !== 'null') whereClause.branchId = branchId as string;
        } else {
            whereClause.branchId = user.branchId;
        }

        const shifts = await prisma.shift.findMany({
            where: whereClause,
            include: { branch: { select: { name: true } } },
            orderBy: { startTime: 'asc' }
        });
        return res.json(shifts);
    } catch (error) { return res.status(500).json({ message: "Gagal mengambil data shift" }); }
};

export const createShift = async (req: Request, res: Response) => {
    try {
        const user = (req as any).user;
        let { name, type, startTime, endTime, targetBranchIds } = req.body;
        let branchesToInsert: string[] = [];

        if (user.role === 'OWNER') {
            if (!targetBranchIds || targetBranchIds.length === 0) return res.status(400).json({ message: "Pilih cabang tujuan" });
            branchesToInsert = targetBranchIds;
        } else {
            branchesToInsert = [user.branchId];
        }

        await Promise.all(branchesToInsert.map(async (branchId) => {
            await prisma.shift.create({ data: { branchId, name, type, startTime, endTime } });
        }));
        return res.json({ message: "Shift berhasil dibuat" });
    } catch (error) { return res.status(500).json({ message: "Gagal membuat shift" }); }
};

export const updateShift = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        const { name, type, startTime, endTime } = req.body;
        await prisma.shift.update({ where: { id }, data: { name, type, startTime, endTime } });
        return res.json({ message: "Shift berhasil diperbarui" });
    } catch (error) { return res.status(500).json({ message: "Gagal update shift" }); }
};

export const deleteShift = async (req: Request, res: Response) => {
    try {
        const { id } = req.params;
        await prisma.shift.delete({ where: { id } });
        return res.json({ message: "Shift dihapus" });
    } catch (error) { return res.status(500).json({ message: "Gagal menghapus shift" }); }
};

// --- 2. SCHEDULE MANAGEMENT ---
export const getSchedules = async (req: Request, res: Response) => {
    try {
        const user = (req as any).user;
        const { date, branchId } = req.query;
        let whereClause: any = {};

        if (user.role === 'OWNER') {
            if (branchId) whereClause.user = { branchId: branchId as string };
        } else {
            whereClause.user = { branchId: user.branchId };
        }

        if (date) whereClause.date = new Date(date as string);

        const schedules = await prisma.employeeShift.findMany({
            where: whereClause,
            include: { user: { select: { id: true, fullName: true, branch: { select: { name: true } } } }, shift: true },
            orderBy: { date: 'asc' }
        });
        return res.json(schedules);
    } catch (error) { return res.status(500).json({ message: "Gagal mengambil jadwal" }); }
};

export const assignManualSchedule = async (req: Request, res: Response) => {
    try {
        const { userId, shiftId, date } = req.body;
        const shiftDate = new Date(date);
        const schedule = await prisma.employeeShift.upsert({
            where: { userId_date: { userId, date: shiftDate } },
            update: { shiftId },
            create: { userId, shiftId, date: shiftDate }
        });
        return res.json({ message: "Jadwal berhasil disimpan", schedule });
    } catch (error) { return res.status(500).json({ message: "Gagal mengatur jadwal" }); }
};

export const generateAutoSchedule = async (req: Request, res: Response) => {
    try {
        const user = (req as any).user;
        const { startDate, endDate, targetBranchId } = req.body;
        const branchId = user.role === 'OWNER' ? targetBranchId : user.branchId;
        if (!branchId) return res.status(400).json({ message: "Target cabang wajib dipilih" });

        const [employees, shifts] = await Promise.all([
            prisma.user.findMany({ where: { branchId, role: { not: 'OWNER' } }, orderBy: { fullName: 'asc' } }),
            prisma.shift.findMany({ where: { branchId }, orderBy: { startTime: 'asc' } })
        ]);

        if (shifts.length === 0 || employees.length === 0) return res.status(400).json({ message: "Data Karyawan/Shift kosong" });

        const start = new Date(startDate);
        const end = new Date(endDate);

        await prisma.employeeShift.deleteMany({
            where: { user: { branchId }, date: { gte: start, lte: end } }
        });

        const createData = [];
        for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
            const currentDate = new Date(d);
            const dayIndex = Math.floor((currentDate.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
            employees.forEach((emp, empIndex) => {
                const shiftIndex = (dayIndex + empIndex) % shifts.length;
                createData.push({ userId: emp.id, shiftId: shifts[shiftIndex].id, date: currentDate });
            });
        }

        await prisma.employeeShift.createMany({ data: createData });
        return res.json({ message: `Berhasil generate jadwal!` });
    } catch (error) { return res.status(500).json({ message: "Gagal generate jadwal otomatis" }); }
};

// --- 3. ATTENDANCE (ABSENSI + GEOFENCING) ---

export const getTodayAttendance = async (req: Request, res: Response) => {
    try {
        const userId = (req as any).user.id;
        const today = new Date();

        const start = startOfDay(today);
        const end = endOfDay(today);

        const schedule = await prisma.employeeShift.findFirst({
            where: {
                userId: userId,
                date: { gte: start, lte: end },
            },
            include: { shift: true },
        });

        const attendance = await prisma.attendance.findFirst({
            where: {
                userId: userId,
                clockIn: { gte: start, lte: end },
            },
        });

        return res.json({
            shift: schedule ? schedule.shift : null,
            attendance: attendance || null,
        });
    } catch (error) {
        return res.status(500).json({ message: "Gagal mengambil data kehadiran" });
    }
};

export const clockIn = async (req: Request, res: Response) => {
    try {
        const user = (req as any).user;
        const { location, photoUrl, notes, latitude, longitude } = req.body;
        const now = new Date();

        if (!latitude || !longitude) return res.status(400).json({ message: "GPS Wajib Aktif!" });

        const userWithBranch = await prisma.user.findUnique({ where: { id: user.id }, include: { branch: true } });
        if (!userWithBranch?.branch) return res.status(400).json({ message: "Anda tidak punya cabang." });

        const branch = userWithBranch.branch;

        if (branch.latitude !== 0 && branch.longitude !== 0) {
            const distance = getDistanceFromLatLonInM(parseFloat(latitude), parseFloat(longitude), branch.latitude, branch.longitude);
            const maxRadius = branch.radius > 0 ? branch.radius : 50;

            if (distance > maxRadius) {
                return res.status(403).json({
                    message: `Di Luar Area! Jarak: ${Math.round(distance)}m. Maks: ${maxRadius}m.`
                });
            }
        }

        // PERBAIKAN: Mencari jadwal menggunakan rentang tanggal hari ini
        const start = startOfDay(now);
        const end = endOfDay(now);

        const schedule = await prisma.employeeShift.findFirst({
            where: { 
                userId: user.id, 
                date: { gte: start, lte: end } 
            },
            include: { shift: true }
        });

        if (!schedule) return res.status(403).json({ message: "Tidak ada jadwal shift hari ini." });

        const [h, m] = schedule.shift.startTime.split(':');
        const shiftStart = new Date(now);
        shiftStart.setHours(parseInt(h), parseInt(m), 0, 0);

        const allowedStart = subMinutes(shiftStart, 60);
        if (now < allowedStart) {
            return res.status(403).json({ message: `Absen dibuka pukul ${allowedStart.toLocaleTimeString('id-ID')}` });
        }

        const existing = await prisma.attendance.findFirst({
            where: { userId: user.id, clockIn: { gte: start, lte: end } }
        });
        if (existing) return res.status(400).json({ message: "Sudah Clock-In hari ini!" });

        const toleranceTime = new Date(shiftStart.getTime() + 15 * 60000);
        const status = now > toleranceTime ? 'LATE' : 'PRESENT';

        await prisma.attendance.create({
            data: {
                userId: user.id,
                clockIn: now,
                status,
                location: location || "GPS",
                photoUrl,
                notes
            }
        });

        return res.json({ message: status === 'LATE' ? "Clock-In Berhasil (Terlambat)" : "Clock-In Berhasil" });

    } catch (error) {
        console.error(error);
        return res.status(500).json({ message: "Server Error Clock-In" });
    }
};

export const clockOut = async (req: Request, res: Response) => {
    try {
        const user = (req as any).user;
        const { latitude, longitude } = req.body;
        const now = new Date();

        if (!latitude || !longitude) return res.status(400).json({ message: "GPS Wajib Aktif!" });

        const userWithBranch = await prisma.user.findUnique({ where: { id: user.id }, include: { branch: true } });
        const branch = userWithBranch?.branch;

        if (branch && branch.latitude !== 0) {
            const distance = getDistanceFromLatLonInM(parseFloat(latitude), parseFloat(longitude), branch.latitude, branch.longitude);
            const maxRadius = branch.radius > 0 ? branch.radius : 50;

            if (distance > maxRadius) {
                return res.status(403).json({
                    message: `Clock Out Gagal! Anda di luar area (${Math.round(distance)}m).`
                });
            }
        }

        // PERBAIKAN: Filter berdasarkan clockIn (bukan createdAt)
        const start = startOfDay(now);
        const end = endOfDay(now);

        const existing = await prisma.attendance.findFirst({
            where: {
                userId: user.id,
                clockIn: { gte: start, lte: end },
                clockOut: null
            }
        });

        if (!existing) return res.status(400).json({ message: "Belum Clock-In atau Sudah Clock-Out." });

        await prisma.attendance.update({
            where: { id: existing.id },
            data: { clockOut: now }
        });

        return res.json({ message: "Clock-Out Berhasil. Hati-hati di jalan!" });

    } catch (error) {
        return res.status(500).json({ message: "Gagal Clock-Out" });
    }
};

export const getAttendanceHistory = async (req: Request, res: Response) => {
    try {
        const user = (req as any).user;
        const { startDate, endDate, userId } = req.query;
        let whereClause: any = {};

        if (startDate && endDate) {
            whereClause.clockIn = {
                gte: startOfDay(new Date(startDate as string)),
                lte: endOfDay(new Date(endDate as string))
            };
        }

        if (user.role === 'OWNER' || user.role === 'MANAGER') {
            if (userId) whereClause.userId = userId as string;
            if (user.role === 'MANAGER') whereClause.user = { branchId: user.branchId };
        } else {
            whereClause.userId = user.id;
        }

        const history = await prisma.attendance.findMany({
            where: whereClause,
            include: { user: { select: { fullName: true, branch: { select: { name: true } } } } },
            orderBy: { clockIn: 'desc' }
        });

        return res.json(history);
    } catch (error) { return res.status(500).json({ message: "Gagal ambil history" }); }
};



export const getAttendanceReport = async (req: Request, res: Response) => {
    try {
        const user = (req as any).user;
        const { startDate, endDate, branchId } = req.query;

        let whereClause: any = {
            clockIn: {
                gte: new Date(startDate as string),
                lte: new Date(endDate as string),
            }
        };

        if (user.role === 'OWNER') {
            // Jika Owner memilih 'all', jangan filter branchId (tampilkan semua)
            // Jika branchId tidak dikirim, gunakan default branch si Owner
            if (branchId === 'all') {
                // No branch filter
            } else {
                whereClause.user = { 
                    branchId: (branchId as string) || user.branchId 
                };
            }
        } else {
            // Manager dikunci ke cabangnya sendiri
            whereClause.user = { branchId: user.branchId };
        }

        const attendances = await prisma.attendance.findMany({
            where: whereClause,
            include: {
                user: {
                    select: {
                        fullName: true,
                        branch: { select: { name: true } }
                    }
                }
            },
            orderBy: { clockIn: 'desc' }
        });

        return res.json({
            stats: {
                total: attendances.length,
                late: attendances.filter(a => a.status === 'LATE').length,
                ontime: attendances.filter(a => a.status === 'PRESENT').length,
            },
            data: attendances
        });
    } catch (error) {
        res.status(500).json({ message: "Error fetching report" });
    }
};

export const exportAttendanceToExcel = async (req: Request, res: Response) => {
    try {
        const { startDate, endDate, branchId } = req.query;
        const user = (req as any).user;

        const start = new Date(startDate as string);
        const end = new Date(endDate as string);
        const periodeTeks = `${format(start, 'dd MMMM yyyy', { locale: id })} - ${format(end, 'dd MMMM yyyy', { locale: id })}`;

        let whereClause: any = {
            clockIn: { gte: startOfDay(start), lte: endOfDay(end) }
        };

        if (user.role === 'OWNER') {
            if (branchId && branchId !== 'all') whereClause.user = { branchId };
        } else {
            whereClause.user = { branchId: user.branchId };
        }

        const data = await prisma.attendance.findMany({
            where: whereClause,
            include: { user: { select: { fullName: true, branch: { select: { name: true } } } } },
            orderBy: [{ user: { fullName: 'asc' } }, { clockIn: 'asc' }]
        });

        const workbook = new ExcelJS.Workbook();
        const globalSummary = { HADIR: 0, TERLAMBAT: 0, IZIN: 0, 'TIDAK HADIR': 0 };
        const employeeSummary: { [key: string]: any } = {};

        // ==========================================
        // SHEET 1: DETAIL ABSENSI
        // ==========================================
        const detailSheet = workbook.addWorksheet('Detail Absensi');

        // 1. Header Judul & Periode
        detailSheet.mergeCells('A1:G1');
        detailSheet.mergeCells('A2:G2');
        const title = detailSheet.getCell('A1');
        const period = detailSheet.getCell('A2');

        title.value = 'LAPORAN DETAIL ABSENSI KARYAWAN';
        title.font = { bold: true, size: 16, color: { argb: 'FF1E293B' } }; // Slate 800
        title.alignment = { horizontal: 'center' };

        period.value = `Periode: ${periodeTeks}`;
        period.font = { italic: true, size: 11, color: { argb: 'FF64748B' } }; // Slate 500
        period.alignment = { horizontal: 'center' };

        detailSheet.addRow([]); // Gap baris 3

        // 2. Definisi Kolom & Header
        detailSheet.getRow(4).values = ['NO', 'NAMA KARYAWAN', 'CABANG', 'TANGGAL', 'JAM MASUK', 'JAM PULANG', 'STATUS'];
        detailSheet.columns = [
            { key: 'no', width: 6 },
            { key: 'name', width: 30 },
            { key: 'branch', width: 25 },
            { key: 'date', width: 15 },
            { key: 'in', width: 12 },
            { key: 'out', width: 12 },
            { key: 'status', width: 15 },
        ];

        // Style Header baris ke-4
        const headerRowDetail = detailSheet.getRow(4);
        headerRowDetail.height = 25;
        headerRowDetail.eachCell((cell) => {
            cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
            cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF4F46E5' } }; // Indigo 600
            cell.alignment = { horizontal: 'center', vertical: 'middle' };
            cell.border = {
                top: { style: 'thin' }, left: { style: 'thin' },
                bottom: { style: 'thin' }, right: { style: 'thin' }
            };
        });

        // 3. Render Data Detail
        data.forEach((item, index) => {
            const statusRaw = item.status?.toUpperCase() || 'LAINNYA';
            const statusTeks = statusRaw === 'LATE' ? 'TERLAMBAT' : statusRaw === 'PRESENT' ? 'HADIR' : statusRaw;
            const empName = item.user.fullName;

            // Update Summaries
            if (statusTeks === 'HADIR') globalSummary.HADIR++;
            else if (statusTeks === 'TERLAMBAT') globalSummary.TERLAMBAT++;

            if (!employeeSummary[empName]) {
                employeeSummary[empName] = { hadir: 0, telat: 0, branch: item.user.branch.name };
            }
            if (statusTeks === 'HADIR') employeeSummary[empName].hadir++;
            if (statusTeks === 'TERLAMBAT') employeeSummary[empName].telat++;

            const row = detailSheet.addRow([
                index + 1,
                empName,
                item.user.branch.name,
                format(new Date(item.clockIn), 'dd/MM/yyyy'),
                format(new Date(item.clockIn), 'HH:mm'),
                item.clockOut ? format(new Date(item.clockOut), 'HH:mm') : '-',
                statusTeks
            ]);

            // Styling setiap baris data
            row.eachCell((cell, colNum) => {
                cell.border = {
                    top: { style: 'thin' }, left: { style: 'thin' },
                    bottom: { style: 'thin' }, right: { style: 'thin' }
                };
                // Kolom NO, TANGGAL, JAM, STATUS dibuat Center
                if ([1, 4, 5, 6, 7].includes(colNum)) {
                    cell.alignment = { horizontal: 'center' };
                }
                // Pewarnaan Status
                if (colNum === 7) {
                    cell.font = { bold: true, color: { argb: statusTeks === 'TERLAMBAT' ? 'FFE11D48' : 'FF059669' } };
                }
            });
        });

        // ==========================================
        // SHEET 2: REKAPITULASI
        // ==========================================
        const summarySheet = workbook.addWorksheet('Rekapitulasi');

        // 1. Header Sheet Rekap
        summarySheet.mergeCells('A1:D1');
        summarySheet.getCell('A1').value = 'RINGKASAN KEHADIRAN KARYAWAN';
        summarySheet.getCell('A1').font = { bold: true, size: 14 };
        summarySheet.getCell('A1').alignment = { horizontal: 'center' };
        summarySheet.addRow([`Periode: ${periodeTeks}`]).alignment = { horizontal: 'center' };
        summarySheet.addRow([]);

        // 2. Tabel Rekap Per Karyawan
        summarySheet.addRow(['NAMA KARYAWAN', 'CABANG', 'HADIR (ON-TIME)', 'TERLAMBAT']);
        const headerRowSummary = summarySheet.getRow(4);
        headerRowSummary.font = { bold: true, color: { argb: 'FFFFFFFF' } };
        headerRowSummary.eachCell(c => {
            c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } }; // Slate 800
            c.border = { top: {style:'thin'}, bottom: {style:'thin'}, left: {style:'thin'}, right: {style:'thin'} };
        });

        summarySheet.columns = [
            { key: 'name', width: 30 }, { key: 'branch', width: 25 }, 
            { key: 'hadir', width: 15 }, { key: 'telat', width: 15 }
        ];

        Object.keys(employeeSummary).forEach(name => {
            const row = summarySheet.addRow([
                name, 
                employeeSummary[name].branch, 
                employeeSummary[name].hadir, 
                employeeSummary[name].telat
            ]);
            row.eachCell(c => {
                c.border = { top: {style:'thin'}, bottom: {style:'thin'}, left: {style:'thin'}, right: {style:'thin'} };
            });
        });

        summarySheet.addRow([]);

        // 3. Tabel Grand Total
        const totalStartRow = summarySheet.rowCount + 1;
        summarySheet.addRow(['TOTAL KESELURUHAN']).font = { bold: true };
        summarySheet.addRow(['TOTAL HADIR TEPAT WAKTU', '', '', globalSummary.HADIR]);
        summarySheet.addRow(['TOTAL TERLAMBAT', '', '', globalSummary.TERLAMBAT]);

        // ==========================================
        // SEND RESPONSE
        // ==========================================
        const fileName = `Lap_Absensi_${format(start, 'yyyy-MM-dd')}.xlsx`;
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.setHeader('Content-Disposition', `attachment; filename=${fileName}`);

        await workbook.xlsx.write(res);
        res.end();

    } catch (error) {
        console.error(error);
        res.status(500).json({ message: "Gagal memproses export excel" });
    }
};