import { Route } from "lucide-react";
import type { NavLink, Workspace } from "@/lib/navigation/types";
import { rtmPaths } from "./paths";

const link = (label: string, href: string, description: string, keywords: string[]): NavLink => ({ label, href, description, keywords });

// ── Dashboards ──
export const salesExecutiveDashboard = link("Sales Executive Dashboard", rtmPaths.salesExecutiveDashboard, "Targets, achievement and outlet coverage for each sales executive.", ["sales executive", "se", "dashboard", "achievement"]);
export const distributorDashboard = link("Distributor Dashboard", rtmPaths.distributorDashboard, "Distributor sales, stock, dues and orders at a glance.", ["distributor", "db", "dashboard", "stock", "dues"]);
export const rtmDashboard = link("RTM Dashboard", rtmPaths.dashboard, "Route-to-market overview: sales, coverage, distributors and field force.", ["rtm", "dashboard", "route to market", "overview"]);

// ── Sales transactions ──
export const retailOrder = link("Retail Order", rtmPaths.retailOrder, "Orders taken from retail outlets by sales representatives.", ["retail order", "outlet order", "sr order", "booking"]);
export const delivery = link("Delivery", rtmPaths.delivery, "Deliver retail orders from the distributor to outlets.", ["delivery", "outlet delivery", "dispatch"]);
export const collection = link("Collection", rtmPaths.collection, "Money collected from outlets against deliveries.", ["collection", "outlet payment", "cash collection"]);
export const salesReturn = link("Sales Return", rtmPaths.salesReturn, "Goods returned by outlets to the distributor.", ["sales return", "outlet return", "damage return"]);
export const directDelivery = link("Direct Delivery", rtmPaths.directDelivery, "Deliveries to outlets without a prior retail order.", ["direct delivery", "spot sale", "van sale"]);

// ── Distributor stock ──
export const stockTransferRequest = link("Distributor Stock Transfer Request", rtmPaths.stockTransferRequest, "Request stock moves between distributor points.", ["stock transfer request", "distributor transfer", "requisition"]);
export const stockTransferIssue = link("Distributor Stock Transfer Issue", rtmPaths.stockTransferIssue, "Issue stock against approved distributor transfer requests.", ["stock transfer issue", "distributor issue", "dispatch"]);
export const stockAdjustment = link("Distributor Stock Adjustment", rtmPaths.stockAdjustment, "Correct distributor stock after counts, damage or expiry.", ["stock adjustment", "distributor stock", "reconciliation"]);

// ── Field force ──
export const srCalendarSetup = link("SR Calendar Setup", rtmPaths.srCalendarSetup, "Working days, holidays and route days for sales representatives.", ["sr calendar", "route day", "working day", "calendar"]);
export const tourPlanSetup = link("Tour Plan Setup", rtmPaths.tourPlanSetup, "Planned outlet visits and routes for the field force.", ["tour plan", "beat plan", "route plan", "visit plan"]);
export const salesLayerTransfer = link("Sales Layer Transfer", rtmPaths.salesLayerTransfer, "Move employees, routes or outlets between sales territory layers.", ["sales layer", "territory transfer", "route transfer"]);
export const employeeTracking = link("Employee Tracking", rtmPaths.employeeTracking, "Field force location, attendance and visit trail.", ["employee tracking", "gps", "field force", "location"]);
export const outletTracking = link("Outlet Tracking", rtmPaths.outletTracking, "Outlet visits, orders and coverage on the map.", ["outlet tracking", "coverage", "visit", "map"]);

// ── Setup ──
export const outletSetup = link("Outlet Setup", rtmPaths.outletSetup, "Retail outlets with route, channel, owner and location.", ["outlet", "retailer", "shop", "outlet setup"]);
export const distributionChannel = link("Distribution Channel", rtmPaths.distributionChannel, "Channels such as general trade, modern trade and wholesale.", ["distribution channel", "channel", "general trade", "modern trade"]);
export const offerAndDiscount = link("RTM Offer and Discount", rtmPaths.offerAndDiscount, "Trade offers and discounts for outlets and distributors.", ["offer", "discount", "trade promotion", "scheme"]);
export const salesTarget = link("RTM Sales Target", rtmPaths.salesTarget, "Targets by distributor, territory and sales representative.", ["sales target", "target", "quota"]);
export const configuration = link("Configuration", rtmPaths.configuration, "RTM settings: numbering, approval rules and defaults.", ["rtm configuration", "settings", "rtm setup"]);

// ── Reports ──
export const salesAnalytics = link("RTM Sales Analytics", rtmPaths.salesAnalytics, "Secondary sales trends by territory, channel, outlet and product.", ["sales analytics", "secondary sales", "rtm report"]);
export const outletLedger = link("Outlet Ledger", rtmPaths.outletLedger, "Deliveries, collections, returns and balance of each outlet.", ["outlet ledger", "outlet statement", "outlet balance"]);

export const rtmWorkspace: Workspace = {
  id: "rtm",
  label: "RTM",
  icon: Route,
  href: rtmPaths.workspace,
  description: "Route to market: distributors, routes, outlets and field force.",
  status: "active",
  shortcuts: [rtmDashboard, retailOrder, delivery, collection, outletSetup, salesAnalytics],
  cards: [
    { label: "Dashboards", links: [salesExecutiveDashboard, distributorDashboard, rtmDashboard] },
    { label: "Sales", links: [retailOrder, delivery, collection, salesReturn, directDelivery] },
    { label: "Distributor Stock", links: [stockTransferRequest, stockTransferIssue, stockAdjustment] },
    { label: "Field Force", links: [srCalendarSetup, tourPlanSetup, salesLayerTransfer, employeeTracking, outletTracking] },
    { label: "Setup", links: [outletSetup, distributionChannel, offerAndDiscount, salesTarget, configuration] },
    { label: "Reports", links: [salesAnalytics, outletLedger] },
  ],
};

/** Every RTM page, in menu order. */
export const rtmLinks: readonly NavLink[] = rtmWorkspace.cards!.flatMap((card) => card.links);
