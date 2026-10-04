import { Request, Response } from 'express';
import prisma from '../config/database';
import { generateAttendanceExcel, generateAttendancePdf } from '../utils/exporter.util';
import { Division, AttendanceStatus } from '@prisma/client';

const formatDuration = (minutes: number | null): string => {
  if (!minutes) return '-';
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  if (hours === 0) return `${remainingMinutes}m`;
  if (remainingMinutes === 0) return `${hours}j`;
  return `${hours}j ${remainingMinutes}m`;
};

/**
 * Statistik Ringkasan untuk Dashboard Admin Toko Konveksi
 */
export const getDashboardStats = async (_req: Request, res: Response): Promise<void> => {
  try {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0);
    const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);

    // 1. Total Pegawai Aktif
    const totalEmployees = await prisma.employee.count({
      where: { isActive: true },
    });

    // 2. Absensi Hari Ini
    const todayAttendances = await prisma.attendance.findMany({
      where: {
        createdAt: { gte: todayStart, lte: todayEnd },
      },
      include: {
        employee: true,
      },
    });

    const presentCount = todayAttendances.length;
    const onTimeCount = todayAttendances.filter((a) => a.status === AttendanceStatus.TEPAT_WAKTU).length;
    const lateCount = todayAttendances.filter((a) => a.status === AttendanceStatus.TERLAMBAT).length;
    const earlyLeaveCount = todayAttendances.filter((a) => a.status === AttendanceStatus.PULANG_AWAL).length;

    // 3. Distribusi Kehadiran Berdasarkan Divisi Konveksi
    const divisions = [
      Division.PENJAHIT,
      Division.SABLON,
      Division.PEMOTONG_BAHAN,
      Division.QC,
      Division.PACKING,
    ];

    const divisionStats = await Promise.all(
      divisions.map(async (div) => {
        const totalInDiv = await prisma.employee.count({
          where: { division: div, isActive: true },
        });

        const presentInDiv = todayAttendances.filter(
          (a) => a.employee.division === div
        ).length;

        return {
          division: div,
          label: div.replace('_', ' '),
          totalEmployees: totalInDiv,
          presentCount: presentInDiv,
          percentage: totalInDiv > 0 ? Math.round((presentInDiv / totalInDiv) * 100) : 0,
        };
      })
    );

    res.json({
      success: true,
      data: {
        summary: {
          totalEmployees,
          presentCount,
          onTimeCount,
          lateCount,
          earlyLeaveCount,
          absentCount: Math.max(0, totalEmployees - presentCount),
          attendanceRate: totalEmployees > 0 ? Math.round((presentCount / totalEmployees) * 100) : 0,
        },
        divisionStats,
      },
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Gagal memuat statistik dashboard: ' + error.message,
    });
  }
};

/**
 * Filter Rekapitulasi Data Absensi Pegawai
 */
export const getAttendanceRecap = async (req: Request, res: Response): Promise<void> => {
  try {
    const { startDate, endDate, division, status } = req.query;

    const whereClause: any = {};

    if (startDate || endDate) {
      whereClause.date = {};
      if (startDate) {
        whereClause.date.gte = new Date(String(startDate));
      }
      if (endDate) {
        const end = new Date(String(endDate));
        end.setHours(23, 59, 59, 999);
        whereClause.date.lte = end;
      }
    }

    if (status && Object.values(AttendanceStatus).includes(status as AttendanceStatus)) {
      whereClause.status = status as AttendanceStatus;
    }

    if (division && Object.values(Division).includes(division as Division)) {
      whereClause.employee = { division: division as Division };
    }

    const attendances = await prisma.attendance.findMany({
      where: whereClause,
      include: {
        employee: {
          include: { shift: true },
        },
      },
      orderBy: { date: 'desc' },
    });

    const formatted = attendances.map((att) => ({
      id: att.id,
      date: att.date.toISOString().split('T')[0],
      employeeCode: att.employee.code,
      employeeName: att.employee.name,
      division: att.employee.division,
      shiftName: att.employee.shift?.name || 'Reguler',
      clockIn: att.clockIn.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
      clockOut: att.clockOut ? att.clockOut.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : '-',
      workDuration: formatDuration(att.workDurationMin),
      status: att.status,
      lateMinutes: att.lateMinutes,
    }));

    res.json({
      success: true,
      total: formatted.length,
      data: formatted,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Gagal mengambil rekapitulasi data: ' + error.message,
    });
  }
};

/**
 * Ekspor Laporan Rekapitulasi ke Excel (.xlsx)
 */
export const exportAttendanceExcel = async (req: Request, res: Response): Promise<void> => {
  try {
    const { startDate, endDate, division, status } = req.query;

    const whereClause: any = {};
    if (startDate || endDate) {
      whereClause.date = {};
      if (startDate) whereClause.date.gte = new Date(String(startDate));
      if (endDate) {
        const end = new Date(String(endDate));
        end.setHours(23, 59, 59, 999);
        whereClause.date.lte = end;
      }
    }
    if (status && Object.values(AttendanceStatus).includes(status as AttendanceStatus)) {
      whereClause.status = status as AttendanceStatus;
    }
    if (division && Object.values(Division).includes(division as Division)) {
      whereClause.employee = { division: division as Division };
    }

    const attendances = await prisma.attendance.findMany({
      where: whereClause,
      include: {
        employee: {
          include: { shift: true },
        },
      },
      orderBy: { date: 'desc' },
    });

    const records = attendances.map((att) => ({
      id: att.id,
      date: att.date.toISOString().split('T')[0],
      employeeCode: att.employee.code,
      employeeName: att.employee.name,
      division: att.employee.division,
      shiftName: att.employee.shift?.name || 'Reguler',
      clockIn: att.clockIn.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
      clockOut: att.clockOut ? att.clockOut.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : '-',
      workDuration: formatDuration(att.workDurationMin),
      status: att.status,
      lateMinutes: att.lateMinutes,
    }));

    const excelBuffer = await generateAttendanceExcel(records, {
      startDate: startDate ? String(startDate) : undefined,
      endDate: endDate ? String(endDate) : undefined,
      division: division ? String(division) : undefined,
    });

    const filename = `rekap-absensi-konveksi-${new Date().toISOString().split('T')[0]}.xlsx`;

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(excelBuffer);
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Gagal membuat file Excel: ' + error.message,
    });
  }
};

/**
 * Ekspor Laporan Rekapitulasi ke Dokumen PDF
 */
export const exportAttendancePdf = async (req: Request, res: Response): Promise<void> => {
  try {
    const { startDate, endDate, division, status } = req.query;

    const whereClause: any = {};
    if (startDate || endDate) {
      whereClause.date = {};
      if (startDate) whereClause.date.gte = new Date(String(startDate));
      if (endDate) {
        const end = new Date(String(endDate));
        end.setHours(23, 59, 59, 999);
        whereClause.date.lte = end;
      }
    }
    if (status && Object.values(AttendanceStatus).includes(status as AttendanceStatus)) {
      whereClause.status = status as AttendanceStatus;
    }
    if (division && Object.values(Division).includes(division as Division)) {
      whereClause.employee = { division: division as Division };
    }

    const attendances = await prisma.attendance.findMany({
      where: whereClause,
      include: {
        employee: {
          include: { shift: true },
        },
      },
      orderBy: { date: 'desc' },
    });

    const records = attendances.map((att) => ({
      id: att.id,
      date: att.date.toISOString().split('T')[0],
      employeeCode: att.employee.code,
      employeeName: att.employee.name,
      division: att.employee.division,
      shiftName: att.employee.shift?.name || 'Reguler',
      clockIn: att.clockIn.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }),
      clockOut: att.clockOut ? att.clockOut.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' }) : '-',
      workDuration: formatDuration(att.workDurationMin),
      status: att.status,
      lateMinutes: att.lateMinutes,
    }));

    const pdfBuffer = await generateAttendancePdf(records, {
      startDate: startDate ? String(startDate) : undefined,
      endDate: endDate ? String(endDate) : undefined,
      division: division ? String(division) : undefined,
    });

    const filename = `laporan-absensi-konveksi-${new Date().toISOString().split('T')[0]}.pdf`;

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(pdfBuffer);
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Gagal membuat file PDF: ' + error.message,
    });
  }
};
