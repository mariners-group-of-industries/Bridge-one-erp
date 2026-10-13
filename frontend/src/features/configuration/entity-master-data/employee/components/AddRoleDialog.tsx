"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import { TextField } from "@/components/ui/form-field";
import { useToast } from "@/components/ui/toast";
import { errorMessage } from "@/lib/api/client";
import { personalInfoApi } from "../services/personal-info.api";
import type { RoleDto } from "../schemas/personal-info.schema";

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated: (role: RoleDto) => void;
}

export function AddRoleDialog({ open, onClose, onCreated }: Props) {
  const toast = useToast();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [nameError, setNameError] = useState("");
  const [saving, setSaving] = useState(false);

  const handleClose = () => {
    setName("");
    setDescription("");
    setNameError("");
    onClose();
  };

  const handleSave = async () => {
    if (!name.trim()) { setNameError("Role name is required."); return; }
    setSaving(true);
    try {
      const role = await personalInfoApi.createRole({ name: name.trim(), description: description.trim() || undefined });
      toast.success(`Role "${role.name}" created.`);
      onCreated(role);
      handleClose();
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      open={open}
      title="Add Role"
      description="New roles have no permissions by default. Permissions are assigned in a later step."
      onClose={handleClose}
      onSubmit={(e) => { e.preventDefault(); handleSave(); }}
      footer={
        <>
          <Button variant="secondary" onClick={handleClose} disabled={saving}>Cancel</Button>
          <Button variant="accent" type="submit" loading={saving}>Save Role</Button>
        </>
      }
    >
      <div className="flex flex-col gap-4 py-1">
        <TextField
          label="Role Name"
          required
          value={name}
          onChange={(e) => { setName(e.target.value); setNameError(""); }}
          error={nameError}
          placeholder="e.g. Sales Manager"
        />
        <TextField
          label="Description (optional)"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Brief description of this role"
        />
      </div>
    </Dialog>
  );
}
