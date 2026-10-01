import prisma from '../utils/database';
import { AksiLog, SumberInput } from '@prisma/client';

export interface CreateAuditLogParams {
  penggunaId: number;
  tabelTarget: string;
  targetId?: number;
  aksi: AksiLog;
  sumber: SumberInput;
  command?: string;
  labelRecord: string;
  detail?: string;
  dataSebelum?: any;
  dataSesudah?: any;
}

export const createAuditLog = async (params: CreateAuditLogParams) => {
  return await prisma.logAudit.create({
    data: {
      penggunaId: params.penggunaId,
      tabelTarget: params.tabelTarget,
      targetId: params.targetId || null,
      aksi: params.aksi,
      sumber: params.sumber,
      command: params.command || null,
      labelRecord: params.labelRecord,
      detail: params.detail || null,
      dataSebelum: params.dataSebelum ? JSON.stringify(params.dataSebelum) : null,
      dataSesudah: params.dataSesudah ? JSON.stringify(params.dataSesudah) : null,
    },
  });
};

export const logManualAction = async (
  penggunaId: number,
  tabelTarget: string,
  aksi: AksiLog,
  labelRecord: string,
  detail?: string,
  targetId?: number,
  dataSebelum?: any,
  dataSesudah?: any
) => {
  return await createAuditLog({
    penggunaId,
    tabelTarget,
    aksi,
    sumber: SumberInput.MANUAL,
    labelRecord,
    detail,
    targetId,
    dataSebelum,
    dataSesudah,
  });
};