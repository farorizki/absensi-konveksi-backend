import prisma from './src/config/database';
import bcrypt from 'bcryptjs';

async function check() {
  console.log('--- CEK STATUS DATABASE ---');
  try {
    const admin = await prisma.admin.findUnique({
      where: { username: 'admin' },
    });
    console.log('Hasil pencarian admin:', admin);

    if (!admin) {
      console.log('Admin tidak ditemukan. Mencoba membuat admin...');
      const hashedPassword = await bcrypt.hash('admin123', 10);
      const created = await prisma.admin.create({
        data: {
          username: 'admin',
          name: 'Kepala Toko Konveksi',
          password: hashedPassword,
          role: 'SUPER_ADMIN',
        },
      });
      console.log('✅ Admin berhasil dibuat:', created.username);
    } else {
      console.log('✅ Admin sudah ada di database.');
      const isMatch = await bcrypt.compare('admin123', admin.password);
      console.log('Verifikasi password admin123:', isMatch ? 'COCOK' : 'TIDAK COCOK');
    }
  } catch (err: any) {
    console.error('❌ Error database:', err.message);
  } finally {
    await prisma.$disconnect();
  }
}

check();
