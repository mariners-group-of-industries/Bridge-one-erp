"use client";

import { useMemo, useState } from "react";
import {
  AlertCircle,
  Building,
  CheckCircle2,
  CreditCard,
  Download,
  Filter,
  Plus,
  Printer,
  Search,
} from "lucide-react";
import { PageContainer, PageHead } from "@/components/layout/page";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAccountingStore } from "@/features/accounts/store/accounting-store";
import type { CostCenterItem } from "@/features/accounts/types";

export default function CenterSetupPage() {
  const costCenters = useAccountingStore((s) => s.costCenters);
  const addCostCenter = useAccountingStore((s) => s.addCostCenter);

  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState<string>("ALL");

  const [isOpen, setIsOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const [form, setForm] = useState({
    code: "",
    name: "",
    type: "DEPARTMENT" as CostCenterItem["type"],
    officeId: "office-main",
    officeName: "Dhaka Corporate HQ",
    description: "",
    effectiveDate: new Date().toISOString().split("T")[0],
    status: "ACTIVE" as const,
  });

  const filteredCenters = useMemo(() => {
    return costCenters.filter((c) => {
      const matchSearch =
        c.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.officeName.toLowerCase().includes(searchQuery.toLowerCase());
      const matchType = filterType === "ALL" ? true : c.type === filterType;
      return matchSearch && matchType;
    });
  }, [costCenters, searchQuery, filterType]);

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage("");

    if (!form.code.trim() || !form.name.trim()) {
      setErrorMessage("Center code and title are required.");
      return;
    }

    const exists = costCenters.some((c) => c.code.toLowerCase() === form.code.trim().toLowerCase());
    if (exists) {
      setErrorMessage(`Center code "${form.code}" already exists.`);
      return;
    }

    addCostCenter({
      ...form,
      code: form.code.trim().toUpperCase(),
      name: form.name.trim(),
    });

    setIsOpen(false);
  };

  return (
    <PageContainer>
      <PageHead
        title="Center Setup"
        subtitle="Configure departmental cost centers, projects, and branch analytical dimensions"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button variant="secondary" size="sm" onClick={() => window.print()}>
              <Printer className="mr-1.5 size-3.5" /> Print Centers
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={() => {
                setErrorMessage("");
                setIsOpen(true);
              }}
            >
              <Plus className="mr-1.5 size-3.5" /> Add Cost Center
            </Button>
          </div>
        }
      />

      {/* Filter Bar */}
      <Card className="mt-4 p-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-1 items-center gap-2">
            <div className="relative w-full max-w-sm">
              <Search className="absolute top-2.5 left-2.5 size-3.5 text-ink-faint" />
              <input
                type="text"
                placeholder="Search center code, name, office..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-lg border border-line bg-surface py-1.5 pr-3 pl-8 text-xs text-ink placeholder:text-ink-faint focus:border-primary focus:outline-none"
              />
            </div>

            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="rounded-lg border border-line bg-surface px-3 py-1.5 text-xs text-ink outline-none focus:border-primary"
            >
              <option value="ALL">All Center Types</option>
              <option value="DEPARTMENT">Department</option>
              <option value="PROJECT">Project</option>
              <option value="BRANCH">Branch</option>
              <option value="PROFIT_CENTER">Profit Center</option>
            </select>
          </div>

          <div className="flex items-center gap-3 text-xs text-ink-muted">
            <span>
              Total Centers: <strong className="text-ink">{costCenters.length}</strong>
            </span>
            <span>
              Active:{" "}
              <strong className="text-emerald-600">
                {costCenters.filter((c) => c.status === "ACTIVE").length}
              </strong>
            </span>
          </div>
        </div>
      </Card>

      {/* Centers Table */}
      <Card className="mt-4 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="border-b border-line bg-control/40 font-semibold text-ink">
              <tr>
                <th className="px-4 py-2.5">Center Code</th>
                <th className="px-4 py-2.5">Center Name</th>
                <th className="px-4 py-2.5">Center Type</th>
                <th className="px-4 py-2.5">Office / Location</th>
                <th className="px-4 py-2.5">Effective Date</th>
                <th className="px-4 py-2.5">Description</th>
                <th className="px-4 py-2.5 text-center">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {filteredCenters.map((c) => (
                <tr key={c.id} className="hover:bg-control/30">
                  <td className="px-4 py-2.5 font-mono font-semibold text-ink">{c.code}</td>
                  <td className="px-4 py-2.5 font-medium text-ink">{c.name}</td>
                  <td className="px-4 py-2.5">
                    <Badge variant="neutral">{c.type}</Badge>
                  </td>
                  <td className="px-4 py-2.5 text-ink-muted">{c.officeName}</td>
                  <td className="px-4 py-2.5 text-ink-muted">{c.effectiveDate}</td>
                  <td className="max-w-xs truncate px-4 py-2.5 text-ink-muted">{c.description || "—"}</td>
                  <td className="px-4 py-2.5 text-center">
                    <Badge variant={c.status === "ACTIVE" ? "success" : "neutral"}>{c.status}</Badge>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* Add Center Modal */}
      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Register Cost Center</DialogTitle>
            <DialogDescription>
              Create an analytical cost or profit dimension for departmental budgeting and transaction tagging.
            </DialogDescription>
          </DialogHeader>

          {errorMessage && (
            <div className="flex items-center gap-2 rounded-lg bg-rose-50 p-2 text-xs font-medium text-rose-600 dark:bg-rose-950/40">
              <AlertCircle className="size-4 shrink-0" /> {errorMessage}
            </div>
          )}

          <form onSubmit={handleSave} className="space-y-3 py-2 text-xs">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block font-medium text-ink">Center Code *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. CC-IT-01"
                  value={form.code}
                  onChange={(e) => setForm({ ...form, code: e.target.value })}
                  className="w-full rounded-lg border border-line bg-surface p-2 text-xs text-ink outline-none focus:border-primary font-mono uppercase"
                />
              </div>

              <div>
                <label className="mb-1 block font-medium text-ink">Center Type</label>
                <select
                  value={form.type}
                  onChange={(e) => setForm({ ...form, type: e.target.value as CostCenterItem["type"] })}
                  className="w-full rounded-lg border border-line bg-surface p-2 text-xs text-ink outline-none focus:border-primary"
                >
                  <option value="DEPARTMENT">Department</option>
                  <option value="PROJECT">Project</option>
                  <option value="BRANCH">Branch</option>
                  <option value="PROFIT_CENTER">Profit Center</option>
                </select>
              </div>
            </div>

            <div>
              <label className="mb-1 block font-medium text-ink">Center Title *</label>
              <input
                type="text"
                required
                placeholder="e.g. Information Technology & Systems"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full rounded-lg border border-line bg-surface p-2 text-xs text-ink outline-none focus:border-primary"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block font-medium text-ink">Office Location</label>
                <select
                  value={form.officeId}
                  onChange={(e) => {
                    const name = e.target.value === "office-main" ? "Dhaka Corporate HQ" : "Chittagong Plant";
                    setForm({ ...form, officeId: e.target.value, officeName: name });
                  }}
                  className="w-full rounded-lg border border-line bg-surface p-2 text-xs text-ink outline-none focus:border-primary"
                >
                  <option value="office-main">Dhaka Corporate HQ</option>
                  <option value="office-ctg">Chittagong Plant</option>
                </select>
              </div>

              <div>
                <label className="mb-1 block font-medium text-ink">Effective Date</label>
                <input
                  type="date"
                  required
                  value={form.effectiveDate}
                  onChange={(e) => setForm({ ...form, effectiveDate: e.target.value })}
                  className="w-full rounded-lg border border-line bg-surface p-2 text-xs text-ink outline-none focus:border-primary"
                />
              </div>
            </div>

            <div>
              <label className="mb-1 block font-medium text-ink">Description</label>
              <textarea
                rows={2}
                placeholder="Operational purpose of this center..."
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                className="w-full rounded-lg border border-line bg-surface p-2 text-xs text-ink outline-none focus:border-primary"
              />
            </div>

            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setIsOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="primary">
                Save Center
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </PageContainer>
  );
}
