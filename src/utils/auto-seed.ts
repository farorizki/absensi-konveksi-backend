import prisma from '../config/database';
import bcrypt from 'bcryptjs';
import { Division, AttendanceStatus, Role } from '@prisma/client';
import { generateEmployeeQrToken } from './qrcode.util';

/**
 * Otomatis mengisi data awal jika database toko konveksi masih kosong
 */
export const autoSeedIfEmpty = async () => {
  try {
    const adminCount = await prisma.admin.count();
    if (adminCount > 0) return;

    console.log('🌱 Database kosong terdeteksi. Melakukan inisialisasi data bawaan otomatis...');

    // 1. Buat Admin Utama
    const adminPassword = await bcrypt.hash('admin123', 10);
    const admin = await prisma.admin.create({
      data: {
        username: 'admin',
        name: 'Kepala Toko Konveksi',
        password: adminPassword,
        role: Role.SUPER_ADMIN,
      },
    });

    // 2. Buat Shift Kerja
    const shiftPagi = await prisma.shift.create({
      data: {
        name: 'Shift Pagi (Produksi)',
        startTime: '08:00',
        endTime: '16:00',
        lateGraceMinutes: 15,
      },
    });

    const shiftSiang = await prisma.shift.create({
      data: {
        name: 'Shift Siang (Finishing & Sablon)',
        startTime: '13:00',
        endTime: '21:00',
        lateGraceMinutes: 15,
      },
    });

    // 3. Buat 5 Pegawai Contoh untuk masing-masing Divisi
    const sampleEmployees = [
      { code: 'KNV-001', name: 'Siti Aminah', division: Division.PENJAHIT, shiftId: shiftPagi.id },
      { code: 'KNV-002', name: 'Budi Santoso', division: Division.SABLON, shiftId: shiftPagi.id },
      { code: 'KNV-003', name: 'Joko Prasetyo', division: Division.PEMOTONG_BAHAN, shiftId: shiftPagi.id },
      { code: 'KNV-004', name: 'Dewi Lestari', division: Division.QC, shiftId: shiftSiang.id },
      { code: 'KNV-005', name: 'Agus Pratama', division: Division.PACKING, shiftId: shiftSiang.id },
    ];

    for (const emp of sampleEmployees) {
      const qrToken = generateEmployeeQrToken(emp.code);
      await prisma.employee.create({
        data: {
          code: emp.code,
          name: emp.name,
          division: emp.division,
          qrCodeToken: qrToken,
          shiftId: emp.shiftId,
        },
      });
    }

    console.log('✅ Inisialisasi otomatis berhasil: Admin (admin/admin123), 2 Shift, & 5 Pegawai siap.');
    return admin;
  } catch (error) {
    console.error('⚠️ Gagal auto-seed database:', error);
    return null;
  }
};
