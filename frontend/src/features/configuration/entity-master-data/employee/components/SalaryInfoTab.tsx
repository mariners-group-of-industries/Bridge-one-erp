"use client";

import { Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";

// ─── Shared styles ────────────────────────────────────────────────────────────

const CTRL =
  "h-8 w-full rounded-md border border-line bg-surface px-2.5 text-sm text-ink " +
  "placeholder:text-ink-faint transition-colors " +
  "hover:border-line-strong focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent-line " +
  "disabled:cursor-not-allowed disabled:bg-control disabled:text-ink-faint";

// ─── Primitives ───────────────────────────────────────────────────────────────

function SectionCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="overflow-hidden rounded-xl border border-line bg-surface shadow-sm">
      <div className="flex items-center gap-2 border-b border-line bg-canvas px-6 py-3">
        <span className="h-4 w-0.5 rounded-full bg-accent-strong" />
        <h3 className="text-sm font-semibold text-ink">{title}</h3>
      </div>
      <div className="p-6">{children}</div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs font-medium text-ink-muted">{label}</label>
      {children}
    </div>
  );
}

function Grid({ cols = 4, children }: { cols?: 2 | 3 | 4; children: React.ReactNode }) {
  const cls =
    cols === 4 ? "grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2 xl:grid-cols-4"
    : cols === 3 ? "grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2 xl:grid-cols-3"
    : "grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2";
  return <div className={cls}>{children}</div>;
}

function NumInput({
  value, onChange, placeholder = "0.00",
}: {
  value: string; onChange: (v: string) => void; placeholder?: string;
}) {
  return (
    <input
      type="number"
      min="0"
      step="0.01"
      className={CTRL}
      value={value}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

function TotalRow({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex items-center justify-between rounded-lg border border-accent-line bg-accent-soft px-4 py-2.5">
      <span className="text-sm font-semibold text-ink">{label}</span>
      <span className="text-sm font-bold text-accent-strong">{value.toLocaleString("en-US", { minimumFractionDigits: 2 })}</span>
    </div>
  );
}

// ─── Types ────────────────────────────────────────────────────────────────────

type SalaryType = "regular" | "day-basis";
type SalaryOption = "gross" | "structure-basic" | "structure-gross";
type DisbursementMode = "cash" | "bank" | "mfs" | "multiple";

interface AdjustmentRow {
  id: number;
  fromMonth: string;
  toMonth: string;
  type: "addition" | "deduction";
  amount: string;
}

interface StructureGrossFields {
  gross: string;
  basic: string;
  houseRent: string;
  medical: string;
  conveyance: string;
  mobile: string;
  food: string;
  extra: string;
}

const EMPTY_STRUCT_GROSS: StructureGrossFields = {
  gross: "", basic: "", houseRent: "", medical: "",
  conveyance: "", mobile: "", food: "", extra: "",
};

// ─── Card 1 — Salary Structure ────────────────────────────────────────────────

function SalaryStructureCard() {
  const [salaryType, setSalaryType] = useState<SalaryType>("regular");
  const [salaryOption, setSalaryOption] = useState<SalaryOption>("gross");

  // Gross-only
  const [grossOnly, setGrossOnly] = useState("");

  // Structure (basic)
  const [structBasic, setStructBasic] = useState("");
  const [structBasicGross, setStructBasicGross] = useState("");

  // Structure (gross)
  const [sg, setSg] = useState<StructureGrossFields>(EMPTY_STRUCT_GROSS);

  const setSgField = (k: keyof StructureGrossFields, v: string) =>
    setSg((p) => ({ ...p, [k]: v }));

  const sgTotal =
    [sg.basic, sg.houseRent, sg.medical, sg.conveyance, sg.mobile, sg.food, sg.extra]
      .reduce((acc, v) => acc + (parseFloat(v) || 0), 0);

  return (
    <SectionCard title="Salary Structure">
      <div className="flex flex-col gap-5">
        {/* Type + Option row */}
        <Grid cols={3}>
          <Field label="Salary Type">
            <select className={CTRL} value={salaryType} onChange={(e) => setSalaryType(e.target.value as SalaryType)}>
              <option value="regular">Regular</option>
              <option value="day-basis">Day Basis</option>
            </select>
          </Field>
          <Field label="Salary Option">
            <select className={CTRL} value={salaryOption} onChange={(e) => setSalaryOption(e.target.value as SalaryOption)}>
              <option value="gross">Gross</option>
              <option value="structure-basic">Structure (Basic)</option>
              <option value="structure-gross">Structure (Gross)</option>
            </select>
          </Field>
        </Grid>

        {/* ── Gross only ── */}
        {salaryOption === "gross" && (
          <Grid cols={3}>
            <Field label="Gross Salary">
              <NumInput value={grossOnly} onChange={setGrossOnly} />
            </Field>
          </Grid>
        )}

        {/* ── Structure (Basic) ── */}
        {salaryOption === "structure-basic" && (
          <div className="flex flex-col gap-3">
            <Grid cols={3}>
              <Field label="Basic Salary">
                <NumInput value={structBasic} onChange={setStructBasic} />
              </Field>
              <Field label="Gross Salary">
                <NumInput value={structBasicGross} onChange={setStructBasicGross} />
              </Field>
            </Grid>
            <TotalRow
              label="Total Salary"
              value={(parseFloat(structBasic) || 0) + (parseFloat(structBasicGross) || 0)}
            />
          </div>
        )}

        {/* ── Structure (Gross) ── */}
        {salaryOption === "structure-gross" && (
          <div className="flex flex-col gap-3">
            <Grid cols={4}>
              <Field label="Gross Salary">
                <NumInput value={sg.gross} onChange={(v) => setSgField("gross", v)} />
              </Field>
              <Field label="Basic Salary">
                <NumInput value={sg.basic} onChange={(v) => setSgField("basic", v)} />
              </Field>
              <Field label="House Rent">
                <NumInput value={sg.houseRent} onChange={(v) => setSgField("houseRent", v)} />
              </Field>
              <Field label="Medical Allowance">
                <NumInput value={sg.medical} onChange={(v) => setSgField("medical", v)} />
              </Field>
              <Field label="Conveyance">
                <NumInput value={sg.conveyance} onChange={(v) => setSgField("conveyance", v)} />
              </Field>
              <Field label="Mobile Allowance">
                <NumInput value={sg.mobile} onChange={(v) => setSgField("mobile", v)} />
              </Field>
              <Field label="Food Allowance">
                <NumInput value={sg.food} onChange={(v) => setSgField("food", v)} />
              </Field>
              <Field label="Extra Allowance">
                <NumInput value={sg.extra} onChange={(v) => setSgField("extra", v)} />
              </Field>
            </Grid>
            <TotalRow label="Total Salary (Structure)" value={sgTotal} />
          </div>
        )}
      </div>
    </SectionCard>
  );
}

// ─── Card 2 — Additions & Deductions ─────────────────────────────────────────

let nextId = 1;

function AdditionsDeductionsCard() {
  const [rows, setRows] = useState<AdjustmentRow[]>([]);
  const [fromMonth, setFromMonth] = useState("");
  const [toMonth, setToMonth] = useState("");
  const [type, setType] = useState<"addition" | "deduction">("addition");
  const [amount, setAmount] = useState("");

  const add = () => {
    if (!fromMonth || !toMonth || !amount) return;
    setRows((p) => [...p, { id: nextId++, fromMonth, toMonth, type, amount }]);
    setFromMonth(""); setToMonth(""); setAmount("");
  };

  const remove = (id: number) => setRows((p) => p.filter((r) => r.id !== id));

  return (
    <SectionCard title="Additions & Deductions">
      <div className="flex flex-col gap-4">
        {/* Input row */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-[1fr_1fr_1fr_1fr_auto]">
          <Field label="From Month">
            <input type="month" className={CTRL} value={fromMonth} onChange={(e) => setFromMonth(e.target.value)} />
          </Field>
          <Field label="To Month">
            <input type="month" className={CTRL} value={toMonth} onChange={(e) => setToMonth(e.target.value)} />
          </Field>
          <Field label="Type">
            <select className={CTRL} value={type} onChange={(e) => setType(e.target.value as "addition" | "deduction")}>
              <option value="addition">Addition</option>
              <option value="deduction">Deduction</option>
            </select>
          </Field>
          <Field label="Amount">
            <NumInput value={amount} onChange={setAmount} />
          </Field>
          <div className="flex items-end">
            <Button variant="accent" size="md" onClick={add}>
              <Plus /> Add
            </Button>
          </div>
        </div>

        {/* List */}
        {rows.length > 0 && (
          <div className="overflow-hidden rounded-lg border border-line">
            <table className="w-full text-sm">
              <thead className="bg-canvas text-xs font-semibold text-ink-muted">
                <tr>
                  <th className="px-4 py-2 text-left">From</th>
                  <th className="px-4 py-2 text-left">To</th>
                  <th className="px-4 py-2 text-left">Type</th>
                  <th className="px-4 py-2 text-right">Amount</th>
                  <th className="px-4 py-2" />
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {rows.map((r) => (
                  <tr key={r.id} className="hover:bg-canvas">
                    <td className="px-4 py-2 text-ink">{r.fromMonth}</td>
                    <td className="px-4 py-2 text-ink">{r.toMonth}</td>
                    <td className="px-4 py-2">
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                        r.type === "addition"
                          ? "bg-success/10 text-success"
                          : "bg-danger/10 text-danger"
                      }`}>
                        {r.type === "addition" ? "Addition" : "Deduction"}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-right font-medium text-ink">
                      {parseFloat(r.amount).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                    </td>
                    <td className="px-4 py-2 text-right">
                      <button
                        type="button"
                        onClick={() => remove(r.id)}
                        className="flex size-6 items-center justify-center rounded text-ink-faint hover:bg-danger/10 hover:text-danger"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </SectionCard>
  );
}

// ─── Card 3 — Salary Disbursement ─────────────────────────────────────────────

function DisbursementCard({ totalSalary }: { totalSalary: number }) {
  const [mode, setMode] = useState<DisbursementMode>("bank");
  const [eligibleOT, setEligibleOT] = useState(false);
  const [eligiblePF, setEligiblePF] = useState(false);

  // Bank details
  const [bankName, setBankName] = useState("");
  const [branchName, setBranchName] = useState("");
  const [accountName, setAccountName] = useState("");
  const [accountNo, setAccountNo] = useState("");
  const [routingNo, setRoutingNo] = useState("");

  // MFS details
  const [mfsProvider, setMfsProvider] = useState("");
  const [mfsNumber, setMfsNumber] = useState("");
  const [mfsAccountName, setMfsAccountName] = useState("");

  const showBank = mode === "bank" || mode === "multiple";
  const showMfs  = mode === "mfs"  || mode === "multiple";

  return (
    <SectionCard title="Salary Disbursement">
      <div className="flex flex-col gap-5">

        {/* Mode tabs */}
        <div className="flex flex-wrap gap-2">
          {(["cash", "bank", "mfs", "multiple"] as DisbursementMode[]).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={`rounded-lg border px-4 py-1.5 text-sm font-medium capitalize transition-colors ${
                mode === m
                  ? "border-accent-strong bg-accent-soft text-accent-strong"
                  : "border-line bg-surface text-ink-muted hover:bg-canvas"
              }`}
            >
              {m === "mfs" ? "MFS" : m.charAt(0).toUpperCase() + m.slice(1)}
            </button>
          ))}
        </div>

        {/* Payable amount */}
        <div className="flex items-center justify-between rounded-lg border border-line bg-canvas px-4 py-2.5">
          <span className="text-sm font-medium text-ink-muted">Payable Amount</span>
          <span className="text-base font-bold text-ink">
            {totalSalary.toLocaleString("en-US", { minimumFractionDigits: 2 })}
          </span>
        </div>

        {/* Eligibility checkboxes */}
        <div className="flex flex-wrap gap-5">
          <label className="flex cursor-pointer items-center gap-2 text-sm text-ink">
            <input
              type="checkbox"
              checked={eligibleOT}
              onChange={(e) => setEligibleOT(e.target.checked)}
              className="size-4 accent-(--accent-strong)"
            />
            Eligible for Overtime
          </label>
          <label className="flex cursor-pointer items-center gap-2 text-sm text-ink">
            <input
              type="checkbox"
              checked={eligiblePF}
              onChange={(e) => setEligiblePF(e.target.checked)}
              className="size-4 accent-(--accent-strong)"
            />
            Eligible for PF
          </label>
        </div>

        {/* Bank details */}
        {showBank && (
          <div className="flex flex-col gap-3 rounded-xl border border-line p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-ink-faint">Bank Details</p>
            <Grid cols={3}>
              <Field label="Bank Name">
                <input className={CTRL} value={bankName} onChange={(e) => setBankName(e.target.value)} placeholder="e.g. Dutch-Bangla Bank" />
              </Field>
              <Field label="Branch Name">
                <input className={CTRL} value={branchName} onChange={(e) => setBranchName(e.target.value)} placeholder="e.g. Gulshan Branch" />
              </Field>
              <Field label="Account Name">
                <input className={CTRL} value={accountName} onChange={(e) => setAccountName(e.target.value)} />
              </Field>
              <Field label="Account Number">
                <input className={CTRL} value={accountNo} onChange={(e) => setAccountNo(e.target.value)} placeholder="e.g. 1234567890" />
              </Field>
              <Field label="Routing Number">
                <input className={CTRL} value={routingNo} onChange={(e) => setRoutingNo(e.target.value)} placeholder="e.g. 090261234" />
              </Field>
            </Grid>
          </div>
        )}

        {/* Mobile banking details */}
        {showMfs && (
          <div className="flex flex-col gap-3 rounded-xl border border-line p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-ink-faint">Mobile Banking Details</p>
            <Grid cols={3}>
              <Field label="MFS Provider">
                <select className={CTRL} value={mfsProvider} onChange={(e) => setMfsProvider(e.target.value)}>
                  <option value="">— Select —</option>
                  <option value="bKash">bKash</option>
                  <option value="Nagad">Nagad</option>
                  <option value="Rocket">Rocket</option>
                  <option value="Upay">Upay</option>
                  <option value="SureCash">SureCash</option>
                </select>
              </Field>
              <Field label="Mobile Number">
                <input type="tel" className={CTRL} value={mfsNumber} onChange={(e) => setMfsNumber(e.target.value)} placeholder="01XXXXXXXXX" />
              </Field>
              <Field label="Account Name">
                <input className={CTRL} value={mfsAccountName} onChange={(e) => setMfsAccountName(e.target.value)} />
              </Field>
            </Grid>
          </div>
        )}
      </div>
    </SectionCard>
  );
}

// ─── Main export ──────────────────────────────────────────────────────────────

export function SalaryInfoTab({ employeeId: _employeeId }: { employeeId: string }) {
  const toast = useToast();
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      // TODO: collect all state and call salary API
      await new Promise((r) => setTimeout(r, 600));
      toast.success("Salary information saved.");
    } catch {
      toast.error("Failed to save salary information.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="flex flex-col gap-4 pb-6">
      <SalaryStructureCard />
      <AdditionsDeductionsCard />
      <DisbursementCard totalSalary={0} />

      <div className="flex justify-end gap-2">
        <Button variant="accent" size="md" loading={isSaving} onClick={handleSave}>
          Save Salary Info
        </Button>
      </div>
    </div>
  );
}

// ─── Read-only summary for profile dialog ────────────────────────────────────

export function SalaryInfoSummary() {
  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-2 gap-3">
        {[
          ["Salary Type", "—"],
          ["Salary Option", "—"],
          ["Gross Salary", "—"],
          ["Disbursement Mode", "—"],
          ["Eligible for OT", "—"],
          ["Eligible for PF", "—"],
        ].map(([label, value]) => (
          <div key={label} className="flex flex-col gap-0.5">
            <span className="text-xs text-ink-faint">{label}</span>
            <span className="text-sm text-ink">{value}</span>
          </div>
        ))}
      </div>
      <p className="rounded-lg border border-dashed border-line px-4 py-3 text-center text-xs text-ink-faint">
        Full salary details are available on the Salary Info tab.
      </p>
    </div>
  );
}
