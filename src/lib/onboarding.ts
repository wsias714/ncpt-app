// New-client onboarding (App Onboarding tab, codes only): one row per client that needs a person.
// Python (ncpt_books.roster) publishes it hourly from the Client Roster; the app only reads it. Acting on a row happens
// in the Client Roster tab or the onboard CLI today, never from the phone (rate and billing change money).
import { text, type Grid } from "./parse.ts";

export const ONBOARDING_TAB = "App Onboarding";

export interface OnboardingRow { code: string; status: string; needs: string[] }

export function parseOnboarding(grid: Grid): OnboardingRow[] {
  const h = grid.findIndex((r) => text(r?.[0]) === "Code" && text(r?.[2]) === "Needs");
  if (h < 0) return [];
  return grid.slice(h + 1)
    .filter((r) => Array.isArray(r) && text(r[0]) !== "")
    .map((r) => ({ code: text(r[0]), status: text(r[1]), needs: text(r[2]).split(";").map((s) => s.trim()).filter(Boolean) }))
    .filter((r) => r.needs.length > 0);
}

/** The sentence the Today card shows for one row, e.g. "Customer B (New): confirm new client". */
export const onboardingLine = (r: OnboardingRow, label: (code: string) => string): string =>
  `${label(r.code)}${r.status ? ` (${r.status})` : ""}: ${r.needs.join(", ")}`;
