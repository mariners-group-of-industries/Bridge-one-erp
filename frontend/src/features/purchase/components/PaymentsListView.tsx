"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { PageContainer, PageHead } from "@/components/layout/page";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/section";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Indicator, type IndicatorColor } from "@/components/ui/indicator";
import { initialPayments } from "../mock-data";
import type { SupplierPayment } from "../types";

function getStatusColor(status: SupplierPayment["status"]): IndicatorColor {
  switch (status) {
    case "Paid":
      return "green";
    case "Pending":
      return "orange";
    case "Cancelled":
    default:
      return "red";
  }
}

export function PaymentsListView() {
  const [rows] = useState<SupplierPayment[]>(initialPayments);

  const columns: Column<SupplierPayment>[] = [
    {
      id: "voucherNumber",
      header: "Payment Voucher",
      sortValue: (r) => r.voucherNumber,
      cell: (r) => <span className="font-semibold text-ink">{r.voucherNumber}</span>,
    },
    {
      id: "supplierName",
      header: "Supplier",
      sortValue: (r) => r.supplierName,
      cell: (r) => <span className="text-ink">{r.supplierName}</span>,
    },
    {
      id: "invoiceRef",
      header: "Bill Ref",
      sortValue: (r) => r.invoiceRef,
      cell: (r) => <span className="text-ink-muted">{r.invoiceRef}</span>,
      hideBelow: "sm",
    },
    {
      id: "paymentDate",
      header: "Payment Date",
      sortValue: (r) => r.paymentDate,
      cell: (r) => <span className="text-ink-muted">{r.paymentDate}</span>,
      hideBelow: "md",
    },
    {
      id: "paymentMethod",
      header: "Method",
      cell: (r) => <span className="text-xs font-medium text-ink-muted">{r.paymentMethod}</span>,
      hideBelow: "lg",
    },
    {
      id: "status",
      header: "Status",
      cell: (r) => <Indicator color={getStatusColor(r.status)}>{r.status}</Indicator>,
    },
    {
      id: "amountPaid",
      header: "Amount Paid (৳)",
      sortValue: (r) => r.amountPaid,
      cell: (r) => (
        <span className="font-semibold text-success tabular-nums">
          ৳{r.amountPaid.toLocaleString()}
        </span>
      ),
    },
    {
      id: "ledgerBalance",
      header: "Remaining Balance (৳)",
      sortValue: (r) => r.ledgerBalance,
      cell: (r) => (
        <span className="font-medium text-ink-muted tabular-nums">
          ৳{r.ledgerBalance.toLocaleString()}
        </span>
      ),
    },
  ];

  return (
    <PageContainer>
      <PageHead
        title="Supplier Payments"
        subtitle="Vendor bill settlements, payment vouchers and ledger balance reconciliation"
        actions={
          <Button variant="primary">
            <Plus aria-hidden="true" />
            Record Payment Voucher
          </Button>
        }
      />
      <Card>
        <DataTable
          rows={rows}
          columns={columns}
          getRowId={(r) => r.id}
          getRowLabel={(r) => `${r.voucherNumber} - ${r.supplierName}`}
          modifiedAt={(r) => r.updatedAt}
          search={{
            placeholder: "Search payments by voucher, supplier or invoice...",
            match: (r, q) => {
              const query = q.toLowerCase();
              return (
                r.voucherNumber.toLowerCase().includes(query) ||
                r.supplierName.toLowerCase().includes(query) ||
                r.invoiceRef.toLowerCase().includes(query)
              );
            },
          }}
          bulkActions={(selected, clear) => [
            {
              label: `Mark as Disbursed (${selected.length})`,
              onSelect: () => {
                alert(`Processed payments for ${selected.length} vouchers`);
                clear();
              },
            },
          ]}
        />
      </Card>
    </PageContainer>
  );
}
