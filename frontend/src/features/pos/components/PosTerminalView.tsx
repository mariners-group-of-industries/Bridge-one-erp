"use client";

import { Minus, Plus, Search, ShoppingCart, Trash2, Undo2 } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { PageContainer, PageHead } from "@/components/layout/page";
import { Button, buttonClasses } from "@/components/ui/button";
import { CONTROL, SelectField, TextField } from "@/components/ui/form-field";
import { Card, EmptyState, ErrorState, LoadingState } from "@/components/ui/section";
import { useToast } from "@/components/ui/toast";
import { useResource } from "@/hooks/use-resource";
import { errorMessage } from "@/lib/api/client";
import { cn } from "@/lib/cn";
import { paths } from "../paths";
import { PAYMENT_LABELS, POS_PAYMENT_METHODS, saleTotals, type PosPaymentMethod, type PosSale } from "../schemas/pos.schema";
import { posApi, type CatalogItem } from "../services/pos.api";

interface CartLine {
  item: CatalogItem;
  qty: number;
  rate: number;
  discount: number;
}

const money = (n: number) => n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/**
 * Counter sale screen. Completing a sale takes the items out of the counter's
 * warehouse (stock ledger) and records the payment; a sale can be voided later,
 * which puts the items back.
 */
export function PosTerminalView() {
  const counters = useResource("pos-terminal-counters", posApi.terminalCounters);
  const [counterId, setCounterId] = useState("");
  const active = counters.data?.find((c) => c.id === counterId) ?? counters.data?.[0];

  return (
    <PageContainer full>
      <PageHead
        title="POS Terminal"
        subtitle={active ? `${active.name} · sells from ${active.warehouseName}` : "Sell at a counter."}
        actions={
          counters.data && counters.data.length > 0 ? (
            <SelectField
              label="Counter"
              className="min-w-56"
              value={active?.id ?? ""}
              onChange={(e) => setCounterId(e.target.value)}
              options={counters.data.map((c) => ({ value: c.id, label: `${c.code} · ${c.name}` }))}
            />
          ) : undefined
        }
      />
      {counters.error ? (
        <ErrorState message={counters.error.message} onRetry={counters.reload} />
      ) : !counters.data ? (
        <LoadingState label="Loading counters…" />
      ) : !active ? (
        <Card>
          <EmptyState title="No active counter" subtitle="Add a counter and the warehouse it sells from in POS Setup › Counter Setup.">
            <Link href={paths.setup} className={buttonClasses("accent", "sm", "mt-3")}>
              Open POS Setup
            </Link>
          </EmptyState>
        </Card>
      ) : (
        <Terminal key={active.id} counterId={active.id} />
      )}
    </PageContainer>
  );
}

function Terminal({ counterId }: { counterId: string }) {
  const toast = useToast();
  const catalog = useResource(`pos-catalog-${counterId}`, () => posApi.catalog(counterId));
  const sales = useResource(`pos-sales-${counterId}`, () => posApi.counterSales(counterId));
  const [search, setSearch] = useState("");
  const [cart, setCart] = useState<CartLine[]>([]);
  const [customerName, setCustomerName] = useState("");
  const [customerMobile, setCustomerMobile] = useState("");
  const [tableRef, setTableRef] = useState("");
  const [discount, setDiscount] = useState("");
  const [vatPercent, setVatPercent] = useState("0");
  const [paymentMethod, setPaymentMethod] = useState<PosPaymentMethod>("CASH");
  const [paid, setPaid] = useState("");
  const [saving, setSaving] = useState(false);
  const [lastSale, setLastSale] = useState<PosSale | null>(null);

  const items = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (catalog.data ?? []).filter((i) => !q || i.name.toLowerCase().includes(q) || i.code.toLowerCase().includes(q) || i.category.toLowerCase().includes(q));
  }, [catalog.data, search]);

  const totals = saleTotals(cart, Number(discount) || 0, Number(vatPercent) || 0);
  const paidAmount = paid === "" ? totals.total : Number(paid) || 0;
  const change = Math.max(0, Math.round((paidAmount - totals.total) * 100) / 100);
  const inCart = (itemId: string) => cart.find((l) => l.item.id === itemId)?.qty ?? 0;

  const add = (item: CatalogItem) => {
    if (inCart(item.id) + 1 > item.inStock) {
      toast.error(`Only ${item.inStock} ${item.uom} of ${item.name} in stock.`);
      return;
    }
    setCart((all) =>
      all.some((l) => l.item.id === item.id)
        ? all.map((l) => (l.item.id === item.id ? { ...l, qty: l.qty + 1 } : l))
        : [...all, { item, qty: 1, rate: item.rate, discount: 0 }],
    );
  };
  const setLine = (itemId: string, patch: Partial<CartLine>) => setCart((all) => all.map((l) => (l.item.id === itemId ? { ...l, ...patch } : l)));

  const reset = () => {
    setCart([]);
    setCustomerName("");
    setCustomerMobile("");
    setTableRef("");
    setDiscount("");
    setPaid("");
  };

  const complete = async () => {
    setSaving(true);
    try {
      const sale = await posApi.sell({
        counterId,
        customerName: customerName || undefined,
        customerMobile: customerMobile || undefined,
        tableRef: tableRef || undefined,
        discount: Number(discount) || 0,
        vatPercent: Number(vatPercent) || 0,
        paymentMethod,
        paidAmount,
        lines: cart.map((l) => ({ itemId: l.item.id, qty: l.qty, rate: l.rate, discount: l.discount })),
      });
      toast.success(`${sale.number} completed. Change ${money(sale.changeAmount)}.`);
      setLastSale(sale);
      reset();
      catalog.reload();
      sales.reload();
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setSaving(false);
    }
  };

  const voidSale = async (sale: PosSale) => {
    const reason = window.prompt(`Why is ${sale.number} voided?`);
    if (!reason) return;
    try {
      await posApi.voidSale(sale.id, reason);
      toast.success(`${sale.number} voided. Items are back in stock.`);
      catalog.reload();
      sales.reload();
    } catch (error) {
      toast.error(errorMessage(error));
    }
  };

  return (
    <div className="grid grid-cols-1 gap-4 xl:grid-cols-5">
      <Card className="xl:col-span-3">
        <div className="flex flex-col gap-3 p-4">
          <label className="relative">
            <span className="sr-only">Search items</span>
            <Search aria-hidden="true" className="pointer-events-none absolute top-2 left-2.5 size-4 text-ink-faint" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search item, code or category…"
              className={cn(CONTROL, "h-8 pl-8")}
            />
          </label>
          {catalog.error ? (
            <ErrorState message={catalog.error.message} onRetry={catalog.reload} />
          ) : !catalog.data ? (
            <LoadingState label="Loading items…" />
          ) : items.length === 0 ? (
            <EmptyState title="No items" subtitle="No active items match the search." />
          ) : (
            <div className="grid max-h-[60vh] grid-cols-2 gap-2 overflow-y-auto sm:grid-cols-3 lg:grid-cols-4">
              {items.map((item) => {
                const left = item.inStock - inCart(item.id);
                return (
                  <button
                    key={item.id}
                    type="button"
                    disabled={left <= 0}
                    onClick={() => add(item)}
                    className="flex flex-col items-start gap-0.5 rounded border border-line bg-surface p-2.5 text-left transition-colors hover:border-accent hover:bg-accent-soft disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <span className="line-clamp-2 text-sm font-semibold text-ink">{item.name}</span>
                    <span className="text-xs text-ink-faint">
                      {item.code} · {item.category}
                    </span>
                    <span className="mt-1 text-sm font-bold text-ink tabular-nums">{money(item.rate)}</span>
                    <span className={cn("text-xs tabular-nums", left > 0 ? "text-ink-muted" : "text-danger")}>
                      {left > 0 ? `${left} ${item.uom} left` : "Out of stock"}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </Card>

      <Card className="xl:col-span-2">
        <div className="flex flex-col gap-3 p-4">
          <h2 className="flex items-center gap-2 text-sm font-bold text-ink">
            <ShoppingCart className="size-4" /> Current sale
          </h2>
          {cart.length === 0 ? (
            <p className="rounded border border-dashed border-line p-4 text-center text-sm text-ink-faint">Tap an item to add it.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="text-xs text-ink-muted">
                <tr>
                  <th className="py-1 text-left font-semibold">Item</th>
                  <th className="w-28 py-1 text-center font-semibold">Qty</th>
                  <th className="w-20 py-1 text-right font-semibold">Disc.</th>
                  <th className="w-24 py-1 text-right font-semibold">Amount</th>
                  <th className="w-8" />
                </tr>
              </thead>
              <tbody>
                {cart.map((l) => (
                  <tr key={l.item.id} className="border-t border-line">
                    <td className="py-1.5">
                      <div className="font-medium text-ink">{l.item.name}</div>
                      <div className="text-xs text-ink-faint">@ {money(l.rate)}</div>
                    </td>
                    <td className="py-1.5">
                      <div className="flex items-center justify-center gap-1">
                        <Button variant="ghost" size="icon" aria-label="Less" onClick={() => setLine(l.item.id, { qty: Math.max(1, l.qty - 1) })}>
                          <Minus className="size-3.5" />
                        </Button>
                        <input
                          aria-label={`Quantity of ${l.item.name}`}
                          type="number"
                          min={0}
                          step="any"
                          value={l.qty}
                          onChange={(e) => setLine(l.item.id, { qty: Math.min(l.item.inStock, Math.max(0, Number(e.target.value) || 0)) })}
                          className={cn(CONTROL, "h-7 w-12 px-1 text-center")}
                        />
                        <Button variant="ghost" size="icon" aria-label="More" disabled={l.qty + 1 > l.item.inStock} onClick={() => setLine(l.item.id, { qty: l.qty + 1 })}>
                          <Plus className="size-3.5" />
                        </Button>
                      </div>
                    </td>
                    <td className="py-1.5">
                      <input
                        aria-label={`Discount on ${l.item.name}`}
                        type="number"
                        min={0}
                        step="any"
                        value={l.discount || ""}
                        onChange={(e) => setLine(l.item.id, { discount: Math.max(0, Number(e.target.value) || 0) })}
                        className={cn(CONTROL, "h-7 text-right")}
                      />
                    </td>
                    <td className="py-1.5 text-right font-semibold tabular-nums">{money(Math.max(0, l.qty * l.rate - l.discount))}</td>
                    <td className="py-1.5 text-right">
                      <Button variant="ghost" size="icon" aria-label="Remove" onClick={() => setCart(cart.filter((x) => x.item.id !== l.item.id))}>
                        <Trash2 className="size-3.5" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          <div className="grid grid-cols-2 gap-2">
            <TextField label="Customer" value={customerName} maxLength={150} onChange={(e) => setCustomerName(e.target.value)} />
            <TextField label="Mobile" value={customerMobile} maxLength={30} onChange={(e) => setCustomerMobile(e.target.value)} />
            <TextField label="Table / reference" value={tableRef} maxLength={100} onChange={(e) => setTableRef(e.target.value)} />
            <TextField label="Invoice discount" type="number" min={0} step="any" value={discount} onChange={(e) => setDiscount(e.target.value)} />
            <TextField label="VAT %" type="number" min={0} max={100} step="any" value={vatPercent} onChange={(e) => setVatPercent(e.target.value)} />
            <SelectField
              label="Payment"
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value as PosPaymentMethod)}
              options={POS_PAYMENT_METHODS.map((m) => ({ value: m, label: PAYMENT_LABELS[m] }))}
            />
          </div>

          <dl className="grid grid-cols-2 gap-y-1 rounded bg-canvas p-3 text-sm">
            <dt className="text-ink-muted">Subtotal</dt>
            <dd className="text-right tabular-nums">{money(totals.subtotal)}</dd>
            <dt className="text-ink-muted">Discount</dt>
            <dd className="text-right tabular-nums">−{money(Number(discount) || 0)}</dd>
            <dt className="text-ink-muted">VAT</dt>
            <dd className="text-right tabular-nums">{money(totals.vatAmount)}</dd>
            <dt className="font-bold text-ink">Total</dt>
            <dd className="text-right text-lg font-bold tabular-nums">{money(totals.total)}</dd>
          </dl>
          <div className="grid grid-cols-2 items-end gap-2">
            <TextField
              label="Received"
              type="number"
              min={0}
              step="any"
              placeholder={money(totals.total)}
              value={paid}
              onChange={(e) => setPaid(e.target.value)}
            />
            <div className="pb-1.5 text-right text-sm">
              Change <span className="font-bold tabular-nums">{money(change)}</span>
            </div>
          </div>
          <div className="flex gap-2">
            <Button onClick={reset} disabled={saving || cart.length === 0}>
              Clear
            </Button>
            <Button
              variant="primary"
              className="flex-1"
              loading={saving}
              disabled={cart.length === 0 || cart.some((l) => l.qty <= 0) || paidAmount + 0.005 < totals.total}
              onClick={complete}
            >
              Complete sale · {money(totals.total)}
            </Button>
          </div>
          {lastSale && (
            <p className="text-xs text-ink-muted">
              Last sale {lastSale.number}: {money(lastSale.total)} by {PAYMENT_LABELS[lastSale.paymentMethod]}, change {money(lastSale.changeAmount)}.
            </p>
          )}
        </div>
      </Card>

      <Card className="xl:col-span-5">
        <div className="p-4">
          <h2 className="mb-2 text-sm font-bold text-ink">Today at this counter</h2>
          {sales.error ? (
            <ErrorState message={sales.error.message} onRetry={sales.reload} />
          ) : !sales.data ? (
            <LoadingState label="Loading sales…" />
          ) : sales.data.length === 0 ? (
            <p className="text-sm text-ink-faint">No sales yet today.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-xs text-ink-muted">
                  <tr>
                    <th className="py-1 text-left font-semibold">Invoice</th>
                    <th className="py-1 text-left font-semibold">Time</th>
                    <th className="py-1 text-left font-semibold">Customer</th>
                    <th className="py-1 text-left font-semibold">Payment</th>
                    <th className="py-1 text-right font-semibold">Total</th>
                    <th className="py-1 text-left font-semibold">Status</th>
                    <th className="w-20" />
                  </tr>
                </thead>
                <tbody>
                  {sales.data.map((s) => (
                    <tr key={s.id} className="border-t border-line">
                      <td className="py-1.5 font-mono">{s.number}</td>
                      <td className="py-1.5">{new Date(s.soldAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}</td>
                      <td className="py-1.5">{s.customerName || "Walk-in"}</td>
                      <td className="py-1.5">{PAYMENT_LABELS[s.paymentMethod]}</td>
                      <td className="py-1.5 text-right tabular-nums">{money(s.total)}</td>
                      <td className={cn("py-1.5", s.status === "VOIDED" && "text-danger")}>{s.status === "VOIDED" ? `Voided (${s.voidReason})` : "Paid"}</td>
                      <td className="py-1.5 text-right">
                        {s.status === "COMPLETED" && (
                          <Button size="sm" variant="ghost" onClick={() => voidSale(s)}>
                            <Undo2 /> Void
                          </Button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}
