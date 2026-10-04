import ExcelJS from 'exceljs';
import PDFDocument from 'pdfkit';

interface AttendanceRecord {
  id: string;
  date: string | Date;
  employeeCode: string;
  employeeName: string;
  division: string;
  shiftName: string;
  clockIn: string;
  clockOut: string;
  workDuration: string;
  status: string;
  lateMinutes: number;
}

/**
 * Generate Excel (.xlsx) workbook for Attendance Recap
 */
export const generateAttendanceExcel = async (
  records: AttendanceRecord[],
  filterInfo?: { startDate?: string; endDate?: string; division?: string }
): Promise<Buffer> => {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Sistem Absensi Toko Konveksi';
  workbook.created = new Date();

  const worksheet = workbook.addWorksheet('Rekap Absensi', {
    pageSetup: { orientation: 'landscape' },
  });

  // Judul Laporan
  worksheet.mergeCells('A1:J1');
  const titleRow = worksheet.getCell('A1');
  titleRow.value = 'REKAPITULASI ABSENSI PEGAWAI TOKO KONVEKSI';
  titleRow.font = { name: 'Arial', size: 16, bold: true, color: { argb: 'FF1E293B' } };
  titleRow.alignment = { vertical: 'middle', horizontal: 'center' };
  worksheet.getRow(1).height = 30;

  // Sub-judul / Periode Filter
  worksheet.mergeCells('A2:J2');
  const subTitleRow = worksheet.getCell('A2');
  const periodText = `Periode: ${filterInfo?.startDate || 'Semua'} s/d ${filterInfo?.endDate || 'Semua'} | Divisi: ${filterInfo?.division || 'Semua Divisi'}`;
  subTitleRow.value = periodText;
  subTitleRow.font = { name: 'Arial', size: 11, italic: true, color: { argb: 'FF64748B' } };
  subTitleRow.alignment = { vertical: 'middle', horizontal: 'center' };
  worksheet.getRow(2).height = 20;

  worksheet.addRow([]); // Blank line

  // Definisi Kolom
  worksheet.columns = [
    { header: 'No', key: 'no', width: 6 },
    { header: 'Tanggal', key: 'date', width: 14 },
    { header: 'Kode Pegawai', key: 'code', width: 15 },
    { header: 'Nama Pegawai', key: 'name', width: 25 },
    { header: 'Divisi', key: 'division', width: 18 },
    { header: 'Shift', key: 'shift', width: 18 },
    { header: 'Jam Masuk', key: 'clockIn', width: 14 },
    { header: 'Jam Pulang', key: 'clockOut', width: 14 },
    { header: 'Durasi Kerja', key: 'duration', width: 16 },
    { header: 'Status Kehadiran', key: 'status', width: 18 },
  ];

  // Styling Header Tabel (Row 4)
  const headerRow = worksheet.getRow(4);
  headerRow.height = 25;
  headerRow.eachCell((cell) => {
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF2563EB' }, // Blue 600
    };
    cell.font = { name: 'Arial', size: 11, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.alignment = { vertical: 'middle', horizontal: 'center' };
    cell.border = {
      top: { style: 'thin' },
      left: { style: 'thin' },
      bottom: { style: 'thin' },
      right: { style: 'thin' },
    };
  });

  // Isi Data
  records.forEach((rec, index) => {
    const formattedDate = typeof rec.date === 'string' 
      ? rec.date 
      : new Date(rec.date).toISOString().split('T')[0];

    const row = worksheet.addRow({
      no: index + 1,
      date: formattedDate,
      code: rec.employeeCode,
      name: rec.employeeName,
      division: rec.division,
      shift: rec.shiftName || '-',
      clockIn: rec.clockIn || '-',
      clockOut: rec.clockOut || '-',
      duration: rec.workDuration || '-',
      status: rec.status === 'TERLAMBAT' ? `Terlambat (${rec.lateMinutes}m)` : (rec.status || '-'),
    });

    row.height = 22;
    row.eachCell((cell, colNum) => {
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
      };
      cell.font = { name: 'Arial', size: 10 };
      
      // Center alignments
      if ([1, 2, 3, 7, 8, 9, 10].includes(colNum)) {
        cell.alignment = { vertical: 'middle', horizontal: 'center' };
      } else {
        cell.alignment = { vertical: 'middle', horizontal: 'left' };
      }

      // Highlight Status
      if (colNum === 10) {
        if (rec.status === 'TEPAT_WAKTU') {
          cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FF15803D' } }; // green-700
        } else if (rec.status === 'TERLAMBAT') {
          cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFB91C1C' } }; // red-700
        }
      }
    });
  });

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.from(buffer);
};

/**
 * Generate PDF document for Attendance Recap
 */
export const generateAttendancePdf = async (
  records: AttendanceRecord[],
  filterInfo?: { startDate?: string; endDate?: string; division?: string }
): Promise<Buffer> => {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 30, size: 'A4', layout: 'landscape' });
      const buffers: Buffer[] = [];

      doc.on('data', buffers.push.bind(buffers));
      doc.on('end', () => {
        const pdfData = Buffer.concat(buffers);
        resolve(pdfData);
      });

      // Kop Surat / Header
      doc.fontSize(16).font('Helvetica-Bold').text('SISTEM ABSENSI TOKO KONVEKSI', { align: 'center' });
      doc.fontSize(12).font('Helvetica').text('LAPORAN REKAPITULASI KEHADIRAN PEGAWAI', { align: 'center' });
      doc.moveDown(0.3);
      doc.fontSize(9).font('Helvetica-Oblique').text(
        `Periode: ${filterInfo?.startDate || 'Semua'} s/d ${filterInfo?.endDate || 'Semua'} | Divisi: ${filterInfo?.division || 'Semua'} | Dicetak: ${new Date().toLocaleString('id-ID')}`,
        { align: 'center' }
      );
      doc.moveDown(1);

      // Table Header Layout
      const headers = ['No', 'Tgl', 'Kode', 'Nama Pegawai', 'Divisi', 'Shift', 'Masuk', 'Pulang', 'Durasi', 'Status'];
      const columnWidths = [25, 65, 65, 150, 95, 90, 60, 60, 75, 90];
      const startX = 30;
      let currentY = doc.y;

      // Draw table header box
      doc.rect(startX, currentY, 782, 22).fill('#2563EB');
      doc.fillColor('#FFFFFF').fontSize(9).font('Helvetica-Bold');

      let currentX = startX;
      headers.forEach((h, i) => {
        doc.text(h, currentX + 4, currentY + 6, { width: columnWidths[i] - 8, align: i > 3 && i < 9 ? 'center' : 'left' });
        currentX += columnWidths[i];
      });

      currentY += 22;
      doc.font('Helvetica').fontSize(8);

      // Table Rows
      records.forEach((rec, index) => {
        // Page break handling
        if (currentY > 520) {
          doc.addPage({ margin: 30, size: 'A4', layout: 'landscape' });
          currentY = 40;
        }

        const isEven = index % 2 === 0;
        if (isEven) {
          doc.rect(startX, currentY, 782, 18).fill('#F8FAFC');
        }

        const formattedDate = typeof rec.date === 'string' 
          ? rec.date 
          : new Date(rec.date).toISOString().split('T')[0];

        const rowValues = [
          String(index + 1),
          formattedDate,
          rec.employeeCode,
          rec.employeeName,
          rec.division,
          rec.shiftName || '-',
          rec.clockIn || '-',
          rec.clockOut || '-',
          rec.workDuration || '-',
          rec.status === 'TERLAMBAT' ? `Terlambat (${rec.lateMinutes}m)` : (rec.status || '-'),
        ];

        currentX = startX;
        rowValues.forEach((val, i) => {
          let textColor = '#1E293B';
          if (i === 9) {
            textColor = rec.status === 'TEPAT_WAKTU' ? '#15803D' : (rec.status === 'TERLAMBAT' ? '#B91C1C' : '#64748B');
          }
          doc.fillColor(textColor).text(val, currentX + 4, currentY + 5, {
            width: columnWidths[i] - 8,
            align: (i >= 5 && i <= 8) || i === 0 ? 'center' : 'left',
          });
          currentX += columnWidths[i];
        });

        currentY += 18;
      });

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
};
