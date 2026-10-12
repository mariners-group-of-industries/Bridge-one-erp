"use client";

import { X, User, Briefcase, Calendar, Phone, Heart, Users, Wallet } from "lucide-react";
import { useEffect, useRef } from "react";
import { Indicator } from "@/components/ui/indicator";
import { useResource } from "@/hooks/use-resource";
import { personalInfoApi } from "../services/personal-info.api";
import type { EmployeeActionTarget } from "../actions/employee-actions";
import { SalaryInfoSummary } from "./SalaryInfoTab";

interface Props {
  employee: EmployeeActionTarget | null;
  onClose: () => void;
}

const NONE = "—";
const val = (v: string | null | undefined) => v || NONE;

export function EmployeeProfileDialog({ employee, onClose }: Props) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  const { data, loading, error } = useResource(
    employee ? `profile-dialog:${employee.employeeId}` : null,
    () => personalInfoApi.getPersonalInfo(employee!.employeeId),
  );

  // open / close native dialog
  useEffect(() => {
    const el = dialogRef.current;
    if (!el) return;
    if (employee) {
      if (!el.open) el.showModal();
    } else {
      if (el.open) el.close();
    }
  }, [employee]);

  const isActive = data ? !data.terminationDate : null;

  return (
    <dialog
      ref={dialogRef}
      onCancel={(e) => { e.preventDefault(); onClose(); }}
      className="m-auto w-[calc(100%-2rem)] max-w-3xl rounded-2xl bg-canvas p-0 shadow-2xl backdrop:bg-black/50 open:flex open:flex-col"
      style={{ maxHeight: "90vh" }}
    >
      {employee && (
        <>
          {/* ── Header ── */}
          <div className="relative flex items-start gap-4 bg-accent-strong px-6 py-5">
            {/* Avatar */}
            <div className="flex size-16 shrink-0 items-center justify-center rounded-2xl bg-white/20 text-2xl font-bold text-white backdrop-blur">
              {employee.name.charAt(0).toUpperCase()}
            </div>

            {/* Name / meta */}
            <div className="flex flex-1 flex-col gap-1 pt-1">
              <h2 className="text-lg font-bold leading-tight text-white">{employee.name}</h2>
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm text-white/70">{employee.employeeCode}</span>
                {data?.designation && (
                  <span className="text-sm text-white/70">· {data.designation}</span>
                )}
                {data?.officeName && (
                  <span className="text-sm text-white/70">· {data.officeName}</span>
                )}
              </div>
              {isActive !== null && (
                <div className="mt-1">
                  {isActive
                    ? <Indicator color="green">Active</Indicator>
                    : <Indicator color="red">Inactive</Indicator>
                  }
                </div>
              )}
            </div>

            {/* Close */}
            <button
              type="button"
              aria-label="Close"
              onClick={onClose}
              className="absolute top-4 right-4 flex size-8 items-center justify-center rounded-lg text-white/70 hover:bg-white/20 hover:text-white"
            >
              <X className="size-4" />
            </button>
          </div>

          {/* ── Body ── */}
          <div className="flex-1 overflow-y-auto p-5">
            {loading && (
              <div className="flex items-center justify-center py-16">
                <span className="size-8 animate-spin rounded-full border-2 border-line border-t-accent-strong" />
              </div>
            )}
            {error && (
              <p className="py-10 text-center text-sm text-danger">{error.message}</p>
            )}
            {data && (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">

                <Card icon={<Briefcase className="size-4" />} title="Work Information">
                  <Field label="Department" value={val(data.department)} />
                  <Field label="Department Section" value={val(data.departmentSection)} />
                  <Field label="HR Position" value={val(data.hrPosition)} />
                  <Field label="Employee Type" value={val(data.employeeType)} />
                  <Field label="Service Category" value={val(data.serviceCategory)} />
                  <Field label="Employee Policy" value={val(data.employeePolicy)} />
                  <Field label="Location" value={val(data.location)} />
                  <Field label="Office" value={val(data.officeName)} />
                </Card>

                <Card icon={<Calendar className="size-4" />} title="Dates">
                  <Field label="Joining Date" value={val(data.joiningDate)} />
                  <Field label="Confirmation Date" value={val(data.confirmationDate)} />
                  <Field label="Termination Date" value={val(data.terminationDate)} />
                  <Field label="Date of Birth" value={val(data.dateOfBirth)} />
                </Card>

                <Card icon={<Phone className="size-4" />} title="Contact">
                  <Field label="Mobile" value={val(data.mobile)} />
                  <Field label="Official Contact" value={val(data.officialContact)} />
                  <Field label="Email" value={val(data.email)} />
                </Card>

                <Card icon={<Heart className="size-4" />} title="Personal Details">
                  <Field label="Gender" value={val(data.gender)} />
                  <Field label="Religion" value={val(data.religion)} />
                  <Field label="Blood Group" value={val(data.bloodGroup)} />
                  <Field label="NID Number" value={val(data.nidNumber)} />
                  <Field label="Father's Name" value={val(data.fathersName)} />
                  <Field label="Mother's Name" value={val(data.mothersName)} />
                </Card>

                <Card icon={<User className="size-4" />} title="Address" className="sm:col-span-2">
                  <div className="grid grid-cols-2 gap-4">
                    <Field label="Present Address" value={val(data.presentAddress)} />
                    <Field label="Permanent Address" value={val(data.permanentAddress)} />
                  </div>
                </Card>

                <Card icon={<Users className="size-4" />} title="Reporting" className="sm:col-span-2">
                  <div className="grid grid-cols-2 gap-4">
                    <Field label="Supervisor" value={val(data.supervisor)} />
                    <Field label="Line Manager" value={val(data.lineManager)} />
                  </div>
                </Card>

                <Card icon={<Wallet className="size-4" />} title="Salary Information" className="sm:col-span-2">
                  <SalaryInfoSummary />
                </Card>

              </div>
            )}
          </div>
        </>
      )}
    </dialog>
  );
}

function Card({
  icon, title, children, className,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`flex flex-col gap-3 rounded-xl border border-line bg-surface p-4 ${className ?? ""}`}>
      <div className="flex items-center gap-2 text-accent-strong">
        {icon}
        <span className="text-xs font-semibold uppercase tracking-wider">{title}</span>
      </div>
      <div className="flex flex-col gap-2.5">{children}</div>
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-xs text-ink-faint">{label}</span>
      <span className="text-sm text-ink">{value}</span>
    </div>
  );
}
