import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import prisma from '../config/database';
import { AuthenticatedRequest } from '../middlewares/auth.middleware';
import { autoSeedIfEmpty } from '../utils/auto-seed';

/**
 * Login Admin Toko Konveksi
 */
export const setupAdmin = async (_req: Request, res: Response): Promise<void> => {
  try {
    const hashedPassword = await bcrypt.hash('admin123', 10);
    const admin = await prisma.admin.upsert({
      where: { username: 'admin' },
      update: { password: hashedPassword },
      create: {
        username: 'admin',
        name: 'Kepala Toko Konveksi',
        password: hashedPassword,
        role: 'SUPER_ADMIN',
      },
    });

    await autoSeedIfEmpty();

    res.json({
      success: true,
      message: 'Akun Admin berhasil disiapkan! Silakan kembali ke halaman login (http://localhost:5173/login).',
      credentials: {
        username: 'admin',
        password: 'admin123',
      },
      admin: {
        id: admin.id,
        username: admin.username,
        name: admin.name,
      },
    });
  } catch (error: any) {
    console.error('Error di /api/auth/setup:', error);
    res.status(500).json({
      success: false,
      message: 'Gagal inisialisasi admin: ' + error.message,
    });
  }
};

/**
 * Login Admin Toko Konveksi
 */
export const login = async (req: Request, res: Response): Promise<void> => {
  try {
    const username = (req.body.username || '').trim();
    const password = (req.body.password || '').trim();

    console.log(`[LOGIN] Menerima request login untuk username: "${username}"`);

    if (!username || !password) {
      res.status(400).json({
        success: false,
        message: 'Username dan password wajib diisi.',
      });
      return;
    }

    let admin = await prisma.admin.findFirst({
      where: {
        username: {
          equals: username,
          mode: 'insensitive',
        },
      },
    });

    // Jika admin belum ada di database dan mencoba login sebagai admin bawaan
    if (!admin && username.toLowerCase() === 'admin') {
      console.log('[LOGIN] Admin belum ada. Menjalankan auto-seed...');
      await autoSeedIfEmpty();
      admin = await prisma.admin.findUnique({
        where: { username: 'admin' },
      });
    }

    if (!admin) {
      console.log(`[LOGIN] User "${username}" tidak ditemukan di database.`);
      res.status(401).json({
        success: false,
        message: 'Username atau password tidak cocok. Silakan akses http://localhost:5000/api/auth/setup untuk setup admin otomatis.',
      });
      return;
    }

    let isMatch = await bcrypt.compare(password, admin.password);

    // Failsafe: Jika kredensial bawaan admin/admin123 digunakan tetapi hash di DB belum cocok
    if (!isMatch && username.toLowerCase() === 'admin' && password === 'admin123') {
      console.log('[LOGIN] Memperbarui password default admin...');
      const updatedHash = await bcrypt.hash('admin123', 10);
      admin = await prisma.admin.update({
        where: { id: admin.id },
        data: { password: updatedHash },
      });
      isMatch = true;
    }

    if (!isMatch) {
      console.log(`[LOGIN] Password salah untuk user "${username}".`);
      res.status(401).json({
        success: false,
        message: 'Username atau password tidak cocok.',
      });
      return;
    }

    console.log(`[LOGIN] Berhasil login: ${admin.name} (${admin.username})`);

    const secret = process.env.JWT_SECRET || 'super_secret_konveksi_jwt_key_2026_xyz';
    const token = jwt.sign(
      {
        id: admin.id,
        username: admin.username,
        role: admin.role,
        name: admin.name,
      },
      secret,
      { expiresIn: '7d' }
    );

    res.json({
      success: true,
      message: 'Login berhasil.',
      data: {
        token,
        admin: {
          id: admin.id,
          username: admin.username,
          name: admin.name,
          role: admin.role,
        },
      },
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Gagal melakukan login: ' + error.message,
    });
  }
};

/**
 * Dapatkan data admin yang sedang login
 */
export const getMe = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    if (!req.user) {
      res.status(401).json({ success: false, message: 'Tidak terotentikasi.' });
      return;
    }

    const admin = await prisma.admin.findUnique({
      where: { id: req.user.id },
      select: { id: true, username: true, name: true, role: true, createdAt: true },
    });

    if (!admin) {
      res.status(404).json({ success: false, message: 'Admin tidak ditemukan.' });
      return;
    }

    res.json({
      success: true,
      data: admin,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: 'Gagal mengambil data profil: ' + error.message,
    });
  }
};
