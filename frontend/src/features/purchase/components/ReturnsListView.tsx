"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { PageContainer, PageHead } from "@/components/layout/page";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/section";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Indicator, type IndicatorColor } from "@/components/ui/indicator";
import { initialReturns } from "../mock-data";
import type { PurchaseReturn } from "../types";

function getStatusColor(status: PurchaseReturn["status"]): IndicatorColor {
  switch (status) {
    case "Completed":
      return "green";
    case "Approved":
      return "blue";
    case "Pending":
      return "orange";
    case "Draft":
    default:
      return "gray";
  }
}

export function ReturnsListView() {
  const [rows] = useState<PurchaseReturn[]>(initialReturns);

  const columns: Column<PurchaseReturn>[] = [
    {
      id: "returnNumber",
      header: "Return No",
      sortValue: (r) => r.returnNumber,
      cell: (r) => <span className="font-semibold text-ink">{r.returnNumber}</span>,
    },
    {
      id: "referenceDoc",
      header: "Ref Document",
      sortValue: (r) => r.referenceDoc,
      cell: (r) => <span className="text-ink-muted">{r.referenceDoc}</span>,
    },
    {
      id: "supplierName",
      header: "Supplier",
      sortValue: (r) => r.supplierName,
      cell: (r) => <span className="text-ink">{r.supplierName}</span>,
    },
    {
      id: "returnDate",
      header: "Return Date",
      sortValue: (r) => r.returnDate,
      cell: (r) => <span className="text-ink-muted">{r.returnDate}</span>,
      hideBelow: "sm",
    },
    {
      id: "status",
      header: "Status",
      cell: (r) => <Indicator color={getStatusColor(r.status)}>{r.status}</Indicator>,
    },
    {
      id: "reason",
      header: "Reason for Return",
      cell: (r) => <span className="text-ink-muted text-xs truncate max-w-xs">{r.reason}</span>,
      hideBelow: "md",
    },
    {
      id: "totalAmount",
      header: "Debit Amount (৳)",
      sortValue: (r) => r.totalAmount,
      cell: (r) => (
        <span className="font-semibold text-danger tabular-nums">
          ৳{r.totalAmount.toLocaleString()}
        </span>
      ),
    },
  ];

  return (
    <PageContainer>
      <PageHead
        title="Purchase Returns"
        subtitle="Vendor returns, rejected goods and debit note generation"
        actions={
          <Button variant="primary">
            <Plus aria-hidden="true" />
            Create Purchase Return
          </Button>
        }
      />
      <Card>
        <DataTable
          rows={rows}
          columns={columns}
          getRowId={(r) => r.id}
          getRowLabel={(r) => `${r.returnNumber} - ${r.supplierName}`}
          modifiedAt={(r) => r.updatedAt}
          search={{
            placeholder: "Search returns by return no, reference doc or supplier...",
            match: (r, q) => {
              const query = q.toLowerCase();
              return (
                r.returnNumber.toLowerCase().includes(query) ||
                r.referenceDoc.toLowerCase().includes(query) ||
                r.supplierName.toLowerCase().includes(query) ||
                r.reason.toLowerCase().includes(query)
              );
            },
          }}
          bulkActions={(selected, clear) => [
            {
              label: `Issue Debit Notes (${selected.length})`,
              onSelect: () => {
                alert(`Issued debit notes for ${selected.length} returns`);
                clear();
              },
            },
          ]}
        />
      </Card>
    </PageContainer>
  );
}
