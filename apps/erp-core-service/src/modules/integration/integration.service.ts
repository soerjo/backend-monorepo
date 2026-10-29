import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service.js';
import { WmsGoodsReceivedDto } from './dto/wms-receipt.dto.js';
import { EntrySource, PoStatus, Prisma } from '@prisma/client';

@Injectable()
export class IntegrationService {
  constructor(private readonly prisma: PrismaService) {}

  async handleWmsGoodsReceived(dto: WmsGoodsReceivedDto) {
    const po = await this.prisma.purchaseOrder.findUnique({
      where: { poNumber: dto.poNumber },
      include: {
        items: {
          include: {
            product: true,
          },
        },
      },
    });

    if (!po) {
      throw new NotFoundException(`Purchase Order '${dto.poNumber}' not found`);
    }

    // Execute in ACID transaction: update PO received quantities, create Journal Entry for Inventory vs AP
    return this.prisma.$transaction(async (tx) => {
      let totalReceivedValue = 0;

      for (const recItem of dto.receivedItems) {
        const poItem = po.items.find((i) => i.product.sku === recItem.sku);
        if (poItem) {
          const itemVal = Number(recItem.qtyReceived) * Number(poItem.unitPrice);
          totalReceivedValue += itemVal;

          await tx.purchaseOrderItem.update({
            where: { id: poItem.id },
            data: {
              qtyReceived: {
                increment: recItem.qtyReceived,
              },
            },
          });
        }
      }

      // Find or create default COA accounts for Inventory (11300) and AP (21100)
      let inventoryAccount = await tx.chartOfAccount.findUnique({
        where: { code: '11300' },
      });
      if (!inventoryAccount) {
        inventoryAccount = await tx.chartOfAccount.create({
          data: {
            code: '11300',
            name: 'Persediaan Barang Dagang (Inventory)',
            type: 'ASSET',
          },
        });
      }

      let apAccount = await tx.chartOfAccount.findUnique({
        where: { code: '21100' },
      });
      if (!apAccount) {
        apAccount = await tx.chartOfAccount.create({
          data: {
            code: '21100',
            name: 'Hutang Usaha (Accounts Payable)',
            type: 'LIABILITY',
          },
        });
      }

      const entryNumber = `JE-GRN-${Date.now()}-${Math.floor(100 + Math.random() * 900)}`;

      const journal = await tx.journalEntry.create({
        data: {
          entryNumber,
          entryDate: new Date(),
          source: EntrySource.WMS_MOVEMENT,
          referenceId: dto.wmsReceiptId,
          memo: `Penerimaan Barang Gudang PO ${dto.poNumber} (GRN: ${dto.wmsReceiptId})`,
          isPosted: true,
          postedAt: new Date(),
          createdBy: po.createdBy,
          lines: {
            create: [
              {
                accountId: inventoryAccount.id,
                debit: new Prisma.Decimal(totalReceivedValue),
                credit: new Prisma.Decimal(0),
                lineDescription: `Penerimaan fisik barang PO ${dto.poNumber}`,
              },
              {
                accountId: apAccount.id,
                debit: new Prisma.Decimal(0),
                credit: new Prisma.Decimal(totalReceivedValue),
                lineDescription: `Hutang belum difakturkan PO ${dto.poNumber}`,
              },
            ],
          },
        },
      });

      // Update PO status to PARTIALLY_RECEIVED or COMPLETED
      await tx.purchaseOrder.update({
        where: { id: po.id },
        data: {
          status: PoStatus.PARTIALLY_RECEIVED,
        },
      });

      // Outbox notification for Billing service (to draft AP invoice)
      await tx.outboxEvent.create({
        data: {
          aggregateType: 'PURCHASE_ORDER',
          aggregateId: po.id,
          eventType: 'erp.goods_receipt.reconciled',
          payload: {
            poNumber: po.poNumber,
            wmsReceiptId: dto.wmsReceiptId,
            journalEntryId: journal.id,
            receivedValue: totalReceivedValue,
            vendorId: po.vendorId,
          },
        },
      });

      return {
        status: 'success',
        message: 'Inventory receipt reconciled and journal entry posted',
        journal_entry_id: journal.id,
      };
    });
  }
}
