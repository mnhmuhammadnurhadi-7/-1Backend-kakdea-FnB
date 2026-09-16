import prisma from '../utils/database';
import { JournalEntry, JournalEntryLine } from '@prisma/client';

export interface CreateJournalEntryParams {
  tanggal: Date;
  deskripsi: string;
  sumberTabel: 'ORDER' | 'DIRECT_COST' | 'INDIRECT_COST' | 'CASH_TRANSACTION' | 'DEBT_PAYMENT' | 'MANUAL';
  sumberId?: number;
  businessUnit: 'PABRIK' | 'DISTRIBUTOR' | 'NEXT_LEVEL';
  dibuatOleh: number;
  viaAi?: boolean;
  lines: Array<{
    akunKode: string;
    debit: number;
    kredit: number;
  }>;
}

export const createFromSource = async (params: CreateJournalEntryParams): Promise<JournalEntry> => {
  return await prisma.$transaction(async (tx) => {
    // Create journal entry
    const journalEntry = await tx.journalEntry.create({
      data: {
        tanggal: params.tanggal,
        deskripsi: params.deskripsi,
        sumberTabel: params.sumberTabel,
        sumberId: params.sumberId,
        businessUnit: params.businessUnit,
        dibuatOleh: params.dibuatOleh,
        viaAi: params.viaAi || false,
      }
    });

    // Create journal entry lines
    for (const line of params.lines) {
      await tx.journalEntryLine.create({
        data: {
          journalEntryId: journalEntry.id,
          akunKode: line.akunKode,
          debit: line.debit,
          kredit: line.kredit,
        }
      });
    }

    return journalEntry;
  });
};

export const deleteBySource = async (sumberTabel: string, sumberId: number): Promise<void> => {
  await prisma.journalEntry.deleteMany({
    where: {
      sumberTabel: sumberTabel as any,
      sumberId: sumberId,
    }
  });
};