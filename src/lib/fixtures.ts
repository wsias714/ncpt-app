// Made-up numbers, codes and descriptions only. Never paste real sheet data here.
import type { Grid } from "./parse.ts";

export const summaryFixture: Grid = [
  ["Key", "Value", "Note"],
  ["built", "2030-03-15T06:00", ""],
  ["as_of", "2030-03-15", ""],
  ["profit_mtd", 1200.5, "cash basis"],
  ["profit_last_month", 3400, ""],
  ["profit_ytd", 9100, ""],
  ["net_wages_mtd", 0, ""],
  ["net_wages_last_month", 2200, ""],
  ["net_wages_ytd", 4500, ""],
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
  ["Month", "Income", "Expense", "Net cash", "Net accrual", "Cash end", "AR end", "Card owed end", "Net wages"],
  ["2030-02", 4000, 1000, 3000, 3100, 9000, 1200, 100, 2200],
  ["2030-01", 3500, 1100, 2400, 2400, 7000, 900, 80, 2300],
  ["2030-03", 2000, 800, 1200, 1300, 10000.5, 1500, 250, 0],
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
