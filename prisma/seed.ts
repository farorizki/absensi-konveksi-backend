import { PrismaClient, Division, AttendanceStatus, Role } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { generateEmployeeQrToken } from '../src/utils/qrcode.util';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seed for Toko Konveksi...');

  // 1. Seed Admin
  const adminPassword = await bcrypt.hash('admin123', 10);
  const admin = await prisma.admin.upsert({
    where: { username: 'admin' },
    update: {},
    create: {
      username: 'admin',
      name: 'Kepala Toko Konveksi',
      password: adminPassword,
      role: Role.SUPER_ADMIN,
    },
  });
  console.log(`✅ Admin ready: ${admin.username} (Password: admin123)`);

  // 2. Seed Shifts
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
  console.log('✅ Master Shift created: Shift Pagi & Shift Siang');

  // 3. Seed Pegawai Toko Konveksi (5 Divisi Utama)
  const employeesData = [
    {
      code: 'KNV-001',
      name: 'Siti Aminah',
      division: Division.PENJAHIT,
      phone: '081234567801',
      shiftId: shiftPagi.id,
    },
    {
      code: 'KNV-002',
      name: 'Budi Santoso',
      division: Division.SABLON,
      phone: '081234567802',
      shiftId: shiftPagi.id,
    },
    {
      code: 'KNV-003',
      name: 'Joko Prasetyo',
      division: Division.PEMOTONG_BAHAN,
      phone: '081234567803',
      shiftId: shiftPagi.id,
    },
    {
      code: 'KNV-004',
      name: 'Dewi Lestari',
      division: Division.QC,
      phone: '081234567804',
      shiftId: shiftSiang.id,
    },
    {
      code: 'KNV-005',
      name: 'Agus Pratama',
      division: Division.PACKING,
      phone: '081234567805',
      shiftId: shiftSiang.id,
    },
  ];

  const createdEmployees = [];
  for (const emp of employeesData) {
    const qrCodeToken = generateEmployeeQrToken(emp.code);
    const created = await prisma.employee.upsert({
      where: { code: emp.code },
      update: {},
      create: {
        code: emp.code,
        name: emp.name,
        division: emp.division,
        phone: emp.phone,
        qrCodeToken,
        shiftId: emp.shiftId,
      },
    });
    createdEmployees.push(created);
  }
  console.log(`✅ ${createdEmployees.length} Pegawai konveksi created across 5 divisions.`);

  // 4. Seed Data Absensi Hari Ini
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  // Siti Aminah: Tepat Waktu (Clock In 07:55)
  const inSiti = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 7, 55, 0);
  await prisma.attendance.upsert({
    where: {
      employeeId_date: {
        employeeId: createdEmployees[0].id,
        date: today,
      },
    },
    update: {},
    create: {
      employeeId: createdEmployees[0].id,
      date: today,
      clockIn: inSiti,
      status: AttendanceStatus.TEPAT_WAKTU,
      lateMinutes: 0,
    },
  });

  // Budi Santoso: Terlambat (Clock In 08:35, terlambat 20 menit)
  const inBudi = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 8, 35, 0);
  await prisma.attendance.upsert({
    where: {
      employeeId_date: {
        employeeId: createdEmployees[1].id,
        date: today,
      },
    },
    update: {},
    create: {
      employeeId: createdEmployees[1].id,
      date: today,
      clockIn: inBudi,
      status: AttendanceStatus.TERLAMBAT,
      lateMinutes: 20,
    },
  });

  // Joko Prasetyo: Lengkap (Clock In 08:00, Clock Out 16:10, durasi: 490 menit)
  const inJoko = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 8, 0, 0);
  const outJoko = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 16, 10, 0);
  await prisma.attendance.upsert({
    where: {
      employeeId_date: {
        employeeId: createdEmployees[2].id,
        date: today,
      },
    },
    update: {},
    create: {
      employeeId: createdEmployees[2].id,
      date: today,
      clockIn: inJoko,
      clockOut: outJoko,
      status: AttendanceStatus.TEPAT_WAKTU,
      lateMinutes: 0,
      workDurationMin: 490,
    },
  });

  console.log('✅ Sample absensi hari ini berhasil disiapkan.');
  console.log('🎉 Seeding database selesai!');
}

main()
  .catch((e) => {
    console.error('❌ Error seeding database:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
