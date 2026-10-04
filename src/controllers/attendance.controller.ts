import { Request, Response } from 'express';
import prisma from '../config/database';
import { AttendanceStatus } from '@prisma/client';

/**
 * Format durasi menit ke bentuk string "X jam Y menit"
 */
const formatDuration = (minutes: number): string => {
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  if (hours === 0) return `${remainingMinutes} menit`;
  if (remainingMinutes === 0) return `${hours} jam`;
  return `${hours} jam ${remainingMinutes} menit`;
};

/**
 * Endpoint Utama Kios Pemindai QR Absensi Toko Konveksi
 * Memproses Scan Masuk (Clock-in) dan Scan Pulang (Clock-out) secara otomatis
 */
export const scanQrCode = async (req: Request, res: Response): Promise<void> => {
  try {
    const { qrToken } = req.body;

    if (!qrToken) {
      res.status(400).json({
        success: false,
        message: 'Token QR Code tidak valid atau kosong.',
      });
      return;
    }

    // 1. Temukan Pegawai berdasarkan qrCodeToken
    const employee = await prisma.employee.findUnique({
      where: { qrCodeToken: qrToken },
      include: { shift: true },
    });

    if (!employee) {
      res.status(404).json({
        success: false,
        message: 'Kartu QR tidak dikenali. Pegawai tidak terdaftar dalam sistem toko konveksi.',
      });
      return;
    }

    if (!employee.isActive) {
      res.status(403).json({
        success: false,
        message: `Pegawai ${employee.name} (${employee.code}) berstatus tidak aktif.`,
      });
      return;
    }

    // 2. Dapatkan batas awal dan akhir hari ini (Local Date midnight)
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
    const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

    // 3. Periksa apakah sudah ada absensi hari ini
    const existingAttendance = await prisma.attendance.findFirst({
      where: {
        employeeId: employee.id,
        createdAt: {
          gte: todayStart,
          lte: todayEnd,
        },
      },
    });

    // ==========================================
    // SKENARIO A: BELUM ABSEN MASUK (CLOCK IN)
    // ==========================================
    if (!existingAttendance) {
      let status: AttendanceStatus = AttendanceStatus.TEPAT_WAKTU;
      let lateMinutes = 0;

      // Hitung keterlambatan berdasarkan Shift kerja
      if (employee.shift) {
        const [shiftHour, shiftMinute] = employee.shift.startTime.split(':').map(Number);
        const shiftStartTime = new Date(now.getFullYear(), now.getMonth(), now.getDate(), shiftHour, shiftMinute, 0);
        
        // Toleransi keterlambatan
        const graceMinutes = employee.shift.lateGraceMinutes || 15;
        const graceTime = new Date(shiftStartTime.getTime() + graceMinutes * 60 * 1000);

        if (now > graceTime) {
          status = AttendanceStatus.TERLAMBAT;
          // Hitung selisih menit keterlambatan dari jam mulai shift
          const diffMs = now.getTime() - shiftStartTime.getTime();
          lateMinutes = Math.max(1, Math.floor(diffMs / (1000 * 60)));
        }
      }

      const newAttendance = await prisma.attendance.create({
        data: {
          employeeId: employee.id,
          date: todayStart,
          clockIn: now,
          status,
          lateMinutes,
        },
      });

      res.status(200).json({
        success: true,
        type: 'CLOCK_IN',
        message: status === AttendanceStatus.TERLAMBAT
          ? `Absen MASUK Berhasil! Pegawai ${employee.name} terlambat ${lateMinutes} menit.`
          : `Absen MASUK Berhasil! Selamat bekerja, ${employee.name}.`,
        data: {
          employee: {
            code: employee.code,
            name: employee.name,
            division: employee.division,
            shift: employee.shift?.name || 'Reguler',
          },
          attendance: {
            id: newAttendance.id,
            clockIn: newAttendance.clockIn,
            status: newAttendance.status,
            lateMinutes: newAttendance.lateMinutes,
          },
        },
      });
      return;
    }

    // ==========================================
    // SKENARIO B: SUDAH MASUK, BELUM PULANG (CLOCK OUT)
    // ==========================================
    if (!existingAttendance.clockOut) {
      const clockInTime = new Date(existingAttendance.clockIn).getTime();
      const clockOutTime = now.getTime();
      
      // Hitung durasi kerja aktual dalam menit
      const durationMinutes = Math.max(1, Math.floor((clockOutTime - clockInTime) / (1000 * 60)));

      let updatedStatus = existingAttendance.status;
      // Periksa apakah pulang mendahului jadwal shift
      if (employee.shift) {
        const [endHour, endMinute] = employee.shift.endTime.split(':').map(Number);
        const shiftEndTime = new Date(now.getFullYear(), now.getMonth(), now.getDate(), endHour, endMinute, 0);
        if (now < shiftEndTime && existingAttendance.status === AttendanceStatus.TEPAT_WAKTU) {
          updatedStatus = AttendanceStatus.PULANG_AWAL;
        }
      }

      const updatedAttendance = await prisma.attendance.update({
        where: { id: existingAttendance.id },
        data: {
          clockOut: now,
          workDurationMin: durationMinutes,
          status: updatedStatus,
        },
      });

      res.status(200).json({
        success: true,
        type: 'CLOCK_OUT',
        message: `Absen PULANG Berhasil! Terima kasih atas kerja keras hari ini, ${employee.name}. Durasi: ${formatDuration(durationMinutes)}.`,
        data: {
          employee: {
            code: employee.code,
            name: employee.name,
            division: employee.division,
            shift: employee.shift?.name || 'Reguler',
          },
          attendance: {
            id: updatedAttendance.id,
            clockIn: updatedAttendance.clockIn,
            clockOut: updatedAttendance.clockOut,
            durationMinutes,
            durationFormatted: formatDuration(durationMinutes),
            status: updatedAttendance.status,
          },
        },
      });
      return;
    }

    // ==========================================
    // SKENARIO C: SUDAH MASUK & SUDAH PULANG
    // ==========================================
    res.status(400).json({
      success: false,
      type: 'ALREADY_COMPLETED',
      message: `Pegawai ${employee.name} sudah menyelesaikan absensi masuk & pulang untuk hari ini.`,
      data: {
        employee: {
          code: employee.code,
          name: employee.name,
          division: employee.division,
        },
        attendance: existingAttendance,
      },
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Gagal memproses pemindaian absensi: ' + error.message,
    });
  }
};

/**
 * Daftar kehadiran hari ini (Real-time feed Kios & Dashboard)
 */
export const getTodayAttendances = async (_req: Request, res: Response): Promise<void> => {
  try {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
    const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

    const attendances = await prisma.attendance.findMany({
      where: {
        createdAt: {
          gte: todayStart,
          lte: todayEnd,
        },
      },
      include: {
        employee: {
          include: { shift: true },
        },
      },
      orderBy: { clockIn: 'desc' },
    });

    const formatted = attendances.map((att) => ({
      id: att.id,
      date: att.date,
      clockIn: att.clockIn.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
      clockOut: att.clockOut ? att.clockOut.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : null,
      status: att.status,
      lateMinutes: att.lateMinutes,
      workDurationFormatted: att.workDurationMin ? formatDuration(att.workDurationMin) : null,
      employee: {
        id: att.employee.id,
        code: att.employee.code,
        name: att.employee.name,
        division: att.employee.division,
        shiftName: att.employee.shift?.name || 'Reguler',
      },
    }));

    res.json({
      success: true,
      data: formatted,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Gagal mengambil absensi hari ini: ' + error.message,
    });
  }
};
