/**
 * Rental Income incentive slabs (monthly transaction value in ₹).
 * DOCILE ONLINE MART PRIVATE LIMITED — haathpe.com vendor incentive program.
 * Easy to adjust slabs later; used for tier display and payout calculation.
 */

export interface RentalSlab {
  minVolume: number;
  maxVolume: number | null;
  payout: number;
  label: string;
}

/** Slabs: monthly transaction value (₹) → payout (₹). Last row is 100,000+. */
export const RENTAL_INCOME_SLABS: RentalSlab[] = [
  { minVolume: 0, maxVolume: 19_999, payout: 0, label: "Below ₹20,000" },
  { minVolume: 20_000, maxVolume: 29_999, payout: 150, label: "₹20,000 – ₹29,999" },
  { minVolume: 30_000, maxVolume: 39_999, payout: 200, label: "₹30,000 – ₹39,999" },
  { minVolume: 40_000, maxVolume: 49_999, payout: 250, label: "₹40,000 – ₹49,999" },
  { minVolume: 50_000, maxVolume: 59_999, payout: 300, label: "₹50,000 – ₹59,999" },
  { minVolume: 60_000, maxVolume: 79_999, payout: 350, label: "₹60,000 – ₹79,999" },
  { minVolume: 80_000, maxVolume: 99_999, payout: 400, label: "₹80,000 – ₹99,999" },
  { minVolume: 100_000, maxVolume: null, payout: 500, label: "₹1,00,000+" },
];

export interface IncentiveResult {
  tierLabel: string;
  payout: number;
  /** Next tier threshold (volume needed for next payout); null if already at top. */
  nextTierAt: number | null;
  /** Payout at next tier. */
  nextTierPayout: number | null;
}

/**
 * Get tier label and payout for a given monthly transaction volume (₹).
 */
export function getIncentive(amount: number): IncentiveResult {
  const rounded = Math.round(amount);
  let current: RentalSlab = RENTAL_INCOME_SLABS[0];
  let nextSlab: RentalSlab | null = null;

  for (let i = 0; i < RENTAL_INCOME_SLABS.length; i++) {
    const slab = RENTAL_INCOME_SLABS[i];
    const inRange =
      rounded >= slab.minVolume &&
      (slab.maxVolume === null || rounded <= slab.maxVolume);
    if (inRange) {
      current = slab;
      nextSlab = RENTAL_INCOME_SLABS[i + 1] ?? null;
      break;
    }
  }

  return {
    tierLabel: current.label,
    payout: current.payout,
    nextTierAt: nextSlab ? nextSlab.minVolume : null,
    nextTierPayout: nextSlab ? nextSlab.payout : null,
  };
}

/** Full slab table for display (same order as RENTAL_INCOME_SLABS). */
export function getSlabsForTable(): RentalSlab[] {
  return [...RENTAL_INCOME_SLABS];
}
