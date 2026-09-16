import prisma from '../utils/database';

export interface CreateAuditLogParams {
  userId: number;
  sheet: 'TRANSAKSI' | 'STOK' | 'ORDER' | 'CUSTOMER' | 'SUPPLIER' | 'USER';
  action: 'CREATE' | 'UPDATE' | 'DELETE';
  source: 'AI' | 'MANUAL';
  command?: 'ADD' | 'ASK' | 'EDIT' | 'UNDO';
  recordLabel: string;
  detail?: string;
  perubahanJson?: any;
  inputText?: string;
  parsedResult?: any;
  targetTabel?: string;
  targetId?: number;
  status?: 'PENDING_CONFIRMATION' | 'CONFIRMED' | 'REJECTED' | 'UNDONE';
}

export const createAuditLog = async (params: CreateAuditLogParams) => {
  return await prisma.aiAuditLog.create({
    data: {
      userId: params.userId,
      sheet: params.sheet,
      action: params.action,
      source: params.source,
      command: params.command,
      recordLabel: params.recordLabel,
      detail: params.detail,
      perubahanJson: params.perubahanJson ? JSON.stringify(params.perubahanJson) : null,
      inputText: params.inputText,
      parsedResult: params.parsedResult ? JSON.stringify(params.parsedResult) : null,
      targetTabel: params.targetTabel,
      targetId: params.targetId,
      status: params.status || 'CONFIRMED',
      confirmedAt: params.status === 'CONFIRMED' ? new Date() : null,
    }
  });
};

export const logManualAction = async (
  userId: number,
  sheet: CreateAuditLogParams['sheet'],
  action: CreateAuditLogParams['action'],
  recordLabel: string,
  detail?: string,
  targetTabel?: string,
  targetId?: number,
  perubahanJson?: any
) => {
  return await createAuditLog({
    userId,
    sheet,
    action,
    source: 'MANUAL',
    recordLabel,
    detail,
    targetTabel,
    targetId,
    perubahanJson,
    status: 'CONFIRMED',
  });
};