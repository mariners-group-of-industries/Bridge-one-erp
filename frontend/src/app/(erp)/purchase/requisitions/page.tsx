import RequisitionsView from "./RequisitionsView";

// The page is a client component that runs only after the session loads in the browser,
// so the server never renders this segment and instant-navigation validation cannot run.
export const instant = false;

export default function PurchaseRequisitionsPage() {
  return <RequisitionsView />;
}
