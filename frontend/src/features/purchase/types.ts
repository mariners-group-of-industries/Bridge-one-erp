export type DocumentStatus =
  | "Draft"
  | "Submitted"
  | "Pending"
  | "Approved"
  | "Rejected"
  | "Ordered"
  | "Completed"
  | "Cancelled"
  | "Paid";

export interface RequisitionItem {
  id: string;
  itemCode: string;
  itemName: string;
  quantity: number;
  uom: string;
  estimatedRate: number;
  amount: number;
}

export interface PurchaseRequisition {
  id: string;
  prNumber: string;
  department: string;
  requestedBy: string;
  date: string;
  requiredDate: string;
  status: "Draft" | "Pending" | "Approved" | "Rejected" | "Ordered" | "Completed";
  priority: "High" | "Medium" | "Low";
  totalEstimated: number;
  itemCount: number;
  updatedAt: string;
  notes?: string;
}

export interface PurchaseOrder {
  id: string;
  poNumber: string;
  supplierName: string;
  requisitionRef?: string;
  orderDate: string;
  deliveryDate: string;
  status: "Draft" | "Submitted" | "Completed" | "Cancelled";
  subtotal: number;
  taxAmount: number;
  totalAmount: number;
  paymentTerms: string;
  updatedAt: string;
}

export interface PurchaseReceive {
  id: string;
  grnNumber: string;
  poNumber: string;
  supplierName: string;
  warehouse: string;
  receiveDate: string;
  status: "Pending" | "Approved" | "Completed";
  receivedQty: number;
  totalValue: number;
  updatedAt: string;
}

export interface PurchaseReturn {
  id: string;
  returnNumber: string;
  referenceDoc: string;
  supplierName: string;
  returnDate: string;
  status: "Draft" | "Pending" | "Approved" | "Completed";
  totalAmount: number;
  reason: string;
  updatedAt: string;
}

export interface SupplierPayment {
  id: string;
  voucherNumber: string;
  supplierName: string;
  invoiceRef: string;
  paymentDate: string;
  amountPaid: number;
  paymentMethod: "Bank Transfer" | "Cheque" | "Cash" | "Online";
  status: "Paid" | "Pending" | "Cancelled";
  ledgerBalance: number;
  updatedAt: string;
}
