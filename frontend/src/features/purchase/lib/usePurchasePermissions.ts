"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchApi } from "@/lib/api";
import { useSession } from "@/lib/auth/session";
import type { PermissionAction } from "@/lib/permissions/registry";
import {
  canApproveWithSummary,
  type ApprovalRightsSummary,
} from "@/lib/purchase-store/rules";

export const PURCHASE_FEATURES = {
  requisitions: "/purchase/requisitions",
  orders: "/purchase/orders",
  receive: "/purchase/receive",
  returns: "/purchase/returns",
  payments: "/purchase/supplier-payments",
  reports: "/purchase/reports",
  analytics: "/purchase/analytics",
  supplierProfile: "/configuration/entity-master-data/supplier-profile",
  itemProfile: "/configuration/entity-master-data/item-profile",
} as const;

interface PurchaseContextPermissions {
  officeBusinessUnitIds?: Record<string, string>;
  company?: { id?: string };
  approval?: {
    requisition?: ApprovalRightsSummary;
    purchaseOrder?: ApprovalRightsSummary;
    payment?: ApprovalRightsSummary;
  };
}

export function usePurchasePermissions() {
  const { user, loading, can } = useSession();

  const { data: context } = useQuery<PurchaseContextPermissions>({
    queryKey: ["purchase-context", user?.id ?? "anon"],
    queryFn: () => fetchApi<PurchaseContextPermissions>("/master/context"),
    enabled: Boolean(user),
    staleTime: 60_000,
  });

  return useMemo(() => {
    const buMap = context?.officeBusinessUnitIds ?? {};
    const resolveBu = (officeId?: string, explicitBuId?: string) =>
      explicitBuId || (officeId ? buMap[officeId] : undefined) || context?.company?.id;

    const actionsFor = (feature: string) => ({
      view: can(feature, "view"),
      create: can(feature, "create"),
      edit: can(feature, "edit"),
      delete: can(feature, "delete"),
      approve: can(feature, "approve"),
      export: can(feature, "export"),
    });

    const canApproveRequisition = (officeId?: string, amount: number = 0) =>
      can(PURCHASE_FEATURES.requisitions, "approve") &&
      canApproveWithSummary(context?.approval?.requisition, resolveBu(officeId), amount);

    const canApproveOrder = (officeId?: string, amount: number = 0) =>
      can(PURCHASE_FEATURES.orders, "approve") &&
      canApproveWithSummary(context?.approval?.purchaseOrder, resolveBu(officeId), amount);

    const canApprovePayment = (amount: number = 0, businessUnitId?: string) =>
      can(PURCHASE_FEATURES.payments, "approve") &&
      canApproveWithSummary(context?.approval?.payment, resolveBu(undefined, businessUnitId), amount);

    return {
      loading,
      user,
      can: (feature: string, action: PermissionAction = "view") => can(feature, action),
      actionsFor,
      requisitions: actionsFor(PURCHASE_FEATURES.requisitions),
      orders: actionsFor(PURCHASE_FEATURES.orders),
      receive: actionsFor(PURCHASE_FEATURES.receive),
      returns: actionsFor(PURCHASE_FEATURES.returns),
      payments: actionsFor(PURCHASE_FEATURES.payments),
      reports: actionsFor(PURCHASE_FEATURES.reports),
      analytics: actionsFor(PURCHASE_FEATURES.analytics),
      quickSupplierCreate: can(PURCHASE_FEATURES.supplierProfile, "create"),
      quickItemCreate: can(PURCHASE_FEATURES.itemProfile, "create"),
      canApproveRequisition,
      canApproveOrder,
      canApprovePayment,
    };
  }, [can, context, loading, user]);
}

