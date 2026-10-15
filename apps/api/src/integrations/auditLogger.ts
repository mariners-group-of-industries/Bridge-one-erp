export interface AuditLogEntry {
  id: string;
  companyId: string;
  entityType: "REQUISITION" | "ORDER" | "GRN" | "RETURN" | "PAYMENT";
  entityId: string;
  docNumber: string;
  action: "CREATE" | "UPDATE" | "SUBMIT" | "APPROVE" | "REJECT" | "RECEIVE" | "RETURN" | "EXPORT";
  userId: string;
  userName: string;
  timestamp: string;
  details?: Record<string, any>;
}

export const auditLogsStore: AuditLogEntry[] = [];

export class AuditService {
  static record(entry: Omit<AuditLogEntry, "id" | "timestamp">): AuditLogEntry {
    const record: AuditLogEntry = {
      ...entry,
      id: `audit-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      timestamp: new Date().toISOString(),
    };
    auditLogsStore.unshift(record);
    if (auditLogsStore.length > 500) {
      auditLogsStore.pop();
    }
    return record;
  }

  static getHistory(entityType?: string, entityId?: string): AuditLogEntry[] {
    return auditLogsStore.filter((log) => {
      if (entityType && log.entityType !== entityType) return false;
      if (entityId && log.entityId !== entityId) return false;
      return true;
    });
  }
}
