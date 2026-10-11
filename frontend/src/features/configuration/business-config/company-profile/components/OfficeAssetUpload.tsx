"use client";

import { useId, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/dialog";
import { useToast } from "@/components/ui/toast";
import { errorMessage } from "@/lib/api/client";
import {
  ALLOWED_ASSET_MIME_TYPES,
  MAX_ASSET_BYTES,
  OFFICE_ASSET_LABELS,
  type OfficeAssetKind,
} from "../schemas/office.schema";
import { officeApi } from "../services/company-profile.api";
import type { OfficeAssetDto } from "../types";

interface OfficeAssetUploadProps {
  officeId: string;
  kind: OfficeAssetKind;
  asset?: OfficeAssetDto;
  onChange: (kind: OfficeAssetKind, asset: OfficeAssetDto | null) => void;
}

function formatBytes(bytes: number) {
  return bytes < 1024 * 1024 ? `${Math.ceil(bytes / 1024)} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function OfficeAssetUpload({ officeId, kind, asset, onChange }: OfficeAssetUploadProps) {
  const toast = useToast();
  const inputId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const label = OFFICE_ASSET_LABELS[kind];

  async function upload(file: File) {
    if (!(ALLOWED_ASSET_MIME_TYPES as readonly string[]).includes(file.type)) {
      toast.error("Only PNG, JPEG or WebP images are allowed.");
      return;
    }
    if (file.size > MAX_ASSET_BYTES) {
      toast.error("Files must be 2 MB or smaller.");
      return;
    }
    setBusy(true);
    try {
      const saved = await officeApi.uploadAsset(officeId, kind, file);
      onChange(kind, saved);
      toast.success(`${label} ${asset ? "replaced" : "uploaded"}.`);
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  async function remove() {
    setBusy(true);
    try {
      await officeApi.removeAsset(officeId, kind);
      onChange(kind, null);
      setConfirmRemove(false);
      toast.success(`${label} removed.`);
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-2 rounded-md border border-zinc-200 p-3">
      <p className="text-sm font-medium text-zinc-800">{label}</p>
      <div className="flex h-24 items-center justify-center overflow-hidden rounded bg-zinc-50">
        {asset ? (
          // eslint-disable-next-line @next/next/no-img-element -- served by an authorised API route
          <img src={asset.url} alt={`${label} preview`} className="max-h-full max-w-full object-contain" />
        ) : (
          <span className="text-xs text-zinc-500">No file uploaded</span>
        )}
      </div>
      {asset && (
        <p className="truncate text-xs text-zinc-500" title={asset.originalName}>
          {asset.originalName} · {formatBytes(asset.sizeBytes)}
        </p>
      )}
      <input
        ref={inputRef}
        id={inputId}
        type="file"
        accept={ALLOWED_ASSET_MIME_TYPES.join(",")}
        className="sr-only"
        aria-label={`Choose ${label.toLowerCase()} file`}
        disabled={busy}
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (file) void upload(file);
        }}
      />
      <div className="flex gap-2">
        <Button size="sm" variant="secondary" loading={busy} onClick={() => inputRef.current?.click()}>
          {asset ? "Replace" : "Upload"}
        </Button>
        {asset && (
          <Button size="sm" variant="ghost" className="text-red-700" disabled={busy} onClick={() => setConfirmRemove(true)}>
            Remove
          </Button>
        )}
      </div>
      <p className="text-[11px] text-zinc-500">PNG, JPEG or WebP, up to 2 MB.</p>

      <ConfirmDialog
        open={confirmRemove}
        title={`Remove ${label.toLowerCase()}?`}
        message="The file will be permanently deleted."
        confirmLabel="Remove"
        busy={busy}
        onConfirm={remove}
        onClose={() => setConfirmRemove(false)}
      />
    </div>
  );
}
