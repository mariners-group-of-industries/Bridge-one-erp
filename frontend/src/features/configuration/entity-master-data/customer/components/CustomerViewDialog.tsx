"use client";

import { Download, Pencil } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { Button, buttonClasses } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { ErrorState, LoadingState } from "@/components/ui/section";
import { useResource } from "@/hooks/use-resource";
import { ReadValue, StatusBadge } from "../../employee/components/kit";
import { entityMasterDataPaths } from "../../paths";
import { CUSTOMER_FLAGS, type CustomerFormOptions } from "../schemas/customer.schema";
import { customerApi } from "../services/customer.api";

interface Props {
  /** Customer to show; null closes the dialog. */
  customer: { id: string; name: string; isActive: boolean } | null;
  options: CustomerFormOptions | undefined;
  onClose: () => void;
}

const money = (value: string) =>
  value ? Number(value).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : "";

/** Read-only "View" of one customer, opened from the list. */
export function CustomerViewDialog({ customer, options, onClose }: Props) {
  const { data, error, reload } = useResource(customer ? `customer-view:${customer.id}` : null, () => customerApi.get(customer!.id));

  const nameOf = (list: { id: string; name: string }[] | undefined, id: string) =>
    (id && list?.find((item) => item.id === id)?.name) || "";
  const district = (id: number | "") => (id === "" ? "" : (options?.districts.find((d) => d.id === id)?.name ?? ""));

  return (
    <Dialog
      open={customer !== null}
      size="xl"
      title="Customer Details"
      onClose={onClose}
      footer={
        customer && (
          <>
            <Button onClick={onClose}>Close</Button>
            <Link href={entityMasterDataPaths.customerEdit(customer.id)} className={buttonClasses("accent", "md")}>
              <Pencil /> Edit Customer
            </Link>
          </>
        )
      }
    >
      {customer &&
        (error ? (
          <ErrorState message={error.message} onRetry={reload} />
        ) : !data ? (
          <LoadingState label="Loading customer…" />
        ) : (
          <div className="flex flex-col gap-6">
            <div className="flex flex-wrap items-center gap-3 rounded border border-line bg-canvas px-4 py-3">
              <div className="flex min-w-0 flex-1 flex-col">
                <p className="truncate text-base font-bold text-ink">{data.name}</p>
                <p className="text-xs text-ink-faint">
                  {[data.code, nameOf(options?.offices, data.officeId)].filter(Boolean).join(" · ")}
                </p>
              </div>
              <StatusBadge active={customer.isActive} />
            </div>

            <Group title="Partner Details">
              <ReadValue label="Mobile Number" value={data.mobile} />
              <ReadValue label="Email" value={data.email} />
              <ReadValue label="Partner Group" value={nameOf(options?.groups, data.groupId)} />
              <ReadValue label="Sub Group" value={nameOf(options?.groups, data.subGroupId)} />
              <ReadValue label="Credit Days" value={data.creditDays} />
              <ReadValue label="Credit Limit" value={money(data.creditLimit)} />
              <ReadValue label="Territory" value={nameOf(options?.territories, data.territoryId)} />
              <ReadValue label="Default Sales Representative" value={nameOf(options?.salesPersons, data.salesPersonId)} />
              <ReadValue label="Tolerance (%)" value={data.tolerancePercent} />
              <ReadValue label="BIN Number" value={data.binNumber} />
              <ReadValue label="Price Type" value={nameOf(options?.priceLists, data.priceListId)} />
              <ReadValue label="TCS (%)" value={data.tcsPercent} />
              <ReadValue label="VAT Reg No (Central)" value={data.vatRegistrationNo} />
              <ReadValue label="TIN Number" value={data.tinNumber} />
              <ReadValue label="Trade License Number" value={data.tradeLicenseNo} />
              <ReadValue label="NID Number" value={data.nidNumber} />
              <ReadValue label="Marital Status" value={data.maritalStatus} />
              <ReadValue label="Marriage Date" value={data.marriageDate} />
              <ReadValue label="Birth Date" value={data.birthDate} />
              <ReadValue label="Gender" value={data.gender} />
            </Group>

            <section className="flex flex-col gap-2">
              <GroupTitle>Other Flags</GroupTitle>
              <ul className="flex flex-wrap gap-1.5">
                {CUSTOMER_FLAGS.filter((flag) => data[flag.key]).map((flag) => (
                  <li key={flag.key} className="rounded border border-accent-line bg-accent-soft px-2 py-0.5 text-xs font-medium text-accent-strong dark:text-accent">
                    {flag.label}
                  </li>
                ))}
                {CUSTOMER_FLAGS.every((flag) => !data[flag.key]) && <li className="text-sm text-ink-faint">None set.</li>}
              </ul>
            </section>

            <Group title="Billing Details">
              <ReadValue label="Billing Name" value={data.billingName} />
              <ReadValue label="Contact Person" value={data.contactPerson} />
              <ReadValue label="Contact No" value={data.contactNo} />
              <ReadValue label="Tax Bracket" value={nameOf(options?.taxBrackets, data.taxBracketId)} />
              <ReadValue label="Billing Address" value={data.billingAddress} className="col-span-2" />
              <ReadValue label="District" value={district(data.districtId)} />
              <ReadValue label="Thana" value={nameOf(options?.thanas, data.thanaId)} />
              <ReadValue label="Remarks / Notes" value={data.remarks} className="col-span-full" />
            </Group>

            {data.attachments.length > 0 && (
              <section className="flex flex-col gap-2">
                <GroupTitle>Attachments</GroupTitle>
                <ul className="flex flex-col divide-y divide-line rounded border border-line">
                  {data.attachments.map((attachment) => (
                    <li key={attachment.id} className="flex items-center gap-2 px-3 py-1.5 text-xs">
                      <span className="min-w-0 flex-1 truncate text-ink">{attachment.originalName}</span>
                      <a
                        href={customerApi.attachmentUrl(data.id, attachment.id)}
                        className="inline-flex items-center gap-1 font-medium text-accent-strong hover:underline dark:text-accent"
                      >
                        <Download aria-hidden="true" className="size-3.5" /> Download
                      </a>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            <section className="flex flex-col gap-2">
              <GroupTitle>Shipping Details ({data.shipping.length})</GroupTitle>
              {data.shipping.length === 0 ? (
                <p className="text-sm text-ink-faint">No shipping details.</p>
              ) : (
                <div className="overflow-hidden">
                  <table className="data-grid w-full table-fixed">
                    <thead>
                      <tr>
                        {["Code", "Ref / Outlet", "Address", "Contact", "District / Thana", "Section"].map((header) => (
                          <th key={header} scope="col" className="px-2.5 py-2 text-left whitespace-normal">
                            {header}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {data.shipping.map((row) => (
                        <tr key={row.id}>
                          <td className="px-2.5 py-2 break-words">{row.code || "—"}</td>
                          <td className="px-2.5 py-2 break-words">{row.outlet || "—"}</td>
                          <td className="px-2.5 py-2 break-words">{row.address}</td>
                          <td className="px-2.5 py-2 break-words">{[row.contactPerson, row.contactNo].filter(Boolean).join(", ") || "—"}</td>
                          <td className="px-2.5 py-2 break-words">
                            {[district(row.districtId), nameOf(options?.thanas, row.thanaId)].filter(Boolean).join(" / ") || "—"}
                          </td>
                          <td className="px-2.5 py-2 break-words">{nameOf(options?.sections, row.sectionId) || "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </div>
        ))}
    </Dialog>
  );
}

function GroupTitle({ children }: { children: ReactNode }) {
  return (
    <h3 className="border-b border-line pb-1.5 text-xs font-bold tracking-wide text-accent-strong uppercase dark:text-accent">
      {children}
    </h3>
  );
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <GroupTitle>{title}</GroupTitle>
      <div className="grid grid-cols-2 gap-x-4 gap-y-3 sm:grid-cols-4">{children}</div>
    </section>
  );
}
