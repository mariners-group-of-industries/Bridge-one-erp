"use client";

import { ArrowLeft, Save } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { PageContainer, PageHead } from "@/components/layout/page";
import { Button, buttonClasses } from "@/components/ui/button";
import { ErrorState, LoadingState } from "@/components/ui/section";
import { useToast } from "@/components/ui/toast";
import { useResource } from "@/hooks/use-resource";
import { errorMessage } from "@/lib/api/client";
import { entityMasterDataBreadcrumbs } from "@/features/configuration/entity-master-data/breadcrumbs";
import { Notice, SaveState } from "@/features/configuration/entity-master-data/employee/components/kit";
import { salesConfigPaths } from "../../paths";
import { OFFER_KINDS, offerInputSchema, slugFromKind, type OfferDto, type OfferInput, type OfferKind, type OfferOptions } from "../schemas/offer.schema";
import { offerApi } from "../services/offer.api";
import { DiscountOfferEditor, SpecialDiscountOfferEditor, blankSpecialLine, type DiscountForm, type SpecialDiscountForm } from "./DiscountOfferEditors";
import { ItemMultipleOfferEditor, ItemOfferEditor, blankBonusLine, blankItemLine, blankPairLine, type ItemForm, type ItemMultipleForm } from "./ItemOfferEditors";
import type { Errors } from "./offer-form-kit";

type AnyForm = ItemForm | ItemMultipleForm | DiscountForm | SpecialDiscountForm;

function blankForm(kind: OfferKind, businessUnitId: string): AnyForm {
  const head = { businessUnitId, name: "", fromDate: "", toDate: "" };
  const trio = { categoryId: "", subCategoryId: "", minorCategoryId: "" };
  switch (kind) {
    case "ITEM":
      return { kind, ...head, customerGroupId: "", ...trio, lines: [blankItemLine()] };
    case "ITEM_MULTIPLE":
      return { kind, ...head, priceListId: "", basedOn: "", pairLines: [blankPairLine()], bonusLines: [blankBonusLine()] };
    case "DISCOUNT":
      return { kind, ...head, basedOn: "", customerGroupId: "", priceListId: "", ...trio, lines: [] };
    default:
      return { kind: "SPECIAL_DISCOUNT", ...head, remarks: "", basedOn: "Invoice Amount", lines: [blankSpecialLine()] };
  }
}

/** Create (kind from the tab) or edit an offer. */
export function OfferFormView({ offerId, kind: createKind }: { offerId?: string; kind?: OfferKind }) {
  const options = useResource("offer-options", offerApi.options);
  const offer = useResource(offerId ? `offer:${offerId}` : null, () => offerApi.get(offerId!));
  const kind = offer.data?.kind ?? createKind ?? "ITEM";
  const label = OFFER_KINDS.find((entry) => entry.kind === kind)!.label;
  const title = offerId ? `Edit Offer: ${offer.data?.name ?? label}` : `Create Offer: ${label}`;
  const breadcrumbs = [
    ...entityMasterDataBreadcrumbs(salesConfigPaths.offerSetup),
    { label: offerId ? (offer.data?.name ?? "Offer") : "Create Offer", href: offerId ? salesConfigPaths.offerEdit(offerId) : salesConfigPaths.offerCreate(slugFromKind(kind)) },
  ];
  const initial = useMemo<AnyForm | null>(() => {
    if (!options.data) return null;
    if (offer.data) {
      const { id: _id, isActive: _active, ...rest } = offer.data as OfferDto;
      return rest as AnyForm;
    }
    const units = options.data.businessUnits;
    return blankForm(kind, units.length === 1 ? units[0].id : "");
  }, [options.data, offer.data, kind]);
  const error = options.error ?? offer.error;
  const backHref = `${salesConfigPaths.offerSetup}?tab=${slugFromKind(kind)}`;

  return (
    <PageContainer full>
      {error || !initial || (offerId && !offer.data) ? (
        <>
          <PageHead title={title} breadcrumbs={breadcrumbs} />
          <section className="rounded border border-line bg-surface">
            {error ? (
              <ErrorState
                message={error.message}
                onRetry={() => {
                  options.reload();
                  offer.reload();
                }}
              />
            ) : (
              <LoadingState label="Loading offer…" />
            )}
          </section>
        </>
      ) : (
        <OfferEditor key={offer.data?.id ?? kind} offerId={offerId} title={title} breadcrumbs={breadcrumbs} initial={initial} options={options.data!} backHref={backHref} />
      )}
    </PageContainer>
  );
}

function OfferEditor({
  offerId,
  title,
  breadcrumbs,
  initial,
  options,
  backHref,
}: {
  offerId?: string;
  title: string;
  breadcrumbs: { label: string; href: string }[];
  initial: AnyForm;
  options: OfferOptions;
  backHref: string;
}) {
  const router = useRouter();
  const toast = useToast();
  const [form, setForm] = useState<AnyForm>(initial);
  const [dirty, setDirty] = useState(false);
  const [errors, setErrors] = useState<Errors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const patch = (changes: Partial<AnyForm>) => {
    setForm((current) => {
      const next = { ...current, ...changes } as AnyForm;
      // A different business unit invalidates every unit-specific choice.
      if ("businessUnitId" in changes && changes.businessUnitId !== current.businessUnitId) {
        return { ...blankForm(current.kind, changes.businessUnitId ?? ""), name: next.name, fromDate: next.fromDate, toDate: next.toDate } as AnyForm;
      }
      return next;
    });
    setDirty(true);
    setErrors((current) => {
      const keys = Object.keys(current).filter((key) => Object.keys(changes).some((changed) => key === changed || key.startsWith(`${changed}.`)));
      if (keys.length === 0) return current;
      const next = { ...current };
      for (const key of keys) delete next[key];
      return next;
    });
  };

  const save = async () => {
    setFormError(null);
    const parsed = offerInputSchema.safeParse(form);
    if (!parsed.success) {
      const next: Errors = {};
      for (const issue of parsed.error.issues) next[issue.path.join(".")] ??= issue.message;
      setErrors(next);
      setFormError("Please correct the highlighted fields.");
      return;
    }
    setSaving(true);
    try {
      const payload = form as OfferInput;
      const saved = offerId ? await offerApi.update(offerId, payload) : await offerApi.create(payload);
      toast.success(`Offer "${saved.name}" saved.`);
      router.push(backHref);
    } catch (err) {
      setFormError(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const editorProps = { errors, options, unit: form.businessUnitId, locked: !!offerId };

  return (
    <>
      <PageHead
        title={title}
        breadcrumbs={breadcrumbs}
        actions={
          <Link href={backHref} className={buttonClasses("secondary", "md")}>
            <ArrowLeft /> All Offers
          </Link>
        }
      />
      <form
        noValidate
        className="flex flex-col gap-4 pb-6"
        onSubmit={(event) => {
          event.preventDefault();
          void save();
        }}
      >
        {formError && <Notice tone="error">{formError}</Notice>}
        {form.kind === "ITEM" && <ItemOfferEditor {...editorProps} form={form} patch={patch as (c: Partial<ItemForm>) => void} />}
        {form.kind === "ITEM_MULTIPLE" && <ItemMultipleOfferEditor {...editorProps} form={form} patch={patch as (c: Partial<ItemMultipleForm>) => void} />}
        {form.kind === "DISCOUNT" && <DiscountOfferEditor {...editorProps} form={form} patch={patch as (c: Partial<DiscountForm>) => void} />}
        {form.kind === "SPECIAL_DISCOUNT" && <SpecialDiscountOfferEditor {...editorProps} form={form} patch={patch as (c: Partial<SpecialDiscountForm>) => void} />}

        <div className="sticky bottom-0 z-10 flex flex-wrap items-center justify-end gap-2 rounded border border-line bg-surface/95 px-4 py-2.5 shadow-xs backdrop-blur">
          <SaveState dirty={dirty} />
          <Link href={backHref} className={buttonClasses("secondary", "md")}>
            Cancel
          </Link>
          <Button type="submit" variant="accent" loading={saving}>
            {!saving && <Save />} Save Offer
          </Button>
        </div>
      </form>
    </>
  );
}
