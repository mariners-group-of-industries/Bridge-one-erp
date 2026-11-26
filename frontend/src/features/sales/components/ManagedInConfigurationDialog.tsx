"use client";

import { ExternalLink, RefreshCw } from "lucide-react";
import { Button, buttonClasses } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";

/**
 * Sales only reads its master lists (reasons, customers …); they are maintained in
 * Configuration. This dialog points there (in a new tab, so the open Sales form keeps
 * its entries) and reloads the list when closed.
 */
export function ManagedInConfigurationDialog({
  open,
  title,
  what,
  where,
  href,
  onClose,
}: {
  open: boolean;
  title: string;
  /** e.g. "Return reasons" */
  what: string;
  /** e.g. "Configuration › Sales Config › Sales Setup › Return Reasons" */
  where: string;
  href: string;
  /** Called on close; reload the list here. */
  onClose: () => void;
}) {
  return (
    <Dialog
      open={open}
      title={title}
      onClose={onClose}
      footer={
        <>
          <a href={href} target="_blank" rel="noopener noreferrer" className={buttonClasses("accent", "md")}>
            <ExternalLink /> Open in Configuration
          </a>
          <Button onClick={onClose}>
            <RefreshCw /> Done, refresh list
          </Button>
        </>
      }
    >
      <p className="text-sm text-ink">
        {what} are set up in <span className="font-semibold">{where}</span>. Add or edit them there, then press “Done, refresh list” to use them here.
      </p>
    </Dialog>
  );
}
