import { Request, Response } from 'express';
import prisma from '../config/database';
import { generateEmployeeQrToken, generateQrDataUrl } from '../utils/qrcode.util';
import { Division } from '@prisma/client';

/**
 * Ambil daftar semua pegawai konveksi dengan filter
 */
export const getEmployees = async (req: Request, res: Response): Promise<void> => {
  try {
    const { division, search, isActive } = req.query;

    const whereClause: any = {};

    if (division && Object.values(Division).includes(division as Division)) {
      whereClause.division = division as Division;
    }

    if (isActive !== undefined) {
      whereClause.isActive = isActive === 'true';
    }

    if (search) {
      whereClause.OR = [
        { name: { contains: String(search), mode: 'insensitive' } },
        { code: { contains: String(search), mode: 'insensitive' } },
      ];
    }

    const employees = await prisma.employee.findMany({
      where: whereClause,
      include: {
        shift: true,
      },
      orderBy: { code: 'asc' },
    });

    res.json({
      success: true,
      data: employees,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Gagal mengambil daftar pegawai: ' + error.message,
    });
  }
};

/**
 * Detail pegawai berdasarkan ID
 */
export const getEmployeeById = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const employee = await prisma.employee.findUnique({
      where: { id },
      include: { shift: true },
    });

    if (!employee) {
      res.status(404).json({ success: false, message: 'Pegawai tidak ditemukan.' });
      return;
    }

    // Buat QR Code DataURL secara on-the-fly
    const qrDataUrl = await generateQrDataUrl(employee.qrCodeToken);

    res.json({
      success: true,
      data: {
        ...employee,
        qrDataUrl,
      },
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Gagal mengambil data pegawai: ' + error.message,
    });
  }
};

/**
 * Tambah pegawai baru Toko Konveksi + otomatis buat token QR
 */
export const createEmployee = async (req: Request, res: Response): Promise<void> => {
  try {
    const { code, name, division, phone, shiftId } = req.body;

    if (!name || !division) {
      res.status(400).json({
        success: false,
        message: 'Nama dan divisi pegawai wajib diisi.',
      });
      return;
    }

    // Auto-generate employee code if not provided
    let empCode = code;
    if (!empCode) {
      const count = await prisma.employee.count();
      empCode = `KNV-${String(count + 1).padStart(3, '0')}`;
    }

    // Periksa keunikan kode pegawai
    const existing = await prisma.employee.findUnique({ where: { code: empCode } });
    if (existing) {
      res.status(400).json({
        success: false,
        message: `Kode pegawai '${empCode}' sudah digunakan.`,
      });
      return;
    }

    // Generate token QR Code
    const qrCodeToken = generateEmployeeQrToken(empCode);

    const newEmployee = await prisma.employee.create({
      data: {
        code: empCode,
        name,
        division: division as Division,
        phone,
        qrCodeToken,
        shiftId: shiftId || null,
      },
      include: { shift: true },
    });

    // Generate QR image
    const qrDataUrl = await generateQrDataUrl(qrCodeToken);

    res.status(201).json({
      success: true,
      message: 'Pegawai berhasil didaftarkan.',
      data: {
        ...newEmployee,
        qrDataUrl,
      },
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Gagal mendaftarkan pegawai: ' + error.message,
    });
  }
};

/**
 * Perbarui informasi pegawai
 */
export const updateEmployee = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { name, division, phone, shiftId, isActive } = req.body;

    const existing = await prisma.employee.findUnique({ where: { id } });
    if (!existing) {
      res.status(404).json({ success: false, message: 'Pegawai tidak ditemukan.' });
      return;
    }

    const updated = await prisma.employee.update({
      where: { id },
      data: {
        ...(name && { name }),
        ...(division && { division: division as Division }),
        ...(phone !== undefined && { phone }),
        ...(shiftId !== undefined && { shiftId }),
        ...(isActive !== undefined && { isActive }),
      },
      include: { shift: true },
    });

    res.json({
      success: true,
      message: 'Data pegawai berhasil diperbarui.',
      data: updated,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Gagal memperbarui data pegawai: ' + error.message,
    });
  }
};

/**
 * Hapus pegawai
 */
export const deleteEmployee = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    await prisma.employee.delete({ where: { id } });

    res.json({
      success: true,
      message: 'Data pegawai berhasil dihapus.',
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Gagal menghapus pegawai: ' + error.message,
    });
  }
};

/**
 * Dapatkan QR Code siap cetak untuk kartu identitas pegawai
 */
export const getEmployeeQrCode = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const employee = await prisma.employee.findUnique({
      where: { id },
      include: { shift: true },
    });

    if (!employee) {
      res.status(404).json({ success: false, message: 'Pegawai tidak ditemukan.' });
      return;
    }

    const qrDataUrl = await generateQrDataUrl(employee.qrCodeToken);

    res.json({
      success: true,
      data: {
        employeeId: employee.id,
        employeeCode: employee.code,
        employeeName: employee.name,
        division: employee.division,
        shiftName: employee.shift?.name || 'Reguler',
        qrToken: employee.qrCodeToken,
        qrDataUrl,
      },
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Gagal mengambil QR Code pegawai: ' + error.message,
    });
  }
};

/**
 * Regenerasi QR Code Token baru jika kartu fisik hilang / rusak
 */
export const regenerateQrCode = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    const employee = await prisma.employee.findUnique({ where: { id } });
    if (!employee) {
      res.status(404).json({ success: false, message: 'Pegawai tidak ditemukan.' });
      return;
    }

    const newToken = generateEmployeeQrToken(employee.code);
    const updated = await prisma.employee.update({
      where: { id },
      data: { qrCodeToken: newToken },
    });

    const qrDataUrl = await generateQrDataUrl(newToken);

    res.json({
      success: true,
      message: 'QR Code baru berhasil diregenerasi.',
      data: {
        employee: updated,
        qrDataUrl,
      },
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Gagal meregenerasi QR Code: ' + error.message,
    });
  }
};
