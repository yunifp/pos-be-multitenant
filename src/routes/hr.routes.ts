import { Router } from 'express';
import { getShifts, createShift, updateShift, deleteShift, getSchedules, assignManualSchedule, generateAutoSchedule,
    getTodayAttendance, clockIn, clockOut, getAttendanceHistory, getAttendanceReport,
    exportAttendanceToExcel
} from '../controllers/hr.controller';
import { authenticate, authorizeRole } from '../middlewares/auth.middleware';

const router = Router();
router.use(authenticate);

// SHIFT ROUTES
router.get('/shifts', authorizeRole(['OWNER', 'MANAGER']), getShifts);
router.post('/shifts', authorizeRole(['OWNER', 'MANAGER']), createShift);
router.put('/shifts/:id', authorizeRole(['OWNER', 'MANAGER']), updateShift); 
router.delete('/shifts/:id', authorizeRole(['OWNER', 'MANAGER']), deleteShift);

// SCHEDULE ROUTES
router.get('/schedules', authorizeRole(['OWNER', 'MANAGER']), getSchedules);
router.post('/schedules/manual', authorizeRole(['OWNER', 'MANAGER']), assignManualSchedule);
router.post('/schedules/auto', authorizeRole(['OWNER', 'MANAGER']), generateAutoSchedule);


// --- ATTENDANCE ROUTES ---
router.get('/attendance/today', getTodayAttendance); // Cek status hari ini
router.post('/attendance/in', clockIn);
router.post('/attendance/out', clockOut);
router.get('/attendance/history', getAttendanceHistory);
router.get('/attendance/report',authorizeRole(['OWNER', 'MANAGER']), getAttendanceReport);
router.get('/attendance/export', authorizeRole(['OWNER', 'MANAGER']), exportAttendanceToExcel);


export default router;