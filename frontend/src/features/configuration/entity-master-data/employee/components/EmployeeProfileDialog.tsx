"use client";

import { ArrowUpRight } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { Button, buttonClasses } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { ErrorState, LoadingState } from "@/components/ui/section";
import { useResource } from "@/hooks/use-resource";
import { apiRequest } from "@/lib/api/client";
import { cn } from "@/lib/cn";
import { entityMasterDataPaths } from "../../paths";
import type { EmployeeActionTarget, ProfileTab } from "../actions/employee-actions";
import type { SalaryDto } from "../schemas/salary.schema";
import type { DocumentDto } from "../server/document.service";
import { academicApi } from "../services/academic.api";
import { employmentHistoryApi } from "../services/employment-history.api";
import { personalInfoApi } from "../services/personal-info.api";
import { salaryApi } from "../services/salary.api";
import { Avatar, ReadValue, StatusBadge, TABLE } from "./kit";
import { MODES, money, SALARY_OPTIONS, SALARY_TYPES, salaryTotal } from "./SalaryInfoTab";

interface Props {
  employee: EmployeeActionTarget | null;
  onClose: () => void;
}

const DOCUMENTS = (id: string) => `/api/configuration/entity-master-data/employees/${id}/documents`;

/** Read-only "Profile View" of one employee, opened from the list: a summary of every profile tab. */
export function EmployeeProfileDialog({ employee, onClose }: Props) {
  const { data, error, reload } = useResource(
    employee ? `profile-dialog:${employee.employeeId}` : null,
    () => personalInfoApi.getPersonalInfo(employee!.employeeId),
  );

  return (
    <Dialog
      open={employee !== null}
      size="xl"
      title="Employee Profile"
      onClose={onClose}
      footer={
        employee && (
          <>
            <Button onClick={onClose}>Close</Button>
            <Link href={entityMasterDataPaths.employeeProfile(employee.employeeId)} className={buttonClasses("accent", "md")}>
              Edit Profile <ArrowUpRight />
            </Link>
          </>
        )
      }
    >
      {employee && (
        <div className="flex flex-col gap-6">
          <div className="flex items-center gap-3 rounded-lg border border-line bg-canvas px-4 py-3">
            <Avatar name={employee.name} size="lg" />
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <p className="truncate text-base font-semibold text-ink">{employee.name}</p>
              <p className="truncate text-xs text-ink-faint">
                {[employee.employeeCode, data?.designation, data?.officeName].filter(Boolean).join(" · ")}
              </p>
            </div>
            {data && <StatusBadge active={!data.terminationDate} />}
          </div>

          {error ? (
            <ErrorState message={error.message} onRetry={reload} />
          ) : !data ? (
            <LoadingState label="Loading profile…" />
          ) : (
            <>
              <Section title="Personal Info" employeeId={employee.employeeId} tab="personal-info">
                <Grid>
                  <ReadValue label="Mobile" value={data.mobile} />
                  <ReadValue label="Official Contact" value={data.officialContact} />
                  <ReadValue label="Email" value={data.email} className="col-span-2" />
                  <ReadValue label="Date of Birth" value={data.dateOfBirth} />
                  <ReadValue label="Gender" value={data.gender} />
                  <ReadValue label="Religion" value={data.religion} />
                  <ReadValue label="Blood Group" value={data.bloodGroup} />
                  <ReadValue label="NID Number" value={data.nidNumber} />
                  <ReadValue label="Father's Name" value={data.fathersName} />
                  <ReadValue label="Mother's Name" value={data.mothersName} />
                  <ReadValue label="Present Address" value={data.presentAddress} className="col-span-2" />
                  <ReadValue label="Permanent Address" value={data.permanentAddress} className="col-span-2" />
                </Grid>
              </Section>

              <Section title="Official Info" employeeId={employee.employeeId} tab="official-info">
                <Grid>
                  <ReadValue label="Department" value={data.department} />
                  <ReadValue label="Department Section" value={data.departmentSection} />
                  <ReadValue label="HR Position" value={data.hrPosition} />
                  <ReadValue label="Employee Type" value={data.employeeType} />
                  <ReadValue label="Service Category" value={data.serviceCategory} />
                  <ReadValue label="Employee Policy" value={data.employeePolicy} />
                  <ReadValue label="Office" value={data.officeName} />
                  <ReadValue label="Location" value={data.location} />
                  <ReadValue label="Joining Date" value={data.joiningDate} />
                  <ReadValue label="Confirmation Date" value={data.confirmationDate} />
                  <ReadValue label="Termination Date" value={data.terminationDate} />
                  <ReadValue label="Supervisor" value={data.supervisor} />
                  <ReadValue label="Line Manager" value={data.lineManager} />
                </Grid>
              </Section>

              <SalarySummary employeeId={employee.employeeId} />
              <DocumentsSummary employeeId={employee.employeeId} />
              <AcademicSummary employeeId={employee.employeeId} />
              <EmploymentSummary employeeId={employee.employeeId} />
            </>
          )}
        </div>
      )}
    </Dialog>
  );
}

// ─── Sections ─────────────────────────────────────────────────────────────────

function SalarySummary({ employeeId }: { employeeId: string }) {
  const { data, error, reload } = useResource(`profile-dialog-salary:${employeeId}`, () => salaryApi.get(employeeId));
  return (
    <Section title="Salary" employeeId={employeeId} tab="salary-info">
      <Loaded data={data} error={error} onRetry={reload}>
        {(salary) => <SalaryDetails salary={salary} />}
      </Loaded>
    </Section>
  );
}

function SalaryDetails({ salary }: { salary: SalaryDto }) {
  const total = salaryTotal(salary);
  if (total === 0 && salary.adjustments.length === 0) return <Empty>No salary recorded yet.</Empty>;

  const label = (list: readonly { value: string; label: string }[], value: string) =>
    list.find((item) => item.value === value)?.label ?? value;
  const bank = salary.disbursementMode === "bank" || salary.disbursementMode === "multiple";
  const mfs = salary.disbursementMode === "mfs" || salary.disbursementMode === "multiple";

  return (
    <div className="flex flex-col gap-3">
      <Grid>
        <ReadValue label="Salary Type" value={label(SALARY_TYPES, salary.salaryType)} />
        <ReadValue label="Salary Option" value={label(SALARY_OPTIONS, salary.salaryOption)} />
        <ReadValue label="Total Salary" value={<span className="font-semibold tabular-nums">{money(total)}</span>} />
        <ReadValue label="Payment Method" value={label(MODES, salary.disbursementMode)} />
        <ReadValue label="Overtime" value={salary.eligibleOT ? "Eligible" : "Not eligible"} />
        <ReadValue label="Provident Fund" value={salary.eligiblePF ? "Eligible" : "Not eligible"} />
        {bank && <ReadValue label="Bank" value={[salary.bankName, salary.branchName].filter(Boolean).join(", ")} />}
        {bank && <ReadValue label="Account No." value={mask(salary.bankAccountNo)} />}
        {mfs && <ReadValue label="MFS" value={salary.mfsProvider} />}
        {mfs && <ReadValue label="MFS Number" value={mask(salary.mfsNumber)} />}
      </Grid>
      {salary.adjustments.length > 0 && (
        <SummaryTable
          head={["From", "To", "Type", "Amount"]}
          rows={salary.adjustments.map((adj) => ({
            key: adj.id,
            cells: [adj.fromMonth, adj.toMonth, adj.type === "addition" ? "Addition" : "Deduction", money(parseFloat(adj.amount) || 0)],
          }))}
        />
      )}
    </div>
  );
}

function DocumentsSummary({ employeeId }: { employeeId: string }) {
  const { data, error, reload } = useResource(`profile-dialog-documents:${employeeId}`, () =>
    apiRequest<DocumentDto[]>(DOCUMENTS(employeeId)),
  );
  return (
    <Section title="Documents" count={data?.length} employeeId={employeeId} tab="update-document">
      <Loaded data={data} error={error} onRetry={reload}>
        {(docs) =>
          docs.length === 0 ? (
            <Empty>No documents uploaded yet.</Empty>
          ) : (
            <SummaryTable
              head={["Type", "Name", "Issue Date", "File"]}
              rows={docs.map((doc) => ({
                key: doc.id,
                cells: [doc.documentType, doc.documentName, doc.issueDate, doc.fileName],
              }))}
            />
          )
        }
      </Loaded>
    </Section>
  );
}

function AcademicSummary({ employeeId }: { employeeId: string }) {
  const { data, error, reload } = useResource(`profile-dialog-academics:${employeeId}`, () => academicApi.get(employeeId));
  return (
    <Section title="Academic" count={data?.length} employeeId={employeeId} tab="academic-info">
      <Loaded data={data} error={error} onRetry={reload}>
        {(rows) =>
          rows.length === 0 ? (
            <Empty>No academic records yet.</Empty>
          ) : (
            <SummaryTable
              head={["Degree", "Institute", "Result", "Period"]}
              rows={rows.map((row) => ({
                key: row.id,
                cells: [
                  [row.degree, row.fieldOfStudy].filter(Boolean).join(", "),
                  row.institute,
                  row.scale ? `${row.result} / ${row.scale}` : row.result,
                  period(row.startDate, row.finishDate),
                ],
              }))}
            />
          )
        }
      </Loaded>
    </Section>
  );
}

function EmploymentSummary({ employeeId }: { employeeId: string }) {
  const { data, error, reload } = useResource(`profile-dialog-employment:${employeeId}`, () =>
    employmentHistoryApi.get(employeeId),
  );
  return (
    <Section title="Employment History" count={data?.length} employeeId={employeeId} tab="employment-history">
      <Loaded data={data} error={error} onRetry={reload}>
        {(rows) =>
          rows.length === 0 ? (
            <Empty>No previous employment recorded.</Empty>
          ) : (
            <SummaryTable
              head={["Company", "Job Title", "Location", "Period"]}
              rows={rows.map((row) => ({
                key: row.id,
                cells: [row.companyName, row.jobTitle, row.location, period(row.fromDate, row.toDate)],
              }))}
            />
          )
        }
      </Loaded>
    </Section>
  );
}

// ─── Building blocks ──────────────────────────────────────────────────────────

const period = (from: string, to: string) => [from, to].filter(Boolean).join(" – ");

/** Shows only the last 4 characters of an account number. */
const mask = (value: string) => (value ? `•••• ${value.slice(-4)}` : "");

function Section({
  title,
  count,
  employeeId,
  tab,
  children,
}: {
  title: string;
  count?: number;
  employeeId: string;
  tab: ProfileTab;
  children: ReactNode;
}) {
  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center gap-2 border-b border-line pb-1.5">
        <h3 className="text-xs font-semibold tracking-wide text-accent-strong uppercase dark:text-accent">{title}</h3>
        {count !== undefined && (
          <span className="rounded-full bg-accent-soft px-1.5 text-xs font-medium text-accent-strong tabular-nums dark:text-accent">
            {count}
          </span>
        )}
        <Link
          href={`${entityMasterDataPaths.employeeProfile(employeeId)}?tab=${tab}`}
          className="ml-auto inline-flex items-center gap-0.5 text-xs font-medium text-accent-strong hover:underline dark:text-accent [&_svg]:size-3.5"
        >
          Open <ArrowUpRight aria-hidden="true" />
          <span className="sr-only"> {title}</span>
        </Link>
      </div>
      {children}
    </section>
  );
}

function Grid({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-4">{children}</div>;
}

function Loaded<T>({
  data,
  error,
  onRetry,
  children,
}: {
  data: T | undefined;
  error: Error | undefined;
  onRetry: () => void;
  children: (data: T) => ReactNode;
}) {
  if (error) return <ErrorState message={error.message} onRetry={onRetry} />;
  if (data === undefined) return <p className="text-xs text-ink-faint">Loading…</p>;
  return children(data);
}

function Empty({ children }: { children: ReactNode }) {
  return <p className="text-sm text-ink-faint">{children}</p>;
}

function SummaryTable({ head, rows }: { head: string[]; rows: { key: string; cells: (string | null)[] }[] }) {
  return (
    // Fixed layout with wrapping cells: fits the dialog width, never scrolls sideways.
    <div className="overflow-hidden rounded-md border border-line">
      <table className={cn(TABLE.table, "table-fixed")}>
        <thead className={TABLE.head}>
          <tr>
            {head.map((label) => (
              <th key={label} scope="col" className="px-3 py-2 font-medium">
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.key} className="border-t border-line">
              {row.cells.map((cell, index) => (
                <td key={index} className={cn(TABLE.td, "break-words")}>
                  {cell || "—"}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
