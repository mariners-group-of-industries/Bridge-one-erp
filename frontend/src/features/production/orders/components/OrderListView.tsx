"use client";

import { Eye, Pencil, Plus, RefreshCw } from "lucide-react";
import Link from "next/link";
import { useState, type FormEvent } from "react";
import { PageContainer, PageHead } from "@/components/layout/page";
import { Button, buttonClasses } from "@/components/ui/button";
import type { Column } from "@/components/ui/data-table";
import { ListTable } from "@/features/production/components/ListTable";
import { SelectField, TextField } from "@/components/ui/form-field";
import { Card, ErrorState, LoadingState } from "@/components/ui/section";
import { EmptyState } from "@/features/production/components/EmptyState";
import { useResource } from "@/hooks/use-resource";
import { errorMessage } from "@/lib/api/client";
import { cn } from "@/lib/cn";
import { addDays, useToday } from "@/features/sales/lib/use-today";
import { paths } from "../../paths";
import { ORDER_STATUS_LABELS, ORDER_VIEW_STATUSES, orderListQuerySchema, type OrderListQuery, type OrderRow } from "../schemas/order.schema";
import { fetchOrderLookups, fetchOrders } from "../services/order.api";
import { OrderStatusBadge, day, money, qty2 } from "./OrderParts";

/** /production/orders: Managerium's Production Order list. Waits for the browser's date. */
export function OrderListView() {
  const today = useToday();
  return (
    <PageContainer className="max-w-none">
      <PageHead
        title="Production Order"
        actions={
          <Link href={paths.newOrder} className={buttonClasses("primary")}>
            <Plus aria-hidden="true" />
            Production Order
          </Link>
        }
      />
      {today ? <OrderList today={today} /> : <LoadingState />}
    </PageContainer>
  );
}

function OrderList({ today }: { today: string }) {
  const lookups = useResource("production-order-lookups", fetchOrderLookups);
  const [filters, setFilters] = useState({ from: addDays(today, -6), to: today, status: "", bomId: "" });
  const toQuery = (values: typeof filters): OrderListQuery =>
    Object.fromEntries(Object.entries(values).filter(([, value]) => value)) as OrderListQuery;
  const [query, setQuery] = useState<OrderListQuery>(toQuery(filters));
  const [filterError, setFilterError] = useState<string>();
  const list = useResource(`production-orders:${JSON.stringify(query)}`, () => fetchOrders(query));

  function view(event: FormEvent) {
    event.preventDefault();
    const next = toQuery(filters);
    const parsed = orderListQuerySchema.safeParse(next);
    if (!parsed.success) return setFilterError(parsed.error.issues[0]?.message);
    setFilterError(undefined);
    if (JSON.stringify(next) === JSON.stringify(query)) list.reload();
    else setQuery(next);
  }

  const columns: Column<OrderRow>[] = [
    { id: "sl", header: "SL", cell: (_row, index) => index + 1, className: "w-10 tabular-nums" },
    {
      id: "action",
      header: "Action",
      className: "w-20",
      cell: (row) => (
        <span className="flex items-center gap-1">
          {/* As in Managerium the pencil is always there; once an order is approved, closed, … it is view only. */}
          {row.canEdit ? (
            <Link href={paths.editOrder(row.id)} aria-label={`Edit ${row.number}`} title="Edit Order" className={buttonClasses("ghost", "icon")}>
              <Pencil aria-hidden="true" />
            </Link>
          ) : (
            <span
              role="img"
              aria-label={`${row.number} cannot be edited (${ORDER_STATUS_LABELS[row.status]})`}
              title={`${ORDER_STATUS_LABELS[row.status]} – view only`}
              className={cn(buttonClasses("ghost", "icon"), "cursor-not-allowed text-ink-faint opacity-50 hover:bg-transparent")}
            >
              <Pencil aria-hidden="true" />
            </span>
          )}
          <Link href={paths.order(row.id)} aria-label={`View ${row.number}`} title="View" className={buttonClasses("ghost", "icon")}>
            <Eye aria-hidden="true" />
          </Link>
        </span>
      ),
    },
    { id: "date", header: "Order Date", cell: (row) => <span className="whitespace-nowrap">{day(row.orderDate)}</span>, sortValue: (row) => row.orderDate },
    {
      id: "number",
      header: "Order Number",
      cell: (row) => (
        <Link href={paths.order(row.id)} className="font-medium whitespace-nowrap text-ink hover:underline">
          {row.number}
        </Link>
      ),
      sortValue: (row) => row.number,
    },
    { id: "item", header: "Produced Item", cell: (row) => `${row.itemName} - ${row.uom}`, sortValue: (row) => row.itemName },
    { id: "bom", header: "BOM Name", cell: (row) => row.bomName, sortValue: (row) => row.bomName, hideBelow: "md" },
    { id: "orderQty", header: "Order QTY", cell: (row) => qty2(row.orderQty), sortValue: (row) => row.orderQty, className: "text-right tabular-nums" },
    { id: "produced", header: "Produced QTY", cell: (row) => qty2(row.producedQty), sortValue: (row) => row.producedQty, className: "text-right tabular-nums", hideBelow: "md" },
    { id: "remaining", header: "Remaining QTY", cell: (row) => qty2(row.remainingQty), sortValue: (row) => row.remainingQty, className: "text-right tabular-nums" },
    { id: "value", header: "Produced Value", cell: (row) => money(row.producedValue), sortValue: (row) => row.producedValue, className: "text-right tabular-nums", hideBelow: "lg" },
    { id: "status", header: "Status", cell: (row) => <OrderStatusBadge status={row.status} />, sortValue: (row) => row.status },
  ];

  const rows = list.data;
  return (
    <Card>
      <form onSubmit={view} className="grid items-end gap-3 border-b border-line p-4 sm:grid-cols-2 lg:grid-cols-[repeat(4,minmax(0,1fr))_auto]">
        <TextField label="Start Date" type="date" value={filters.from} max={filters.to || undefined} onChange={(event) => setFilters({ ...filters, from: event.target.value })} />
        <TextField label="End Date" type="date" value={filters.to} min={filters.from || undefined} error={filterError} onChange={(event) => setFilters({ ...filters, to: event.target.value })} />
        <SelectField
          label="Status"
          value={filters.status}
          options={[{ value: "", label: "All" }, ...ORDER_VIEW_STATUSES.map((status) => ({ value: status, label: ORDER_STATUS_LABELS[status] }))]}
          onChange={(event) => setFilters({ ...filters, status: event.target.value })}
        />
        <SelectField
          label="BOM"
          value={filters.bomId}
          options={[{ value: "", label: "All BOMs" }, ...(lookups.data?.boms ?? []).map((bom) => ({ value: bom.id, label: bom.name }))]}
          onChange={(event) => setFilters({ ...filters, bomId: event.target.value })}
        />
        <Button type="submit" variant="primary" disabled={list.loading}>
          <RefreshCw aria-hidden="true" />
          View
        </Button>
      </form>
      {list.error ? (
        <ErrorState message={errorMessage(list.error)} onRetry={list.reload} />
      ) : !rows ? (
        <LoadingState label="Loading production orders…" />
      ) : (
        <div className={list.loading ? "opacity-60 transition-opacity" : undefined} aria-busy={list.loading}>
          <ListTable
            rows={rows}
            columns={columns}
            getRowId={(row) => row.id}
            getRowLabel={(row) => row.number}
            rowHref={(row) => paths.order(row.id)}
            search={{
              placeholder: "Search order, item, BOM…",
              match: (row, needle) => [row.number, row.itemName, row.itemCode, row.bomName].some((value) => value.toLowerCase().includes(needle)),
            }}
            footer={(shown) => ({
              number: `${shown.length} orders`,
              orderQty: qty2(shown.reduce((sum, row) => sum + row.orderQty, 0)),
              produced: qty2(shown.reduce((sum, row) => sum + row.producedQty, 0)),
              remaining: qty2(shown.reduce((sum, row) => sum + row.remainingQty, 0)),
              value: money(shown.reduce((sum, row) => sum + row.producedValue, 0)),
            })}
            emptyState={
              <EmptyState title="No production order in this range">
                <Link href={paths.newOrder} className={buttonClasses("primary", "sm", "mt-2")}>
                  <Plus aria-hidden="true" />
                  Production Order
                </Link>
              </EmptyState>
            }
          />
        </div>
      )}
    </Card>
  );
}
