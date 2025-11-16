/**
 * Odds conversion utilities
 * Decimal odds: European format (e.g., 2.50 means you win 2.5x your stake)
 * American odds: US format (e.g., +150 means you win $150 on a $100 bet, -200 means you need to bet $200 to win $100)
 */

/**
 * Convert decimal odds to American odds
 */
export function decimalToAmerican(decimal: number): number | null {
  if (decimal < 1) return null;
  if (decimal === 1) return 100; // Even money bet (1:1)
  
  if (decimal >= 2) {
    // Positive American odds
    return Math.round((decimal - 1) * 100);
  } else {
    // Negative American odds (between 1 and 2)
    return Math.round(-100 / (decimal - 1));
  }
}

/**
 * Convert American odds to decimal odds
 */
export function americanToDecimal(american: number): number | null {
  if (american === 0) return null;
  
  if (american > 0) {
    // Positive American odds
    return parseFloat(((american / 100) + 1).toFixed(2));
  } else {
    // Negative American odds
    return parseFloat(((-100 / american) + 1).toFixed(2));
  }
}

/**
 * Format American odds for display
 */
export function formatAmericanOdds(american: number): string {
  if (american > 0) {
    return `+${american}`;
  }
  return american.toString();
}

/**
 * Validate decimal odds
 */
export function isValidDecimal(odds: number): boolean {
  return odds >= 1 && isFinite(odds) && !isNaN(odds);
}

/**
 * Validate American odds
 */
export function isValidAmerican(odds: number): boolean {
  return odds !== 0 && isFinite(odds) && !isNaN(odds) && (odds >= 100 || odds <= -100);
}

