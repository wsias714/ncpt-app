// Made-up numbers, codes and descriptions only. Never paste real sheet data here.
import type { Grid } from "./parse.ts";

export const summaryFixture: Grid = [
  ["Key", "Value", "Note"],
  ["built", "2030-03-15T06:00", ""],
  ["as_of", "2030-03-15", ""],
  ["profit_mtd", 1200.5, "cash basis"],
  ["profit_last_month", 3400, ""],
  ["profit_ytd", 9100, ""],
  ["net_wages_ytd", 4500, ""],
  ["k401_ytd", 150, ""],
  ["wages_gross_ytd", 5000, ""],
  ["payroll_taxes_ytd", 400, ""],
  ["match_ytd", 150, ""],
  ["payroll_liab", 75, ""],
  ["cash", 10000.5, ""],
  ["card_owed", 250, ""],
  ["ar", 1500, ""],
  ["mileage_owed", 40, ""],
  ["mileage_due", "2030-04-01", ""],
  ["last_closed_month", "2030-01", ""],
  ["close_blockers", "2030-02: bank rec off by 12.00; 2030-02: payroll residue", ""],
  ["needs_booking", 3, ""],
];

export const txFixture: Grid = [
  ["Entry", "Date", "Account", "Amount", "Description", "Category code", "Category name", "Status", "Source", "Locked"],
  ["bank:t6", "2030-03-14", "Checking", -45.2, "OFFICE SUPPLY STORE 0001", "", "", "review", "tiller", ""],
  ["bank:t5", "2030-03-12", "Card", -19.99, "SOFTWARE SUBSCRIPTION", "7000", "Software", "booked", "tiller", ""],
  ["bank:t4", "2030-03-10", "Checking", 600, "Deposit from Customer A", "4000", "Therapy income", "booked", "tiller", ""],
  ["bank:t3", "2030-03-01", "Checking", -12.5, "MYSTERY CHARGE", "", "", "review", "tiller", ""],
  ["bank:t2", "2030-02-20", "Checking", -80, "UTILITY CO", "6100", "Utilities", "booked", "tiller", "yes"],
  ["bank:t1", "2030-01-05", "Card", -30, "OFFICE SUPPLY STORE 0001", "6200", "Supplies", "booked", "tiller", "yes"],
];

export const decisionsFixture: Grid = [
  ["Entry", "Account", "Note", "Who", "When"],
  ["bank:t6", "6200", "", "Julie", "2030-03-14T18:00:00.000Z"],
  ["bank:t5", "6200", "oops", "Wade", "2030-03-14T18:05:00.000Z"],
  ["bank:t5", "7000", "back", "Wade", "2030-03-14T18:06:00.000Z"],
];

export const monthlyFixture: Grid = [
  ["Month", "Income", "Expense", "Net cash", "Net accrual", "Cash end", "AR end", "Card owed end", "Net wages", "401k"],
  ["2030-02", 4000, 1000, 3000, 3100, 9000, 1200, 100, 2200, 100],
  ["2030-01", 3500, 1100, 2400, 2400, 7000, 900, 80, 2300, 50],
  ["2030-03", 2000, 800, 1200, 1300, 10000.5, 1500, 250, 0, 0],
  ["2029-02", 3000, 900, 2100, 2100, 5000, 800, 60, 1000, 25],
  ["2029-03", 2500, 700, 1800, 1800, 6000, 700, 40, 0, 0],
];

export const invoicesFixture: Grid = [
  ["Number", "Code", "Invoice date", "Due", "Total", "Status", "Source"],
  ["9001", "Customer A", "2030-01-01", "2030-01-31", 900, "SENT", "wave"],
  ["9002", "Customer B", "2030-03-01", "2030-03-31", 300, "PAID", "wave"],
  ["9003", "Not A Code", "2030-03-01", "2030-03-31", "$600.00", "SENT", "wave"],
  ["9004", "Customer C", "2030-03-05", "2030-04-04", 100, "DRAFT", "ncpt-books"],
  ["9005", "Customer D", "2029-11-01", "2029-12-01", 50, "PAID", "wave"],
];

export const accountsFixture: Grid = [
  ["Code", "Name", "Type", "1120-S line"],
  ["1000", "Checking", "asset", ""],
  ["6200", "Supplies", "expense", "19"],
  ["4000", "Therapy income", "income", "1a"],
  ["7000", "Software", "expense", "19"],
  ["2000", "Credit card", "liability", ""],
];

export const pnlFixture: Grid = [
  ["Profit & loss 2030 (cash basis), through 2030-03-15"],
  [],
  ["Code", "Account", "1120-S", "Jan", "Feb", "Mar", "YTD cash", "YTD accrual"],
  ["Income"],
  ["4000", "Therapy income", "1a", 3500, 4000, 2000, 9500, 9800],
  ["", "Total income", "", 3500, 4000, 2000, 9500, 9800],
  [],
  ["Expense"],
  ["6200", "Supplies", "19", 100, 200, 300, 600, 600],
  ["7000", "Software", "19", 1000, 800, 500, 2300, 2300],
  ["", "Total expense", "", 1100, 1000, 800, 2900, 2900],
  [],
  ["", "Net income", "", 2400, 3000, 1200, 6600, 6900],
];

export const bsFixture: Grid = [
  ["Balance sheet 2030 (accrual), month ends through 2030-03-15"],
  [],
  ["Code", "Account", "2030-01-31", "2030-02-28", "2030-03-15"],
  ["Assets"],
  ["1000", "Checking", 7000, 9000, 10000.5],
  ["1200", "Accounts receivable", 900, 1200, 1500],
  ["", "Total asset", 7900, 10200, 11500.5],
  [],
  ["Liabilities"],
  ["2000", "Credit card", 80, 100, 250],
  ["", "Total liability", 80, 100, 250],
  [],
  ["Equity"],
  ["3000", "Owner equity", 5420, 5420, 5420],
  ["", "Net income, current year", 2400, 5400, 6830.5],
  ["", "Total equity", 7820, 10820, 12250.5],
];

export const clientsFixture: Grid = [
  ["Month", "Code", "Invoiced", "Collected", "Visits", "Invoices"],
  ["2029-02", "Customer A", 400, 200, 2, 2],
  ["2029-03", "Customer A", 200, 400, 1, 1],
  ["2029-03", "Customer B", 600, 0, 3, 1],
  ["2030-01", "Customer A", 600, 600, 3, 3],
  ["2030-01", "Customer V", 2600, 0, 13, 1],
  ["2030-02", "Customer B", 400, 600, 2, 2],
  ["2030-02", "Customer V", 2600, 2600, 12.5, 1],
  ["2030-03", "Customer C", 300, 0, 1, 1],
  ["2030-03", "Customer V", 1300, 2600, 6.5, 1],
];

// Made-up invoice emails (example.com only). A real App Outbox has recipients, so it is never fixture data.
export const outboxFixture: Grid = [
  ["Number", "Code", "Invoice date", "Due", "Total", "To", "Cc", "Subject", "Body", "Attachment", "PDF", "Lines", "Status", "Fingerprint", "Prepared"],
  ["9101", "Customer A", "2030-03-01", "2030-03-31", 200, "billing@example.com", "", "March invoice", "Hello,\r\nInvoice attached.", "NCPT Invoice 9101.pdf", "https://drive.example.com/9101", "3/4/2030 x1 @ $200.00", "READY", "fp9101", "2030-03-31T08:00:00Z"],
  ["9102", "Customer B", "2030-03-01", "2030-03-31", 450, "", "", "March invoice", "Hello", "NCPT Invoice 9102.pdf", "https://drive.example.com/9102", "3/6/2030 x2 @ $225.00", "READY", "fp9102", "2030-03-31T08:00:00Z"],
  ["", "Customer C", "", "", 0, "", "", "", "", "", "", "", "READY", "", ""],
  ["9100", "Customer D", "2030-02-01", "2030-02-28", 300, "", "", "", "", "", "https://drive.example.com/9100", "2/5/2030 x1 @ $300.00", "SENT", "", "2030-03-02T09:00:00Z"],
];

// Made-up compliance rows (codes only). Dates sit around late Oct 2026 so the dev demo looks populated.
export const deadlinesFixture: Grid = [
  ["Id", "Title", "Domain", "Kind", "Period", "Due", "Raw due", "Rolled", "Days left", "State", "Blocker", "Method", "Level", "Verify", "Bench", "Note"],
  ["X1", "Workers comp audit form", "NCPT", "insurance", "2026", "2026-10-26", "2026-10-26", "", -2, "open", "", "Insurer portal", "state", "", "ncpt-wc", ""],
  ["X2", "Form 940 FUTA deposit Q3", "NCPT", "payroll", "2026Q3", "2026-10-30", "2026-10-30", "", 2, "open", "", "EFTPS", "federal", "", "ncpt-940", "Only if over $500"],
  ["X3", "Form 941 Q3", "NCPT", "payroll", "2026Q3", "2026-11-02", "2026-10-31", "yes", 5, "open", "", "E-file", "federal", "", "ncpt-941", "Oct 31 is a Saturday"],
  ["X4", "DE 9 and DE 9C Q3", "NCPT", "payroll", "2026Q3", "2026-11-02", "2026-10-31", "yes", 5, "done", "", "e-Services", "state", "", "ncpt-de9", ""],
  ["X5", "Q4 payroll deposit", "NCPT", "payroll", "2026Q4", "2026-11-16", "2026-11-16", "", 19, "blocked", "Q4 payroll not run yet", "EFTPS", "federal", "", "ncpt-q4", ""],
  ["X6", "Business license renewal", "NCPT", "license", "2027", "2026-12-15", "2026-12-15", "", 48, "open", "", "City portal", "local", "", "ncpt-license", ""],
  ["X7", "Form 941 Q4", "NCPT", "payroll", "2026Q4", "2027-02-01", "2027-01-31", "yes", 96, "open", "", "E-file", "federal", "", "ncpt-941", ""],
  ["X8", "W-2 and W-3", "NCPT", "payroll", "2026", "2027-02-01", "2027-01-31", "yes", 96, "open", "", "SSA Business Services", "federal", "", "ncpt-w2", ""],
  ["X9", "1099-NEC filing", "NCPT", "payroll", "2026", "2027-02-01", "2027-01-31", "yes", 96, "verify", "", "IRIS", "federal", "Threshold for tax year 2026 is $2,000 (confirm)", "ncpt-1099", ""],
  ["X10", "Sales tax permit review", "NCPT", "license", "", "", "", "", "", "undated", "", "", "state", "Confirm whether the permit applies", "", ""],
  ["X11", "Form 944 annual payroll return", "NCPT", "payroll", "2026", "2027-01-31", "2027-01-31", "", 95, "exempt", "", "", "federal", "", "", "Files 941 quarterly instead"],
];

// Extra deadline rows for the kit and payroll screens: real item ids (F1 = 941, C1 = DE 9, C2 = DE 9C ...) so a kit can find its row.
// Kept apart from deadlinesFixture, whose size the deadline tests pin. Demo mode shows both.
export const kitDeadlinesFixture: Grid = [
  ["Id", "Title", "Domain", "Kind", "Period", "Due", "Raw due", "Rolled", "Days left", "State", "Blocker", "Method", "Level", "Verify", "Bench", "Note"],
  ["F1", "Form 941 Q4", "NCPT", "payroll", "2026Q4", "2027-02-01", "2027-01-31", "yes", 96, "open", "", "TaxBandits", "federal", "", "ncpt-941", ""],
  ["F2", "Federal tax deposit Q4", "NCPT", "payroll", "2026Q4", "2027-01-15", "2027-01-15", "", 80, "open", "", "EFTPS", "federal", "", "", ""],
  ["F3", "Form 940 (FUTA)", "NCPT", "payroll", "2026", "2027-02-01", "2027-01-31", "yes", 96, "open", "", "TaxBandits", "federal", "", "", ""],
  ["F4", "W-2 / W-3 (Julie)", "NCPT", "payroll", "2026", "2027-02-01", "2027-01-31", "yes", 96, "open", "", "SSA Business Services", "federal", "", "", ""],
  ["C1", "DE 9 Q4", "NCPT", "payroll", "2026Q4", "2027-02-01", "2027-01-31", "yes", 96, "open", "", "EDD e-Services", "state", "", "", ""],
  ["C2", "DE 9C Q4", "NCPT", "payroll", "2026Q4", "2027-02-01", "2027-01-31", "yes", 96, "open", "", "EDD e-Services", "state", "", "", ""],
  ["C3", "EDD deposit Q4", "NCPT", "payroll", "2026Q4", "2027-02-01", "2027-02-01", "", 96, "open", "", "EDD e-Services", "state", "", "", ""],
  ["I1", "Quarterly payroll run", "NCPT", "payroll", "2026Q4", "2026-12-22", "2026-12-22", "", 54, "open", "", "Payroll tracker", "internal", "", "", ""],
];

// App Payroll for Q4 2026, made-up numbers (gross 12,500; fed PIT 586.50; CA PIT 327.91; EDD 490.41; EFTPS 2,499).
const payrollHead = ["Section", "Key", "Label", "Amount", "Due", "Status", "Detail"];
const payrollAmounts: [string, string, number][] = [
  ["gross", "Gross wages", 12500], ["deferral", "Roth 401k deferral", 0], ["cash", "Cash paycheck (net pay less deferral)", 10466.84],
  ["correction", "Correction added to the cash paycheck", 199.5], ["match", "401k employer match", 3125],
  ["fed_pit", "Federal income tax withheld", 586.5], ["ca_pit", "CA PIT withheld", 327.91], ["sdi", "CA SDI withheld", 162.5],
  ["ee_ss", "Social Security, employee", 775], ["ee_medicare", "Medicare, employee", 181.25],
  ["er_ss", "Social Security, employer", 775], ["er_medicare", "Medicare, employer", 181.25],
  ["ui_ett", "CA UI + ETT, employer", 0], ["eftps", "EFTPS deposit", 2499], ["edd", "EDD deposit", 490.41],
];
const payrollChecks: [string, string, string, string][] = [
  ["GROSS_SET", "Gross wages set in the tracker", "ok", "gross 12,500.00"],
  ["FED_PIT_EMPTY", "Federal PIT row filled", "ok", "federal PIT 586.50; policy 586.50 (EFTPS target 2,499.00)"],
  ["FED_PIT_IN_DEDUCTIONS", "Federal PIT in net pay and the EFTPS deposit", "ok", "net pay and EFTPS include federal PIT"],
  ["EDD_TOTAL", "EDD deposit = SDI + CA PIT + UI/ETT", "ok", "EDD 490.41 vs SDI 162.50 + CA PIT 327.91 + UI/ETT 0.00 = 490.41"],
  ["DEFERRAL_LIMIT", "401k deferral and 415(c) limits", "ok", "deferral YTD 24,500.00 of 24,500.00"],
  ["WAGE_BASE", "Wage bases (Social Security, Medicare, CA UI)", "ok", "wages YTD 52,500.00; UI taxable this quarter 0.00"],
  ["PRIOR_LEGS_TIE", "Earlier quarters tie to the bank", "ok", "2026Q1 -15.50 accepted; 2026Q2 215.00 accepted; 2026Q3 tied"],
  ["CA_PIT_OPTION_A", "CA PIT per DE 4 (option A)", "ok", "CA PIT 327.91 vs EDD Method B 327.91 (single, 0 allowances)"],
  ["EFTPS_UNDER_2500", "EFTPS under $2,500 (pay with the 941)", "ok", "EFTPS 2,499.00"],
  ["DE4_SIGNED", "Signed DE 4 on file", "warn", "can't check offline: confirm the signed DE 4 is on file"],
  ["EDD_EFILE", "EDD e-file figures clean", "ok", "no flags"],
];
const payrollLegs: [string, string, number, string, string, string][] = [
  ["ascensus", "Ascensus 401k deferral + match", 3125, "2026-12-31", "matched", '{"portal":"https://www.ascensus.com/","cleared_on":"2026-12-31","cleared_amount":3125,"diff":0}'],
  ["cash_paycheck", "Cash paycheck transfer", 10666.34, "2026-12-22", "pending", '{"portal":"https://bank.example.com/","cleared_on":"","cleared_amount":null,"diff":null}'],
  ["eftps", "EFTPS / Form 941 deposit", 2499, "2027-01-15", "pending", '{"portal":"https://www.eftps.gov/","cleared_on":"","cleared_amount":null,"diff":null}'],
  ["edd", "CA EDD deposit", 490.41, "2027-02-01", "mismatch", '{"portal":"https://eddservices.edd.ca.gov/tap/secure/eservices","cleared_on":"2027-01-08","cleared_amount":490.14,"diff":-0.27}'],
];
const payrollFiling: [string, string, number | string, string, string][] = [
  ["941.1", "Number of employees", 1, "", "2027-02-01"], ["941.2", "Wages, tips and other compensation", 12500, "", "2027-02-01"],
  ["941.3", "Federal income tax withheld", 586.5, "", "2027-02-01"], ["941.5a.2", "Social security tax (x 0.124)", 1550, "", "2027-02-01"],
  ["941.16", "Deposit schedule", "", "line 12 under $2,500: pay with the return", "2027-02-01"],
  ["de9.subject_wages", "DE 9 total subject wages", 12500, "", "2027-02-01"], ["de9.pit_withheld", "DE 9 CA PIT withheld", 327.91, "", "2027-02-01"],
  ["de9c.wage_plan_code", "DE 9C wage plan code", "", "S", "2027-02-01"], ["de9c.employee_counts", "DE 9C employees, months 1-3", "", "1,1,1", "2027-02-01"],
];
const amountsJson = JSON.stringify(Object.fromEntries([...payrollAmounts].sort((a, b) => a[0].localeCompare(b[0])).map(([k, , v]) => [k, v] as [string, number])));
const payrollMeta = (state: string, detail: string, can: string, canWhy: string) => [
  ["meta", "ref", "Quarter", "", "", "", "2026Q4"], ["meta", "fingerprint", "Fingerprint", "", "", "", "a1b2c3d4e5f60718293a4b5c"],
  ["meta", "amounts_json", "Amounts (JSON)", "", "", "", amountsJson],
  ["meta", "approval", "Approval", "", "", state, detail], ["meta", "can_approve", "Can approve", "", "", can, canWhy],
  ["meta", "run_by", "Run by", "", "2026-12-22", "", ""], ["meta", "deferral_room", "Deferral room before this run", 0, "", "", ""],
  ["meta", "cum_gross_before", "Gross wages earlier this year", 40000, "", "", ""], ["meta", "tracker", "Payroll tracker", "", "", "ok", ""],
  ["meta", "built", "Built", "", "", "", "2026-10-29T06:28"],
];
export const payrollFixture: Grid = [
  payrollHead,
  ...payrollAmounts.map(([k, l, v]) => ["run", k, l, v, "", "", ""]),
  ...payrollChecks.map(([k, l, s, d]) => ["check", k, l, "", "", s, d]),
  ...payrollLegs.map(([k, l, a, due, s, d]) => ["leg", k, l, a, due, s, d]),
  ...payrollFiling.map(([k, l, a, d, due]) => ["filing", k, l, a, due, "", d]),
  ...payrollMeta("none", "", "yes", ""),
];
// The same run with the federal PIT row left empty: a check blocks and Approve stays disabled.
export const payrollBlockedFixture: Grid = [
  payrollHead,
  ...payrollAmounts.map(([k, l, v]) => ["run", k, l, k === "fed_pit" ? 0 : v, "", "", ""]),
  ...payrollChecks.map(([k, l, s, d]) => (k === "FED_PIT_EMPTY" ? ["check", k, l, "", "", "block", "federal PIT 0.00; policy 586.50 (EFTPS target 2,499.00)"] : ["check", k, l, "", "", s, d])),
  ...payrollLegs.map(([k, l, a, due, s, d]) => ["leg", k, l, a, due, s, d]),
  ...payrollMeta("none", "", "no", "blocked by FED_PIT_EMPTY"),
];

// App Kits (made-up values). Period matches the kitDeadlinesFixture rows.
export const kitsFixture: Grid = [
  ["Kit", "Period", "Order", "Line", "Label", "Value", "Source", "Tie", "Status"],
  ["F1", "2026Q4", 0, "kit", "Form 941", "https://www.taxbandits.com/", "fp0f1", "", "check"],
  ["F1", "2026Q4", 1, "1", "Employees paid for the pay period including the 12th of month 3", 1, "one employee", "", ""],
  ["F1", "2026Q4", 2, "2", "Wages, tips and other compensation", 12500, "tracker Gross Payroll (row 4)", "", ""],
  ["F1", "2026Q4", 3, "3", "Federal income tax withheld", 586.5, "tracker Federal PIT (row 14)", "", ""],
  ["F1", "2026Q4", 4, "4", "No wages subject to social security or Medicare tax", "unchecked", "", "", ""],
  ["F1", "2026Q4", 5, "5a col 2", "Social security tax (x 0.124)", 1550, "computed", "", ""],
  ["F1", "2026Q4", 6, "13", "Total deposits for this quarter", 2499, "tracker Federal Taxes (EFTPS)", "", ""],
  ["F1", "2026Q4", 901, "tie", "line 5a col 2 = employee + employer SS", "1550 / 1550", "", "941_5A_EE_ER_SS", "ok"],
  ["F1", "2026Q4", 902, "tie", "line 13 deposits = line 12 liability", "2499 / 2500", "a difference shows as a balance due or overpayment", "941_13_VS_12", "FAIL"],
  ["F3", "2026", 0, "kit", "Form 940", "https://www.taxbandits.com/", "fp0f3", "", "verify"],
  ["F3", "2026", 1, "1a", "State where you paid wages", "CA", "profile", "", ""],
  ["F3", "2026", 2, "3", "Total payments to all employees", 52500, "ledger", "", ""],
  ["F3", "2026", 951, "verify", "California credit reduction rate for 2026 is a forecast: confirm in November", "", "", "", "verify"],
  ["F4", "2026", 0, "kit", "W-2 / W-3", "https://www.ssa.gov/bso/bsowelcome.htm", "fp0f4", "", "blocked"],
  ["F4", "2026", 981, "blocked", "Q4 payroll has not been run", "", "", "", "blocked"],
  ["C1", "2026Q4", 0, "kit", "DE 9 / DE 9C", "https://eddservices.edd.ca.gov/tap/secure/eservices", "fp0c1", "", "ready"],
  ["C1", "2026Q4", 1, "DE 9 B", "Employees in pay period incl. the 12th (months 1/2/3)", "1 / 1 / 1", "closeout_quarter.edd_json", "", ""],
  ["C1", "2026Q4", 2, "DE 9 C", "Total subject wages", 12500, "closeout_quarter.edd_json", "", ""],
  ["C1", "2026Q4", 3, "DE 9 G", "California PIT withheld", 327.91, "closeout_quarter.edd_json", "", ""],
  ["C1", "2026Q4", 4, "DE 9C I", "Wage plan code", "S", "closeout_quarter.edd_json", "", ""],
  ["TIES", "2026", 0, "kit", "Year-end tie-out", "", "fpties", "", "check"],
  ["TIES", "2026", 901, "tie", "941 line 2 summed = W-2 box 1", "52500 / 52500", "", "941_L2_W2_BOX1", "ok"],
  ["TIES", "2026", 902, "tie", "DE 9 PIT = W-2 box 17", "327.91 / 0", "box 17 not filled yet", "DE9_PIT_BOX17", "FAIL"],
  ["TIES", "2026", 903, "tie", "941 vs taxpack", "n/a / 52500", "taxpack not read", "941_TAXPACK", "n/a"],
];
