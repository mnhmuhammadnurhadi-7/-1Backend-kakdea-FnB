import { Router, Request, Response } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth';
import { successResponse, errorResponse } from '../utils/response';
import prisma from '../utils/database';
import { createFromSource, deleteBySource } from '../services/journalService';
import { logManualAction } from '../services/auditLogService';

const router = Router();

router.use(authenticate);

// GET /orders
router.get('/', async (req: AuthRequest, res: Response, next) => {
  try {
    const { business_unit, jenis_order, customer_id, tanggal_mulai, tanggal_selesai } = req.query;
    
    const where: any = {};
    if (business_unit) {
      where.businessUnit = business_unit;
    }
    if (jenis_order) {
      where.jenisOrder = jenis_order;
    }
    if (customer_id) {
      where.customerId = parseInt(customer_id as string);
    }
    if (tanggal_mulai || tanggal_selesai) {
      where.tanggal = {};
      if (tanggal_mulai) {
        where.tanggal.gte = new Date(tanggal_mulai as string);
      }
      if (tanggal_selesai) {
        where.tanggal.lte = new Date(tanggal_selesai as string);
      }
    }

    const orders = await prisma.order.findMany({
      where,
      include: {
        customer: true,
        product: true,
      },
      orderBy: { tanggal: 'desc' }
    });

    res.json(successResponse(orders));
  } catch (error) {
    next(error);
  }
});

// GET /orders/:id
router.get('/:id', async (req: AuthRequest, res: Response, next) => {
  try {
    const order = await prisma.order.findUnique({
      where: { id: parseInt(String(req.params.id)) },
      include: {
        customer: true,
        product: true,
        journalEntry: {
          include: {
            lines: true
          }
        }
      }
    });

    if (!order) {
      throw errorResponse('Order not found', 404);
    }

    res.json(successResponse(order));
  } catch (error) {
    next(error);
  }
});

// POST /orders
router.post('/', async (req: AuthRequest, res: Response, next) => {
  try {
    const { 
      tanggal, 
      business_unit, 
      jenis_order, 
      customer_id, 
      nama_pemesan, 
      product_id, 
      keterangan, 
      jumlah_pesan, 
      harga_satuan, 
      jumlah_bayar, 
      jenis_kas 
    } = req.body;
    
    if (!tanggal || !business_unit || !jenis_order || !product_id || !jumlah_pesan || !harga_satuan) {
      throw errorResponse('Missing required fields');
    }

    const total_invoice = Number(jumlah_pesan) * Number(harga_satuan);
    const sisa_piutang = total_invoice - Number(jumlah_bayar || 0);

    const result = await prisma.$transaction(async (tx) => {
      // Generate order code
      const count = await tx.order.count();
      const kode_order = `JO${String(count + 1).padStart(2, '0')}`;

      // Get product for transaction type resolution
      const product = await tx.product.findUnique({
        where: { id: product_id }
      });

      if (!product) {
        throw errorResponse('Product not found', 404);
      }

      // Create order
      const order = await tx.order.create({
        data: {
          kodeOrder: kode_order,
          tanggal: new Date(tanggal),
          businessUnit: business_unit,
          jenisOrder: jenis_order,
          customerId: customer_id,
          namaPemesan: nama_pemesan,
          productId: product_id,
          keterangan,
          jumlahPesan: jumlah_pesan,
          hargaSatuan: harga_satuan,
          totalInvoice: total_invoice,
          jumlahBayar: jumlah_bayar || 0,
          sisaPiutang: sisa_piutang,
          jenisKas: jenis_kas,
          sumberInput: 'MANUAL',
        }
      });

      // Determine income account based on order type
      let incomeAccount = '41000'; // Default FROZEN
      if (jenis_order === 'MAKLON') incomeAccount = '42000';
      else if (jenis_order === 'BOOTH') incomeAccount = '43000';
      else if (jenis_order === 'PESANAN') incomeAccount = '44000';
      else if (jenis_order === 'WA' || jenis_order === 'DM_INSTAGRAM' || jenis_order === 'GRABFOOD') incomeAccount = '49000';

      // Create journal entry
      const journalEntry = await createFromSource({
        tanggal: new Date(tanggal),
        deskripsi: `Order ${kode_order} - ${product.namaBarang}`,
        sumberTabel: 'ORDER',
        sumberId: order.id,
        businessUnit: business_unit,
        dibuatOleh: req.user!.id,
        viaAi: false,
        lines: [
          {
            akunKode: '11210', // Piutang Usaha
            debit: total_invoice,
            kredit: 0,
          },
          {
            akunKode: incomeAccount,
            debit: 0,
            kredit: total_invoice,
          }
        ]
      });

      // Update order with journal entry ID
      await tx.order.update({
        where: { id: order.id },
        data: { journalEntryId: journalEntry.id }
      });

      // Update customer accounts receivable if customer exists
      if (customer_id) {
        await tx.customer.update({
          where: { id: customer_id },
          data: {
            saldoPiutang: { increment: sisa_piutang }
          }
        });
      }

      // Create stock movement (KELUAR)
      await tx.stockMovement.create({
        data: {
          productId: product_id,
          tanggal: new Date(tanggal),
          tipe: 'KELUAR',
          jumlah: jumlah_pesan,
          keterangan: `Order ${kode_order}`,
          orderId: order.id,
          sumberInput: 'MANUAL',
        }
      });

      // Update product stock
      await tx.product.update({
        where: { id: product_id },
        data: {
          stokSaatIni: { decrement: jumlah_pesan }
        }
      });

      return order;
    });

    await logManualAction(
      req.user!.id,
      'ORDER',
      'CREATE',
      result.kodeOrder,
      `Order created: ${result.kodeOrder}`,
      'orders',
      result.id
    );

    res.json(successResponse(result));
  } catch (error) {
    next(error);
  }
});

// PUT /orders/:id (update payment)
router.put('/:id', async (req: AuthRequest, res: Response, next) => {
  try {
    const id = parseInt(String(req.params.id));
    const { jumlah_bayar } = req.body;
    
    if (jumlah_bayar === undefined) {
      throw errorResponse('jumlah_bayar is required');
    }

    const result = await prisma.$transaction(async (tx) => {
      const existingOrder = await tx.order.findUnique({
        where: { id },
        include: { customer: true }
      });

      if (!existingOrder) {
        throw errorResponse('Order not found', 404);
      }

      const paymentIncrease = Number(jumlah_bayar) - Number(existingOrder.jumlahBayar);
      const newSisaPiutang = Number(existingOrder.totalInvoice) - Number(jumlah_bayar);

      // Update order
      const updatedOrder = await tx.order.update({
        where: { id },
        data: {
          jumlahBayar: Number(jumlah_bayar),
          sisaPiutang: newSisaPiutang,
        }
      });

      // Update customer accounts receivable if customer exists
      if (existingOrder.customerId) {
        await tx.customer.update({
          where: { id: existingOrder.customerId },
          data: {
            saldoPiutang: { decrement: paymentIncrease }
          }
        });
      }

      return updatedOrder;
    });

    await logManualAction(
      req.user!.id,
      'ORDER',
      'UPDATE',
      result.kodeOrder,
      `Order payment updated: ${result.kodeOrder}`,
      'orders',
      result.id,
      { field: 'jumlah_bayar', sebelum: '', sesudah: String(jumlah_bayar) }
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
    
    const order = await prisma.order.findUnique({
      where: { id },
      include: { customer: true, product: true }
    });

    if (!order) {
      throw errorResponse('Order not found', 404);
    }

    await prisma.$transaction(async (tx) => {
      // Delete journal entry
      await deleteBySource('ORDER', id);

      // Reverse stock movement
      await tx.stockMovement.deleteMany({
        where: { orderId: id }
      });

      // Restore product stock
      await tx.product.update({
        where: { id: order.productId },
        data: {
          stokSaatIni: { increment: order.jumlahPesan }
        }
      });

      // Reverse customer accounts receivable
      if (order.customerId) {
        await tx.customer.update({
          where: { id: order.customerId },
          data: {
            saldoPiutang: { decrement: order.sisaPiutang }
          }
        });
      }

      // Delete order
      await tx.order.delete({
        where: { id }
      });
    });

    await logManualAction(
      req.user!.id,
      'ORDER',
      'DELETE',
      order.kodeOrder,
      `Order deleted: ${order.kodeOrder}`,
      'orders',
      order.id
    );

    res.json(successResponse({ message: 'Order deleted successfully' }));
  } catch (error) {
    next(error);
  }
});

export default router;