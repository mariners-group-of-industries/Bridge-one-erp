import type { Metadata } from "next";
import Link from "next/link";
import { CompanyProfileWorkspace } from "@/features/configuration/business-config/company-profile/components/CompanyProfileWorkspace";

export const metadata: Metadata = {
  title: "Company Profile · Business Configuration",
};

export default function CompanyProfilePage() {
  return (
    <div className="flex-1 bg-zinc-100 text-zinc-900">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 px-4 py-6 sm:px-6 lg:py-10">
        <header className="flex flex-col gap-2">
          <nav aria-label="Breadcrumb">
            <ol className="flex flex-wrap items-center gap-1 text-xs text-zinc-500">
              <li>
                <Link href="/" className="hover:text-zinc-800 hover:underline">
                  ERP
                </Link>
              </li>
              <li aria-hidden="true">/</li>
              <li>Configuration</li>
              <li aria-hidden="true">/</li>
              <li>Business Configuration</li>
              <li aria-hidden="true">/</li>
              <li aria-current="page" className="font-medium text-zinc-700">
                Company Profile
              </li>
            </ol>
          </nav>
          <h1 className="text-2xl font-semibold tracking-tight">Company Profile</h1>
          <p className="max-w-3xl text-sm text-zinc-600">
            Manage your company details, business units, offices and warehouses, and the terms
            &amp; conditions printed on sales and purchase documents.
          </p>
        </header>

        <CompanyProfileWorkspace />
      </div>
    </div>
  );
}
