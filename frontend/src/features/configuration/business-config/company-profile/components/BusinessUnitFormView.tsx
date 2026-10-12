"use client";

import { Ellipsis, RefreshCw, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { PageContainer, PageHead } from "@/components/layout/page";
import { RecordMeta } from "@/components/layout/record-meta";
import { Button, buttonClasses } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/dialog";
import { DropdownMenu } from "@/components/ui/dropdown-menu";
import { Indicator } from "@/components/ui/indicator";
import { Card, EmptyState, ErrorState, FieldGrid, LoadingState, Section } from "@/components/ui/section";
import { Tabs } from "@/components/ui/tabs";
import { useToast } from "@/components/ui/toast";
import { useResource } from "@/hooks/use-resource";
import { useSaveShortcut } from "@/hooks/use-save-shortcut";
import { useValidatedForm } from "@/hooks/use-validated-form";
import { errorMessage } from "@/lib/api/client";
import { paths } from "../paths";
import { businessUnitInputSchema } from "../schemas/business-unit.schema";
import { businessUnitApi } from "../services/company-profile.api";
import type { BusinessUnitDto } from "../types";
import { BusinessUnitFields, businessUnitValues } from "./BusinessUnitFields";
import { OfficeTable } from "./OfficeTable";
import { TermsConditionsTable } from "./TermsConditionsTable";

type TabId = "details" | "offices" | "sales-terms" | "purchase-terms";

/** ERPNext form view for one business unit. */
export function BusinessUnitFormView({ businessUnitId }: { businessUnitId: string }) {
  // The API has no single-unit endpoint; the list is small and already scoped.
  const units = useResource(`business-units`, businessUnitApi.list);
  const unit = units.data?.find((item) => item.id === businessUnitId);

  let body: React.ReactNode = null;
  if (units.error) body = <ErrorState message={units.error.message} onRetry={units.reload} />;
  else if (!units.data) body = <LoadingState />;
  else if (!unit) {
    body = (
      <EmptyState title="Business unit not found">
        <p className="mb-3">It may have been deleted.</p>
        <Link href={paths.businessUnits} className={buttonClasses("primary")}>
          Back to Business Units
        </Link>
      </EmptyState>
    );
  }

  if (body || !unit) {
    return (
      <PageContainer>
        <PageHead title="Business Unit" />
        <Card>{body}</Card>
      </PageContainer>
    );
  }

  return (
    <BusinessUnitForm
      key={unit.id}
      unit={unit}
      onSaved={(saved) => units.mutate((list = []) => list.map((item) => (item.id === saved.id ? saved : item)))}
      onReload={units.reload}
    />
  );
}

function BusinessUnitForm({
  unit,
  onSaved,
  onReload,
}: {
  unit: BusinessUnitDto;
  onSaved: (unit: BusinessUnitDto) => void;
  onReload: () => void;
}) {
  const router = useRouter();
  const toast = useToast();
  const [tab, setTab] = useState<TabId>("details");
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const inFlight = useRef(false);
  const form = useValidatedForm(businessUnitInputSchema, businessUnitValues(unit));

  async function save() {
    if (inFlight.current || !form.dirty) return;
    const input = form.validate();
    if (!input) {
      setTab("details");
      return;
    }
    inFlight.current = true;
    setSaving(true);
    try {
      const saved = await businessUnitApi.update(unit.id, input);
      form.reset(businessUnitValues(saved));
      onSaved(saved);
      toast.success("Saved.");
    } catch (error) {
      if (form.applyServerError(error)) setTab("details");
      else toast.error(errorMessage(error));
    } finally {
      inFlight.current = false;
      setSaving(false);
    }
  }

  /** Discards unsaved changes and loads the latest saved values. */
  async function reload() {
    try {
      const fresh = (await businessUnitApi.list()).find((item) => item.id === unit.id);
      if (!fresh) {
        onReload();
        return;
      }
      form.reset(businessUnitValues(fresh));
      onSaved(fresh);
    } catch (error) {
      toast.error(errorMessage(error));
    }
  }

  async function remove() {
    setDeleting(true);
    try {
      await businessUnitApi.remove(unit.id);
      toast.success(`Business unit "${unit.name}" deleted.`);
      router.push(paths.businessUnits);
    } catch (error) {
      toast.error(errorMessage(error));
      setDeleting(false);
      setConfirmDelete(false);
    }
  }

  useSaveShortcut(() => void save(), form.dirty);

  const tabs = [
    { id: "details", label: "Details" },
    { id: "offices", label: "Offices", badge: unit.officeCount },
    { id: "sales-terms", label: "Sales Terms" },
    { id: "purchase-terms", label: "Purchase Terms" },
  ] as const;

  return (
    <PageContainer>
      <PageHead
        title={unit.name}
        subtitle="Business Unit"
        indicator={form.dirty && <Indicator color="orange">Not Saved</Indicator>}
        actions={
          <>
            <DropdownMenu
              items={[
                { label: "Reload", icon: <RefreshCw />, onSelect: () => void reload() },
                "separator",
                { label: "Delete", icon: <Trash2 />, danger: true, onSelect: () => setConfirmDelete(true) },
              ]}
              trigger={<Ellipsis />}
              triggerLabel="More actions"
              triggerClassName={buttonClasses("secondary", "icon", "size-8")}
            />
            <Button variant="primary" loading={saving} disabled={!form.dirty} onClick={save}>
              Save
            </Button>
          </>
        }
      />
      <Card>
        <Tabs tabs={tabs} value={tab} onChange={setTab} label="Business unit sections">
          {tab === "details" && (
            <form
              noValidate
              onSubmit={(event) => {
                event.preventDefault();
                void save();
              }}
            >
              <Section title="Business Unit Details">
                <FieldGrid>
                  <BusinessUnitFields form={form} />
                </FieldGrid>
              </Section>
              <button type="submit" hidden />
            </form>
          )}
          {tab === "offices" && <OfficeTable businessUnitId={unit.id} onOfficeCountChange={onReload} />}
          {tab === "sales-terms" && (
            <Section
              title="Sales Terms & Conditions / Payment Instructions"
              description="Choose which sales documents each term is printed on. Default terms are pre-selected on new documents."
            >
              <TermsConditionsTable businessUnitId={unit.id} domain="SALES" />
            </Section>
          )}
          {tab === "purchase-terms" && (
            <Section title="Purchase Terms & Conditions" description="Choose which purchase documents each term is printed on.">
              <TermsConditionsTable businessUnitId={unit.id} domain="PURCHASE" />
            </Section>
          )}
        </Tabs>
      </Card>
      <RecordMeta updatedAt={unit.updatedAt} />

      <ConfirmDialog
        open={confirmDelete}
        title="Delete business unit?"
        busy={deleting}
        message={
          <>
            <p>
              <strong>{unit.name}</strong> and its sales and purchase terms will be permanently deleted.
            </p>
            {unit.officeCount > 0 && (
              <p className="mt-2 text-danger">
                This unit still has {unit.officeCount} office(s). Remove them first.
              </p>
            )}
          </>
        }
        onConfirm={remove}
        onClose={() => setConfirmDelete(false)}
      />
    </PageContainer>
  );
}
