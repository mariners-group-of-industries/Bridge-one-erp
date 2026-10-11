"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { PageContainer, PageHead } from "@/components/layout/page";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/section";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Indicator, type IndicatorColor } from "@/components/ui/indicator";
import { initialReceives } from "../mock-data";
import type { PurchaseReceive } from "../types";

function getStatusColor(status: PurchaseReceive["status"]): IndicatorColor {
  switch (status) {
    case "Completed":
      return "green";
    case "Approved":
      return "blue";
    case "Pending":
    default:
      return "orange";
  }
}

export function ReceiveListView() {
  const [rows] = useState<PurchaseReceive[]>(initialReceives);

  const columns: Column<PurchaseReceive>[] = [
    {
      id: "grnNumber",
      header: "GRN Number",
      sortValue: (r) => r.grnNumber,
      cell: (r) => <span className="font-semibold text-ink">{r.grnNumber}</span>,
    },
    {
      id: "poNumber",
      header: "PO Reference",
      sortValue: (r) => r.poNumber,
      cell: (r) => <span className="text-ink-muted">{r.poNumber}</span>,
    },
    {
      id: "supplierName",
      header: "Supplier",
      sortValue: (r) => r.supplierName,
      cell: (r) => <span className="text-ink">{r.supplierName}</span>,
    },
    {
      id: "warehouse",
      header: "Warehouse",
      sortValue: (r) => r.warehouse,
      cell: (r) => <span className="text-ink-muted text-xs">{r.warehouse}</span>,
      hideBelow: "md",
    },
    {
      id: "receiveDate",
      header: "Receive Date",
      sortValue: (r) => r.receiveDate,
      cell: (r) => <span className="text-ink-muted">{r.receiveDate}</span>,
      hideBelow: "sm",
    },
    {
      id: "status",
      header: "Status",
      cell: (r) => <Indicator color={getStatusColor(r.status)}>{r.status}</Indicator>,
    },
    {
      id: "totalValue",
      header: "Received Value (৳)",
      sortValue: (r) => r.totalValue,
      cell: (r) => (
        <span className="font-semibold text-ink tabular-nums">
          ৳{r.totalValue.toLocaleString()}
        </span>
      ),
    },
  ];

  return (
    <PageContainer>
      <PageHead
        title="Purchase Receive (GRN)"
        subtitle="Goods receipt notes, inbound shipments and quality acceptance"
        actions={
          <Button variant="primary">
            <Plus aria-hidden="true" />
            New Goods Receipt
          </Button>
        }
      />
      <Card>
        <DataTable
          rows={rows}
          columns={columns}
          getRowId={(r) => r.id}
          getRowLabel={(r) => `${r.grnNumber} - ${r.supplierName}`}
          modifiedAt={(r) => r.updatedAt}
          search={{
            placeholder: "Search goods receipt notes by GRN, PO or supplier...",
            match: (r, q) => {
              const query = q.toLowerCase();
              return (
                r.grnNumber.toLowerCase().includes(query) ||
                r.poNumber.toLowerCase().includes(query) ||
                r.supplierName.toLowerCase().includes(query) ||
                r.warehouse.toLowerCase().includes(query)
              );
            },
          }}
          bulkActions={(selected, clear) => [
            {
              label: `Verify & Accept (${selected.length})`,
              onSelect: () => {
                alert(`Verified ${selected.length} GRNs into warehouse stock`);
                clear();
              },
            },
          ]}
        />
      </Card>
    </PageContainer>
  );
}
