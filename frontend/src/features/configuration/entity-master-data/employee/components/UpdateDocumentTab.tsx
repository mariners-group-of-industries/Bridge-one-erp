"use client";

import { FileText, Paperclip, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ErrorState, LoadingState } from "@/components/ui/section";
import { useToast } from "@/components/ui/toast";
import { useResource } from "@/hooks/use-resource";
import { apiRequest } from "@/lib/api/client";
import { cn } from "@/lib/cn";
import type { DocumentDto } from "../server/document.service";
import { CONTROL_CLASS, EmptyBlock, Field, FormGrid, Input, Panel, Select, TABLE } from "./kit";

const BASE = (id: string) => `/api/configuration/entity-master-data/employees/${id}/documents`;

const DOCUMENT_TYPES = [
  "National ID (NID)",
  "Passport",
  "Birth Certificate",
  "Driving License",
  "Tax Certificate (TIN)",
  "Educational Certificate",
  "Experience Certificate",
  "Joining Letter",
  "Appointment Letter",
  "Contract Agreement",
  "Medical Certificate",
  "Other",
] as const;

export function UpdateDocumentTab({ employeeId }: { employeeId: string }) {
  const toast = useToast();
  const { data: docs, error, reload } = useResource(`documents:${employeeId}`, () =>
    apiRequest<DocumentDto[]>(BASE(employeeId)),
  );

  const [documentType, setDocumentType] = useState("");
  const [documentName, setDocumentName] = useState("");
  const [issueDate, setIssueDate] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [adding, setAdding] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const validate = () => {
    const e: Record<string, string> = {};
    if (!documentType) e.documentType = "Document type is required.";
    if (!documentName.trim()) e.documentName = "Document name is required.";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleAdd = async () => {
    if (!validate()) return;
    setAdding(true);
    try {
      await apiRequest<DocumentDto>(BASE(employeeId), {
        method: "POST",
        body: JSON.stringify({
          documentType,
          documentName: documentName.trim(),
          issueDate: issueDate || null,
          fileName: file?.name ?? null,
        }),
      });
      setDocumentType("");
      setDocumentName("");
      setIssueDate("");
      setFile(null);
      setErrors({});
      reload();
      toast.success("Document added.");
    } catch {
      toast.error("Failed to add document.");
    } finally {
      setAdding(false);
    }
  };

  const handleDelete = async (docId: string) => {
    setDeletingId(docId);
    try {
      await apiRequest(`${BASE(employeeId)}/${docId}`, { method: "DELETE" });
      reload();
      toast.success("Document removed.");
    } catch {
      toast.error("Failed to remove document.");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="flex flex-col gap-4 pb-6">
      <Panel
        title="Add Document"
        description="Record an identity, education or employment document."
        footer={
          <Button variant="accent" loading={adding} onClick={handleAdd}>
            <Plus /> Add Document
          </Button>
        }
      >
        <FormGrid>
          <Field label="Document Type" required error={errors.documentType}>
            {(id) => (
              <Select
                id={id}
                value={documentType}
                aria-invalid={!!errors.documentType}
                options={DOCUMENT_TYPES}
                onChange={(e) => {
                  setDocumentType(e.target.value);
                  setErrors((p) => ({ ...p, documentType: "" }));
                }}
              />
            )}
          </Field>
          <Field label="Document Name" required error={errors.documentName}>
            {(id) => (
              <Input
                id={id}
                value={documentName}
                aria-invalid={!!errors.documentName}
                placeholder="e.g. NID Card"
                onChange={(e) => {
                  setDocumentName(e.target.value);
                  setErrors((p) => ({ ...p, documentName: "" }));
                }}
              />
            )}
          </Field>
          <Field label="Issue Date">
            {(id) => <Input id={id} type="date" value={issueDate} onChange={(e) => setIssueDate(e.target.value)} />}
          </Field>
          <Field label="Attachment">
            <label
              className={cn(
                CONTROL_CLASS,
                "flex cursor-pointer items-center gap-2 border-dashed text-ink-faint hover:border-accent hover:text-accent-strong focus-within:border-accent focus-within:ring-2 focus-within:ring-accent-line",
              )}
            >
              <Paperclip aria-hidden="true" className="size-3.5 shrink-0" />
              <span className="truncate">{file ? file.name : "Choose file…"}</span>
              <input type="file" className="sr-only" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
            </label>
          </Field>
        </FormGrid>
      </Panel>

      <Panel
        title="Documents"
        actions={
          docs && (
            <span className="rounded-full bg-accent-soft px-2 py-0.5 text-xs font-medium text-accent-strong tabular-nums dark:text-accent">
              {docs.length}
            </span>
          )
        }
      >
        {error ? (
          <ErrorState message={error.message} onRetry={reload} />
        ) : !docs ? (
          <LoadingState />
        ) : docs.length === 0 ? (
          <EmptyBlock icon={<FileText />} title="No documents yet">
            Add a document using the form above.
          </EmptyBlock>
        ) : (
          <div className={TABLE.wrap}>
            <table className={TABLE.table}>
              <thead className={TABLE.head}>
                <tr>
                  <th className={cn(TABLE.th, "w-12 text-right")}>SL</th>
                  <th className={TABLE.th}>Document Type</th>
                  <th className={TABLE.th}>Document Name</th>
                  <th className={TABLE.th}>Issue Date</th>
                  <th className={TABLE.th}>Attachment</th>
                  <th className={cn(TABLE.th, "w-16 text-center")}>Action</th>
                </tr>
              </thead>
              <tbody>
                {docs.map((doc, i) => (
                  <tr key={doc.id} className={TABLE.row}>
                    <td className={cn(TABLE.td, "text-right text-ink-faint tabular-nums")}>{i + 1}</td>
                    <td className={cn(TABLE.td, "font-medium text-ink")}>{doc.documentType}</td>
                    <td className={cn(TABLE.td, "text-ink")}>{doc.documentName}</td>
                    <td className={cn(TABLE.td, "tabular-nums")}>{doc.issueDate ?? "—"}</td>
                    <td className={TABLE.td}>
                      {doc.fileName ? (
                        <span className="inline-flex items-center gap-1 text-accent-strong dark:text-accent">
                          <Paperclip aria-hidden="true" className="size-3" />
                          {doc.fileName}
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className={cn(TABLE.td, "py-1 text-center")}>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="hover:text-danger"
                        aria-label={`Remove ${doc.documentName}`}
                        loading={deletingId === doc.id}
                        onClick={() => handleDelete(doc.id)}
                      >
                        {deletingId !== doc.id && <Trash2 />}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
}
