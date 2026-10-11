"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { PageContainer, PageHead } from "@/components/layout/page";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/section";
import { DataTable, type Column } from "@/components/ui/data-table";
import { Indicator, type IndicatorColor } from "@/components/ui/indicator";
import { initialRequisitions } from "../mock-data";
import type { PurchaseRequisition } from "../types";

function getStatusColor(status: PurchaseRequisition["status"]): IndicatorColor {
  switch (status) {
    case "Approved":
    case "Ordered":
      return "green";
    case "Pending":
      return "orange";
    case "Rejected":
      return "red";
    case "Draft":
    default:
      return "gray";
  }
}

function getPriorityColor(priority: PurchaseRequisition["priority"]): IndicatorColor {
  switch (priority) {
    case "High":
      return "red";
    case "Medium":
      return "yellow";
    case "Low":
    default:
      return "blue";
  }
}

export function RequisitionsListView() {
  const [rows] = useState<PurchaseRequisition[]>(initialRequisitions);

  const columns: Column<PurchaseRequisition>[] = [
    {
      id: "prNumber",
      header: "Requisition No",
      sortValue: (r) => r.prNumber,
      cell: (r) => <span className="font-semibold text-ink">{r.prNumber}</span>,
    },
    {
      id: "department",
      header: "Department",
      sortValue: (r) => r.department,
      cell: (r) => <span className="text-ink">{r.department}</span>,
    },
    {
      id: "requestedBy",
      header: "Requested By",
      sortValue: (r) => r.requestedBy,
      cell: (r) => <span className="text-ink-muted">{r.requestedBy}</span>,
      hideBelow: "sm",
    },
    {
      id: "requiredDate",
      header: "Required By",
      sortValue: (r) => r.requiredDate,
      cell: (r) => <span className="text-ink-muted">{r.requiredDate}</span>,
      hideBelow: "md",
    },
    {
      id: "priority",
      header: "Priority",
      cell: (r) => <Indicator color={getPriorityColor(r.priority)}>{r.priority}</Indicator>,
    },
    {
      id: "status",
      header: "Status",
      cell: (r) => <Indicator color={getStatusColor(r.status)}>{r.status}</Indicator>,
    },
    {
      id: "totalEstimated",
      header: "Est. Total (৳)",
      sortValue: (r) => r.totalEstimated,
      cell: (r) => (
        <span className="font-medium text-ink tabular-nums">
          ৳{r.totalEstimated.toLocaleString()}
        </span>
      ),
    },
  ];

  return (
    <PageContainer>
      <PageHead
        title="Purchase Requisitions"
        subtitle="Department purchase requisitions and approval workflows"
        actions={
          <Button variant="primary">
            <Plus aria-hidden="true" />
            Add Requisition
          </Button>
        }
      />
      <Card>
        <DataTable
          rows={rows}
          columns={columns}
          getRowId={(r) => r.id}
          getRowLabel={(r) => `${r.prNumber} - ${r.department}`}
          modifiedAt={(r) => r.updatedAt}
          search={{
            placeholder: "Search requisitions by number, department or requester...",
            match: (r, q) => {
              const query = q.toLowerCase();
              return (
                r.prNumber.toLowerCase().includes(query) ||
                r.department.toLowerCase().includes(query) ||
                r.requestedBy.toLowerCase().includes(query)
              );
            },
          }}
          bulkActions={(selected, clear) => [
            {
              label: `Approve (${selected.length})`,
              onSelect: () => {
                alert(`Approved ${selected.length} requisitions`);
                clear();
              },
            },
            {
              label: "Delete selected",
              danger: true,
              onSelect: () => {
                alert(`Deleted ${selected.length} requisitions`);
                clear();
              },
            },
          ]}
        />
      </Card>
    </PageContainer>
  );
}
