import { base44 } from "@/api/base44Client";

const num = (v) => {
  const n = parseFloat(v);
  return isNaN(n) ? 0 : n;
};

const isWage = (v) => /^labor/i.test(v || "") || /wage|payroll/i.test(v || "");

const shortDate = (d) => (d ? String(d).slice(0, 10) : "");

async function fetchAll(entityName) {
  let items = [];
  let cursor = null;
  for (let i = 0; i < 25; i++) {
    const page = await base44.entities[entityName].filter({}, {
      sort: "-created_date",
      limit: 500,
      ...(cursor ? { cursor } : {}),
    });
    const batch = Array.isArray(page) ? page : page?.items || [];
    items = items.concat(batch);
    const next = Array.isArray(page) ? null : page?.next_cursor;
    if (!next) break;
    cursor = next;
  }
  return items;
}

export const SOURCES = [
  "Material Cost",
  "Vendor Bill",
  "Operating Expense",
  "Invoice",
  "Payment",
  "Change Order",
  "Cash Register",
];

export async function loadTransactions() {
  const [materialCosts, bills, opex, invoices, payments, changeOrders, cash, projects, companies] =
    await Promise.all([
      fetchAll("MaterialCost"),
      fetchAll("Bill"),
      fetchAll("OperatingExpense"),
      fetchAll("Invoice"),
      fetchAll("Payment"),
      fetchAll("ChangeOrder"),
      fetchAll("CashTransaction"),
      fetchAll("Project"),
      fetchAll("Company"),
    ]);

  const projectName = {};
  projects.forEach((p) => {
    projectName[p.id] = p.number ? `${p.number} · ${p.name}` : p.name || "—";
  });
  const companyName = {};
  companies.forEach((c) => {
    companyName[c.id] = c.name;
  });

  const rows = [];

  materialCosts.forEach((r) => {
    const wage = r.item === "Labor";
    rows.push({
      id: `mc-${r.id}`,
      date: shortDate(r.date),
      transaction: r.transaction || "Material cost",
      amount: -Math.abs(num(r.amount)),
      allocation: wage ? "Wages" : "Job Cost",
      category: r.item || "Uncategorized",
      description: r.description || r.notes || "",
      project: projectName[r.project_id] || "—",
      source: "Material Cost",
    });
  });

  bills.forEach((r) => {
    const wage = isWage(r.category);
    const vendor = companyName[r.vendor_id] || "";
    rows.push({
      id: `bill-${r.id}`,
      date: shortDate(r.due_date || r.created_date),
      transaction: [r.number, vendor].filter(Boolean).join(" · ") || "Vendor bill",
      amount: -Math.abs(num(r.amount)),
      allocation: wage ? "Wages" : "Job Cost",
      category: r.category || "Uncategorized",
      description: r.notes || r.category || "",
      project: projectName[r.project_id] || "—",
      source: "Vendor Bill",
    });
  });

  opex.forEach((r) => {
    const wage = isWage(r.category) || isWage(r.subcategory);
    rows.push({
      id: `opex-${r.id}`,
      date: shortDate(r.date),
      transaction: r.vendor || r.description || "Operating expense",
      amount: -Math.abs(num(r.amount)),
      allocation: wage ? "Wages" : "Overhead",
      category: [r.category, r.subcategory].filter(Boolean).join(" · ") || "Uncategorized",
      description: r.description || "",
      project: wage ? "Wages" : `Overhead – ${r.category || "Other"}`,
      source: "Operating Expense",
    });
  });

  invoices.forEach((r) => {
    rows.push({
      id: `inv-${r.id}`,
      date: shortDate(r.period_end || r.due_date || r.created_date),
      transaction: r.number || "Invoice",
      amount: Math.abs(num(r.total)),
      allocation: "Revenue",
      category: "Progress Billing",
      description: r.notes || "",
      project: projectName[r.project_id] || "—",
      source: "Invoice",
    });
  });

  payments.forEach((r) => {
    const incoming = r.type === "Incoming";
    rows.push({
      id: `pay-${r.id}`,
      date: shortDate(r.payment_date || r.created_date),
      transaction: r.reference_number || `${r.payment_method || "Payment"} payment`,
      amount: incoming ? Math.abs(num(r.amount)) : -Math.abs(num(r.amount)),
      allocation: incoming ? "Cash Receipt" : "Cash Disbursement",
      category: r.payment_method || (incoming ? "Cash Receipt" : "Cash Disbursement"),
      description: r.notes || (incoming ? "Incoming payment" : "Outgoing payment"),
      project: projectName[r.project_id] || "—",
      source: "Payment",
    });
  });

  changeOrders.forEach((r) => {
    const amt = num(r.cost_impact);
    if (!amt) return;
    rows.push({
      id: `co-${r.id}`,
      date: shortDate(r.approved_date || r.created_date),
      transaction: [r.number, r.reason].filter(Boolean).join(" · ") || "Change order",
      amount: -Math.abs(amt),
      allocation: "Change Order",
      category: r.status || "Change Order",
      description: r.description || r.reason || "",
      project: projectName[r.project_id] || "—",
      source: "Change Order",
    });
  });

  cash.forEach((r) => {
    const out = num(r.checks_out) + num(r.adp) + num(r.other) + num(r.voids);
    const inc =
      num(r.interest_earned) +
      num(r.wire_deposits) +
      num(r.zelle_deposits) +
      num(r.cc_deposits) +
      num(r.check_deposits);

    const parts = [];
    if (num(r.checks_out)) parts.push("Checks Out");
    if (num(r.adp)) parts.push("ADP Payroll");
    if (num(r.other)) parts.push("Other");
    if (num(r.voids)) parts.push("Void");
    if (num(r.wire_deposits)) parts.push("Wire Deposit");
    if (num(r.zelle_deposits)) parts.push("Zelle Deposit");
    if (num(r.cc_deposits)) parts.push("Card Deposit");
    if (num(r.check_deposits)) parts.push("Check Deposit");
    if (num(r.interest_earned)) parts.push("Interest");

    const wageOnly = num(r.adp) > 0 && num(r.checks_out) === 0 && num(r.other) === 0;

    rows.push({
      id: `cash-${r.id}`,
      date: shortDate(r.date),
      transaction: r.action || "Bank transaction",
      amount: inc - out,
      allocation: wageOnly ? "Wages" : "Cash Movement",
      category: parts.join(" · ") || r.account || "Bank",
      description: [r.account, r.notes].filter(Boolean).join(" · "),
      project: r.project_number || projectName[r.project_id] || (wageOnly ? "Wages" : "—"),
      source: "Cash Register",
    });
  });

  rows.sort((a, b) => String(b.date).localeCompare(String(a.date)));
  return rows;
}

export function toExportRows(rows) {
  return rows.map((r) => ({
    Date: r.date,
    Transaction: r.transaction,
    Amount: r.amount,
    "Cost Allocation": r.allocation,
    Category: r.category,
    Description: r.description,
    "Project / Overhead": r.project,
    Source: r.source,
  }));
}