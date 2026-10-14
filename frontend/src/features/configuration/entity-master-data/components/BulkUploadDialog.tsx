"use client";

import { Download, FileSpreadsheet, Upload } from "lucide-react";
import { useRef, useState } from "react";
import { Button, buttonClasses } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import { errorMessage } from "@/lib/api/client";
import { Notice, TABLE } from "../employee/components/kit";

const MAX_BYTES = 5 * 1024 * 1024;

export interface ImportResult {
  created: number;
  /** Spreadsheet row numbers (header is row 1). */
  errors: { row: number; message: string }[];
}

interface BulkUploadDialogProps {
  open: boolean;
  onClose: () => void;
  onImported: () => void;
  /** Plural noun, e.g. "suppliers". */
  noun: string;
  templateUrl: string;
  maxRows: number;
  /** What must match existing names, for the instructions. */
  matchHint: string;
  upload: (file: File) => Promise<ImportResult>;
}

/** "+ Bulk Upload": template download, .xlsx upload and a per-row result report. */
export function BulkUploadDialog({
  open,
  onClose,
  onImported,
  noun,
  templateUrl,
  maxRows,
  matchHint,
  upload,
}: BulkUploadDialogProps) {
  const toast = useToast();
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const singular = noun.replace(/s$/, "");
  const title = `Bulk Upload ${noun.charAt(0).toUpperCase()}${noun.slice(1)}`;

  const reset = () => {
    setFile(null);
    setError(null);
    setResult(null);
    if (inputRef.current) inputRef.current.value = "";
  };
  const close = () => {
    if (uploading) return;
    reset();
    onClose();
  };

  const pick = (next: File | null) => {
    setResult(null);
    setError(null);
    if (next && !next.name.toLowerCase().endsWith(".xlsx")) {
      setError("Choose an Excel .xlsx file (use the template).");
      setFile(null);
      return;
    }
    if (next && next.size > MAX_BYTES) {
      setError("The file must be 5 MB or smaller.");
      setFile(null);
      return;
    }
    setFile(next);
  };

  const submit = async () => {
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const outcome = await upload(file);
      setResult(outcome);
      if (outcome.created > 0) {
        toast.success(`${outcome.created} ${outcome.created === 1 ? singular : noun} added.`);
        onImported();
      }
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setUploading(false);
    }
  };

  return (
    <Dialog
      open={open}
      size="lg"
      title={title}
      description={`Add up to ${maxRows} ${noun} at once from an Excel file.`}
      onClose={close}
      footer={
        <>
          <Button onClick={close} disabled={uploading}>
            {result ? "Done" : "Cancel"}
          </Button>
          <Button variant="accent" loading={uploading} disabled={!file || !!result} onClick={submit}>
            <Upload /> Upload
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <ol className="flex list-decimal flex-col gap-1 pl-5 text-sm text-ink-muted">
          <li>Download the template and fill one row per {singular}.</li>
          <li>{matchHint}</li>
          <li>Upload the file; rows with problems are listed and skipped.</li>
        </ol>

        <a href={templateUrl} download className={buttonClasses("accent-soft", "md", "self-start")}>
          <Download /> Download Template
        </a>

        <label className="flex cursor-pointer flex-col items-center gap-1.5 rounded border border-dashed border-line-strong bg-canvas px-4 py-6 text-center hover:border-accent">
          <FileSpreadsheet aria-hidden="true" className="size-7 text-ink-faint" />
          <span className="text-sm font-medium text-ink">{file ? file.name : "Choose an Excel (.xlsx) file"}</span>
          <span className="text-xs text-ink-faint">Maximum 5 MB</span>
          <input
            ref={inputRef}
            type="file"
            accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            className="sr-only"
            onChange={(event) => pick(event.target.files?.[0] ?? null)}
          />
        </label>

        {error && <Notice tone="error">{error}</Notice>}

        {result && (
          <div className="flex flex-col gap-2">
            <Notice tone={result.errors.length ? "error" : "success"}>
              {result.created} added
              {result.errors.length > 0 && `, ${result.errors.length} row${result.errors.length === 1 ? "" : "s"} skipped`}.
            </Notice>
            {result.errors.length > 0 && (
              <div className={`${TABLE.wrap} max-h-60 overflow-y-auto`}>
                <table className={TABLE.table}>
                  <thead className={TABLE.head}>
                    <tr>
                      <th scope="col" className={`${TABLE.th} w-16`}>
                        Row
                      </th>
                      <th scope="col" className={TABLE.th}>
                        Problem
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.errors.map((item) => (
                      <tr key={item.row} className={TABLE.row}>
                        <td className={`${TABLE.td} tabular-nums`}>{item.row}</td>
                        <td className={TABLE.td}>{item.message}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <Button size="sm" className="self-start" onClick={reset}>
              Upload another file
            </Button>
          </div>
        )}
      </div>
    </Dialog>
  );
}
