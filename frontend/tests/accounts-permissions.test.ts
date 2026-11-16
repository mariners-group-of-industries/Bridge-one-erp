import { describe, expect, it } from "vitest";
import type { Actor } from "@/lib/auth/actor";
import { checkApiAccess } from "@/lib/permissions/api-rules";
import { findFeature, grantsFromList } from "@/lib/permissions/registry";
import { denyUnless } from "@/lib/permissions/require";
import { bankingFeatureOf } from "@/features/accounts/paths";

const actorWith = (keys: string[]): Actor => ({
  id: "00000000-0000-0000-0000-0000000000aa",
  name: "Accounts Clerk",
  role: "USER",
  isMaster: false,
  permissions: new Set(),
  companyScope: "ALL",
  via: "session",
  grants: grantsFromList(keys),
});

describe("Accounts permissions", () => {
  it("routes banking records to their own pages: cheques use Cheque Setup / Cheque Issue", () => {
    expect(bankingFeatureOf("chequeBook")).toBe("/accounts/cheque-setup");
    expect(bankingFeatureOf("receivedCheque")).toBe("/accounts/cheque-setup");
    expect(bankingFeatureOf("chequeIssue")).toBe("/accounts/cheque-issue");
    expect(bankingFeatureOf("deposit")).toBe("/accounts/banking");
    expect(bankingFeatureOf(undefined)).toBe("/accounts/banking");
  });

  it("opens the shared banking API to Cheque Issue users, without Banking permission", () => {
    const chequeClerk = grantsFromList(["accounts.cheque-issue.view", "accounts.cheque-issue.create"]);
    expect(checkApiAccess(chequeClerk, "POST", "/api/accounts/banking").allowed).toBe(true);
    expect(checkApiAccess(grantsFromList(["accounts.cheque-issue.view"]), "POST", "/api/accounts/banking").allowed).toBe(false);
  });

  it("checks the record's page inside the handler", async () => {
    const chequeClerk = actorWith(["accounts.cheque-issue.create"]);
    expect(denyUnless(chequeClerk, bankingFeatureOf("chequeIssue"), "create")).toBeNull();
    const denied = denyUnless(chequeClerk, bankingFeatureOf("deposit"), "create");
    expect(denied?.status).toBe(403);
    expect(await denied?.json()).toMatchObject({ success: false, code: "FORBIDDEN", required: { feature: "/accounts/banking", action: "create" } });
  });

  it("needs Approve, not Edit, to approve journal vouchers and fund transfers", () => {
    const editor = actorWith(["accounts.journal.edit", "accounts.fund-transfers.edit"]);
    expect(denyUnless(editor, "/accounts/journal", "approve")?.status).toBe(403);
    expect(denyUnless(editor, "/accounts/fund-transfers", "approve")?.status).toBe(403);
    const approver = actorWith(["accounts.journal.approve"]);
    expect(denyUnless(approver, "/accounts/journal", "approve")).toBeNull();
    expect(denyUnless({ ...editor, isMaster: true }, "/accounts/journal", "approve")).toBeNull();
  });

  it("treats the Purchase dashboard as a read-only page", () => {
    expect(findFeature("/purchase")?.actions).toEqual(["view", "export"]);
  });
});
