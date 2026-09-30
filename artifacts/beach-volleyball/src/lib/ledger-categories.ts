/**
 * Overnight brief 30 Sep, item 26: the ledger's categories in plain words.
 * Transaction History showed the stored codes (PRIZE_MONEY, STAFF_SALARY,
 * RUNNING_COSTS). Every category the server writes has its words here; one it
 * does not know is shown in words made from the code, never the code itself.
 */
export const LEDGER_CATEGORY_LABELS: Record<string, string> = {
  prize_money:       "Prize money",
  sponsorship:       "Sponsorship",
  promo_deal:        "Promotional deal",
  salaries:          "Player wages",
  player_salary:     "Player wages",
  staff_salary:      "Staff wages",
  staff_termination: "Contract paid out",
  running_costs:     "Running costs",
  facilities:        "Facilities",
  scouting:          "Scouting",
  youth_academy:     "Youth academy",
  signing_fee:       "Signing fee",
  transfer_fee:      "Transfer fee",
  training_cost:     "Training",
  outfit_purchase:   "Kit",
  wellbeing:         "Wellbeing",
  other:             "Other",
};

export function ledgerCategoryLabel(code: string | null | undefined): string {
  if (!code) return "Other";
  const known = LEDGER_CATEGORY_LABELS[code];
  if (known) return known;
  const words = code.replace(/_/g, " ").toLowerCase();
  return words.charAt(0).toUpperCase() + words.slice(1);
}
