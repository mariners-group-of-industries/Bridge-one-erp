"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { PageContainer, PageHead } from "@/components/layout/page";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/section";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Indicator, type IndicatorColor } from "@/components/ui/indicator";
import { initialOrders } from "../mock-data";
import type { PurchaseOrder } from "../types";

function getStatusColor(status: PurchaseOrder["status"]): IndicatorColor {
  switch (status) {
    case "Completed":
      return "green";
    case "Submitted":
      return "blue";
    case "Cancelled":
      return "red";
    case "Draft":
    default:
      return "gray";
  }
}

export function OrdersListView() {
  const [rows] = useState<PurchaseOrder[]>(initialOrders);

  const columns: Column<PurchaseOrder>[] = [
    {
      id: "poNumber",
      header: "PO Number",
      sortValue: (r) => r.poNumber,
      cell: (r) => <span className="font-semibold text-ink">{r.poNumber}</span>,
    },
    {
      id: "supplierName",
      header: "Supplier",
      sortValue: (r) => r.supplierName,
      cell: (r) => <span className="text-ink">{r.supplierName}</span>,
    },
    {
      id: "orderDate",
      header: "Order Date",
      sortValue: (r) => r.orderDate,
      cell: (r) => <span className="text-ink-muted">{r.orderDate}</span>,
      hideBelow: "sm",
    },
    {
      id: "deliveryDate",
      header: "Expected Delivery",
      sortValue: (r) => r.deliveryDate,
      cell: (r) => <span className="text-ink-muted">{r.deliveryDate}</span>,
      hideBelow: "md",
    },
    {
      id: "status",
      header: "Status",
      cell: (r) => <Indicator color={getStatusColor(r.status)}>{r.status}</Indicator>,
    },
    {
      id: "paymentTerms",
      header: "Payment Terms",
      cell: (r) => <span className="text-ink-muted text-xs">{r.paymentTerms}</span>,
      hideBelow: "lg",
    },
    {
      id: "totalAmount",
      header: "Total Amount (৳)",
      sortValue: (r) => r.totalAmount,
      cell: (r) => (
        <span className="font-semibold text-ink tabular-nums">
          ৳{r.totalAmount.toLocaleString()}
        </span>
      ),
    },
  ];

  return (
    <PageContainer>
      <PageHead
        title="Purchase Orders"
        subtitle="Commercial orders, delivery tracking and vendor commitments"
        actions={
          <Button variant="primary">
            <Plus aria-hidden="true" />
            Add Purchase Order
          </Button>
        }
      />
      <Card>
        <DataTable
          rows={rows}
          columns={columns}
          getRowId={(r) => r.id}
          getRowLabel={(r) => `${r.poNumber} - ${r.supplierName}`}
          modifiedAt={(r) => r.updatedAt}
          search={{
            placeholder: "Search orders by PO number or supplier name...",
            match: (r, q) => {
              const query = q.toLowerCase();
              return (
                r.poNumber.toLowerCase().includes(query) ||
                r.supplierName.toLowerCase().includes(query)
              );
            },
          }}
          bulkActions={(selected, clear) => [
            {
              label: `Submit Orders (${selected.length})`,
              onSelect: () => {
                alert(`Submitted ${selected.length} orders`);
                clear();
              },
            },
            {
              label: "Cancel selected",
              danger: true,
              onSelect: () => {
                alert(`Cancelled ${selected.length} orders`);
                clear();
              },
            },
          ]}
        />
      </Card>
    </PageContainer>
  );
}
