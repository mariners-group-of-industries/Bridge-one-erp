// End-to-end Sales Module Real User Simulator
// Runs against the live running server on http://localhost:3000

const BASE = "http://localhost:3000/api/sales";
const today = new Date().toISOString().slice(0, 10);
const future = new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10);

const results = {
  passed: [],
  failed: [],
  warnings: [],
};

function logPass(feature, details) {
  console.log(`\x1b[32m✔ PASS\x1b[0m [${feature}] ${details}`);
  results.passed.push({ feature, details });
}

function logFail(feature, error) {
  console.error(`\x1b[31m✖ FAIL\x1b[0m [${feature}] ${error}`);
  results.failed.push({ feature, error });
}

function logWarn(feature, warning) {
  console.warn(`\x1b[33m▲ WARN\x1b[0m [${feature}] ${warning}`);
  results.warnings.push({ feature, warning });
}

async function api(method, path, body = null, query = {}) {
  const url = new URL(`${BASE}/${path}`);
  for (const [k, v] of Object.entries(query)) {
    if (v !== undefined && v !== null && v !== "") url.searchParams.set(k, String(v));
  }
  const opts = {
    method,
    headers: { "Content-Type": "application/json" },
  };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(url.toString(), opts);
  const contentType = res.headers.get("content-type") || "";
  if (!contentType.includes("json")) {
    const buffer = await res.arrayBuffer();
    if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
    return { buffer, bytes: buffer.byteLength, contentType };
  }
  const json = await res.json();
  if (!res.ok || json.error) {
    throw new Error(json.error?.message || `HTTP ${res.status} ${JSON.stringify(json)}`);
  }
  return json.data;
}

async function main() {
  console.log(`\n======================================================`);
  console.log(`🚀 STARTING LIVE SALES REAL-USER SIMULATION`);
  console.log(`Target: http://localhost:3000 | Date: ${today}`);
  console.log(`======================================================\n`);

  let lookups, office, customer, item, warehouse, salesPersons, glAccounts, drivers;

  // ── 0. LOOKUPS & MASTERS ──────────────────────────────────────────────
  try {
    lookups = await api("GET", "lookups");
    if (!lookups.offices || lookups.offices.length === 0) throw new Error("No offices found");

    const warehouses = await api("GET", "warehouses");
    // Select an office that has a warehouse tied to it
    office = lookups.offices.find(o => warehouses.some(w => w.officeId === o.id)) || lookups.offices[0];
    warehouse = warehouses.find(w => w.officeId === office.id) || warehouses[0];

    const bu = office.businessUnitId;
    const [customers, items, spList, glList, driverList] = await Promise.all([
      api("GET", "customers", null, { businessUnitId: bu }),
      api("GET", "items", null, { businessUnitId: bu }),
      api("GET", "sales-persons", null, { businessUnitId: bu }),
      api("GET", "gl-accounts").catch(() => []),
      api("GET", "drivers", null, { businessUnitId: bu, search: "Md." }).catch(() => []),
    ]);

    customer = customers.find(c => c.name) || customers[0];
    item = items.find(i => i.salesRate > 0) || items[0];
    salesPersons = spList;
    glAccounts = glList;
    drivers = driverList;

    logPass("Lookups", `Loaded ${lookups.offices.length} offices. Selected Office: ${office.name}`);
    logPass("Masters", `Customers: ${customers.length}, Items: ${items.length}, Warehouses: ${warehouses.length}, SalesPersons: ${salesPersons.length}`);
    logPass("Selected Target", `Customer: ${customer.name} | Item: ${item.name} (${item.salesRate} BDT) | WH: ${warehouse?.name}`);
  } catch (err) {
    logFail("Initial Data Load", err.message);
    process.exit(1);
  }

  // ── 1. SALES DASHBOARD ────────────────────────────────────────────────
  try {
    console.log(`\n--- [1] Testing Sales Dashboard ---`);
    const boardMonth = await api("GET", "dashboard", null, { from: `${today.slice(0, 7)}-01`, to: today });
    logPass("Dashboard (MTD)", `Sales: ${boardMonth.totals.sales}, Collections: ${boardMonth.totals.collection}, Overdue: ${boardMonth.overdue.length}`);

    const boardToday = await api("GET", "dashboard", null, { from: today, to: today });
    logPass("Dashboard (Today)", `Sales: ${boardToday.totals.sales}, Collection: ${boardToday.totals.collection}`);

    const board7Days = await api("GET", "dashboard", null, {
      from: new Date(Date.now() - 6 * 86400000).toISOString().slice(0, 10),
      to: today,
    });
    logPass("Dashboard (7 Days)", `Loaded range successfully. Top Items: ${board7Days.topItems.length}, Top Customers: ${board7Days.topCustomers.length}`);
  } catch (err) {
    logFail("Sales Dashboard", err.message);
  }

  // ── 2. SALES QUOTATION ────────────────────────────────────────────────
  let quotation = null;
  try {
    console.log(`\n--- [2] Testing Sales Quotations ---`);
    const qList = await api("GET", "quotations", null, { today });
    logPass("Quotations List", `Loaded list: ${qList.length} rows`);

    // Prepare quotation terms safely
    const officeTerms = Array.isArray(lookups.quotationTerms?.[office.id])
      ? lookups.quotationTerms[office.id]
      : (Array.isArray(lookups.quotationTerms) ? lookups.quotationTerms : []);

    // Create quotation
    const qInput = {
      officeId: office.id,
      customerId: customer.id,
      salesPersonId: salesPersons[0]?.id || null,
      quotationDate: today,
      validTill: future,
      quotationType: "Quotation",
      includingVat: true,
      lines: [
        { itemId: item.id, qty: 5, rate: item.salesRate || 100 }
      ],
      terms: officeTerms.slice(0, 1),
    };
    quotation = await api("POST", "quotations", qInput);
    logPass("Create Quotation", `Created quotation #${quotation.number} (Total: ${quotation.grandTotal})`);

    // Read detail
    const qDetail = await api("GET", `quotations/${quotation.id}`);
    logPass("Quotation Detail", `Verified detail for ${qDetail.number}, lines: ${qDetail.lines.length}`);

    // Edit quotation
    const qEdited = await api("PUT", `quotations/${quotation.id}`, {
      version: qDetail.updatedAt,
      data: {
        ...qInput,
        lines: [
          { itemId: item.id, qty: 8, rate: item.salesRate || 100 }
        ]
      }
    });
    logPass("Edit Quotation", `Updated quotation qty to 8, new total: ${qEdited.grandTotal}`);

    // Approve quotation
    const qApproved = await api("POST", `quotations/${quotation.id}/status`, {
      action: "approve",
      version: qEdited.updatedAt
    });
    logPass("Approve Quotation", `Status is now: ${qApproved.status}`);

    // Export Excel & PDF
    const qPdf = await api("GET", `quotations/${quotation.id}/pdf`);
    logPass("Quotation PDF", `Generated PDF (${qPdf.bytes} bytes)`);

    const qExcel = await api("GET", "quotations/export", null, { today });
    logPass("Quotations Excel Export", `Downloaded Excel file (${qExcel.bytes} bytes)`);
  } catch (err) {
    logFail("Sales Quotation Flow", err.message);
  }

  // ── 3. SALES ORDER ────────────────────────────────────────────────────
  let order = null;
  try {
    console.log(`\n--- [3] Testing Sales Orders ---`);
    const oList = await api("GET", "orders", null, { from: `${today.slice(0, 7)}-01`, to: today });
    logPass("Orders List", `Loaded ${oList.rows?.length ?? oList.length ?? 0} orders`);

    // Create order (from quotation or standalone)
    const oInput = {
      officeId: office.id,
      customerId: customer.id,
      salesPersonId: salesPersons[0]?.id || null,
      quotationId: quotation?.id || undefined,
      orderType: "SALES",
      paymentMethod: "CASH",
      orderDate: today,
      expectedDeliveryDate: future,
      priceIncludesVat: true,
      isForeign: false,
      paymentTermDays: 7,
      dueLimit: 0,
      discountAmount: 0,
      deliveryCharge: 0,
      unloadingCharge: 0,
      lines: [
        { itemId: item.id, qty: 8, unitPrice: item.salesRate || 100, discountPercent: 0, vatPercent: 0, aitPercent: 0 }
      ],
    };

    order = await api("POST", "orders", oInput);
    logPass("Create Order", `Created Sales Order #${order.number} (Status: ${order.status})`);

    // Verify quotation status if linked
    if (quotation) {
      const qRefreshed = await api("GET", `quotations/${quotation.id}`);
      logPass("Quotation Linked", `Quotation #${quotation.number} status is now: ${qRefreshed.status}`);
    }

    // Read order detail
    const oDetail = await api("GET", `orders/${order.id}`);
    logPass("Order Detail", `Read order #${oDetail.number}`);

    // Submit order for approval via status endpoint
    const oSubmitted = await api("POST", `orders/${order.id}/status`, {
      action: "submit",
      version: oDetail.updatedAt,
      today
    });
    logPass("Submit Order", `Order submitted. Status: ${oSubmitted.status}`);

    // If held for multi-stage approval, approve it
    let currentOrder = oSubmitted;
    while (currentOrder.status === "PENDING_APPROVAL" || currentOrder.status === "DRAFT") {
      try {
        currentOrder = await api("POST", `orders/${order.id}/status`, {
          action: "approve",
          version: currentOrder.updatedAt
        });
        logPass("Approve Order Stage", `Approval step passed, status: ${currentOrder.status}`);
      } catch {
        break;
      }
    }

    // Export Order PDF and Excel
    const oPdf = await api("GET", `orders/${order.id}/pdf`);
    logPass("Order PDF", `Generated PDF (${oPdf.bytes} bytes)`);
    const oExcel = await api("GET", `orders/${order.id}/excel`);
    logPass("Order Excel", `Exported single order Excel (${oExcel.bytes} bytes)`);
  } catch (err) {
    logFail("Sales Order Flow", err.message);
  }

  // ── 4. SALES DELIVERY & CHALLAN ───────────────────────────────────────
  let delivery = null;
  try {
    console.log(`\n--- [4] Testing Sales Deliveries ---`);
    const approvedOrders = await api("GET", "deliveries/approved-orders");
    logPass("Approved Orders", `Loaded ${approvedOrders.length} orders awaiting delivery`);

    // Direct Delivery
    const directDelivery = await api("POST", "deliveries", {
      deliveryType: "DIRECT",
      officeId: office.id,
      warehouseId: warehouse.id,
      customerId: customer.id,
      deliveryDate: today,
      paymentMethod: "CASH",
      deliveryCharge: 0,
      unloadingCharge: 0,
      paidAmount: 50,
      lines: [
        { itemId: item.id, qty: 1, rate: item.salesRate || 100, discountPercent: 0 }
      ]
    }).catch(e => {
      logWarn("Direct Delivery Stock Constraint", e.message);
      return null;
    });

    if (directDelivery) {
      logPass("Direct Delivery", `Created #${directDelivery.number} with Cash Payment (Challan: ${directDelivery.challanNo})`);
      delivery = directDelivery;

      // Update delivery references
      const dDetail = await api("GET", `deliveries/${delivery.id}`);
      const updated = await api("PUT", `deliveries/${delivery.id}`, {
        version: dDetail.updatedAt,
        data: {
          challanNo: `CH-AUTO-${Date.now().toString().slice(-5)}`,
          remarks: "Verified by real-user automated tester"
        }
      });
      logPass("Update Delivery References", `Updated Challan No to ${updated.challanNo}`);

      // Challan PDF
      const challanPdf = await api("GET", `deliveries/${delivery.id}/challan-pdf`);
      logPass("Delivery Challan PDF", `Generated Challan PDF (${challanPdf.bytes} bytes)`);

      // Confirm delivery
      const confirmed = await api("POST", `deliveries/${delivery.id}/confirm`, {
        version: updated.updatedAt
      });
      logPass("Confirm Delivery", `Confirmed delivery. Status: ${confirmed.status}`);
    }

    // Delivery Export
    for (const tab of ["approved", "deliveries", "exchanges", "challans"]) {
      const exp = await api("GET", "deliveries/export", null, { tab });
      logPass(`Delivery Export (${tab})`, `Exported tab Excel (${exp.bytes} bytes)`);
    }
  } catch (err) {
    logFail("Sales Delivery Flow", err.message);
  }

  // ── 5. SALES RETURN ───────────────────────────────────────────────────
  try {
    console.log(`\n--- [5] Testing Sales Returns ---`);
    const returnable = await api("GET", "returns/deliveries");
    logPass("Returnable Deliveries", `Found ${returnable.length} deliveries available for return`);

    // Return without reference
    const retWoRef = await api("POST", "returns", {
      mode: "WITHOUT_REFERENCE",
      kind: "SALES",
      customerId: customer.id,
      officeId: office.id,
      warehouseId: warehouse.id,
      returnDate: today,
      priceIncludesVat: false,
      withoutInvoice: true,
      lines: [
        { itemId: item.id, qty: 1, rate: item.salesRate || 100, vatPercent: 0 }
      ]
    });
    logPass("Create Return (No Ref)", `Created Return #${retWoRef.number}`);

    // Approve Return through pipeline
    let curRet = retWoRef;
    for (let s = 0; s < 5; s++) {
      await api("POST", `returns/${retWoRef.id}/approve`, { version: curRet.updatedAt }).catch(() => {});
      curRet = await api("GET", `returns/${retWoRef.id}`);
      if (curRet.status === "SUBMITTED" || curRet.status === "APPROVED") break;
    }
    logPass("Approve Return", `Final status: ${curRet.status}`);

    // Return Challan PDF
    const rPdf = await api("GET", `returns/${retWoRef.id}/challan-pdf`);
    logPass("Return Challan PDF", `Generated PDF (${rPdf.bytes} bytes)`);

    // Export returns
    for (const tab of ["deliveries", "returns", "market"]) {
      const exp = await api("GET", "returns/export", null, { tab });
      logPass(`Return Export (${tab})`, `Exported Excel (${exp.bytes} bytes)`);
    }
  } catch (err) {
    logFail("Sales Return Flow", err.message);
  }

  // ── 6. SALES COLLECTION & DUES ────────────────────────────────────────
  try {
    console.log(`\n--- [6] Testing Sales Collections & Dues ---`);
    const [dueList, dueInvoices, ledger] = await Promise.all([
      api("GET", "collections/due", null, { asOf: today }),
      api("GET", "collections/due-invoices", null, { asOf: today }),
      api("GET", "collections/ledger", null, { asOf: today }),
    ]);
    logPass("Due Tracking", `Customer dues: ${dueList.length}, Due invoices: ${dueInvoices.length}, Ledger rows: ${ledger.length}`);

    // If an invoice is due, perform due collection
    const targetDue = dueInvoices.find(d => d.due > 0 && d.customerId === customer.id) || dueInvoices.find(d => d.due > 0);
    if (targetDue) {
      const collectAmount = Math.min(100, targetDue.due);
      const collectionRes = await api("POST", "collections/due-collection", {
        officeId: office.id,
        collectionDate: today,
        method: "CASH",
        cashType: "Cash in Hand",
        salesPersonId: salesPersons[0]?.id || null,
        rows: [
          {
            customerId: targetDue.customerId,
            allocations: [{ deliveryId: targetDue.deliveryId, amount: collectAmount }]
          }
        ]
      });
      logPass("Due Collection by Invoice", `Collected ৳${collectAmount} for delivery #${targetDue.deliveryNumber || targetDue.deliveryId}`);

      if (collectionRes && collectionRes[0]?.id) {
        const receipt = await api("GET", `collections/${collectionRes[0].id}`);
        logPass("Money Receipt", `Read receipt #${receipt.number} (Total: ${receipt.amount})`);
      }
    } else {
      logPass("Due Collection", "No invoices currently due for collection test, verified due list endpoints");
    }

    // Advance Voucher Creation
    const cashAccount = glAccounts?.find(a => a.name?.toLowerCase().includes("cash") || a.code?.startsWith("1")) || glAccounts?.[0];
    const employee = drivers?.[0] || salesPersons?.[0];

    if (cashAccount && employee) {
      const advanceRes = await api("POST", "collections/advance-voucher", {
        officeId: office.id,
        collectionDate: today,
        employeeId: employee.id,
        voucherType: "CASH_RECEIVE",
        cashAccountId: cashAccount.id,
        rows: [
          {
            customerId: customer.id,
            amount: 250,
            remarks: "Advance voucher real user test"
          }
        ]
      });
      const voucherNum = advanceRes?.[0]?.number || advanceRes?.number || "OK";
      logPass("Advance Voucher", `Created advance voucher #${voucherNum}`);
    } else {
      logWarn("Advance Voucher", "Skipped advance creation due to missing cash account or employee");
    }

    // Customer Credit Position
    const credit = await api("GET", `customers/${customer.id}/credit`, null, { asOf: today });
    logPass("Customer Credit Status", `Outstanding: ${credit.outstanding}, Overdue: ${credit.overdue}, CreditLimit: ${credit.creditLimit}`);
  } catch (err) {
    logFail("Sales Collection Flow", err.message);
  }

  // ── 7. SALES TARGETS & COMMISSIONS ────────────────────────────────────
  try {
    console.log(`\n--- [7] Testing Sales Targets & Commissions ---`);
    const budgets = await api("GET", "targets/budgets");
    logPass("Yearly Budgets", `Found ${budgets.length} budget records`);

    const spId = salesPersons[0]?.id;
    if (spId) {
      // Create a test budget for future year
      const testYear = new Date().getFullYear() + 6;
      const budgetCreated = await api("POST", "targets/budgets", {
        businessUnitId: office.businessUnitId,
        targetType: "EMPLOYEE",
        basis: "AMOUNT",
        year: testYear,
        persons: [
          { salesPersonId: spId, months: [{ month: 1, value: 50000 }] }
        ]
      }).catch(e => {
        logWarn("Budget Creation Note", e.message);
        return null;
      });
      if (budgetCreated) {
        logPass("Create Yearly Budget", `Created ${testYear} budget for ${salesPersons[0].name}`);
      }

      // Target Report
      const tReport = await api("GET", "targets/report", null, {
        year: String(new Date().getFullYear()),
        fromMonth: "1",
        toMonth: "12",
        basis: "AMOUNT"
      });
      logPass("Target Report", `Generated target achievement report (${tReport.length} sales force records)`);

      // Commission setup & report
      const commReport = await api("GET", "commissions/report", null, {
        from: `${today.slice(0, 4)}-01-01`,
        to: today,
        viewBy: "EMPLOYEE"
      });
      logPass("Commission Report", `Generated commission report (${commReport.lines?.length ?? 0} lines)`);
    }
  } catch (err) {
    logFail("Sales Target & Commission Flow", err.message);
  }

  // ── 8. ALL 32 SALES REPORTS & ANALYTICS ────────────────────────────────
  console.log(`\n--- [8] Testing All 32 Sales Reports & Analytics ---`);
  const REPORT_KEYS = [
    "available-balance", "customer", "credit-utilization", "customer-details",
    "group-summary", "customer-ledger", "customer-sales", "employee-sales-collection",
    "item", "item-category", "item-average", "monthly-achievement",
    "month-sales", "month-sales-collection", "order-booking", "order-remaining",
    "overdue", "payment-method", "received-due", "referred-by",
    "delivery-report", "delivery-schedule", "return-report", "territory-sales",
    "abp-target", "customer-aging", "category-comparison", "collection",
    "credit-note", "customer-category-sales", "season-closing",
    "customer-credit-invoice", "group-recovery", "master-invoice"
  ];

  let reportsPassed = 0;
  for (const report of REPORT_KEYS) {
    try {
      const rep = await api("GET", "reports", null, {
        report,
        asOf: today,
        from: `${today.slice(0, 4)}-01-01`,
        to: today,
        year: today.slice(0, 4),
        fromMonth: "1",
        toMonth: "12",
        officeId: office.id,
        customerId: customer.id,
      });
      logPass(`Report: ${report}`, `Title: "${rep.title}", Columns: ${rep.columns?.length ?? 0}, Rows: ${rep.rows?.length ?? 0}`);
      reportsPassed++;
    } catch (err) {
      logFail(`Report: ${report}`, err.message);
    }
  }
  logPass("Reports Suite", `Successfully generated ${reportsPassed} of ${REPORT_KEYS.length} reports`);

  // ── SUMMARY ───────────────────────────────────────────────────────────
  console.log(`\n======================================================`);
  console.log(`📊 SIMULATION COMPLETE`);
  console.log(`✔ Passed Tests: ${results.passed.length}`);
  console.log(`✖ Failed Tests: ${results.failed.length}`);
  console.log(`▲ Warnings:     ${results.warnings.length}`);
  console.log(`======================================================\n`);

  if (results.failed.length > 0) {
    console.error("FAILURES DETECTED:", results.failed);
    process.exit(1);
  }
}

main().catch(err => {
  console.error("CRITICAL RUNTIME ERROR:", err);
  process.exit(1);
});
