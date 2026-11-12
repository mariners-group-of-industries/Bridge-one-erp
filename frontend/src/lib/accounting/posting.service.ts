import { Prisma } from "@/generated/prisma/client";
import { badRequest } from "@/lib/api/errors";
import { db } from "@/lib/prisma/client";
import {
  POSTING_KEYS,
  billLines,
  collectionLines,
  fiscalYearOf,
  isBalanced,
  payrollLines,
  receiptLines,
  reverse,
  saleLines,
  stockValueLines,
  supplierPaymentLines,
  type Journal,
  type PostingKey,
  type RuleLine,
} from "./posting-rules";

/**
 * Posts documents of every module to the general ledger. Each document makes
 * one voucher (JournalVoucher.sourceType + sourceId, unique), so running the
 * sweep again posts only what is new; a document whose roles are not mapped yet
 * waits until they are. A cancelled document that was posted gets a reversing
 * voucher ("<TYPE>_CANCEL").
 */

const num = (value: unknown) => Number(value ?? 0);
const cost = (lines: { qty: unknown; item: { purchasePrice: unknown } }[]) => lines.reduce((t, l) => t + num(l.qty) * num(l.item.purchasePrice), 0);
const BATCH = 500;

interface Pending {
  id: string;
  journal: Journal;
}

interface SourceDef {
  type: string;
  label: string;
  /** Documents to post, other than those already posted. */
  pending: (posted: string[]) => Promise<Pending[]>;
  /** Posted documents that have since been cancelled. */
  cancelled?: (posted: string[]) => Promise<string[]>;
}

const notIn = (posted: string[]) => (posted.length ? { id: { notIn: posted } } : {});
const itemCost = { select: { qty: true, item: { select: { purchasePrice: true } } } } as const;

const SOURCES: SourceDef[] = [
  {
    type: "SALES_DELIVERY",
    label: "Sales invoices (deliveries)",
    pending: async (posted) =>
      (
        await db().salesDelivery.findMany({
          where: { status: "SUBMITTED", ...notIn(posted) },
          select: { id: true, number: true, deliveryDate: true, officeId: true, totalAmount: true, vatAmount: true, lines: itemCost },
          take: BATCH,
        })
      ).map((d) => ({
        id: d.id,
        journal: {
          date: d.deliveryDate,
          number: d.number,
          narration: `Sales invoice ${d.number}`,
          officeId: d.officeId,
          lines: saleLines({ total: num(d.totalAmount), vat: num(d.vatAmount), cost: cost(d.lines) }),
        },
      })),
    cancelled: async (posted) =>
      posted.length ? (await db().salesDelivery.findMany({ where: { id: { in: posted }, status: "CANCELLED" }, select: { id: true } })).map((d) => d.id) : [],
  },
  {
    type: "SALES_RETURN",
    label: "Sales returns",
    pending: async (posted) =>
      (
        await db().salesReturn.findMany({
          where: { status: "SUBMITTED", ...notIn(posted) },
          select: { id: true, number: true, returnDate: true, officeId: true, totalAmount: true, vatAmount: true, lines: itemCost },
          take: BATCH,
        })
      ).map((r) => ({
        id: r.id,
        journal: {
          date: r.returnDate,
          number: r.number,
          narration: `Sales return ${r.number}`,
          officeId: r.officeId,
          lines: reverse(saleLines({ total: num(r.totalAmount), vat: num(r.vatAmount), cost: cost(r.lines) })),
        },
      })),
    cancelled: async (posted) =>
      posted.length ? (await db().salesReturn.findMany({ where: { id: { in: posted }, status: "CANCELLED" }, select: { id: true } })).map((d) => d.id) : [],
  },
  {
    type: "SALES_COLLECTION",
    label: "Customer collections",
    pending: async (posted) =>
      (
        await db().salesCollection.findMany({
          where: { status: "SUBMITTED", ...notIn(posted) },
          select: {
            id: true,
            number: true,
            collectionDate: true,
            officeId: true,
            amount: true,
            method: true,
            cashAccountId: true,
            adjustAccountId: true,
            deductions: { select: { accountId: true, amount: true } },
          },
          take: BATCH,
        })
      ).map((c) => ({
        id: c.id,
        journal: {
          date: c.collectionDate,
          number: c.number,
          narration: `Collection ${c.number}`,
          officeId: c.officeId,
          lines: collectionLines({
            amount: num(c.amount),
            method: c.method,
            cashAccountId: c.cashAccountId,
            adjustAccountId: c.adjustAccountId,
            deductions: c.deductions.map((d) => ({ accountId: d.accountId, amount: num(d.amount) })),
          }),
        },
      })),
    cancelled: async (posted) =>
      posted.length ? (await db().salesCollection.findMany({ where: { id: { in: posted }, status: "CANCELLED" }, select: { id: true } })).map((d) => d.id) : [],
  },
  {
    type: "PURCHASE_RECEIPT",
    label: "Goods receipts",
    pending: async (posted) =>
      (
        await db().goodsReceipt.findMany({
          where: { status: "RECEIVED", ...notIn(posted) },
          select: { id: true, number: true, receiveDate: true, officeId: true, totalAmount: true },
          take: BATCH,
        })
      ).map((g) => ({
        id: g.id,
        journal: { date: g.receiveDate, number: g.number, narration: `Goods receipt ${g.number}`, officeId: g.officeId, lines: receiptLines(num(g.totalAmount)) },
      })),
    cancelled: async (posted) =>
      posted.length ? (await db().goodsReceipt.findMany({ where: { id: { in: posted }, status: "CANCELLED" }, select: { id: true } })).map((d) => d.id) : [],
  },
  {
    type: "PURCHASE_RETURN",
    label: "Purchase returns",
    pending: async (posted) =>
      (
        await db().purchaseReturn.findMany({
          where: { status: "COMPLETED", ...notIn(posted) },
          select: { id: true, number: true, returnDate: true, officeId: true, totalAmount: true },
          take: BATCH,
        })
      ).map((r) => ({
        id: r.id,
        journal: { date: r.returnDate, number: r.number, narration: `Purchase return ${r.number}`, officeId: r.officeId, lines: reverse(receiptLines(num(r.totalAmount))) },
      })),
    cancelled: async (posted) =>
      posted.length ? (await db().purchaseReturn.findMany({ where: { id: { in: posted }, status: "CANCELLED" }, select: { id: true } })).map((r) => r.id) : [],
  },
  {
    type: "SUPPLIER_BILL",
    label: "Supplier bills without goods",
    pending: async (posted) =>
      (
        await db().supplierBill.findMany({
          where: { receiptId: null, status: { not: "CANCELLED" }, ...notIn(posted) },
          select: { id: true, number: true, billDate: true, amount: true },
          take: BATCH,
        })
      ).map((b) => ({ id: b.id, journal: { date: b.billDate, number: b.number, narration: `Supplier bill ${b.number}`, lines: billLines(num(b.amount)) } })),
    cancelled: async (posted) =>
      posted.length ? (await db().supplierBill.findMany({ where: { id: { in: posted }, status: "CANCELLED" }, select: { id: true } })).map((d) => d.id) : [],
  },
  {
    type: "SUPPLIER_PAYMENT",
    label: "Supplier payments",
    pending: async (posted) =>
      (
        await db().supplierPayment.findMany({
          where: { status: "PAID", ...notIn(posted) },
          select: { id: true, number: true, paymentDate: true, officeId: true, amount: true, method: true, cashAccountId: true, bankAccount: { select: { glAccountId: true } } },
          take: BATCH,
        })
      ).map((p) => ({
        id: p.id,
        journal: {
          date: p.paymentDate,
          number: p.number,
          narration: `Supplier payment ${p.number}`,
          officeId: p.officeId,
          lines: supplierPaymentLines(num(p.amount), p.method, p.cashAccountId ?? p.bankAccount?.glAccountId),
        },
      })),
    cancelled: async (posted) =>
      posted.length ? (await db().supplierPayment.findMany({ where: { id: { in: posted }, status: "CANCELLED" }, select: { id: true } })).map((d) => d.id) : [],
  },
  {
    type: "POS_SALE",
    label: "POS sales",
    // Every sale posts when made; a void posts its own reversal (POS_SALE_CANCEL).
    pending: async (posted) =>
      (
        await db().posSale.findMany({
          where: notIn(posted),
          select: { id: true, number: true, saleDate: true, total: true, vatAmount: true, paymentMethod: true, lines: itemCost, warehouse: { select: { officeId: true } } },
          take: BATCH,
        })
      ).map((s) => ({
        id: s.id,
        journal: {
          date: s.saleDate,
          number: s.number,
          narration: `POS sale ${s.number}`,
          officeId: s.warehouse.officeId,
          lines: saleLines({ total: num(s.total), vat: num(s.vatAmount), cost: cost(s.lines), debitKey: s.paymentMethod === "CASH" ? "CASH" : "BANK" }),
        },
      })),
    cancelled: async (posted) =>
      posted.length ? (await db().posSale.findMany({ where: { id: { in: posted }, status: "VOIDED" }, select: { id: true } })).map((d) => d.id) : [],
  },
  {
    type: "INVENTORY",
    label: "Stock updates, store issues and conversions",
    pending: async (posted) =>
      (
        await db().inventoryDocument.findMany({
          where: { type: { in: ["STOCK_UPDATE", "STORE_ISSUE", "CONVERSION"] }, status: "COMPLETED", ...notIn(posted) },
          select: {
            id: true,
            type: true,
            number: true,
            docDate: true,
            warehouse: { select: { officeId: true } },
            lines: { select: { qty: true, toQty: true, item: { select: { purchasePrice: true } }, toItem: { select: { purchasePrice: true } } } },
          },
          take: BATCH,
        })
      ).map((d) => {
        // At cost: updates add (or remove) their value, issues remove it, conversions post the difference.
        const value = d.lines.reduce((t, l) => {
          const out = num(l.qty) * num(l.item.purchasePrice);
          if (d.type === "STORE_ISSUE") return t - out;
          if (d.type === "CONVERSION") return t + num(l.toQty) * num(l.toItem?.purchasePrice) - out;
          return t + out;
        }, 0);
        return { id: d.id, journal: { date: d.docDate, number: d.number, narration: `Inventory ${d.number}`, officeId: d.warehouse?.officeId, lines: stockValueLines(value) } };
      }),
  },
  {
    type: "PAYROLL",
    label: "Processed payroll",
    pending: async (posted) =>
      (await db().payrollRun.findMany({ where: notIn(posted), select: { id: true, month: true, toDate: true, officeId: true, netAmount: true }, take: BATCH })).map((p) => ({
        id: p.id,
        journal: { date: p.toDate, number: `PAY-${p.month}`, narration: `Payroll ${p.month}`, officeId: p.officeId, lines: payrollLines(num(p.netAmount)) },
      })),
  },
];

export const POSTING_SOURCES = SOURCES.map((s) => ({ type: s.type, label: s.label }));

type Tx = Prisma.TransactionClient;

class MissingRoles extends Error {
  constructor(readonly keys: PostingKey[]) {
    super("Posting roles not mapped");
  }
}

async function mapping(): Promise<Map<string, string>> {
  return new Map((await db().postingAccount.findMany()).map((p) => [p.key, p.accountId]));
}

async function postedIds(type: string): Promise<string[]> {
  return (await db().journalVoucher.findMany({ where: { sourceType: type }, select: { sourceId: true } })).map((v) => v.sourceId!).filter(Boolean);
}

/** Writes one voucher and moves the account balances, in one transaction. */
async function writeVoucher(type: string, sourceId: string, journal: Journal, roles: Map<string, string>, createdBy: string) {
  const missing = [...new Set(journal.lines.filter((l) => l.key && !roles.has(l.key)).map((l) => l.key!))];
  if (missing.length) throw new MissingRoles(missing);
  if (!isBalanced(journal.lines)) return "skipped" as const; // nothing to post (zero amounts)

  const lines = journal.lines.map((l) => ({ ...l, accountId: l.accountId ?? roles.get(l.key!)! }));
  await db().$transaction(async (tx: Tx) => {
    const accounts = new Map(
      (await tx.account.findMany({ where: { id: { in: [...new Set(lines.map((l) => l.accountId))] } }, select: { id: true, code: true, name: true, normalBalance: true } })).map((a) => [a.id, a]),
    );
    const office = journal.officeId ? await tx.office.findUnique({ where: { id: journal.officeId }, select: { name: true } }) : null;
    const debit = lines.reduce((t, l) => t + l.debit, 0);
    const prefix = type.replace("_CANCEL", "").split("_").map((w) => w[0]).join("");
    await tx.journalVoucher.create({
      data: {
        voucherNumber: `${prefix}${type.endsWith("_CANCEL") ? "R" : ""}-${journal.number}-${sourceId.slice(0, 4)}`,
        transactionDate: journal.date,
        officeId: journal.officeId ?? null,
        officeName: office?.name ?? null,
        fiscalYear: fiscalYearOf(journal.date),
        journalType: "SYSTEM",
        transType: type,
        narration: journal.narration,
        referenceNumber: journal.number,
        totalDebit: debit,
        totalCredit: debit,
        amount: debit,
        status: "POSTED",
        createdBy,
        preparedBy: createdBy,
        approvedBy: createdBy,
        postedAt: new Date(),
        sourceType: type,
        sourceId,
        lines: {
          create: lines.map((l, i) => {
            const account = accounts.get(l.accountId);
            return {
              lineNo: i + 1,
              accountId: l.accountId,
              accountCode: account?.code ?? "",
              accountName: account?.name ?? "",
              debit: l.debit,
              credit: l.credit,
              narration: l.narration ?? null,
            };
          }),
        },
      },
    });
    for (const l of lines) {
      const account = accounts.get(l.accountId);
      if (!account) continue;
      const change = account.normalBalance === "DEBIT" ? l.debit - l.credit : l.credit - l.debit;
      await tx.account.update({ where: { id: l.accountId }, data: { currentBalance: { increment: change } } });
    }
  });
  return "posted" as const;
}

export interface PostingRun {
  posted: Record<string, number>;
  /** Roles that stopped documents from posting. */
  missing: { key: PostingKey; label: string }[];
  failed: number;
}

/** Posts every document not posted yet (and reverses cancelled ones). Safe to run at any time. */
export async function postPendingDocuments(createdBy = "System (auto-posting)"): Promise<PostingRun> {
  const roles = await mapping();
  const result: PostingRun = { posted: {}, missing: [], failed: 0 };
  const missing = new Set<PostingKey>();

  for (const source of SOURCES) {
    const posted = await postedIds(source.type);
    let count = 0;
    for (const doc of await source.pending(posted)) {
      try {
        if ((await writeVoucher(source.type, doc.id, doc.journal, roles, createdBy)) === "posted") count++;
      } catch (error) {
        if (error instanceof MissingRoles) error.keys.forEach((k) => missing.add(k));
        // Another sweep posted it first (unique source): nothing to do.
        else if (!(error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002")) {
          result.failed++;
          console.error("[posting]", source.type, doc.id, error);
        }
      }
    }
    if (source.cancelled) {
      const reversed = new Set(await postedIds(`${source.type}_CANCEL`));
      for (const id of (await source.cancelled(posted)).filter((id) => !reversed.has(id))) {
        const original = await db().journalVoucher.findUnique({
          where: { sourceType_sourceId: { sourceType: source.type, sourceId: id } },
          include: { lines: true },
        });
        if (!original) continue;
        const lines: RuleLine[] = reverse(original.lines.map((l) => ({ accountId: l.accountId ?? undefined, debit: num(l.debit), credit: num(l.credit), narration: l.narration ?? undefined })));
        try {
          await writeVoucher(
            `${source.type}_CANCEL`,
            id,
            { date: new Date(), number: original.referenceNumber ?? original.voucherNumber, narration: `Cancelled: ${original.narration}`, officeId: original.officeId, lines },
            roles,
            createdBy,
          );
          count++;
        } catch (error) {
          if (!(error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002")) {
            result.failed++;
            console.error("[posting]", `${source.type}_CANCEL`, id, error);
          }
        }
      }
    }
    if (count) result.posted[source.type] = count;
  }
  result.missing = [...missing].map((key) => ({ key, label: POSTING_KEYS[key] }));
  return result;
}

/** What Posting Setup shows: the mapping and how many documents wait per type. */
export async function postingStatus() {
  const [roles, accounts] = await Promise.all([
    db().postingAccount.findMany(),
    db().account.findMany({ where: { isGroup: false, status: "ACTIVE" }, select: { id: true, code: true, name: true, accountType: true }, orderBy: { code: "asc" } }),
  ]);
  const waiting: { type: string; label: string; waiting: number; posted: number }[] = [];
  for (const source of SOURCES) {
    const posted = await postedIds(source.type);
    waiting.push({ type: source.type, label: source.label, waiting: (await source.pending(posted)).length, posted: posted.length });
  }
  return {
    roles: (Object.keys(POSTING_KEYS) as PostingKey[]).map((key) => ({ key, label: POSTING_KEYS[key], accountId: roles.find((r) => r.key === key)?.accountId ?? null })),
    accounts,
    sources: waiting,
  };
}

export async function savePostingRoles(input: Record<string, string | null>, updatedBy: string) {
  const keys = Object.keys(input).filter((k): k is PostingKey => k in POSTING_KEYS);
  const accountIds = [...new Set(keys.map((k) => input[k]).filter((v): v is string => !!v))];
  const found = await db().account.count({ where: { id: { in: accountIds }, isGroup: false } });
  if (found !== accountIds.length) throw badRequest("Choose ledger accounts (not group accounts).");
  await db().$transaction(
    keys.map((key) =>
      input[key]
        ? db().postingAccount.upsert({ where: { key }, create: { key, accountId: input[key]!, updatedBy }, update: { accountId: input[key]!, updatedBy } })
        : db().postingAccount.deleteMany({ where: { key } }),
    ),
  );
}
