import { Request, Response } from 'express';
import prisma from '../config/database';

/**
 * Mendapatkan seluruh daftar shift
 */
export const getShifts = async (_req: Request, res: Response): Promise<void> => {
  try {
    const shifts = await prisma.shift.findMany({
      include: {
        _count: {
          select: { employees: true },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    res.json({
      success: true,
      data: shifts,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Gagal mengambil data shift: ' + error.message,
    });
  }
};

/**
 * Tambah shift baru
 */
export const createShift = async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, startTime, endTime, lateGraceMinutes } = req.body;

    if (!name || !startTime || !endTime) {
      res.status(400).json({
        success: false,
        message: 'Nama shift, jam mulai, dan jam selesai wajib diisi.',
      });
      return;
    }

    const shift = await prisma.shift.create({
      data: {
        name,
        startTime,
        endTime,
        lateGraceMinutes: Number(lateGraceMinutes) || 15,
      },
    });

    res.status(201).json({
      success: true,
      message: 'Shift berhasil ditambahkan.',
      data: shift,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Gagal menambahkan shift: ' + error.message,
    });
  }
};

/**
 * Perbarui data shift
 */
export const updateShift = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { name, startTime, endTime, lateGraceMinutes, isActive } = req.body;

    const existingShift = await prisma.shift.findUnique({ where: { id } });
    if (!existingShift) {
      res.status(404).json({ success: false, message: 'Shift tidak ditemukan.' });
      return;
    }

    const updated = await prisma.shift.update({
      where: { id },
      data: {
        ...(name && { name }),
        ...(startTime && { startTime }),
        ...(endTime && { endTime }),
        ...(lateGraceMinutes !== undefined && { lateGraceMinutes: Number(lateGraceMinutes) }),
        ...(isActive !== undefined && { isActive }),
      },
    });

    res.json({
      success: true,
      message: 'Shift berhasil diperbarui.',
      data: updated,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Gagal memperbarui shift: ' + error.message,
    });
  }
};

/**
 * Hapus shift
 */
export const deleteShift = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    // Lepaskan referensi shift dari pegawai terkait sebelum menghapus
    await prisma.employee.updateMany({
      where: { shiftId: id },
      data: { shiftId: null },
    });

    await prisma.shift.delete({ where: { id } });

    res.json({
      success: true,
      message: 'Shift berhasil dihapus.',
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Gagal menghapus shift: ' + error.message,
    });
  }
};
