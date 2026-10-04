import QRCode from 'qrcode';
import crypto from 'crypto';

/**
 * Generate unique token string for employee QR code
 */
export const generateEmployeeQrToken = (employeeCode: string): string => {
  const randomSuffix = crypto.randomBytes(4).toString('hex').toUpperCase();
  return `KNV-${employeeCode}-${randomSuffix}`;
};

/**
 * Generate QR Code as Base64 Data URL (PNG)
 */
export const generateQrDataUrl = async (text: string): Promise<string> => {
  return await QRCode.toDataURL(text, {
    errorCorrectionLevel: 'H',
    type: 'image/png',
    margin: 2,
    color: {
      dark: '#1e293b', // slate-800
      light: '#ffffff',
    },
    width: 320,
  });
};

/**
 * Generate QR Code as Buffer for PDF or direct streaming
 */
export const generateQrBuffer = async (text: string): Promise<Buffer> => {
  return await QRCode.toBuffer(text, {
    errorCorrectionLevel: 'H',
    type: 'png',
    margin: 2,
    color: {
      dark: '#1e293b',
      light: '#ffffff',
    },
    width: 250,
  });
};
