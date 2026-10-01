import { Router, Response } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import { successResponse, errorResponse } from '../utils/response';
import prisma from '../utils/database';
import { logManualAction } from '../services/auditLogService';
import { AksiLog, SumberInput } from '@prisma/client';
import { KODE_JENIS_BAWAAN, getJenisBawaan } from '../utils/jenisBawaan';

const router = Router();

router.use(authenticate);

// Order dulu dikenali lewat `tipe: TipeTransaksi.DATA_ORDER` (enum tetap),
// lalu lewat jenis bawaan + akun COA (revisi 27 Sep). Sejak 29 Sep 2026:
// Neraca/journal di-drop dari scope, jadi order sekarang murni entri
// biasa di bawah jenis bawaan "Pendapatan Frozen"/"Pendapatan Siap Saji",
// dibedakan dari transaksi lain lewat field `sumberOrder` (wajib diisi).
// Piutang tetap dihitung langsung dari kolom sisaPiutang/jumlahBayar di
// Transaksi + saldoPiutang di DataPelanggan - tidak lewat jurnal sama
// sekali (jadi tidak terdampak drop-nya Neraca).
const ORDER_JENIS_KODE = [KODE_JENIS_BAWAAN.PENDAPATAN_FROZEN, KODE_JENIS_BAWAAN.PENDAPATAN_SIAP_SAJI];

async function orderJenisIds(): Promise<number[]> {
  const list = await prisma.jenisTransaksi.findMany({
    where: { kode: { in: ORDER_JENIS_KODE } },
    select: { id: true },
  });
  return list.map((j) => j.id);
}

async function generateOrderKode(tx: any): Promise<string> {
  const rows: Array<{ maxNum: number | null }> = await tx.$queryRaw`
    SELECT MAX(CAST(SUBSTRING_INDEX(SUBSTRING_INDEX(kode, '-', 1), 'JO', -1) AS UNSIGNED)) as maxNum
    FROM transaksi WHERE kode LIKE 'JO%'
  `;
  const next = (Number(rows[0]?.maxNum) || 0) + 1;
  return `JO${String(next).padStart(3, '0')}-${Date.now().toString().slice(-5)}`;
}

// GET /orders
router.get('/', async (req: AuthRequest, res: Response, next) => {
  try {
    const { business_unit, unit_bisnis, jenis_order, customer_id, pelanggan_id, tanggal_mulai, tanggal_selesai } = req.query;

    const jenisIds = await orderJenisIds();
    const where: any = { jenisTransaksiId: { in: jenisIds } };
    const finalUnit = unit_bisnis || business_unit;
    if (finalUnit) where.unitBisnis = finalUnit as string;
    if (jenis_order) where.sumberOrder = jenis_order as string;
    const cId = pelanggan_id || customer_id;
    if (cId) where.pelangganId = parseInt(cId as string);
    if (tanggal_mulai || tanggal_selesai) {
      where.tanggal = {};
      if (tanggal_mulai) where.tanggal.gte = new Date(tanggal_mulai as string);
      if (tanggal_selesai) where.tanggal.lte = new Date(tanggal_selesai as string);
    }

    const orders = await prisma.transaksi.findMany({
      where,
      include: { pelanggan: true, produk: true },
      orderBy: { tanggal: 'desc' },
    });

    const transformed = orders.map((o) => ({
      ...o,
      total_invoice: o.nominal,
      totalInvoice: o.nominal,
      jumlah_pesan: o.jumlah,
      jumlahPesan: o.jumlah,
      harga_satuan: o.hargaSatuan,
      hargaSatuan: o.hargaSatuan,
      jumlah_bayar: o.jumlahBayar,
      jumlahBayar: o.jumlahBayar,
      sisa_piutang: o.sisaPiutang,
      sisaPiutang: o.sisaPiutang,
      jenis_order: o.sumberOrder,
      jenisOrder: o.sumberOrder,
      customer: o.pelanggan,
      product: o.produk,
      kode_order: o.kode,
      kodeOrder: o.kode,
    }));

    res.json(successResponse(transformed));
  } catch (error) {
    next(error);
  }
});

// GET /orders/:id
router.get('/:id', async (req: AuthRequest, res: Response, next) => {
  try {
    const id = parseInt(String(req.params.id));
    const jenisIds = await orderJenisIds();
    const order = await prisma.transaksi.findFirst({
      where: { id, jenisTransaksiId: { in: jenisIds } },
      include: { pelanggan: true, produk: true },
    });

    if (!order) throw errorResponse('Order tidak ditemukan', 404);

    const transformed = {
      ...order,
      total_invoice: order.nominal,
      totalInvoice: order.nominal,
      jumlah_pesan: order.jumlah,
      jumlahPesan: order.jumlah,
      harga_satuan: order.hargaSatuan,
      hargaSatuan: order.hargaSatuan,
      jumlah_bayar: order.jumlahBayar,
      jumlahBayar: order.jumlahBayar,
      sisa_piutang: order.sisaPiutang,
      sisaPiutang: order.sisaPiutang,
      jenis_order: order.sumberOrder,
      jenisOrder: order.sumberOrder,
      customer: order.pelanggan,
      product: order.produk,
      kode_order: order.kode,
      kodeOrder: order.kode,
    };

    res.json(successResponse(transformed));
  } catch (error) {
    next(error);
  }
});

// POST /orders
router.post('/', async (req: AuthRequest, res: Response, next) => {
  try {
    const {
      tanggal, business_unit, unit_bisnis, jenis_order, sumber_order, sumberOrder,
      customer_id, pelanggan_id, pelangganId, product_id, produk_id, produkId,
      keterangan, detail, jumlah_pesan, jumlah, harga_satuan, hargaSatuan,
      jumlah_bayar, jumlahBayar, jenis_kas, jenisKas,
    } = req.body;

    const finalUnit = unit_bisnis || business_unit || 'DISTRIBUTOR';
    const finalOrderSrc = sumberOrder || sumber_order || jenis_order || 'FROZEN';
    const finalPrdId = produkId ?? produk_id ?? product_id;
    const finalCustId = pelangganId ?? pelanggan_id ?? customer_id;
    const qty = Number(jumlah ?? jumlah_pesan);
    const unitPrice = Number(hargaSatuan ?? harga_satuan);

    if (!tanggal || !finalPrdId || !qty || !unitPrice) {
      throw errorResponse('Field wajib: tanggal, product_id, jumlah_pesan, harga_satuan');
    }

    const totalInvoice = qty * unitPrice;
    const paidAmount = Number(jumlahBayar ?? jumlah_bayar ?? 0);
    const sisaPiutang = Math.max(0, totalInvoice - paidAmount);

    const product = await prisma.produk.findUnique({ where: { id: parseInt(String(finalPrdId)) } });
    if (!product) throw errorResponse('Produk tidak ditemukan', 404);

    // Order Frozen vs Siap Saji dipilih dari jenis bawaan - fallback ke
    // Frozen kalau sumber order tidak match keduanya secara eksplisit
    const jenisKode =
      (finalOrderSrc || '').toUpperCase().includes('SIAP') || (finalOrderSrc || '').toUpperCase() === 'WA' || (finalOrderSrc || '').toUpperCase() === 'IG'
        ? KODE_JENIS_BAWAAN.PENDAPATAN_SIAP_SAJI
        : KODE_JENIS_BAWAAN.PENDAPATAN_FROZEN;
    const jenisTrx = await getJenisBawaan(jenisKode);

    const result = await prisma.$transaction(async (tx) => {
      const kode = await generateOrderKode(tx);

      const order = await tx.transaksi.create({
        data: {
          kode,
          tanggal: new Date(tanggal),
          unitBisnis: finalUnit,
          jenisTransaksiId: jenisTrx.id,
          namaTransaksi: jenisTrx.namaTransaksi,
          detail: detail || keterangan || `Pesanan ${product.namaBarang} x${qty}`,
          jenisKas: jenisKas || jenis_kas || 'Kas Utama',
          nominal: totalInvoice,
          // Debit/Kredit di sini cuma label informasional (teks bebas,
          // bukan referensi akun) - konsisten dengan drop-nya Neraca.
          debit: paidAmount >= totalInvoice ? 'Kas Utama' : 'Piutang Usaha',
          kredit: jenisTrx.jenisAkun || jenisTrx.namaTransaksi,
          pelangganId: finalCustId ? parseInt(String(finalCustId)) : null,
          produkId: product.id,
          jumlah: qty,
          hargaSatuan: unitPrice,
          jumlahBayar: paidAmount,
          sisaPiutang,
          sumberOrder: finalOrderSrc,
          sumberInput: SumberInput.MANUAL,
          dibuatOleh: req.user!.id,
        },
      });

      if (finalCustId && sisaPiutang > 0) {
        await tx.dataPelanggan.update({
          where: { id: parseInt(String(finalCustId)) },
          data: { saldoPiutang: { increment: sisaPiutang } },
        });
      }

      return order;
    });

    await logManualAction(req.user!.id, 'transaksi', AksiLog.TAMBAH, result.kode, `Order dibuat: ${result.kode}`, result.id);

    res.json(successResponse(result));
  } catch (error) {
    next(error);
  }
});

// PUT /orders/:id (update pembayaran)
router.put('/:id', async (req: AuthRequest, res: Response, next) => {
  try {
    const id = parseInt(String(req.params.id));
    const { jumlah_bayar, jumlahBayar } = req.body;

    const paidInput = jumlahBayar ?? jumlah_bayar;
    if (paidInput === undefined) throw errorResponse('jumlahBayar (jumlah_bayar) wajib diisi');

    const jenisIds = await orderJenisIds();

    const result = await prisma.$transaction(async (tx) => {
      const existingOrder = await tx.transaksi.findFirst({
        where: { id, jenisTransaksiId: { in: jenisIds } },
        include: { pelanggan: true },
      });
      if (!existingOrder) throw errorResponse('Order tidak ditemukan', 404);

      const totalInvoice = Number(existingOrder.nominal);
      const newPaid = Number(paidInput);
      const paymentIncrease = newPaid - Number(existingOrder.jumlahBayar || 0);
      const newSisaPiutang = Math.max(0, totalInvoice - newPaid);

      const updatedOrder = await tx.transaksi.update({
        where: { id },
        data: {
          jumlahBayar: newPaid,
          sisaPiutang: newSisaPiutang,
          debit: newSisaPiutang <= 0 ? 'Kas Utama' : 'Piutang Usaha',
        },
      });

      if (existingOrder.pelangganId && paymentIncrease !== 0) {
        await tx.dataPelanggan.update({
          where: { id: existingOrder.pelangganId },
          data: { saldoPiutang: { decrement: paymentIncrease } },
        });
      }

      return updatedOrder;
    });

    await logManualAction(
      req.user!.id, 'transaksi', AksiLog.UBAH, result.kode,
      `Pembayaran order diubah: ${result.kode}`, result.id, {}, { jumlahBayar: paidInput }
    );

    res.json(successResponse(result));
  } catch (error) {
    next(error);
  }
});

// DELETE /orders/:id
router.delete('/:id', async (req: AuthRequest, res: Response, next) => {
  try {
    const id = parseInt(String(req.params.id));
    const jenisIds = await orderJenisIds();

    const order = await prisma.transaksi.findFirst({
      where: { id, jenisTransaksiId: { in: jenisIds } },
      include: { pelanggan: true, produk: true },
    });
    if (!order) throw errorResponse('Order tidak ditemukan', 404);

    await prisma.$transaction(async (tx) => {
      if (order.pelangganId && Number(order.sisaPiutang) > 0) {
        await tx.dataPelanggan.update({
          where: { id: order.pelangganId },
          data: { saldoPiutang: { decrement: Number(order.sisaPiutang) } },
        });
      }
      await tx.transaksi.delete({ where: { id } });
    });

    await logManualAction(req.user!.id, 'transaksi', AksiLog.HAPUS, order.kode, `Order dihapus: ${order.kode}`, order.id);

    res.json(successResponse({ message: 'Order berhasil dihapus' }));
  } catch (error) {
    next(error);
  }
});

export default router;
