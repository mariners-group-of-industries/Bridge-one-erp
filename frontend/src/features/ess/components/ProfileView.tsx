"use client";

import { Pencil } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { buttonClasses } from "@/components/ui/button";
import { ErrorState, LoadingState } from "@/components/ui/section";
import { useResource } from "@/hooks/use-resource";
import { Avatar, Panel, ReadValue } from "@/features/configuration/entity-master-data/employee/components/kit";
import { essApi } from "../api";
import { essPaths } from "../navigation";
import type { EssProfile } from "../types";
import { EssPage, fmtDate } from "./ess-ui";

export function ProfileView() {
  return (
    <EssPage
      title="My Profile"
      subtitle="Your record in Employee Master. To change official details, contact HR."
      actions={
        <Link href={essPaths.account} className={buttonClasses("secondary", "md")}>
          <Pencil aria-hidden="true" />
          Account Settings
        </Link>
      }
    >
      {() => <Profile />}
    </EssPage>
  );
}

const isDate = (v: string | null) => !!v && /^\d{4}-\d{2}-\d{2}$/.test(v);

function Group({ title, rows }: { title: string; rows: EssProfile["basic"] }) {
  return (
    <Panel title={title}>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {rows.map((r) => (
          <ReadValue key={r.label} label={r.label} value={isDate(r.value) ? fmtDate(r.value) : r.value} />
        ))}
      </div>
    </Panel>
  );
}

function Profile() {
  const data = useResource("ess-profile", essApi.profile);
  const [photoFailed, setPhotoFailed] = useState(false);
  if (data.error) return <Panel><ErrorState message={data.error.message} onRetry={data.reload} /></Panel>;
  if (!data.data) return <Panel><LoadingState label="Loading profile…" /></Panel>;
  const { employee: e } = data.data;
  return (
    <>
      <section className="flex flex-wrap items-center gap-4 rounded border border-line bg-surface p-4 shadow-xs">
        {e.hasPhoto && !photoFailed ? (
          <Image src={essApi.photoUrl} alt={`Photo of ${e.name}`} width={64} height={64} unoptimized onError={() => setPhotoFailed(true)} className="size-16 shrink-0 rounded-full border border-line object-cover" />
        ) : (
          <Avatar name={e.name} size="lg" />
        )}
        <div className="min-w-0 flex-1">
          <h2 className="text-lg font-bold text-ink">{e.name}</h2>
          <p className="text-[13px] text-ink-muted">{[e.designation, e.department, e.officeName].filter(Boolean).join(" · ")}</p>
          <p className="mt-1 flex items-center gap-2 text-xs">
            <span className="font-mono font-semibold text-ink-muted">{e.code}</span>
            <Badge variant={e.canApply ? "success" : "danger"}>{e.canApply ? "Active" : "Inactive"}</Badge>
          </p>
        </div>
      </section>
      <Group title="Basic Information" rows={data.data.basic} />
      <Group title="Employment" rows={data.data.employment} />
      <Group title="Contact" rows={data.data.contact} />
    </>
  );
}
