export type AccountType = "ASSET" | "LIABILITY" | "EQUITY" | "REVENUE" | "EXPENSE";
export type NormalBalance = "DEBIT" | "CREDIT";

export interface AccountItem {
  id: string;
  code: string;
  name: string;
  parentCode?: string | null;
  accountType: AccountType;
  accountSubtype: string;
  tierLevel?: "Group" | "Class" | "Category" | "GL";
  normalBalance: NormalBalance;
  description?: string;
  openingBalance: number;
  currentBalance: number;
  currency: string;
  isGroup: boolean;
  status: "ACTIVE" | "INACTIVE";
  officeId?: string;
  createdAt: string;
  updatedAt: string;
}

export interface CoaPermissionItem {
  id: string;
  employeeName: string;
  employeeId: string;
  voucherType: string;
  accountHeadCode: string;
  accountHeadName: string;
  status: "ACTIVE" | "INACTIVE";
  createdAt: string;
}

export type VoucherStatus = "DRAFT" | "PENDING" | "POSTED" | "APPROVED" | "IN_PROGRESS" | "REVERSED" | "CANCELLED";
export type JournalType = "GENERAL" | "PAYMENT" | "RECEIPT" | "CONTRA" | "ADJUSTMENT" | "REVERSAL";

export interface JournalLineItem {
  id: string;
  accountId: string;
  accountCode: string;
  accountName: string;
  debit: number;
  credit: number;
  narration?: string;
  costCenterId?: string;
}

export interface JournalVoucher {
  id: string;
  voucherNumber: string;
  createDate?: string;
  transactionDate: string;
  officeId: string;
  officeName: string;
  fiscalYear: string;
  journalType: JournalType;
  transType?: string;
  narration: string;
  referenceNumber?: string;
  lines: JournalLineItem[];
  totalDebit: number;
  totalCredit: number;
  amount?: number;
  status: VoucherStatus;
  reversalOfId?: string;
  reversedById?: string;
  createdBy: string;
  preparedBy?: string;
  approvedBy?: string;
  postedAt?: string;
  createdAt: string;
}

export type ExpenseStatus = "DRAFT" | "PENDING" | "APPROVED" | "PAID" | "REJECTED";
export type PaymentMethod = "CASH" | "BANK" | "CHEQUE" | "ONLINE";

export interface ExpenseRecord {
  id: string;
  expenseNumber: string;
  code?: string;
  officeId: string;
  officeName: string;
  expenseType: string;
  accountId: string;
  accountName: string;
  chartOfAccount?: string;
  payeeName: string;
  partnerPayee?: string;
  amount: number;
  date: string;
  registrationDate?: string;
  transactionDate?: string;
  transactionNo?: string;
  registrationCode?: string;
  paymentMethod: PaymentMethod;
  referenceNumber?: string;
  description: string;
  status: ExpenseStatus;
  approvedBy?: string;
  paidAt?: string;
  createdAt: string;
}

export type AdvanceStatus = "DRAFT" | "PENDING" | "APPROVED" | "DISBURSED" | "SETTLED" | "PARTIAL";

export interface AdvanceRecord {
  id: string;
  advanceNumber: string;
  code?: string;
  employeeName: string;
  partnerPayee?: string;
  officeId: string;
  officeName: string;
  purpose: string;
  chartOfAccounts?: string;
  requestedAmount: number;
  approvedAmount: number;
  disbursedAmount: number;
  settledAmount: number;
  remainingBalance: number;
  amount?: number;
  date: string;
  status: AdvanceStatus;
  approvedBy?: string;
  createdAt: string;
}

export interface ProvisionRecord {
  id: string;
  provisionNumber: string;
  code?: string;
  officeId: string;
  officeName: string;
  expenseType?: string;
  accountId: string;
  accountName: string;
  chartOfAccount?: string;
  partnerPayee?: string;
  amount: number;
  date?: string;
  effectivePeriod: string;
  description: string;
  status: "DRAFT" | "POSTED" | "REVERSED" | "PENDING";
  postedAt?: string;
  createdAt: string;
}

export type FundTransferStatus =
  | "DRAFT"
  | "SUBMITTED"
  | "PENDING_APPROVAL"
  | "APPROVED"
  | "Approved"
  | "Completed"
  | "DISPATCHED"
  | "IN_TRANSIT"
  | "RECEIVED"
  | "RETURNED"
  | "CANCELLED";

export interface FundTransferRecord {
  id: string;
  transferNumber: string;
  requestCode: string;
  reqCode?: string;
  outCode?: string;
  receiveCode?: string;
  returnCode?: string;
  requestDate: string;
  expectedDate: string;
  date?: string;
  payDate?: string;
  receiveDate?: string;
  fromOfficeId: string;
  fromOfficeName: string;
  toOfficeId: string;
  toOfficeName: string;
  fromAccountId: string;
  fromAccountName: string;
  toAccountId: string;
  toAccountName: string;
  requestedAmount: number;
  approvedAmount: number;
  transferredAmount: number;
  receivedAmount: number;
  sentAmount?: number;
  remainingAmount?: number;
  receiveAmount?: number;
  responsiblePerson: string;
  receivedPerson?: string;
  transactionType?: string;
  purpose: string;
  referenceNumber?: string;
  status: FundTransferStatus | "Completed";
  dispatchedAt?: string;
  receivedAt?: string;
  approvalHistory?: Array<{ action: string; by: string; at: string; remarks?: string }>;
  createdAt: string;
}

export interface BankAccountItem {
  id: string;
  accountNumber: string;
  bankName: string;
  branchName: string;
  accountHolder: string;
  accountType: "CURRENT" | "SAVINGS" | "ESCROW" | "SALARY";
  currency: string;
  glAccountId: string;
  glAccountName: string;
  openingBalance: number;
  currentBalance: number;
  reconciliationStatus: "RECONCILED" | "PENDING_RECONCILIATION";
  isActive: boolean;
  createdAt: string;
}

export interface DepositItem {
  id: string;
  depositNumber: string;
  bankAccountId: string;
  bankName: string;
  depositType: "FIXED" | "TERM" | "DPS";
  principalAmount: number;
  interestRate: number;
  openingDate: string;
  maturityDate: string;
  maturityValue: number;
  interestEarned: number;
  status: "ACTIVE" | "MATURED" | "RENEWED" | "CLOSED";
}

export interface LoanItem {
  id: string;
  loanNumber: string;
  lenderName: string;
  loanType: "BANK_LOAN" | "TERM_LOAN" | "WORKING_CAPITAL" | "OTHER";
  principalAmount: number;
  interestRate: number;
  disbursementDate: string;
  maturityDate: string;
  installmentAmount: number;
  outstandingPrincipal: number;
  accruedInterest: number;
  status: "ACTIVE" | "PAID_OFF" | "DEFAULTED";
}

export interface FactoringItem {
  id: string;
  invoiceReference: string;
  factoringCompany: string;
  eligibleReceivable: number;
  advanceAmount: number;
  feesCharges: number;
  settlementStatus: "UNSETTLED" | "PARTIAL" | "SETTLED";
  remainingReceivable: number;
}

export interface ChequeBookItem {
  id: string;
  bookName: string;
  bankAccountId: string;
  bankName: string;
  accountNumber: string;
  startChequeNumber: string;
  endChequeNumber: string;
  totalLeaves: number;
  usedLeaves: number;
  remainingLeaves: number;
  status: "ACTIVE" | "EXHAUSTED" | "CANCELLED";
  createdAt: string;
}

export type ChequeStatus =
  | "ISSUED"
  | "CLEARED"
  | "BOUNCED"
  | "CANCELLED"
  | "POST_DATED";

export interface ChequeIssueItem {
  id: string;
  chequeNumber: string;
  bankAccountId: string;
  bankName: string;
  chequeBookId: string;
  transactionNumber: string;
  payeeName: string;
  issueDate: string;
  chequeDate: string;
  amount: number;
  purpose: string;
  referenceVoucher?: string;
  status: ChequeStatus;
  cancellationReason?: string;
  createdAt: string;
}

export interface CostCenterItem {
  id: string;
  code: string;
  name: string;
  type: "PROJECT" | "DEPARTMENT" | "BRANCH" | "PROFIT_CENTER";
  parentCenterId?: string | null;
  officeId: string;
  officeName: string;
  description?: string;
  effectiveDate: string;
  status: "ACTIVE" | "INACTIVE";
  createdAt: string;
}

export interface BudgetItem {
  id: string;
  budgetCode: string;
  budgetName: string;
  budgetYear: string;
  financialPeriod: string;
  officeId: string;
  officeName: string;
  costCenterId: string;
  costCenterName: string;
  budgetType: "OPERATING" | "CAPITAL" | "DEPARTMENT" | "PROJECT";
  accountId: string;
  accountName: string;
  allocatedAmount: number;
  revisedAmount: number;
  utilizedAmount: number;
  committedAmount: number;
  remainingAmount: number;
  approvalStatus: "DRAFT" | "SUBMITTED" | "APPROVED" | "REJECTED";
  createdBy: string;
  createdAt: string;
}

export interface GeneralLedgerEntry {
  date: string;
  voucherNumber: string;
  transactionType: string;
  narration: string;
  debit: number;
  credit: number;
  runningBalance: number;
  accountCode: string;
  accountName: string;
  officeName: string;
}
