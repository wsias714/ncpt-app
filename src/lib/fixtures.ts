// Made-up numbers and customer codes only. Never paste real sheet data here.
import type { Grid } from "./parse.ts";

export const dashboardFixture: Grid = [
  ["NCPT Books", "as of 2030-03-15"],
  [],
  ["Cash (checking)", 10000.5],
  ["Credit card owed (negative = credit due to NCPT)", 250],
  ["Accounts receivable", 1500],
  ["Payroll liabilities", 0],
  ["Mileage owed to Julie", 40, "pay by 2030-04-01"],
  [],
  ["2030 YTD net income, cash basis (tax)", 4200],
  ["2030 YTD net income, accrual", 4700],
  [],
  ["Last closed month", "2030-01"],
  ["Months ready to lock", "none"],
  ["Bank rec through", "2030-02 BLOCKED"],
  ["Entries to review", 3],
  ["Payroll to explain", "none"],
  ["Close blockers", "2030-02: bank rec off by 12.00; 2030-02: payroll residue"],
  [],
  ["Built", "2030-03-15T06:00", "Tiller latest", "2030-03-14"],
];

export const closeFixture: Grid = [
  ["Month", "Checking", "Credit card", "Blockers", "Notes", "Status", "Locked"],
  ["2030-01", "TIED 9000.00", "TIED 100.00", "", "", "LOCKED", "yes"],
  ["2030-02", "OFF books 9988.00 / bank 10000.00", "TIED 250.00", "bank rec off by 12.00", "", "BLOCKED", ""],
  [],
  ["Payroll quarter", "Accrued", "Paid (bank legs)", "Residue", "Leg vs tracker", "Bank legs"],
  ["2030Q1", 1000, 1000, 0, "", ""],
  [],
  ["AR", "Books", "Wave open", "Applied here, not in Wave", "Subledger", "Difference"],
  ["", 1500, 1500, "[]", 1500, 0],
  [],
  ["Generated 2030-03-15T06:00 by ncpt_books.close"],
];

export const invoicesFixture: Grid = [
  ["Number", "Customer", "Invoice date", "Due", "Lines (JSON)", "Total", "Status", "Doc", "PDF", "Gmail draft", "Source", "Created"],
  ["9001", "Customer A", "2030-01-01", "2030-01-31", "[]", 900, "Sent", "", "", "", "wave", ""],
  ["9002", "Customer B", "2030-02-01", "2030-03-02", "[]", 300, "Paid", "", "", "", "wave", ""],
  ["9003", "Zed Example Name", "2030-03-01", "2030-03-31", "[]", "$600.00", "Sent", "", "", "", "wave", ""],
  ["9004", "Customer C", "2030-03-05", "2030-04-04", "[]", 100, "Draft", "", "", "", "ncpt-books", ""],
];
