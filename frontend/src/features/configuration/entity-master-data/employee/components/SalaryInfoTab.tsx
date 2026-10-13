"use client";

import { Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ErrorState, LoadingState } from "@/components/ui/section";
import { useToast } from "@/components/ui/toast";
import { useResource } from "@/hooks/use-resource";
import { errorMessage } from "@/lib/api/client";
import { cn } from "@/lib/cn";
import type { SalaryAdjustmentDto } from "../schemas/salary.schema";
import { salaryApi } from "../services/salary.api";
import { Checkbox, DecimalInput, EmptyBlock, Field, FormGrid, Input, Panel, PanelSection, ReadValue, Select, TABLE } from "./kit";

// ─── Types ────────────────────────────────────────────────────────────────────

type SalaryType = "regular" | "day-basis";
type SalaryOption = "gross" | "structure-basic" | "structure-gross";
type DisbursementMode = "cash" | "bank" | "mfs" | "multiple";

interface LocalAdjustment {
  /** Temporary id for new rows (React key). */
  id: string;
  fromMonth: string;
  toMonth: string;
  type: "addition" | "deduction";
  amount: string;
}

interface StructureGross {
  gross: string;
  basic: string;
  houseRent: string;
  medical: string;
  conveyance: string;
  mobile: string;
  food: string;
  extra: string;
}

type SalaryData = Awaited<ReturnType<typeof salaryApi.get>>;

const n = (s: string) => parseFloat(s) || 0;
export const money = (value: number) => value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
let tempId = 0;

export const SALARY_TYPES = [
  { value: "regular", label: "Regular" },
  { value: "day-basis", label: "Day Basis" },
];
export const SALARY_OPTIONS = [
  { value: "gross", label: "Gross" },
  { value: "structure-basic", label: "Structure (Basic)" },
  { value: "structure-gross", label: "Structure (Gross)" },
];
export const MODES: { value: DisbursementMode; label: string }[] = [
  { value: "cash", label: "Cash" },
  { value: "bank", label: "Bank" },
  { value: "mfs", label: "MFS" },
  { value: "multiple", label: "Multiple" },
];
const MFS_PROVIDERS = ["bKash", "Nagad", "Rocket", "Upay", "SureCash"];

const STRUCTURE_FIELDS: { key: keyof StructureGross; label: string }[] = [
  { key: "gross", label: "Gross Salary" },
  { key: "basic", label: "Basic Salary" },
  { key: "houseRent", label: "House Rent" },
  { key: "medical", label: "Medical Allowance" },
  { key: "conveyance", label: "Conveyance" },
  { key: "mobile", label: "Mobile Allowance" },
  { key: "food", label: "Food Allowance" },
  { key: "extra", label: "Extra Allowance" },
];

// ─── Loader ───────────────────────────────────────────────────────────────────

export function SalaryInfoTab({ employeeId }: { employeeId: string }) {
  const { data, error, reload } = useResource(`salary:${employeeId}`, () => salaryApi.get(employeeId));

  // Remount the editor whenever fresh data arrives (first load, after save).
  const [seen, setSeen] = useState<SalaryData>();
  const [version, setVersion] = useState(0);
  if (data && data !== seen) {
    setSeen(data);
    setVersion((value) => value + 1);
  }

  if (error) return <Panel title="Salary"><ErrorState message={error.message} onRetry={reload} /></Panel>;
  if (!data) return <Panel title="Salary"><LoadingState /></Panel>;
  return <SalaryEditor key={version} employeeId={employeeId} initial={data} onSaved={reload} />;
}

// ─── Editor ───────────────────────────────────────────────────────────────────

function SalaryEditor({ employeeId, initial, onSaved }: { employeeId: string; initial: SalaryData; onSaved: () => void }) {
  const toast = useToast();
  const [isSaving, setIsSaving] = useState(false);

  const [salaryType, setSalaryType] = useState(initial.salaryType as SalaryType);
  const [salaryOption, setSalaryOption] = useState(initial.salaryOption as SalaryOption);
  const [grossOnly, setGrossOnly] = useState(initial.grossOnly);
  const [structBasic, setStructBasic] = useState(initial.structBasic);
  const [structGross, setStructGross] = useState(initial.structGross);
  const [sg, setSg] = useState<StructureGross>({
    gross: initial.sgGross,
    basic: initial.sgBasic,
    houseRent: initial.sgHouseRent,
    medical: initial.sgMedical,
    conveyance: initial.sgConveyance,
    mobile: initial.sgMobile,
    food: initial.sgFood,
    extra: initial.sgExtra,
  });

  const [adjustments, setAdjustments] = useState<LocalAdjustment[]>(
    initial.adjustments.map((a: SalaryAdjustmentDto) => ({ ...a })),
  );
  const [fromMonth, setFromMonth] = useState("");
  const [toMonth, setToMonth] = useState("");
  const [adjType, setAdjType] = useState<"addition" | "deduction">("addition");
  const [adjAmount, setAdjAmount] = useState("");

  const [mode, setMode] = useState(initial.disbursementMode as DisbursementMode);
  const [eligibleOT, setEligibleOT] = useState(initial.eligibleOT);
  const [eligiblePF, setEligiblePF] = useState(initial.eligiblePF);
  const [bankName, setBankName] = useState(initial.bankName);
  const [branchName, setBranchName] = useState(initial.branchName);
  const [accountName, setAccountName] = useState(initial.bankAccountName);
  const [accountNo, setAccountNo] = useState(initial.bankAccountNo);
  const [routingNo, setRoutingNo] = useState(initial.routingNo);
  const [mfsProvider, setMfsProvider] = useState(initial.mfsProvider);
  const [mfsNumber, setMfsNumber] = useState(initial.mfsNumber);
  const [mfsAccountName, setMfsAccountName] = useState(initial.mfsAccountName);

  const sgTotal = [sg.basic, sg.houseRent, sg.medical, sg.conveyance, sg.mobile, sg.food, sg.extra].reduce(
    (acc, v) => acc + n(v),
    0,
  );
  const totalSalary =
    salaryOption === "gross" ? n(grossOnly) : salaryOption === "structure-basic" ? n(structBasic) + n(structGross) : sgTotal;

  const canAddAdjustment = !!fromMonth && !!toMonth && !!adjAmount;
  const addRow = () => {
    if (!canAddAdjustment) return;
    setAdjustments((p) => [...p, { id: `tmp-${tempId++}`, fromMonth, toMonth, type: adjType, amount: adjAmount }]);
    setFromMonth("");
    setToMonth("");
    setAdjAmount("");
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await salaryApi.upsert(employeeId, {
        salaryType,
        salaryOption,
        grossOnly,
        structBasic,
        structGross,
        sgGross: sg.gross,
        sgBasic: sg.basic,
        sgHouseRent: sg.houseRent,
        sgMedical: sg.medical,
        sgConveyance: sg.conveyance,
        sgMobile: sg.mobile,
        sgFood: sg.food,
        sgExtra: sg.extra,
        disbursementMode: mode,
        eligibleOT,
        eligiblePF,
        bankName,
        branchName,
        bankAccountName: accountName,
        bankAccountNo: accountNo,
        routingNo,
        mfsProvider,
        mfsNumber,
        mfsAccountName,
        adjustments: adjustments
          .filter((a) => a.amount !== "")
          .map((a) => ({ fromMonth: a.fromMonth, toMonth: a.toMonth, type: a.type, amount: a.amount })),
      });
      toast.success("Salary information saved.");
      onSaved();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setIsSaving(false);
    }
  };

  const showBank = mode === "bank" || mode === "multiple";
  const showMfs = mode === "mfs" || mode === "multiple";

  return (
    <div className="flex flex-col gap-4 pb-6">
      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_20rem]">
        <Panel title="Salary Structure" description="How this employee's salary is calculated.">
          <div className="flex flex-col gap-4">
            <FormGrid cols={3}>
              <Field label="Salary Type">
                {(id) => (
                  <Select id={id} placeholder={false} value={salaryType} onChange={(e) => setSalaryType(e.target.value as SalaryType)} options={SALARY_TYPES} />
                )}
              </Field>
              <Field label="Salary Option">
                {(id) => (
                  <Select id={id} placeholder={false} value={salaryOption} onChange={(e) => setSalaryOption(e.target.value as SalaryOption)} options={SALARY_OPTIONS} />
                )}
              </Field>
            </FormGrid>

            {salaryOption === "gross" && (
              <FormGrid cols={3}>
                <Field label="Gross Salary">{(id) => <DecimalInput id={id} value={grossOnly} onValueChange={setGrossOnly} />}</Field>
              </FormGrid>
            )}
            {salaryOption === "structure-basic" && (
              <FormGrid cols={3}>
                <Field label="Basic Salary">{(id) => <DecimalInput id={id} value={structBasic} onValueChange={setStructBasic} />}</Field>
                <Field label="Gross Salary">{(id) => <DecimalInput id={id} value={structGross} onValueChange={setStructGross} />}</Field>
              </FormGrid>
            )}
            {salaryOption === "structure-gross" && (
              <FormGrid>
                {STRUCTURE_FIELDS.map(({ key, label }) => (
                  <Field key={key} label={label}>
                    {(id) => <DecimalInput id={id} value={sg[key]} onValueChange={(value) => setSg((p) => ({ ...p, [key]: value }))} />}
                  </Field>
                ))}
              </FormGrid>
            )}
          </div>
        </Panel>

        <Panel title="Summary">
          <dl className="flex flex-col gap-3">
            <div className="flex items-baseline justify-between gap-3">
              <dt className="text-sm text-ink-muted">
                {salaryOption === "structure-gross" ? "Total (structure)" : "Total salary"}
              </dt>
              <dd className="text-lg font-semibold text-accent-strong tabular-nums dark:text-accent">{money(totalSalary)}</dd>
            </div>
            <div className="flex justify-between gap-3 border-t border-line pt-3 text-sm">
              <dt className="text-ink-muted">Additions / deductions</dt>
              <dd className="font-medium text-ink tabular-nums">{adjustments.length}</dd>
            </div>
            <div className="flex justify-between gap-3 text-sm">
              <dt className="text-ink-muted">Paid by</dt>
              <dd className="font-medium text-ink">{MODES.find((m) => m.value === mode)?.label}</dd>
            </div>
          </dl>
        </Panel>
      </div>

      <Panel title="Additions & Deductions" description="Temporary amounts added to or deducted from the salary for a range of months.">
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-[repeat(4,minmax(0,1fr))_auto] lg:items-end">
            <Field label="From Month">{(id) => <Input id={id} type="month" value={fromMonth} onChange={(e) => setFromMonth(e.target.value)} />}</Field>
            <Field label="To Month">{(id) => <Input id={id} type="month" value={toMonth} onChange={(e) => setToMonth(e.target.value)} />}</Field>
            <Field label="Type">
              {(id) => (
                <Select
                  id={id}
                  placeholder={false}
                  value={adjType}
                  onChange={(e) => setAdjType(e.target.value as "addition" | "deduction")}
                  options={[{ value: "addition", label: "Addition" }, { value: "deduction", label: "Deduction" }]}
                />
              )}
            </Field>
            <Field label="Amount">{(id) => <DecimalInput id={id} value={adjAmount} onValueChange={setAdjAmount} />}</Field>
            <Button variant="accent-soft" onClick={addRow} disabled={!canAddAdjustment}>
              <Plus /> Add
            </Button>
          </div>

          {adjustments.length === 0 ? (
            <EmptyBlock title="No additions or deductions">Use the fields above to add one.</EmptyBlock>
          ) : (
            <div className={TABLE.wrap}>
              <table className={TABLE.table}>
                <thead className={TABLE.head}>
                  <tr>
                    <th className={TABLE.th}>From</th>
                    <th className={TABLE.th}>To</th>
                    <th className={TABLE.th}>Type</th>
                    <th className={cn(TABLE.th, "text-right")}>Amount</th>
                    <th className={cn(TABLE.th, "w-12")}>
                      <span className="sr-only">Remove</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {adjustments.map((r) => (
                    <tr key={r.id} className={TABLE.row}>
                      <td className={cn(TABLE.td, "text-ink tabular-nums")}>{r.fromMonth}</td>
                      <td className={cn(TABLE.td, "text-ink tabular-nums")}>{r.toMonth}</td>
                      <td className={TABLE.td}>
                        <span
                          className={cn(
                            "inline-flex rounded-full px-2 py-0.5 text-xs font-medium",
                            r.type === "addition" ? "bg-success/10 text-success" : "bg-danger/10 text-danger",
                          )}
                        >
                          {r.type === "addition" ? "Addition" : "Deduction"}
                        </span>
                      </td>
                      <td className={cn(TABLE.td, "text-right font-medium text-ink tabular-nums")}>{money(n(r.amount))}</td>
                      <td className={cn(TABLE.td, "py-1 text-right")}>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="hover:text-danger"
                          aria-label={`Remove ${r.type} ${r.fromMonth}–${r.toMonth}`}
                          onClick={() => setAdjustments((p) => p.filter((x) => x.id !== r.id))}
                        >
                          <Trash2 />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </Panel>

      <Panel
        title="Disbursement"
        description="How the salary is paid."
        stickyFooter
        footer={
          <Button variant="accent" loading={isSaving} onClick={handleSave}>
            Save Salary
          </Button>
        }
      >
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center gap-4">
            <div role="radiogroup" aria-label="Payment method" className="inline-flex rounded-md border border-line-strong p-0.5">
              {MODES.map((m) => (
                <button
                  key={m.value}
                  type="button"
                  role="radio"
                  aria-checked={mode === m.value}
                  onClick={() => setMode(m.value)}
                  className={cn(
                    "h-7 rounded px-4 text-sm font-medium transition-colors focus-visible:outline-2",
                    mode === m.value ? "bg-accent-strong text-white" : "text-ink-muted hover:bg-control hover:text-ink",
                  )}
                >
                  {m.label}
                </button>
              ))}
            </div>
            <Checkbox label="Eligible for overtime" checked={eligibleOT} onChange={(e) => setEligibleOT(e.target.checked)} />
            <Checkbox label="Eligible for PF" checked={eligiblePF} onChange={(e) => setEligiblePF(e.target.checked)} />
            <ReadValue label="Payable amount" value={<span className="font-semibold tabular-nums">{money(totalSalary)}</span>} className="sm:ml-auto sm:items-end" />
          </div>

          {showBank && (
            <PanelSection title="Bank Details">
              <FormGrid cols={3}>
                <Field label="Bank Name">{(id) => <Input id={id} value={bankName} placeholder="e.g. Dutch-Bangla Bank" onChange={(e) => setBankName(e.target.value)} />}</Field>
                <Field label="Branch Name">{(id) => <Input id={id} value={branchName} placeholder="e.g. Gulshan Branch" onChange={(e) => setBranchName(e.target.value)} />}</Field>
                <Field label="Account Name">{(id) => <Input id={id} value={accountName} onChange={(e) => setAccountName(e.target.value)} />}</Field>
                <Field label="Account Number">{(id) => <Input id={id} value={accountNo} placeholder="e.g. 1234567890" onChange={(e) => setAccountNo(e.target.value)} />}</Field>
                <Field label="Routing Number">{(id) => <Input id={id} value={routingNo} placeholder="e.g. 090261234" onChange={(e) => setRoutingNo(e.target.value)} />}</Field>
              </FormGrid>
            </PanelSection>
          )}

          {showMfs && (
            <PanelSection title="Mobile Banking">
              <FormGrid cols={3}>
                <Field label="MFS Provider">{(id) => <Select id={id} value={mfsProvider} onChange={(e) => setMfsProvider(e.target.value)} options={MFS_PROVIDERS} />}</Field>
                <Field label="Mobile Number">{(id) => <Input id={id} type="tel" value={mfsNumber} placeholder="01XXXXXXXXX" onChange={(e) => setMfsNumber(e.target.value)} />}</Field>
                <Field label="Account Name">{(id) => <Input id={id} value={mfsAccountName} onChange={(e) => setMfsAccountName(e.target.value)} />}</Field>
              </FormGrid>
            </PanelSection>
          )}
        </div>
      </Panel>
    </div>
  );
}

// ─── Read-only summary for the profile dialog ────────────────────────────────

/** Total of a saved salary record, calculated the same way as the editor. */
export function salaryTotal(salary: SalaryData): number {
  if (salary.salaryOption === "gross") return n(salary.grossOnly);
  if (salary.salaryOption === "structure-basic") return n(salary.structBasic) + n(salary.structGross);
  return [salary.sgBasic, salary.sgHouseRent, salary.sgMedical, salary.sgConveyance, salary.sgMobile, salary.sgFood, salary.sgExtra].reduce(
    (acc, v) => acc + n(v),
    0,
  );
}
